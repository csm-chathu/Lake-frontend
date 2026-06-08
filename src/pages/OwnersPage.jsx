import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Search, Users, Plus, X, Trash2, Pencil, Phone, NotebookPen } from 'lucide-react';
import EntityForm from '../components/EntityForm.jsx';
import EntityTable from '../components/EntityTable.jsx';
import useEntityApi from '../hooks/useEntityApi.js';

const AVATAR_COLORS = [
  'bg-blue-100 text-blue-700',
  'bg-violet-100 text-violet-700',
  'bg-emerald-100 text-emerald-700',
  'bg-amber-100 text-amber-700',
  'bg-rose-100 text-rose-700',
  'bg-cyan-100 text-cyan-700',
  'bg-orange-100 text-orange-700',
  'bg-pink-100 text-pink-700',
  'bg-indigo-100 text-indigo-700',
  'bg-teal-100 text-teal-700',
];

const getAvatarColor = (name) => {
  if (!name) return AVATAR_COLORS[0];
  const code = name.trim().toUpperCase().charCodeAt(0);
  return AVATAR_COLORS[code % AVATAR_COLORS.length];
};

const emptyOwner = {
  firstName: '',
  phone: '',
  notes: ''
};

const capitalizeFirstLetter = (string) => {
  if (typeof string !== 'string' || string.length === 0) {
    return string;
  }
  return string.charAt(0).toUpperCase() + string.slice(1);
};

const OwnersPage = () => {
  const { items, loading, error, createItem, updateItem, deleteItem } = useEntityApi('owners');
  const [searchQuery, setSearchQuery] = useState('');
  const [formState, setFormState] = useState(emptyOwner);
  const [editingId, setEditingId] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [deleteModal, setDeleteModal] = useState({ open: false, id: null, name: '' });

  const fields = useMemo(
    () => {
      return [
        {
          name: 'firstName',
          label: 'Owner name',
          placeholder: 'Alex Fernando',
          containerClass: 'md:col-span-1',
        },
        {
          name: 'phone',
          label: 'Phone (e.g. 0771234567)',
          placeholder: '0771234567 or +94771234567',
          pattern: '^(?:0|\\+94)(?:7\\d{8}|11\\d{7}|[1-9]\\d{8})$',
          containerClass: 'md:col-span-1',
        },
        {
          name: 'notes',
          label: 'Notes',
          type: 'textarea',
          placeholder: 'Preferred schedule, reminders, etc.',
          containerClass: 'md:col-span-2',
        }
      ];
    },
    []
  );

  const columns = useMemo(
    () => [
      {
        header: 'Owner',
        accessor: 'firstName',
        render: (owner) => (
          <div className="flex items-center gap-2.5">
            <div className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${getAvatarColor(owner.firstName)}`}>
              {(owner.firstName || '?').charAt(0).toUpperCase()}
            </div>
            <span className="font-medium text-slate-800">{owner.firstName || '—'}</span>
          </div>
        )
      },
      {
        header: 'Phone',
        accessor: 'phone',
        render: (owner) => owner.phone ? (
          <span className="inline-flex items-center gap-1.5 text-slate-700">
            <Phone size={13} className="text-slate-400" />
            {owner.phone}
          </span>
        ) : '—'
      },
      {
        header: 'Registered pets',
        accessor: 'patients',
        render: (owner) => {
          if (typeof owner.patientsCount === 'number') {
            return owner.patientsCount;
          }
          return owner.patients?.length ?? 0;
        }
      }
    ],
    []
  );

  const filteredItems = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) {
      return items;
    }

    return items.filter((owner) => {
      const ownerName = owner.firstName || '';
      const phone = owner.phone || '';
      const notes = owner.notes || '';
      return [ownerName, phone, notes].some((value) => value.toLowerCase().includes(query));
    });
  }, [items, searchQuery]);

  const handleChange = (name, value) => {
    setFormState((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (isSaving) {
      return;
    }
    const sanitizedPhone = formState.phone ? formState.phone.replace(/\s|-/g, '') : '';
    const sriLankaPattern = /^(?:0|\+94)(?:7\d{8}|11\d{7}|[1-9]\d{8})$/;
    if (sanitizedPhone && !sriLankaPattern.test(sanitizedPhone)) {
      alert('Enter a valid Sri Lankan phone number (e.g. 0771234567 or +94771234567).');
      return;
    }
    setIsSaving(true);
    const payload = { ...formState, phone: sanitizedPhone };

    try {
      const action = editingId ? updateItem(editingId, payload) : createItem(payload);
      const result = await action;

      if (result.success) {
        setFormState(emptyOwner);
        setEditingId(null);
        setShowEditModal(false);
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = (owner) => {
    setFormState({
      firstName: owner.firstName || '',
      phone: owner.phone || '',
      notes: owner.notes || ''
    });
    setEditingId(owner.id);
    setShowEditModal(true);
  };

  const requestDelete = (id) => {
    const owner = items.find((item) => item.id === id);
    setDeleteModal({
      open: true,
      id,
      name: owner?.firstName || 'this owner'
    });
  };

  const cancelDelete = () => {
    setDeleteModal({ open: false, id: null, name: '' });
  };

  const confirmDelete = async () => {
    if (!deleteModal.id) {
      return;
    }
    const id = deleteModal.id;
    setDeleteModal({ open: false, id: null, name: '' });
    const result = await deleteItem(id);
    if (!result.success && result.message) {
      // hook already surfaces the error
    }
    if (editingId === id) {
      setEditingId(null);
      setFormState(emptyOwner);
      setShowEditModal(false);
    }
  };

  const resetForm = () => {
    setFormState(emptyOwner);
    setEditingId(null);
    setShowEditModal(false);
  };

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-600">
            <Users size={22} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Owners</h1>
            <p className="text-sm text-slate-400">Keep emergency contacts and care preferences organized for every family.</p>
          </div>
        </div>
      </div>
      {error && (
        <div className="flex items-center gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <AlertTriangle size={16} className="shrink-0" />
          {error}
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="relative flex-1 min-w-[240px]">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search owners, phone, notes..."
              className="input input-bordered w-full pl-9 text-sm"
            />
          </div>
          <div className="flex items-center gap-2">
            {searchQuery && (
              <button
                type="button"
                className="inline-flex items-center gap-1.5 btn btn-sm btn-ghost text-slate-500"
                onClick={() => setSearchQuery('')}
              >
                <X size={14} /> Clear
              </button>
            )}
            <button
              type="button"
              className="inline-flex items-center gap-2 btn btn-sm rounded-xl bg-blue-600 text-white hover:bg-blue-700 border-blue-600"
              onClick={() => {
                setEditingId(null);
                setFormState(emptyOwner);
                setShowEditModal(true);
              }}
            >
              <Plus size={14} /> Add new owner
            </button>
          </div>
        </div>
      </div>

      <EntityTable
        columns={columns}
        data={filteredItems}
        loading={loading}
        loadingMessage="Loading owners..."
        onEdit={handleEdit}
        onDelete={requestDelete}
        emptyMessage="No owners recorded yet."
      />

      {showEditModal && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 px-4 backdrop-blur-sm">
          <div className="relative z-[10000] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-2xl max-h-[90vh]">
            <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-slate-100 bg-white px-6 py-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-blue-600">
                  {editingId ? <Pencil size={16} /> : <Plus size={16} />}
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-800">{editingId ? 'Update owner' : 'Add owner'}</h2>
                  <p className="text-xs text-slate-400">Manage contact details and care notes.</p>
                </div>
              </div>
              <button
                type="button"
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                onClick={resetForm}
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-6">
              <EntityForm
                fields={fields}
                values={formState}
                onChange={handleChange}
                onSubmit={handleSubmit}
                submitLabel={editingId ? 'Update owner' : 'Create owner'}
                isEditing={Boolean(editingId)}
                onCancel={resetForm}
                submitLoading={isSaving}
                className="grid grid-cols-1 md:grid-cols-2 gap-4"
                onClear={() => setFormState(emptyOwner)}
                clearLabel="Clear"
              />
            </div>
          </div>
        </div>
      , document.body)}

      {deleteModal.open && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center px-4 backdrop-blur-sm">
          <div className="absolute inset-0 bg-black/40" onClick={cancelDelete} />
          <div className="relative z-[10000] w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-rose-100 text-rose-600">
              <Trash2 size={22} />
            </div>
            <h3 className="mb-1 text-base font-bold text-slate-800">Delete owner?</h3>
            <p className="mb-5 text-sm text-slate-500">
              Are you sure you want to delete {deleteModal.name}? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <button type="button" className="inline-flex items-center gap-1.5 btn btn-sm btn-ghost rounded-xl" onClick={cancelDelete}>
                <X size={14} /> Cancel
              </button>
              <button type="button" className="inline-flex items-center gap-1.5 btn btn-sm rounded-xl bg-rose-600 text-white hover:bg-rose-700 border-rose-600" onClick={confirmDelete}>
                <Trash2 size={14} /> Delete
              </button>
            </div>
          </div>
        </div>
      , document.body)}
    </section>
  );
};

export default OwnersPage;
