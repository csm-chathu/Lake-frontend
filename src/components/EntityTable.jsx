import React from 'react';

const EntityTable = ({
  columns,
  data,
  loading,
  onEdit,
  onDelete,
  emptyMessage = 'No items found.',
  bodyMaxHeightClass = 'max-h-[520px]',
  enableSearch = true,
  searchPlaceholder = 'Search...'
}) => {
  const [searchTerm, setSearchTerm] = React.useState('');

  const filteredData = React.useMemo(() => {
    if (!enableSearch) {
      return data;
    }

    const normalizedSearch = searchTerm.trim().toLowerCase();
    if (!normalizedSearch) {
      return data;
    }

    return data.filter((item) => {
      return columns.some((column) => {
        const rawValue = item[column.accessor];

        if (typeof rawValue === 'string' || typeof rawValue === 'number') {
          return String(rawValue).toLowerCase().includes(normalizedSearch);
        }

        if (Array.isArray(rawValue)) {
          return rawValue.some((entry) => {
            if (typeof entry === 'string' || typeof entry === 'number') {
              return String(entry).toLowerCase().includes(normalizedSearch);
            }

            if (entry && typeof entry === 'object') {
              return Object.values(entry).some((fieldValue) => {
                if (typeof fieldValue === 'string' || typeof fieldValue === 'number') {
                  return String(fieldValue).toLowerCase().includes(normalizedSearch);
                }
                return false;
              });
            }

            return false;
          });
        }

        return false;
      });
    });
  }, [columns, data, enableSearch, searchTerm]);

  if (loading) {
    return (
      <div className="rounded-2xl border border-base-300 bg-base-100 p-6 text-center text-slate-500 shadow-sm">
        Loading…
      </div>
    );
  }

  if (!loading && data.length === 0) {
    return (
      <div className="rounded-2xl border border-base-300 bg-base-100 p-6 text-center text-slate-500 shadow-sm">
        <div className="mb-2 text-2xl" aria-hidden>📭</div>
        <div>{emptyMessage}</div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-base-300 bg-base-100 shadow-sm">
      {enableSearch && (
        <div className="border-b border-base-300 p-3">
          <input
            type="text"
            className="input input-bordered input-sm w-full max-w-sm"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder={searchPlaceholder}
          />
        </div>
      )}
      <div className={`${bodyMaxHeightClass} overflow-y-auto`}>
        <table className="table table-lg w-full">
          <thead className="sticky top-0 z-10 bg-base-200/90 backdrop-blur">
            <tr>
              {columns.map((column) => (
                <th key={column.accessor || column.header} className="text-xs font-semibold uppercase tracking-wider text-slate-600">
                  {column.header}
                </th>
              ))}
              {(onEdit || onDelete) && (
                <th className="text-right text-xs font-semibold uppercase tracking-wider text-slate-600">Actions</th>
              )}
            </tr>
          </thead>
          <tbody>
            {filteredData.map((item) => {
              const rowClass = item.isWalkIn
                ? 'bg-warning/10 hover:bg-warning/20'
                : 'hover:bg-base-200/60';
              return (
                <tr key={item.id} className={rowClass}>
                  {columns.map((column) => (
                    <td key={column.accessor || column.header} className="align-top text-sm text-slate-700">
                      {column.render ? column.render(item) : item[column.accessor] ?? '—'}
                    </td>
                  ))}
                  {(onEdit || onDelete) && (
                    <td className="whitespace-nowrap text-right">
                      {onEdit && (
                        <button
                          type="button"
                          className="btn btn-xs btn-outline btn-primary mr-2"
                          onClick={() => onEdit(item)}
                        >
                          Edit
                        </button>
                      )}
                      {onDelete && (
                        <button
                          type="button"
                          className="btn btn-xs btn-outline btn-error"
                          onClick={() => onDelete(item.id)}
                        >
                          Delete
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
            {!loading && filteredData.length === 0 && (
              <tr>
                <td colSpan={columns.length + ((onEdit || onDelete) ? 1 : 0)} className="py-8 text-center text-sm text-slate-500">
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-xl" aria-hidden>🔎</span>
                    <span>No matching records found.</span>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default EntityTable;
