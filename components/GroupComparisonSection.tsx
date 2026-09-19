"use client";

import { useMemo, useState } from "react";
import { TrendLineChart } from "./TrendLineChart";
import { DataTable } from "./DataTable";
import { computeGroupComparisonByDate, type ComparisonGroup } from "@/lib/stats";
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

  const toggle = (p: string) => {
    setChecked((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]));
  };

  const chartParameter = checked[0] ?? "";
  const chartData = useMemo(
    () => (chartParameter ? computeGroupComparisonByDate(records, chartParameter, groups) : []),
    [records, chartParameter, groups]
  );

  const table = useMemo(() => {
    if (checked.length === 0) return { columns: [], rows: [] as Record<string, unknown>[] };
    const perParam = checked.map((p) => ({
      parameter: p,
      byDate: new Map(
        computeGroupComparisonByDate(records, p, groups).map((row) => [row.period as string, row])
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
  }, [checked, records, groups]);

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
        className="flex max-h-32 flex-wrap gap-1 overflow-y-auto rounded-md p-2"
        style={{ border: "1px solid var(--border)" }}
      >
        {parameters.map((p) => {
          const active = checked.includes(p);
          return (
            <label
              key={p}
              className="flex cursor-pointer items-center gap-1 rounded px-2 py-1 text-xs"
              style={{
                background: active ? "var(--series-1)" : "transparent",
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
    </section>
  );
}
