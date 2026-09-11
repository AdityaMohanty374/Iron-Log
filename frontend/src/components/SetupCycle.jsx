import { useState, useEffect } from "react";
import { api } from "../db";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
import { Browser } from "@capacitor/browser";
import { Capacitor } from "@capacitor/core";

function emptyExercise() {
  return { type: "normal", names: [""], circuitCount: 2 };
}

function ExerciseRow({ exercise, onChange, onRemove, index }) {
  const [circuitCountText, setCircuitCountText] = useState(String(exercise.circuitCount));

  function setType(type) {
    let names = [""];
    if (type === "superset") names = ["", ""];
    if (type === "circuit") names = Array(exercise.circuitCount).fill("");
    onChange({ ...exercise, type, names });
  }

  // Commits a clamped circuit count + resizes the names array to match.
  function commitCircuitCount(n) {
    n = Math.max(2, Math.min(8, n));
    const names = Array(n).fill("").map((v, i) => exercise.names[i] || "");
    setCircuitCountText(String(n));
    onChange({ ...exercise, circuitCount: n, names });
  }

  // While typing, let the field hold whatever (including blank) so clearing
  // a digit doesn't get misread as a fallback value and clamped early.
  function onCircuitCountChange(raw) {
    setCircuitCountText(raw);
    const n = parseInt(raw, 10);
    if (!isNaN(n) && n >= 2 && n <= 8) {
      const names = Array(n).fill("").map((v, i) => exercise.names[i] || "");
      onChange({ ...exercise, circuitCount: n, names });
    }
  }

  function onCircuitCountBlur() {
    const n = parseInt(circuitCountText, 10);
    commitCircuitCount(isNaN(n) ? 2 : n);
  }

  function setName(i, val) {
    const names = [...exercise.names];
    names[i] = val;
    onChange({ ...exercise, names });
  }

  return (
    <div className="bg-panel2 border border-line rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs text-mute">Exercise {index + 1}</span>
        <button type="button" onClick={onRemove} className="text-xs text-red-400 hover:text-red-300">Remove</button>
      </div>

      <div className="flex gap-2">
        {["normal", "superset", "circuit"].map((t) => (
          <button
            key={t} type="button" onClick={() => setType(t)}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors capitalize ${
              exercise.type === t ? "bg-accent text-ink border-accent font-semibold" : "border-line text-mute hover:text-white"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {exercise.type === "circuit" && (
        <div className="flex items-center gap-2">
          <label className="text-xs text-mute">Number of exercises in circuit</label>
          <input
            type="number" min={2} max={8} value={circuitCountText}
            onChange={(e) => onCircuitCountChange(e.target.value)}
            onBlur={onCircuitCountBlur}
            className="w-16 bg-ink border border-line rounded-md px-2 py-1 text-sm outline-none focus:border-accent"
          />
        </div>
      )}

      <div className="grid gap-2 sm:grid-cols-2">
        {exercise.names.map((name, i) => (
          <input
            key={i} type="text" required value={name} onChange={(e) => setName(i, e.target.value)}
            list="known-exercise-names"
            placeholder={
              exercise.type === "normal" ? "Exercise name" :
              exercise.type === "superset" ? `Superset ${i + 1} name` :
              `Circuit ${i + 1} name`
            }
            className="bg-ink border border-line rounded-lg px-3 py-2 text-sm outline-none focus:border-accent"
          />
        ))}
      </div>
    </div>
  );
}

function CyclePicker({ onDone }) {
  const [cycles, setCycles] = useState(null); // null = loading
  const [switching, setSwitching] = useState(null); // id currently being activated

  useEffect(() => {
    api.listCycles().then(setCycles);
  }, []);

  async function activate(id) {
    setSwitching(id);
    try {
      await api.setActiveCycle(id);
      onDone();
    } finally {
      setSwitching(null);
    }
  }

  if (!cycles || cycles.length === 0) return null;

  return (
    <div className="border border-line rounded-2xl p-5 max-w-md mb-8">
      <h3 className="font-display font-semibold text-sm mb-1">Your cycles</h3>
      <p className="text-xs text-mute mb-3">Pick which cycle is active. Only one can be active at a time.</p>
      <div className="space-y-2">
        {cycles.map((c) => (
          <div key={c.id} className="flex items-center justify-between bg-panel2 border border-line rounded-lg px-3 py-2">
            <div>
              <div className="text-sm">{c.name}</div>
              <div className="text-[11px] text-mute">{c.num_days} days</div>
            </div>
            {c.is_active ? (
              <span className="text-[11px] text-accentSoft font-semibold px-2 py-1">Active</span>
            ) : (
              <button
                type="button"
                onClick={() => activate(c.id)}
                disabled={switching === c.id}
                className="text-[11px] bg-accent text-ink font-semibold rounded-md px-2.5 py-1 hover:bg-accentSoft transition-colors disabled:opacity-60"
              >
                {switching === c.id ? "Switching…" : "Make active"}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function RestToggle({ checked, onChange }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`flex items-center gap-2.5 rounded-full pl-1 pr-3 py-1 border transition-colors ${
        checked ? "bg-accent/15 border-accent/50" : "bg-panel2 border-line"
      }`}
    >
      <span
        className={`relative w-8 h-5 rounded-full transition-colors ${checked ? "bg-accent" : "bg-line"}`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-ink shadow transition-transform ${
            checked ? "translate-x-3" : "translate-x-0"
          }`}
        />
      </span>
      <span className={`text-xs font-medium ${checked ? "text-accentSoft" : "text-mute"}`}>Rest day</span>
    </button>
  );
}

function DayCard({ day, onChange, dayNumber }) {
  function setField(field, val) {
    onChange({ ...day, [field]: val });
  }

  function addExercise() {
    onChange({ ...day, exercises: [...day.exercises, emptyExercise()] });
  }

  function updateExercise(i, ex) {
    const exercises = [...day.exercises];
    exercises[i] = ex;
    onChange({ ...day, exercises });
  }

  function removeExercise(i) {
    onChange({ ...day, exercises: day.exercises.filter((_, idx) => idx !== i) });
  }

  return (
    <div className="bg-panel border border-line rounded-2xl p-5 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <span className="font-display text-sm text-accent font-semibold whitespace-nowrap">Day {dayNumber}</span>
        <RestToggle checked={day.is_rest} onChange={(v) => setField("is_rest", v)} />
      </div>
      <input
        type="text" required value={day.name} onChange={(e) => setField("name", e.target.value)}
        placeholder="e.g. Push Day"
        className="w-full bg-panel2 border border-line rounded-lg px-3 py-2 text-sm outline-none focus:border-accent"
      />

      {!day.is_rest && (
        <div className="space-y-3">
          {day.exercises.map((ex, i) => (
            <ExerciseRow
              key={i} exercise={ex} index={i}
              onChange={(updated) => updateExercise(i, updated)}
              onRemove={() => removeExercise(i)}
            />
          ))}
          <button
            type="button" onClick={addExercise}
            className="text-xs text-accent hover:text-accentSoft border border-dashed border-line rounded-lg px-3 py-2 w-full transition-colors"
          >
            + Add exercise
          </button>
        </div>
      )}
    </div>
  );
}

function ExportBackup() {
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleExport() {
    setBusy(true);
    setStatus("");
    try {
      const backup = await api.exportBackup();
      const json = JSON.stringify(backup, null, 2);
      const fileName = `iron-log-backup-${new Date().toISOString().slice(0, 10)}.json`;

      if (Capacitor.getPlatform() === "web") {
        // Browser dev fallback: plain download link
        const blob = new Blob([json], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = fileName;
        a.click();
        URL.revokeObjectURL(url);
        setStatus(`Downloaded ${fileName}`);
      } else {
        const written = await Filesystem.writeFile({
          path: fileName,
          data: json,
          directory: Directory.Cache,
          encoding: "utf8",
        });
        await Share.share({
          title: "Iron Log backup",
          text: "Iron Log data backup",
          url: written.uri,
          dialogTitle: "Save or share your backup",
        });
        setStatus(`Ready: ${fileName} — choose where to save it.`);
      }
    } catch (err) {
      setStatus(`Export failed: ${err.message || "unknown error"}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="border border-line rounded-2xl p-5 max-w-md mb-8">
      <h3 className="font-display font-semibold text-sm mb-1">Export backup</h3>
      <p className="text-xs text-mute mb-3">
        Save all your cycles and workout history to a JSON file — for safekeeping, or to move to another phone.
      </p>
      <button
        type="button"
        onClick={handleExport}
        disabled={busy}
        className="text-xs bg-panel2 border border-line rounded-lg px-3 py-2 hover:border-accent transition-colors disabled:opacity-60"
      >
        {busy ? "Preparing…" : "Export backup"}
      </button>
      {status && <p className="text-xs text-accentSoft mt-2">{status}</p>}
    </div>
  );
}

function unwrapNeonExport(parsed) {
  // Neon's "download as JSON" wraps a single-row query result as
  // [{ backup: "...stringified JSON..." }] instead of the plain object.
  // Unwrap all the layers so we end up with { cycles: [...], workout_logs: [...] }.
  let value = parsed;
  if (Array.isArray(value)) value = value[0];
  if (value && typeof value === "object" && typeof value.backup === "string") {
    value = JSON.parse(value.backup);
  } else if (value && typeof value === "object" && typeof value.backup === "object") {
    value = value.backup;
  }
  return value;
}

function ImportBackup({ onDone }) {
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [succeeded, setSucceeded] = useState(false);

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setStatus("");
    setSucceeded(false);
    try {
      const text = await file.text();
      const parsed = unwrapNeonExport(JSON.parse(text));
      if (!parsed || !Array.isArray(parsed.cycles)) {
        throw new Error("Unrecognized file format — expected { cycles: [...], workout_logs: [...] }");
      }
      const result = await api.importBackup(parsed);
      setStatus(`Imported ${result.importedCycles} cycle(s) and ${result.importedWorkouts} workout(s).`);
      setSucceeded(true);
      // Don't navigate away immediately — let the person see the result
      // and confirm, since a silent tab-switch made this look broken before.
    } catch (err) {
      setStatus(`Import failed: ${err.message || "invalid file"}`);
    } finally {
      setBusy(false);
      e.target.value = "";
    }
  }

  return (
    <div className="border border-dashed border-line rounded-2xl p-5 max-w-md mb-8">
      <h3 className="font-display font-semibold text-sm mb-1">Import old data</h3>
      <p className="text-xs text-mute mb-3">
        One-time import of a backup exported from the old Neon database (JSON file).
      </p>
      <label className="inline-block text-xs bg-panel2 border border-line rounded-lg px-3 py-2 cursor-pointer hover:border-accent transition-colors">
        {busy ? "Importing…" : "Choose backup .json file"}
        <input type="file" accept="application/json" className="hidden" onChange={handleFile} disabled={busy} />
      </label>
      {status && <p className="text-xs text-accentSoft mt-2">{status}</p>}
      {succeeded && (
        <button
          type="button"
          onClick={onDone}
          className="mt-3 text-xs bg-accent text-ink font-semibold rounded-lg px-3 py-1.5 hover:bg-accentSoft transition-colors"
        >
          Done — go to dashboard
        </button>
      )}
    </div>
  );
}

function AuthorFooter() {
  async function openGithub() {
    const url = "https://github.com/AdityaMohanty374";
    if (Capacitor.getPlatform() === "web") {
      window.open(url, "_blank");
    } else {
      await Browser.open({ url });
    }
  }

  return (
    <div className="max-w-md mt-2 mb-8 pt-4 border-t border-line/60 flex items-center justify-between">
      <span className="text-xs text-mute">Built by Aditya Mohanty</span>
      <button
        type="button"
        onClick={openGithub}
        className="flex items-center gap-1.5 text-xs text-mute hover:text-accentSoft transition-colors"
      >
        <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="currentColor">
          <path d="M12 .5C5.73.5.98 5.24.98 11.52c0 5.02 3.26 9.28 7.78 10.78.57.1.78-.25.78-.55 0-.27-.01-1.16-.02-2.1-3.16.69-3.83-1.34-3.83-1.34-.52-1.31-1.26-1.66-1.26-1.66-1.03-.7.08-.69.08-.69 1.14.08 1.74 1.17 1.74 1.17 1.01 1.73 2.66 1.23 3.31.94.1-.73.4-1.23.72-1.51-2.52-.29-5.17-1.26-5.17-5.6 0-1.24.44-2.25 1.17-3.04-.12-.29-.51-1.45.11-3.02 0 0 .96-.31 3.14 1.16.91-.25 1.89-.38 2.86-.38.97 0 1.95.13 2.86.38 2.18-1.47 3.14-1.16 3.14-1.16.62 1.57.23 2.73.11 3.02.73.79 1.17 1.8 1.17 3.04 0 4.35-2.65 5.31-5.18 5.59.41.35.77 1.04.77 2.1 0 1.52-.01 2.75-.01 3.12 0 .3.2.66.79.55A11.03 11.03 0 0 0 23.02 11.52C23.02 5.24 18.27.5 12 .5Z" />
        </svg>
        GitHub
      </button>
    </div>
  );
}

export default function SetupCycle({ onDone }) {
  const [step, setStep] = useState(1);
  const [cycleName, setCycleName] = useState("");
  const [numDays, setNumDays] = useState(5);
  const [numDaysText, setNumDaysText] = useState("5");
  const [days, setDays] = useState([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [knownNames, setKnownNames] = useState([]);

  useEffect(() => {
    api.listKnownExerciseNames().then(setKnownNames);
  }, []);

  function startBuilding() {
    setDays(Array.from({ length: numDays }, (_, i) => ({
      name: "", is_rest: false, exercises: [emptyExercise()],
    })));
    setStep(2);
  }

  function updateDay(i, updated) {
    const next = [...days];
    next[i] = updated;
    setDays(next);
  }

  async function save() {
    setError("");
    for (const d of days) {
      if (!d.name.trim()) { setError("Every day needs a name."); return; }
      if (!d.is_rest) {
        for (const ex of d.exercises) {
          if (ex.names.some((n) => !n.trim())) { setError("Every exercise needs a name."); return; }
        }
      }
    }
    setSaving(true);
    try {
      await api.createCycle({
        name: cycleName || "My Cycle",
        num_days: numDays,
        days: days.map((d) => ({
          name: d.name,
          is_rest: d.is_rest,
          exercises: d.is_rest ? [] : d.exercises.map((ex) => ({ type: ex.type, names: ex.names })),
        })),
      });
      onDone();
    } catch (err) {
      setError(err.message || "Failed to save cycle");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <h1 className="font-display text-2xl font-semibold mb-1">Set up your workout cycle</h1>
      <p className="text-mute text-sm mb-8">Define how many days are in your training cycle, then fill in each day's exercises.</p>

      {step === 1 && <CyclePicker onDone={onDone} />}
      {step === 1 && <ExportBackup />}
      {step === 1 && <ImportBackup onDone={onDone} />}

      {step === 1 && (
        <div className="bg-panel border border-line rounded-2xl p-6 space-y-5 max-w-md">
          <div>
            <label className="text-xs text-mute block mb-1.5">Cycle name</label>
            <input
              type="text" value={cycleName} onChange={(e) => setCycleName(e.target.value)}
              placeholder="e.g. Push Pull Legs"
              className="w-full bg-panel2 border border-line rounded-lg px-3 py-2.5 text-sm outline-none focus:border-accent"
            />
          </div>
          <div>
            <label className="text-xs text-mute block mb-1.5">Number of days in the cycle (include rest days)</label>
            <input
              type="number" min={1} max={14} value={numDaysText}
              onChange={(e) => {
                const raw = e.target.value;
                setNumDaysText(raw);
                const n = parseInt(raw, 10);
                if (!isNaN(n) && n >= 1 && n <= 14) setNumDays(n);
              }}
              onBlur={() => {
                const n = parseInt(numDaysText, 10);
                const clamped = Math.max(1, Math.min(14, isNaN(n) ? 1 : n));
                setNumDays(clamped);
                setNumDaysText(String(clamped));
              }}
              className="w-full bg-panel2 border border-line rounded-lg px-3 py-2.5 text-sm outline-none focus:border-accent"
            />
          </div>
          <button
            onClick={startBuilding}
            className="w-full bg-accent text-ink font-semibold rounded-lg py-2.5 text-sm hover:bg-accentSoft transition-colors"
          >
            Continue → build days
          </button>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-5">
          {days.map((d, i) => (
            <DayCard key={i} day={d} dayNumber={i + 1} onChange={(updated) => updateDay(i, updated)} />
          ))}

          {error && <p className="text-sm text-red-400">{error}</p>}

          <div className="flex gap-3">
            <button onClick={() => setStep(1)} className="text-sm text-mute hover:text-white border border-line rounded-lg px-4 py-2.5">
              Back
            </button>
            <button
              onClick={save} disabled={saving}
              className="flex-1 bg-accent text-ink font-semibold rounded-lg py-2.5 text-sm hover:bg-accentSoft transition-colors disabled:opacity-60"
            >
              {saving ? "Saving…" : "Save cycle & start tracking"}
            </button>
          </div>
        </div>
      )}
      <datalist id="known-exercise-names">
        {knownNames.map((n) => (
          <option key={n} value={n} />
        ))}
      </datalist>
      <AuthorFooter />
    </div>
  );
}
