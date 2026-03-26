import React, { useMemo, useState } from 'react';
import EntityForm from '../components/EntityForm.jsx';
import EntityTable from '../components/EntityTable.jsx';
import useEntityApi from '../hooks/useEntityApi.js';

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
        render: (owner) => owner.firstName || '—'
      },
      { header: 'Phone', accessor: 'phone', render: (owner) => owner.phone || '—' },
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
        <h1 className="text-3xl font-semibold text-slate-800">Owners</h1>
        <p className="text-sm text-slate-500">Keep emergency contacts and care preferences organised for every family.</p>
      </div>
      {error && (
        <div className="alert alert-error shadow-sm">
          <span>{error}</span>
        </div>
      )}
      <div className="flex items-center justify-between gap-4">
        <button
          type="button"
          className="btn btn-sm btn-primary"
          onClick={() => {
            setEditingId(null);
            setFormState(emptyOwner);
            setShowEditModal(true);
          }}
        >
          + Add new owner
        </button>
        <div>
          <input
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search owners, phone, notes..."
            className="input input-sm input-bordered w-full max-w-md"
          />
        </div>
      </div>

      {showEditModal && (
        <div className="modal modal-open" style={{marginTop:'0'}}>
          <div className="modal-box w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <button
              type="button"
              className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2"
              onClick={resetForm}
            >
              ✕
            </button>
            <h3 className="text-lg font-bold text-slate-800 mb-4">{editingId ? 'Update owner' : 'Add owner'}</h3>
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
          <form method="dialog" className="modal-backdrop" onClick={resetForm}></form>
        </div>
      )}
      <EntityTable
        columns={columns}
        data={filteredItems}
        loading={loading}
        onEdit={handleEdit}
        onDelete={requestDelete}
        emptyMessage="No owners recorded yet."
      />

      {deleteModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/40" onClick={cancelDelete} />
          <div className="relative z-10 w-full max-w-sm rounded-xl bg-white p-6 shadow-lg">
            <h3 className="text-lg font-semibold text-slate-800 mb-2">Confirm deletion</h3>
            <p className="text-sm text-slate-600">
              Are you sure you want to delete {deleteModal.name}? This action cannot be undone.
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" className="btn btn-ghost" onClick={cancelDelete}>Cancel</button>
              <button type="button" className="btn btn-error" onClick={confirmDelete}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default OwnersPage;
