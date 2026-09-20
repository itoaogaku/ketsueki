"use client";

import { useMemo, useState } from "react";
import { orderParametersByCategory } from "@/lib/parameter-categories";
import { compareByGradeThenRosterName } from "@/lib/player-roster";
import { REFERENCE_RANGES } from "@/lib/reference-ranges";
import { GRADE_OPTIONS } from "@/lib/types";
import type { BloodDataResponse, Grade } from "@/lib/types";
import { TrendLineChart, type ReferenceLineSpec, type SeriesSpec } from "./TrendLineChart";

const BASE_SERIES_COLORS = ["var(--series-1)", "var(--series-2)", "var(--series-3)", "var(--series-4)"];

/** A distinct-ish color per selected player - cycles through the app's
 * fixed palette first, then spreads further hues for a bigger comparison
 * (e.g. a whole grade). */
function colorForIndex(i: number): string {
  if (i < BASE_SERIES_COLORS.length) return BASE_SERIES_COLORS[i];
  return `hsl(${(i * 47) % 360}, 60%, 45%)`;
}

/** One or more players' values for one parameter over time, as an
 * overlaid line chart with the parameter's normal-range boundaries drawn
 * in as reference lines - so a trend crossing into red/blue territory is
 * visible at a glance, the same way the wide tables color a single
 * out-of-range cell. A grade button selects everyone in that grade at
 * once for a quick squad-wide comparison; individual players can still be
 * added or removed from there. */
export function PlayerTrendChart({ bloodData }: { bloodData: BloodDataResponse }) {
  // Same 4年→1年・名簿順のグループ順を他の選手一覧（検査日で一覧など）に
  // 合わせる。学年は各選手の最新の記録から拾う。
  const latestGrade = useMemo(() => {
    const map = new Map<string, Grade | null>();
    for (const r of [...bloodData.records].sort((a, b) => a.date.localeCompare(b.date))) {
      if (r.grade) map.set(r.player, r.grade);
    }
    return map;
  }, [bloodData.records]);

  const sortedPlayers = useMemo(
    () =>
      [...bloodData.players].sort((a, b) =>
        compareByGradeThenRosterName(
          { player: a, grade: latestGrade.get(a) },
          { player: b, grade: latestGrade.get(b) }
        )
      ),
    [bloodData.players, latestGrade]
  );

  const playersByGrade = useMemo(() => {
    const map = new Map<Grade, string[]>();
    for (const g of GRADE_OPTIONS) map.set(g, []);
    for (const p of sortedPlayers) {
      const g = latestGrade.get(p);
      if (g) map.get(g)!.push(p);
    }
    return map;
  }, [sortedPlayers, latestGrade]);

  const orderedParameters = useMemo(
    () => orderParametersByCategory(bloodData.parameters).flatMap((g) => g.params),
    [bloodData.parameters]
  );

  const [selectedPlayers, setSelectedPlayers] = useState<string[]>(
    sortedPlayers[0] ? [sortedPlayers[0]] : []
  );
  const [parameter, setParameter] = useState(orderedParameters[0] ?? "");

  const togglePlayer = (name: string) => {
    setSelectedPlayers((prev) =>
      prev.includes(name) ? prev.filter((p) => p !== name) : [...prev, name]
    );
  };

  const selectGrade = (grade: Grade) => {
    setSelectedPlayers(playersByGrade.get(grade) ?? []);
  };

  const data = useMemo(() => {
    if (selectedPlayers.length === 0) return [];
    const byDate = new Map<string, Record<string, unknown>>();
    for (const player of selectedPlayers) {
      for (const r of bloodData.records) {
        if (r.player !== player) continue;
        const value = r.values[parameter];
        if (typeof value !== "number") continue;
        if (!byDate.has(r.date)) byDate.set(r.date, { period: r.date });
        byDate.get(r.date)![player] = value;
      }
    }
    return Array.from(byDate.values()).sort((a, b) =>
      (a.period as string).localeCompare(b.period as string)
    );
  }, [bloodData.records, selectedPlayers, parameter]);

  const series = useMemo<SeriesSpec[]>(
    () => selectedPlayers.map((p, i) => ({ key: p, label: p, color: colorForIndex(i) })),
    [selectedPlayers]
  );

  const referenceLines = useMemo<ReferenceLineSpec[]>(() => {
    const range = REFERENCE_RANGES[parameter];
    if (!range) return [];
    const lines: ReferenceLineSpec[] = [];
    if (range.high !== undefined) {
      lines.push({ value: range.high, label: `基準値上限 ${range.high}`, color: "var(--status-critical)" });
    }
    if (range.low !== undefined) {
      lines.push({ value: range.low, label: `基準値下限 ${range.low}`, color: "var(--series-1)" });
    }
    return lines;
  }, [parameter]);

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-medium" style={{ color: "var(--text-primary)" }}>
        個人の推移（基準値ライン付き）
      </h2>

      <div className="flex flex-wrap items-end gap-4">
        <Field label="検査項目">
          <select className="select" value={parameter} onChange={(e) => setParameter(e.target.value)}>
            {orderedParameters.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </Field>
        <Field label="学年で一括選択">
          <div className="flex gap-1">
            {GRADE_OPTIONS.map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => selectGrade(g)}
                className="select"
                style={{ minWidth: "auto" }}
              >
                {g}
              </button>
            ))}
          </div>
        </Field>
        {selectedPlayers.length > 0 && (
          <button
            type="button"
            onClick={() => setSelectedPlayers([])}
            className="text-xs underline"
            style={{ color: "var(--text-muted)" }}
          >
            選択解除
          </button>
        )}
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          {selectedPlayers.length}名選択中
        </p>
      </div>

      <Field label="選手（複数選択可）">
        <div
          className="flex max-h-28 flex-wrap gap-1 overflow-y-auto rounded-md p-2"
          style={{ border: "1px solid var(--border)", background: "var(--surface-1)" }}
        >
          {sortedPlayers.map((p, i) => {
            const active = selectedPlayers.includes(p);
            return (
              <button
                key={p}
                type="button"
                onClick={() => togglePlayer(p)}
                className="rounded px-2 py-1 text-xs"
                style={{
                  background: active ? colorForIndex(selectedPlayers.indexOf(p)) : "transparent",
                  color: active ? "#ffffff" : "var(--text-secondary)",
                  border: "1px solid var(--border)",
                }}
              >
                {p}
              </button>
            );
          })}
        </div>
      </Field>

      {selectedPlayers.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          選手を選択してください。
        </p>
      ) : data.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          この選手・項目のデータがありません。
        </p>
      ) : (
        <TrendLineChart data={data} series={series} referenceLines={referenceLines} />
      )}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-xs">
      <span style={{ color: "var(--text-muted)" }}>{label}</span>
      {children}
    </label>
  );
}
