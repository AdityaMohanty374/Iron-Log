export default function WeekStreak({ dashboard }) {
  if (!dashboard) return null;
  const { streak, week } = dashboard;

  return (
    <div className="bg-panel border border-line rounded-2xl p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="font-display text-sm font-semibold text-mute uppercase tracking-wide">This week</h2>
        <div className="flex items-center gap-2">
          <span className="num-display text-3xl font-bold text-accent leading-none">{streak}</span>
          <span className="text-xs text-mute leading-tight">day<br/>streak</span>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-2">
        {week.map((day) => (
          <div key={day.date} className="flex flex-col items-center gap-2">
            <span className="text-[11px] text-mute">{day.label}</span>
            <div
              className="w-full aspect-square rounded-lg flex items-center justify-center border transition-colors"
              style={{
                backgroundColor: day.color,
                borderColor: day.is_today ? "#10B981" : "transparent",
                borderWidth: day.is_today ? "2px" : "1px",
              }}
              title={day.is_rest ? "Rest day" : day.completed ? "Completed" : "Missed"}
            >
              {day.is_rest && (
                <span className="text-[10px] text-ink/70 font-semibold">R</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
