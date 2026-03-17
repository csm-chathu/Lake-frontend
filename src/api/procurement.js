import client from './client.js';

// ── Purchase Orders ──────────────────────────────────────────────────────────

export const fetchPurchaseOrders = (params = {}) =>
  client.get('/procurement/purchase-orders', { params }).then((r) => r.data);

export const fetchPurchaseOrder = (id) =>
  client.get(`/procurement/purchase-orders/${id}`).then((r) => r.data);

export const createPurchaseOrder = (data) =>
  client.post('/procurement/purchase-orders', data).then((r) => r.data);

export const updatePurchaseOrder = (id, data) =>
  client.put(`/procurement/purchase-orders/${id}`, data).then((r) => r.data);

// ── Goods Receipts ───────────────────────────────────────────────────────────

export const fetchGoodsReceipts = (params = {}) =>
  client.get('/procurement/goods-receipts', { params }).then((r) => r.data);

export const fetchGoodsReceipt = (id) =>
  client.get(`/procurement/goods-receipts/${id}`).then((r) => r.data);

export const createGoodsReceipt = (data) =>
  client.post('/procurement/goods-receipts', data).then((r) => r.data);

// ── Supplier Invoices ────────────────────────────────────────────────────────

export const fetchSupplierInvoices = (params = {}) =>
  client.get('/procurement/supplier-invoices', { params }).then((r) => r.data);

export const fetchSupplierInvoice = (id) =>
  client.get(`/procurement/supplier-invoices/${id}`).then((r) => r.data);

export const createSupplierInvoice = (data) =>
  client.post('/procurement/supplier-invoices', data).then((r) => r.data);

export const updateSupplierInvoice = (id, data) =>
  client.put(`/procurement/supplier-invoices/${id}`, data).then((r) => r.data);

export const paySupplierInvoice = (id, data) =>
  client.post(`/procurement/supplier-invoices/${id}/payments`, data).then((r) => r.data);

// ── Supplier Credit Notes ────────────────────────────────────────────────────

export const fetchSupplierCreditNotes = (params = {}) =>
  client.get('/procurement/supplier-credit-notes', { params }).then((r) => r.data);

export const fetchSupplierCreditNote = (id) =>
  client.get(`/procurement/supplier-credit-notes/${id}`).then((r) => r.data);

export const createSupplierCreditNote = (data) =>
  client.post('/procurement/supplier-credit-notes', data).then((r) => r.data);
