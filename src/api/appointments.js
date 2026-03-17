import client from './client.js';

export const fetchPatientReports = async (patientId) => {
  const numericId = Number(patientId);
  const { data } = await client.get('/patient-reports', {
    params: { patientId: numericId }
  });
  return data;
};

export const syncPatientReports = async (patientId, reports) => {
  const numericId = Number(patientId);
  const { data } = await client.post('/patient-reports/sync', {
    patientId: numericId,
    reports
  });
  return data;
};

export const uploadDiagnosticReport = async (file, { type = null, patientId = null } = {}) => {
  const formData = new FormData();
  formData.append('file', file);
  if (type) {
    formData.append('type', type);
  }
  if (patientId) {
    formData.append('patientId', String(Number(patientId)));
  }

  const { data } = await client.post('/uploads/diagnostic-report', formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  });

  return data;
};

export const sendAppointmentInvoiceSms = async (appointmentId) => {
  const numericId = Number(appointmentId);
  const { data } = await client.post(`/appointments/${numericId}/send-invoice`);
  return data;
};
