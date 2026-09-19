"use client";

import { useMemo, useState } from "react";
import { orderParametersByCategory } from "@/lib/parameter-categories";
import { buildDateNormalization } from "@/lib/stats";
import type { BloodDataResponse, BloodTestRecord } from "@/lib/types";
import { WideTestTable } from "./WideTestTable";

type SortDir = "desc" | "asc";

/**
 * Pick one test date and see every player tested that round side by side,
 * sortable by any parameter (e.g. 総蛋白 highest-to-lowest).
 *
 * A "基準日" (main testing day, 40+ players) also pulls in players who
 * tested on a nearby make-up day instead - each still shown under their own
 * true test date - so a handful of stragglers don't need a separate, easy
 * to miss entry of their own. Days that were folded into a 基準日 this way
 * aren't listed separately; a day that stands entirely on its own (not a
 * 基準日 and not close enough to one) is kept as its own selectable entry.
 */
export function DateLookupTable({ bloodData }: { bloodData: BloodDataResponse }) {
  const dateNormalization = useMemo(
    () => buildDateNormalization(bloodData.records),
    [bloodData.records]
  );

  const selectableDates = useMemo(
    () =>
      dateNormalization.entries
        .filter((e) => e.status !== "merged")
        .sort((a, b) => b.date.localeCompare(a.date)),
    [dateNormalization]
  );

  // An anchor's own playerCount only counts players tested on that exact
  // date - the dropdown label should instead show the full round's headcount
  // (including whoever tested on a day folded into it).
  const mergedPlayerCounts = useMemo(() => {
    const counts = new Map<string, Set<string>>();
    for (const r of bloodData.records) {
      const anchor = dateNormalization.toAnchor.get(r.date);
      if (!anchor) continue;
      if (!counts.has(anchor)) counts.set(anchor, new Set());
      counts.get(anchor)!.add(r.player);
    }
    return new Map(Array.from(counts, ([date, players]) => [date, players.size]));
  }, [bloodData.records, dateNormalization]);

  const [date, setDate] = useState(selectableDates[0]?.date ?? "");
  const [sortParam, setSortParam] = useState("");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const selected = selectableDates.find((e) => e.date === date);

  const dayRecords = useMemo(() => {
    if (!date) return [];
    if (selected?.status === "anchor") {
      return bloodData.records.filter((r) => dateNormalization.toAnchor.get(r.date) === date);
    }
    return bloodData.records.filter((r) => r.date === date);
  }, [bloodData.records, date, selected, dateNormalization]);

  const players = useMemo(() => {
    const byPlayer = new Map<string, BloodTestRecord[]>();
    for (const r of dayRecords) {
      if (!byPlayer.has(r.player)) byPlayer.set(r.player, []);
      byPlayer.get(r.player)!.push(r);
    }
    for (const records of byPlayer.values()) records.sort((a, b) => a.date.localeCompare(b.date));
    return Array.from(byPlayer.entries()).map(([player, records]) => ({ player, records }));
  }, [dayRecords]);

  const sortableParams = useMemo(() => {
    const params = new Set<string>();
    dayRecords.forEach((r) => Object.keys(r.values).forEach((k) => params.add(k)));
    return orderParametersByCategory(Array.from(params)).flatMap((g) => g.params);
  }, [dayRecords]);

  const sortedPlayers = useMemo(() => {
    const sorted = [...players].sort((a, b) => a.player.localeCompare(b.player, "ja"));
    if (!sortParam) return sorted;
    // A player normally has one record in the selected window; if they have
    // more (a 基準日 pulling in a nearby make-up day too), sort by whichever
    // of their records actually has this parameter's value.
    const valueFor = (recs: BloodTestRecord[]) =>
      recs.map((r) => r.values[sortParam]).find((v) => typeof v === "number");
    const withValue = sorted.filter((p) => typeof valueFor(p.records) === "number");
    const withoutValue = sorted.filter((p) => typeof valueFor(p.records) !== "number");
    withValue.sort((a, b) => {
      const av = valueFor(a.records)!;
      const bv = valueFor(b.records)!;
      return sortDir === "asc" ? av - bv : bv - av;
    });
    return [...withValue, ...withoutValue];
  }, [players, sortParam, sortDir]);

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-medium" style={{ color: "var(--text-primary)" }}>
        検査日で一覧
      </h2>

      <div className="flex flex-wrap items-end gap-4">
        <Field label="検査日">
          <select className="select" value={date} onChange={(e) => setDate(e.target.value)}>
            {selectableDates.map((e) => (
              <option key={e.date} value={e.date}>
                {e.status === "anchor"
                  ? `${e.date}（基準日・${mergedPlayerCounts.get(e.date) ?? e.playerCount}人）`
                  : `${e.date}（${e.playerCount}人）`}
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
          {players.length}名の検査
        </p>
      </div>

      {players.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          この日の検査データがありません。
        </p>
      ) : (
        <WideTestTable
          groups={sortedPlayers.map((p) => ({ label: p.player, records: p.records }))}
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
