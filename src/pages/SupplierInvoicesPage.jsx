import React, { useCallback, useEffect, useMemo, useState } from 'react';
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

  return (
    <dialog open className="modal modal-open">
      <div className="modal-box w-11/12 max-w-2xl bg-white text-slate-900">
        <button onClick={onClose} className="btn btn-sm btn-circle btn-ghost absolute right-3 top-3">✕</button>
        {loading && <div className="py-10 text-center text-slate-400">Loading…</div>}
        {!loading && inv && (
          <>
            <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
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
            <div className="grid grid-cols-4 gap-3 mb-4">
              {[
                { label: 'Total', value: inv.totalAmount },
                { label: 'Paid', value: inv.paidAmount },
                { label: 'Credited', value: inv.creditedAmount },
                { label: 'Due', value: inv.dueAmount, highlight: Number(inv.dueAmount) > 0 },
              ].map(({ label, value, highlight }) => (
                <div key={label} className={`rounded-xl border p-3 text-center ${highlight ? 'border-red-200 bg-red-50' : 'border-slate-200 bg-slate-50'}`}>
                  <p className="text-[10px] uppercase tracking-widest text-slate-500">{label}</p>
                  <p className={`text-sm font-semibold mt-0.5 ${highlight ? 'text-red-400' : 'text-white'}`}>
                    {fmt.format(Number(value) || 0)}
                  </p>
                </div>
              ))}
            </div>

            {/* Items */}
            {Array.isArray(inv.items) && inv.items.length > 0 && (
              <div className="rounded-md border border-slate-200 overflow-hidden mb-4">
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
              <button className="btn btn-sm btn-success mb-4" onClick={() => setShowPay(true)}>
                + Record Payment
              </button>
            )}

            {showPay && (
              <form onSubmit={handlePay} className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-3 mb-4">
                <p className="text-xs font-semibold text-slate-300">Record Payment</p>
                <div className="grid grid-cols-2 gap-3">
                  <label className="flex flex-col gap-1">
                    <span className="text-xs text-slate-400">Amount *</span>
                    <input type="number" min="0.01" step="0.01" required
                      className="input input-sm w-full"
                      value={payForm.amount}
                      onChange={(e) => setPayForm((p) => ({ ...p, amount: e.target.value }))} />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-xs text-slate-400">Method *</span>
                    <select className="select select-sm w-full"
                      value={payForm.method}
                      onChange={(e) => setPayForm((p) => ({ ...p, method: e.target.value }))}>
                      {PAYMENT_METHODS.map((m) => (
                        <option key={m} value={m}>{m.replace('_', ' ').toUpperCase()}</option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-xs text-slate-400">Reference #</span>
                    <input type="text"
                      className="input input-sm w-full"
                      value={payForm.referenceNumber}
                      onChange={(e) => setPayForm((p) => ({ ...p, referenceNumber: e.target.value }))} />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-xs text-slate-400">Notes</span>
                    <input type="text"
                      className="input input-sm w-full"
                      value={payForm.notes}
                      onChange={(e) => setPayForm((p) => ({ ...p, notes: e.target.value }))} />
                  </label>
                </div>
                {err && <p className="text-error text-xs">{err}</p>}
                <div className="flex gap-2 justify-end">
                  <button type="button" className="btn btn-xs btn-ghost" onClick={() => setShowPay(false)}>Cancel</button>
                  <button type="submit" disabled={saving} className="btn btn-xs btn-success">
                    {saving ? 'Saving…' : 'Confirm Payment'}
                  </button>
                </div>
              </form>
            )}
          </>
        )}
      </div>
      <div className="modal-backdrop" onClick={onClose} />
    </dialog>
  );
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

  return (
    <dialog open className="modal modal-open">
      <div className="modal-box w-11/12 max-w-2xl bg-white text-slate-900">
        <button onClick={onClose} className="btn btn-sm btn-circle btn-ghost absolute right-3 top-3">✕</button>
        <h3 className="text-lg font-bold text-slate-900 mb-4 text-slate-900">New Supplier Invoice</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-slate-400">Supplier *</span>
              <select required className="select select-sm w-full"
                value={form.supplierId} onChange={(e) => setField('supplierId', e.target.value)}>
                <option value="">Select…</option>
                {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-slate-400">Supplier&apos;s Invoice # *</span>
              <input type="text" required className="input input-sm w-full"
                value={form.invoiceNumber} onChange={(e) => setField('invoiceNumber', e.target.value)} />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-slate-400">Invoice Date</span>
              <input type="date" className="input input-sm w-full"
                value={form.invoiceDate} onChange={(e) => setField('invoiceDate', e.target.value)} />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-slate-400">Due Date</span>
              <input type="date" className="input input-sm w-full"
                value={form.dueDate} onChange={(e) => setField('dueDate', e.target.value)} />
            </label>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-slate-400 uppercase tracking-widest">Items</span>
              <button type="button" onClick={addLine} className="btn btn-xs btn-outline btn-primary">+ Add</button>
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
                  className="btn btn-xs btn-ghost text-error col-span-1" onClick={() => removeLine(idx)}>✕</button>
              </div>
            ))}
            <div className="text-right text-sm font-semibold text-white mt-1">
              Total: {fmt.format(calcTotal(form.items))}
            </div>
          </div>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-slate-400">Notes</span>
            <textarea rows={2} className="textarea textarea-bordered w-full text-sm"
              value={form.notes} onChange={(e) => setField('notes', e.target.value)} />
          </label>

          {err && <p className="text-error text-xs">{err}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn btn-sm btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" disabled={saving} className="btn btn-sm btn-primary">
              {saving ? 'Creating…' : 'Create Supplier Invoice'}
            </button>
          </div>
        </form>
      </div>
      <div className="modal-backdrop" onClick={onClose} />
    </dialog>
  );
};

// ── SupplierInvoicesPage ──────────────────────────────────────────────────────

const SupplierInvoicesPage = () => {
  const [invoices, setInvoices] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
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
            <span className={`text-xs ${isPastDue ? 'text-red-500 font-semibold' : ''}`}>
              {inv.dueDate ? new Date(inv.dueDate).toLocaleDateString('en-LK') : '—'}{isPastDue ? ' ⚠️' : ''}
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
          <button className="btn btn-xs btn-ghost text-primary" onClick={() => setDetailId(inv.id)} aria-label="View supplier invoice">
            👁️
          </button>
        ),
      },
    ],
    [supplierById]
  );

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
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Supplier Invoices</h1>
          <p className="text-xs text-slate-400 mt-0.5">Track supplier bills and payments</p>
        </div>
        <div className="flex items-center gap-2">
          <select className="select select-sm"
            value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All Statuses</option>
            <option value="unpaid">Unpaid</option>
            <option value="partially_paid">Partial</option>
            <option value="paid">Paid</option>
          </select>
          <button className="btn btn-sm btn-primary" onClick={() => setShowCreate(true)}>+ New Supplier Invoice</button>
        </div>
      </div>

      {err && <div className="alert alert-error text-sm">{err}</div>}

      <EntityTable
        columns={columns}
        data={invoices}
        loading={loading}
        emptyMessage="No supplier invoices."
        searchPlaceholder="Search invoice, supplier, status..."
      />

      {showCreate && (
        <CreateSIModal suppliers={suppliers} onClose={() => setShowCreate(false)} onCreated={() => load()} />
      )}
      {detailId && (
        <SIDetailModal invoiceId={detailId} onClose={() => setDetailId(null)} onUpdated={load} />
      )}
    </div>
  );
};

export default SupplierInvoicesPage;
