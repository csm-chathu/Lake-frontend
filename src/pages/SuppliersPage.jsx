import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Building2, Mail, Phone, Plus, Search, Truck, UserRound, X } from 'lucide-react';
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
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
  const [formError, setFormError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const columns = useMemo(
    () => [
      { header: 'Name', accessor: 'name' },
      {
        header: 'Contact Person',
        accessor: 'contact_person',
        render: (supplier) => (
          <div className="inline-flex items-center gap-2 text-slate-600">
            <UserRound size={14} className="text-slate-400" />
            <span>{supplier.contact_person || '—'}</span>
          </div>
        )
      },
      {
        header: 'Email',
        accessor: 'email',
        render: (supplier) => (
          <div className="inline-flex items-center gap-2 text-slate-600">
            <Mail size={14} className="text-slate-400" />
            <span>{supplier.email || '—'}</span>
          </div>
        )
      },
      {
        header: 'Phone',
        accessor: 'phone',
        render: (supplier) => (
          <div className="inline-flex items-center gap-2 text-slate-600">
            <Phone size={14} className="text-slate-400" />
            <span>{supplier.phone || '—'}</span>
          </div>
        )
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

  const openCreateModal = () => {
    resetForm();
    setIsSupplierModalOpen(true);
  };

  const closeSupplierModal = () => {
    setIsSupplierModalOpen(false);
    resetForm();
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
      closeSupplierModal();
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
    setIsSupplierModalOpen(true);
  };

  const handleDelete = async (id) => {
    setFormError('');
    const result = await deleteItem(id);
    if (!result.success && result.message) {
      setFormError(result.message);
    }
    if (result.success && editingId === id) {
      closeSupplierModal();
    }
  };

  const submitLabel = editingId ? 'Update supplier' : 'Add supplier';
  const normalizedQuery = searchTerm.trim().toLowerCase();
  const filteredItems = useMemo(() => {
    if (!normalizedQuery) {
      return items;
    }

    return items.filter((supplier) => {
      const haystack = [
        supplier.name,
        supplier.contact_person,
        supplier.email,
        supplier.phone,
        supplier.address,
        supplier.notes
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [items, normalizedQuery]);

  return (
    <section className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-600">
          <Truck size={22} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Suppliers</h1>
          <p className="text-sm text-slate-400">
            Manage supplier contacts, track inventory sources, and maintain vendor relationships.
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-end gap-3">
          <label className="relative min-w-[240px] flex-1">
            <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-400">Search suppliers</span>
            <Search size={15} className="pointer-events-none absolute left-3 top-[33px] text-slate-400" />
            <input
              type="search"
              className="input input-bordered w-full pl-9 text-sm"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search by name, contact, phone, or address"
            />
          </label>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 btn btn-sm btn-ghost rounded-xl"
            onClick={() => setSearchTerm('')}
            disabled={!searchTerm}
          >
            <X size={14} /> Clear
          </button>
          <button type="button" className="inline-flex items-center gap-2 btn btn-sm btn-primary rounded-xl" onClick={openCreateModal}>
            <Plus size={14} /> Add supplier
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <AlertTriangle size={16} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <EntityTable
        columns={columns}
        data={filteredItems}
        loading={loading}
        loadingMessage="Loading suppliers..."
        onEdit={handleEdit}
        onDelete={handleDelete}
        emptyMessage={normalizedQuery ? 'No suppliers match your search.' : 'No suppliers recorded yet.'}
      />

      {isSupplierModalOpen && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center px-4 backdrop-blur-sm">
          <div className="absolute inset-0 bg-black/50" onClick={closeSupplierModal} />
          <div className="relative z-[10000] w-full max-w-3xl rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 bg-slate-50 px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-blue-600">
                  <Building2 size={18} />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-800">{editingId ? 'Update supplier' : 'Create supplier'}</h2>
                  <p className="text-xs text-slate-400">Store contact and billing details for procurement records.</p>
                </div>
              </div>
              <button
                type="button"
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                onClick={closeSupplierModal}
              >
                <X size={16} />
              </button>
            </div>

            <form className="space-y-4 p-6" onSubmit={handleSubmit}>
              {formError && (
                <div className="mb-1 flex items-center gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  <AlertTriangle size={16} className="shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

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

              <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
                <button type="button" className="inline-flex items-center gap-1.5 btn btn-sm btn-ghost rounded-xl" onClick={closeSupplierModal}>
                  <X size={14} /> Cancel
                </button>
                <button type="submit" className="inline-flex items-center gap-2 btn btn-sm btn-primary px-5 rounded-xl">
                  <Building2 size={14} />
                  {submitLabel}
                </button>
              </div>
            </form>
          </div>
        </div>
      , document.body)}
    </section>
  );
};

export default SuppliersPage;
