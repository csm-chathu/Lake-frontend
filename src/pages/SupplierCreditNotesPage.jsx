import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Eye, FileText, PackageCheck, Plus, Search, X } from 'lucide-react';
import {
  createSupplierCreditNote,
  fetchSupplierCreditNotes,
  fetchSupplierInvoices,
} from '../api/procurement.js';
import api from '../api/client.js';
import EntityTable from '../components/EntityTable.jsx';

const fmt = new Intl.NumberFormat('en-LK', { style: 'currency', currency: 'LKR' });

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

const normalizeSCN = (scn) => ({
  ...scn,
  creditNoteNumber: scn.creditNoteNumber ?? scn.credit_note_number ?? `SCN-${scn.id}`,
  supplierId: scn.supplierId ?? scn.supplier_id ?? null,
  creditNoteDate: scn.creditNoteDate ?? scn.credit_date ?? null,
  totalAmount: Number(scn.totalAmount ?? scn.total ?? 0),
  returnStock: Boolean(scn.returnStock ?? scn.return_stock),
});

// ── SCN Detail Modal ──────────────────────────────────────────────────────────

const SCNDetailModal = ({ scn, suppliers, onClose }) => {
  const supplier = suppliers.find((s) => s.id === scn.supplierId || s.id === scn.supplier_id);
  const items = Array.isArray(scn.items) ? scn.items : [];
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
              <h3 className="text-lg font-bold text-slate-800">{scn.creditNoteNumber}</h3>
              <p className="text-xs text-slate-400">
                Supplier: {supplier?.name ?? '—'}
                {scn.creditNoteDate && ` · Date: ${new Date(scn.creditNoteDate).toLocaleDateString('en-LK')}`}
              </p>
              {scn.returnStock && (
                <span className="mt-1 inline-flex rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold text-violet-700">Stock returned</span>
              )}
            </div>
          </div>
          <button onClick={onClose} className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700">
            <X size={16} />
          </button>
        </div>

        <div className="m-6 mb-4 overflow-hidden rounded-md border border-slate-200">
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
              {items.map((li, i) => (
                <tr key={i} className="border-b border-slate-200">
                  <td>{li.description}</td>
                  <td className="text-right">{li.quantity}</td>
                  <td className="text-right">{fmt.format(Number(li.unitCost) || 0)}</td>
                  <td className="text-right font-medium">
                    {fmt.format((Number(li.quantity)||0)*(Number(li.unitCost)||0))}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
                <tr className="border-t border-slate-200 font-semibold text-slate-900">
                <td colSpan={3} className="text-right">Credit Total</td>
                <td className="text-right">{fmt.format(Number(scn.totalAmount) || calcTotal(items))}</td>
              </tr>
            </tfoot>
          </table>
        </div>
          {scn.notes && <p className="px-6 pb-6 text-xs text-slate-400">Notes: {scn.notes}</p>}
      </div>
      </div>
  , document.body);
};

// ── CreateSCNModal ────────────────────────────────────────────────────────────

const CreateSCNModal = ({ suppliers, supplierInvoices, stockItems, onClose, onCreated }) => {
  const [form, setForm] = useState({
    supplierId: '',
    supplierInvoiceId: '',
    creditNoteDate: new Date().toISOString().slice(0, 10),
    reason: '',
    returnStock: false,
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

  // Filter invoices by selected supplier
  const filteredInvoices = supplierInvoices.filter(
    (inv) => !form.supplierId || String(inv.supplierId || inv.supplier_id) === String(form.supplierId)
  );

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
          stockItemId: l.stockItemId ? Number(l.stockItemId) : undefined,
        })),
        supplierInvoiceId: form.supplierInvoiceId || undefined,
      };
      const res = await createSupplierCreditNote(payload);
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
              <h3 className="text-lg font-bold text-slate-800">New Supplier Credit Note</h3>
              <p className="text-xs text-slate-400">Record returns, refunds, and supplier credit adjustments.</p>
            </div>
          </div>
          <button onClick={onClose} className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4 p-6">
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Supplier *</span>
              <select required className="select select-sm select-bordered w-full"
                value={form.supplierId}
                onChange={(e) => { setField('supplierId', e.target.value); setField('supplierInvoiceId', ''); }}>
                <option value="">Select…</option>
                {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Against Supplier Invoice (optional)</span>
              <select className="select select-sm select-bordered w-full"
                value={form.supplierInvoiceId} onChange={(e) => setField('supplierInvoiceId', e.target.value)}>
                <option value="">— None —</option>
                {filteredInvoices.map((inv) => (
                  <option key={inv.id} value={inv.id}>{inv.invoiceNumber}</option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Credit Note Date</span>
              <input type="date" className="input input-sm input-bordered w-full"
                value={form.creditNoteDate} onChange={(e) => setField('creditNoteDate', e.target.value)} />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Reason</span>
              <input type="text" placeholder="Damaged goods, overcharge…"
                className="input input-sm input-bordered w-full"
                value={form.reason} onChange={(e) => setField('reason', e.target.value)} />
            </label>
          </div>

          {/* Return stock toggle */}
          <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
            <input type="checkbox" className="checkbox checkbox-sm checkbox-primary"
              checked={form.returnStock} onChange={(e) => setField('returnStock', e.target.checked)} />
            <span className="text-sm text-slate-600">Return stock to inventory (decrement stock quantity)</span>
          </label>

          {/* Items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-slate-400 uppercase tracking-widest">Items</span>
              <button type="button" onClick={addLine} className="inline-flex items-center gap-1.5 btn btn-xs btn-outline btn-primary rounded-lg"><Plus size={12} /> Add</button>
            </div>
            {form.items.map((li, idx) => (
              <div key={idx} className="rounded-lg border border-slate-200 bg-slate-50 p-3 mb-2">
                <div className="grid grid-cols-12 gap-2 items-center">
                  <input type="text" placeholder="Description" required
                    className="input input-xs w-full col-span-5"
                    value={li.description} onChange={(e) => setLine(idx, 'description', e.target.value)} />
                  <input type="number" min="1" placeholder="Qty" required
                    className="input input-xs w-full col-span-2"
                    value={li.quantity} onChange={(e) => setLine(idx, 'quantity', e.target.value)} />
                  <input type="number" min="0" step="0.01" placeholder="Unit Cost"
                    className="input input-xs w-full col-span-2"
                    value={li.unitCost} onChange={(e) => setLine(idx, 'unitCost', e.target.value)} />
                  <span className="text-xs text-right text-slate-400 col-span-2">
                    {fmt.format((Number(li.quantity)||0)*(Number(li.unitCost)||0))}
                  </span>
                  <button type="button" disabled={form.items.length === 1}
                    className="btn btn-xs btn-ghost text-error col-span-1" onClick={() => removeLine(idx)}><X size={12} /></button>
                </div>
                {form.returnStock && (
                  <div className="mt-2">
                    <p className="text-[10px] text-slate-500 mb-0.5">Stock Item (for stock deduction)</p>
                    <select className="select select-xs select-bordered w-full"
                      value={li.stockItemId || ''}
                      onChange={(e) => setLine(idx, 'stockItemId', e.target.value)}>
                      <option value="">— Skip stock deduction —</option>
                      {stockItems.map((si) => <option key={si.id} value={si.id}>{si.name}</option>)}
                    </select>
                  </div>
                )}
              </div>
            ))}
            <div className="mt-1 text-right text-sm font-semibold text-slate-800">
              Credit Total: {fmt.format(calcTotal(form.items))}
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
              {saving ? 'Creating…' : 'Create Credit Note'}
            </button>
          </div>
        </form>
      </div>
    </div>
  , document.body);
};

// ── SupplierCreditNotesPage ───────────────────────────────────────────────────

const SupplierCreditNotesPage = () => {
  const [scns, setSCNs] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [supplierInvoices, setSupplierInvoices] = useState([]);
  const [stockItems, setStockItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [query, setQuery] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [detailSCN, setDetailSCN] = useState(null);

  const supplierById = useMemo(
    () => Object.fromEntries(suppliers.map((s) => [String(s.id), s])),
    [suppliers]
  );

  const columns = useMemo(
    () => [
      {
        header: 'Credit Note #',
        accessor: 'creditNoteNumber',
        render: (scn) => <span className="font-mono text-xs font-semibold text-primary">{scn.creditNoteNumber}</span>,
      },
      {
        header: 'Supplier',
        accessor: 'supplierId',
        render: (scn) => supplierById[String(scn.supplierId)]?.name ?? '—',
      },
      {
        header: 'Date',
        accessor: 'creditNoteDate',
        render: (scn) => (scn.creditNoteDate ? new Date(scn.creditNoteDate).toLocaleDateString('en-LK') : '—'),
      },
      {
        header: 'Reason',
        accessor: 'reason',
        render: (scn) => scn.reason || '—',
      },
      {
        header: 'Amount',
        accessor: 'totalAmount',
        render: (scn) => <span className="text-right block font-semibold text-green-600">{fmt.format(Number(scn.totalAmount) || 0)}</span>,
      },
      {
        header: 'Stock Returned',
        accessor: 'returnStock',
        render: (scn) => (scn.returnStock ? <span className="badge badge-xs badge-info">Yes</span> : <span className="text-slate-500">No</span>),
      },
      {
        header: 'View',
        accessor: 'id',
        render: (scn) => (
          <button className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-blue-200 bg-blue-50 text-blue-600 hover:bg-blue-100" onClick={() => setDetailSCN(scn)} aria-label="View credit note">
            <Eye size={13} />
          </button>
        ),
      },
    ],
    [supplierById]
  );

  const normalizedQuery = query.trim().toLowerCase();
  const filteredSCNs = useMemo(() => {
    if (!normalizedQuery) {
      return scns;
    }
    return scns.filter((scn) => {
      const haystack = [
        scn.creditNoteNumber,
        supplierById[String(scn.supplierId)]?.name,
        scn.reason,
        scn.notes,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [scns, supplierById, normalizedQuery]);

  const load = useCallback(async () => {
    setLoading(true);
    setErr('');
    try {
      const [scnRes, supRes, invRes, siRes] = await Promise.all([
        fetchSupplierCreditNotes(),
        api.get('/suppliers').then((r) => r.data),
        fetchSupplierInvoices(),
        api.get('/stock').then((r) => r.data),
      ]);
      setSCNs(asArray(scnRes).map(normalizeSCN));
      setSuppliers(asArray(supRes));
      setSupplierInvoices(asArray(invRes));
      setStockItems(asArray(siRes));
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <section className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-600">
          <FileText size={22} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Supplier Credit Notes</h1>
          <p className="text-sm text-slate-400">Capture supplier returns, refunds, and credit adjustments.</p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-end gap-3">
          <label className="relative min-w-[220px] flex-1">
            <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-400">Search credit notes</span>
            <Search size={15} className="pointer-events-none absolute left-3 top-[33px] text-slate-400" />
            <input
              type="search"
              className="input input-bordered w-full pl-9 text-sm"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search note number, supplier, reason"
            />
          </label>
          <button className="inline-flex items-center gap-2 btn btn-sm btn-primary rounded-xl" onClick={() => setShowCreate(true)}>
            <Plus size={14} /> New credit note
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
        data={filteredSCNs}
        loading={loading}
        loadingMessage="Loading supplier credit notes..."
        emptyMessage={normalizedQuery ? 'No credit notes match your search.' : 'No credit notes.'}
        searchPlaceholder="Search credit note, supplier, reason..."
      />

      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Shown</p>
          <p className="mt-1 text-lg font-bold text-slate-800">{filteredSCNs.length}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400"><PackageCheck size={12} /> Stock Returned</p>
          <p className="mt-1 text-lg font-bold text-violet-700">{scns.filter((scn) => scn.returnStock).length}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Credit Total</p>
          <p className="mt-1 text-lg font-bold text-emerald-700">
            {fmt.format(scns.reduce((sum, scn) => sum + (Number(scn.totalAmount) || 0), 0))}
          </p>
        </div>
      </div>

      {showCreate && (
        <CreateSCNModal
          suppliers={suppliers}
          supplierInvoices={supplierInvoices}
          stockItems={stockItems}
          onClose={() => setShowCreate(false)}
          onCreated={() => load()}
        />
      )}
      {detailSCN && (
        <SCNDetailModal
          scn={detailSCN}
          suppliers={suppliers}
          onClose={() => setDetailSCN(null)}
        />
      )}
    </section>
  );
};

export default SupplierCreditNotesPage;
