export function DataTable({
  columns,
  rows,
}: {
  columns: { key: string; label: string; align?: "left" | "right" }[];
  rows: Record<string, unknown>[];
}) {
  return (
    <div
      className="overflow-x-auto rounded-lg"
      style={{ border: "1px solid var(--border)" }}
    >
      <table className="w-full text-sm" style={{ borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ borderBottom: "1px solid var(--border)" }}>
            {columns.map((c) => (
              <th
                key={c.key}
                className="px-3 py-2 font-medium"
                style={{
                  color: "var(--text-secondary)",
                  textAlign: c.align ?? "left",
                }}
              >
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} style={{ borderBottom: "1px solid var(--gridline)" }}>
              {columns.map((c) => (
                <td
                  key={c.key}
                  className="px-3 py-2"
                  style={{
                    color: "var(--text-primary)",
                    textAlign: c.align ?? "left",
                    fontVariantNumeric: c.align === "right" ? "tabular-nums" : undefined,
                  }}
                >
                  {row[c.key] === undefined || row[c.key] === null
                    ? "-"
                    : String(row[c.key])}
                </td>
              ))}
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td
                colSpan={columns.length}
                className="px-3 py-6 text-center"
                style={{ color: "var(--text-muted)" }}
              >
                データがありません
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
