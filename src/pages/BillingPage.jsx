import React, { useCallback, useEffect, useState } from 'react';
import {
  addPayment,
  addRefund,
  createInvoice,
  fetchInvoice,
  fetchInvoices,
} from '../api/billing.js';

const fmt = new Intl.NumberFormat('en-LK', { style: 'currency', currency: 'LKR' });

const STATUS_BADGE = {
  unpaid: 'badge-error',
  partially_paid: 'badge-warning',
  paid: 'badge-success',
  partially_refunded: 'badge-info',
  refunded: 'badge-neutral',
};

const STATUS_LABELS = {
  unpaid: 'Unpaid',
  partially_paid: 'Partial',
  paid: 'Paid',
  partially_refunded: 'Part. Refunded',
  refunded: 'Refunded',
};

const PAYMENT_METHODS = ['cash', 'card', 'bank_transfer', 'upi', 'other'];

const emptyInvoice = () => ({
  sourceType: 'manual',
  patientName: '',
  ownerName: '',
  notes: '',
  lineItems: [{ description: '', quantity: 1, unitPrice: '' }],
  discount: '',
  taxPercent: '',
});

const emptyPayment = () => ({ amount: '', method: 'cash', notes: '', referenceNumber: '' });
const emptyRefund = () => ({ amount: '', method: 'cash', notes: '', referenceNumber: '' });

// ── line-item helpers ────────────────────────────────────────────────────────

const calcSubtotal = (items) =>
  items.reduce((s, i) => s + (Number(i.quantity) || 0) * (Number(i.unitPrice) || 0), 0);

const calcTotal = (items, discount, taxPercent) => {
  const sub = calcSubtotal(items);
  const disc = Math.min(Number(discount) || 0, sub);
  const taxable = sub - disc;
  const tax = taxable * ((Number(taxPercent) || 0) / 100);
  return taxable + tax;
};

// ── InvoiceDetailModal ───────────────────────────────────────────────────────

const InvoiceDetailModal = ({ invoiceId, onClose, onUpdated }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('transactions'); // 'transactions' | 'payment' | 'refund'
  const [paymentForm, setPaymentForm] = useState(emptyPayment());
  const [refundForm, setRefundForm] = useState(emptyRefund());
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchInvoice(invoiceId);
      setData(res.data ?? res);
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }, [invoiceId]);

  useEffect(() => { load(); }, [load]);

  const handlePay = async (e) => {
    e.preventDefault();
    if (!paymentForm.amount) return;
    setSaving(true);
    setErr('');
    try {
      await addPayment(invoiceId, paymentForm);
      await load();
      setPaymentForm(emptyPayment());
      setActiveTab('transactions');
      onUpdated?.();
    } catch (ex) {
      setErr(ex.message);
    } finally {
      setSaving(false);
    }
  };

  const handleRefund = async (e) => {
    e.preventDefault();
    if (!refundForm.amount) return;
    setSaving(true);
    setErr('');
    try {
      await addRefund(invoiceId, refundForm);
      await load();
      setRefundForm(emptyRefund());
      setActiveTab('transactions');
      onUpdated?.();
    } catch (ex) {
      setErr(ex.message);
    } finally {
      setSaving(false);
    }
  };

  const inv = data;

  return (
    <dialog open className="modal modal-open">
      <div className="modal-box w-11/12 max-w-3xl bg-white text-slate-900">
        <button
          onClick={onClose}
          className="btn btn-sm btn-circle btn-ghost absolute right-3 top-3"
        >✕</button>

        {loading && <div className="py-12 text-center text-slate-400">Loading…</div>}

        {!loading && inv && (
          <>
            {/* Header */}
            <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900 tracking-tight">{inv.invoiceNumber}</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {inv.invoiceDate ? new Date(inv.invoiceDate).toLocaleDateString('en-LK') : '—'}
                  {inv.patientName ? ` · Patient: ${inv.patientName}` : ''}
                  {inv.ownerName ? ` · Owner: ${inv.ownerName}` : ''}
                </p>
              </div>
              <span className={`badge badge-lg ${STATUS_BADGE[inv.status] || 'badge-neutral'}`}>
                {STATUS_LABELS[inv.status] || inv.status}
              </span>
            </div>

            {/* Amounts */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
              {[
                { label: 'Total', value: inv.totalAmount },
                { label: 'Paid', value: inv.paidAmount },
                { label: 'Refunded', value: inv.refundedAmount },
                { label: 'Due', value: inv.dueAmount, highlight: Number(inv.dueAmount) > 0 },
              ].map(({ label, value, highlight }) => (
                <div
                  key={label}
                  className={`rounded-xl border p-3 text-center ${
                    highlight ? 'border-red-200 bg-red-50' : 'border-slate-200 bg-slate-50'
                  }`}
                >
                  <p className="text-[10px] uppercase tracking-widest text-slate-500">{label}</p>
                  <p className={`text-sm font-semibold mt-0.5 ${highlight ? 'text-red-600' : 'text-white'}`}>
                    {fmt.format(Number(value) || 0)}
                  </p>
                </div>
              ))}
            </div>

            {/* Line items */}
            {Array.isArray(inv.lineItems) && inv.lineItems.length > 0 && (
              <div className="mb-4 rounded-md border border-slate-200 overflow-hidden">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <thead className="bg-primary/5 text-slate-600 text-[11px] uppercase">
                    <tr>
                      <th>Description</th>
                      <th className="text-right">Qty</th>
                      <th className="text-right">Unit Price</th>
                      <th className="text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inv.lineItems.map((li, i) => (
                        <tr key={i} className="border-b border-slate-100">
                        <td>{li.description}</td>
                        <td className="text-right">{li.quantity}</td>
                        <td className="text-right">{fmt.format(Number(li.unitPrice) || 0)}</td>
                        <td className="text-right">{fmt.format((Number(li.quantity) || 0) * (Number(li.unitPrice) || 0))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Tabs */}
              <div className="tabs tabs-boxed bg-slate-100 mb-4">
              {['transactions', 'payment', 'refund'].map((tab) => (
                <button
                  key={tab}
                  className={`tab ${activeTab === tab ? 'tab-active' : ''}`}
                  onClick={() => setActiveTab(tab)}
                >
                  {tab === 'transactions' ? 'Transactions' : tab === 'payment' ? '+ Payment' : '− Refund'}
                </button>
              ))}
            </div>

            {activeTab === 'transactions' && (
              <div>
                {(!inv.transactions || inv.transactions.length === 0) ? (
                  <p className="text-slate-500 text-sm py-4 text-center">No transactions yet.</p>
                ) : (
                  <table className="min-w-full divide-y divide-slate-200 text-sm">
                    <thead className="text-slate-400 text-[11px] uppercase">
                      <tr>
                        <th>Date</th>
                        <th>Type</th>
                        <th>Method</th>
                        <th className="text-right">Amount</th>
                        <th>Ref</th>
                        <th>Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {inv.transactions.map((tx) => (
                        <tr key={tx.id} className="border-b border-slate-100">
                          <td className="text-xs">{tx.transactionDate ? new Date(tx.transactionDate).toLocaleDateString('en-LK') : '—'}</td>
                          <td>
                            <span className={`badge badge-xs ${tx.type === 'payment' ? 'badge-success' : 'badge-error'}`}>
                              {tx.type}
                            </span>
                          </td>
                          <td className="text-xs capitalize">{tx.method?.replace('_', ' ')}</td>
                          <td className="text-right font-medium">{fmt.format(Number(tx.amount) || 0)}</td>
                          <td className="text-xs text-slate-400">{tx.referenceNumber || '—'}</td>
                          <td className="text-xs text-slate-400">{tx.notes || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {activeTab === 'payment' && (
              <form onSubmit={handlePay} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-slate-400">Amount (LKR) *</span>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    required
                    className="input input-sm w-full"
                    value={paymentForm.amount}
                    onChange={(e) => setPaymentForm((p) => ({ ...p, amount: e.target.value }))}
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-slate-400">Method *</span>
                  <select
                    className="select select-sm w-full"
                    value={paymentForm.method}
                    onChange={(e) => setPaymentForm((p) => ({ ...p, method: e.target.value }))}
                  >
                    {PAYMENT_METHODS.map((m) => (
                      <option key={m} value={m}>{m.replace('_', ' ').toUpperCase()}</option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-slate-400">Reference #</span>
                  <input
                    type="text"
                    className="input input-sm w-full"
                    value={paymentForm.referenceNumber}
                    onChange={(e) => setPaymentForm((p) => ({ ...p, referenceNumber: e.target.value }))}
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-slate-400">Notes</span>
                  <input
                    type="text"
                    className="input input-sm w-full"
                    value={paymentForm.notes}
                    onChange={(e) => setPaymentForm((p) => ({ ...p, notes: e.target.value }))}
                  />
                </label>
                {err && <p className="col-span-2 text-xs text-error">{err}</p>}
                <div className="col-span-2 flex justify-end gap-2">
                  <button type="button" className="btn btn-sm btn-ghost" onClick={() => setActiveTab('transactions')}>
                    Cancel
                  </button>
                  <button type="submit" disabled={saving} className="btn btn-sm btn-success">
                    {saving ? 'Saving…' : 'Record Payment'}
                  </button>
                </div>
              </form>
            )}

            {activeTab === 'refund' && (
              <form onSubmit={handleRefund} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-slate-400">Refund Amount (LKR) *</span>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    required
                    className="input input-sm w-full"
                    value={refundForm.amount}
                    onChange={(e) => setRefundForm((p) => ({ ...p, amount: e.target.value }))}
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-slate-400">Method *</span>
                  <select
                    className="select select-sm w-full"
                    value={refundForm.method}
                    onChange={(e) => setRefundForm((p) => ({ ...p, method: e.target.value }))}
                  >
                    {PAYMENT_METHODS.map((m) => (
                      <option key={m} value={m}>{m.replace('_', ' ').toUpperCase()}</option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-slate-400">Reference #</span>
                  <input
                    type="text"
                    className="input input-sm w-full"
                    value={refundForm.referenceNumber}
                    onChange={(e) => setRefundForm((p) => ({ ...p, referenceNumber: e.target.value }))}
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-slate-400">Notes</span>
                  <input
                    type="text"
                    className="input input-sm w-full"
                    value={refundForm.notes}
                    onChange={(e) => setRefundForm((p) => ({ ...p, notes: e.target.value }))}
                  />
                </label>
                {err && <p className="col-span-2 text-xs text-error">{err}</p>}
                <div className="col-span-2 flex justify-end gap-2">
                  <button type="button" className="btn btn-sm btn-ghost" onClick={() => setActiveTab('transactions')}>
                    Cancel
                  </button>
                  <button type="submit" disabled={saving} className="btn btn-sm btn-error">
                    {saving ? 'Saving…' : 'Record Refund'}
                  </button>
                </div>
              </form>
            )}
          </>
        )}

        {err && !loading && !inv && (
          <p className="text-error text-sm py-4 text-center">{err}</p>
        )}
      </div>
      <div className="modal-backdrop" onClick={onClose} />
    </dialog>
  );
};

// ── CreateInvoiceModal ───────────────────────────────────────────────────────

const CreateInvoiceModal = ({ onClose, onCreated }) => {
  const [form, setForm] = useState(emptyInvoice());
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const setField = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const setLineItem = (idx, k, v) =>
    setForm((p) => {
      const li = p.lineItems.map((l, i) => (i === idx ? { ...l, [k]: v } : l));
      return { ...p, lineItems: li };
    });

  const addLine = () =>
    setForm((p) => ({
      ...p,
      lineItems: [...p.lineItems, { description: '', quantity: 1, unitPrice: '' }],
    }));

  const removeLine = (idx) =>
    setForm((p) => ({ ...p, lineItems: p.lineItems.filter((_, i) => i !== idx) }));

  const subtotal = calcSubtotal(form.lineItems);
  const total = calcTotal(form.lineItems, form.discount, form.taxPercent);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setErr('');
    try {
      const payload = {
        ...form,
        lineItems: form.lineItems.map((l) => ({
          ...l,
          quantity: Number(l.quantity) || 1,
          unitPrice: Number(l.unitPrice) || 0,
        })),
        discount: form.discount ? Number(form.discount) : undefined,
        taxPercent: form.taxPercent ? Number(form.taxPercent) : undefined,
      };
      const res = await createInvoice(payload);
      onCreated?.(res.data ?? res);
      onClose();
    } catch (ex) {
      setErr(ex.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <dialog open className="modal modal-open">
      <div className="modal-box w-11/12 max-w-2xl bg-white text-slate-900">
        <button onClick={onClose} className="btn btn-sm btn-circle btn-ghost absolute right-3 top-3">✕</button>
        <h3 className="text-lg font-bold text-slate-900 mb-4 text-slate-900">New Invoice</h3>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-slate-400">Patient Name</span>
              <input
                type="text"
                className="input input-sm w-full"
                value={form.patientName}
                onChange={(e) => setField('patientName', e.target.value)}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-slate-400">Owner Name</span>
              <input
                type="text"
                className="input input-sm w-full"
                value={form.ownerName}
                onChange={(e) => setField('ownerName', e.target.value)}
              />
            </label>
          </div>

          {/* Line items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-slate-400 uppercase tracking-widest">Line Items</span>
              <button type="button" onClick={addLine} className="btn btn-xs btn-outline btn-primary">
                + Add Line
              </button>
            </div>
            <div className="space-y-2">
              {form.lineItems.map((li, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                  <input
                    type="text"
                    placeholder="Description"
                    className="input input-xs w-full col-span-5"
                    value={li.description}
                    onChange={(e) => setLineItem(idx, 'description', e.target.value)}
                  />
                  <input
                    type="number"
                    min="1"
                    placeholder="Qty"
                    className="input input-xs w-full col-span-2"
                    value={li.quantity}
                    onChange={(e) => setLineItem(idx, 'quantity', e.target.value)}
                  />
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="Unit Price"
                    className="input input-xs w-full col-span-3"
                    value={li.unitPrice}
                    onChange={(e) => setLineItem(idx, 'unitPrice', e.target.value)}
                  />
                  <span className="text-xs text-right text-slate-400 col-span-1">
                    {fmt.format((Number(li.quantity) || 0) * (Number(li.unitPrice) || 0))}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeLine(idx)}
                    disabled={form.lineItems.length === 1}
                    className="btn btn-xs btn-ghost text-error col-span-1"
                  >✕</button>
                </div>
              ))}
            </div>
          </div>

          {/* Totals */}
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-slate-400">Discount (LKR)</span>
              <input
                type="number"
                min="0"
                step="0.01"
                className="input input-sm w-full"
                value={form.discount}
                onChange={(e) => setField('discount', e.target.value)}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-slate-400">Tax %</span>
              <input
                type="number"
                min="0"
                max="100"
                step="0.01"
                className="input input-sm w-full"
                value={form.taxPercent}
                onChange={(e) => setField('taxPercent', e.target.value)}
              />
            </label>
          </div>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-slate-400">Notes</span>
            <textarea
              rows={2}
              className="textarea textarea-bordered w-full text-sm"
              value={form.notes}
              onChange={(e) => setField('notes', e.target.value)}
            />
          </label>

          {/* Summary */}
          <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 text-sm flex justify-between items-center">
            <span className="text-slate-400">
              Subtotal {fmt.format(subtotal)}
              {Number(form.discount) > 0 && ` − Discount ${fmt.format(Number(form.discount))}`}
              {Number(form.taxPercent) > 0 && ` + Tax ${form.taxPercent}%`}
            </span>
            <span className="font-bold text-slate-900 text-base">{fmt.format(total)}</span>
          </div>

          {err && <p className="text-error text-xs">{err}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn btn-sm btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" disabled={saving} className="btn btn-sm btn-primary">
              {saving ? 'Creating…' : 'Create Invoice'}
            </button>
          </div>
        </form>
      </div>
      <div className="modal-backdrop" onClick={onClose} />
    </dialog>
  );
};

// ── BillingPage ──────────────────────────────────────────────────────────────

const BillingPage = () => {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [detailId, setDetailId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr('');
    try {
      const res = await fetchInvoices({
        status: statusFilter || undefined,
        search: searchQuery || undefined,
      });
      setInvoices(Array.isArray(res.data) ? res.data : Array.isArray(res) ? res : []);
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, searchQuery]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Billing</h1>
          <p className="text-xs text-slate-400 mt-0.5">Invoices · Payments · Refunds</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            className="select select-sm text-slate-800"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">All Statuses</option>
            {Object.entries(STATUS_LABELS).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
          <input
            type="text"
            placeholder="Search invoice / patient…"
            className="input input-sm text-slate-800 w-52"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <button className="btn btn-sm btn-primary" onClick={() => setShowCreate(true)}>
            + New Invoice
          </button>
        </div>
      </div>

      {/* Error */}
      {err && <div className="alert alert-error text-sm">{err}</div>}

      {/* Table */}
      <div className="overflow-x-auto rounded-md border border-slate-200">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-primary/5 text-slate-600 text-[11px] uppercase">
            <tr>
              <th>Invoice #</th>
              <th>Date</th>
              <th>Patient</th>
              <th>Owner</th>
              <th className="text-right">Total</th>
              <th className="text-right">Due</th>
              <th>Status</th>
              <th>Source</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={9} className="text-center py-10 text-slate-500">Loading…</td>
              </tr>
            )}
            {!loading && invoices.length === 0 && (
              <tr>
                <td colSpan={9} className="text-center py-10 text-slate-500">No invoices found.</td>
              </tr>
            )}
            {!loading && invoices.map((inv) => (
              <tr key={inv.id} className="hover:bg-slate-50 border-b border-slate-200 cursor-pointer" onClick={() => setDetailId(inv.id)}>
                <td className="font-mono text-xs font-semibold text-primary">{inv.invoiceNumber}</td>
                <td className="text-xs">{inv.invoiceDate ? new Date(inv.invoiceDate).toLocaleDateString('en-LK') : '—'}</td>
                <td className="text-xs">{inv.patientName || '—'}</td>
                <td className="text-xs">{inv.ownerName || '—'}</td>
                <td className="text-right text-xs">{fmt.format(Number(inv.totalAmount) || 0)}</td>
                <td className={`text-right text-xs font-semibold ${Number(inv.dueAmount) > 0 ? 'text-red-600' : 'text-slate-400'}`}>
                  {fmt.format(Number(inv.dueAmount) || 0)}
                </td>
                <td>
                  <span className={`badge badge-xs ${STATUS_BADGE[inv.status] || 'badge-neutral'}`}>
                    {STATUS_LABELS[inv.status] || inv.status}
                  </span>
                </td>
                <td className="text-xs capitalize text-slate-400">{(inv.sourceType || '').replace('_', ' ')}</td>
                <td>
                  <button
                    className="btn btn-xs btn-ghost text-primary"
                    onClick={(e) => { e.stopPropagation(); setDetailId(inv.id); }}
                  >
                    View
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modals */}
      {showCreate && (
        <CreateInvoiceModal
          onClose={() => setShowCreate(false)}
          onCreated={() => load()}
        />
      )}
      {detailId && (
        <InvoiceDetailModal
          invoiceId={detailId}
          onClose={() => setDetailId(null)}
          onUpdated={load}
        />
      )}
    </div>
  );
};

export default BillingPage;
