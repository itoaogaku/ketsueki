"use client";

import { useMemo, useState } from "react";
import { TrendLineChart } from "./TrendLineChart";
import { DataTable } from "./DataTable";
import { buildDateNormalization, computeGroupComparisonByDate, type ComparisonGroup } from "@/lib/stats";
import { orderParametersByCategory } from "@/lib/parameter-categories";
import type { BloodTestRecord } from "@/lib/types";

const SERIES_COLORS = ["var(--series-1)", "var(--series-2)", "var(--series-3)", "var(--series-4)"];

const DEFAULT_PARAMETER = "Hb（ヘモグロビン量）";

/**
 * Per-group (dorm or grade) average of exactly one selected blood
 * parameter, plotted by exact test date rather than a monthly bucket.
 * Only one parameter can be selected at a time (picking one clears the
 * previous pick) so the chart's single Y axis always means one thing.
 */
export function GroupComparisonSection({
  title,
  records,
  parameters,
  groups,
}: {
  title: string;
  records: BloodTestRecord[];
  parameters: string[];
  groups: ComparisonGroup[];
}) {
  const [selected, setSelected] = useState(
    parameters.includes(DEFAULT_PARAMETER) ? DEFAULT_PARAMETER : (parameters[0] ?? "")
  );
  const [showTable, setShowTable] = useState(false);
  const [showDateLog, setShowDateLog] = useState(false);

  // Same category order the wide tables use (貧血関連項目 → 疲労感関連項目 →
  // ...), rather than whatever order the parameters happened to arrive in.
  const orderedParameters = useMemo(
    () => orderParametersByCategory(parameters).flatMap((g) => g.params),
    [parameters]
  );

  // A handful of players sometimes test on a make-up day (a different
  // player missed the main round and went later), which would otherwise
  // show up as its own thin, misleading data point. Treat any day with 40+
  // players tested as a "main round" and fold any other day within a week
  // of one into it; days further out than that are dropped from these
  // by-date charts entirely (see the log table below for exactly which).
  const dateNormalization = useMemo(() => buildDateNormalization(records), [records]);

  const chartData = useMemo(
    () =>
      selected
        ? computeGroupComparisonByDate(records, selected, groups, dateNormalization)
        : [],
    [records, selected, groups, dateNormalization]
  );

  const table = useMemo(() => {
    if (!selected) return { columns: [], rows: [] as Record<string, unknown>[] };
    const columns = [
      { key: "period", label: "検査日" },
      ...groups.map((g) => ({ key: g.key, label: `${selected}（${g.label}）`, align: "right" as const })),
    ];
    return { columns, rows: chartData };
  }, [selected, groups, chartData]);

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium" style={{ color: "var(--text-primary)" }}>
          {title}
        </h2>
        <button
          type="button"
          onClick={() => setShowTable((v) => !v)}
          className="text-xs underline"
          style={{ color: "var(--text-muted)" }}
        >
          {showTable ? "グラフを表示" : "表で表示"}
        </button>
      </div>

      <div
        className="flex flex-wrap gap-1 rounded-md p-2"
        style={{ border: "1px solid var(--border)", background: "var(--surface-1)" }}
      >
        {orderedParameters.map((p) => {
          const active = p === selected;
          return (
            <label
              key={p}
              className="flex cursor-pointer items-center gap-1 rounded px-1.5 py-0.5 text-[11px] whitespace-nowrap"
              style={{
                background: active ? "var(--brand)" : "transparent",
                color: active ? "#ffffff" : "var(--text-secondary)",
                border: "1px solid var(--border)",
              }}
            >
              <input
                type="radio"
                name={`${title}-parameter`}
                checked={active}
                onChange={() => setSelected(p)}
                className="sr-only"
              />
              {p}
            </label>
          );
        })}
      </div>

      {!selected ? (
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          検査項目を選んでください。
        </p>
      ) : showTable ? (
        <DataTable columns={table.columns} rows={table.rows} />
      ) : (
        <TrendLineChart
          data={chartData}
          series={groups.map((g, i) => ({
            key: g.key,
            label: g.label,
            color: SERIES_COLORS[i % SERIES_COLORS.length],
          }))}
        />
      )}

      <div>
        <button
          type="button"
          onClick={() => setShowDateLog((v) => !v)}
          className="text-xs underline"
          style={{ color: "var(--text-muted)" }}
        >
          {showDateLog ? "検査日の統合ルールを隠す" : "検査日の統合ルールを見る"}
        </button>
        {showDateLog && (
          <div className="mt-2 space-y-1">
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              40名以上が受けた日を「基準日」とし、その前後1週間以内の日はその基準日にまとめて集計しています。それ以外（基準日から1週間より離れた日）は、このグラフ・表の集計から除外しています。
            </p>
            <DateNormalizationLog entries={dateNormalization.entries} />
          </div>
        )}
      </div>
    </section>
  );
}

function DateNormalizationLog({
  entries,
}: {
  entries: ReturnType<typeof buildDateNormalization>["entries"];
}) {
  const STATUS_LABEL = { anchor: "基準日", merged: "統合", excluded: "除外" } as const;
  return (
    <DataTable
      columns={[
        { key: "date", label: "検査日" },
        { key: "playerCount", label: "人数", align: "right" },
        { key: "status", label: "判定" },
        { key: "mergedInto", label: "統合先" },
      ]}
      rows={[...entries]
        .sort((a, b) => a.date.localeCompare(b.date))
        .map((e) => ({
          date: e.date,
          playerCount: e.playerCount,
          status: STATUS_LABEL[e.status],
          mergedInto: e.mergedInto ?? (e.status === "excluded" ? "(除外)" : "-"),
        }))}
    />
  );
}
