// Capitalize the first letter of a string
const capitalizeFirstLetter = (value) => {
  if (!value) return '';
  return value.charAt(0).toUpperCase() + value.slice(1);
};
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import JsBarcode from 'jsbarcode';
import { Eye, Printer, RefreshCw } from 'lucide-react';
import { useClinicSettings } from '../context/ClinicSettingsContext.jsx';

const DEFAULT_BREEDS = ['Mixed breed', 'Unknown', 'Other'];
const BREED_DATALIST_ID = 'quick-patient-breed-options';
const WALKING_OWNER_LABEL = 'Walking Patient';
const WALKING_OWNER_STORAGE_KEY = 'vet.walkingOwnerId';

const normalizeOwnerName = (owner) => {
  const parts = [owner?.firstName, owner?.lastName].filter(Boolean).join(' ').trim();
  return parts.toLowerCase();
};

const findWalkingOwnerFromList = (owners = []) => owners.find((owner) => {
  const fullName = normalizeOwnerName(owner);
  return fullName === WALKING_OWNER_LABEL.toLowerCase()
    || (owner?.firstName || '').trim().toLowerCase() === WALKING_OWNER_LABEL.toLowerCase();
});

const escapeHtml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const normalizePassbookValue = (value) => {
  if (value == null) return '';

  if (typeof value === 'object') {
    if (typeof value.passbookNumber === 'string') {
      return value.passbookNumber.trim();
    }
    if (typeof value.passbook_number === 'string') {
      return value.passbook_number.trim();
    }
    return '';
  }

  const stringValue = String(value).trim();
  if (!stringValue) return '';

  if (stringValue.startsWith('{') && stringValue.endsWith('}')) {
    try {
      const parsed = JSON.parse(stringValue);
      if (typeof parsed?.passbookNumber === 'string') {
        return parsed.passbookNumber.trim();
      }
      if (typeof parsed?.passbook_number === 'string') {
        return parsed.passbook_number.trim();
      }
    } catch {
      return stringValue;
    }
  }

  return stringValue;
};

const toNullableNumber = (value) => {
  if (value === '' || value === null || value === undefined) {
    return null;
  }
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
};

const createEmptyForm = (_owners = [], _preferredOwnerId = null, initialData = null) => {
  // note: we no longer default to an owner; user must explicitly pick or enter
  void _owners; void _preferredOwnerId; // prevent unused-variable warnings
  const initialOwnerId = initialData?.ownerId ?? initialData?.owner?.id ?? '';
  const base = {
    patientName: '',
    species: '',
    breed: '',
    gender: 'male',            // default to male as requested
    ageYears: '',
    ageMonths: '',
    weight: '',
    existingOwnerId: initialOwnerId ? String(initialOwnerId) : '',
    ownerFirstName: '',
    ownerPhone: '',
    ownerEmail: '',
    isWalkingPatient: false
  };

  if (initialData) {
    return {
      ...base,
      patientName: initialData.name || base.patientName,
      species: initialData.species || base.species,
      breed: initialData.breed || base.breed,
      gender: initialData.gender || base.gender,
      ageYears: initialData.ageYears != null ? String(initialData.ageYears) : base.ageYears,
      ageMonths: initialData.ageMonths != null ? String(initialData.ageMonths) : base.ageMonths,
      weight: initialData.weight != null ? String(initialData.weight) : base.weight,
      existingOwnerId: initialOwnerId ? String(initialOwnerId) : base.existingOwnerId
    };
  }

  return base;
};


const QuickPatientRegistrationCard = ({
  owners = [],
  initialPatientName = '',
  initialValues = null,        // optional existing patient data used to prefill
  passbookPreview: passbookProp = '',
  createOwner = async () => ({ success: false }),
  createPatient = async () => ({ success: false }),
  updatePatient = async () => ({ success: false }),
  refreshOwners = () => {},
  refreshPatients = () => {},
  onPatientCreated = () => {},
  onPatientUpdated = () => {},
  onFormChange = null,           // called with latest internal form state
  hideActions = false,           // if true, do not render save/clear buttons
  onViewPatientInfo = null
}) => {
  const { settings } = useClinicSettings();
  const [form, setForm] = useState(() => createEmptyForm(owners, null, initialValues));
  const [ownerSearch, setOwnerSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [passbookPreview, setPassbookPreview] = useState(() => normalizePassbookValue(passbookProp));
  const [passbookLoading] = useState(false); // no loading now, value comes from parent
  const patientNameTouchedRef = useRef(false);
  const canUpdateExisting = Boolean(initialValues?.id);

  useEffect(() => {
    setPassbookPreview(normalizePassbookValue(passbookProp));
  }, [passbookProp]);


  useEffect(() => {
    if (!initialPatientName) {
      patientNameTouchedRef.current = false;
    }
    setForm((prev) => {
      if (patientNameTouchedRef.current) {
        return prev;
      }
      const nextName = initialPatientName || '';
      if ((prev.patientName || '') === nextName) {
        return prev;
      }
      return { ...prev, patientName: nextName };
    });
  }, [initialPatientName]);

  // notify parent of initial form state when mounted or whenever it changes
  useEffect(() => {
    if (typeof onFormChange === 'function') {
      onFormChange(form);
    }
  }, [form, onFormChange]);


  // detect owner object from incoming patient data or the owners list
  const initialOwner = useMemo(() => {
    if (!initialValues) return null;
    if (initialValues.owner) return initialValues.owner;
    if (initialValues.ownerId) {
      return owners.find((o) => String(o.id) === String(initialValues.ownerId)) || null;
    }
    return null;
  }, [initialValues, owners]);

  // when incoming initialValues changes populate form
  useEffect(() => {
    if (!initialValues) {
      // clear any residual owner search when selection is removed
      setOwnerSearch('');
      return;
    }

    const derivedOwnerId = initialValues.ownerId ?? initialValues.owner?.id ?? '';
    setForm((prev) => ({
      ...prev,
      patientName: initialValues.name || prev.patientName,
      species: initialValues.species || prev.species,
      breed: initialValues.breed || prev.breed,
      gender: initialValues.gender || prev.gender,
      ageYears: initialValues.ageYears != null ? String(initialValues.ageYears) : prev.ageYears,
      ageMonths: initialValues.ageMonths != null ? String(initialValues.ageMonths) : prev.ageMonths,
      weight: initialValues.weight != null ? String(initialValues.weight) : prev.weight,
      existingOwnerId: derivedOwnerId ? String(derivedOwnerId) : prev.existingOwnerId,
      // if the incoming owner had phone/email we carry that into form state (won't be shown
      // when existingOwnerId is set, but could be useful if user clears selection)
      ownerPhone: initialValues.owner?.phone || prev.ownerPhone,
      ownerEmail: initialValues.owner?.email || prev.ownerEmail
    }));

    // when selected patient changes, mirror the parent's passbook value too
    const pb = normalizePassbookValue(initialValues.passbookNumber || initialValues.passbook_number);
    if (pb) {
      setPassbookPreview(pb);
    }
  }, [initialValues]);

  const ownerLabel = useCallback((owner) => {
    const parts = [owner.firstName, owner.lastName].filter(Boolean).join(' ').trim();
    const displayName = parts || 'Unnamed owner';
    return `${displayName}${owner.phone ? ` • ${owner.phone}` : ''}`;
  }, []);

  // sync owner search text whenever we have a resolved owner
  useEffect(() => {
    if (initialOwner) {
      setOwnerSearch(ownerLabel(initialOwner));
    }
  }, [initialOwner, ownerLabel]);



  useEffect(() => {
    if (!success) {
      return undefined;
    }
    const timeout = setTimeout(() => setSuccess(''), 3500);
    return () => clearTimeout(timeout);
  }, [success]);

  const handleInputChange = useCallback((field, value) => {
    if (field === 'patientName') {
      patientNameTouchedRef.current = true;
    }
    setForm((prev) => {
      let next = { ...prev, [field]: value };
      
      // Handle walking patient toggle
      if (field === 'isWalkingPatient') {
        if (value === true) {
          const walkingOwner = findWalkingOwnerFromList(owners);
          next = {
            ...next,
            ownerFirstName: WALKING_OWNER_LABEL,
            existingOwnerId: walkingOwner?.id ? String(walkingOwner.id) : '',
            ownerPhone: '',
            ownerEmail: ''
          };
          if (walkingOwner?.id) {
            try {
              window.localStorage.setItem(WALKING_OWNER_STORAGE_KEY, String(walkingOwner.id));
            } catch {
              // noop
            }
          }
          setOwnerSearch(WALKING_OWNER_LABEL);
        } else {
          next = {
            ...next,
            ownerFirstName: '',
            existingOwnerId: '',
            ownerPhone: '',
            ownerEmail: ''
          };
          setOwnerSearch('');
        }
      }
      
      if (typeof onFormChange === 'function') {
        onFormChange(next);
      }
      return next;
    });
    setError('');
    setSuccess('');
  }, [onFormChange, owners]);


  const handleReset = useCallback(() => {
    patientNameTouchedRef.current = false;
    const empty = createEmptyForm(owners);
    setForm(empty);
    setOwnerSearch('');
    setError('');
    setSuccess('');
    if (typeof onFormChange === 'function') {
      onFormChange(empty);
    }
  }, [owners, onFormChange]);

  const handleSubmit = useCallback(async () => {
    if (saving) {
      return;
    }

    const patientName = (form.patientName || '').trim();

    if (!patientName) {
      setError('Patient name is required.');
      return;
    }

    let ownerId = null;
    if (form.existingOwnerId) {
      ownerId = Number(form.existingOwnerId);
      if (!ownerId) {
        setError('Select an owner to link this patient.');
        return;
      }
    } else {
      // When creating a new owner, name is required
      const ownerName = (form.ownerFirstName || '').trim();
      if (!ownerName) {
        setError('Owner name is required.');
        return;
      }
    }

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      if (!form.existingOwnerId) {
        // For walking patients, find or create a single "Walking Patient" owner
        if (form.isWalkingPatient) {
          let walkingOwnerId = null;

          try {
            const cachedWalkingOwnerId = window.localStorage.getItem(WALKING_OWNER_STORAGE_KEY);
            if (cachedWalkingOwnerId) {
              const parsedId = Number(cachedWalkingOwnerId);
              if (!Number.isNaN(parsedId) && parsedId > 0) {
                walkingOwnerId = parsedId;
              }
            }
          } catch {
            // noop
          }

          const walkingPatientOwner = findWalkingOwnerFromList(owners);
          
          if (walkingPatientOwner?.id) {
            ownerId = walkingPatientOwner.id;
            try {
              window.localStorage.setItem(WALKING_OWNER_STORAGE_KEY, String(ownerId));
            } catch {
              // noop
            }
          } else if (walkingOwnerId) {
            ownerId = walkingOwnerId;
          } else {
            // Create the "Walking Patient" owner once
            const ownerPayload = {
              firstName: WALKING_OWNER_LABEL,
              phone: null,
              email: null
            };
            const ownerResult = await createOwner(ownerPayload);
            if (!ownerResult?.success) {
              throw new Error(ownerResult?.message || 'Could not create walking patient owner');
            }
            ownerId = ownerResult.data?.id;
            if (!ownerId) {
              throw new Error('Owner reference missing in response');
            }
            try {
              window.localStorage.setItem(WALKING_OWNER_STORAGE_KEY, String(ownerId));
            } catch {
              // noop
            }
            // Refresh owners list so the walking patient owner is available for next time
            await refreshOwners();
          }
        } else {
          // Regular new owner creation
          const ownerPayload = {
            firstName: (form.ownerFirstName || '').trim(),
            phone: (form.ownerPhone || '').trim() || null,
            email: (form.ownerEmail || '').trim() || null
          };
          const ownerResult = await createOwner(ownerPayload);
          if (!ownerResult?.success) {
            throw new Error(ownerResult?.message || 'Could not create owner');
          }
          ownerId = ownerResult.data?.id;
          if (!ownerId) {
            throw new Error('Owner reference missing in response');
          }
        }
      }

      const patientPayload = {
        name: patientName,
        species: form.species || null,
        breed: form.breed || null,
        gender: form.gender || null,
        ageYears: form.ageYears !== '' ? Number(form.ageYears) || null : null,
        ageMonths: form.ageMonths !== '' ? Number(form.ageMonths) || null : null,
        weight: form.weight !== '' ? Number(form.weight) || null : null,
        ownerId,
        notes: null
      };
      const patientResult = await createPatient(patientPayload);
      if (!patientResult?.success) {
        throw new Error(patientResult?.message || 'Could not create patient');
      }
      const patientData = patientResult.data;
      onPatientCreated(patientData);
      setSuccess('Patient registered and selected.');
      setError('');
      patientNameTouchedRef.current = false;
      setForm(createEmptyForm(owners, ownerId));
      refreshPatients();
      refreshOwners();
    } catch (submitError) {
      setError(submitError?.message || 'Failed to register patient');
    } finally {
      setSaving(false);
    }
  }, [
    createOwner,
    createPatient,
    form,
    onPatientCreated,
    owners,
    refreshOwners,
    refreshPatients,
    saving
  ]);

  const handleUpdateExisting = useCallback(async () => {
    if (!canUpdateExisting || saving || !initialValues?.id) {
      return;
    }

    const patientName = (form.patientName || '').trim();
    if (!patientName) {
      setError('Patient name is required to update.');
      return;
    }

    let ownerId = null;
    if (form.existingOwnerId) {
      const parsedOwner = Number(form.existingOwnerId);
      ownerId = Number.isFinite(parsedOwner) && parsedOwner > 0 ? parsedOwner : null;
    } else if (initialValues?.owner?.id) {
      ownerId = initialValues.owner.id;
    }

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      if (!ownerId && (form.ownerFirstName || form.ownerPhone || form.ownerEmail)) {
        const ownerPayload = {
          firstName: (form.ownerFirstName || '').trim() || null,
          phone: (form.ownerPhone || '').trim() || null,
          email: (form.ownerEmail || '').trim() || null
        };
        const ownerResult = await createOwner(ownerPayload);
        if (!ownerResult?.success) {
          throw new Error(ownerResult?.message || 'Could not create owner');
        }
        ownerId = ownerResult.data?.id ?? null;
        if (!ownerId) {
          throw new Error('Owner reference missing in response');
        }
        if (ownerResult.data) {
          setOwnerSearch(ownerLabel(ownerResult.data));
        }
        setForm((prev) => ({ ...prev, existingOwnerId: String(ownerId) }));
        await refreshOwners();
      }

      const payload = {
        name: patientName,
        species: form.species || null,
        breed: form.breed || null,
        gender: form.gender || null
      };
      const ageYearsValue = toNullableNumber(form.ageYears);
      if (ageYearsValue !== null) {
        payload.ageYears = ageYearsValue;
      }
      const ageMonthsValue = toNullableNumber(form.ageMonths);
      if (ageMonthsValue !== null) {
        payload.ageMonths = ageMonthsValue;
      }
      const weightValue = toNullableNumber(form.weight);
      if (weightValue !== null) {
        payload.weight = weightValue;
      }
      if (ownerId) {
        payload.ownerId = ownerId;
      }

      const result = await updatePatient(initialValues.id, payload);
      if (!result?.success) {
        throw new Error(result?.message || 'Failed to update patient');
      }

      const updatedPatient = result.data;
      setSuccess('Patient details updated.');
      if (updatedPatient) {
        setForm((prev) => ({
          ...prev,
          patientName: updatedPatient.name ?? prev.patientName,
          species: updatedPatient.species ?? prev.species,
          breed: updatedPatient.breed ?? prev.breed,
          gender: updatedPatient.gender ?? prev.gender,
          ageYears: updatedPatient.ageYears != null ? String(updatedPatient.ageYears) : prev.ageYears,
          ageMonths: updatedPatient.ageMonths != null ? String(updatedPatient.ageMonths) : prev.ageMonths,
          weight: updatedPatient.weight != null ? String(updatedPatient.weight) : prev.weight,
          existingOwnerId: updatedPatient.owner?.id ? String(updatedPatient.owner.id) : prev.existingOwnerId
        }));
        if (updatedPatient.owner) {
          setOwnerSearch(ownerLabel(updatedPatient.owner));
        }
      }

      await refreshPatients();
      onPatientUpdated(updatedPatient || null);
    } catch (submitError) {
      setError(submitError?.message || 'Failed to update patient');
    } finally {
      setSaving(false);
    }
  }, [
    canUpdateExisting,
    saving,
    initialValues,
    form,
    createOwner,
    ownerLabel,
    refreshOwners,
    updatePatient,
    refreshPatients,
    onPatientUpdated
  ]);



  const filteredOwners = useMemo(() => {
    if (!ownerSearch) return owners;
    const q = ownerSearch.toLowerCase();
    return owners.filter((owner) => ownerLabel(owner).toLowerCase().includes(q));
  }, [ownerSearch, owners, ownerLabel]);


  const handleOwnerSelect = useCallback((owner) => {
    setForm((prev) => ({ ...prev, existingOwnerId: String(owner.id), ownerFirstName: '' }));
    setOwnerSearch(ownerLabel(owner));
  }, [ownerLabel]);

  const handlePrintPassbookBarcode = useCallback(async () => {
    const passbookValue = String(passbookPreview || '').trim();
    const clinicName = String(settings?.name || 'Clinic').trim();
    if (!passbookValue) {
      setError('Passbook number is not available for barcode printing.');
      return;
    }

    try {
      const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      JsBarcode(tempSvg, passbookValue, {
        format: 'CODE128',
        displayValue: false,
        width: 2,
        height: 70,
        margin: 8
      });

      const barcodeSvg = tempSvg.outerHTML;
      const safeClinicName = escapeHtml(clinicName || 'Clinic');
      const safePassbook = escapeHtml(passbookValue);

      const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Passbook Barcode</title>
    <style>
      @page { size: auto; margin: 10mm; }
      body { margin: 0; font-family: Arial, sans-serif; display: flex; min-height: 100vh; align-items: center; justify-content: center; background: #ffffff; }
      .label { border: 1px solid #d1d5db; border-radius: 8px; padding: 16px; text-align: center; width: 320px; }
      .title { font-size: 15px; font-weight: 700; margin-bottom: 2px; }
      .subtitle { font-size: 14px; font-weight: 600; margin-bottom: 10px; }
      .barcode { display: flex; justify-content: center; margin-bottom: 8px; }
      .code { font-family: monospace; font-size: 16px; letter-spacing: 0.08em; }
    </style>
  </head>
  <body>
    <div class="label">
      <div class="title">${safeClinicName}</div>
      <div class="subtitle">Passbook Barcode</div>
      <div class="barcode">${barcodeSvg}</div>
      <div class="code">${safePassbook}</div>
    </div>
  </body>
</html>`;

      if (window.electronAPI?.printBarcode) {
        const config = await window.electronAPI.getPrinterConfig().catch(() => ({}));
        const printerName = config?.barcode?.name || '';
        console.log('[printBarcode] printer:', printerName || '(default)');
        const result = await window.electronAPI.printBarcode(html, printerName);
        console.log('[printBarcode] result:', result);
        return;
      }

      const printWindow = window.open('', '_blank', 'width=420,height=620');
      if (!printWindow) {
        setError('Unable to open print window. Please allow popups and try again.');
        return;
      }
      printWindow.document.open();
      printWindow.document.write(html.replace('</body>', `<script>setTimeout(function(){window.print();setTimeout(function(){window.close();},100);},120);<\/script></body>`));
      printWindow.document.close();
    } catch (printError) {
      setError(printError?.message || 'Failed to generate barcode for printing.');
    }
  }, [passbookPreview, settings?.name]);



  const isOther = form.species !== 'Canine' && form.species !== 'Feline';
  const inputSm = 'input input-sm input-bordered w-full bg-white text-sm text-slate-800 placeholder:text-slate-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100';

  return (
    <div className="space-y-2.5">
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
          {error}
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
          {success}
        </div>
      )}

      {/* ── Row 1: Patient identity ── */}
      <div className="flex flex-wrap items-end gap-2">

        {/* Patient name */}
        <div className="flex flex-col gap-1 min-w-[120px] flex-1">
          <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            Patient name <span className="text-rose-400">*</span>
          </label>
          <input
            type="text"
            className={inputSm}
            value={form.patientName}
            onChange={(e) => handleInputChange('patientName', capitalizeFirstLetter(e.target.value))}
            placeholder="Name"
          />
        </div>

        {/* Species — pill toggle */}
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Species</label>
          <div className="flex items-center gap-1">
            <div className="flex overflow-hidden rounded-lg border border-slate-200">
              {['Canine', 'Feline', 'Other'].map((s, i) => {
                const active = s === 'Other' ? isOther : form.species === s;
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => handleInputChange('species', s === 'Other' ? '' : s)}
                    className={`px-2.5 py-1.5 text-xs font-semibold transition ${i < 2 ? 'border-r border-slate-200' : ''} ${
                      active ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {s}
                  </button>
                );
              })}
            </div>
            {isOther && (
              <input
                type="text"
                className="input input-sm input-bordered w-24 bg-white text-sm text-slate-800 placeholder:text-slate-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                value={form.species}
                onChange={(e) => handleInputChange('species', capitalizeFirstLetter(e.target.value))}
                placeholder="Species…"
                autoFocus
              />
            )}
          </div>
        </div>

        {/* Breed */}
        <div className="flex flex-col gap-1 w-28">
          <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Breed</label>
          <input
            type="text"
            list={BREED_DATALIST_ID}
            className={inputSm}
            value={form.breed}
            onChange={(e) => handleInputChange('breed', capitalizeFirstLetter(e.target.value))}
            placeholder="Breed"
          />
          <datalist id={BREED_DATALIST_ID}>
            {DEFAULT_BREEDS.map((opt) => <option key={opt} value={opt} />)}
          </datalist>
        </div>

        {/* Gender — M / F pill toggle */}
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Sex</label>
          <div className="flex overflow-hidden rounded-lg border border-slate-200">
            {[['male','M'],['female','F']].map(([val, lbl], i) => (
              <button
                key={val}
                type="button"
                onClick={() => handleInputChange('gender', val)}
                className={`px-3 py-1.5 text-xs font-bold transition ${i === 0 ? 'border-r border-slate-200' : ''} ${
                  form.gender === val ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                {lbl}
              </button>
            ))}
          </div>
        </div>

        {/* Age Y */}
        <div className="flex flex-col gap-1 w-20">
          <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Yr</label>
          <input
            type="number" min="0" max="30"
            className="input input-sm input-bordered w-full bg-white text-center text-sm text-slate-800 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
            value={form.ageYears}
            onChange={(e) => handleInputChange('ageYears', e.target.value)}
            placeholder="0"
          />
        </div>

        {/* Age M */}
        <div className="flex flex-col gap-1 w-20">
          <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Mo</label>
          <input
            type="number" min="0" max="12"
            className="input input-sm input-bordered w-full bg-white text-center text-sm text-slate-800 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
            value={form.ageMonths}
            onChange={(e) => handleInputChange('ageMonths', e.target.value)}
            placeholder="0"
          />
        </div>

        {/* Weight */}
        <div className="flex flex-col gap-1 w-24">
          <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Kg</label>
          <input
            type="number" min="0" step="0.1"
            className="input input-sm input-bordered w-full bg-white text-center text-sm text-slate-800 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
            value={form.weight}
            onChange={(e) => handleInputChange('weight', e.target.value)}
            placeholder="0.0"
          />
        </div>
      </div>

      {/* ── Row 2: Owner + Passbook — single inline bar ── */}
      <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5">

        {/* Owner label + walk-in toggle */}
        <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
          Owner <span className="text-rose-400">*</span>
        </span>
        <label className="flex shrink-0 cursor-pointer items-center gap-1">
          <input
            type="checkbox"
            className="h-3 w-3 rounded border-amber-400 accent-amber-500"
            checked={form.isWalkingPatient}
            onChange={(e) => handleInputChange('isWalkingPatient', e.target.checked)}
          />
          <span className="text-[10px] font-semibold uppercase tracking-wide text-amber-600">Walk-in</span>
        </label>

        {/* Owner search input */}
        <div className="relative min-w-[140px] flex-1">
          <input
            type="text"
            value={ownerSearch}
            onChange={(e) => {
              if (!form.isWalkingPatient) {
                const capitalized = capitalizeFirstLetter(e.target.value);
                setOwnerSearch(capitalized);
                setForm((prev) => ({ ...prev, existingOwnerId: '', ownerFirstName: capitalized }));
              }
            }}
            placeholder="Search or type owner name"
            className={`input input-xs input-bordered w-full text-sm text-slate-800 placeholder:text-slate-400 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-100 ${
              form.existingOwnerId || form.isWalkingPatient ? 'cursor-not-allowed bg-slate-100' : 'bg-white'
            }`}
            readOnly={!!form.existingOwnerId || form.isWalkingPatient}
          />
          {ownerSearch && filteredOwners.length > 0 && !form.existingOwnerId && !form.isWalkingPatient && (
            <ul className="absolute left-0 right-0 top-full z-10 mt-1 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
              {filteredOwners.slice(0, 6).map((owner) => (
                <li key={owner.id}>
                  <button
                    type="button"
                    className="w-full px-3 py-1.5 text-left text-xs text-slate-700 hover:bg-blue-50"
                    onClick={() => handleOwnerSelect(owner)}
                  >
                    {ownerLabel(owner)}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Change owner */}
        {form.existingOwnerId && (
          <button
            type="button"
            className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
            onClick={() => { setForm((prev) => ({ ...prev, existingOwnerId: '' })); setOwnerSearch(''); }}
          >
            <RefreshCw size={10} /> Change
          </button>
        )}

        {/* Phone — inline, no label row */}
        {!form.existingOwnerId && !form.isWalkingPatient && (
          <input
            type="tel"
            className="input input-xs input-bordered w-28 shrink-0 bg-white text-sm text-slate-800 placeholder:text-slate-400 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-100"
            value={form.ownerPhone}
            onChange={(e) => handleInputChange('ownerPhone', e.target.value)}
            placeholder="Phone (opt)"
          />
        )}

        {/* Passbook + Print + View */}
        <div className="ml-auto flex shrink-0 items-center gap-1.5 rounded-lg border border-sky-200 bg-sky-50 px-2.5 py-1">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-sky-600 whitespace-nowrap">
            {initialValues?.passbookNumber ? 'PB' : 'Next PB'}
          </span>
          <span className="font-mono text-xs font-bold text-slate-800">
            {passbookLoading ? '…' : passbookPreview || '—'}
          </span>
          <button
            type="button"
            data-print-passbook
            className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2 py-1 text-[10px] font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-40"
            onClick={handlePrintPassbookBarcode}
            disabled={!passbookPreview}
            title="Print passbook barcode (F4)"
          >
            <Printer size={10} /> Print
          </button>
          {onViewPatientInfo && initialValues && (
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-2 py-1 text-[10px] font-semibold text-white transition hover:bg-blue-700"
              onClick={onViewPatientInfo}
              title="View patient profile"
            >
              <Eye size={10} /> Info
            </button>
          )}
        </div>
      </div>

      {/* Actions — only when not embedded in parent form */}
      {(!hideActions || canUpdateExisting) && (
        <div className="flex flex-wrap gap-2 pt-1">
          {!hideActions && (
            <>
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-60"
                onClick={handleSubmit}
                disabled={saving}
              >
                {saving ? 'Saving…' : 'Save & Select'}
              </button>
              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
                onClick={handleReset}
                disabled={saving}
              >
                Clear
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default QuickPatientRegistrationCard;



