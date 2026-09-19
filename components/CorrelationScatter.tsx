"use client";

import {
  CartesianGrid,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";

export function CorrelationScatter({
  points,
  xLabel,
  yLabel,
}: {
  points: { x: number; y: number; player: string; date: string }[];
  xLabel: string;
  yLabel: string;
}) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <ScatterChart margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
        <CartesianGrid stroke="var(--gridline)" />
        <XAxis
          type="number"
          dataKey="x"
          name={xLabel}
          tick={{ fill: "var(--text-muted)", fontSize: 12 }}
          axisLine={{ stroke: "var(--axis)" }}
          tickLine={false}
          label={{
            value: xLabel,
            position: "insideBottom",
            offset: -4,
            fill: "var(--text-secondary)",
            fontSize: 12,
          }}
        />
        <YAxis
          type="number"
          dataKey="y"
          name={yLabel}
          tick={{ fill: "var(--text-muted)", fontSize: 12 }}
          axisLine={{ stroke: "var(--axis)" }}
          tickLine={false}
          width={48}
          label={{
            value: yLabel,
            angle: -90,
            position: "insideLeft",
            fill: "var(--text-secondary)",
            fontSize: 12,
          }}
        />
        <ZAxis range={[60, 60]} />
        <Tooltip
          cursor={{ stroke: "var(--axis)", strokeDasharray: "3 3" }}
          contentStyle={{
            background: "var(--surface-1)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            fontSize: 12,
            color: "var(--text-primary)",
          }}
          labelStyle={{ color: "var(--text-secondary)" }}
          labelFormatter={() => ""}
        />
        <Scatter data={points} fill="var(--series-1)" isAnimationActive={false} />
      </ScatterChart>
    </ResponsiveContainer>
  );
}
