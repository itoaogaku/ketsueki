"use client";

import { useMemo, useState } from "react";
import type { BloodDataResponse } from "@/lib/types";
import { WideTestTable } from "./WideTestTable";

/** Search a player by (partial) name and see every test they've ever had,
 * across all dates, in one wide table - the single-player equivalent of the
 * grade-view roster. */
export function PlayerHistoryTable({ bloodData }: { bloodData: BloodDataResponse }) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | null>(null);

  const matches = useMemo(() => {
    const q = query.trim();
    if (!q) return [];
    return bloodData.players.filter((p) => p.includes(q));
  }, [bloodData.players, query]);

  const records = useMemo(
    () =>
      selected
        ? bloodData.records
            .filter((r) => r.player === selected)
            .sort((a, b) => a.date.localeCompare(b.date))
        : [],
    [bloodData.records, selected]
  );

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-medium" style={{ color: "var(--text-primary)" }}>
        選手検索
      </h2>

      <input
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setSelected(null);
        }}
        placeholder="選手名を入力（部分一致）"
        className="select w-full max-w-xs"
      />

      {query.trim() && !selected && (
        <div className="flex flex-wrap gap-1">
          {matches.length === 0 ? (
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              該当する選手が見つかりません。
            </p>
          ) : (
            matches.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setSelected(p)}
                className="rounded px-2 py-1 text-xs"
                style={{
                  border: "1px solid var(--border)",
                  color: "var(--text-secondary)",
                }}
              >
                {p}
              </button>
            ))
          )}
        </div>
      )}

      {selected && (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
              {selected}（{records.length}件の検査）
            </span>
            <button
              type="button"
              onClick={() => {
                setSelected(null);
                setQuery("");
              }}
              className="text-xs underline"
              style={{ color: "var(--text-muted)" }}
            >
              検索に戻る
            </button>
          </div>
          {records.length === 0 ? (
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              検査データがありません。
            </p>
          ) : (
            <WideTestTable groups={[{ label: selected, records }]} />
          )}
        </div>
      )}
    </section>
  );
}
