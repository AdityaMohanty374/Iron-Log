import { useState, useEffect } from "react";
import { api } from "../db";

function todayStr() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

function SetGrid({ exercise, numSets, sets, onSetChange }) {
  const subCount = exercise.names.length;
  const rows = Array.from({ length: numSets }, (_, i) => i);

  return (
    <div className="space-y-2">
      {rows.map((setIdx) => (
        <div key={setIdx} className="bg-ink border border-line rounded-lg p-3">
          <div className="text-xs text-mute mb-2">Set {setIdx + 1}</div>
          <div className={`grid gap-3 ${subCount > 1 ? "grid-cols-1" : ""}`}>
            {exercise.names.map((name, subIdx) => {
              const val = sets[setIdx]?.[subIdx] || {};
              return (
                <div key={subIdx} className={subCount > 1 ? "bg-panel2 rounded-md p-2 border border-line" : ""}>
                  {subCount > 1 && <div className="text-[11px] text-accentSoft mb-1.5">{name}</div>}
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-[10px] text-mute block mb-1">Weight</label>
                      <input
                        type="number" step="0.5" value={val.weight ?? ""}
                        onChange={(e) => onSetChange(setIdx, subIdx, "weight", e.target.value)}
                        className="w-full bg-panel border border-line rounded-md px-2 py-1.5 text-sm outline-none focus:border-accent"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-mute block mb-1">Reps</label>
                      <input
                        type="number" value={val.reps ?? ""}
                        onChange={(e) => onSetChange(setIdx, subIdx, "reps", e.target.value)}
                        className="w-full bg-panel border border-line rounded-md px-2 py-1.5 text-sm outline-none focus:border-accent"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-mute block mb-1">RPE</label>
                      <input
                        type="number" step="0.5" min="0" max="10" value={val.rpe ?? ""}
                        onChange={(e) => onSetChange(setIdx, subIdx, "rpe", e.target.value)}
                        className="w-full bg-panel border border-line rounded-md px-2 py-1.5 text-sm outline-none focus:border-accent"
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function ExerciseLogger({ exercise, data, onUpdate }) {
  const numSets = data.numSets;
  const [numSetsText, setNumSetsText] = useState(String(numSets));

  function commitNumSets(n) {
    n = Math.max(1, Math.min(15, n));
    setNumSetsText(String(n));
    onUpdate({ ...data, numSets: n });
  }

  function onNumSetsChange(raw) {
    setNumSetsText(raw);
    const n = parseInt(raw, 10);
    if (!isNaN(n) && n >= 1 && n <= 15) onUpdate({ ...data, numSets: n });
  }

  function onNumSetsBlur() {
    const n = parseInt(numSetsText, 10);
    commitNumSets(isNaN(n) ? 1 : n);
  }

  function onSetChange(setIdx, subIdx, field, value) {
    const sets = { ...data.sets };
    if (!sets[setIdx]) sets[setIdx] = {};
    sets[setIdx] = { ...sets[setIdx], [subIdx]: { ...sets[setIdx][subIdx], [field]: value } };
    onUpdate({ ...data, sets });
  }

  return (
    <div className="bg-panel border border-line rounded-2xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <span className="text-[10px] uppercase tracking-wide text-mute">{exercise.type}</span>
          <h3 className="font-display font-semibold">{exercise.names.join(" + ")}</h3>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-mute">Sets</label>
          <input
            type="number" min={1} max={15} value={numSetsText}
            onChange={(e) => onNumSetsChange(e.target.value)}
            onBlur={onNumSetsBlur}
            className="w-16 bg-panel2 border border-line rounded-md px-2 py-1 text-sm outline-none focus:border-accent"
          />
        </div>
      </div>
      <SetGrid exercise={exercise} numSets={numSets} sets={data.sets} onSetChange={onSetChange} />
    </div>
  );
}

// Build the exerciseData state from a previously-logged workout (for edit mode)
function buildInitFromLog(selectedDay, workoutLog) {
  const init = {};
  selectedDay.exercises.forEach((ex) => {
    const existing = workoutLog?.exercise_logs?.find((el) => el.exercise_id === ex.id);
    if (existing) {
      const sets = {};
      existing.sets.forEach((s) => {
        if (!sets[s.set_index]) sets[s.set_index] = {};
        sets[s.set_index][s.sub_index] = {
          weight: s.weight ?? "", reps: s.reps ?? "", rpe: s.rpe ?? "",
        };
      });
      init[ex.id] = { numSets: existing.num_sets, sets };
    } else {
      init[ex.id] = { numSets: 3, sets: {} };
    }
  });
  return init;
}

export default function LogWorkout({ cycle, onLogged, editingLog, onCancelEdit }) {
  const isEditing = !!editingLog;
  const trainingDays = (cycle?.days || []).filter((d) => !d.is_rest);

  const [selectedDayId, setSelectedDayId] = useState(editingLog?.cycle_day_id || null);
  const [logDate, setLogDate] = useState(editingLog?.date || todayStr());
  const [exerciseData, setExerciseData] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const selectedDay = trainingDays.find((d) => d.id === selectedDayId);

  useEffect(() => {
    if (selectedDay) {
      setExerciseData(buildInitFromLog(selectedDay, isEditing ? editingLog : null));
      setSuccess(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDayId]);

  async function submit() {
    setError("");
    setSaving(true);
    try {
      const exercise_logs = selectedDay.exercises.map((ex) => {
        const data = exerciseData[ex.id];
        const sets = [];
        for (let s = 0; s < data.numSets; s++) {
          ex.names.forEach((_, subIdx) => {
            const v = data.sets[s]?.[subIdx] || {};
            sets.push({
              set_index: s,
              sub_index: subIdx,
              weight: v.weight !== "" && v.weight != null ? parseFloat(v.weight) : null,
              reps: v.reps !== "" && v.reps != null ? parseInt(v.reps) : null,
              rpe: v.rpe !== "" && v.rpe != null ? parseFloat(v.rpe) : null,
            });
          });
        }
        return { exercise_id: ex.id, num_sets: data.numSets, sets };
      });

      const payload = { cycle_day_id: selectedDay.id, date: logDate, exercise_logs };

      if (isEditing) {
        await api.updateWorkout(editingLog.id, payload);
      } else {
        await api.logWorkout(payload);
      }
      setSuccess(true);
      onLogged();
    } catch (err) {
      setError(err.message || "Failed to save workout");
    } finally {
      setSaving(false);
    }
  }

  if (!cycle) {
    return <p className="text-mute text-sm">Set up a workout cycle first to start logging.</p>;
  }

  return (
    <div className="space-y-6">
      {isEditing && (
        <div className="flex items-center justify-between bg-panel2 border border-line rounded-xl px-4 py-3">
          <span className="text-sm text-accentSoft">Editing workout from {editingLog.date}</span>
          <button onClick={onCancelEdit} className="text-xs text-mute hover:text-white">Cancel edit</button>
        </div>
      )}

      <div className="flex flex-wrap items-end gap-6">
        <div>
          <h2 className="font-display text-sm font-semibold text-mute uppercase tracking-wide mb-3">
            {isEditing ? "Day" : "Choose the day"}
          </h2>
          <div className="flex flex-wrap gap-2">
            {trainingDays.map((d) => (
              <button
                key={d.id} onClick={() => setSelectedDayId(d.id)}
                className={`px-4 py-2 rounded-full text-sm border transition-colors ${
                  selectedDayId === d.id ? "bg-accent text-ink border-accent font-semibold" : "border-line text-mute hover:text-white"
                }`}
              >
                {d.name}
              </button>
            ))}
          </div>
        </div>

        <div>
          <h2 className="font-display text-sm font-semibold text-mute uppercase tracking-wide mb-3">Date</h2>
          <input
            type="date" value={logDate} max={todayStr()}
            onChange={(e) => setLogDate(e.target.value)}
            className="bg-panel2 border border-line rounded-lg px-3 py-2 text-sm outline-none focus:border-accent"
          />
        </div>
      </div>

      {selectedDay && (
        <div className="space-y-4">
          {selectedDay.exercises.map((ex) => (
            <ExerciseLogger
              key={ex.id} exercise={ex} data={exerciseData[ex.id] || { numSets: 3, sets: {} }}
              onUpdate={(d) => setExerciseData({ ...exerciseData, [ex.id]: d })}
            />
          ))}

          {error && <p className="text-sm text-red-400">{error}</p>}
          {success && <p className="text-sm text-accent">Workout {isEditing ? "updated" : "logged"} ✓</p>}

          <button
            onClick={submit} disabled={saving}
            className="w-full bg-accent text-ink font-semibold rounded-lg py-3 text-sm hover:bg-accentSoft transition-colors disabled:opacity-60"
          >
            {saving ? "Saving…" : isEditing ? "Save changes" : "Save workout"}
          </button>
        </div>
      )}
    </div>
  );
}
