"use client";

import { useMemo, useState } from "react";
import { compareByRosterName } from "@/lib/player-roster";
import { academicYear } from "@/lib/stats";
import { GRADE_OPTIONS } from "@/lib/types";
import type { BloodDataResponse, Grade } from "@/lib/types";
import { WideTestTable } from "./WideTestTable";

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
      .sort((a, b) => compareByRosterName(a.player, b.player));
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
        <WideTestTable
          groups={players.map((p) => ({ label: p.player, records: p.records }))}
        />
      )}
    </div>
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
