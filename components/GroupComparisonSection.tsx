"use client";

import { useMemo, useState } from "react";
import { TrendLineChart } from "./TrendLineChart";
import { DataTable } from "./DataTable";
import { buildDateNormalization, computeGroupComparisonByDate, type ComparisonGroup } from "@/lib/stats";
import { orderParametersByCategory } from "@/lib/parameter-categories";
import type { BloodTestRecord } from "@/lib/types";

const SERIES_COLORS = ["var(--series-1)", "var(--series-2)", "var(--series-3)", "var(--series-4)"];

/**
 * Per-group (dorm or grade) average of one or more checked blood parameters,
 * plotted by exact test date rather than a monthly bucket. Different
 * parameters use different units, so only the first checked one drives the
 * line chart; checking more than one is meant for the table view, where
 * each checked parameter gets its own column per group.
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
  const [checked, setChecked] = useState<string[]>(parameters[0] ? [parameters[0]] : []);
  const [showTable, setShowTable] = useState(false);
  const [showDateLog, setShowDateLog] = useState(false);

  // Same category order the wide tables use (貧血関連項目 → 疲労感関連項目 →
  // ...), rather than whatever order the parameters happened to arrive in.
  const orderedParameters = useMemo(
    () => orderParametersByCategory(parameters).flatMap((g) => g.params),
    [parameters]
  );

  const toggle = (p: string) => {
    setChecked((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]));
  };

  // A handful of players sometimes test on a make-up day (a different
  // player missed the main round and went later), which would otherwise
  // show up as its own thin, misleading data point. Treat any day with 40+
  // players tested as a "main round" and fold any other day within a week
  // of one into it; days further out than that are dropped from these
  // by-date charts entirely (see the log table below for exactly which).
  const dateNormalization = useMemo(() => buildDateNormalization(records), [records]);

  const chartParameter = checked[0] ?? "";
  const chartData = useMemo(
    () =>
      chartParameter
        ? computeGroupComparisonByDate(records, chartParameter, groups, dateNormalization)
        : [],
    [records, chartParameter, groups, dateNormalization]
  );

  const table = useMemo(() => {
    if (checked.length === 0) return { columns: [], rows: [] as Record<string, unknown>[] };
    const perParam = checked.map((p) => ({
      parameter: p,
      byDate: new Map(
        computeGroupComparisonByDate(records, p, groups, dateNormalization).map((row) => [
          row.period as string,
          row,
        ])
      ),
    }));
    const dates = new Set<string>();
    perParam.forEach((pp) => pp.byDate.forEach((_, date) => dates.add(date)));

    const columns = [
      { key: "period", label: "検査日" },
      ...checked.flatMap((p) =>
        groups.map((g) => ({
          key: `${p}__${g.key}`,
          label: `${p}（${g.label}）`,
          align: "right" as const,
        }))
      ),
    ];
    const rows = Array.from(dates)
      .sort()
      .map((date) => {
        const row: Record<string, unknown> = { period: date };
        perParam.forEach((pp) => {
          const match = pp.byDate.get(date);
          groups.forEach((g) => {
            row[`${pp.parameter}__${g.key}`] = match?.[g.key];
          });
        });
        return row;
      });
    return { columns, rows };
  }, [checked, records, groups, dateNormalization]);

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
        style={{ border: "1px solid var(--border)" }}
      >
        {orderedParameters.map((p) => {
          const active = checked.includes(p);
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
                type="checkbox"
                checked={active}
                onChange={() => toggle(p)}
                className="sr-only"
              />
              {p}
            </label>
          );
        })}
      </div>

      {checked.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          検査項目にチェックを入れてください。
        </p>
      ) : showTable ? (
        <DataTable columns={table.columns} rows={table.rows} />
      ) : (
        <>
          {checked.length > 1 && (
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              グラフには「{chartParameter}」のみ表示しています（項目ごとに単位が異なるため）。他の項目も含めて見るには「表で表示」をお使いください。
            </p>
          )}
          <TrendLineChart
            data={chartData}
            series={groups.map((g, i) => ({
              key: g.key,
              label: g.label,
              color: SERIES_COLORS[i % SERIES_COLORS.length],
            }))}
          />
        </>
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
