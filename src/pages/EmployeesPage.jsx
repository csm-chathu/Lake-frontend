import React, { useMemo, useRef, useState } from 'react';
import EntityTable from '../components/EntityTable.jsx';
import useEntityApi from '../hooks/useEntityApi.js';

const createEmptyEmployee = () => ({
  name: '',
  role: '',
  phone: '',
  email: '',
  basic_salary: '',
  status: 'active',
  join_date: '',
  notes: ''
});

const EmployeesPage = () => {
  const { items, loading, error, createItem, updateItem, deleteItem } = useEntityApi('employees');
  const [formState, setFormState] = useState(() => createEmptyEmployee());
  const [editingId, setEditingId] = useState(null);
  const [formError, setFormError] = useState('');
  const modalRef = useRef(null);

  const openModal = () => modalRef.current?.showModal();

  const columns = useMemo(
    () => [
      { header: 'Name', accessor: 'name' },
      { header: 'Role', accessor: 'role', render: (item) => item.role || '—' },
      { header: 'Phone', accessor: 'phone', render: (item) => item.phone || '—' },
      { header: 'Status', accessor: 'status', render: (item) => item.status || 'active' },
      { header: 'Basic Salary', accessor: 'basic_salary', render: (item) => Number(item.basic_salary || 0).toLocaleString() },
      { header: 'Join Date', accessor: 'join_date', render: (item) => item.join_date || '—' }
    ],
    []
  );

  const setField = (field, value) => setFormState((prev) => ({ ...prev, [field]: value }));

  const resetForm = () => {
    setEditingId(null);
    setFormError('');
    setFormState(createEmptyEmployee());
    modalRef.current?.close();
  };

  const buildPayload = () => ({
    name: formState.name.trim(),
    role: formState.role.trim() || null,
    phone: formState.phone.trim() || null,
    email: formState.email.trim() || null,
    basic_salary: Number(formState.basic_salary || 0),
    status: formState.status || 'active',
    join_date: formState.join_date || null,
    notes: formState.notes.trim() || null
  });

  const handleSubmit = async (event) => {
    event.preventDefault();
    setFormError('');

    if (!formState.name.trim()) {
      setFormError('Employee name is required.');
      return;
    }

    const payload = buildPayload();
    const result = editingId ? await updateItem(editingId, payload) : await createItem(payload);

    if (result.success) {
      resetForm();
      return;
    }

    setFormError(result.message || 'Unable to save employee.');
  };

  const handleEdit = (item) => {
    setEditingId(item.id);
    setFormError('');
    setFormState({
      name: item.name || '',
      role: item.role || '',
      phone: item.phone || '',
      email: item.email || '',
      basic_salary: String(item.basic_salary ?? ''),
      status: item.status || 'active',
      join_date: item.join_date || '',
      notes: item.notes || ''
    });
    modalRef.current?.showModal();
  };

  const handleDelete = async (id) => {
    setFormError('');
    const result = await deleteItem(id);
    if (!result.success) {
      setFormError(result.message || 'Unable to delete employee.');
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
          <h1 className="text-3xl font-semibold text-slate-800">Employees</h1>
          <p className="text-sm text-slate-500 mt-1">Create and maintain employee records with base salary details.</p>
        </div>
        <button type="button" className="btn btn-primary btn-sm" onClick={openModal}>
          + Add employee
        </button>
      </div>

      {/* ── Modal ─────────────────────────────────────────────── */}
      <dialog ref={modalRef} className="modal">
        <div className="modal-box max-w-xl w-full">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-slate-800">{editingId ? 'Update employee' : 'Add employee'}</h3>
            <button type="button" className="btn btn-sm btn-ghost btn-circle" onClick={resetForm}>✕</button>
          </div>

          {formError && (
            <div className="alert alert-error mb-4 shadow-sm text-sm">
              <span>{formError}</span>
            </div>
          )}

          <form className="grid gap-4 sm:grid-cols-2" onSubmit={handleSubmit}>
            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-slate-600">Employee name *</span>
              <input type="text" className="input input-sm input-bordered" value={formState.name} onChange={(e) => setField('name', e.target.value)} required />
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-slate-600">Role</span>
              <input type="text" className="input input-sm input-bordered" value={formState.role} onChange={(e) => setField('role', e.target.value)} placeholder="Cashier, Assistant..." />
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-slate-600">Phone</span>
              <input type="text" className="input input-sm input-bordered" value={formState.phone} onChange={(e) => setField('phone', e.target.value)} />
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-slate-600">Email</span>
              <input type="email" className="input input-sm input-bordered" value={formState.email} onChange={(e) => setField('email', e.target.value)} />
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-slate-600">Basic salary</span>
              <input type="number" min="0" step="0.01" className="input input-sm input-bordered" value={formState.basic_salary} onChange={(e) => setField('basic_salary', e.target.value)} />
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-slate-600">Status</span>
              <select className="select select-sm select-bordered" value={formState.status} onChange={(e) => setField('status', e.target.value)}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-slate-600">Join date</span>
              <input type="date" className="input input-sm input-bordered" value={formState.join_date} onChange={(e) => setField('join_date', e.target.value)} />
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-slate-600">Notes</span>
              <textarea className="textarea textarea-sm textarea-bordered" value={formState.notes} onChange={(e) => setField('notes', e.target.value)} />
            </label>

            <div className="sm:col-span-2 flex justify-end gap-2 pt-2">
              <button type="button" className="btn btn-sm btn-ghost" onClick={resetForm}>Cancel</button>
              <button type="submit" className="btn btn-sm btn-primary px-5">{editingId ? 'Update employee' : 'Save employee'}</button>
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
        emptyMessage="No employees created yet."
      />
    </section>
  );
};

export default EmployeesPage;
