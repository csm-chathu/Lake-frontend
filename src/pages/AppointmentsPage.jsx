import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import AppointmentMedicineSelector, { calculateMedicinesTotal } from '../components/AppointmentMedicineSelector.jsx';
import EntityForm from '../components/EntityForm.jsx';
import PatientSearch from '../components/PatientSearch.jsx';
import useEntityApi from '../hooks/useEntityApi.js';

const statusOptions = [
  { label: 'Scheduled', value: 'scheduled' },
  { label: 'Completed', value: 'completed' },
  { label: 'Cancelled', value: 'cancelled' }
];

const paymentTypeOptions = [
  { label: 'Cash (collected now)', value: 'cash' },
  { label: 'Credit (settle later)', value: 'credit' }
];

const paymentStatusOptions = [
  { label: 'Pending', value: 'pending' },
  { label: 'Paid', value: 'paid' }
];

const currencyFormatter = new Intl.NumberFormat('en-LK', { style: 'currency', currency: 'LKR' });

const formatDateTimeLocal = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return '';
  const offset = date.getTimezoneOffset();
  const localDate = new Date(date.valueOf() - offset * 60000);
  return localDate.toISOString().slice(0, 16);
};

const getCurrentDateTimeLocal = () => formatDateTimeLocal(new Date());

const createEmptyAppointment = () => ({
  date: getCurrentDateTimeLocal(),
  reason: '',
  status: 'completed',
  patientId: '',
  veterinarianId: '',
  isWalkIn: 'true',
  doctorCharge: '600',
  discount: '0',
  paymentType: 'cash',
  paymentStatus: 'paid',
  settledAt: '',
  notes: '',
  medicines: []
});

const mapPrescriptionToRows = (medicines) => {
  if (!Array.isArray(medicines)) {
    return [];
  }

  return medicines.map((item) => ({
    medicineBrandId: item.brand?.id ? String(item.brand.id) : '',
    quantity: item.quantity ? String(item.quantity) : '1',
    label: [item.brand?.medicine?.name, item.brand?.name].filter(Boolean).join(' — '),
    query: [item.brand?.medicine?.name, item.brand?.name].filter(Boolean).join(' — ')
  }));
};

const AppointmentsPage = () => {
  const appointmentApi = useEntityApi('appointments');
  const patientsApi = useEntityApi('patients');
  const vetsApi = useEntityApi('veterinarians');
  const medicinesApi = useEntityApi('medicines');
  const navigate = useNavigate();
  const location = useLocation();

  const { items, error, createItem, updateItem } = appointmentApi;
  const { items: patients, refresh: refreshPatients, loading: patientsLoading } = patientsApi;
  const { items: veterinarians } = vetsApi;
  const {
    items: medicines,
    loading: medicinesLoading,
    error: medicinesError
  } = medicinesApi;

  const [formState, setFormState] = useState(() => createEmptyAppointment());
  const [editingId, setEditingId] = useState(null);
  const [patientSearchQuery, setPatientSearchQuery] = useState('');
  const selectedPatientId = formState.patientId;
  const selectedPatient = useMemo(
    () => patients.find((patient) => String(patient.id) === String(selectedPatientId)),
    [patients, selectedPatientId]
  );

  const reasonSuggestions = useMemo(() => {
    const tally = new Map();

    items.forEach(({ reason }) => {
      const label = typeof reason === 'string' ? reason.trim() : '';
      if (!label) return;
      const key = label.toLowerCase();
      const existing = tally.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        tally.set(key, { label, count: 1 });
      }
    });

    return [...tally.values()]
      .sort((a, b) => {
        if (b.count !== a.count) return b.count - a.count;
        return a.label.localeCompare(b.label);
      })
      .map((entry) => entry.label)
      .slice(0, 8);
  }, [items]);

  const veterinarianOptions = useMemo(
    () =>
      veterinarians.map((vet) => ({
        label: `${vet.firstName} ${vet.lastName}`.trim(),
        value: String(vet.id)
      })),
    [veterinarians]
  );

  const brandOptions = useMemo(() => {
    const options = [];
    medicines.forEach((medicine) => {
      if (!Array.isArray(medicine.brands)) {
        return;
      }
      medicine.brands.forEach((brand) => {
        options.push({
          value: String(brand.id),
          label: `${medicine.name} — ${brand.name}`,
          price: Number(brand.price) || 0,
          medicineName: medicine.name,
          brandName: brand.name
        });
      });
    });
    return options.sort((a, b) => a.label.localeCompare(b.label));
  }, [medicines]);

  const brandLookup = useMemo(
    () => new Map(brandOptions.map((option) => [option.value, option])),
    [brandOptions]
  );

  const lastMedicinesLookup = useMemo(() => {
    const map = new Map();

    items.forEach((appointment) => {
      const reason = typeof appointment.reason === 'string' ? appointment.reason.trim() : '';
      if (!reason) {
        return;
      }
      if (!Array.isArray(appointment.medicines) || appointment.medicines.length === 0) {
        return;
      }

      const normalizedReason = reason.toLowerCase();
      const dateValue = new Date(appointment.date).valueOf() || 0;
      const current = map.get(normalizedReason);

      if (!current || dateValue > current.dateValue) {
        map.set(normalizedReason, {
          dateValue,
          appointment,
          medicines: mapPrescriptionToRows(appointment.medicines)
        });
      }
    });

    return map;
  }, [items]);

  const normalizedReason = formState.reason ? formState.reason.trim().toLowerCase() : '';

  const lastPrescription = useMemo(() => {
    if (!normalizedReason) {
      return null;
    }

    return lastMedicinesLookup.get(normalizedReason) || null;
  }, [lastMedicinesLookup, normalizedReason]);

  const medicinesTotal = useMemo(
    () => calculateMedicinesTotal(formState.medicines || [], brandLookup),
    [formState.medicines, brandLookup]
  );

  const doctorChargeValue = useMemo(() => {
    const parsed = Number.parseFloat(formState.doctorCharge);
    return Number.isNaN(parsed) ? 0 : parsed;
  }, [formState.doctorCharge]);

  const discountValue = useMemo(() => {
    const parsed = Number.parseFloat(formState.discount);
    return Number.isNaN(parsed) ? 0 : parsed;
  }, [formState.discount]);

  const totalChargeEstimate = useMemo(
    () => {
      const gross = doctorChargeValue + medicinesTotal;
      return Number(Math.max(gross - discountValue, 0).toFixed(2));
    },
    [doctorChargeValue, medicinesTotal, discountValue]
  );

  const handlePatientSelect = useCallback((patient) => {
    if (!patient) {
      setFormState((prev) => ({ ...prev, patientId: '' }));
      setPatientSearchQuery('');
      return;
    }

    setFormState((prev) => ({ ...prev, patientId: String(patient.id) }));
    setPatientSearchQuery(patient.name || '');
  }, []);

  const handleCreatePatient = useCallback(() => {
    navigate('/patients', {
      state: {
        fromAppointments: true,
        returnTo: location.pathname,
        prefillPatientName: patientSearchQuery
      }
    });
  }, [location.pathname, navigate, patientSearchQuery]);

  const fields = useMemo(() => {
    const isCredit = formState.paymentType === 'credit';
    const showSettledAt = isCredit && formState.paymentStatus === 'paid';

    const list = [
      {
        name: 'patientId',
        render: () => (
          <PatientSearch
            query={patientSearchQuery}
            onQueryChange={setPatientSearchQuery}
            patients={patients}
            onSelectPatient={handlePatientSelect}
            onCreatePatient={handleCreatePatient}
            selectedPatient={selectedPatient}
          />
        ),
        fullWidth: true
      },
      {
        name: 'date',
        label: 'Appointment time',
        render: ({ label, value, onChange }) => {
          const currentValue = typeof value === 'string' ? value : '';

          return (
            <>
              <span className="text-sm font-medium text-slate-600">{label}</span>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <input
                  type="datetime-local"
                  value={currentValue}
                  onChange={(event) => onChange(event.target.value)}
                  className="input input-bordered w-full sm:flex-1"
                />
                <button
                  type="button"
                  className="btn btn-sm btn-outline sm:w-auto"
                  onClick={() => onChange(getCurrentDateTimeLocal())}
                >
                  Use current time
                </button>
              </div>
            </>
          );
        },
        fullWidth: true
      },
      {
        name: 'reason',
        label: 'Reason',
        placeholder: 'Annual wellness exam',
        render: ({ label, value, onChange, placeholder: reasonPlaceholder }) => {
          const currentValue = typeof value === 'string' ? value : '';
          const normalizedValue = currentValue.toLowerCase();

          return (
            <>
              <span className="text-sm font-medium text-slate-600">{label || 'Reason'}</span>
              <input
                type="text"
                value={currentValue}
                onChange={(event) => onChange(event.target.value)}
                placeholder={reasonPlaceholder}
                className="input input-bordered"
              />
              {reasonSuggestions.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {reasonSuggestions.map((suggestion) => {
                    const isActive = suggestion.toLowerCase() === normalizedValue;
                    return (
                      <button
                        type="button"
                        key={suggestion}
                        onClick={() => onChange(suggestion)}
                        className={`btn btn-xs ${isActive ? 'btn-primary' : 'btn-outline border-base-300'}`}
                      >
                        {suggestion}
                      </button>
                    );
                  })}
                </div>
              )}
              {lastPrescription?.medicines?.length > 0 && (
                <div className="mt-3 rounded-xl border border-base-200 bg-base-100 p-3 text-xs text-slate-600">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="font-semibold text-slate-700">Previous medicines for this reason</span>
                    <span className="text-[11px] uppercase tracking-wide text-slate-400">
                      {lastPrescription.appointment?.date
                        ? new Date(lastPrescription.appointment.date).toLocaleDateString()
                        : 'Recent visit'}
                    </span>
                  </div>
                  <ul className="space-y-1">
                    {lastPrescription.medicines.map((medicine, index) => {
                      const entry = brandLookup.get(String(medicine.medicineBrandId));
                      const labelText = medicine.label || entry?.label || 'Medicine';
                      return (
                        <li key={`${medicine.medicineBrandId || 'medicine'}-${index}`} className="flex justify-between gap-3">
                          <span className="flex-1 text-slate-700">{labelText}</span>
                          <span className="text-slate-500">Qty {medicine.quantity}</span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </>
          );
        },
        fullWidth: true
      },
      {
        name: 'doctorCharge',
        label: 'Doctor charge',
        type: 'number',
        placeholder: '75.00',
        step: '0.01',
        min: 0,
        inputMode: 'decimal'
      },
      {
        name: 'discount',
        label: 'Discount',
        type: 'number',
        placeholder: '0.00',
        step: '0.01',
        min: 0,
        inputMode: 'decimal'
      },
      {
        name: 'paymentType',
        label: 'Payment method',
        type: 'select',
        options: paymentTypeOptions
      }
    ];

    if (isCredit) {
      list.push({
        name: 'paymentStatus',
        label: 'Credit status',
        type: 'select',
        options: paymentStatusOptions
      });
    }

    if (showSettledAt) {
      list.push({
        name: 'settledAt',
        fullWidth: false,
        render: ({ value, onChange }) => {
          const currentValue = typeof value === 'string' ? value : '';
          return (
            <>
              <span className="text-sm font-medium text-slate-600">Settled on</span>
              <input
                type="datetime-local"
                value={currentValue}
                onChange={(event) => onChange(event.target.value)}
                className="input input-bordered"
              />
              <span className="text-xs text-slate-500">Adjust if the credit was settled earlier.</span>
            </>
          );
        }
      });
    }

    list.push(
      {
        name: 'status',
        label: 'Status',
        type: 'select',
        options: statusOptions
      },
      {
        name: 'isWalkIn',
        label: 'Visit type',
        type: 'select',
        options: [
          { label: 'Scheduled visit', value: 'false' },
          { label: 'Walk-in patient', value: 'true' }
        ],
        placeholder: 'Select visit type'
      },
      {
        name: 'veterinarianId',
        label: 'Veterinarian',
        type: 'select',
        options: veterinarianOptions,
        placeholder: 'Select veterinarian',
        disabled: veterinarianOptions.length <= 1
      },
      {
        name: 'medicines',
        render: ({ value, onChange }) => (
          <AppointmentMedicineSelector
            value={value}
            onChange={onChange}
            brandOptions={brandOptions}
            brandLookup={brandLookup}
            loading={medicinesLoading}
          />
        ),
        fullWidth: true
      },
      {
        name: '__chargesSummary',
        render: () => (
          <div className="rounded-xl border border-base-200 bg-base-100 p-4 text-sm text-slate-600">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="font-medium text-slate-700">Charges overview</p>
              <span className="text-xs text-slate-500">Totals update as you adjust medicines or doctor fee.</span>
            </div>
            <dl className="grid grid-cols-2 gap-x-8 gap-y-1">
              <dt>Doctor charge</dt>
              <dd className="text-right font-medium text-slate-700">{currencyFormatter.format(doctorChargeValue)}</dd>
              <dt>Medicines subtotal</dt>
              <dd className="text-right font-medium text-slate-700">{currencyFormatter.format(medicinesTotal)}</dd>
              <dt>Discount</dt>
              <dd className="text-right font-medium text-slate-700">
                {discountValue > 0
                  ? `- ${currencyFormatter.format(discountValue)}`
                  : '—'}
              </dd>
              <dt className="pt-2 text-slate-700">Estimated total</dt>
              <dd className="pt-2 text-right text-base font-semibold text-slate-800">
                {currencyFormatter.format(totalChargeEstimate)}
              </dd>
            </dl>
            {formState.paymentType === 'credit' && formState.paymentStatus !== 'paid' && (
              <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs text-amber-700">
                Mark this credit visit as paid once the balance is settled.
              </p>
            )}
          </div>
        ),
        fullWidth: true
      },
      { name: 'notes', label: 'Notes', type: 'textarea', placeholder: 'Reminder details, prep steps, etc.' }
    );

    return list;
  }, [
    brandLookup,
    brandOptions,
    doctorChargeValue,
    discountValue,
    formState.paymentStatus,
    formState.paymentType,
    handleCreatePatient,
    handlePatientSelect,
    lastPrescription,
    medicinesLoading,
    medicinesTotal,
    patientSearchQuery,
    patients,
    reasonSuggestions,
    selectedPatient,
    totalChargeEstimate,
    veterinarianOptions
  ]);

  const handleChange = (name, value) => {
    setFormState((prev) => {
      if (name === 'paymentType') {
        if (value === prev.paymentType) {
          return prev;
        }

        if (value === 'credit') {
          const nextStatus = prev.paymentStatus && prev.paymentStatus !== '' ? prev.paymentStatus : 'pending';
          return {
            ...prev,
            paymentType: 'credit',
            paymentStatus: nextStatus === 'paid' && prev.paymentType !== 'credit' ? 'pending' : nextStatus || 'pending',
            settledAt: prev.paymentType === 'credit' ? prev.settledAt : ''
          };
        }

        return {
          ...prev,
          paymentType: 'cash',
          paymentStatus: 'paid',
          settledAt: ''
        };
      }

      if (name === 'paymentStatus') {
        if (value === prev.paymentStatus) {
          return prev;
        }

        if (value === 'paid') {
          const nextSettled = prev.settledAt && prev.settledAt !== '' ? prev.settledAt : formatDateTimeLocal(new Date());
          return {
            ...prev,
            paymentStatus: 'paid',
            settledAt: nextSettled
          };
        }

        return {
          ...prev,
          paymentStatus: 'pending',
          settledAt: ''
        };
      }

      if (name === 'settledAt') {
        return {
          ...prev,
          settledAt: value
        };
      }

      return { ...prev, [name]: value };
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const parsedCharge = Number.parseFloat(formState.doctorCharge);
    const parsedDiscount = Number.parseFloat(formState.discount);
    const medicinesState = Array.isArray(formState.medicines) ? formState.medicines : [];
    const medicinesPayload = medicinesState
      .map((entry) => ({
        medicineBrandId: Number(entry.medicineBrandId),
        quantity: Number.parseInt(entry.quantity, 10) || 0
      }))
      .filter((entry) => entry.medicineBrandId && entry.quantity > 0);

    const payload = {
      date: formState.date ? new Date(formState.date) : null,
      reason: formState.reason,
      status: formState.status,
      patientId: formState.patientId ? Number(formState.patientId) : null,
      veterinarianId: formState.veterinarianId ? Number(formState.veterinarianId) : null,
      isWalkIn: formState.isWalkIn === 'true',
      doctorCharge: Number.isNaN(parsedCharge) ? 0 : parsedCharge,
      discount: Number.isNaN(parsedDiscount) ? 0 : parsedDiscount,
      notes: formState.notes,
      medicines: medicinesPayload,
      paymentType: formState.paymentType,
      paymentStatus: formState.paymentStatus
    };

    if (formState.settledAt) {
      const settledDate = new Date(formState.settledAt);
      if (!Number.isNaN(settledDate.valueOf())) {
        payload.settledAt = settledDate.toISOString();
      }
    }

    const action = editingId ? updateItem(editingId, payload) : createItem(payload);
    const result = await action;

    if (result.success) {
      setFormState(createEmptyAppointment());
      setEditingId(null);
      setPatientSearchQuery('');
      await refreshPatients();
    }
  };

  const handleEdit = useCallback((appointment) => {
    setFormState({
      date: formatDateTimeLocal(appointment.date),
      reason: appointment.reason || '',
      status: appointment.status || 'scheduled',
      patientId: appointment.patient?.id ? String(appointment.patient.id) : appointment.patientId ? String(appointment.patientId) : '',
      veterinarianId: appointment.veterinarian?.id
        ? String(appointment.veterinarian.id)
        : appointment.veterinarianId
        ? String(appointment.veterinarianId)
        : '',
      isWalkIn: appointment.isWalkIn ? 'true' : 'false',
      doctorCharge:
        appointment.doctorCharge !== null && appointment.doctorCharge !== undefined
          ? String(appointment.doctorCharge)
          : '',
      discount:
        appointment.discount !== null && appointment.discount !== undefined
          ? String(appointment.discount)
          : '0',
      paymentType: appointment.paymentType || 'cash',
      paymentStatus:
        appointment.paymentStatus || (appointment.paymentType === 'credit' ? 'pending' : 'paid'),
      settledAt: appointment.settledAt ? formatDateTimeLocal(appointment.settledAt) : '',
      notes: appointment.notes || '',
      medicines: mapPrescriptionToRows(appointment.medicines)
    });
    setEditingId(appointment.id);
    setPatientSearchQuery(appointment.patient?.name || '');
  }, []);

  const resetForm = () => {
    setEditingId(null);
    setFormState(createEmptyAppointment());
    setPatientSearchQuery('');
  };

  const combinedError = error || patientsApi.error || vetsApi.error || medicinesError;

  useEffect(() => {
    if (!editingId && veterinarianOptions.length === 1) {
      setFormState((prev) => {
        if (prev.veterinarianId === veterinarianOptions[0].value) {
          return prev;
        }
        return { ...prev, veterinarianId: veterinarianOptions[0].value };
      });
    }
  }, [editingId, veterinarianOptions]);

  const patientRefreshRequested = useRef(false);

  const reasonAutofillRef = useRef('');

  useEffect(() => {
    if (!normalizedReason) {
      reasonAutofillRef.current = '';
      return;
    }

    const prescription = lastPrescription;
    const marker = prescription
      ? `${normalizedReason}:${prescription.dateValue}`
      : `${normalizedReason}:none`;

    if (editingId) {
      reasonAutofillRef.current = marker;
      return;
    }

    if (reasonAutofillRef.current === marker) {
      return;
    }

    if (!prescription || !prescription.medicines.length) {
      setFormState((prev) => ({
        ...prev,
        medicines: []
      }));
      reasonAutofillRef.current = marker;
      return;
    }

    setFormState((prev) => ({
      ...prev,
      medicines: prescription.medicines.map((item) => ({ ...item }))
    }));
    reasonAutofillRef.current = marker;
  }, [editingId, lastPrescription, normalizedReason]);

  useEffect(() => {
    const navState = location.state;
    if (!navState) {
      patientRefreshRequested.current = false;
      return;
    }

    const needsAppointment = Boolean(navState.appointmentId);
    const needsPatientSelection = Boolean(navState.selectedPatientId);

    let appointmentHandled = !needsAppointment;
    let patientHandled = !needsPatientSelection;

    if (needsAppointment) {
      if (!items.length) {
        return;
      }
      const numericId = Number(navState.appointmentId);
      if (!Number.isNaN(numericId)) {
        const appointment = items.find((item) => item.id === numericId);
        if (appointment) {
          handleEdit(appointment);
          appointmentHandled = true;
        }
      } else {
        appointmentHandled = true;
      }
    }

    if (needsPatientSelection) {
      if (patientsLoading) {
        return;
      }
      const patientIdString = String(navState.selectedPatientId);
      const patient = patients.find((entry) => String(entry.id) === patientIdString);
      if (patient) {
        setFormState((prev) => ({ ...prev, patientId: patientIdString }));
        setPatientSearchQuery(navState.selectedPatientName || patient.name || '');
        patientHandled = true;
        patientRefreshRequested.current = false;
      } else if (!patientRefreshRequested.current) {
        patientRefreshRequested.current = true;
        refreshPatients();
        return;
      }
    } else {
      patientRefreshRequested.current = false;
    }

    if (appointmentHandled && patientHandled) {
      navigate(location.pathname, { replace: true });
    }
  }, [
    handleEdit,
    items,
    location.pathname,
    location.state,
    navigate,
    patients,
    patientsLoading,
    refreshPatients
  ]);

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold text-slate-800">Appointments</h1>
        <p className="text-sm text-slate-500">Schedule patient visits, prioritize walk-ins, and review case history.</p>
      </div>
      {combinedError && (
        <div className="alert alert-error shadow-sm">
          <span>{combinedError}</span>
        </div>
      )}
      <EntityForm
        title={editingId ? 'Update appointment' : 'Schedule appointment'}
        fields={fields}
        values={formState}
        onChange={handleChange}
        onSubmit={handleSubmit}
        submitLabel={editingId ? 'Update appointment' : 'Create appointment'}
        isEditing={Boolean(editingId)}
        onCancel={resetForm}
      />
      <div className="flex flex-wrap items-center gap-3">
        <Link to="/appointments/history" className="btn btn-sm btn-outline">
          View appointment history
        </Link>
      </div>
      <div className="rounded-2xl border border-base-300 bg-base-100 p-5 text-sm text-slate-600 shadow-sm">
        Walk-in patients appear first in the schedule to help the team prioritize their visit.
      </div>
      {veterinarianOptions.length === 1 && (
        <div className="rounded-2xl border border-dashed border-base-300 bg-base-100 p-5 text-sm text-slate-600 shadow-sm">
          All appointments are assigned to {veterinarianOptions[0].label}. Update veterinarian details in the Veterinarian tab if
          needed.
        </div>
      )}
    </section>
  );
};

export default AppointmentsPage;
