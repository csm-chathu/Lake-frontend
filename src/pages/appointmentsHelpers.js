const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const pad = (value) => String(value).padStart(2, '0');
const isBlank = (value) => value === null || value === undefined || String(value).trim() === '';

const toDate = (value) => {
  if (!value) {
    return null;
  }
  if (value instanceof Date) {
    return Number.isNaN(value.valueOf()) ? null : value;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.valueOf()) ? null : parsed;
};

export const formatDateInput = (value) => {
  if (!value) {
    return '';
  }
  if (typeof value === 'string' && DATE_ONLY_REGEX.test(value)) {
    return value;
  }
  const date = toDate(value);
  if (!date) {
    return '';
  }
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

export const formatDateTimeLocal = (value) => {
  const date = toDate(value);
  if (!date) {
    return '';
  }
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

export const getCurrentDateTimeLocal = () => formatDateTimeLocal(new Date());

export const createEmptyVaccinationPlan = () => ({
  enabled: false,
  vaccineName: '',
  doseNumber: '',
  administeredAt: '',
  nextDueAt: '',
  remindBeforeDays: '',
  notes: ''
});

export const createEmptyAppointment = () => ({
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

export const generateReportClientId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  const randomPart = Math.random().toString(36).slice(2, 10);
  return `report-${Date.now()}-${randomPart}`;
};

export const makeUploadKey = (reportType, key) => `${reportType || 'report'}::${key ?? 'new'}`;

const normalizeNumber = (value) => {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

const normalizeInteger = (value) => {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? null : parsed;
};

const toIsoOrNull = (value) => {
  const date = toDate(value);
  return date ? date.toISOString() : null;
};

const sanitizeText = (value) => {
  if (typeof value !== 'string') {
    return '';
  }
  return value.trim();
};

export const normalizeReportEntry = (input = {}) => {
  const reportType = input.type && String(input.type).trim() ? String(input.type).trim() : 'labs';
  const reportedAt = toIsoOrNull(input.reportedAt || input.createdAt || input.updatedAt);
  const clientId = input.clientId || (input.id ? String(input.id) : generateReportClientId());

  return {
    id: input.id ?? null,
    appointmentId: input.appointmentId ?? null,
    patientId: input.patientId ?? null,
    type: reportType,
    label: typeof input.label === 'string' ? input.label : '',
    fileUrl: typeof input.fileUrl === 'string' ? input.fileUrl : '',
    filePublicId: typeof input.filePublicId === 'string' ? input.filePublicId : null,
    mimeType: typeof input.mimeType === 'string' ? input.mimeType : null,
    fileBytes: normalizeInteger(input.fileBytes),
    reportedAt,
    createdAt: input.createdAt ?? null,
    updatedAt: input.updatedAt ?? null,
    clientId
  };
};

export const normalizeReportsResponse = (response) => {
  if (!response) {
    return [];
  }
  let reports = [];
  if (Array.isArray(response)) {
    reports = response;
  } else if (Array.isArray(response.reports)) {
    reports = response.reports;
  } else if (Array.isArray(response.data?.reports)) {
    reports = response.data.reports;
  } else if (Array.isArray(response.diagnosticReports)) {
    reports = response.diagnosticReports;
  }
  return reports
    .map(normalizeReportEntry)
    .filter((entry) => Boolean(entry.fileUrl));
};

export const mapReportsForPayload = (reports = []) => {
  if (!Array.isArray(reports)) {
    return [];
  }
  return reports
    .map((report) => {
      if (!report || !report.fileUrl) {
        return null;
      }
      return {
        type: report.type || 'labs',
        label: sanitizeText(report.label) || null,
        fileUrl: report.fileUrl,
        filePublicId: report.filePublicId || null,
        mimeType: report.mimeType || null,
        fileBytes: normalizeInteger(report.fileBytes),
        reportedAt: toIsoOrNull(report.reportedAt) || null
      };
    })
    .filter(Boolean);
};

export const mapPrescriptionToRows = (prescriptions = []) => {
  if (!Array.isArray(prescriptions)) {
    return [];
  }

  return prescriptions.map((entry) => {
    const brandId = entry.medicineBrandId || entry.medicine_brand_id || entry.brand?.id || '';
    const medicineName = entry.brand?.medicine?.name || entry.medicine?.name || '';
    const brandName = entry.brand?.name || entry.name || '';
    const labelParts = [medicineName, brandName].filter((part) => part && part.trim());
    const label = labelParts.length ? labelParts.join(' — ') : entry.label || '';
    const quantityValue = entry.quantity ?? entry.qty ?? '';

    return {
      medicineBrandId: brandId ? String(brandId) : '',
      quantity: quantityValue === '' || quantityValue === null || quantityValue === undefined
        ? ''
        : String(quantityValue),
      label,
      query: label
    };
  });
};

const mapMedicinesForPayload = (rows = []) => {
  if (!Array.isArray(rows)) {
    return [];
  }
  return rows
    .map((row) => {
      const brandId = normalizeInteger(row.medicineBrandId);
      const quantity = normalizeNumber(row.quantity);
      if (!brandId || !quantity || quantity <= 0) {
        return null;
      }
      return {
        medicineBrandId: brandId,
        quantity
      };
    })
    .filter(Boolean);
};

const normalizeVaccinationPlan = (source) => {
  if (!source) {
    return createEmptyVaccinationPlan();
  }
  const base = createEmptyVaccinationPlan();
  return {
    ...base,
    enabled: true,
    vaccineName: sanitizeText(source.vaccineName || source.name || '') || base.vaccineName,
    doseNumber: !isBlank(source.doseNumber) ? String(source.doseNumber) : base.doseNumber,
    administeredAt: formatDateInput(source.administeredAt),
    nextDueAt: formatDateInput(source.nextDueAt),
    remindBeforeDays: !isBlank(source.remindBeforeDays)
      ? String(source.remindBeforeDays)
      : base.remindBeforeDays,
    notes: typeof source.notes === 'string' ? source.notes : base.notes
  };
};

const hasVaccinationPayload = (plan) => {
  if (!plan || typeof plan !== 'object') {
    return false;
  }
  return Boolean(
    plan.enabled ||
      ['vaccineName', 'doseNumber', 'administeredAt', 'nextDueAt', 'remindBeforeDays', 'notes'].some(
        (key) => !isBlank(plan[key])
      )
  );
};

const prepareVaccinationPlan = (plan) => {
  if (!hasVaccinationPayload(plan)) {
    return null;
  }
  return {
    vaccineName: sanitizeText(plan.vaccineName) || null,
    doseNumber: normalizeInteger(plan.doseNumber),
    administeredAt: formatDateInput(plan.administeredAt) || null,
    nextDueAt: formatDateInput(plan.nextDueAt) || null,
    remindBeforeDays: normalizeInteger(plan.remindBeforeDays),
    notes: sanitizeText(plan.notes) || null
  };
};

export const buildAppointmentPayload = (formState = createEmptyAppointment()) => {
  const paymentType = formState.paymentType === 'credit' ? 'credit' : 'cash';
  const paymentStatus = paymentType === 'credit'
    ? (formState.paymentStatus === 'paid' ? 'paid' : 'pending')
    : 'paid';

  const payload = {
    date: toIsoOrNull(formState.date) || null,
    reason: sanitizeText(formState.reason) || null,
    status: formState.status || 'completed',
    patientId: normalizeInteger(formState.patientId),
    doctorCharge: normalizeNumber(formState.doctorCharge),
    surgeryCharge: normalizeNumber(formState.surgeryCharge),
    otherCharge: normalizeNumber(formState.otherCharge),
    otherChargeReason: sanitizeText(formState.otherChargeReason) || null,
    discount: normalizeNumber(formState.discount),
    notes: sanitizeText(formState.notes) || null,
    medicines: mapMedicinesForPayload(formState.medicines),
    paymentType,
    paymentStatus,
    settledAt: paymentStatus === 'paid' ? toIsoOrNull(formState.settledAt) : null
  };

  const vaccinationPlan = prepareVaccinationPlan(formState.vaccinationPlan);
  if (vaccinationPlan) {
    payload.vaccinationPlan = vaccinationPlan;
  }

  return payload;
};

export const mapAppointmentToFormState = (appointment) => {
  if (!appointment || typeof appointment !== 'object') {
    return createEmptyAppointment();
  }

  const base = createEmptyAppointment();
  const vaccinatedFromApi = appointment.vaccination || appointment.vaccinationPlan || null;
  const reports = normalizeReportsResponse(appointment);

  return {
    ...base,
    patientId: appointment.patientId ? String(appointment.patientId) : (appointment.patient?.id ? String(appointment.patient.id) : ''),
    date: formatDateTimeLocal(appointment.date) || base.date,
    reason: appointment.reason || base.reason,
    status: appointment.status || base.status,
    doctorCharge: !isBlank(appointment.doctorCharge) ? String(appointment.doctorCharge) : base.doctorCharge,
    surgeryCharge: !isBlank(appointment.surgeryCharge) ? String(appointment.surgeryCharge) : base.surgeryCharge,
    otherCharge: !isBlank(appointment.otherCharge) ? String(appointment.otherCharge) : base.otherCharge,
    otherChargeReason: appointment.otherChargeReason || base.otherChargeReason,
    discount: !isBlank(appointment.discount) ? String(appointment.discount) : base.discount,
    notes: appointment.notes || base.notes,
    medicines: mapPrescriptionToRows(appointment.medicines),
    paymentType: appointment.paymentType || base.paymentType,
    paymentStatus: appointment.paymentStatus || base.paymentStatus,
    settledAt: formatDateTimeLocal(appointment.settledAt) || '',
    vaccinationPlan: vaccinatedFromApi ? normalizeVaccinationPlan(vaccinatedFromApi) : base.vaccinationPlan,
    diagnosticReports: reports
  };
};

export const formatReportDisplayDate = (value) => {
  const date = toDate(value);
  if (!date) {
    return '—';
  }
  return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`.trim();
};
