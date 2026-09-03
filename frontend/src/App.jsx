import { useEffect, useState, useCallback } from "react";
import { api } from "./db";
import SetupCycle from "./components/SetupCycle";
import WeekStreak from "./components/WeekStreak";
import LogWorkout from "./components/LogWorkout";
import History from "./components/History";
import { HomeIcon, LogIcon, HistoryIcon, CycleIcon } from "./icons";

const TABS = [
  { key: "dashboard", label: "Dashboard", Icon: HomeIcon },
  { key: "log", label: "Log", Icon: LogIcon },
  { key: "history", label: "History", Icon: HistoryIcon },
  { key: "setup", label: "Cycle", Icon: CycleIcon },
];

export default function App() {
  const [tab, setTab] = useState("dashboard");
  const [dashboard, setDashboard] = useState(null);
  const [cycle, setCycle] = useState(undefined); // undefined = loading, null = none
  const [editingLog, setEditingLog] = useState(null);

  const refresh = useCallback(async () => {
    const [dash, active] = await Promise.all([api.dashboard(), api.activeCycle()]);
    setDashboard(dash);
    setCycle(active);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const mustSetup = cycle === null && tab !== "setup";

  function goTo(key) {
    if (key === "log") setEditingLog(null);
    setTab(key);
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-line/60">
        <div className="max-w-lg mx-auto px-5 py-4">
          <span className="font-display text-sm tracking-wide text-mute">Iron Log</span>
        </div>
      </header>

      <main className="flex-1 max-w-lg w-full mx-auto px-5 py-6 pb-28">
        {cycle === undefined ? (
          <p className="text-mute text-sm">Loading…</p>
        ) : mustSetup ? (
          <div className="text-center py-14">
            <p className="font-display text-lg mb-2">Welcome to Iron Log</p>
            <p className="text-mute text-sm mb-6">Set up a workout cycle before you start tracking.</p>
            <button
              onClick={() => goTo("setup")}
              className="bg-accent text-ink font-semibold rounded-lg px-6 py-2.5 text-sm hover:bg-accentSoft transition-colors"
            >
              Set up your cycle
            </button>
          </div>
        ) : (
          <>
            {tab === "dashboard" && (
              <div className="space-y-5">
                <WeekStreak dashboard={dashboard} />
                <div className="grid grid-cols-1 gap-3">
                  <button
                    onClick={() => goTo("log")}
                    className="bg-panel border border-line/70 rounded-xl p-5 text-left active:border-accent/50 transition-colors"
                  >
                    <h3 className="font-display font-medium text-sm mb-1">Log a workout</h3>
                    <p className="text-xs text-mute">Record today's sets, weights and reps.</p>
                  </button>
                  <button
                    onClick={() => goTo("history")}
                    className="bg-panel border border-line/70 rounded-xl p-5 text-left active:border-accent/50 transition-colors"
                  >
                    <h3 className="font-display font-medium text-sm mb-1">View history</h3>
                    <p className="text-xs text-mute">Browse past workouts and progress.</p>
                  </button>
                </div>
                {cycle && (
                  <div className="border-t border-line/60 pt-5">
                    <h2 className="text-xs font-medium text-mute mb-3">{cycle.name}</h2>
                    <div className="flex flex-wrap gap-1.5">
                      {cycle.days.map((d) => (
                        <span key={d.id} className={`text-xs px-2.5 py-1 rounded-full border ${d.is_rest ? "border-line/70 text-mute" : "border-line/70 text-mute"}`}>
                          {d.name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {tab === "log" && (
              <LogWorkout
                cycle={cycle}
                editingLog={editingLog}
                onCancelEdit={() => setEditingLog(null)}
                onLogged={() => { setEditingLog(null); refresh(); }}
              />
            )}
            {tab === "history" && (
              <History onEditWorkout={(log) => { setEditingLog(log); setTab("log"); }} />
            )}
            {tab === "setup" && (
              <SetupCycle onDone={() => { refresh(); setTab("dashboard"); }} />
            )}
          </>
        )}
      </main>

      <nav className="fixed bottom-0 inset-x-0 border-t border-line/60 bg-ink/95 backdrop-blur-sm">
        <div className="max-w-lg mx-auto grid grid-cols-4">
          {TABS.map(({ key, label, Icon }) => {
            const isActive = tab === key;
            return (
              <button
                key={key}
                onClick={() => goTo(key)}
                className="flex flex-col items-center justify-center gap-1 py-3"
                aria-label={label}
                aria-current={isActive ? "page" : undefined}
              >
                <Icon active={isActive} className={`w-6 h-6 ${isActive ? "text-accent" : "text-mute"}`} />
                {isActive && (
                  <span className="text-[10px] leading-none text-accent">{label}</span>
                )}
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
