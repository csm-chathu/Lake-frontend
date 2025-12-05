const EntityTable = ({ columns, data, loading, onEdit, onDelete, emptyMessage = 'No items found.' }) => {
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
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-base-300 bg-base-100 shadow-sm">
      <div className="max-h-[520px] overflow-y-auto">
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
            {data.map((item) => {
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
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default EntityTable;
