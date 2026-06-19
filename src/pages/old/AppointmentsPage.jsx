import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import { AlertTriangle, CalendarDays, CheckCircle2, ClipboardList, Clock3, Eye, Pencil, Pill, Plus, Users, X } from 'lucide-react';
import AppointmentMedicineSelector, { calculateMedicinesTotal } from '../components/AppointmentMedicineSelector.jsx';
import PatientSearch from '../components/PatientSearch.jsx';
import QuickPatientRegistrationCard from '../components/QuickPatientRegistrationCard.jsx';
import PatientInfoModal from '../components/PatientInfoModal.jsx';
import { paymentStatusOptions, statusOptions } from '../constants/appointments.js';
import useEntityApi from '../hooks/useEntityApi.js';
import {
  fetchPatientReports,
  syncPatientReports as syncPatientReportsRequest,
  uploadDiagnosticReport
} from '../api/appointments.js';
import {
  buildAppointmentPayload,
  createEmptyAppointment,
  createEmptyVaccinationPlan,
  formatDateInput,
  formatDateTimeLocal,
  formatReportDisplayDate,
  generateReportClientId,
  getCurrentDateTimeLocal,
  makeUploadKey,
  mapAppointmentToFormState,
  mapReportsForPayload,
  normalizeReportEntry,
  normalizeReportsResponse
} from './appointmentsHelpers.js';
import PatientProfileTabs from '../components/PatientProfileTabs.jsx';
import AppointmentChargesSummary from '../components/AppointmentChargesSummary.jsx';
import VaccineFollowUp from '../components/VaccineFollowUp.jsx';
import GroupPatientRow from '../components/GroupPatientRow.jsx';


const currencyFormatter = new Intl.NumberFormat('en-LK', { style: 'currency', currency: 'LKR' });

const parseNullableNumber = (value) => {
  if (value === '' || value === null || value === undefined) {
    return null;
  }
  const numeric = Number(value);
  return Number.isNaN(numeric) ? null : numeric;
};

const capitalizeFirstLetter = (string) => {
  if (typeof string !== 'string' || string.length === 0) {
    return string;
  }
  return string.charAt(0).toUpperCase() + string.slice(1);
};

// ── Reason input with suggestion dropdown ─────────────────────────────────────
const ReasonInput = ({ value, onChange, placeholder, inputRef, suggestions = [], onEnterNoDropdown }) => {
  const [open, setOpen] = useState(false);
  const [highlightIdx, setHighlightIdx] = useState(-1);
  const [dropdownStyle, setDropdownStyle] = useState(null);
  const ownRef = useRef(null);
  const resolvedRef = inputRef || ownRef;

  const filtered = useMemo(() => {
    const q = (value || '').trim().toLowerCase();
    return suggestions.filter((s) => s.toLowerCase().includes(q) && s.toLowerCase() !== q);
  }, [value, suggestions]);

  const showDropdown = open && filtered.length > 0;

  const updateDropdownStyle = useCallback(() => {
    const el = resolvedRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const openUpward = spaceBelow < 220 && spaceAbove > spaceBelow;
    setDropdownStyle(
      openUpward
        ? { position: 'fixed', left: rect.left, bottom: window.innerHeight - rect.top + 4, width: rect.width }
        : { position: 'fixed', left: rect.left, top: rect.bottom + 4, width: rect.width }
    );
  }, [resolvedRef]);

  const select = (s) => { onChange(s); setOpen(false); setHighlightIdx(-1); };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') { setOpen(false); setHighlightIdx(-1); return; }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!showDropdown) return;
      setHighlightIdx((prev) => Math.min(prev + 1, filtered.length - 1));
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!showDropdown) return;
      setHighlightIdx((prev) => Math.max(prev - 1, 0));
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      if (showDropdown && highlightIdx >= 0 && filtered[highlightIdx]) {
        select(filtered[highlightIdx]);
      } else {
        setOpen(false);
        onEnterNoDropdown?.();
      }
    }
  };

  return (
    <div className="relative">
      <input
        ref={resolvedRef}
        type="text"
        value={value}
        onChange={(e) => { onChange(e.target.value); setOpen(true); setHighlightIdx(-1); updateDropdownStyle(); }}
        onFocus={() => { if (filtered.length > 0) { updateDropdownStyle(); setOpen(true); } }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="input input-sm input-bordered w-full bg-white text-sm text-slate-800 placeholder:text-slate-400 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-100"
      />
      {showDropdown && dropdownStyle && createPortal(
        <ul
          className="z-50 max-h-52 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg"
          style={dropdownStyle}
        >
          {filtered.map((s, i) => (
            <li
              key={s}
              className={`cursor-pointer px-3 py-2 text-sm transition-colors ${
                i === highlightIdx ? 'bg-blue-50 text-blue-700 font-medium' : 'text-slate-700 hover:bg-slate-50'
              }`}
              onMouseDown={() => select(s)}
            >
              {s}
            </li>
          ))}
        </ul>,
        document.body
      )}
    </div>
  );
};

const AppointmentsPage = () => {
  const appointmentApi = useEntityApi('appointments');
  const patientsApi = useEntityApi('patients');
  const ownersApi = useEntityApi('owners');
  const vetsApi = useEntityApi('veterinarians');
  const medicinesApi = useEntityApi('medicines');
  const chargePresetsApi = useEntityApi('doctor-charge-presets');
  const surgeryChargePresetsApi = useEntityApi('surgery-charge-presets');
  const navigate = useNavigate();
  const location = useLocation();

  const { items, error, createItem, updateItem } = appointmentApi;
  const {
    items: patients,
    refresh: refreshPatients,
    loading: patientsLoading,
    createItem: createPatient,
    updateItem: updatePatient,
    call: callPatients
  } = patientsApi;
  const { items: owners, error: ownersError, createItem: createOwner, refresh: refreshOwners } = ownersApi;
  const {
    items: medicines,
    loading: medicinesLoading,
    error: medicinesError
  } = medicinesApi;

  const [formState, setFormState] = useState(() => createEmptyAppointment());
  const [editingId, setEditingId] = useState(null);
  const [isGroupMode, setIsGroupMode] = useState(false);
  const [groupPatients, setGroupPatients] = useState([]);
  const groupKeyRef = useRef(0);
  const [formResetCounter, setFormResetCounter] = useState(0);
  // note: treatment section is always visible for a selected patient, so we
  // derive its state from the presence of a patient rather than tracking it
  // separately. this avoids clicking a "start treatment" button.
  const [dateEditing, setDateEditing] = useState(false); // controls whether the appointment time input is editable
  const [successMessage, setSuccessMessage] = useState('');
  const [formError, setFormError] = useState('');
  const [showPatientModal, setShowPatientModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [patientSearchQuery, setPatientSearchQuery] = useState('');
  const [reportUploadState, setReportUploadState] = useState({});

  // holds latest quick registration form values when user is inputting a new patient
  const [newPatientForm, setNewPatientForm] = useState(null);
  const [patientReportsLoading, setPatientReportsLoading] = useState(false);
  const [patientReportsError, setPatientReportsError] = useState('');
  const selectedPatientId = formState.patientId;
  const reportFileInputsRef = useRef({});
  const vaccinationPlan = formState.vaccinationPlan ?? createEmptyVaccinationPlan();
  const updateVaccinationPlan = useCallback((updater) => {
    setFormState((prev) => {
      const currentPlan = prev.vaccinationPlan ?? createEmptyVaccinationPlan();
      const draft = { ...currentPlan };
      const nextPlan = typeof updater === 'function' ? updater(draft) : { ...draft, ...updater };
      return { ...prev, vaccinationPlan: nextPlan };
    });
  }, []);
  const selectedPatient = useMemo(
    () => patients.find((patient) => String(patient.id) === String(selectedPatientId)),
    [patients, selectedPatientId]
  );

  // treat treatment as started as soon as a patient id is chosen or walk-in mode is active
  const startedTreatment = Boolean(formState.patientId) || Boolean(formState.isWalkIn);

  useEffect(() => {
    // whenever search text changes we should abandon any partial registration data
    setNewPatientForm(null);

    // if the user erases the field completely, clear the patient selection
    if (!patientSearchQuery.trim()) {
      if (formState.patientId) {
        setDateEditing(false);
        setFormState((prev) => ({
          ...prev,
          patientId: ''
        }));
        setShowPatientModal(false);
      }
      return;
    }

    // if the query doesn't match the selected patient name, clear the patient selection
    const currentName = selectedPatient?.name || '';
    if (patientSearchQuery !== currentName && formState.patientId) {
      setDateEditing(false);
      setFormState((prev) => ({
        ...prev,
        patientId: ''
      }));
      setShowPatientModal(false);
    }
  }, [patientSearchQuery, selectedPatient, formState.patientId]);

const formStateRef = useRef(formState);

  useEffect(() => {
    formStateRef.current = formState;
  }, [formState]);

  useEffect(() => {
    if (editingId) {
      setPatientReportsLoading(false);
      setPatientReportsError('');
      return;
    }

    const patientId = formState.patientId;
    if (!patientId) {
      setPatientReportsLoading(false);
      setPatientReportsError('');
      setFormState((prev) => ({
        ...prev,
        diagnosticReports: []
      }));
      return;
    }

    let cancelled = false;
    setPatientReportsLoading(true);
    setPatientReportsError('');
    setFormState((prev) => ({
      ...prev,
      diagnosticReports: []
    }));

    (async () => {
      try {
        const responseData = await fetchPatientReports(patientId);
        if (cancelled) {
          return;
        }
        const normalized = normalizeReportsResponse(responseData);
        setFormState((prev) => ({
          ...prev,
          diagnosticReports: normalized
        }));
      } catch (error) {
        if (cancelled) {
          return;
        }
        setPatientReportsError(error?.message || 'Failed to load diagnostics');
      } finally {
        if (!cancelled) {
          setPatientReportsLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [editingId, formState.patientId]);

  const selectedOwner = useMemo(() => {
    if (!selectedPatient) {
      return null;
    }
    const ownerFromStore = selectedPatient.ownerId
      ? owners.find((owner) => String(owner.id) === String(selectedPatient.ownerId))
      : null;
    return ownerFromStore || selectedPatient.owner || null;
  }, [owners, selectedPatient]);


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
          brandName: brand.name,
          scale: brand.scale,
          conversion: brand.conversion,
          doseSizes: Array.isArray(brand.dose_sizes) ? brand.dose_sizes : []
        });
      });
    });
    return options.sort((a, b) => a.label.localeCompare(b.label));
  }, [medicines]);

  const brandLookup = useMemo(
    () => new Map(brandOptions.map((option) => [option.value, option])),
    [brandOptions]
  );

  const hasVaccineMedicine = useMemo(() => {
    if (!Array.isArray(formState.medicines) || formState.medicines.length === 0) {
      return false;
    }
    return formState.medicines.some((row) => {
      const option = brandLookup.get(String(row.medicineBrandId));
      const label = option?.label?.toLowerCase() || '';
      return label.includes('vaccine');
    });
  }, [brandLookup, formState.medicines]);

  const firstVaccineMedicineName = useMemo(() => {
    if (!hasVaccineMedicine) {
      return '';
    }
    const vaccineRow = (formState.medicines || []).find((row) => {
      const option = brandLookup.get(String(row.medicineBrandId));
      const label = option?.label?.toLowerCase() || '';
      return label.includes('vaccine') || option?.medicineName?.toLowerCase().includes('vaccine') || option?.brandName?.toLowerCase().includes('vaccine');
    });
    if (!vaccineRow) return '';
    const option = brandLookup.get(String(vaccineRow.medicineBrandId));
    return option?.medicineName || option?.label || '';
  }, [brandLookup, formState.medicines, hasVaccineMedicine]);

  const vaccineNames = useMemo(() => {
    const vaccineSet = new Set();
    const fallbackSet = new Set();

    const addName = (name, targetSet) => {
      if (!name) return;
      const trimmed = name.trim();
      if (trimmed) {
        targetSet.add(trimmed);
      }
    };

    brandOptions.forEach((option) => {
      const labelLower = option.label?.toLowerCase() || '';
      const brandLower = option.brandName?.toLowerCase() || '';
      const medicineLower = option.medicineName?.toLowerCase() || '';
      const looksLikeVaccine = labelLower.includes('vaccine') || brandLower.includes('vaccine') || medicineLower.includes('vaccine');
      const looksLikeVac = labelLower.includes('vac') || brandLower.includes('vac') || medicineLower.includes('vac');

      const primaryName = option.medicineName || option.label;
      const secondaryName = option.brandName || option.label;

      if (looksLikeVaccine || looksLikeVac) {
        addName(primaryName, vaccineSet);
        addName(secondaryName, vaccineSet);
      }
      addName(primaryName, fallbackSet);
      addName(secondaryName, fallbackSet);
    });

    const merged = vaccineSet.size > 0 ? Array.from(vaccineSet) : Array.from(fallbackSet);
    return merged.sort((a, b) => a.localeCompare(b));
  }, [brandOptions]);


  useEffect(() => {
    if (!hasVaccineMedicine) {
      return;
    }
    updateVaccinationPlan((plan) => {
      const next = { ...plan, enabled: true };
      if (!next.vaccineName) {
        next.vaccineName = firstVaccineMedicineName || formState.reason || 'Vaccine';
      }
      if (!next.administeredAt) {
        next.administeredAt = formatDateInput(formState.date) || formatDateInput(new Date());
      }
      if (!next.nextDueAt) {
        const baseString = next.administeredAt || formatDateInput(formState.date) || formatDateInput(new Date());
        const baseDate = baseString ? new Date(baseString) : new Date();
        if (!Number.isNaN(baseDate.valueOf())) {
          baseDate.setDate(baseDate.getDate() + 14);
          next.nextDueAt = formatDateInput(baseDate.toISOString());
        }
      }
      return next;
    });
  }, [hasVaccineMedicine, formState.reason, formState.date, updateVaccinationPlan]);


  useEffect(() => {
    setFormState((prev) => {
      const currentPlan = prev.vaccinationPlan ?? createEmptyVaccinationPlan();
      const reasonValue = prev.reason ? prev.reason.trim().toLowerCase() : '';
      const shouldEnable = reasonValue.includes('vaccine');

      if (!shouldEnable) {
        const isPristine = !currentPlan.enabled
          && !currentPlan.vaccineName
          && !currentPlan.doseNumber
          && !currentPlan.administeredAt
          && !currentPlan.nextDueAt
          && !currentPlan.notes;
        if (isPristine) {
          return prev;
        }
        return {
          ...prev,
          vaccinationPlan: createEmptyVaccinationPlan()
        };
      }

      const nextPlan = { ...currentPlan };
      let changed = false;

      if (!nextPlan.enabled) {
        nextPlan.enabled = true;
        changed = true;
      }

      if (!nextPlan.vaccineName || !nextPlan.vaccineName.trim()) {
        nextPlan.vaccineName = prev.reason || 'Vaccine';
        changed = true;
      }

      const appointmentDateInput = formatDateInput(prev.date);
      if (!nextPlan.administeredAt && appointmentDateInput) {
        nextPlan.administeredAt = appointmentDateInput;
        changed = true;
      }

      if (!nextPlan.nextDueAt && nextPlan.administeredAt) {
        const base = new Date(nextPlan.administeredAt);
        if (!Number.isNaN(base.valueOf())) {
          base.setDate(base.getDate() + 14);
          nextPlan.nextDueAt = base.toISOString().slice(0, 10);
          changed = true;
        }
      }

      if (!nextPlan.remindBeforeDays || nextPlan.remindBeforeDays === '') {
        nextPlan.remindBeforeDays = '7';
        changed = true;
      }

      if (!changed) {
        return prev;
      }

      return {
        ...prev,
        vaccinationPlan: nextPlan
      };
    });
  }, [formState.reason, formState.date]);

  const handlePatientSelect = useCallback((patient) => {
    // clear validation errors when patient choice changes
    if (formError) setFormError('');

    if (!patient) {
      setFormState((prev) => ({ ...prev, patientId: '' }));
      setPatientSearchQuery('');
      setShowPatientModal(false);
      setNewPatientForm(null);
      return;
    }
    setFormState((prev) => ({ ...prev, patientId: String(patient.id) }));
    setPatientSearchQuery(patient.name || '');
    setNewPatientForm(null);
  }, [formError]);
  const handlePatientCreated = useCallback((patient) => {
    if (!patient) {
      return;
    }
    // clear preview so parent will fetch a new next number after registration
    setPassbookPreview('');
    handlePatientSelect(patient);
  }, [handlePatientSelect]);

  const handlePatientUpdated = useCallback((patient) => {
    if (patient) {
      handlePatientSelect(patient);
    }
    refreshPatients();
  }, [handlePatientSelect, refreshPatients]);

  const handleQuickCreatePatient = useCallback(async (name) => {
    // clear prior validation errors
    if (formError) setFormError('');

    const trimmed = (name || '').trim();
    if (!trimmed) {
      return;
    }
    const result = await createPatient({ name: trimmed });
    if (result.success && result.data) {
      handlePatientSelect(result.data);
      await refreshPatients();
    }
  }, [createPatient, handlePatientSelect, refreshPatients, formError]);

  // ── Group mode helpers ─────────────────────────────────────────────────────
  const newGroupKey = () => String(++groupKeyRef.current);

  const enterGroupMode = useCallback(() => {
    const firstSlot = {
      _key: newGroupKey(),
      patientId: formState.patientId || '',
      searchQuery: patientSearchQuery || '',
      medicines: formState.medicines || [],
    };
    const secondSlot = { _key: newGroupKey(), patientId: '', searchQuery: '', medicines: [] };
    setGroupPatients([firstSlot, secondSlot]);
    setIsGroupMode(true);
    setFormState((prev) => ({ ...prev, patientId: '', medicines: [] }));
    setPatientSearchQuery('');
  }, [formState.patientId, formState.medicines, patientSearchQuery]);

  const exitGroupMode = useCallback(() => {
    setIsGroupMode(false);
    setGroupPatients([]);
  }, []);

  const updateGroupPatient = useCallback((_key, field, value) => {
    setGroupPatients((prev) =>
      prev.map((gp) => (gp._key === _key ? { ...gp, [field]: value } : gp))
    );
  }, []);

  const addGroupPatient = useCallback(() => {
    setGroupPatients((prev) => [
      ...prev,
      { _key: newGroupKey(), patientId: '', searchQuery: '', medicines: [] },
    ]);
  }, []);

  const removeGroupPatient = useCallback((_key) => {
    setGroupPatients((prev) => prev.filter((gp) => gp._key !== _key));
  }, []);

  const handleGroupSubmit = useCallback(async () => {
    if (formError) setFormError('');

    if (!formState.reason?.trim()) {
      setFormError('Reason is required.');
      return;
    }
    if (groupPatients.length === 0) {
      setFormError('Add at least one patient.');
      return;
    }
    const unselected = groupPatients.filter((gp) => !gp.patientId);
    if (unselected.length > 0) {
      setFormError('All patients must be selected before completing.');
      return;
    }

    setIsSaving(true);
    const results = [];
    try {
      for (const gp of groupPatients) {
        const payload = buildAppointmentPayload({ ...formState, patientId: gp.patientId, medicines: gp.medicines });
        const result = await createItem(payload);
        if (result.success) results.push({ data: result.data, gp });
      }

      if (results.length > 0) {
        if (formState.status === 'completed') {
          const first = results[0];
          const appointmentId = first.data?.id ?? null;
          const patientName = first.data?.patient?.name || patients.find((p) => String(p.id) === first.gp.patientId)?.name || '';
          const firstPayload = buildAppointmentPayload({ ...formState, patientId: first.gp.patientId, medicines: first.gp.medicines });
          const doctor = Number(formState.doctorCharge) || 0;
          const surgery = Number(formState.surgeryCharge) || 0;
          const service = Number(formState.otherCharge) || 0;
          const medicinesSubtotal = firstPayload.medicines.reduce((sum, entry) => {
            const brand = brandLookup.get(String(entry.medicineBrandId));
            const price = brand ? Number(brand.price) || 0 : 0;
            return sum + price * (Number.parseFloat(entry.quantity) || 0);
          }, 0);
          const discount = Number(formState.discount) || 0;
          const estimated = Number(Math.max(doctor + surgery + service + medicinesSubtotal - discount, 0).toFixed(2));

          exitGroupMode();
          resetForm();
          await refreshPatients();
          navigate('/appointments/receipt', {
            state: {
              from: 'appointments',
              autoprint: true,
              appointmentDate: formState.date,
              groupCount: results.length,
              invoice: {
                doctorCharge: doctor,
                surgeryCharge: surgery,
                otherCharge: service,
                otherChargeReason: firstPayload.otherChargeReason || null,
                medicinesSubtotal,
                discount,
                estimated,
                patientName,
                appointmentId,
                medicines: first.data?.medicines || [],
                paymentType: firstPayload.paymentType || 'cash',
                paymentStatus: firstPayload.paymentStatus || 'paid',
                reason: firstPayload.reason || '',
              },
            },
          });
        } else {
          setSuccessMessage(`${results.length} appointment${results.length > 1 ? 's' : ''} created`);
          setTimeout(() => setSuccessMessage(''), 3000);
          exitGroupMode();
          resetForm();
          await refreshPatients();
        }
      } else {
        setFormError('Failed to create appointments. Please try again.');
      }
    } finally {
      setIsSaving(false);
    }
  }, [formState, groupPatients, formError, brandLookup, createItem, patients, navigate, exitGroupMode, refreshPatients]);
  // stable function to fetch next passbook number; memoized to avoid repeated calls on parent re-renders
  const fetchNextPassbook = useCallback(async () => {
    const resp = await callPatients('get', '/next-passbook');
    return resp?.success ? resp.data?.passbookNumber || '' : '';
  }, [callPatients]);

  // track preview value here so we only fetch once
  const [passbookPreview, setPassbookPreview] = useState('');

  // manage passbook preview: show patient's existing number or fetch next available for new registrations
  useEffect(() => {
    let cancelled = false;

    const loadNextPassbook = async () => {
      const nextNumber = await fetchNextPassbook();
      if (!cancelled && nextNumber) {
        setPassbookPreview(nextNumber);
      }
    };

    if (!selectedPatient) {
      setPassbookPreview('');
      loadNextPassbook();
      return () => {
        cancelled = true;
      };
    }

    const existingPassbook = selectedPatient.passbookNumber || selectedPatient.passbook_number || '';
    if (existingPassbook) {
      setPassbookPreview(existingPassbook);
      return () => {
        cancelled = true;
      };
    }

    setPassbookPreview('');
    loadNextPassbook();

    return () => {
      cancelled = true;
    };
  }, [selectedPatient, fetchNextPassbook]);

  const renderQuickPatientForm = useCallback(
    ({ query: searchValue, inlineName }) => (
      <QuickPatientRegistrationCard
        key={selectedPatient ? `edit-${selectedPatient.id}` : 'create-new'}
        owners={owners}
        initialPatientName={inlineName || searchValue}
        hideNameField={Boolean(inlineName !== undefined)}
        initialValues={selectedPatient}
        passbookPreview={passbookPreview}
        createOwner={createOwner}
        createPatient={createPatient}
        updatePatient={updatePatient}
        refreshOwners={refreshOwners}
        refreshPatients={refreshPatients}
        onPatientCreated={handlePatientCreated}
        onPatientUpdated={handlePatientUpdated}
        hideActions={true}               // hide internal buttons
        onFormChange={setNewPatientForm} // keep parent's copy
        onViewPatientInfo={selectedPatient ? () => setShowPatientModal(true) : null}
      />
    ),
    [
      owners,
      selectedPatient,
      passbookPreview,
      createOwner,
      createPatient,
      updatePatient,
      refreshOwners,
      refreshPatients,
      handlePatientCreated,
      handlePatientUpdated,
      fetchNextPassbook
    ]
  );


  const syncPatientReports = useCallback(
    async (reportsOverride = null, statusKey = null) => {
      const patientId = formStateRef.current?.patientId;
      if (!patientId) {
        if (statusKey) {
          setReportUploadState((prev) => ({
            ...prev,
            [statusKey]: { status: 'error', error: 'Select a patient first.' }
          }));
        }
        setPatientReportsError('Select a patient before adding diagnostics.');
        return false;
      }

      if (statusKey) {
        setReportUploadState((prev) => ({
          ...prev,
          [statusKey]: { status: 'saving', error: null }
        }));
      }

      const payloadReports = Array.isArray(reportsOverride)
        ? reportsOverride
        : Array.isArray(formStateRef.current?.diagnosticReports)
          ? formStateRef.current.diagnosticReports
          : [];

      try {
        const responseData = await syncPatientReportsRequest(Number(patientId), mapReportsForPayload(payloadReports));
        const normalized = normalizeReportsResponse(responseData);
        setFormState((prev) => ({
          ...prev,
          diagnosticReports: normalized
        }));
        setPatientReportsError('');
        if (statusKey) {
          setReportUploadState((prev) => ({
            ...prev,
            [statusKey]: { status: 'success', error: null }
          }));
        }
        return true;
      } catch (error) {
        const message = error?.message || 'Failed to save diagnostic report';
        setPatientReportsError(message);
        if (statusKey) {
          setReportUploadState((prev) => ({
            ...prev,
            [statusKey]: { status: 'error', error: message }
          }));
        }
        return false;
      }
    },
    [syncPatientReportsRequest]
  );

  const persistDiagnosticReports = useCallback(
    async (reports, statusKey = null) => {
      if (editingId) {
        if (statusKey) {
          setReportUploadState((prev) => ({
            ...prev,
            [statusKey]: { status: 'saving', error: null }
          }));
        }

        const payload = { diagnosticReports: mapReportsForPayload(reports) };
        const result = await updateItem(editingId, payload);

        if (result.success) {
          const normalized = normalizeReportsResponse(result.data);
          setFormState((prev) => ({
            ...prev,
            diagnosticReports: normalized.length ? normalized : reports
          }));

          if (statusKey) {
            setReportUploadState((prev) => ({
              ...prev,
              [statusKey]: { status: 'success', error: null }
            }));
          }

          return true;
        }

        if (statusKey) {
          setReportUploadState((prev) => ({
            ...prev,
            [statusKey]: { status: 'error', error: result.message || 'Failed to save diagnostic report' }
          }));
        }

        return false;
      }

      return syncPatientReports(reports, statusKey);
    },
    [editingId, syncPatientReports, updateItem]
  );

  const handleReportUpload = useCallback(async ({ reportType, replaceKey = null, file }) => {
    if (!file) {
      return;
    }
    const uploadKey = makeUploadKey(reportType, replaceKey || 'new');
    const patientId = formStateRef.current?.patientId;
    if (!patientId) {
      setReportUploadState((prev) => ({
        ...prev,
        [uploadKey]: { status: 'error', error: 'Select a patient before uploading.' }
      }));
      setPatientReportsError('Select a patient before adding diagnostics.');
      return;
    }
    setReportUploadState((prev) => ({
      ...prev,
      [uploadKey]: { status: 'uploading', error: null }
    }));
    const currentReports = Array.isArray(formStateRef.current?.diagnosticReports)
      ? formStateRef.current.diagnosticReports.map((entry) => ({ ...entry }))
      : [];
    const previousReportsSnapshot = currentReports.map((entry) => ({ ...entry }));

    try {
      const uploadResult = await uploadDiagnosticReport(file, {
        type: reportType,
        patientId: Number(patientId)
      });
      const uploadedUrl = uploadResult?.fileUrl;
      if (!uploadedUrl) {
        throw new Error('Upload returned no file URL');
      }
      const mimeFromResponse = uploadResult?.mimeType || file.type || null;

      const reportEntry = normalizeReportEntry({
        type: reportType,
        label: uploadResult?.originalName || file.name || `${reportType} report`,
        fileUrl: uploadedUrl,
        filePublicId: uploadResult?.filePublicId || null,
        mimeType: mimeFromResponse,
        fileBytes: uploadResult?.fileBytes ?? file.size ?? null,
        reportedAt: new Date().toISOString(),
        clientId: replaceKey || generateReportClientId()
      });
      const nextReportsSnapshot = [
        ...currentReports.filter((entry) => entry.clientId !== replaceKey),
        reportEntry
      ];
      setFormState((prev) => ({
        ...prev,
        diagnosticReports: nextReportsSnapshot
      }));
      const persisted = await persistDiagnosticReports(nextReportsSnapshot, uploadKey);
      if (!persisted) {
        setFormState((prev) => ({
          ...prev,
          diagnosticReports: previousReportsSnapshot
        }));
      }
    } catch (error) {
      setFormState((prev) => ({
        ...prev,
        diagnosticReports: previousReportsSnapshot
      }));
      setReportUploadState((prev) => ({
        ...prev,
        [uploadKey]: { status: 'error', error: error.message || 'Upload failed' }
      }));
    } finally {
      const input = reportFileInputsRef.current[uploadKey];
      if (input) {
        input.value = '';
      }
    }
  }, [persistDiagnosticReports]);

  const handleReportInputChange = useCallback((reportType, targetKey, event) => {
    const file = event?.target?.files?.[0];
    if (file) {
      handleReportUpload({ reportType, replaceKey: targetKey, file });
    }
  }, [handleReportUpload]);

  const handleReportRemove = useCallback(async (clientId) => {
    if (!clientId) {
      return;
    }
    const currentReports = Array.isArray(formStateRef.current?.diagnosticReports)
      ? formStateRef.current.diagnosticReports.map((entry) => ({ ...entry }))
      : [];
    const previousReportsSnapshot = currentReports.map((entry) => ({ ...entry }));
    const nextReportsSnapshot = currentReports.filter((entry) => entry.clientId !== clientId);
    setFormState((prev) => ({
      ...prev,
      diagnosticReports: nextReportsSnapshot
    }));
    setReportUploadState((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((key) => {
        if (key.endsWith(`::${clientId}`)) {
          delete next[key];
        }
      });
      return next;
    });
    const persisted = await persistDiagnosticReports(nextReportsSnapshot);
    if (!persisted) {
      setFormState((prev) => ({
        ...prev,
        diagnosticReports: previousReportsSnapshot
      }));
    }
  }, [persistDiagnosticReports]);

  const requestReportUpload = useCallback((reportType, targetKey = null) => {
    const uploadKey = makeUploadKey(reportType, targetKey || 'new');
    const input = reportFileInputsRef.current[uploadKey];
    if (input) {
      input.click();
    }
  }, []);

  const registerReportInputRef = useCallback((key, node) => {
    if (!key) return;
    reportFileInputsRef.current[key] = node;
  }, []);



  const handleChange = (name, value) => {
    // clear any previous validation error when user edits fields
    if (formError) {
      setFormError('');
    }

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
    if (isSaving) {
      return;
    }

    if (isGroupMode) {
      await handleGroupSubmit();
      return;
    }

    // clear previous form validation message
    if (formError) setFormError('');

    // validate patient name when new registration is present (skip for walk-in)
    if (!formState.isWalkIn && !formState.patientId && newPatientForm) {
      if (!newPatientForm.patientName || !newPatientForm.patientName.trim()) {
        setFormError('Patient name is required when registering a new patient.');
        return;
      }
      // validate owner name when creating new owner
      if (!newPatientForm.existingOwnerId && (!newPatientForm.ownerFirstName || !newPatientForm.ownerFirstName.trim())) {
        setFormError('Owner name is required when registering a new patient.');
        return;
      }
    }

    if (!formState.reason || !formState.reason.trim()) {
      setFormError('Reason is required.');
      return;
    }

    // validate total amount - prevent saving with 0 total
    if (formState.status === 'completed') {
      const doctor = Number(formState.doctorCharge) || 0;
      const surgery = Number(formState.surgeryCharge) || 0;
      const service = Number(formState.otherCharge) || 0;
      const medicinesSubtotal = calculateMedicinesTotal(formState.medicines, brandLookup);
      const discount = Number(formState.discount) || 0;
      const total = Math.max(doctor + surgery + service + medicinesSubtotal - discount, 0);
      
      if (total === 0) {
        setFormError('Cannot complete appointment with 0 total. Please add charges or medicines.');
        return;
      }
    }

    // if a new patient has been entered via quick form, prepare a nested patient payload
    let appointmentPatientPayload = null;
    if (!formState.patientId && newPatientForm && newPatientForm.patientName) {
      appointmentPatientPayload = {
        name: newPatientForm.patientName,
        species: newPatientForm.species || null,
        breed: newPatientForm.breed || null,
        gender: newPatientForm.gender || null,
        ageYears: newPatientForm.ageYears || null,
        ageMonths: newPatientForm.ageMonths || null,
        weight: newPatientForm.weight || null
      };
      if (newPatientForm.existingOwnerId) {
        appointmentPatientPayload.ownerId = newPatientForm.existingOwnerId || null;
      } else {
        appointmentPatientPayload.owner = {
          firstName: newPatientForm.ownerFirstName || null,
          phone: newPatientForm.ownerPhone || null,
          email: newPatientForm.ownerEmail || null
        };
      }
    }

    setIsSaving(true);

    if (formState.patientId && newPatientForm) {
      const patientId = Number(formState.patientId);
      if (Number.isFinite(patientId) && patientId > 0) {
        const updatePayload = {};
        const trimmedName = (newPatientForm.patientName || '').trim();
        if (trimmedName) {
          updatePayload.name = trimmedName;
        }
        if (newPatientForm.breed) {
          updatePayload.breed = newPatientForm.breed;
        }
        if (newPatientForm.gender) {
          updatePayload.gender = newPatientForm.gender;
        }
        // Always include numeric fields when present in form, even if null/0
        if ('ageYears' in newPatientForm) {
          updatePayload.ageYears = parseNullableNumber(newPatientForm.ageYears);
        }
        if ('ageMonths' in newPatientForm) {
          updatePayload.ageMonths = parseNullableNumber(newPatientForm.ageMonths);
        }
        if ('weight' in newPatientForm) {
          updatePayload.weight = parseNullableNumber(newPatientForm.weight);
        }

        let ownerId = null;
        if (newPatientForm.existingOwnerId) {
          const parsedOwnerId = Number(newPatientForm.existingOwnerId);
          if (Number.isFinite(parsedOwnerId) && parsedOwnerId > 0) {
            ownerId = parsedOwnerId;
          }
        }

        const ownerFieldsProvided = Boolean(
          (newPatientForm.ownerFirstName && newPatientForm.ownerFirstName.trim()) ||
          (newPatientForm.ownerPhone && newPatientForm.ownerPhone.trim()) ||
          (newPatientForm.ownerEmail && newPatientForm.ownerEmail.trim())
        );

        if (!ownerId && ownerFieldsProvided) {
          const ownerPayload = {
            firstName: (newPatientForm.ownerFirstName || '').trim() || null,
            phone: (newPatientForm.ownerPhone || '').trim() || null,
            email: (newPatientForm.ownerEmail || '').trim() || null
          };
          const ownerResult = await createOwner(ownerPayload);
          if (!ownerResult?.success) {
            setFormError(ownerResult?.message || 'Failed to save owner details.');
            setIsSaving(false);
            return;
          }
          ownerId = ownerResult.data?.id ?? null;
          if (ownerId) {
            await refreshOwners();
          }
        }

        if (ownerId) {
          updatePayload.ownerId = ownerId;
        }

        if (Object.keys(updatePayload).length > 0) {
          const updateResult = await updatePatient(patientId, updatePayload);
          if (!updateResult?.success) {
            setFormError(updateResult?.message || 'Failed to update patient details.');
            setIsSaving(false);
            return;
          }
          await refreshPatients();
        }
      }
    }

    const payload = buildAppointmentPayload(formState);
    // include patient info if we prepared a nested object
    if (appointmentPatientPayload) {
      payload.patient = appointmentPatientPayload;
    }
    const medicinesPayload = payload.medicines;
    const parsedCharge = payload.doctorCharge;
    const parsedSurgeryCharge = payload.surgeryCharge;
    const parsedDiscount = payload.discount;

    try {
      const action = editingId ? updateItem(editingId, payload) : createItem(payload);
      const result = await action;

      if (result.success) {
        // compute invoice snapshot from payload so we can show it after reset
        const doctor = Number.isNaN(parsedCharge) ? 0 : parsedCharge;
        const surgery = Number.isNaN(parsedSurgeryCharge) ? 0 : parsedSurgeryCharge;
        const service = Number.isNaN(payload.otherCharge) ? 0 : payload.otherCharge;
        // compute medicines subtotal using brandLookup prices
        const medicinesSubtotal = medicinesPayload.reduce((sum, entry) => {
          const brand = brandLookup.get(String(entry.medicineBrandId));
          const price = brand ? Number(brand.price) || 0 : 0;
          const qty = Number.parseFloat(entry.quantity) || 0;
          return sum + price * qty;
        }, 0);
        const discount = Number.isNaN(parsedDiscount) ? 0 : parsedDiscount;
        const estimated = Number(Math.max(doctor + surgery + service + medicinesSubtotal - discount, 0).toFixed(2));

        // if appointment completed, navigate to receipt page
        if (payload.status === 'completed') {
          const appointmentId = result.data?.id ?? editingId ?? null;
          const respPatientName = result.data?.patient?.name;
          resetForm();
          await refreshPatients();
          navigate('/appointments/receipt', {
            state: {
              from: 'appointments',
              autoprint: true,
              appointmentDate: formState.date,
              invoice: {
                doctorCharge: doctor,
                surgeryCharge: surgery,
                otherCharge: service,
                otherChargeReason: payload.otherChargeReason || null,
                medicinesSubtotal,
                discount,
                estimated,
                patientName: respPatientName || selectedPatient?.name || formState.walkInName || (formState.isWalkIn ? 'Walk-in' : ''),
                appointmentId,
                medicines: result.data?.medicines || [],
                paymentType: payload.paymentType || 'cash',
                paymentStatus: payload.paymentStatus || 'paid',
                reason: payload.reason || '',
              }
            }
          });
          return;
        } else {
          setSuccessMessage(editingId ? 'Appointment updated' : 'Appointment created');
          setTimeout(() => setSuccessMessage(''), 3000);
        }

        // clear the form completely (also closes patient search, resets new-patient data)
        resetForm();
        await refreshPatients();
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = useCallback((appointment) => {
    setIsGroupMode(false);
    setGroupPatients([]);
    setFormState(mapAppointmentToFormState(appointment));
    setEditingId(appointment.id);
    setPatientSearchQuery(appointment.patient?.name || '');
    setDateEditing(false);
    setReportUploadState({});
    reportFileInputsRef.current = {};
  }, [mapAppointmentToFormState]);

  const resetForm = () => {
    setIsGroupMode(false);
    setGroupPatients([]);
    setEditingId(null);
    // Increment reset counter to force remount of all form components
    setFormResetCounter(prev => prev + 1);
    // Explicitly clear form state with empty values
    setFormState({
      patientId: '',
      isWalkIn: false,
      walkInName: '',
      date: getCurrentDateTimeLocal(),
      reason: '',
      status: 'completed',
      doctorCharge: '',
      surgeryCharge: '',
      otherCharge: '',
      otherChargeReason: '',
      discount: '',
      notes: '',
      medicines: [],
      paymentType: 'cash',
      paymentStatus: 'paid',
      settledAt: '',
      vaccinationPlan: createEmptyVaccinationPlan(),
      diagnosticReports: []
    });
    setPatientSearchQuery('');
    setDateEditing(false);
    setReportUploadState({});
    reportFileInputsRef.current = {};
    setNewPatientForm(null);
    setShowPatientModal(false);
    setFormError('');
    setSuccessMessage('');
    // do not close invoice modal here; it should remain open until user dismisses it
  };

  const combinedError = error || patientsApi.error || vetsApi.error || medicinesError || ownersError;

  // if any error message appears at the top of the page, ensure it is visible
  useEffect(() => {
    if (formError || combinedError) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [formError, combinedError]);

  // veterinarian removed from form; no auto-assignment

  const patientRefreshRequested = useRef(false);

  const reasonInputRef = useRef(null);
  const medicineSelectorRef = useRef(null);

  // Keyboard shortcuts — registered once; always reads latest state via this ref
  const kbRef = useRef({});
  kbRef.current = { reasonInputRef };

  // Auto-focus patient search on mount
  useEffect(() => {
    const input = document.querySelector('[data-patient-search] input');
    input?.focus();
  }, []);

  // Focus reason field when a patient is selected
  const prevPatientIdRef = useRef('');
  useEffect(() => {
    const prev = prevPatientIdRef.current;
    const curr = formState.patientId;
    prevPatientIdRef.current = curr;
    if (!prev && curr) {
      setTimeout(() => reasonInputRef.current?.focus(), 80);
    }
  }, [formState.patientId]);

  useEffect(() => {
    const handler = (e) => {

      // F1 → focus patient search
      if (e.key === 'F1') {
        e.preventDefault();
        const input = document.querySelector('[data-patient-search] input');
        input?.focus();
        input?.select();
        return;
      }

      // F3 → focus reason field
      if (e.key === 'F3') {
        e.preventDefault();
        kbRef.current.reasonInputRef?.current?.focus();
        kbRef.current.reasonInputRef?.current?.select();
        return;
      }

      // F5 → view patient profile (only when button is visible)
      if (e.key === 'F5') {
        const btn = document.querySelector('[data-view-profile]');
        if (btn) {
          e.preventDefault();
          btn.click();
        }
        return;
      }

      // F4 → print passbook barcode
      if (e.key === 'F4') {
        e.preventDefault();
        const printBtn = document.querySelector('[data-print-passbook]');
        printBtn?.click();
        return;
      }

      // F10 → submit (Complete Appointment + open invoice/print)
      if (e.key === 'F10') {
        e.preventDefault();
        const submitBtn = document.querySelector('[data-appointments-form] button[type="submit"]');
        submitBtn?.click();
        return;
      }

    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []); // registered once — latest values read through kbRef


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

  // Compute today's registered patients (last 5)
  const patientHistory = useMemo(() => {
    if (!selectedPatientId) return [];
    return items
      .filter((item) =>
        String(item.patientId) === String(selectedPatientId) ||
        String(item.patient?.id) === String(selectedPatientId)
      )
      .sort((a, b) => new Date(b.date).valueOf() - new Date(a.date).valueOf());
  }, [items, selectedPatientId]);

  const todayRegisteredPatients = useMemo(() => {
    if (!Array.isArray(patients)) return [];
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const todayStr = `${yyyy}-${mm}-${dd}`;
    return patients
      .filter((p) => {
        if (!p.createdAt) return false;
        // Accept both string and Date
        const created = typeof p.createdAt === 'string' ? p.createdAt.slice(0, 10) : '';
        return created === todayStr;
      })
      .sort((a, b) => (b.id || 0) - (a.id || 0))
      .slice(0, 5);
  }, [patients]);

  const handleTodayPatientClick = (patient) => {
    if (!patient) return;
    setFormState((prev) => ({ ...prev, patientId: String(patient.id) }));
    setPatientSearchQuery(patient.name || '');
    setShowPatientModal(false);
    setNewPatientForm(null);
  };

  return (
    <section className="flex flex-col gap-2 overflow-hidden" style={{ height: 'calc(100vh - 5rem)' }}>

      {/* ── TOP STRIP: single unified bar ───────────────────── */}
      <div className="shrink-0 space-y-1">

        {/* One bar: title · today's patients · keyboard hints */}
        <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 shadow-sm">
          {/* Title */}
          <div className="flex shrink-0 items-center gap-1.5">
            <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-blue-600 text-white shadow-sm">
              <CalendarDays size={12} />
            </div>
            <span className="text-xs font-bold text-slate-700">Appointments</span>
          </div>

          <div className="h-3.5 w-px shrink-0 bg-slate-200" />

          {/* Today's patients — scrollable middle strip */}
          {todayRegisteredPatients.length > 0 ? (
            <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto scrollbar-hide">
              <Users size={10} className="shrink-0 text-slate-400" />
              <span className="shrink-0 text-[9px] font-semibold uppercase tracking-wide text-slate-400">Today</span>
              <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full bg-blue-100 text-[9px] font-bold text-blue-700">{todayRegisteredPatients.length}</span>
              <div className="mx-1 h-3 w-px shrink-0 bg-slate-200" />
              {todayRegisteredPatients.map((patient) => {
                const active = String(formState.patientId) === String(patient.id);
                return (
                  <button
                    key={patient.id}
                    type="button"
                    onClick={() => handleTodayPatientClick(patient)}
                    className={`flex shrink-0 items-center gap-1 rounded-md border px-1.5 py-0.5 text-left transition ${
                      active ? 'border-blue-400 bg-blue-600 text-white' : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-blue-300 hover:bg-blue-50'
                    }`}
                  >
                    <span className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full text-[9px] font-bold ${active ? 'bg-white/20 text-white' : 'bg-blue-100 text-blue-600'}`}>
                      {patient.name.charAt(0).toUpperCase()}
                    </span>
                    <span className={`whitespace-nowrap text-[11px] font-semibold ${active ? 'text-white' : ''}`}>{patient.name}</span>
                    {patient.passbookNumber && <span className={`text-[10px] ${active ? 'text-blue-100' : 'text-slate-400'}`}>#{patient.passbookNumber}</span>}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="flex-1" />
          )}

          {/* Keyboard hints */}
          <div className="hidden shrink-0 items-center gap-1.5 sm:flex">
            {[['F1','Patient'],['F3','Reason'],['F4','Barcode'],['F5','Profile'],['F10','Complete']].map(([key, hint]) => (
              <span key={key} className="flex items-center gap-1">
                <kbd className="rounded border border-slate-300 bg-slate-50 px-1.5 py-0.5 font-mono text-[9px] font-bold text-slate-500 shadow-sm">{key}</kbd>
                <span className="text-[9px] text-slate-400">{hint}</span>
              </span>
            ))}
          </div>
        </div>

        {/* Banners — only visible when triggered */}
        {successMessage && (
          <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs text-emerald-700">
            <CheckCircle2 size={13} className="shrink-0" /><span>{successMessage}</span>
          </div>
        )}
        {formError && (
          <div className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs text-rose-700">
            <AlertTriangle size={13} className="shrink-0" /><span>{formError}</span>
          </div>
        )}
        {combinedError && (
          <div className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs text-rose-700">
            <AlertTriangle size={13} className="shrink-0" /><span>{combinedError}</span>
          </div>
        )}
      </div>

      {/* ── MAIN AREA: form wraps both columns ───────────────── */}
      <form
        className="flex min-h-0 flex-1 gap-3"
        onSubmit={handleSubmit}
        onKeyDown={(e) => {
          if (e.key !== 'Enter') return;
          const tag = e.target?.tagName;
          if (tag === 'TEXTAREA' || tag === 'BUTTON' || e.target?.type === 'submit') return;
          e.preventDefault();
        }}
        data-appointments-form
      >
        {/* ── LEFT COLUMN: clinical workflow ────────────────── */}
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">

          {/* Card header */}
          <div className="shrink-0 flex items-center justify-between border-b border-slate-100 bg-gradient-to-r from-blue-50 to-slate-50 px-3 py-2">
            <div className="flex items-center gap-2">
              <Clock3 size={14} className="text-blue-500" />
              <span className="text-sm font-bold text-slate-700">{editingId ? 'Edit Treatment' : 'New Treatment'}</span>
              {editingId && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">Editing</span>}
              {!editingId && (
                <button
                  type="button"
                  onClick={isGroupMode ? exitGroupMode : enterGroupMode}
                  className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-semibold transition ${
                    isGroupMode
                      ? 'border-blue-400 bg-blue-100 text-blue-700 hover:bg-blue-200'
                      : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  <Users size={10} />
                  {isGroupMode ? 'Group Mode ✕' : 'Group Treatment'}
                </button>
              )}
            </div>
            {startedTreatment && (
              <div className="flex items-center gap-2">
                {formState.isWalkIn ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                    {formState.walkInName || 'Walk-in'}
                  </span>
                ) : selectedPatient ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    {selectedPatient.name}
                  </span>
                ) : null}
                {selectedPatient && !formState.isWalkIn && (
                  <button
                    type="button"
                    data-view-profile
                    onClick={() => setShowPatientModal(true)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-700"
                    title="View patient profile (F5)"
                  >
                    <Eye size={12} /> Profile
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Scrollable sections */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100">

            {/* ── SECTION 1: PATIENT ── */}
            <div className="p-2">
              <div className="mb-1 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5">
                    <Users size={12} className="text-blue-500" />
                    <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                      {isGroupMode ? 'Patients' : 'Patient'}
                    </span>
                  </div>
                  {!isGroupMode && !formState.isWalkIn && (
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 hover:bg-amber-100 transition"
                      onClick={() => {
                        setFormState((prev) => ({ ...prev, isWalkIn: true, patientId: '' }));
                        setPatientSearchQuery('');
                        setNewPatientForm(null);
                      }}
                    >
                      Walk-in patient
                    </button>
                  )}
                </div>
                {/* Appointment time — compact inline */}
                <div className="flex items-center gap-2">
                  {!dateEditing ? (
                    <button
                      type="button"
                      onClick={() => setDateEditing(true)}
                      className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-600 shadow-sm hover:bg-slate-50 transition"
                    >
                      <Clock3 size={11} className="text-slate-400" />
                      {formState.date
                        ? new Date(formState.date).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                        : 'Set time'}
                      <Pencil size={9} className="text-slate-400" />
                    </button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <input
                        type="datetime-local"
                        value={typeof formState.date === 'string' ? formState.date : ''}
                        onChange={(e) => handleChange('date', e.target.value)}
                        className="input input-xs input-bordered bg-white text-xs"
                      />
                      <button type="button" onClick={() => handleChange('date', getCurrentDateTimeLocal())} className="text-[11px] font-medium text-blue-600 hover:underline">Now</button>
                      <button type="button" onClick={() => setDateEditing(false)} className="text-[11px] text-slate-500 hover:underline">Done</button>
                    </div>
                  )}
                </div>
              </div>

              {isGroupMode ? (
                <div className="space-y-2">
                  {groupPatients.map((gp, index) => (
                    <GroupPatientRow
                      key={gp._key}
                      entry={gp}
                      index={index}
                      patients={patients}
                      brandOptions={brandOptions}
                      brandLookup={brandLookup}
                      medicinesLoading={medicinesLoading}
                      onChange={(field, value) => updateGroupPatient(gp._key, field, value)}
                      onRemove={() => removeGroupPatient(gp._key)}
                      canRemove={groupPatients.length > 1}
                      formResetCounter={formResetCounter}
                    />
                  ))}
                  <button
                    type="button"
                    onClick={addGroupPatient}
                    className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-blue-300 bg-blue-50 py-1.5 text-[11px] font-semibold text-blue-600 hover:bg-blue-100 transition"
                  >
                    <Plus size={12} /> Add patient
                  </button>
                </div>
              ) : formState.isWalkIn ? (
                <div className="flex items-center gap-2">
                  <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-500" /> Walk-in
                  </span>
                  <input
                    type="text"
                    value={formState.walkInName || ''}
                    onChange={(e) => handleChange('walkInName', e.target.value)}
                    placeholder="Patient name (optional)"
                    className="input input-xs input-bordered min-w-0 flex-1 bg-white placeholder:text-slate-400 focus:border-amber-400 focus:ring-1 focus:ring-amber-100 focus:outline-none"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setFormState((prev) => ({ ...prev, isWalkIn: false, walkInName: '' }));
                      setTimeout(() => document.querySelector('[data-patient-search] input')?.focus(), 50);
                    }}
                    className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-0.5 text-xs font-medium text-slate-500 hover:bg-slate-50 transition"
                  >
                    <X size={11} /> Cancel
                  </button>
                </div>
              ) : (
                <div data-patient-search>
                  <PatientSearch
                    query={patientSearchQuery}
                    onQueryChange={setPatientSearchQuery}
                    patients={patients}
                    onSelectPatient={handlePatientSelect}
                    onCreatePatient={handleQuickCreatePatient}
                    selectedPatient={selectedPatient}
                    renderCreateForm={renderQuickPatientForm}
                  />
                </div>
              )}
            </div>

            {/* ── SECTION 2: CLINICAL DETAILS ── */}
            <div className="p-2">
              <div className="mb-1 flex items-center gap-1.5">
                <ClipboardList size={12} className="text-emerald-500" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Clinical Details</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <ReasonInput
                  inputRef={reasonInputRef}
                  value={typeof formState.reason === 'string' ? formState.reason : ''}
                  onChange={(v) => handleChange('reason', capitalizeFirstLetter(v))}
                  placeholder="Reason for visit"

                  onEnterNoDropdown={() => {
                    if (formState.medicines?.length > 0) medicineSelectorRef.current?.focusFirst();
                  }}
                />
                <input
                  type="text"
                  value={typeof formState.notes === 'string' ? formState.notes : ''}
                  onChange={(e) => handleChange('notes', capitalizeFirstLetter(e.target.value))}
                  placeholder="Notes / prep steps…"
                  className="input input-sm input-bordered w-full bg-white text-sm text-slate-800 placeholder:text-slate-400 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-100"
                />
              </div>
            </div>

            {/* ── SECTION 3: PRESCRIPTION (single-patient mode only) ── */}
            {!isGroupMode && (
              <div className="p-2">
                <div className="mb-1 flex items-center gap-1.5">
                  <Pill size={12} className="text-violet-500" />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Prescription</span>
                </div>
                <AppointmentMedicineSelector
                  ref={medicineSelectorRef}
                  key={`medicines-reset-${formResetCounter}`}
                  value={formState.medicines || []}
                  onChange={(newValue) => {
                    handleChange('medicines', newValue);
                    if ((!newValue || newValue.length === 0) && formState.reason) {
                      setFormState((prev) => ({ ...prev, reason: '' }));
                      setTimeout(() => reasonInputRef.current?.focus(), 50);
                    }
                  }}
                  brandOptions={brandOptions}
                  brandLookup={brandLookup}
                  loading={medicinesLoading}
                />
              </div>
            )}

            {/* ── SECTION 4: VACCINE FOLLOW-UP (single-patient mode only) ── */}
            {!isGroupMode && hasVaccineMedicine && (
              <div className="p-2">
                <VaccineFollowUp
                  hasVaccineMedicine={hasVaccineMedicine}
                  vaccinationPlan={vaccinationPlan}
                  formState={formState}
                  updateVaccinationPlan={updateVaccinationPlan}
                  firstVaccineMedicineName={firstVaccineMedicineName}
                  vaccineNames={vaccineNames}
                />
              </div>
            )}

          </div>
        </div>

        {/* ── RIGHT COLUMN: charges + submit ────────────────── */}
        <div className="flex w-[480px] shrink-0 flex-col gap-2">

          {/* Charges panel */}
          <div className="min-h-0 flex-1 overflow-y-auto">
            <AppointmentChargesSummary
              formState={isGroupMode
                ? { ...formState, medicines: groupPatients.flatMap((gp) => gp.medicines || []) }
                : formState}
              setFormState={setFormState}
              brandLookup={brandLookup}
              chargePresets={chargePresetsApi.items}
              surgeryChargePresets={surgeryChargePresetsApi.items}
              paymentStatusOptions={paymentStatusOptions}
            />
          </div>

          {/* Submit panel — always visible */}
          <div className="shrink-0 rounded-2xl border border-slate-200 bg-white px-2.5 py-2 shadow-sm">
            <div className="flex flex-col gap-1.5">
              <button
                type="submit"
                disabled={isSaving}
                className="btn btn-primary btn-sm w-full shadow-sm"
              >
                {isSaving ? 'Saving…' : editingId ? 'Update Treatment' : 'Complete Appointment ✓'}
              </button>
              {editingId && (
                <button type="button" onClick={resetForm} className="btn btn-outline btn-sm w-full text-slate-600">
                  Cancel Edit
                </button>
              )}
            </div>
          </div>
        </div>
      </form>

      <PatientInfoModal
        open={showPatientModal}
        onClose={() => setShowPatientModal(false)}
        selectedPatient={selectedPatient}
        selectedOwner={selectedOwner}
        history={patientHistory}
        currencyFormatter={currencyFormatter}
        startedTreatment={startedTreatment}
        diagnosticReports={formState.diagnosticReports}
        patientReportsLoading={patientReportsLoading}
        patientReportsError={patientReportsError}
        reportUploadState={reportUploadState}
        requestReportUpload={requestReportUpload}
        onReportInputChange={handleReportInputChange}
        onReportRemove={handleReportRemove}
        formatReportDisplayDate={formatReportDisplayDate}
        makeUploadKey={makeUploadKey}
        registerUploadInput={registerReportInputRef}
        editingId={editingId}
      />
    </section>
  );
};

export default AppointmentsPage;
