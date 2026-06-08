import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  CreditCard,
  Eye,
  FileText,
  Plus,
  Search,
  X,
} from 'lucide-react';
import {
  createSupplierInvoice,
  fetchSupplierInvoices,
  paySupplierInvoice,
  fetchSupplierInvoice,
} from '../api/procurement.js';
import api from '../api/client.js';
import EntityTable from '../components/EntityTable.jsx';

const fmt = new Intl.NumberFormat('en-LK', { style: 'currency', currency: 'LKR' });

const SI_STATUS_BADGE = {
  unpaid: 'badge-error',
  partially_paid: 'badge-warning',
  paid: 'badge-success',
};

const PAYMENT_METHODS = ['cash', 'card', 'bank_transfer', 'upi', 'other'];

const emptyLine = () => ({ description: '', quantity: '', unitCost: '' });

const calcTotal = (items) =>
  items.reduce((s, l) => s + (Number(l.quantity) || 0) * (Number(l.unitCost) || 0), 0);

const asArray = (value) => {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.data)) return value.data;
  if (Array.isArray(value?.items)) return value.items;
  if (Array.isArray(value?.results)) return value.results;
  return [];
};

const normalizeSupplierInvoice = (inv) => ({
  ...inv,
  invoiceNumber: inv.invoiceNumber ?? inv.supplier_invoice_number ?? `SI-${inv.id}`,
  supplierId: inv.supplierId ?? inv.supplier_id ?? null,
  invoiceDate: inv.invoiceDate ?? inv.invoice_date ?? null,
  dueDate: inv.dueDate ?? inv.due_date ?? null,
  totalAmount: Number(inv.totalAmount ?? inv.total ?? 0),
  paidAmount: Number(inv.paidAmount ?? inv.paid_amount ?? 0),
  dueAmount: Number(inv.dueAmount ?? inv.due_amount ?? 0),
});

// ── SI Detail Modal ───────────────────────────────────────────────────────────

const SIDetailModal = ({ invoiceId, onClose, onUpdated }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showPay, setShowPay] = useState(false);
  const [payForm, setPayForm] = useState({ amount: '', method: 'cash', notes: '', referenceNumber: '' });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchSupplierInvoice(invoiceId);
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
    setSaving(true);
    setErr('');
    try {
      await paySupplierInvoice(invoiceId, payForm);
      await load();
      setPayForm({ amount: '', method: 'cash', notes: '', referenceNumber: '' });
      setShowPay(false);
      onUpdated?.();
    } catch (ex) {
      setErr(ex.message);
    } finally {
      setSaving(false);
    }
  };

  const inv = data;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center px-4 backdrop-blur-sm">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative z-[10000] w-full max-w-3xl rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 bg-slate-50 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-blue-600">
              <FileText size={18} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-800">Invoice details</h3>
              <p className="text-xs text-slate-400">Review line items and record supplier payments.</p>
            </div>
          </div>
          <button onClick={onClose} className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700">
            <X size={16} />
          </button>
        </div>

        {loading && <div className="py-10 text-center text-slate-400">Loading invoice...</div>}
        {!loading && inv && (
          <div className="p-6">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold text-slate-900">{inv.invoiceNumber}</h3>
                <p className="text-xs text-slate-400">
                  {inv.invoiceDate ? new Date(inv.invoiceDate).toLocaleDateString('en-LK') : '—'}
                  {inv.dueDate ? ` · Due: ${new Date(inv.dueDate).toLocaleDateString('en-LK')}` : ''}
                </p>
              </div>
              <span className={`badge badge-lg ${SI_STATUS_BADGE[inv.status] || 'badge-neutral'}`}>{inv.status?.replace('_', ' ')}</span>
            </div>

            {/* Amounts */}
            <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
              {[
                { label: 'Total', value: inv.totalAmount },
                { label: 'Paid', value: inv.paidAmount },
                { label: 'Credited', value: inv.creditedAmount },
                { label: 'Due', value: inv.dueAmount, highlight: Number(inv.dueAmount) > 0 },
              ].map(({ label, value, highlight }) => (
                <div key={label} className={`rounded-xl border p-3 text-center ${highlight ? 'border-rose-200 bg-rose-50' : 'border-slate-200 bg-slate-50'}`}>
                  <p className="text-[10px] uppercase tracking-widest text-slate-500">{label}</p>
                  <p className={`mt-0.5 text-sm font-semibold ${highlight ? 'text-rose-700' : 'text-slate-800'}`}>
                    {fmt.format(Number(value) || 0)}
                  </p>
                </div>
              ))}
            </div>

            {/* Items */}
            {Array.isArray(inv.items) && inv.items.length > 0 && (
              <div className="mb-4 overflow-hidden rounded-md border border-slate-200">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <thead className="bg-primary/5 text-slate-600 text-[11px] uppercase">
                    <tr>
                      <th>Description</th>
                      <th className="text-right">Qty</th>
                      <th className="text-right">Unit Cost</th>
                      <th className="text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inv.items.map((li, i) => (
                      <tr key={i} className="border-b border-slate-200">
                        <td>{li.description}</td>
                        <td className="text-right">{li.quantity}</td>
                        <td className="text-right">{fmt.format(Number(li.unitCost) || 0)}</td>
                        <td className="text-right">{fmt.format((Number(li.quantity)||0)*(Number(li.unitCost)||0))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Actions */}
            {inv.status !== 'paid' && !showPay && (
              <button className="mb-4 inline-flex items-center gap-2 btn btn-sm btn-success rounded-xl" onClick={() => setShowPay(true)}>
                <Plus size={14} /> Record payment
              </button>
            )}

            {showPay && (
              <form onSubmit={handlePay} className="mb-4 space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Record payment</p>
                <div className="grid grid-cols-2 gap-3">
                  <label className="flex flex-col gap-1">
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Amount *</span>
                    <input type="number" min="0.01" step="0.01" required
                      className="input input-sm input-bordered w-full"
                      value={payForm.amount}
                      onChange={(e) => setPayForm((p) => ({ ...p, amount: e.target.value }))} />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Method *</span>
                    <select className="select select-sm select-bordered w-full"
                      value={payForm.method}
                      onChange={(e) => setPayForm((p) => ({ ...p, method: e.target.value }))}>
                      {PAYMENT_METHODS.map((m) => (
                        <option key={m} value={m}>{m.replace('_', ' ').toUpperCase()}</option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Reference #</span>
                    <input type="text"
                      className="input input-sm input-bordered w-full"
                      value={payForm.referenceNumber}
                      onChange={(e) => setPayForm((p) => ({ ...p, referenceNumber: e.target.value }))} />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Notes</span>
                    <input type="text"
                      className="input input-sm input-bordered w-full"
                      value={payForm.notes}
                      onChange={(e) => setPayForm((p) => ({ ...p, notes: e.target.value }))} />
                  </label>
                </div>
                {err && (
                  <div className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                    <AlertTriangle size={14} />
                    {err}
                  </div>
                )}
                <div className="flex justify-end gap-2">
                  <button type="button" className="inline-flex items-center gap-1.5 btn btn-xs btn-ghost rounded-lg" onClick={() => setShowPay(false)}><X size={12} /> Cancel</button>
                  <button type="submit" disabled={saving} className="inline-flex items-center gap-1.5 btn btn-xs btn-success rounded-lg">
                    <CheckCircle2 size={12} />
                    {saving ? 'Saving…' : 'Confirm Payment'}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {!loading && !inv && err && (
          <div className="m-6 flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
            <AlertTriangle size={14} />
            {err}
          </div>
        )}
      </div>
    </div>
  , document.body);
};

// ── CreateSIModal ─────────────────────────────────────────────────────────────

const CreateSIModal = ({ suppliers, onClose, onCreated }) => {
  const [form, setForm] = useState({
    supplierId: '',
    invoiceNumber: '',
    invoiceDate: new Date().toISOString().slice(0, 10),
    dueDate: '',
    notes: '',
    items: [emptyLine()],
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const setField = (k, v) => setForm((p) => ({ ...p, [k]: v }));
  const setLine = (idx, k, v) =>
    setForm((p) => ({ ...p, items: p.items.map((l, i) => (i === idx ? { ...l, [k]: v } : l)) }));
  const addLine = () => setForm((p) => ({ ...p, items: [...p.items, emptyLine()] }));
  const removeLine = (idx) => setForm((p) => ({ ...p, items: p.items.filter((_, i) => i !== idx) }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.supplierId) { setErr('Please select a supplier.'); return; }
    setSaving(true);
    setErr('');
    try {
      const payload = {
        ...form,
        items: form.items.map((l) => ({
          description: l.description,
          quantity: Number(l.quantity) || 0,
          unitCost: Number(l.unitCost) || 0,
        })),
      };
      const res = await createSupplierInvoice(payload);
      onCreated?.(res.data ?? res);
      onClose();
    } catch (ex) {
      setErr(ex.message);
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center px-4 backdrop-blur-sm">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative z-[10000] w-full max-w-3xl rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 bg-slate-50 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-blue-600">
              <FileText size={18} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-800">New Supplier Invoice</h3>
              <p className="text-xs text-slate-400">Create supplier bills and track due balances.</p>
            </div>
          </div>
          <button onClick={onClose} className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700">
            <X size={16} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4 p-6">
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Supplier *</span>
              <select required className="select select-sm select-bordered w-full"
                value={form.supplierId} onChange={(e) => setField('supplierId', e.target.value)}>
                <option value="">Select…</option>
                {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Supplier&apos;s Invoice # *</span>
              <input type="text" required className="input input-sm input-bordered w-full"
                value={form.invoiceNumber} onChange={(e) => setField('invoiceNumber', e.target.value)} />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Invoice Date</span>
              <input type="date" className="input input-sm input-bordered w-full"
                value={form.invoiceDate} onChange={(e) => setField('invoiceDate', e.target.value)} />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Due Date</span>
              <input type="date" className="input input-sm input-bordered w-full"
                value={form.dueDate} onChange={(e) => setField('dueDate', e.target.value)} />
            </label>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-slate-400 uppercase tracking-widest">Items</span>
              <button type="button" onClick={addLine} className="inline-flex items-center gap-1.5 btn btn-xs btn-outline btn-primary rounded-lg"><Plus size={12} /> Add</button>
            </div>
            {form.items.map((li, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-2 items-center mb-2">
                <input type="text" placeholder="Description" required
                  className="input input-xs w-full col-span-5"
                  value={li.description} onChange={(e) => setLine(idx, 'description', e.target.value)} />
                <input type="number" min="1" placeholder="Qty" required
                  className="input input-xs w-full col-span-2"
                  value={li.quantity} onChange={(e) => setLine(idx, 'quantity', e.target.value)} />
                <input type="number" min="0" step="0.01" placeholder="Unit Cost"
                  className="input input-xs w-full col-span-3"
                  value={li.unitCost} onChange={(e) => setLine(idx, 'unitCost', e.target.value)} />
                <span className="text-xs text-right text-slate-400 col-span-1">
                  {fmt.format((Number(li.quantity)||0)*(Number(li.unitCost)||0))}
                </span>
                <button type="button" disabled={form.items.length === 1}
                  className="btn btn-xs btn-ghost text-error col-span-1" onClick={() => removeLine(idx)}><X size={12} /></button>
              </div>
            ))}
            <div className="mt-1 text-right text-sm font-semibold text-slate-800">
              Total: {fmt.format(calcTotal(form.items))}
            </div>
          </div>

          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Notes</span>
            <textarea rows={2} className="textarea textarea-bordered w-full text-sm"
              value={form.notes} onChange={(e) => setField('notes', e.target.value)} />
          </label>

          {err && (
            <div className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
              <AlertTriangle size={14} />
              {err}
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="inline-flex items-center gap-1.5 btn btn-sm btn-ghost rounded-xl" onClick={onClose}><X size={14} /> Cancel</button>
            <button type="submit" disabled={saving} className="inline-flex items-center gap-1.5 btn btn-sm btn-primary rounded-xl">
              <FileText size={14} />
              {saving ? 'Creating…' : 'Create Supplier Invoice'}
            </button>
          </div>
        </form>
      </div>
    </div>
  , document.body);
};

// ── SupplierInvoicesPage ──────────────────────────────────────────────────────

const SupplierInvoicesPage = () => {
  const [invoices, setInvoices] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [query, setQuery] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [detailId, setDetailId] = useState(null);

  const supplierById = useMemo(
    () => Object.fromEntries(suppliers.map((s) => [String(s.id), s])),
    [suppliers]
  );

  const columns = useMemo(
    () => [
      {
        header: 'Invoice #',
        accessor: 'invoiceNumber',
        render: (inv) => <span className="font-mono text-xs font-semibold text-primary">{inv.invoiceNumber}</span>,
      },
      {
        header: 'Supplier',
        accessor: 'supplierId',
        render: (inv) => supplierById[String(inv.supplierId)]?.name ?? '—',
      },
      {
        header: 'Date',
        accessor: 'invoiceDate',
        render: (inv) => (inv.invoiceDate ? new Date(inv.invoiceDate).toLocaleDateString('en-LK') : '—'),
      },
      {
        header: 'Due Date',
        accessor: 'dueDate',
        render: (inv) => {
          const isPastDue = inv.dueDate && inv.status !== 'paid' && new Date(inv.dueDate) < new Date();
          return (
            <span className={`inline-flex items-center gap-1 text-xs ${isPastDue ? 'font-semibold text-rose-600' : ''}`}>
              {inv.dueDate ? new Date(inv.dueDate).toLocaleDateString('en-LK') : '—'}
              {isPastDue ? <AlertTriangle size={12} /> : null}
            </span>
          );
        },
      },
      {
        header: 'Total',
        accessor: 'totalAmount',
        render: (inv) => <span className="text-right block">{fmt.format(Number(inv.totalAmount) || 0)}</span>,
      },
      {
        header: 'Paid',
        accessor: 'paidAmount',
        render: (inv) => <span className="text-right block">{fmt.format(Number(inv.paidAmount) || 0)}</span>,
      },
      {
        header: 'Due',
        accessor: 'dueAmount',
        render: (inv) => (
          <span className={`text-right block font-semibold ${Number(inv.dueAmount) > 0 ? 'text-red-500' : 'text-slate-500'}`}>
            {fmt.format(Number(inv.dueAmount) || 0)}
          </span>
        ),
      },
      {
        header: 'Status',
        accessor: 'status',
        render: (inv) => (
          <span className={`badge badge-xs ${SI_STATUS_BADGE[inv.status] || 'badge-neutral'}`}>
            {inv.status?.replace('_', ' ')}
          </span>
        ),
      },
      {
        header: 'View',
        accessor: 'id',
        render: (inv) => (
          <button className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-blue-200 bg-blue-50 text-blue-600 hover:bg-blue-100" onClick={() => setDetailId(inv.id)} aria-label="View supplier invoice">
            <Eye size={13} />
          </button>
        ),
      },
    ],
    [supplierById]
  );

  const normalizedQuery = query.trim().toLowerCase();
  const filteredInvoices = useMemo(() => {
    if (!normalizedQuery) {
      return invoices;
    }
    return invoices.filter((inv) => {
      const haystack = [
        inv.invoiceNumber,
        supplierById[String(inv.supplierId)]?.name,
        inv.status,
        inv.notes,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [invoices, supplierById, normalizedQuery]);

  const load = useCallback(async () => {
    setLoading(true);
    setErr('');
    try {
      const [invRes, supRes] = await Promise.all([
        fetchSupplierInvoices({ status: statusFilter || undefined }),
        api.get('/suppliers').then((r) => r.data),
      ]);
      setInvoices(asArray(invRes).map(normalizeSupplierInvoice));
      setSuppliers(asArray(supRes));
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);

  return (
    <section className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-600">
          <FileText size={22} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Supplier Invoices</h1>
          <p className="text-sm text-slate-400">Track supplier bills, payment progress, and overdue balances.</p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-end gap-3">
          <label className="relative min-w-[220px] flex-1">
            <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-400">Search invoices</span>
            <Search size={15} className="pointer-events-none absolute left-3 top-[33px] text-slate-400" />
            <input
              type="search"
              className="input input-bordered w-full pl-9 text-sm"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search invoice number, supplier, status"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Status</span>
            <select className="select select-sm select-bordered min-w-[150px]"
              value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">All statuses</option>
              <option value="unpaid">Unpaid</option>
              <option value="partially_paid">Partial</option>
              <option value="paid">Paid</option>
            </select>
          </label>
          <button className="inline-flex items-center gap-2 btn btn-sm btn-primary rounded-xl" onClick={() => setShowCreate(true)}>
            <Plus size={14} /> New supplier invoice
          </button>
        </div>
      </div>

      {err && (
        <div className="flex items-center gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <AlertTriangle size={16} className="shrink-0" />
          {err}
        </div>
      )}

      <EntityTable
        columns={columns}
        data={filteredInvoices}
        loading={loading}
        loadingMessage="Loading supplier invoices..."
        emptyMessage={normalizedQuery ? 'No supplier invoices match your search.' : 'No supplier invoices.'}
        searchPlaceholder="Search invoice, supplier, status..."
      />

      <div className="grid gap-3 md:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Shown</p>
          <p className="mt-1 text-lg font-bold text-slate-800">{filteredInvoices.length}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400"><CircleDollarSign size={12} /> Unpaid</p>
          <p className="mt-1 text-lg font-bold text-rose-600">{invoices.filter((inv) => inv.status === 'unpaid').length}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400"><CreditCard size={12} /> Partial</p>
          <p className="mt-1 text-lg font-bold text-amber-600">{invoices.filter((inv) => inv.status === 'partially_paid').length}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400"><CheckCircle2 size={12} /> Paid</p>
          <p className="mt-1 text-lg font-bold text-emerald-600">{invoices.filter((inv) => inv.status === 'paid').length}</p>
        </div>
      </div>

      {showCreate && (
        <CreateSIModal suppliers={suppliers} onClose={() => setShowCreate(false)} onCreated={() => load()} />
      )}
      {detailId && (
        <SIDetailModal invoiceId={detailId} onClose={() => setDetailId(null)} onUpdated={load} />
      )}
    </section>
  );
};

export default SupplierInvoicesPage;
