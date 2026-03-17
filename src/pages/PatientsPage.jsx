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
  gender: '',
  species: '',
  breed: '',
  age: '',
  ageYears: '',
  ageMonths: '',
  weight: '',
  ownerId: '',
  notes: ''
};

const PatientsPage = () => {
  const { items, loading, error, createItem, updateItem, deleteItem, setParams, call: callPatients } = useEntityApi('patients');
  const [searchQuery, setSearchQuery] = useState('');
  const searchDebounceRef = useRef(null);
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
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

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
    // fetch next passbook preview on mount
    (async () => {
      try {
        const resp = await callPatients('get', '/next-passbook');
        if (resp.success && resp.data) {
          setFormState((prev) => ({ ...prev, passbookNumber: resp.data.passbookNumber || '' }));
        }
      } catch (e) {
        // ignore preview failures
      }
    })();

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

  // update search params with debounce
  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      setParams({ q: searchQuery || undefined });
    }, 300);
    return () => clearTimeout(searchDebounceRef.current);
  }, [searchQuery, setParams]);

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
          name: 'gender',
          label: 'Gender',
          render: ({ value, onChange }) => (
            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium text-slate-600">Gender</span>
              <div className="flex items-center gap-4">
                {['male', 'female', 'unknown'].map((option) => (
                  <label key={option} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="gender"
                      value={option}
                      checked={value === option}
                      onChange={(e) => onChange(e.target.value)}
                      className="radio radio-sm"
                    />
                    <span className="capitalize text-sm">{option}</span>
                  </label>
                ))}
              </div>
            </div>
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
      {
        name: 'age',
        label: 'Age',
        render: ({ value, onChange }) => {
          const years = formState.ageYears ?? '';
          const months = formState.ageMonths ?? '';
          return (
            <div className="grid grid-cols-2 gap-2">
              <label className="flex flex-col">
                <span className="text-sm font-medium text-slate-600">Years</span>
                  <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={years}
                  onChange={(e) => {
                    const v = e.target.value.replace(/[^0-9]/g, '');
                    setFormState((prev) => ({ ...prev, ageYears: v }));
                  }}
                  placeholder="Years"
                  className="input input-bordered relative z-30"
                />
              </label>
              <label className="flex flex-col">
                <span className="text-sm font-medium text-slate-600">Months</span>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={months}
                  onChange={(e) => {
                    const v = e.target.value.replace(/[^0-9]/g, '');
                    const nv = v === '' ? '' : String(Math.max(0, Math.min(11, Number(v))));
                    setFormState((prev) => ({ ...prev, ageMonths: nv }));
                  }}
                  placeholder="Months"
                  className="input input-bordered relative z-30"
                />
              </label>
            </div>
          );
        }
      },
      {
        name: 'weight',
        label: 'Weight (kg)',
        render: ({ value, onChange }) => (
          <label className="form-control w-full">
            <span className="label-text text-xs font-semibold uppercase tracking-wide text-slate-600">Weight (kg)</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={value || ''}
              onChange={(e) => onChange(e.target.value)}
              className="input input-bordered"
              placeholder="0.0"
            />
          </label>
        )
      },
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
      formState.ageYears,
      formState.ageMonths,
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
      { header: 'Gender', accessor: 'gender', render: (patient) => patient.gender || '—' },
      {
        header: 'Age',
        accessor: 'age',
        render: (patient) => {
          const y = patient.ageYears ?? patient.age;
          const m = patient.ageMonths ?? null;
          if (y == null && (m == null || m === 0)) return '—';
          const parts = [];
          if (y != null && y !== '') parts.push(`${y} yr${Number(y) !== 1 ? 's' : ''}`);
          if (m != null && m !== '' && Number(m) > 0) parts.push(`${m} mo${Number(m) !== 1 ? 's' : ''}`);
          return parts.join(' ');
        }
      },
      { header: 'Weight', accessor: 'weight', render: (patient) => patient.weight != null ? `${patient.weight} kg` : '—' },
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
    if (isSaving) {
      return;
    }
    setIsSaving(true);
    // refresh passbook preview immediately before submitting so user can mark it
    try {
      const preview = await callPatients('get', '/next-passbook');
      if (preview && preview.success && preview.data?.passbookNumber) {
        setFormState((prev) => ({ ...prev, passbookNumber: preview.data.passbookNumber }));
      }
    } catch (e) {
      // ignore preview failure
    }
    const payload = {
      name: formState.name,
      gender: formState.gender || null,
      species: formState.species,
      breed: formState.breed,
      // send explicit years/months if provided
      ageYears: formState.ageYears !== '' && formState.ageYears != null ? Number.parseInt(formState.ageYears, 10) : (formState.age !== '' && formState.age != null ? Number.parseInt(formState.age, 10) : null),
      ageMonths: formState.ageMonths !== '' && formState.ageMonths != null ? Number.parseInt(formState.ageMonths, 10) : null,
      weight: formState.weight !== '' && formState.weight != null ? Number(formState.weight) : null,
      ownerId: formState.ownerId ? Number(formState.ownerId) : null,
      notes: formState.notes
    };

    const action = editingId ? updateItem(editingId, payload) : createItem(payload);
    try {
      const result = await action;

      if (result.success) {
        const createdPatient = result.data;
        const isNewPatient = !editingId;

        setFormState(emptyPatient);
        setEditingId(null);
        setShowEditModal(false);

        if (isNewPatient) {
          // Show passbook modal for new patients
          setPassbookData({
            name: createdPatient.name,
            gender: createdPatient.gender,
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
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = (patient) => {
    setFormState({
      name: patient.name || '',
      passbookNumber: patient.passbookNumber || '',
      gender: patient.gender || '',
      species: patient.species || '',
      breed: patient.breed || '',
      age: patient.age ?? '',
      ageYears: patient.ageYears ?? (patient.age ?? ''),
      ageMonths: patient.ageMonths ?? null,
      weight: patient.weight != null ? String(patient.weight) : '',
      ownerId: patient.owner?.id || '',
      notes: patient.notes || ''
    });
    setEditingId(patient.id);
    setShowEditModal(true);
  };

  const handleDelete = (id) => {
    // open confirmation modal
    setDeleteTargetId(id);
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    if (!deleteTargetId) return;
    const id = deleteTargetId;
    setShowDeleteConfirm(false);
    setDeleteTargetId(null);
    await deleteItem(id);
    if (editingId === id) {
      setEditingId(null);
      setFormState(emptyPatient);
      setShowEditModal(false);
    }
  };

  const cancelDelete = () => {
    setShowDeleteConfirm(false);
    setDeleteTargetId(null);
  };

  const resetForm = () => {
    setEditingId(null);
    setFormState(emptyPatient);
    setShowEditModal(false);
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
                {passbookData?.gender && (
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wide">Gender</p>
                    <p className="font-medium text-slate-800 capitalize">{passbookData?.gender}</p>
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
          <div className="modal-backdrop fixed inset-0 p-0 m-0 z-50" onClick={() => {
            setShowPassbookModal(false);
            setPassbookData(null);
          }}></div>
        </div>
      )}

      {/* Delete confirmation modal */}
      {showDeleteConfirm && (
        <div className="modal modal-open" >
          <div className="modal-box w-full max-w-sm">
            <h3 className="text-lg font-bold text-slate-800 mb-2">Confirm deletion</h3>
            <p className="text-sm text-slate-600">Are you sure you want to delete this patient? This action cannot be undone.</p>
            <div className="modal-action mt-6 flex gap-2">
              <button type="button" className="btn btn-ghost" onClick={cancelDelete}>Cancel</button>
              <button type="button" className="btn btn-error" onClick={confirmDelete}>Delete</button>
            </div>
          </div>
          <div className="modal-backdrop fixed inset-0 p-0 m-0 z-50" onClick={cancelDelete}></div>
        </div>
      )}

      {/* Edit Patient Modal */}
      {showEditModal && (
        <div className="modal modal-open" style={{ marginTop: '0px' }}>
          <div className="modal-box w-full max-w-5xl max-h-[90vh] overflow-y-auto">
            <button
              type="button"
              className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2"
              onClick={resetForm}
            >
              ✕
            </button>
            <div className="mb-4 flex items-start justify-between gap-4 pr-10">
              <h3 className="text-lg font-bold text-slate-800">{editingId ? 'Edit patient' : 'Register new patient'}</h3>
              <div className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-1 text-right">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-sky-700">Passbook</p>
                <p className="font-mono text-sm font-bold text-sky-900">{formState.passbookNumber || 'Pending'}</p>
              </div>
            </div>
            <EntityForm
              fields={fields}
              values={formState}
              onChange={handleChange}
              onSubmit={handleSubmit}
              submitLabel={editingId ? 'Update patient' : 'Create patient'}
              isEditing={Boolean(editingId)}
              onCancel={resetForm}
              submitLoading={isSaving}
              showCancel={true}
            />
          </div>
          <form method="dialog" className="modal-backdrop" onClick={resetForm}></form>
        </div>
      )}

      <div className="flex items-center justify-between gap-4">
        <button
          type="button"
          className="btn btn-sm btn-primary"
          onClick={() => {
            setEditingId(null);
            setFormState(emptyPatient);
            setShowEditModal(true);
          }}
        >
          + Add new patient
        </button>
        <div>
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search patients, passbook, owner..."
            className="input input-sm input-bordered w-full max-w-md"
          />
        </div>
      </div>

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
