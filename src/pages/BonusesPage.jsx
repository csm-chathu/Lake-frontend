import React, { useMemo, useRef, useState } from 'react';
import EntityTable from '../components/EntityTable.jsx';
import useEntityApi from '../hooks/useEntityApi.js';

const createEmptyBonus = () => ({
  employee_id: '',
  bonus_date: '',
  amount: '',
  reason: '',
  notes: ''
});

const BonusesPage = () => {
  const employeesApi = useEntityApi('employees');
  const bonusApi = useEntityApi('employee-bonuses');

  const { items: employees } = employeesApi;
  const { items, loading, error, createItem, updateItem, deleteItem } = bonusApi;

  const [formState, setFormState] = useState(() => createEmptyBonus());
  const [editingId, setEditingId] = useState(null);
  const [formError, setFormError] = useState('');
  const modalRef = useRef(null);

  const openModal = () => modalRef.current?.showModal();

  const employeeLookup = useMemo(() => {
    const map = new Map();
    employees.forEach((employee) => map.set(Number(employee.id), employee));
    return map;
  }, [employees]);

  const columns = useMemo(
    () => [
      {
        header: 'Employee',
        accessor: 'employee',
        render: (item) => item.employee?.name || employeeLookup.get(Number(item.employee_id))?.name || '—'
      },
      { header: 'Date', accessor: 'bonus_date', render: (item) => item.bonus_date || '—' },
      { header: 'Amount', accessor: 'amount', render: (item) => Number(item.amount || 0).toLocaleString() },
      { header: 'Reason', accessor: 'reason', render: (item) => item.reason || '—' },
      { header: 'Notes', accessor: 'notes', render: (item) => item.notes || '—' }
    ],
    [employeeLookup]
  );

  const setField = (field, value) => setFormState((prev) => ({ ...prev, [field]: value }));

  const resetForm = () => {
    setEditingId(null);
    setFormError('');
    setFormState(createEmptyBonus());
    modalRef.current?.close();
  };

  const buildPayload = () => ({
    employee_id: Number(formState.employee_id),
    bonus_date: formState.bonus_date,
    amount: Number(formState.amount || 0),
    reason: formState.reason.trim() || null,
    notes: formState.notes.trim() || null
  });

  const handleSubmit = async (event) => {
    event.preventDefault();
    setFormError('');

    if (!formState.employee_id) {
      setFormError('Please select an employee.');
      return;
    }
    if (!formState.bonus_date) {
      setFormError('Please select bonus date.');
      return;
    }
    if (!(Number(formState.amount) > 0)) {
      setFormError('Bonus amount must be greater than zero.');
      return;
    }

    const payload = buildPayload();
    const result = editingId ? await updateItem(editingId, payload) : await createItem(payload);

    if (result.success) {
      resetForm();
      return;
    }

    setFormError(result.message || 'Unable to save bonus record.');
  };

  const handleEdit = (item) => {
    setEditingId(item.id);
    setFormError('');
    setFormState({
      employee_id: String(item.employee_id || item.employee?.id || ''),
      bonus_date: item.bonus_date || '',
      amount: String(item.amount ?? ''),
      reason: item.reason || '',
      notes: item.notes || ''
    });
    modalRef.current?.showModal();
  };

  const handleDelete = async (id) => {
    setFormError('');
    const result = await deleteItem(id);
    if (!result.success) {
      setFormError(result.message || 'Unable to delete bonus record.');
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
          <h1 className="text-3xl font-semibold text-slate-800">Bonuses</h1>
          <p className="text-sm text-slate-500 mt-1">Record and track special bonus payouts for employees.</p>
        </div>
        <button type="button" className="btn btn-primary btn-sm" onClick={openModal}>
          + Add bonus
        </button>
      </div>

      {/* ── Modal ─────────────────────────────────────────────── */}
      <dialog ref={modalRef} className="modal">
        <div className="modal-box max-w-lg w-full">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-slate-800">{editingId ? 'Update bonus' : 'Add bonus'}</h3>
            <button type="button" className="btn btn-sm btn-ghost btn-circle" onClick={resetForm}>✕</button>
          </div>

          {formError && (
            <div className="alert alert-error mb-4 shadow-sm text-sm">
              <span>{formError}</span>
            </div>
          )}

          <form className="grid gap-4 sm:grid-cols-2" onSubmit={handleSubmit}>
            <label className="flex flex-col gap-2 sm:col-span-2">
              <span className="text-sm font-medium text-slate-600">Employee *</span>
              <select className="select select-sm select-bordered" value={formState.employee_id} onChange={(e) => setField('employee_id', e.target.value)}>
                <option value="">Select employee</option>
                {employees.map((employee) => (
                  <option key={employee.id} value={employee.id}>{employee.name}</option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-slate-600">Bonus date *</span>
              <input type="date" className="input input-sm input-bordered" value={formState.bonus_date} onChange={(e) => setField('bonus_date', e.target.value)} />
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-slate-600">Amount *</span>
              <input type="number" min="0.01" step="0.01" className="input input-sm input-bordered" value={formState.amount} onChange={(e) => setField('amount', e.target.value)} />
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-slate-600">Reason</span>
              <input type="text" className="input input-sm input-bordered" value={formState.reason} onChange={(e) => setField('reason', e.target.value)} placeholder="Performance, festival, target..." />
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-slate-600">Notes</span>
              <textarea className="textarea textarea-sm textarea-bordered" value={formState.notes} onChange={(e) => setField('notes', e.target.value)} />
            </label>

            <div className="sm:col-span-2 flex justify-end gap-2 pt-2">
              <button type="button" className="btn btn-sm btn-ghost" onClick={resetForm}>Cancel</button>
              <button type="submit" className="btn btn-sm btn-primary px-5">{editingId ? 'Update bonus' : 'Save bonus'}</button>
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

      <EntityTable
        columns={columns}
        data={items}
        loading={loading}
        onEdit={handleEdit}
        onDelete={handleDelete}
        emptyMessage="No bonus records created yet."
      />
    </section>
  );
};

export default BonusesPage;
