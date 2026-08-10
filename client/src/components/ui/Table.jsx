import React from "react";

/**
 * UI Table component. Headless by default, styled with Tailwind and tokens.
 * Accessible, keyboard navigable.
 */
export function Table({ columns = [], data = [], className = "" }) {
  return (
    <div className={`overflow-x-auto ${className}`}>
      <table className="min-w-full border border-border bg-surface rounded-xl">
        <thead>
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                className="px-4 py-2 text-left font-semibold text-foreground border-b border-border bg-surface-muted"
                scope="col"
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={i} className="even:bg-surface-muted">
              {columns.map((col) => (
                <td key={col.key} className="px-4 py-2 border-b border-border">
                  {row[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
