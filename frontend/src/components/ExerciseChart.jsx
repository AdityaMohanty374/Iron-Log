import { useEffect, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid, LabelList } from "recharts";
import { api } from "../db";

function fmtDate(iso) {
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = String(d.getFullYear()).slice(-2);
  return `${dd}/${mm}/${yy}`;
}

function WeightLabel(props) {
  const { x, y, width, value } = props;
  if (value == null) return null;
  return (
    <text x={x + width / 2} y={y - 8} textAnchor="middle" fill="#E5E7EB" fontSize="11" fontWeight="700">
      {value}kg
    </text>
  );
}

export default function ExerciseChart({ exerciseId, exerciseName }) {
  const [points, setPoints] = useState(null);

  useEffect(() => {
    let alive = true;
    api.exerciseHistory(exerciseId).then((res) => {
      if (!alive) return;
      const merged = {};
      res.points.forEach((p) => {
        const key = fmtDate(p.date);
        // Keep only the heaviest-weight set logged for this exercise on this date
        if (!merged[key] || p.weight > merged[key].weight) {
          merged[key] = { date: key, reps: p.reps, weight: p.weight };
        }
      });
      setPoints(Object.values(merged));
    });
    return () => { alive = false; };
  }, [exerciseId]);

  if (!points) return <p className="text-mute text-sm">Loading…</p>;
  if (points.length === 0) return <p className="text-mute text-sm">No Data Found</p>;

  const maxReps = Math.max(...points.map((p) => p.reps || 0));
  const yMax = Math.max(4, maxReps + 2); // a little headroom above the tallest bar

  return (
    <div className="bg-panel border border-line rounded-2xl p-5">
      <h3 className="font-display font-semibold mb-4">{exerciseName}</h3>
      <p className="text-xs text-mute mb-2">Bar height = reps (heaviest set of the day) · label = weight</p>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={points} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#2C313C" vertical={false} />
          <XAxis dataKey="date" stroke="#8A93A3" fontSize={11} />
          <YAxis domain={[0, yMax]} stroke="#8A93A3" fontSize={11} allowDecimals={false} />
          <Tooltip
            cursor={{ fill: "rgba(255,255,255,0.04)" }}
            contentStyle={{ background: "#1B1F27", border: "1px solid #2C313C", borderRadius: 8 }}
            labelStyle={{ color: "#fff" }}
            formatter={(value, name) => [name === "reps" ? `${value} reps` : value, name === "reps" ? "Reps" : name]}
          />
          <Bar dataKey="reps" radius={[6, 6, 0, 0]} fill="#10B981" minPointSize={2}>
            <LabelList dataKey="weight" content={WeightLabel} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
