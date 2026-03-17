import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
  return (
    <dialog open className="modal modal-open">
      <div className="modal-box w-11/12 max-w-2xl bg-white text-slate-900">
        <button onClick={onClose} className="btn btn-sm btn-circle btn-ghost absolute right-3 top-3">✕</button>
        <div className="mb-4">
          <h3 className="text-lg font-bold text-slate-900">{scn.creditNoteNumber}</h3>
          <p className="text-xs text-slate-400">
            Supplier: {supplier?.name ?? '—'}
            {scn.creditNoteDate && ` · Date: ${new Date(scn.creditNoteDate).toLocaleDateString('en-LK')}`}
          </p>
          {scn.returnStock && (
            <span className="badge badge-xs badge-info mt-1">Stock Returned</span>
          )}
        </div>

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
        {scn.notes && <p className="text-xs text-slate-400">Notes: {scn.notes}</p>}
      </div>
      <div className="modal-backdrop" onClick={onClose} />
    </dialog>
  );
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

  return (
    <dialog open className="modal modal-open">
      <div className="modal-box w-11/12 max-w-2xl bg-white text-slate-900">
        <button onClick={onClose} className="btn btn-sm btn-circle btn-ghost absolute right-3 top-3">✕</button>
        <h3 className="text-lg font-bold text-slate-900 mb-4 text-slate-900">New Supplier Credit Note</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-slate-400">Supplier *</span>
              <select required className="select select-sm w-full"
                value={form.supplierId}
                onChange={(e) => { setField('supplierId', e.target.value); setField('supplierInvoiceId', ''); }}>
                <option value="">Select…</option>
                {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-slate-400">Against Supplier Invoice (optional)</span>
              <select className="select select-sm w-full"
                value={form.supplierInvoiceId} onChange={(e) => setField('supplierInvoiceId', e.target.value)}>
                <option value="">— None —</option>
                {filteredInvoices.map((inv) => (
                  <option key={inv.id} value={inv.id}>{inv.invoiceNumber}</option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-slate-400">Credit Note Date</span>
              <input type="date" className="input input-sm w-full"
                value={form.creditNoteDate} onChange={(e) => setField('creditNoteDate', e.target.value)} />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-slate-400">Reason</span>
              <input type="text" placeholder="Damaged goods, overcharge…"
                className="input input-sm w-full"
                value={form.reason} onChange={(e) => setField('reason', e.target.value)} />
            </label>
          </div>

          {/* Return stock toggle */}
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" className="checkbox checkbox-sm checkbox-primary"
              checked={form.returnStock} onChange={(e) => setField('returnStock', e.target.checked)} />
            <span className="text-sm text-slate-300">Return stock to inventory (decrement stock quantity)</span>
          </label>

          {/* Items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-slate-400 uppercase tracking-widest">Items</span>
              <button type="button" onClick={addLine} className="btn btn-xs btn-outline btn-primary">+ Add</button>
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
                    className="btn btn-xs btn-ghost text-error col-span-1" onClick={() => removeLine(idx)}>✕</button>
                </div>
                {form.returnStock && (
                  <div className="mt-2">
                    <p className="text-[10px] text-slate-500 mb-0.5">Stock Item (for stock deduction)</p>
                    <select className="select select-xs w-full w-full"
                      value={li.stockItemId || ''}
                      onChange={(e) => setLine(idx, 'stockItemId', e.target.value)}>
                      <option value="">— Skip stock deduction —</option>
                      {stockItems.map((si) => <option key={si.id} value={si.id}>{si.name}</option>)}
                    </select>
                  </div>
                )}
              </div>
            ))}
            <div className="text-right text-sm font-semibold text-white mt-1">
              Credit Total: {fmt.format(calcTotal(form.items))}
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
              {saving ? 'Creating…' : 'Create Credit Note'}
            </button>
          </div>
        </form>
      </div>
      <div className="modal-backdrop" onClick={onClose} />
    </dialog>
  );
};

// ── SupplierCreditNotesPage ───────────────────────────────────────────────────

const SupplierCreditNotesPage = () => {
  const [scns, setSCNs] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [supplierInvoices, setSupplierInvoices] = useState([]);
  const [stockItems, setStockItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
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
          <button className="btn btn-xs btn-ghost text-primary" onClick={() => setDetailSCN(scn)} aria-label="View credit note">
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
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Supplier Credit Notes</h1>
          <p className="text-xs text-slate-400 mt-0.5">Returns, refunds, and credit adjustments from suppliers</p>
        </div>
        <button className="btn btn-sm btn-primary" onClick={() => setShowCreate(true)}>+ New Credit Note</button>
      </div>

      {err && <div className="alert alert-error text-sm">{err}</div>}

      <EntityTable
        columns={columns}
        data={scns}
        loading={loading}
        emptyMessage="No credit notes."
        searchPlaceholder="Search credit note, supplier, reason..."
      />

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
    </div>
  );
};

export default SupplierCreditNotesPage;
