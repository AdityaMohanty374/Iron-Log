// Local, offline data layer. Replaces the old api.js (which talked to the
// FastAPI/Neon backend). Everything here runs against an on-device SQLite
// database via @capacitor-community/sqlite, and re-implements the same
// business logic that used to live in backend/main.py (streaks, color
// gradient, history grouping, etc).

import { CapacitorSQLite, SQLiteConnection } from "@capacitor-community/sqlite";
import { Capacitor } from "@capacitor/core";

const DB_NAME = "ironlog";
const sqlite = new SQLiteConnection(CapacitorSQLite);
let dbPromise = null;

const SCHEMA_SQL = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS cycles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL DEFAULT 'My Cycle',
  num_days INTEGER NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS cycle_days (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cycle_id INTEGER NOT NULL REFERENCES cycles(id) ON DELETE CASCADE,
  day_index INTEGER NOT NULL,
  name TEXT NOT NULL,
  is_rest INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS exercises (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cycle_day_id INTEGER NOT NULL REFERENCES cycle_days(id) ON DELETE CASCADE,
  order_index INTEGER NOT NULL,
  type TEXT NOT NULL DEFAULT 'normal',
  names TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS workout_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cycle_id INTEGER NOT NULL REFERENCES cycles(id) ON DELETE CASCADE,
  cycle_day_id INTEGER NOT NULL REFERENCES cycle_days(id),
  date TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS exercise_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  workout_log_id INTEGER NOT NULL REFERENCES workout_logs(id) ON DELETE CASCADE,
  exercise_id INTEGER NOT NULL REFERENCES exercises(id),
  num_sets INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS set_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  exercise_log_id INTEGER NOT NULL REFERENCES exercise_logs(id) ON DELETE CASCADE,
  set_index INTEGER NOT NULL,
  sub_index INTEGER NOT NULL DEFAULT 0,
  weight REAL,
  reps INTEGER,
  rpe REAL
);
`;

// ---------------------------------------------------------------------------
// Connection bootstrap
// ---------------------------------------------------------------------------
async function getDb() {
  if (dbPromise) return dbPromise;

  dbPromise = (async () => {
    // Web platform needs the jeep-sqlite wrapper store initialized once
    // (see main.jsx). Native platforms (Android/iOS) work out of the box.
    if (Capacitor.getPlatform() === "web") {
      await sqlite.initWebStore();
    }

    const isConn = (await sqlite.isConnection(DB_NAME, false)).result;
    const db = isConn
      ? await sqlite.retrieveConnection(DB_NAME, false)
      : await sqlite.createConnection(DB_NAME, false, "no-encryption", 1, false);

    await db.open();
    await db.execute(SCHEMA_SQL);

    if (Capacitor.getPlatform() === "web") {
      await sqlite.saveToStore(DB_NAME);
    }
    return db;
  })();

  return dbPromise;
}

async function persist(db) {
  if (Capacitor.getPlatform() === "web") await sqlite.saveToStore(DB_NAME);
}

async function run(sql, params = []) {
  const db = await getDb();
  const res = await db.run(sql, params);
  await persist(db);
  return res;
}

async function all(sql, params = []) {
  const db = await getDb();
  const res = await db.query(sql, params);
  return res.values || [];
}

// ---------------------------------------------------------------------------
// Cycle helpers
// ---------------------------------------------------------------------------
async function hydrateCycle(cycleRow) {
  if (!cycleRow) return null;
  const days = await all(
    "SELECT * FROM cycle_days WHERE cycle_id = ? ORDER BY day_index ASC",
    [cycleRow.id]
  );
  for (const day of days) {
    const exercises = await all(
      "SELECT * FROM exercises WHERE cycle_day_id = ? ORDER BY order_index ASC",
      [day.id]
    );
    day.is_rest = !!day.is_rest;
    day.exercises = exercises.map((ex) => ({ ...ex, names: JSON.parse(ex.names) }));
  }
  return { ...cycleRow, is_active: !!cycleRow.is_active, days };
}

function validateExerciseNames(ex) {
  const n = ex.names?.length || 0;
  if (ex.type === "normal" && n !== 1) throw new Error("Normal exercise needs exactly 1 name");
  if (ex.type === "superset" && n !== 2) throw new Error("Superset needs exactly 2 names");
  if (ex.type === "circuit" && n < 2) throw new Error("Circuit needs at least 2 names");
}

async function createCycle(payload) {
  for (const d of payload.days) {
    if (!d.is_rest) for (const ex of d.exercises) validateExerciseNames(ex);
  }

  await run("UPDATE cycles SET is_active = 0");
  const cycleRes = await run(
    "INSERT INTO cycles (name, num_days, is_active) VALUES (?, ?, 1)",
    [payload.name, payload.num_days]
  );
  const cycleId = cycleRes.changes.lastId;

  for (let idx = 0; idx < payload.days.length; idx++) {
    const d = payload.days[idx];
    const dayRes = await run(
      "INSERT INTO cycle_days (cycle_id, day_index, name, is_rest) VALUES (?, ?, ?, ?)",
      [cycleId, idx, d.name, d.is_rest ? 1 : 0]
    );
    const dayId = dayRes.changes.lastId;
    const exercises = d.is_rest ? [] : d.exercises;
    for (let exIdx = 0; exIdx < exercises.length; exIdx++) {
      const ex = exercises[exIdx];
      await run(
        "INSERT INTO exercises (cycle_day_id, order_index, type, names) VALUES (?, ?, ?, ?)",
        [dayId, exIdx, ex.type, JSON.stringify(ex.names)]
      );
    }
  }

  const row = (await all("SELECT * FROM cycles WHERE id = ?", [cycleId]))[0];
  return hydrateCycle(row);
}

async function listCycles() {
  const rows = await all("SELECT * FROM cycles ORDER BY created_at DESC");
  return Promise.all(rows.map(hydrateCycle));
}

async function activeCycle() {
  const rows = await all("SELECT * FROM cycles WHERE is_active = 1 LIMIT 1");
  return rows[0] ? hydrateCycle(rows[0]) : null;
}

// ---------------------------------------------------------------------------
// Workout logging
// ---------------------------------------------------------------------------
async function saveExerciseLogs(workoutLogId, exerciseLogs) {
  for (const el of exerciseLogs) {
    const res = await run(
      "INSERT INTO exercise_logs (workout_log_id, exercise_id, num_sets) VALUES (?, ?, ?)",
      [workoutLogId, el.exercise_id, el.num_sets]
    );
    const exerciseLogId = res.changes.lastId;
    for (const s of el.sets) {
      await run(
        `INSERT INTO set_logs (exercise_log_id, set_index, sub_index, weight, reps, rpe)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [exerciseLogId, s.set_index, s.sub_index, s.weight, s.reps, s.rpe]
      );
    }
  }
}

async function logWorkout(payload) {
  const cycleDay = (await all("SELECT * FROM cycle_days WHERE id = ?", [payload.cycle_day_id]))[0];
  if (!cycleDay) throw new Error("Cycle day not found");

  const logDate = payload.date || todayStr();
  const res = await run(
    "INSERT INTO workout_logs (cycle_id, cycle_day_id, date) VALUES (?, ?, ?)",
    [cycleDay.cycle_id, cycleDay.id, logDate]
  );
  const workoutLogId = res.changes.lastId;
  await saveExerciseLogs(workoutLogId, payload.exercise_logs);
  return getWorkout(workoutLogId);
}

async function hydrateWorkoutLog(row) {
  if (!row) return null;
  const exerciseLogs = await all(
    "SELECT * FROM exercise_logs WHERE workout_log_id = ?",
    [row.id]
  );
  for (const el of exerciseLogs) {
    el.sets = await all(
      "SELECT * FROM set_logs WHERE exercise_log_id = ? ORDER BY set_index ASC, sub_index ASC",
      [el.id]
    );
  }
  return { ...row, exercise_logs: exerciseLogs };
}

async function listWorkouts() {
  const rows = await all("SELECT * FROM workout_logs ORDER BY date DESC");
  return Promise.all(rows.map(hydrateWorkoutLog));
}

async function getWorkout(id) {
  const row = (await all("SELECT * FROM workout_logs WHERE id = ?", [id]))[0];
  if (!row) throw new Error("Workout not found");
  return hydrateWorkoutLog(row);
}

async function updateWorkout(id, payload) {
  const existing = (await all("SELECT * FROM workout_logs WHERE id = ?", [id]))[0];
  if (!existing) throw new Error("Workout not found");

  const cycleDay = (await all("SELECT * FROM cycle_days WHERE id = ?", [payload.cycle_day_id]))[0];
  if (!cycleDay) throw new Error("Cycle day not found");

  await run(
    "UPDATE workout_logs SET cycle_day_id = ?, cycle_id = ?, date = ? WHERE id = ?",
    [cycleDay.id, cycleDay.cycle_id, payload.date || existing.date, id]
  );

  // Cascade removes exercise_logs' set_logs too (PRAGMA foreign_keys = ON)
  await run("DELETE FROM exercise_logs WHERE workout_log_id = ?", [id]);
  await saveExerciseLogs(id, payload.exercise_logs);

  return getWorkout(id);
}

async function deleteWorkout(id) {
  const existing = (await all("SELECT * FROM workout_logs WHERE id = ?", [id]))[0];
  if (!existing) throw new Error("Workout not found");
  await run("DELETE FROM workout_logs WHERE id = ?", [id]);
  return null;
}

// ---------------------------------------------------------------------------
// Date helpers (dates are always 'YYYY-MM-DD' strings, compared as UTC days)
// ---------------------------------------------------------------------------
function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function toUtcDate(s) {
  return new Date(`${s}T00:00:00Z`);
}

function daysBetween(a, b) {
  // a - b, in whole days
  return Math.round((toUtcDate(a) - toUtcDate(b)) / 86400000);
}

function addDays(dateStr, n) {
  const d = toUtcDate(dateStr);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function mod(a, n) {
  return ((a % n) + n) % n;
}

// ---------------------------------------------------------------------------
// Color progression (ported from main.py interpolate_color)
// ---------------------------------------------------------------------------
const GREEN_STOPS = ["#ECFDF5", "#D1FAE5", "#A7F3D0", "#6EE7B7", "#10B981"];

function hexToRgb(h) {
  h = h.replace("#", "");
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
}

function rgbToHex(rgb) {
  return "#" + rgb.map((c) => Math.max(0, Math.min(255, Math.round(c))).toString(16).padStart(2, "0").toUpperCase()).join("");
}

function interpolateColor(position, totalSteps) {
  if (totalSteps <= 1) return GREEN_STOPS[GREEN_STOPS.length - 1];
  const ratio = Math.min(Math.max((position - 1) / (totalSteps - 1), 0), 1);
  const scaled = ratio * (GREEN_STOPS.length - 1);
  const lo = Math.floor(scaled);
  const hi = Math.min(lo + 1, GREEN_STOPS.length - 1);
  const frac = scaled - lo;
  const rgbLo = hexToRgb(GREEN_STOPS[lo]);
  const rgbHi = hexToRgb(GREEN_STOPS[hi]);
  const rgb = rgbLo.map((c, i) => c + (rgbHi[i] - c) * frac);
  return rgbToHex(rgb);
}

// ---------------------------------------------------------------------------
// Dashboard: current week + streak + color progression
// (ported from main.py's /dashboard route)
// ---------------------------------------------------------------------------
async function dashboard() {
  const cycle = await activeCycle();
  const today = todayStr();

  if (!cycle || cycle.days.length === 0) {
    const week = [];
    for (let i = 6; i >= 0; i--) {
      const d = addDays(today, -i);
      week.push({
        date: d,
        label: toUtcDate(d).toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" }),
        completed: false,
        is_rest: false,
        is_today: d === today,
        color: "#F3F4F6",
      });
    }
    return { streak: 0, week, active_cycle: null };
  }

  const n = cycle.days.length;
  const logs = await all(
    "SELECT DISTINCT date FROM workout_logs WHERE cycle_id = ?",
    [cycle.id]
  );
  const loggedDates = new Set(logs.map((l) => l.date));
  const firstLogDate = loggedDates.size > 0 ? [...loggedDates].sort()[0] : today;

  const daysByIndex = {};
  cycle.days.forEach((d) => (daysByIndex[d.day_index] = d));

  function dayCompleted(d) {
    const expectedIdx = mod(daysBetween(d, firstLogDate), n);
    const expectedDay = daysByIndex[expectedIdx];
    if (!expectedDay) return false;
    if (expectedDay.is_rest) return true;
    return loggedDates.has(d);
  }

  let streak = 0;
  if (loggedDates.size > 0) {
    let cursor = today;
    while (dayCompleted(cursor)) {
      streak += 1;
      cursor = addDays(cursor, -1);
      if (daysBetween(cursor, firstLogDate) < -1) break;
    }
  }

  const week = [];
  for (let i = 6; i >= 0; i--) {
    const d = addDays(today, -i);
    const completed = loggedDates.size > 0 && d >= firstLogDate ? dayCompleted(d) : false;
    const expectedIdx = loggedDates.size > 0 ? mod(daysBetween(d, firstLogDate), n) : null;
    const isRest = expectedIdx !== null && daysByIndex[expectedIdx] ? daysByIndex[expectedIdx].is_rest : false;

    let pos = 0;
    let c = d;
    while (loggedDates.size > 0 && c >= firstLogDate && dayCompleted(c)) {
      pos += 1;
      c = addDays(c, -1);
    }
    const color = pos > 0 ? interpolateColor(pos, n) : "#F3F4F6";

    week.push({
      date: d,
      label: toUtcDate(d).toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" }),
      completed,
      is_rest: isRest,
      is_today: d === today,
      color,
    });
  }

  return { streak, week, active_cycle: cycle };
}

// ---------------------------------------------------------------------------
// History grouped by cycle
// ---------------------------------------------------------------------------
async function history() {
  const cycles = await listCycles();
  if (cycles.length === 0) return { no_data: true, cycles: [] };

  let anyLogs = false;
  const result = [];

  for (const cycle of cycles) {
    const logRows = await all(
      "SELECT * FROM workout_logs WHERE cycle_id = ? ORDER BY date DESC",
      [cycle.id]
    );
    if (logRows.length > 0) anyLogs = true;

    const logs = [];
    for (const l of logRows) {
      const cycleDay = (await all("SELECT * FROM cycle_days WHERE id = ?", [l.cycle_day_id]))[0];
      const exerciseLogRows = await all(
        "SELECT * FROM exercise_logs WHERE workout_log_id = ?",
        [l.id]
      );
      const exerciseLogs = [];
      for (const el of exerciseLogRows) {
        const exercise = (await all("SELECT * FROM exercises WHERE id = ?", [el.exercise_id]))[0];
        const sets = await all(
          "SELECT set_index, sub_index, weight, reps, rpe FROM set_logs WHERE exercise_log_id = ? ORDER BY set_index ASC, sub_index ASC",
          [el.id]
        );
        exerciseLogs.push({
          exercise_id: el.exercise_id,
          exercise_name: exercise ? JSON.parse(exercise.names).join(" / ") : `Exercise #${el.exercise_id}`,
          num_sets: el.num_sets,
          sets,
        });
      }
      logs.push({
        id: l.id,
        date: l.date,
        cycle_day_id: l.cycle_day_id,
        day_name: cycleDay ? cycleDay.name : "",
        exercise_logs: exerciseLogs,
      });
    }

    result.push({
      cycle_id: cycle.id,
      cycle_name: cycle.name,
      is_active: cycle.is_active,
      logs,
    });
  }

  return { no_data: !anyLogs, cycles: result };
}

// ---------------------------------------------------------------------------
// Exercise history chart data (reps + weight over time)
// ---------------------------------------------------------------------------
async function exerciseHistory(exerciseId) {
  const exercise = (await all("SELECT * FROM exercises WHERE id = ?", [exerciseId]))[0];
  if (!exercise) throw new Error("Exercise not found");

  const rows = await all(
    `SELECT wl.date as date, sl.reps as reps, sl.weight as weight, sl.sub_index as sub_index
     FROM set_logs sl
     JOIN exercise_logs el ON sl.exercise_log_id = el.id
     JOIN workout_logs wl ON el.workout_log_id = wl.id
     WHERE el.exercise_id = ?
     ORDER BY wl.date ASC`,
    [exerciseId]
  );

  const points = rows.map((r) => ({
    date: r.date,
    reps: r.reps || 0,
    weight: r.weight || 0,
    sub_index: r.sub_index,
  }));

  return { exercise_name: JSON.parse(exercise.names).join(" / "), points };
}

// ---------------------------------------------------------------------------
// One-time backup import (from the old Neon/Postgres export query)
// Shape expected:
// {
//   cycles: [{ name, num_days, is_active, created_at,
//              days: [{ day_index, name, is_rest,
//                       exercises: [{ order_index, type, names }] }] }],
//   workout_logs: [{ cycle_name, cycle_day_index, date,
//                     exercise_logs: [{ exercise_order_index, num_sets,
//                                       sets: [{ set_index, sub_index, weight, reps, rpe }] }] }]
// }
// ---------------------------------------------------------------------------
async function importBackup(data) {
  const cycleNameToId = {};
  // dayKey = `${cycleName}::${dayIndex}` -> cycle_day.id
  const dayKeyToId = {};
  // exerciseKey = `${cycleName}::${dayIndex}::${orderIndex}` -> exercise.id
  const exerciseKeyToId = {};

  let importedCycles = 0;
  let importedWorkouts = 0;

  // Imported cycles are historical — don't let them clobber whichever cycle
  // is currently active on this device. Only mark one as active, and only
  // if the device has no active cycle at all yet.
  const existingActive = await activeCycle();
  let anyActiveMarked = false;

  for (const c of data.cycles || []) {
    const shouldBeActive = !existingActive && c.is_active;
    if (shouldBeActive) anyActiveMarked = true;
    const res = await run(
      "INSERT INTO cycles (name, num_days, is_active, created_at) VALUES (?, ?, ?, ?)",
      [c.name, c.num_days, shouldBeActive ? 1 : 0, c.created_at || new Date().toISOString()]
    );
    const cycleId = res.changes.lastId;
    cycleNameToId[c.name] = cycleId;
    importedCycles++;

    for (const d of c.days || []) {
      const dayRes = await run(
        "INSERT INTO cycle_days (cycle_id, day_index, name, is_rest) VALUES (?, ?, ?, ?)",
        [cycleId, d.day_index, d.name, d.is_rest ? 1 : 0]
      );
      const dayId = dayRes.changes.lastId;
      dayKeyToId[`${c.name}::${d.day_index}`] = dayId;

      for (const ex of d.exercises || []) {
        const exRes = await run(
          "INSERT INTO exercises (cycle_day_id, order_index, type, names) VALUES (?, ?, ?, ?)",
          [dayId, ex.order_index, ex.type, JSON.stringify(ex.names)]
        );
        exerciseKeyToId[`${c.name}::${d.day_index}::${ex.order_index}`] = exRes.changes.lastId;
      }
    }
  }

  // Fallback: if this device had no active cycle and nothing in the backup
  // was marked active either, activate the most recently created imported
  // cycle so the app doesn't fall back to the "set up a cycle" screen.
  if (!existingActive && !anyActiveMarked && importedCycles > 0) {
    const lastName = (data.cycles || [])[data.cycles.length - 1]?.name;
    const lastId = cycleNameToId[lastName];
    if (lastId) await run("UPDATE cycles SET is_active = 1 WHERE id = ?", [lastId]);
  }

  for (const wl of data.workout_logs || []) {
    const cycleId = cycleNameToId[wl.cycle_name];
    const dayId = dayKeyToId[`${wl.cycle_name}::${wl.cycle_day_index}`];
    if (!cycleId || !dayId) continue; // skip anything we can't resolve

    const wlRes = await run(
      "INSERT INTO workout_logs (cycle_id, cycle_day_id, date) VALUES (?, ?, ?)",
      [cycleId, dayId, wl.date]
    );
    const workoutLogId = wlRes.changes.lastId;

    for (const el of wl.exercise_logs || []) {
      const exerciseId = exerciseKeyToId[`${wl.cycle_name}::${wl.cycle_day_index}::${el.exercise_order_index}`];
      if (!exerciseId) continue;

      const elRes = await run(
        "INSERT INTO exercise_logs (workout_log_id, exercise_id, num_sets) VALUES (?, ?, ?)",
        [workoutLogId, exerciseId, el.num_sets]
      );
      const exerciseLogId = elRes.changes.lastId;

      for (const s of el.sets || []) {
        await run(
          `INSERT INTO set_logs (exercise_log_id, set_index, sub_index, weight, reps, rpe)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [exerciseLogId, s.set_index, s.sub_index, s.weight, s.reps, s.rpe]
        );
      }
    }
    importedWorkouts++;
  }

  return { importedCycles, importedWorkouts };
}

async function setActiveCycle(id) {
  await run("UPDATE cycles SET is_active = 0");
  await run("UPDATE cycles SET is_active = 1 WHERE id = ?", [id]);
  const row = (await all("SELECT * FROM cycles WHERE id = ?", [id]))[0];
  return hydrateCycle(row);
}

async function exportBackup() {
  const cycles = await all("SELECT * FROM cycles ORDER BY created_at ASC");
  const cyclesOut = [];

  for (const c of cycles) {
    const days = await all(
      "SELECT * FROM cycle_days WHERE cycle_id = ? ORDER BY day_index ASC",
      [c.id]
    );
    const daysOut = [];
    for (const d of days) {
      const exercises = await all(
        "SELECT * FROM exercises WHERE cycle_day_id = ? ORDER BY order_index ASC",
        [d.id]
      );
      daysOut.push({
        day_index: d.day_index,
        name: d.name,
        is_rest: !!d.is_rest,
        exercises: exercises.map((ex) => ({
          order_index: ex.order_index,
          type: ex.type,
          names: JSON.parse(ex.names),
        })),
      });
    }
    cyclesOut.push({
      name: c.name,
      num_days: c.num_days,
      is_active: !!c.is_active,
      created_at: c.created_at,
      days: daysOut,
    });
  }

  const workoutLogs = await all("SELECT * FROM workout_logs ORDER BY date ASC");
  const workoutLogsOut = [];

  for (const wl of workoutLogs) {
    const cycle = (await all("SELECT * FROM cycles WHERE id = ?", [wl.cycle_id]))[0];
    const cycleDay = (await all("SELECT * FROM cycle_days WHERE id = ?", [wl.cycle_day_id]))[0];
    const exerciseLogs = await all(
      "SELECT * FROM exercise_logs WHERE workout_log_id = ?",
      [wl.id]
    );
    const exerciseLogsOut = [];
    for (const el of exerciseLogs) {
      const exercise = (await all("SELECT * FROM exercises WHERE id = ?", [el.exercise_id]))[0];
      const sets = await all(
        "SELECT set_index, sub_index, weight, reps, rpe FROM set_logs WHERE exercise_log_id = ? ORDER BY set_index ASC, sub_index ASC",
        [el.id]
      );
      exerciseLogsOut.push({
        exercise_order_index: exercise ? exercise.order_index : null,
        num_sets: el.num_sets,
        sets,
      });
    }
    workoutLogsOut.push({
      cycle_name: cycle ? cycle.name : null,
      cycle_day_index: cycleDay ? cycleDay.day_index : null,
      date: wl.date,
      exercise_logs: exerciseLogsOut,
    });
  }

  return { cycles: cyclesOut, workout_logs: workoutLogsOut };
}

// ---------------------------------------------------------------------------
// Public API — same shape as the old fetch-based `api` object, so components
// barely change.
// ---------------------------------------------------------------------------
export const api = {
  createCycle,
  listCycles,
  activeCycle,
  setActiveCycle,
  logWorkout,
  listWorkouts,
  getWorkout,
  updateWorkout,
  deleteWorkout,
  dashboard,
  history,
  exerciseHistory,
  importBackup,
  exportBackup,
};
