"use client";

import { useMemo, useState } from "react";
import { academicYear } from "@/lib/stats";
import { orderParametersByCategory } from "@/lib/parameter-categories";
import { classifyValue } from "@/lib/reference-ranges";
import { GRADE_OPTIONS } from "@/lib/types";
import type { BloodDataResponse, Grade } from "@/lib/types";

export function GradeTable({ bloodData }: { bloodData: BloodDataResponse }) {
  const gradedRecords = useMemo(
    () => bloodData.records.filter((r) => r.grade !== null),
    [bloodData.records]
  );

  const availableYears = useMemo(() => {
    const years = new Set(gradedRecords.map((r) => academicYear(r.date)));
    return Array.from(years).sort((a, b) => b - a);
  }, [gradedRecords]);

  const [year, setYear] = useState<number | null>(availableYears[0] ?? null);
  const [grade, setGrade] = useState<Grade>("4年");

  const filtered = useMemo(
    () =>
      gradedRecords
        .filter((r) => r.grade === grade && year !== null && academicYear(r.date) === year)
        .sort((a, b) => a.date.localeCompare(b.date)),
    [gradedRecords, grade, year]
  );

  const players = useMemo(() => {
    const byPlayer = new Map<string, typeof filtered>();
    for (const r of filtered) {
      if (!byPlayer.has(r.player)) byPlayer.set(r.player, []);
      byPlayer.get(r.player)!.push(r);
    }
    return Array.from(byPlayer.entries())
      .map(([player, records]) => ({ player, records }))
      .sort((a, b) => a.player.localeCompare(b.player, "ja"));
  }, [filtered]);

  const parameterGroups = useMemo(() => {
    const params = new Set<string>();
    filtered.forEach((r) => Object.keys(r.values).forEach((k) => params.add(k)));
    return orderParametersByCategory(Array.from(params));
  }, [filtered]);

  const totalColumns = players.reduce((s, p) => s + p.records.length, 0);

  if (availableYears.length === 0) {
    return (
      <p className="text-sm" style={{ color: "var(--text-muted)" }}>
        学年の情報が入力されている検査データがありません。
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-4">
        <Field label="年度">
          <select
            className="select"
            value={year ?? ""}
            onChange={(e) => setYear(Number(e.target.value))}
          >
            {availableYears.map((y) => (
              <option key={y} value={y}>
                {y}年度
              </option>
            ))}
          </select>
        </Field>
        <Field label="学年">
          <select className="select" value={grade} onChange={(e) => setGrade(e.target.value as Grade)}>
            {GRADE_OPTIONS.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </Field>
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          {players.length}名・{totalColumns}件の検査（
          <span style={{ color: "var(--status-critical)" }}>赤</span>=基準値より高値、
          <span style={{ color: "var(--series-1)" }}>青</span>=基準値より低値）
        </p>
      </div>

      {totalColumns === 0 ? (
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          この年度・学年に該当する検査データがありません。
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg" style={{ border: "1px solid var(--border)" }}>
          <table className="text-xs" style={{ borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th
                  className="sticky left-0 z-10 px-2 py-1 text-left"
                  style={{ background: "var(--surface-1)", borderBottom: "1px solid var(--border)" }}
                />
                {players.map((p) => (
                  <th
                    key={p.player}
                    colSpan={p.records.length}
                    className="whitespace-nowrap px-2 py-1 text-center font-medium"
                    style={{
                      background: "var(--surface-1)",
                      borderBottom: "1px solid var(--border)",
                      borderLeft: "1px solid var(--border)",
                      color: "var(--text-primary)",
                    }}
                  >
                    {p.player}
                  </th>
                ))}
              </tr>
              <tr>
                <th
                  className="sticky left-0 z-10 px-2 py-1 text-left"
                  style={{ background: "var(--surface-1)", borderBottom: "1px solid var(--border)" }}
                >
                  検査項目
                </th>
                {players.flatMap((p) =>
                  p.records.map((r) => (
                    <th
                      key={r.id}
                      className="whitespace-nowrap px-2 py-1 text-center font-normal"
                      style={{
                        background: "var(--surface-1)",
                        borderBottom: "1px solid var(--border)",
                        borderLeft: "1px solid var(--gridline)",
                        color: "var(--text-muted)",
                      }}
                    >
                      {r.date}
                    </th>
                  ))
                )}
              </tr>
            </thead>
            <tbody>
              {parameterGroups.map((group) => (
                <RowGroup key={group.category} group={group} players={players} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function RowGroup({
  group,
  players,
}: {
  group: { category: string; params: string[] };
  players: { player: string; records: { id: string; values: Record<string, number> }[] }[];
}) {
  return (
    <>
      <tr>
        <td
          colSpan={1 + players.reduce((s, p) => s + p.records.length, 0)}
          className="px-2 py-1 font-medium"
          style={{
            background: "var(--background)",
            color: "var(--text-secondary)",
            borderTop: "1px solid var(--border)",
            borderBottom: "1px solid var(--border)",
          }}
        >
          {group.category}
        </td>
      </tr>
      {group.params.map((param) => (
        <tr key={param}>
          <td
            className="sticky left-0 z-10 whitespace-nowrap px-2 py-1"
            style={{
              background: "var(--surface-1)",
              borderBottom: "1px solid var(--gridline)",
              color: "var(--text-primary)",
            }}
          >
            {param}
          </td>
          {players.flatMap((p) =>
            p.records.map((r) => {
              const value = r.values[param];
              const cls = typeof value === "number" ? classifyValue(param, value) : null;
              return (
                <td
                  key={r.id}
                  className="whitespace-nowrap px-2 py-1 text-right"
                  style={{
                    borderBottom: "1px solid var(--gridline)",
                    borderLeft: "1px solid var(--gridline)",
                    fontVariantNumeric: "tabular-nums",
                    color:
                      cls === "high"
                        ? "var(--status-critical)"
                        : cls === "low"
                          ? "var(--series-1)"
                          : "var(--text-primary)",
                    fontWeight: cls ? 600 : 400,
                  }}
                >
                  {value ?? ""}
                </td>
              );
            })
          )}
        </tr>
      ))}
    </>
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
