import { useEffect, useMemo, useState } from 'react';
import EntityForm from '../components/EntityForm.jsx';
import EntityTable from '../components/EntityTable.jsx';
import useEntityApi from '../hooks/useEntityApi.js';

const emptyVeterinarian = {
  firstName: '',
  lastName: '',
  specialty: '',
  email: '',
  phone: '',
  bio: ''
};

const VeterinariansPage = () => {
  const { items, loading, error, createItem, updateItem, deleteItem } = useEntityApi('veterinarians');
  const [formState, setFormState] = useState(emptyVeterinarian);
  const [editingId, setEditingId] = useState(null);

  const fields = useMemo(
    () => [
      { name: 'firstName', label: 'First name', placeholder: 'Jordan' },
      { name: 'lastName', label: 'Last name', placeholder: 'Parker' },
      { name: 'specialty', label: 'Specialty', placeholder: 'Surgery' },
      { name: 'email', label: 'Email', type: 'email', placeholder: 'jordan@example.com' },
      { name: 'phone', label: 'Phone', placeholder: '555-123-4567' },
      { name: 'bio', label: 'Bio', type: 'textarea', placeholder: 'Years of experience, focus areas...' }
    ],
    []
  );

  const columns = useMemo(
    () => [
      {
        header: 'Name',
        accessor: 'firstName',
        render: (vet) => `${vet.firstName} ${vet.lastName}`.trim()
      },
      { header: 'Specialty', accessor: 'specialty' },
      { header: 'Email', accessor: 'email' },
      { header: 'Phone', accessor: 'phone' }
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
      setFormState(emptyVeterinarian);
      setEditingId(null);
    }
  };

  const handleEdit = (vet) => {
    setFormState({
      firstName: vet.firstName || '',
      lastName: vet.lastName || '',
      specialty: vet.specialty || '',
      email: vet.email || '',
      phone: vet.phone || '',
      bio: vet.bio || ''
    });
    setEditingId(vet.id);
  };

  const handleDelete = async (id) => {
    await deleteItem(id);
    if (editingId === id) {
      setEditingId(null);
      setFormState(emptyVeterinarian);
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setFormState(emptyVeterinarian);
  };

  useEffect(() => {
    if (!editingId && items.length === 1) {
      const vet = items[0];
      setFormState({
        firstName: vet.firstName || '',
        lastName: vet.lastName || '',
        specialty: vet.specialty || '',
        email: vet.email || '',
        phone: vet.phone || '',
        bio: vet.bio || ''
      });
      setEditingId(vet.id);
    }
  }, [editingId, items]);

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold text-slate-800">Veterinarian</h1>
        <p className="text-sm text-slate-500">Keep your lead clinician&apos;s details up to date for quick reference.</p>
      </div>
      {error && (
        <div className="alert alert-error shadow-sm">
          <span>{error}</span>
        </div>
      )}
      <EntityForm
        title={editingId ? 'Update veterinarian' : 'Add team member'}
        fields={fields}
        values={formState}
        onChange={handleChange}
        onSubmit={handleSubmit}
        submitLabel={editingId ? 'Update vet' : 'Create vet'}
        isEditing={Boolean(editingId)}
        onCancel={resetForm}
      />
      <div className="rounded-2xl border border-base-300 bg-base-100 p-5 text-sm text-slate-600 shadow-sm">
        This clinic operates with a single veterinarian. Update the record above if contact details change.
      </div>
      <EntityTable
        columns={columns}
        data={items}
        loading={loading}
        onEdit={handleEdit}
        onDelete={handleDelete}
        emptyMessage="No veterinarians recorded yet."
      />
    </section>
  );
};

export default VeterinariansPage;
