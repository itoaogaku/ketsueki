"use client";

import { useMemo, useState } from "react";
import { orderParametersByCategory } from "@/lib/parameter-categories";
import { compareByGradeThenRosterName } from "@/lib/player-roster";
import { REFERENCE_RANGES } from "@/lib/reference-ranges";
import type { BloodDataResponse } from "@/lib/types";
import { TrendLineChart, type ReferenceLineSpec } from "./TrendLineChart";

/** One player's values for one parameter over time, as a line chart with
 * the parameter's normal-range boundaries drawn in as reference lines - so
 * a trend crossing into red/blue territory is visible at a glance, the same
 * way the wide tables color a single out-of-range cell. */
export function PlayerTrendChart({ bloodData }: { bloodData: BloodDataResponse }) {
  // Same 4年→1年・名簿順のグループ順を他の選手一覧（検査日で一覧など）に
  // 合わせる。学年は各選手の最新の記録から拾う。
  const sortedPlayers = useMemo(() => {
    const latestGrade = new Map<string, (typeof bloodData.records)[number]["grade"]>();
    for (const r of [...bloodData.records].sort((a, b) => a.date.localeCompare(b.date))) {
      if (r.grade) latestGrade.set(r.player, r.grade);
    }
    return [...bloodData.players].sort((a, b) =>
      compareByGradeThenRosterName(
        { player: a, grade: latestGrade.get(a) },
        { player: b, grade: latestGrade.get(b) }
      )
    );
  }, [bloodData.players, bloodData.records]);
  const orderedParameters = useMemo(
    () => orderParametersByCategory(bloodData.parameters).flatMap((g) => g.params),
    [bloodData.parameters]
  );

  const [player, setPlayer] = useState(sortedPlayers[0] ?? "");
  const [parameter, setParameter] = useState(orderedParameters[0] ?? "");

  const data = useMemo(
    () =>
      bloodData.records
        .filter((r) => r.player === player && typeof r.values[parameter] === "number")
        .sort((a, b) => a.date.localeCompare(b.date))
        .map((r) => ({ period: r.date, value: r.values[parameter] })),
    [bloodData.records, player, parameter]
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
        <Field label="選手">
          <select className="select" value={player} onChange={(e) => setPlayer(e.target.value)}>
            {sortedPlayers.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </Field>
        <Field label="検査項目">
          <select className="select" value={parameter} onChange={(e) => setParameter(e.target.value)}>
            {orderedParameters.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </Field>
        {data.length > 0 && (
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            {data.length}件の検査
          </p>
        )}
      </div>

      {data.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          この選手・項目のデータがありません。
        </p>
      ) : (
        <TrendLineChart
          data={data}
          series={[{ key: "value", label: parameter, color: "var(--brand)" }]}
          referenceLines={referenceLines}
        />
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
