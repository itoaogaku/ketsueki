import { orderParametersByCategory } from "@/lib/parameter-categories";
import { classifyValue } from "@/lib/reference-ranges";
import type { BloodTestRecord } from "@/lib/types";

export interface ColumnGroup {
  /** Header label spanning this group's columns (a player name, typically). */
  label: string;
  records: BloodTestRecord[];
}

/**
 * Renders blood-test parameters as sticky-first-column rows against one
 * column per record, with records clustered into labelled groups (one
 * group per player) and colored against each parameter's reference range.
 * Shared by every "wide" table view - the grade-view roster, a single
 * player's full history, and a single test date across every player.
 */
export function WideTestTable({ groups }: { groups: ColumnGroup[] }) {
  const parameterGroups = orderParametersByCategory(
    Array.from(new Set(groups.flatMap((g) => g.records.flatMap((r) => Object.keys(r.values)))))
  );

  return (
    <div
      className="overflow-auto rounded-lg"
      style={{
        border: "1px solid var(--border)",
        maxHeight: "91vh", // 70vh x1.3
        width: "130%",
        marginLeft: "-15%",
      }}
    >
      <table className="text-xs" style={{ borderCollapse: "collapse" }}>
        <thead style={{ position: "sticky", top: 0, zIndex: 20 }}>
          <tr>
            <th
              className="sticky left-0 z-10 px-2 py-1 text-left"
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
              className="sticky left-0 z-10 px-2 py-1 text-left"
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
            <RowGroup key={group.category} group={group} groups={groups} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RowGroup({
  group,
  groups,
}: {
  group: { category: string; params: string[] };
  groups: ColumnGroup[];
}) {
  return (
    <>
      <tr>
        <td
          className="sticky left-0 z-10 whitespace-nowrap px-2 py-1 font-medium"
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
            className="sticky left-0 z-10 whitespace-nowrap px-2 py-1"
            style={{
              background: "var(--surface-1)",
              borderBottom: "1px solid var(--gridline)",
              color: "var(--text-primary)",
            }}
          >
            {param}
          </td>
          {groups.flatMap((g) =>
            g.records.map((r) => {
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
