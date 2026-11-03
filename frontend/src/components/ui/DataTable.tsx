import type { ReactNode } from 'react';

export interface DataTableColumn<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  className?: string;
}

export function DataTable<T extends { id: string }>({
  columns,
  rows,
  caption,
  emptyMessage = 'Нет записей для отображения.',
}: {
  columns: DataTableColumn<T>[];
  rows: T[];
  caption: string;
  emptyMessage?: string;
}) {
  return <div className="data-table-wrap">
    <table className="data-table">
      <caption className="visually-hidden">{caption}</caption>
      <thead><tr>{columns.map(column => <th scope="col" key={column.key} className={column.className}>{column.header}</th>)}</tr></thead>
      <tbody>{rows.length ? rows.map(row => <tr key={row.id}>{columns.map(column => <td key={column.key} className={column.className}>{column.render(row)}</td>)}</tr>) : (
        <tr><td className="data-table__empty" colSpan={columns.length}>{emptyMessage}</td></tr>
      )}</tbody>
    </table>
  </div>;
}
