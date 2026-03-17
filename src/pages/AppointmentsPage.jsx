import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import AppointmentMedicineSelector, { calculateMedicinesTotal } from '../components/AppointmentMedicineSelector.jsx';
import EntityForm from '../components/EntityForm.jsx';
import PatientSearch from '../components/PatientSearch.jsx';
import QuickPatientRegistrationCard from '../components/QuickPatientRegistrationCard.jsx';
import InvoicePrintModal from '../components/InvoicePrintModal.jsx';
import PatientInfoModal from '../components/PatientInfoModal.jsx';
import { paymentStatusOptions, statusOptions } from '../constants/appointments.js';
import useEntityApi from '../hooks/useEntityApi.js';
import {
  fetchPatientReports,
  sendAppointmentInvoiceSms,
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
  mapPrescriptionToRows,
  mapReportsForPayload,
  normalizeReportEntry,
  normalizeReportsResponse
} from './appointmentsHelpers.js';
import PatientProfileTabs from '../components/PatientProfileTabs.jsx';
import AppointmentChargesSummary from '../components/AppointmentChargesSummary.jsx';
import VaccineFollowUp from '../components/VaccineFollowUp.jsx';


const currencyFormatter = new Intl.NumberFormat('en-LK', { style: 'currency', currency: 'LKR' });

const parseNullableNumber = (value) => {
  if (value === '' || value === null || value === undefined) {
    return null;
  }
  const numeric = Number(value);
  return Number.isNaN(numeric) ? null : numeric;
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
  const [formResetCounter, setFormResetCounter] = useState(0);
  // note: treatment section is always visible for a selected patient, so we
  // derive its state from the presence of a patient rather than tracking it
  // separately. this avoids clicking a "start treatment" button.
  const [dateEditing, setDateEditing] = useState(false); // controls whether the appointment time input is editable
  const [successMessage, setSuccessMessage] = useState('');
  const [formError, setFormError] = useState('');
  const [invoiceModal, setInvoiceModal] = useState({ open: false, data: null });
  const [showPatientModal, setShowPatientModal] = useState(false);
  const [invoiceSmsState, setInvoiceSmsState] = useState({ sending: false, status: null, message: '' });
  const [isSaving, setIsSaving] = useState(false);
  const [patientSearchQuery, setPatientSearchQuery] = useState('');
  const [profileTab, setProfileTab] = useState('owner');
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

  // treat treatment as started as soon as a patient id is chosen
  const startedTreatment = Boolean(formState.patientId);

  useEffect(() => {
    // whenever search text changes we should abandon any partial registration data
    setNewPatientForm(null);

    // if the user erases the field completely, clear the patient selection
    if (!patientSearchQuery.trim()) {
      if (formState.patientId) {
        setDateEditing(false);
        setProfileTab('owner');
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
      setProfileTab('owner');
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

  const reasonSuggestions = useMemo(() => {
    const recent = [];
    const seen = new Set();

    items.forEach(({ reason }) => {
      const label = typeof reason === 'string' ? reason.trim() : '';
      if (!label) {
        return;
      }
      const key = label.toLowerCase();
      if (seen.has(key)) {
        return;
      }
      seen.add(key);
      recent.push(label);
    });

    return recent.slice(0, 5);
  }, [items]);

  

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
  const isVaccineAppointment = normalizedReason.includes('vaccine');

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

  const lastPrescription = useMemo(() => {
    if (!normalizedReason) {
      return null;
    }

    return lastMedicinesLookup.get(normalizedReason) || null;
  }, [lastMedicinesLookup, normalizedReason]);

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

  const medicinesTotal = useMemo(
    () => calculateMedicinesTotal(formState.medicines || [], brandLookup),
    [formState.medicines, brandLookup]
  );

  const doctorChargeValue = useMemo(() => {
    const parsed = Number.parseFloat(formState.doctorCharge);
    return Number.isNaN(parsed) ? 0 : parsed;
  }, [formState.doctorCharge]);

  const surgeryChargeValue = useMemo(() => {
    const parsed = Number.parseFloat(formState.surgeryCharge);
    return Number.isNaN(parsed) ? 0 : parsed;
  }, [formState.surgeryCharge]);

  const serviceChargeValue = useMemo(() => {
    const parsed = Number.parseFloat(formState.otherCharge);
    return Number.isNaN(parsed) ? 0 : parsed;
  }, [formState.otherCharge]);

  const discountValue = useMemo(() => {
    const parsed = Number.parseFloat(formState.discount);
    return Number.isNaN(parsed) ? 0 : parsed;
  }, [formState.discount]);

  const totalChargeEstimate = useMemo(
    () => {
      const gross = doctorChargeValue + surgeryChargeValue + serviceChargeValue + medicinesTotal;
      return Number(Math.max(gross - discountValue, 0).toFixed(2));
    },
    [doctorChargeValue, surgeryChargeValue, serviceChargeValue, medicinesTotal, discountValue]
  );

  const handlePatientSelect = useCallback((patient) => {
    // clear validation errors when patient choice changes
    if (formError) setFormError('');

    if (!patient) {
      setFormState((prev) => ({ ...prev, patientId: '' }));
      setPatientSearchQuery('');
      setProfileTab('owner');
      setShowPatientModal(false);
      setNewPatientForm(null);
      return;
    }
    setProfileTab('owner');
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
    ({ query: searchValue }) => (
      <QuickPatientRegistrationCard
        key={selectedPatient ? `edit-${selectedPatient.id}` : 'create-new'}
        owners={owners}
        initialPatientName={searchValue}
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


  const fields = useMemo(() => {
    const list = [
      {
        name: 'patientId',
        render: () => (
          <PatientSearch
            query={patientSearchQuery}
            onQueryChange={setPatientSearchQuery}
            patients={patients}
            onSelectPatient={handlePatientSelect}
            onCreatePatient={handleQuickCreatePatient}
            selectedPatient={selectedPatient}
            renderCreateForm={renderQuickPatientForm}
            inlineRight={(
              <div className="flex flex-col gap-2">
                <span className="text-sm font-medium text-slate-600">Appointment time</span>
                {!dateEditing ? (
                  <div className="flex items-center gap-2">
                    <span className="text-base">
                      {formState.date ? new Date(formState.date).toLocaleString() : 'Current time'}
                    </span>
                    <button
                      type="button"
                      className="btn btn-xs bg-indigo-600 text-white border-indigo-600 hover:bg-indigo-700 hover:border-indigo-700"
                      onClick={() => setDateEditing(true)}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5 mr-1" aria-hidden="true">
                        <path d="M5.433 13.917 13.25 6.1l.65.65-7.816 7.817a2.25 2.25 0 0 1-.95.57l-2.02.673a.75.75 0 0 1-.948-.948l.673-2.02a2.25 2.25 0 0 1 .57-.95Z" />
                        <path d="M14.31 3.69a1.5 1.5 0 0 1 2.122 0l.878.878a1.5 1.5 0 0 1 0 2.121l-1.06 1.061-3-3 1.06-1.06Z" />
                      </svg>
                      Edit
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    <input
                      type="datetime-local"
                      value={typeof formState.date === 'string' ? formState.date : ''}
                      onChange={(event) => handleChange('date', event.target.value)}
                      className="input input-bordered bg-white w-full"
                    />
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        className="btn btn-sm btn-outline"
                        onClick={() => handleChange('date', getCurrentDateTimeLocal())}
                      >
                        Use current time
                      </button>
                      <button
                        type="button"
                        className="btn btn-xs btn-ghost"
                        onClick={() => setDateEditing(false)}
                      >
                        Done
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          />
        ),
        fullWidth: true
      }
    ];


    // Only show patient context when someone is selected
    const patientSelected = Boolean(formState.patientId || selectedPatient);

    if (patientSelected) {

      const ageParts = [];
      const years = Number.parseInt(selectedPatient?.ageYears, 10);
      const months = Number.parseInt(selectedPatient?.ageMonths, 10);
      if (!Number.isNaN(years) && years > 0) {
        ageParts.push(`${years} yr${years > 1 ? 's' : ''}`);
      }
      if (!Number.isNaN(months) && months > 0) {
        ageParts.push(`${months} mo${months > 1 ? 's' : ''}`);
      }

      list.push({
        name: '__patientProfile',
        render: () => (
          <>
            {selectedPatient && (
              <div className="mb-2 flex justify-end">
                <button
                  type="button"
                  className="btn btn-sm btn-outline btn-secondary flex items-center gap-1"
                  onClick={() => setShowPatientModal(true)}
                >
                  <span className="text-lg">👁️</span>
                  <span className="font-semibold">View patient info</span>
                </button>
              </div>
            )}
          </>
        ),
        fullWidth: true
      });

      if (startedTreatment) {
        list.push(
          {
            name: 'reason',
            label: 'Reason',
            placeholder: 'Annual wellness exam',
            // keep reason + note inline in one full-width section
            fullWidth: true,
            containerClass: 'md:col-start-1',
            render: ({ label, value, onChange, placeholder: reasonPlaceholder, values }) => {
              const currentValue = typeof value === 'string' ? value : '';
              const normalizedValue = currentValue.toLowerCase();
              const noteValue = typeof values?.notes === 'string' ? values.notes : '';

              return (
                <>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="flex flex-col gap-2">
                      <span className="text-sm font-medium text-slate-600">{label || 'Reason'}</span>
                      <input
                        type="text"
                        value={currentValue}
                        onChange={(event) => onChange(event.target.value)}
                        placeholder={reasonPlaceholder}
                        className="input input-bordered bg-white"
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <span className="text-sm font-medium text-slate-600">Notes (DD)</span>
                      <input
                        type="text"
                        value={noteValue}
                        onChange={(event) => handleChange('notes', event.target.value)}
                        placeholder="Reminder details, prep steps, etc."
                        className="input input-bordered bg-white"
                      />
                    </div>
                  </div>
                  {reasonSuggestions.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {reasonSuggestions.map((suggestion) => {
                        const isActive = suggestion.toLowerCase() === normalizedValue;
                        return (
                          <button
                            type="button"
                            key={suggestion}
                            onClick={() => onChange(suggestion)}
                            className={`btn btn-xs ${
                              isActive
                                ? 'btn-primary'
                                : 'bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100'
                            }`}
                          >
                            {suggestion}
                          </button>
                        );
                      })}
                    </div>
                  )}
     
                </>
              );
            }
          },
          // vaccination plan UI removed
          {
            name: 'medicines',
            render: ({ value, onChange }) => (
              <AppointmentMedicineSelector
                key={`medicines-reset-${formResetCounter}`}
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
            name: '__vaccineFollowUp',
            render: () => (
              <VaccineFollowUp
                hasVaccineMedicine={hasVaccineMedicine}
                vaccinationPlan={vaccinationPlan}
                formState={formState}
                updateVaccinationPlan={updateVaccinationPlan}
                firstVaccineMedicineName={firstVaccineMedicineName}
                vaccineNames={vaccineNames}
              />
            ),
            fullWidth: true
          },
          {
            name: '__chargesSummary',
            render: () => (
              <AppointmentChargesSummary
                formState={formState}
                setFormState={setFormState}
                brandLookup={brandLookup}
                chargePresets={chargePresetsApi.items}
                surgeryChargePresets={surgeryChargePresetsApi.items}
                paymentStatusOptions={paymentStatusOptions}
              />
            ),
            fullWidth: true
          }
        );
      }

      // (status and charges moved inside startedTreatment branch)
    } else {
      // Show appointment components even if no patient is found
      list.push(
        {
          name: 'reason',
          label: 'Reason',
          placeholder: 'Annual wellness exam',
          fullWidth: true,
          render: ({ label, value, onChange, placeholder: reasonPlaceholder, values }) => {
            const currentValue = typeof value === 'string' ? value : '';
            const normalizedValue = currentValue.toLowerCase();
            const noteValue = typeof values?.notes === 'string' ? values.notes : '';
            return (
              <>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="flex flex-col gap-2">
                    <span className="text-sm font-medium text-slate-600">{label || 'Reason'}</span>
                    <input
                      type="text"
                      value={currentValue}
                      onChange={(event) => onChange(event.target.value)}
                      placeholder={reasonPlaceholder}
                      className="input input-bordered bg-white"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <span className="text-sm font-medium text-slate-600">Notes (DD)</span>
                    <input
                      type="text"
                      value={noteValue}
                      onChange={(event) => handleChange('notes', event.target.value)}
                      placeholder="Reminder details, prep steps, etc."
                      className="input input-bordered bg-white"
                    />
                  </div>
                </div>
                {reasonSuggestions.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {reasonSuggestions.map((suggestion) => {
                      const isActive = suggestion.toLowerCase() === normalizedValue;
                      return (
                        <button
                          type="button"
                          key={suggestion}
                          onClick={() => onChange(suggestion)}
                          className={`btn btn-xs ${
                            isActive
                              ? 'btn-primary'
                              : 'bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100'
                          }`}
                        >
                          {suggestion}
                        </button>
                      );
                    })}
                  </div>
                )}
              </>
            );
          }
        },


        {
          name: 'medicines',
          render: ({ value, onChange }) => (
            <AppointmentMedicineSelector
              key={`medicines-reset-${formResetCounter}`}
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
            <AppointmentChargesSummary
              formState={formState}
              setFormState={setFormState}
              brandLookup={brandLookup}
              chargePresets={chargePresetsApi.items}
              surgeryChargePresets={surgeryChargePresetsApi.items}
              paymentStatusOptions={paymentStatusOptions}
            />
          ),
          fullWidth: true
        }
      );
    }

    return list;
  }, [
    brandLookup,
    brandOptions,
    doctorChargeValue,
    surgeryChargeValue,
    discountValue,
    chargePresetsApi.items,
    surgeryChargePresetsApi.items,
    formState.paymentStatus,
    formState.paymentType,
    handlePatientSelect,
    lastPrescription,
    medicinesLoading,
    medicinesTotal,
    patientSearchQuery,
    patients,
    items,
    owners,
    currencyFormatter,
    reasonSuggestions,
    selectedPatient,
    selectedOwner,
    profileTab,
    startedTreatment,
    totalChargeEstimate,
    editingId,
    patientReportsLoading,
    patientReportsError,
    formState.diagnosticReports,
    handleReportInputChange,
    handleReportRemove,
    reportUploadState,
    requestReportUpload,
    registerReportInputRef,
    vaccinationPlan,
    isVaccineAppointment,
    updateVaccinationPlan,
    renderQuickPatientForm,
    handleQuickCreatePatient
  ]);

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

  const resetInvoiceSmsState = useCallback(() => {
    setInvoiceSmsState({ sending: false, status: null, message: '' });
  }, []);

  const closeInvoiceModal = useCallback(() => {
    setInvoiceModal({ open: false, data: null });
    resetInvoiceSmsState();
  }, [resetInvoiceSmsState]);

  const handleSendInvoiceSms = useCallback(async () => {
    const appointmentId = invoiceModal?.data?.appointmentId;
    if (!appointmentId) {
      setInvoiceSmsState({ sending: false, status: 'error', message: 'Missing appointment reference' });
      return;
    }

    setInvoiceSmsState({ sending: true, status: null, message: '' });
    try {
      await sendAppointmentInvoiceSms(appointmentId);
      setInvoiceSmsState({ sending: false, status: 'success', message: 'Invoice SMS sent to owner' });
    } catch (error) {
      setInvoiceSmsState({
        sending: false,
        status: 'error',
        message: error?.message || 'Failed to send SMS'
      });
    }
  }, [invoiceModal]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (isSaving) {
      return;
    }

    // clear previous form validation message
    if (formError) setFormError('');

    // validate patient name when new registration is present
    if (!formState.patientId && newPatientForm) {
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

    // reason is mandatory before marking completed
    if (formState.status === 'completed' && (!formState.reason || !formState.reason.trim())) {
      setFormError('Reason is required before completing the appointment.');
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

        // if appointment completed, show success and invoice modal
        if (payload.status === 'completed') {
          const appointmentId = result.data?.id ?? editingId ?? null;
          const respPatientName = result.data?.patient?.name;
          resetInvoiceSmsState();
          setSuccessMessage('Appointment completed');
          setInvoiceModal({ open: true, data: {
            doctorCharge: doctor,
              surgeryCharge: surgery,
            otherCharge: service,
            otherChargeReason: payload.otherChargeReason || null,
            medicinesSubtotal,
            discount,
            estimated,
            patientName: respPatientName || selectedPatient?.name || (formState.patientId ? `Patient #${formState.patientId}` : ''),
            appointmentId,
            medicines: result.data?.medicines || []
          } });
          // auto-clear success message after a short while
          setTimeout(() => setSuccessMessage(''), 4000);
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
    setFormState(mapAppointmentToFormState(appointment));
    setEditingId(appointment.id);
    setPatientSearchQuery(appointment.patient?.name || '');
    setDateEditing(false);
    setProfileTab('owner');
    setReportUploadState({});
    reportFileInputsRef.current = {};
  }, [mapAppointmentToFormState]);

  const resetForm = () => {
    setEditingId(null);
    // Increment reset counter to force remount of all form components
    setFormResetCounter(prev => prev + 1);
    // Explicitly clear form state with empty values
    setFormState({
      patientId: '',
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
    setProfileTab('owner');
    setReportUploadState({});
    reportFileInputsRef.current = {};
    setNewPatientForm(null);
    setShowPatientModal(false);
    setFormError('');
    setSuccessMessage('');
    // Reset the reason autofill ref to prevent medicines from being auto-populated
    if (reasonAutofillRef.current) {
      reasonAutofillRef.current = '';
    }
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

  const reasonAutofillRef = useRef('');

  useEffect(() => {
    if (!normalizedReason) {
      return;
    }

    // Skip auto-fill when editing existing appointments
    if (editingId) {
      return;
    }

    // Only auto-populate medicines if the table is currently empty
    const medicinesAreEmpty = !Array.isArray(formState.medicines) || formState.medicines.length === 0;
    if (!medicinesAreEmpty) {
      // User has already selected medicines, don't override them
      return;
    }

    // Look up medicines for this reason from previous appointments
    const prescription = lastPrescription;
    
    if (!prescription || !prescription.medicines.length) {
      // No previous medicines found, keep table empty
      return;
    }

    // Populate medicines from previous appointment with this reason
    setFormState((prev) => ({
      ...prev,
      medicines: prescription.medicines.map((item) => ({ ...item }))
    }));
  }, [normalizedReason, editingId, lastPrescription, formState.medicines.length]);

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
    <section className="space-y-2">
      {successMessage && (
        <div className="alert alert-success shadow-sm">
          <span>{successMessage}</span>
        </div>
      )}
      {formError && (
        <div className="alert alert-error shadow-sm">
          <span>{formError}</span>
        </div>
      )}
      {combinedError && (
        <div className="alert alert-error shadow-sm">
          <span>{combinedError}</span>
        </div>
      )}
      

      {/* show submit button whenever the form has progressed past just the search
          (typing in the search field or actually selecting a patient), or while editing */}
      <EntityForm
        fields={fields}
        values={formState}
        onChange={handleChange}
        onSubmit={handleSubmit}
        preventSubmitOnEnter={true}
        submitLabel={editingId ? 'Update treatment' : 'Complete Appointment'}
        isEditing={Boolean(editingId)}
        onCancel={resetForm}
        showSubmit={true}
        submitLoading={isSaving}
      />
      {/* veterinarian removed from form */}

      <InvoicePrintModal
        open={invoiceModal.open}
        invoice={invoiceModal.data}
        onClose={closeInvoiceModal}
        onSendSms={invoiceModal.data?.appointmentId ? handleSendInvoiceSms : null}
        smsSending={invoiceSmsState.sending}
        smsStatus={invoiceSmsState.status}
        smsMessage={invoiceSmsState.message}
        currencyFormatter={currencyFormatter}
      />

      {/* patient info modal */}
      <PatientInfoModal
        open={showPatientModal}
        onClose={() => setShowPatientModal(false)}
        selectedPatient={selectedPatient}
        selectedOwner={selectedOwner}
        history={history}
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
