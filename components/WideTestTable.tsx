"use client";

import { useState } from "react";
import { orderParametersByCategory } from "@/lib/parameter-categories";
import { classifySeverity, type Severity } from "@/lib/reference-ranges";
import type { BloodTestRecord } from "@/lib/types";
import { ParameterInfoModal } from "./ParameterInfoModal";

// Background tint per severity level - level 1 (just past the reference
// boundary) is a light tint, level 3 (past the severe cutoff) is a strong
// fill with white text for contrast.
const SEVERITY_BG: Record<Severity["direction"], [string, string, string]> = {
  high: ["rgba(208, 59, 59, 0.15)", "rgba(208, 59, 59, 0.38)", "rgba(208, 59, 59, 0.75)"],
  low: ["rgba(42, 120, 214, 0.15)", "rgba(42, 120, 214, 0.38)", "rgba(42, 120, 214, 0.75)"],
};

function severityStyle(severity: Severity | null): { background?: string; color: string; fontWeight: number } {
  if (!severity) return { color: "var(--text-primary)", fontWeight: 400 };
  const background = SEVERITY_BG[severity.direction][severity.level - 1];
  if (severity.level === 3) {
    return { background, color: "#ffffff", fontWeight: 700 };
  }
  return {
    background,
    color: severity.direction === "high" ? "var(--status-critical)" : "var(--series-1)",
    fontWeight: 600,
  };
}

export interface ColumnGroup {
  /** Header label spanning this group's columns (a player name, typically). */
  label: string;
  records: BloodTestRecord[];
}

// Long parameter names (e.g. "フェリチン(Ferritin) (※フェリチン精密)") used to
// size the sticky label column to fit in full, which left barely any room
// for the actual data columns on a phone - truncate with an ellipsis
// instead (title= gives the full name on hover) and cap the column
// narrower on small screens, wider on desktop where there's room to spare.
const LABEL_CELL_CLASS = "sticky left-0 z-10 max-w-[7rem] truncate px-2 py-1 md:max-w-[15rem]";

/**
 * Renders blood-test parameters as sticky-first-column rows against one
 * column per record, with records clustered into labelled groups (one
 * group per player) and colored against each parameter's reference range.
 * Shared by every "wide" table view - the grade-view roster, a single
 * player's full history, and a single test date across every player.
 *
 * `showParameterInfo` makes each parameter name clickable, opening a
 * popup that explains what it measures and why it matters for a distance
 * runner specifically.
 */
export function WideTestTable({
  groups,
  showParameterInfo = false,
}: {
  groups: ColumnGroup[];
  showParameterInfo?: boolean;
}) {
  const parameterGroups = orderParametersByCategory(
    Array.from(new Set(groups.flatMap((g) => g.records.flatMap((r) => Object.keys(r.values)))))
  );
  const [openParameter, setOpenParameter] = useState<string | null>(null);

  return (
    <div
      className="wide-table-container overflow-auto rounded-lg"
      style={{
        border: "1px solid var(--border)",
        // Gray, not white: on desktop the container is wider than the table
        // itself (to give the enlarged view room), and that leftover strip
        // past the table's own right edge should read as "no more data"
        // rather than looking like part of the table.
        background: "var(--surface-empty)",
      }}
    >
      {/* border-collapse: collapse breaks sticky positioning on <thead> in
          most browsers (a thin gap opens up where scrolled-past body rows
          bleed through above the "stuck" header) - border-spacing: 0 keeps
          the same tight grid look without that interaction. */}
      <table
        className="text-xs"
        style={{
          borderCollapse: "separate",
          borderSpacing: 0,
          background: "var(--surface-1)",
          borderRight: "1px solid var(--border)",
        }}
      >
        <thead style={{ position: "sticky", top: 0, zIndex: 20 }}>
          <tr>
            <th
              className={`${LABEL_CELL_CLASS} text-left`}
              style={{ background: "var(--surface-1)", borderBottom: "1px solid var(--border)" }}
            />
            {groups.map((g, i) => (
              <th
                key={`${g.label}-${i}`}
                colSpan={g.records.length}
                className="whitespace-nowrap px-2 py-1 text-center font-medium"
                style={{
                  background: "var(--surface-1)",
                  borderBottom: "1px solid var(--border)",
                  borderLeft: "1px solid var(--border)",
                  color: "var(--text-primary)",
                }}
              >
                {g.label}
              </th>
            ))}
          </tr>
          <tr>
            <th
              className={`${LABEL_CELL_CLASS} text-left`}
              style={{ background: "var(--surface-1)", borderBottom: "1px solid var(--border)" }}
            >
              検査項目
            </th>
            {groups.flatMap((g) =>
              g.records.map((r) => (
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
            <RowGroup
              key={group.category}
              group={group}
              groups={groups}
              onParamClick={showParameterInfo ? setOpenParameter : undefined}
            />
          ))}
        </tbody>
      </table>
      {openParameter && (
        <ParameterInfoModal parameter={openParameter} onClose={() => setOpenParameter(null)} />
      )}
    </div>
  );
}

function RowGroup({
  group,
  groups,
  onParamClick,
}: {
  group: { category: string; params: string[] };
  groups: ColumnGroup[];
  onParamClick?: (param: string) => void;
}) {
  return (
    <>
      <tr>
        <td
          className={`${LABEL_CELL_CLASS} font-medium`}
          title={group.category}
          style={{
            background: "var(--background)",
            color: "var(--text-secondary)",
            borderTop: "1px solid var(--border)",
            borderBottom: "1px solid var(--border)",
          }}
        >
          {group.category}
        </td>
        <td
          colSpan={groups.reduce((s, g) => s + g.records.length, 0)}
          style={{
            background: "var(--background)",
            borderTop: "1px solid var(--border)",
            borderBottom: "1px solid var(--border)",
          }}
        />
      </tr>
      {group.params.map((param) => (
        <tr key={param}>
          <td
            className={LABEL_CELL_CLASS}
            title={param}
            style={{
              background: "var(--surface-1)",
              borderBottom: "1px solid var(--gridline)",
              color: "var(--text-primary)",
            }}
          >
            {onParamClick ? (
              <button
                type="button"
                onClick={() => onParamClick(param)}
                style={{
                  background: "none",
                  border: "none",
                  padding: 0,
                  font: "inherit",
                  color: "inherit",
                  cursor: "pointer",
                  textDecoration: "underline",
                  textDecorationStyle: "dotted",
                  textDecorationColor: "var(--text-muted)",
                }}
              >
                {param}
              </button>
            ) : (
              param
            )}
          </td>
          {groups.flatMap((g) =>
            g.records.map((r) => {
              const value = r.values[param];
              const severity = typeof value === "number" ? classifySeverity(param, value) : null;
              return (
                <td
                  key={r.id}
                  className="whitespace-nowrap px-2 py-1 text-right"
                  style={{
                    borderBottom: "1px solid var(--gridline)",
                    borderLeft: "1px solid var(--gridline)",
                    fontVariantNumeric: "tabular-nums",
                    ...severityStyle(severity),
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
