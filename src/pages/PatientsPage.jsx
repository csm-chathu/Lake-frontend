import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import EntityForm from '../components/EntityForm.jsx';
import EntityTable from '../components/EntityTable.jsx';
import useEntityApi from '../hooks/useEntityApi.js';

const SPECIES_OPTIONS = [
  'Canine',
  'Feline',
  'Avian',
  'Reptile',
  'Equine',
  'Bovine',
  'Caprine',
  'Ovine',
  'Small mammal',
  'Other'
];

const BREED_SUGGESTIONS = {
  canine: ['Labrador Retriever', 'German Shepherd', 'Golden Retriever', 'Bulldog', 'Poodle', 'Beagle', 'Dachshund'],
  feline: ['Domestic Shorthair', 'Domestic Longhair', 'Siamese', 'Maine Coon', 'Persian', 'Bengal'],
  avian: ['Budgerigar', 'Cockatiel', 'African Grey Parrot', 'Lovebird', 'Macaw'],
  reptile: ['Bearded Dragon', 'Leopard Gecko', 'Ball Python', 'Corn Snake', 'Red-eared Slider'],
  equine: ['Thoroughbred', 'Quarter Horse', 'Arabian', 'Warmblood', 'Mustang'],
  bovine: ['Holstein', 'Jersey', 'Angus', 'Hereford'],
  caprine: ['Alpine', 'Boer', 'LaMancha', 'Nubian'],
  ovine: ['Merino', 'Suffolk', 'Dorper', 'Hampshire'],
  'small mammal': ['Rabbit', 'Guinea Pig', 'Ferret', 'Chinchilla']
};

const DEFAULT_BREEDS = ['Mixed breed', 'Unknown', 'Other'];

const emptyPatient = {
  name: '',
  passbookNumber: '',
  species: '',
  breed: '',
  age: '',
  ownerId: '',
  notes: ''
};

const PatientsPage = () => {
  const { items, loading, error, createItem, updateItem, deleteItem } = useEntityApi('patients');
  const {
    items: owners,
    loading: ownersLoading,
    error: ownersError,
    createItem: createOwner
  } = useEntityApi('owners');
  const [formState, setFormState] = useState(emptyPatient);
  const [editingId, setEditingId] = useState(null);
  const location = useLocation();
  const navigate = useNavigate();
  const prefillAppliedRef = useRef(false);
  const speciesDatalistId = 'patient-species-options';
  const breedDatalistId = 'patient-breed-options';
  const [showOwnerCreator, setShowOwnerCreator] = useState(false);
  const [newOwnerName, setNewOwnerName] = useState('');
  const [newOwnerPhone, setNewOwnerPhone] = useState('');
  const [creatingOwner, setCreatingOwner] = useState(false);
  const [ownerCreationError, setOwnerCreationError] = useState('');
  const [showPassbookModal, setShowPassbookModal] = useState(false);
  const [passbookData, setPassbookData] = useState(null);

  const ownerOptions = useMemo(
    () =>
      owners.map((owner) => ({
        label: owner.firstName || 'Unnamed owner',
        value: owner.id,
        phone: owner.phone || ''
      })),
    [owners]
  );

  useEffect(() => {
    const prefillName = location.state?.prefillPatientName;
    if (!prefillName || prefillAppliedRef.current) {
      return;
    }
    setFormState((prev) => {
      if (prev.name) {
        return prev;
      }
      return { ...prev, name: prefillName };
    });
    prefillAppliedRef.current = true;
  }, [location.state?.prefillPatientName]);

  const fields = useMemo(
    () => {
      const normalizedSpecies = formState.species ? formState.species.trim().toLowerCase() : '';
      const breedOptions = BREED_SUGGESTIONS[normalizedSpecies] || [];
      const breedSuggestions = [...breedOptions, ...DEFAULT_BREEDS].filter(
        (value, index, array) => array.indexOf(value) === index
      );

      const renderSuggestionButtons = (options, onSelect, activeValue) => (
        <div className="flex flex-wrap gap-2">
          {options.map((option) => {
            const isActive = activeValue?.toLowerCase() === option.toLowerCase();
            return (
              <button
                type="button"
                key={option}
                onClick={() => onSelect(option)}
                className={`btn btn-xs ${isActive ? 'btn-primary' : 'btn-outline border-base-300'}`}
              >
                {option}
              </button>
            );
          })}
        </div>
      );

      return [
        { name: 'name', label: 'Patient name', placeholder: 'Luna' },
        {
          name: 'passbookNumber',
          label: 'Passbook number',
          render: ({ value }) => (
            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-slate-600">Passbook number</span>
              <input
                type="text"
                value={value || 'Will be generated when saved'}
                disabled
                className="input input-bordered"
              />
              <span className="text-xs text-slate-500">Assigned automatically for patient passbooks.</span>
            </label>
          )
        },
      {
        name: 'species',
        label: 'Species',
        placeholder: 'Canine',
        render: ({ value, onChange, placeholder }) => {
          const currentValue = typeof value === 'string' ? value : '';
          return (
            <>
              <span className="text-sm font-medium text-slate-600">Species</span>
              <input
                type="text"
                value={currentValue}
                onChange={(event) => onChange(event.target.value)}
                placeholder={placeholder}
                className="input input-bordered"
                list={speciesDatalistId}
              />
              <datalist id={speciesDatalistId}>
                {SPECIES_OPTIONS.map((option) => (
                  <option key={option} value={option} />
                ))}
              </datalist>
              {renderSuggestionButtons(SPECIES_OPTIONS, onChange, currentValue)}
            </>
          );
        }
      },
      {
        name: 'breed',
        label: 'Breed',
        placeholder: 'Labrador',
        render: ({ value, onChange, placeholder }) => {
          const currentValue = typeof value === 'string' ? value : '';
          const hasSuggestions = breedSuggestions.length > 0;
          return (
            <>
              <span className="text-sm font-medium text-slate-600">Breed</span>
              <input
                type="text"
                value={currentValue}
                onChange={(event) => onChange(event.target.value)}
                placeholder={placeholder}
                className="input input-bordered"
                list={breedDatalistId}
              />
              <datalist id={breedDatalistId}>
                {breedSuggestions.map((option) => (
                  <option key={option} value={option} />
                ))}
              </datalist>
              {hasSuggestions && renderSuggestionButtons(breedSuggestions, onChange, currentValue)}
            </>
          );
        }
      },
      { name: 'age', label: 'Age', type: 'number', placeholder: '4' },
      {
        name: 'ownerId',
        label: 'Owner',
        render: ({ value, onChange }) => {
          const currentValue = value || '';
          const hasOwners = ownerOptions.length > 0;
          return (
            <>
              <span className="text-sm font-medium text-slate-600">Owner</span>
              <div className="flex flex-col gap-2">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <select
                    value={currentValue}
                    onChange={(event) => {
                      setOwnerCreationError('');
                      onChange(event.target.value);
                    }}
                    className="select select-bordered w-full sm:flex-1"
                  >
                    <option value="">
                      {hasOwners ? 'Select owner' : 'No owners yet'}
                    </option>
                    {ownerOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                        {option.phone ? ` • ${option.phone}` : ''}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline sm:w-auto"
                    onClick={() => {
                      setShowOwnerCreator(true);
                      setOwnerCreationError('');
                    }}
                  >
                    {showOwnerCreator ? 'Owner form open' : 'Add owner'}
                  </button>
                </div>
                {ownerCreationError && (
                  <p className="text-xs text-error">{ownerCreationError}</p>
                )}
                {showOwnerCreator && (
                  <div className="rounded-2xl border border-dashed border-base-300 bg-base-100 p-4 text-sm">
                    <div className="mb-3">
                      <p className="text-sm font-semibold text-slate-700">Quick add owner</p>
                      <p className="text-xs text-slate-500">Capture the owner name and phone without leaving this form.</p>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="flex flex-col gap-1">
                        <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Owner name</span>
                        <input
                          type="text"
                          value={newOwnerName}
                          onChange={(event) => setNewOwnerName(event.target.value)}
                          placeholder="E.g. Alex Fernando"
                          className="input input-bordered input-sm"
                          disabled={creatingOwner}
                        />
                      </label>
                      <label className="flex flex-col gap-1">
                        <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Telephone</span>
                        <input
                          type="tel"
                          value={newOwnerPhone}
                          onChange={(event) => setNewOwnerPhone(event.target.value)}
                          placeholder="E.g. 077-000-0000"
                          className="input input-bordered input-sm"
                          disabled={creatingOwner}
                        />
                      </label>
                    </div>
                    <div className="mt-4 flex flex-wrap justify-end gap-2">
                      <button
                        type="button"
                        className="btn btn-xs btn-ghost"
                        onClick={() => {
                          setShowOwnerCreator(false);
                          setNewOwnerName('');
                          setNewOwnerPhone('');
                          setOwnerCreationError('');
                        }}
                        disabled={creatingOwner}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        className="btn btn-xs btn-primary"
                        onClick={async () => {
                          const trimmedName = newOwnerName.trim();
                          if (!trimmedName) {
                            setOwnerCreationError('Owner name is required.');
                            return;
                          }
                          setCreatingOwner(true);
                          setOwnerCreationError('');
                          const payload = {
                            firstName: trimmedName,
                            phone: newOwnerPhone.trim()
                          };
                          const result = await createOwner(payload);
                          setCreatingOwner(false);
                          if (result.success) {
                            const createdOwner = result.data;
                            const ownerIdValue = createdOwner?.id ? String(createdOwner.id) : '';
                            onChange(ownerIdValue);
                            setShowOwnerCreator(false);
                            setNewOwnerName('');
                            setNewOwnerPhone('');
                            setOwnerCreationError('');
                          } else {
                            setOwnerCreationError(result.message || 'Unable to save owner.');
                          }
                        }}
                        disabled={creatingOwner}
                      >
                        {creatingOwner ? 'Saving…' : 'Save owner'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          );
        }
      },
      { name: 'notes', label: 'Notes', type: 'textarea', placeholder: 'Allergies, behavior, etc.' }
      ];
    },
    [
      ownerOptions,
      formState.species,
      showOwnerCreator,
      newOwnerName,
      newOwnerPhone,
      creatingOwner,
      ownerCreationError,
      createOwner
    ]
  );

  const columns = useMemo(
    () => [
      { header: 'Name', accessor: 'name' },
      {
        header: 'Passbook #',
        accessor: 'passbookNumber',
        render: (patient) => patient.passbookNumber || '—'
      },
      { header: 'Species', accessor: 'species' },
      { header: 'Breed', accessor: 'breed' },
      {
        header: 'Age',
        accessor: 'age',
        render: (patient) => (patient.age ? `${patient.age} yrs` : '—')
      },
      {
        header: 'Owner',
        accessor: 'owner',
        render: (patient) => (patient.owner?.firstName ? patient.owner.firstName : 'Unknown')
      },
      {
        header: 'Owner phone',
        accessor: 'ownerPhone',
        render: (patient) => patient.owner?.phone || '—'
      }
    ],
    []
  );

  const handleChange = (name, value) => {
    setFormState((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const payload = {
      name: formState.name,
      species: formState.species,
      breed: formState.breed,
      age: formState.age ? Number.parseInt(formState.age, 10) : null,
      ownerId: formState.ownerId ? Number(formState.ownerId) : null,
      notes: formState.notes
    };

    const action = editingId ? updateItem(editingId, payload) : createItem(payload);
    const result = await action;

    if (result.success) {
      const createdPatient = result.data;
      const isNewPatient = !editingId;

      setFormState(emptyPatient);
      setEditingId(null);

      if (isNewPatient) {
        // Show passbook modal for new patients
        setPassbookData({
          name: createdPatient.name,
          passbookNumber: createdPatient.passbookNumber,
          species: createdPatient.species,
          breed: createdPatient.breed,
          ownerId: createdPatient.ownerId
        });
        setShowPassbookModal(true);

        // If from appointments, navigate after modal is acknowledged
        if (location.state?.fromAppointments) {
          setTimeout(() => {
            navigate(location.state.returnTo || '/appointments', {
              replace: true,
              state: {
                selectedPatientId: createdPatient.id,
                selectedPatientName: createdPatient.name
              }
            });
          }, 2000);
        }
      }
    }
  };

  const handleEdit = (patient) => {
    setFormState({
      name: patient.name || '',
      passbookNumber: patient.passbookNumber || '',
      species: patient.species || '',
      breed: patient.breed || '',
      age: patient.age ?? '',
      ownerId: patient.owner?.id || '',
      notes: patient.notes || ''
    });
    setEditingId(patient.id);
  };

  const handleDelete = async (id) => {
    await deleteItem(id);
    if (editingId === id) {
      setEditingId(null);
      setFormState(emptyPatient);
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setFormState(emptyPatient);
  };

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold text-slate-800">Patients</h1>
        <p className="text-sm text-slate-500">Maintain accurate records for every companion under your care.</p>
      </div>
      {(error || ownersError) && (
        <div className="alert alert-error shadow-sm">
          <span>{error || ownersError}</span>
        </div>
      )}
      {ownersLoading && (
        <div className="rounded-2xl border border-dashed border-base-300 bg-base-100 p-4 text-sm text-slate-500">
          Loading owners…
        </div>
      )}

      {/* Passbook Modal */}
      {showPassbookModal && (
        <div className="modal modal-open">
          <div className="modal-box w-full max-w-sm">
            <h3 className="text-lg font-bold text-slate-800 mb-4">✓ Patient Registered Successfully!</h3>
            <div className="space-y-4">
              <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
                <p className="text-xs uppercase tracking-wide text-blue-600 font-semibold mb-2">Passbook Number</p>
                <div className="flex items-center justify-between gap-4">
                  <p className="text-2xl font-bold text-blue-800 font-mono">{passbookData?.passbookNumber}</p>
                  <button
                    type="button"
                    className="btn btn-sm btn-ghost"
                    onClick={() => {
                      navigator.clipboard.writeText(passbookData?.passbookNumber);
                    }}
                  >
                    Copy
                  </button>
                </div>
              </div>

              <div className="bg-base-100 rounded-lg p-4 space-y-2 text-sm">
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wide">Patient Name</p>
                  <p className="font-medium text-slate-800">{passbookData?.name}</p>
                </div>
                {passbookData?.species && (
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wide">Species</p>
                    <p className="font-medium text-slate-800">{passbookData?.species}</p>
                  </div>
                )}
                {passbookData?.breed && (
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wide">Breed</p>
                    <p className="font-medium text-slate-800">{passbookData?.breed}</p>
                  </div>
                )}
              </div>

              <p className="text-xs text-slate-600 bg-amber-50 border border-amber-200 rounded p-3">
                📖 <strong>Mark this passbook number in your physical record book to track this patient.</strong>
              </p>
            </div>

            <div className="modal-action mt-6">
              <button
                type="button"
                className="btn btn-primary w-full"
                onClick={() => {
                  setShowPassbookModal(false);
                  setPassbookData(null);
                }}
              >
                Done
              </button>
            </div>
          </div>
          <div className="modal-backdrop" onClick={() => {
            setShowPassbookModal(false);
            setPassbookData(null);
          }}></div>
        </div>
      )}

      <EntityForm
        title={editingId ? 'Update patient' : 'Register new patient'}
        fields={fields}
        values={formState}
        onChange={handleChange}
        onSubmit={handleSubmit}
        submitLabel={editingId ? 'Update patient' : 'Create patient'}
        isEditing={Boolean(editingId)}
        onCancel={resetForm}
      />
      <EntityTable
        columns={columns}
        data={items}
        loading={loading}
        onEdit={handleEdit}
        onDelete={handleDelete}
        emptyMessage="No patients recorded yet."
      />
    </section>
  );
};

export default PatientsPage;
