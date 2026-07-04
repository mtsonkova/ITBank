interface SimpleTableProps {
  headers: string[];
  rows: string[][];
  testIdPrefix: string;
}

export function SimpleTable({ headers, rows, testIdPrefix }: SimpleTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm font-ui">
        <thead>
          <tr className="border-b border-gray-100 bg-gray-50 text-left">
            {headers.map((h) => (
              <th key={h} className="px-4 py-2 font-semibold text-gray-600 text-xs uppercase tracking-wide">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {rows.map((row, i) => (
            <tr key={i} data-testid={`${testIdPrefix}-row-${i}`} className="hover:bg-gray-50 transition-colors">
              {row.map((cell, j) => (
                <td key={j} className="px-4 py-3 text-[#0F172A]">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
