import client from './client.js';

// ── Invoices ────────────────────────────────────────────────────────────────

export const fetchInvoices = (params = {}) =>
  client.get('/billing/invoices', { params }).then((r) => r.data);

export const fetchInvoice = (id) =>
  client.get(`/billing/invoices/${id}`).then((r) => r.data);

export const createInvoice = (data) =>
  client.post('/billing/invoices', data).then((r) => r.data);

// ── Payments & Refunds ───────────────────────────────────────────────────────

export const addPayment = (invoiceId, data) =>
  client.post(`/billing/invoices/${invoiceId}/payments`, data).then((r) => r.data);

export const addRefund = (invoiceId, data) =>
  client.post(`/billing/invoices/${invoiceId}/refunds`, data).then((r) => r.data);

// ── Day-End ──────────────────────────────────────────────────────────────────

export const fetchDayEndSummary = (date) =>
  client.get('/billing/day-end/summary', { params: { date } }).then((r) => r.data);

export const closeDay = (data) =>
  client.post('/billing/day-end/close', data).then((r) => r.data);
