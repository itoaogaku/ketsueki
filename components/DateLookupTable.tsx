"use client";

import { useMemo, useState } from "react";
import { orderParametersByCategory } from "@/lib/parameter-categories";
import type { BloodDataResponse } from "@/lib/types";
import { WideTestTable } from "./WideTestTable";

type SortDir = "desc" | "asc";

/** Pick one exact test date and see every player tested that day side by
 * side, sortable by any parameter (e.g. 総蛋白 highest-to-lowest). */
export function DateLookupTable({ bloodData }: { bloodData: BloodDataResponse }) {
  const availableDates = useMemo(
    () => Array.from(new Set(bloodData.records.map((r) => r.date))).sort().reverse(),
    [bloodData.records]
  );
  const [date, setDate] = useState(availableDates[0] ?? "");
  const [sortParam, setSortParam] = useState("");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const dayRecords = useMemo(
    () => bloodData.records.filter((r) => r.date === date).sort((a, b) => a.player.localeCompare(b.player, "ja")),
    [bloodData.records, date]
  );

  const sortableParams = useMemo(() => {
    const params = new Set<string>();
    dayRecords.forEach((r) => Object.keys(r.values).forEach((k) => params.add(k)));
    return orderParametersByCategory(Array.from(params)).flatMap((g) => g.params);
  }, [dayRecords]);

  const sortedRecords = useMemo(() => {
    if (!sortParam) return dayRecords;
    const withValue = dayRecords.filter((r) => typeof r.values[sortParam] === "number");
    const withoutValue = dayRecords.filter((r) => typeof r.values[sortParam] !== "number");
    withValue.sort((a, b) =>
      sortDir === "asc"
        ? a.values[sortParam] - b.values[sortParam]
        : b.values[sortParam] - a.values[sortParam]
    );
    return [...withValue, ...withoutValue];
  }, [dayRecords, sortParam, sortDir]);

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-medium" style={{ color: "var(--text-primary)" }}>
        検査日で一覧
      </h2>

      <div className="flex flex-wrap items-end gap-4">
        <Field label="検査日">
          <select className="select" value={date} onChange={(e) => setDate(e.target.value)}>
            {availableDates.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </Field>
        <Field label="並び替え">
          <select
            className="select"
            value={sortParam}
            onChange={(e) => setSortParam(e.target.value)}
          >
            <option value="">選手名順</option>
            {sortableParams.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </Field>
        {sortParam && (
          <Field label="順序">
            <select
              className="select"
              value={sortDir}
              onChange={(e) => setSortDir(e.target.value as SortDir)}
            >
              <option value="desc">多い順</option>
              <option value="asc">少ない順</option>
            </select>
          </Field>
        )}
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          {dayRecords.length}名の検査
        </p>
      </div>

      {dayRecords.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          この日の検査データがありません。
        </p>
      ) : (
        <WideTestTable groups={sortedRecords.map((r) => ({ label: r.player, records: [r] }))} />
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
