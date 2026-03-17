import React, { useMemo, useRef, useState } from 'react';
import useEntityApi from '../hooks/useEntityApi.js';

const MONTH_OPTIONS = [
  { value: '01', label: 'January' },
  { value: '02', label: 'February' },
  { value: '03', label: 'March' },
  { value: '04', label: 'April' },
  { value: '05', label: 'May' },
  { value: '06', label: 'June' },
  { value: '07', label: 'July' },
  { value: '08', label: 'August' },
  { value: '09', label: 'September' },
  { value: '10', label: 'October' },
  { value: '11', label: 'November' },
  { value: '12', label: 'December' },
];

const createEmptySalary = () => ({
  employee_id: '',
  salary_month: '',
  base_salary: '',
  bonus_amount: '0',
  deductions: '0',
  payment_date: '',
  payment_method: 'cash',
  notes: ''
});

const currencyFormatter = new Intl.NumberFormat('en-LK', { style: 'currency', currency: 'LKR' });

const getYearFromSalaryMonth = (salaryMonth) => {
  if (!salaryMonth) {
    return 'Unknown';
  }

  const date = new Date(salaryMonth);
  if (Number.isNaN(date.valueOf())) {
    const fallback = String(salaryMonth).slice(0, 4);
    return fallback || 'Unknown';
  }

  return String(date.getFullYear());
};

const getMonthLabel = (salaryMonth) => {
  if (!salaryMonth) {
    return '—';
  }

  const date = new Date(salaryMonth);
  if (Number.isNaN(date.valueOf())) {
    return String(salaryMonth).slice(0, 7) || '—';
  }

  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'long' });
};

const SalaryManagementPage = () => {
  const employeesApi = useEntityApi('employees');
  const salaryApi = useEntityApi('salary-payments');

  const { items: employees } = employeesApi;
  const { items, loading, error, createItem, updateItem, deleteItem } = salaryApi;

  const [formState, setFormState] = useState(() => createEmptySalary());
  const [editingId, setEditingId] = useState(null);
  const [formError, setFormError] = useState('');
  const [expandedEmployees, setExpandedEmployees] = useState({});
  const [expandedYears, setExpandedYears] = useState({});
  const [filterYear, setFilterYear] = useState('');
  const [filterMonth, setFilterMonth] = useState('');
  const modalRef = useRef(null);

  const availableYears = useMemo(() => {
    const years = new Set();
    items.forEach((item) => {
      const y = getYearFromSalaryMonth(item.salary_month);
      if (y !== 'Unknown') years.add(y);
    });
    return Array.from(years).sort((a, b) => Number(b) - Number(a));
  }, [items]);

  const filteredItems = useMemo(() => {
    if (!filterYear && !filterMonth) return items;
    return items.filter((item) => {
      const raw = item.salary_month || '';
      const [itemYear, itemMonth] = raw.slice(0, 7).split('-');
      if (filterYear && itemYear !== filterYear) return false;
      if (filterMonth && itemMonth !== filterMonth) return false;
      return true;
    });
  }, [items, filterYear, filterMonth]);

  const employeeLookup = useMemo(() => {
    const map = new Map();
    employees.forEach((employee) => map.set(Number(employee.id), employee));
    return map;
  }, [employees]);

  const groupedSalaries = useMemo(() => {
    const employeeMap = new Map();

    filteredItems.forEach((item) => {
      const employeeId = Number(item.employee_id || item.employee?.id || 0);
      const employeeName = item.employee?.name || employeeLookup.get(employeeId)?.name || 'Unknown employee';

      if (!employeeMap.has(employeeId)) {
        employeeMap.set(employeeId, {
          employeeId,
          employeeName,
          rows: []
        });
      }

      employeeMap.get(employeeId).rows.push(item);
    });

    const groupedByEmployee = Array.from(employeeMap.values())
      .sort((a, b) => a.employeeName.localeCompare(b.employeeName))
      .map((employeeGroup) => {
        const yearMap = new Map();

        employeeGroup.rows.forEach((row) => {
          const year = getYearFromSalaryMonth(row.salary_month);
          if (!yearMap.has(year)) {
            yearMap.set(year, []);
          }
          yearMap.get(year).push(row);
        });

        const years = Array.from(yearMap.entries())
          .map(([year, rows]) => {
            const sortedRows = [...rows].sort((a, b) => {
              const dateA = new Date(a.salary_month || 0).valueOf();
              const dateB = new Date(b.salary_month || 0).valueOf();
              if (dateA !== dateB) {
                return dateB - dateA;
              }
              return Number(b.id || 0) - Number(a.id || 0);
            });

            const yearNetTotal = sortedRows.reduce((sum, row) => sum + (Number(row.net_salary) || 0), 0);
            const yearBonusTotal = sortedRows.reduce((sum, row) => sum + (Number(row.bonus_amount) || 0), 0);

            return {
              year,
              rows: sortedRows,
              yearTotal: yearNetTotal,
              yearBonusTotal
            };
          })
          .sort((a, b) => Number(b.year) - Number(a.year));

        const employeeTotal = years.reduce((sum, yearGroup) => sum + yearGroup.yearTotal, 0);
        const employeeBonusTotal = years.reduce((sum, yearGroup) => sum + yearGroup.yearBonusTotal, 0);

        return {
          ...employeeGroup,
          years,
          employeeTotal,
          employeeBonusTotal
        };
      });

    return groupedByEmployee;
  }, [filteredItems, employeeLookup]);

  const toggleEmployeeExpand = (employeeId) => {
    setExpandedEmployees((prev) => ({
      ...prev,
      [employeeId]: !prev[employeeId]
    }));
  };

  const toggleYearExpand = (employeeId, year) => {
    const key = `${employeeId}-${year}`;
    setExpandedYears((prev) => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const setField = (field, value) => {
    setFormState((prev) => {
      const next = { ...prev, [field]: value };
      if (field === 'employee_id') {
        const selected = employeeLookup.get(Number(value));
        if (selected && (!prev.base_salary || Number(prev.base_salary) === 0)) {
          next.base_salary = String(selected.basic_salary ?? 0);
        }
      }
      return next;
    });
  };

  const resetForm = () => {
    setEditingId(null);
    setFormError('');
    setFormState(createEmptySalary());
    modalRef.current?.close();
  };

  const openModal = () => modalRef.current?.showModal();

  const buildPayload = () => ({
    employee_id: Number(formState.employee_id),
    salary_month: formState.salary_month ? `${formState.salary_month}-01` : null,
    base_salary: Number(formState.base_salary || 0),
    bonus_amount: Number(formState.bonus_amount || 0),
    deductions: Number(formState.deductions || 0),
    payment_date: formState.payment_date || null,
    payment_method: formState.payment_method || null,
    notes: formState.notes.trim() || null
  });

  const handleSubmit = async (event) => {
    event.preventDefault();
    setFormError('');

    if (!formState.employee_id) {
      setFormError('Please select an employee.');
      return;
    }

    if (!formState.salary_month) {
      setFormError('Please select salary month.');
      return;
    }

    const payload = buildPayload();
    const result = editingId ? await updateItem(editingId, payload) : await createItem(payload);

    if (result.success) {
      resetForm();
      return;
    }

    setFormError(result.message || 'Unable to save salary record.');
  };

  const handleEdit = (item) => {
    setEditingId(item.id);
    setFormError('');
    setFormState({
      employee_id: String(item.employee_id || item.employee?.id || ''),
      salary_month: (item.salary_month || '').slice(0, 7),
      base_salary: String(item.base_salary ?? ''),
      bonus_amount: String(item.bonus_amount ?? 0),
      deductions: String(item.deductions ?? 0),
      payment_date: item.payment_date || '',
      payment_method: item.payment_method || 'cash',
      notes: item.notes || ''
    });
    modalRef.current?.showModal();
  };

  const handleDelete = async (id) => {
    setFormError('');
    const result = await deleteItem(id);
    if (!result.success) {
      setFormError(result.message || 'Unable to delete salary record.');
      return;
    }
    if (editingId === id) {
      resetForm();
    }
  };

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold text-slate-800">Salary Management</h1>
          <p className="text-sm text-slate-500 mt-1">Track monthly salary payments, deductions, and net payout.</p>
        </div>
        <button type="button" className="btn btn-primary btn-sm" onClick={openModal}>
          + Add salary payment
        </button>
      </div>

      {/* ── Modal ───────────────────────────────────────────── */}
      <dialog ref={modalRef} className="modal">
        <div className="modal-box max-w-2xl w-full">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-slate-800">{editingId ? 'Update salary' : 'Add salary payment'}</h3>
            <button type="button" className="btn btn-sm btn-ghost btn-circle" onClick={resetForm}>✕</button>
          </div>

          {formError && (
            <div className="alert alert-error mb-4 shadow-sm text-sm">
              <span>{formError}</span>
            </div>
          )}

          <form className="grid gap-4 sm:grid-cols-2" onSubmit={handleSubmit}>
            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-slate-600">Employee *</span>
              <select className="select select-sm select-bordered" value={formState.employee_id} onChange={(e) => setField('employee_id', e.target.value)}>
                <option value="">Select employee</option>
                {employees.map((employee) => (
                  <option key={employee.id} value={employee.id}>{employee.name}</option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-slate-600">Salary month *</span>
              <input type="month" className="input input-sm input-bordered" value={formState.salary_month} onChange={(e) => setField('salary_month', e.target.value)} />
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-slate-600">Payment date</span>
              <input type="date" className="input input-sm input-bordered" value={formState.payment_date} onChange={(e) => setField('payment_date', e.target.value)} />
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-slate-600">Payment method</span>
              <select className="select select-sm select-bordered" value={formState.payment_method} onChange={(e) => setField('payment_method', e.target.value)}>
                <option value="cash">Cash</option>
                <option value="bank">Bank</option>
                <option value="cheque">Cheque</option>
                <option value="other">Other</option>
              </select>
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-slate-600">Base salary</span>
              <input type="number" min="0" step="0.01" className="input input-sm input-bordered" value={formState.base_salary} onChange={(e) => setField('base_salary', e.target.value)} />
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-slate-600">Bonus</span>
              <input type="number" min="0" step="0.01" className="input input-sm input-bordered" value={formState.bonus_amount} onChange={(e) => setField('bonus_amount', e.target.value)} />
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-slate-600">Deductions</span>
              <input type="number" min="0" step="0.01" className="input input-sm input-bordered" value={formState.deductions} onChange={(e) => setField('deductions', e.target.value)} />
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-slate-600">Notes</span>
              <textarea className="textarea textarea-sm textarea-bordered" value={formState.notes} onChange={(e) => setField('notes', e.target.value)} />
            </label>

            <div className="sm:col-span-2 flex justify-end gap-2 pt-2">
              <button type="button" className="btn btn-sm btn-ghost" onClick={resetForm}>Cancel</button>
              <button type="submit" className="btn btn-sm btn-primary px-5">{editingId ? 'Update salary' : 'Save payment'}</button>
            </div>
          </form>
        </div>
        <form method="dialog" className="modal-backdrop">
          <button onClick={resetForm}>close</button>
        </form>
      </dialog>

      {error && (
        <div className="alert alert-error shadow-sm">
          <span>{error}</span>
        </div>
      )}

      {/* ── Filter bar ───────────────────────────────────────── */}
      <section className="rounded-2xl border border-base-300 bg-base-100 p-4 shadow-sm">
        <div className="flex flex-wrap items-end gap-4">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-slate-500">Year</span>
            <select
              className="select select-sm select-bordered w-32"
              value={filterYear}
              onChange={(e) => setFilterYear(e.target.value)}
            >
              <option value="">All years</option>
              {availableYears.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-slate-500">Month</span>
            <select
              className="select select-sm select-bordered w-36"
              value={filterMonth}
              onChange={(e) => setFilterMonth(e.target.value)}
            >
              <option value="">All months</option>
              {MONTH_OPTIONS.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </label>

          {(filterYear || filterMonth) && (
            <button
              type="button"
              className="btn btn-sm btn-ghost self-end"
              onClick={() => { setFilterYear(''); setFilterMonth(''); }}
            >
              Clear filter
            </button>
          )}

          {/* Summary totals across filtered items */}
          {filteredItems.length > 0 && (
            <div className="ml-auto flex gap-6 text-right">
              <div>
                <p className="text-xs text-slate-500">Total net paid</p>
                <p className="text-sm font-bold text-emerald-600">
                  {currencyFormatter.format(filteredItems.reduce((s, r) => s + (Number(r.net_salary) || 0), 0))}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Total bonus</p>
                <p className="text-sm font-bold text-indigo-600">
                  {currencyFormatter.format(filteredItems.reduce((s, r) => s + (Number(r.bonus_amount) || 0), 0))}
                </p>
              </div>
            </div>
          )}
        </div>
      </section>

      {loading ? (
        <div className="rounded-2xl border border-base-300 bg-base-100 p-6 text-center text-slate-500 shadow-sm">
          Loading salary records…
        </div>
      ) : groupedSalaries.length === 0 ? (
        <div className="rounded-2xl border border-base-300 bg-base-100 p-6 text-center text-slate-500 shadow-sm">
          No salary records created yet.
        </div>
      ) : (
        <div className="space-y-3">
          {groupedSalaries.map((employeeGroup) => {
            const isEmployeeExpanded = expandedEmployees[employeeGroup.employeeId] ?? true;

            return (
              <section key={`emp-${employeeGroup.employeeId}`} className="rounded-2xl border border-base-300 bg-base-100 shadow-sm overflow-hidden">
                <button
                  type="button"
                  className="w-full flex items-center justify-between px-4 py-3 text-left bg-base-200/60 hover:bg-base-200"
                  onClick={() => toggleEmployeeExpand(employeeGroup.employeeId)}
                >
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{employeeGroup.employeeName}</p>
                    <p className="text-xs text-slate-500">
                      {employeeGroup.rows.length} record(s)
                    </p>
                  </div>
                  <div className="flex items-center gap-6 text-right">
                    <div>
                      <p className="text-xs text-slate-400">Net paid</p>
                      <p className="text-sm font-bold text-emerald-600">{currencyFormatter.format(employeeGroup.employeeTotal)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400">Bonus</p>
                      <p className="text-sm font-bold text-indigo-600">{currencyFormatter.format(employeeGroup.employeeBonusTotal)}</p>
                    </div>
                    <span className="text-sm text-slate-600">{isEmployeeExpanded ? '▾' : '▸'}</span>
                  </div>
                </button>

                {isEmployeeExpanded && (
                  <div className="p-3 space-y-3">
                    {employeeGroup.years.map((yearGroup) => {
                      const yearKey = `${employeeGroup.employeeId}-${yearGroup.year}`;
                      const isYearExpanded = expandedYears[yearKey] ?? true;

                      return (
                        <div key={yearKey} className="rounded-xl border border-base-300 overflow-hidden">
                          <button
                            type="button"
                            className="w-full flex items-center justify-between px-3 py-2 text-left bg-base-100 hover:bg-base-200/60"
                            onClick={() => toggleYearExpand(employeeGroup.employeeId, yearGroup.year)}
                          >
                            <div>
                              <p className="text-sm font-semibold text-slate-700">{yearGroup.year}</p>
                              <p className="text-xs text-slate-500">{yearGroup.rows.length} month(s)</p>
                            </div>
                            <div className="flex items-center gap-4 text-right">
                              <div>
                                <p className="text-xs text-slate-400">Net paid</p>
                                <p className="text-sm font-semibold text-emerald-600">{currencyFormatter.format(yearGroup.yearTotal)}</p>
                              </div>
                              <div>
                                <p className="text-xs text-slate-400">Bonus</p>
                                <p className="text-sm font-semibold text-indigo-600">{currencyFormatter.format(yearGroup.yearBonusTotal)}</p>
                              </div>
                              <span className="text-sm text-slate-600">{isYearExpanded ? '▾' : '▸'}</span>
                            </div>
                          </button>

                          {isYearExpanded && (
                            <div className="overflow-x-auto">
                              <table className="table table-sm w-full">
                                <thead>
                                  <tr>
                                    <th>Month</th>
                                    <th className="text-right">Base</th>
                                    <th className="text-right">Bonus</th>
                                    <th className="text-right">Deductions</th>
                                    <th className="text-right">Net</th>
                                    <th>Paid Date</th>
                                    <th>Method</th>
                                    <th className="text-right">Actions</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {yearGroup.rows.map((row) => (
                                    <tr key={row.id} className="hover:bg-base-200/60">
                                      <td>{getMonthLabel(row.salary_month)}</td>
                                      <td className="text-right">{currencyFormatter.format(Number(row.base_salary || 0))}</td>
                                      <td className="text-right">{currencyFormatter.format(Number(row.bonus_amount || 0))}</td>
                                      <td className="text-right">{currencyFormatter.format(Number(row.deductions || 0))}</td>
                                      <td className="text-right font-semibold">{currencyFormatter.format(Number(row.net_salary || 0))}</td>
                                      <td>{row.payment_date || '—'}</td>
                                      <td>{row.payment_method || '—'}</td>
                                      <td className="text-right whitespace-nowrap">
                                        <button
                                          type="button"
                                          className="btn btn-xs btn-outline btn-primary mr-2"
                                          onClick={() => handleEdit(row)}
                                        >
                                          Edit
                                        </button>
                                        <button
                                          type="button"
                                          className="btn btn-xs btn-outline btn-error"
                                          onClick={() => handleDelete(row.id)}
                                        >
                                          Delete
                                        </button>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
    </section>
  );
};

export default SalaryManagementPage;
