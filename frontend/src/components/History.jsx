import { useEffect, useState } from "react";
import { api } from "../db";
import ExerciseChart from "./ExerciseChart";

export default function History({ onEditWorkout }) {
  const [data, setData] = useState(null);
  const [selectedExercise, setSelectedExercise] = useState(null); // {id, name}
  const [deletingId, setDeletingId] = useState(null);

  function load() {
    api.history().then(setData);
  }

  useEffect(() => { load(); }, []);

  async function handleDelete(logId) {
    if (!confirm("Delete this logged workout? This can't be undone.")) return;
    setDeletingId(logId);
    try {
      await api.deleteWorkout(logId);
      load();
    } finally {
      setDeletingId(null);
    }
  }

  if (!data) return <p className="text-mute text-sm">Loading…</p>;

  if (data.no_data || data.cycles.length === 0) {
    return (
      <div className="text-center py-20 border border-dashed border-line rounded-2xl">
        <p className="font-display text-lg text-mute">No Data Found</p>
        <p className="text-sm text-mute mt-1">Set up a cycle and log a workout to see history here.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {selectedExercise && (
        <div>
          <button onClick={() => setSelectedExercise(null)} className="text-xs text-mute hover:text-white mb-3">← Back to history</button>
          <ExerciseChart exerciseId={selectedExercise.id} exerciseName={selectedExercise.name} />
        </div>
      )}

      {!selectedExercise && data.cycles.map((cycle) => (
        <div key={cycle.cycle_id}>
          <div className="flex items-center gap-2 mb-3">
            <h2 className="font-display font-semibold">{cycle.cycle_name}</h2>
            {cycle.is_active && <span className="text-[10px] bg-accent/20 text-accent px-2 py-0.5 rounded-full">Active</span>}
          </div>

          {cycle.logs.length === 0 ? (
            <p className="text-sm text-mute">No workouts logged in this cycle yet.</p>
          ) : (
            <div className="space-y-3">
              {cycle.logs.map((log) => (
                <div key={log.id} className="bg-panel border border-line rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <span className="font-semibold text-sm">{log.day_name}</span>
                      <span className="text-xs text-mute">{log.date}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => onEditWorkout({
                          id: log.id,
                          cycle_day_id: log.cycle_day_id,
                          date: log.date,
                          exercise_logs: log.exercise_logs,
                        })}
                        className="text-xs text-accentSoft hover:text-accent"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(log.id)}
                        disabled={deletingId === log.id}
                        className="text-xs text-red-400 hover:text-red-300 disabled:opacity-50"
                      >
                        {deletingId === log.id ? "Deleting…" : "Delete"}
                      </button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {log.exercise_logs.map((el, i) => (
                      <button
                        key={i}
                        onClick={() => setSelectedExercise({ id: el.exercise_id, name: el.exercise_name })}
                        className="w-full text-left bg-panel2 hover:bg-line rounded-lg px-3 py-2 text-xs text-mute transition-colors flex items-center justify-between"
                      >
                        <span>{el.exercise_name} · {el.num_sets} sets</span>
                        <span className="text-accentSoft">View chart →</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
