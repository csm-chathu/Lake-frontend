import React, { useMemo, useState } from 'react';
import EntityForm from '../components/EntityForm.jsx';
import EntityTable from '../components/EntityTable.jsx';
import useEntityApi from '../hooks/useEntityApi.js';

const emptyOwner = {
  firstName: '',
  phone: '',
  notes: ''
};

const OwnersPage = () => {
  const { items, loading, error, createItem, updateItem, deleteItem } = useEntityApi('owners');
  const [formState, setFormState] = useState(emptyOwner);
  const [editingId, setEditingId] = useState(null);

  const fields = useMemo(
    () => [
      { name: 'firstName', label: 'Owner name', placeholder: 'Alex Fernando' },
      { name: 'phone', label: 'Phone', placeholder: '077-000-0000' },
      { name: 'notes', label: 'Notes', type: 'textarea', placeholder: 'Preferred schedule, reminders, etc.' }
    ],
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
        render: (owner) => owner.patients?.length ?? 0
      }
    ],
    []
  );

  const handleChange = (name, value) => {
    setFormState((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const payload = { ...formState };

    const action = editingId ? updateItem(editingId, payload) : createItem(payload);
    const result = await action;

    if (result.success) {
      setFormState(emptyOwner);
      setEditingId(null);
    }
  };

  const handleEdit = (owner) => {
    setFormState({
      firstName: owner.firstName || '',
      phone: owner.phone || '',
      notes: owner.notes || ''
    });
    setEditingId(owner.id);
  };

  const handleDelete = async (id) => {
    const result = await deleteItem(id);
    if (!result.success && result.message) {
      // Preserve message via error state already handled in hook
    }
    if (editingId === id) {
      setEditingId(null);
      setFormState(emptyOwner);
    }
  };

  const resetForm = () => {
    setFormState(emptyOwner);
    setEditingId(null);
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
      <EntityForm
        title={editingId ? 'Update owner' : 'Add owner'}
        fields={fields}
        values={formState}
        onChange={handleChange}
        onSubmit={handleSubmit}
        submitLabel={editingId ? 'Update owner' : 'Create owner'}
        isEditing={Boolean(editingId)}
        onCancel={resetForm}
      />
      <EntityTable
        columns={columns}
        data={items}
        loading={loading}
        onEdit={handleEdit}
        onDelete={handleDelete}
        emptyMessage="No owners recorded yet."
      />
    </section>
  );
};

export default OwnersPage;
