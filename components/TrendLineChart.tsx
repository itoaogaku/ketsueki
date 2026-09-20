"use client";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export interface SeriesSpec {
  key: string;
  label: string;
  color: string;
}

export interface ReferenceLineSpec {
  value: number;
  label: string;
  color?: string;
}

/** Recharts' default Y domain tends to include 0, which flattens series that
 * only vary within a narrow band (e.g. Hb staying between 13-16) and hides
 * real differences between lines. Fit the domain tightly around the actual
 * plotted values instead, with a small margin so points near the top/bottom
 * aren't clipped against the axis. Reference lines (e.g. a normal-range
 * boundary) count as plotted values too, so the line is never clipped off
 * the edge of the chart. */
function fitDomain(
  data: Record<string, unknown>[],
  series: SeriesSpec[],
  referenceLines: ReferenceLineSpec[] = []
): [number, number] {
  const values = [
    ...data.flatMap((row) =>
      series.map((s) => row[s.key]).filter((v): v is number => typeof v === "number")
    ),
    ...referenceLines.map((r) => r.value),
  ];
  if (values.length === 0) return [0, 1];
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (min === max) return [min - 1, max + 1];
  const margin = (max - min) * 0.1;
  // Round to avoid float artifacts (e.g. 13 - 26.4 = -13.399999999999999)
  // showing up verbatim as an axis tick label.
  const round = (n: number) => Math.round(n * 1000) / 1000;
  return [round(min - margin), round(max + margin)];
}

export function TrendLineChart({
  data,
  series,
  unit,
  referenceLines,
}: {
  data: Record<string, unknown>[];
  series: SeriesSpec[];
  unit?: string;
  referenceLines?: ReferenceLineSpec[];
}) {
  const domain = fitDomain(data, series, referenceLines);
  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid stroke="var(--gridline)" vertical={false} />
        <XAxis
          dataKey="period"
          tick={{ fill: "var(--text-muted)", fontSize: 12 }}
          axisLine={{ stroke: "var(--axis)" }}
          tickLine={false}
        />
        <YAxis
          domain={domain}
          tick={{ fill: "var(--text-muted)", fontSize: 12 }}
          axisLine={{ stroke: "var(--axis)" }}
          tickLine={false}
          width={48}
          unit={unit ? ` ${unit}` : undefined}
        />
        <Tooltip
          contentStyle={{
            background: "var(--surface-1)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            fontSize: 12,
            color: "var(--text-primary)",
          }}
          labelStyle={{ color: "var(--text-secondary)" }}
        />
        {series.length > 1 && (
          <Legend wrapperStyle={{ fontSize: 12, color: "var(--text-secondary)" }} />
        )}
        {referenceLines?.map((rl) => (
          <ReferenceLine
            key={rl.label}
            y={rl.value}
            stroke={rl.color ?? "var(--text-muted)"}
            strokeDasharray="4 4"
            strokeWidth={1.5}
            label={{
              value: rl.label,
              position: "insideBottomRight",
              fill: rl.color ?? "var(--text-muted)",
              fontSize: 11,
            }}
          />
        ))}
        {series.map((s) => (
          <Line
            key={s.key}
            type="monotone"
            dataKey={s.key}
            name={s.label}
            stroke={s.color}
            strokeWidth={2}
            dot={{ r: 3, fill: s.color, strokeWidth: 0 }}
            activeDot={{ r: 5 }}
            connectNulls
            isAnimationActive={false}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
