import React, { useMemo, useState } from 'react';
import EntityTable from '../components/EntityTable.jsx';
import useEntityApi from '../hooks/useEntityApi.js';

const createEmptySupplier = () => ({
  name: '',
  contact_person: '',
  email: '',
  phone: '',
  address: '',
  notes: ''
});

const SuppliersPage = () => {
  const { items, loading, error, createItem, updateItem, deleteItem } = useEntityApi('suppliers');
  const [formState, setFormState] = useState(() => createEmptySupplier());
  const [editingId, setEditingId] = useState(null);
  const [formError, setFormError] = useState('');

  const columns = useMemo(
    () => [
      { header: 'Name', accessor: 'name' },
      {
        header: 'Contact Person',
        accessor: 'contact_person',
        render: (supplier) => supplier.contact_person || '—'
      },
      {
        header: 'Email',
        accessor: 'email',
        render: (supplier) => supplier.email || '—'
      },
      {
        header: 'Phone',
        accessor: 'phone',
        render: (supplier) => supplier.phone || '—'
      },
      {
        header: 'Address',
        accessor: 'address',
        render: (supplier) => supplier.address || '—'
      }
    ],
    []
  );

  const handleFieldChange = (field, value) => {
    setFormState((prev) => ({ ...prev, [field]: value }));
  };

  const resetForm = () => {
    setEditingId(null);
    setFormError('');
    setFormState(createEmptySupplier());
  };

  const validateForm = () => {
    const name = formState.name.trim();
    if (!name) {
      return 'Supplier name is required.';
    }
    return '';
  };

  const buildPayload = () => {
    return {
      name: formState.name.trim(),
      contact_person: formState.contact_person.trim() || null,
      email: formState.email.trim() || null,
      phone: formState.phone.trim() || null,
      address: formState.address.trim() || null,
      notes: formState.notes.trim() || null
    };
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setFormError('');

    const validationMessage = validateForm();
    if (validationMessage) {
      setFormError(validationMessage);
      return;
    }

    const payload = buildPayload();
    const action = editingId ? updateItem(editingId, payload) : createItem(payload);
    const result = await action;

    if (result.success) {
      resetForm();
    } else if (result.message) {
      setFormError(result.message);
    }
  };

  const handleEdit = (supplier) => {
    setEditingId(supplier.id);
    setFormError('');
    setFormState({
      name: supplier.name || '',
      contact_person: supplier.contact_person || '',
      email: supplier.email || '',
      phone: supplier.phone || '',
      address: supplier.address || '',
      notes: supplier.notes || ''
    });
  };

  const handleDelete = async (id) => {
    setFormError('');
    const result = await deleteItem(id);
    if (!result.success && result.message) {
      setFormError(result.message);
    }
    if (result.success && editingId === id) {
      resetForm();
    }
  };

  const submitLabel = editingId ? 'Update supplier' : 'Add supplier';

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold text-slate-800">Suppliers</h1>
        <p className="text-sm text-slate-500">
          Manage supplier contacts, track inventory sources, and maintain vendor relationships.
        </p>
      </div>

      <section className="rounded-2xl border border-base-300 bg-base-100 p-6 shadow-sm">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-semibold text-slate-800">
            {editingId ? 'Update supplier' : 'Create supplier'}
          </h2>
          {editingId && (
            <button type="button" className="btn btn-sm btn-ghost" onClick={resetForm}>
              Cancel edit
            </button>
          )}
        </div>

        {formError && (
          <div className="alert alert-error mb-4 shadow-sm">
            <span>{formError}</span>
          </div>
        )}

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="grid gap-4 lg:grid-cols-2">
            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-slate-600">Supplier name *</span>
              <input
                type="text"
                className="input input-sm input-bordered"
                value={formState.name}
                onChange={(event) => handleFieldChange('name', event.target.value)}
                placeholder="Company name"
                required
              />
            </label>
            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-slate-600">Contact person</span>
              <input
                type="text"
                className="input input-sm input-bordered"
                value={formState.contact_person}
                onChange={(event) => handleFieldChange('contact_person', event.target.value)}
                placeholder="Contact name"
              />
            </label>
            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-slate-600">Email</span>
              <input
                type="email"
                className="input input-sm input-bordered"
                value={formState.email}
                onChange={(event) => handleFieldChange('email', event.target.value)}
                placeholder="email@example.com"
              />
            </label>
            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-slate-600">Phone</span>
              <input
                type="tel"
                className="input input-sm input-bordered"
                value={formState.phone}
                onChange={(event) => handleFieldChange('phone', event.target.value)}
                placeholder="+1 234 567 8900"
              />
            </label>
            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-slate-600">Address</span>
              <textarea
                className="textarea textarea-sm textarea-bordered min-h-[70px]"
                value={formState.address}
                onChange={(event) => handleFieldChange('address', event.target.value)}
                placeholder="Full address"
              />
            </label>
            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-slate-600">Notes</span>
              <textarea
                className="textarea textarea-sm textarea-bordered min-h-[70px]"
                value={formState.notes}
                onChange={(event) => handleFieldChange('notes', event.target.value)}
                placeholder="Additional notes or comments"
              />
            </label>
          </div>

          <div className="flex justify-end">
            <button type="submit" className="btn btn-sm btn-primary px-5">
              {submitLabel}
            </button>
          </div>
        </form>
      </section>

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
        emptyMessage="No suppliers recorded yet."
      />
    </section>
  );
};

export default SuppliersPage;
