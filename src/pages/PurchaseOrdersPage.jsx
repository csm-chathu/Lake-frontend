import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  createPurchaseOrder,
  fetchPurchaseOrders,
  updatePurchaseOrder,
} from '../api/procurement.js';
import api from '../api/client.js';
import EntityTable from '../components/EntityTable.jsx';

const fmt = new Intl.NumberFormat('en-LK', { style: 'currency', currency: 'LKR' });

const PO_STATUS_BADGE = {
  draft: 'badge-neutral',
  sent: 'badge-warning',
  received: 'badge-success',
  cancelled: 'badge-error',
};

const emptyLine = () => ({ description: '', quantity: '', unitCost: '', discount: '' });

const emptyPO = () => ({
  supplierId: '',
  expectedDeliveryDate: '',
  notes: '',
  items: [emptyLine()],
});

const calcPOTotal = (items) =>
  items.reduce((s, l) => {
    const subtotal = (Number(l.quantity) || 0) * (Number(l.unitCost) || 0);
    const disc = Math.min(Number(l.discount) || 0, subtotal);
    return s + subtotal - disc;
  }, 0);

const asArray = (value) => {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.data)) return value.data;
  if (Array.isArray(value?.items)) return value.items;
  if (Array.isArray(value?.results)) return value.results;
  return [];
};

const normalizePO = (po) => ({
  ...po,
  poNumber: po.poNumber ?? po.po_number ?? `PO-${po.id}`,
  supplierId: po.supplierId ?? po.supplier_id ?? null,
  orderDate: po.orderDate ?? po.order_date ?? null,
  expectedDeliveryDate: po.expectedDeliveryDate ?? po.expected_date ?? null,
  totalAmount: Number(po.totalAmount ?? po.total ?? 0),
  items: Array.isArray(po.items) ? po.items : [],
});

// ── PO Detail Modal ───────────────────────────────────────────────────────────

const PODetailModal = ({ po: poProp, suppliers, onClose, onUpdated }) => {
  const [status, setStatus] = useState(poProp.status);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const handleStatusChange = async (newStatus) => {
    setSaving(true);
    setErr('');
    try {
      await updatePurchaseOrder(poProp.id, { status: newStatus });
      setStatus(newStatus);
      onUpdated?.();
    } catch (e) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  };

  const supplier = suppliers.find((s) => s.id === poProp.supplierId || s.id === poProp.supplier_id);
  const items = Array.isArray(poProp.items) ? poProp.items : [];

  return (
    <dialog open className="modal modal-open">
      <div className="modal-box w-11/12 max-w-2xl bg-white text-slate-900">
        <button onClick={onClose} className="btn btn-sm btn-circle btn-ghost absolute right-3 top-3">✕</button>

        <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
          <div>
            <h3 className="text-lg font-bold text-slate-900">{poProp.poNumber}</h3>
            <p className="text-xs text-slate-400">
              Supplier: {supplier?.name ?? 'Unknown'}
              {poProp.expectedDeliveryDate && ` · Expected: ${new Date(poProp.expectedDeliveryDate).toLocaleDateString('en-LK')}`}
            </p>
          </div>
          <span className={`badge badge-lg ${PO_STATUS_BADGE[status] || 'badge-neutral'}`}>{status}</span>
        </div>

        {/* Items table */}
        <div className="rounded-md border border-slate-200 overflow-hidden mb-4">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-primary/5 text-slate-600 text-[11px] uppercase">
              <tr>
                <th>Description</th>
                <th className="text-right">Qty</th>
                <th className="text-right">Unit Cost</th>
                <th className="text-right">Discount</th>
                <th className="text-right">Line Total</th>
              </tr>
            </thead>
            <tbody>
              {items.map((li, i) => {
                const sub = (Number(li.quantity) || 0) * (Number(li.unitCost) || 0);
                const disc = Math.min(Number(li.discount) || 0, sub);
                return (
                  <tr key={i} className="border-b border-slate-200">
                    <td>{li.description}</td>
                    <td className="text-right">{li.quantity}</td>
                    <td className="text-right">{fmt.format(Number(li.unitCost) || 0)}</td>
                    <td className="text-right">{disc > 0 ? fmt.format(disc) : '—'}</td>
                    <td className="text-right font-medium">{fmt.format(sub - disc)}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t border-slate-200 font-semibold text-slate-900">
                <td colSpan={4} className="text-right">Total</td>
                <td className="text-right">{fmt.format(Number(poProp.totalAmount) || calcPOTotal(items))}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        {poProp.notes && <p className="text-xs text-slate-400 mb-4">Notes: {poProp.notes}</p>}

        {/* Status transitions */}
        {status !== 'received' && status !== 'cancelled' && (
          <div className="flex gap-2 flex-wrap">
            {status === 'draft' && (
              <button
                disabled={saving}
                className="btn btn-sm btn-warning"
                onClick={() => handleStatusChange('sent')}
              >
                Mark as Sent
              </button>
            )}
            {(status === 'draft' || status === 'sent') && (
              <button
                disabled={saving}
                className="btn btn-sm btn-success"
                onClick={() => handleStatusChange('received')}
              >
                Mark as Received
              </button>
            )}
            <button
              disabled={saving}
              className="btn btn-sm btn-error btn-outline"
              onClick={() => handleStatusChange('cancelled')}
            >
              Cancel PO
            </button>
          </div>
        )}
        {err && <p className="text-error text-xs mt-2">{err}</p>}
      </div>
      <div className="modal-backdrop" onClick={onClose} />
    </dialog>
  );
};

// ── CreatePOModal ─────────────────────────────────────────────────────────────

const CreatePOModal = ({ suppliers, onClose, onCreated }) => {
  const [form, setForm] = useState(emptyPO());
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const setField = (k, v) => setForm((p) => ({ ...p, [k]: v }));
  const setLine = (idx, k, v) =>
    setForm((p) => ({ ...p, items: p.items.map((l, i) => (i === idx ? { ...l, [k]: v } : l)) }));
  const addLine = () => setForm((p) => ({ ...p, items: [...p.items, emptyLine()] }));
  const removeLine = (idx) =>
    setForm((p) => ({ ...p, items: p.items.filter((_, i) => i !== idx) }));

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
          discount: Number(l.discount) || 0,
        })),
      };
      const res = await createPurchaseOrder(payload);
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
        <h3 className="text-lg font-bold text-slate-900 mb-4 text-slate-900">New Purchase Order</h3>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-slate-400">Supplier *</span>
              <select
                required
                className="select select-sm w-full"
                value={form.supplierId}
                onChange={(e) => setField('supplierId', e.target.value)}
              >
                <option value="">Select supplier…</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-slate-400">Expected Delivery</span>
              <input
                type="date"
                className="input input-sm w-full"
                value={form.expectedDeliveryDate}
                onChange={(e) => setField('expectedDeliveryDate', e.target.value)}
              />
            </label>
          </div>

          {/* Items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-slate-400 uppercase tracking-widest">Items</span>
              <button type="button" onClick={addLine} className="btn btn-xs btn-outline btn-primary">+ Add</button>
            </div>
            {form.items.map((li, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-2 items-center mb-2">
                <input type="text" placeholder="Description" required
                  className="input input-xs w-full col-span-4"
                  value={li.description} onChange={(e) => setLine(idx, 'description', e.target.value)} />
                <input type="number" min="1" placeholder="Qty" required
                  className="input input-xs w-full col-span-2"
                  value={li.quantity} onChange={(e) => setLine(idx, 'quantity', e.target.value)} />
                <input type="number" min="0" step="0.01" placeholder="Unit Cost"
                  className="input input-xs w-full col-span-2"
                  value={li.unitCost} onChange={(e) => setLine(idx, 'unitCost', e.target.value)} />
                <input type="number" min="0" step="0.01" placeholder="Discount"
                  className="input input-xs w-full col-span-2"
                  value={li.discount} onChange={(e) => setLine(idx, 'discount', e.target.value)} />
                <span className="text-xs text-right text-slate-400 col-span-1">
                  {fmt.format(Math.max(0, (Number(li.quantity)||0)*(Number(li.unitCost)||0) - (Number(li.discount)||0)))}
                </span>
                <button type="button" disabled={form.items.length === 1}
                  className="btn btn-xs btn-ghost text-error col-span-1"
                  onClick={() => removeLine(idx)}>✕</button>
              </div>
            ))}
            <div className="text-right text-sm font-semibold text-slate-800 mt-1">
              Total: {fmt.format(calcPOTotal(form.items))}
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
              {saving ? 'Creating…' : 'Create PO'}
            </button>
          </div>
        </form>
      </div>
      <div className="modal-backdrop" onClick={onClose} />
    </dialog>
  );
};

// ── PurchaseOrdersPage ────────────────────────────────────────────────────────

const PurchaseOrdersPage = () => {
  const [pos, setPOs] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [detailPO, setDetailPO] = useState(null);

  const supplierById = useMemo(
    () => Object.fromEntries(suppliers.map((s) => [String(s.id), s])),
    [suppliers]
  );

  const columns = useMemo(
    () => [
      {
        header: 'PO #',
        accessor: 'poNumber',
        render: (po) => <span className="font-mono text-xs font-semibold text-primary">{po.poNumber}</span>,
      },
      {
        header: 'Supplier',
        accessor: 'supplierId',
        render: (po) => supplierById[String(po.supplierId)]?.name ?? '—',
      },
      {
        header: 'Date',
        accessor: 'orderDate',
        render: (po) => (po.orderDate ? new Date(po.orderDate).toLocaleDateString('en-LK') : '—'),
      },
      {
        header: 'Expected Delivery',
        accessor: 'expectedDeliveryDate',
        render: (po) => (po.expectedDeliveryDate ? new Date(po.expectedDeliveryDate).toLocaleDateString('en-LK') : '—'),
      },
      {
        header: 'Total',
        accessor: 'totalAmount',
        render: (po) => <span className="text-right block">{fmt.format(Number(po.totalAmount) || 0)}</span>,
      },
      {
        header: 'Status',
        accessor: 'status',
        render: (po) => <span className={`badge badge-xs ${PO_STATUS_BADGE[po.status] || 'badge-neutral'}`}>{po.status}</span>,
      },
      {
        header: 'View',
        accessor: 'id',
        render: (po) => (
          <button className="btn btn-xs btn-ghost text-primary" onClick={() => setDetailPO(po)} aria-label="View purchase order">
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
      const [poRes, supRes] = await Promise.all([
        fetchPurchaseOrders({ status: statusFilter || undefined }),
        api.get('/suppliers').then((r) => r.data),
      ]);
      setPOs(asArray(poRes).map(normalizePO));
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
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Purchase Orders</h1>
          <p className="text-xs text-slate-400 mt-0.5">Draft → Sent → Received</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            className="select select-sm select-bordered bg-white border-slate-200 text-slate-800"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">All Statuses</option>
            {['draft', 'sent', 'received', 'cancelled'].map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <button className="btn btn-sm btn-primary" onClick={() => setShowCreate(true)}>+ New PO</button>
        </div>
      </div>

      {err && <div className="alert alert-error text-sm">{err}</div>}

      <EntityTable
        columns={columns}
        data={pos}
        loading={loading}
        emptyMessage="No purchase orders."
        searchPlaceholder="Search PO, supplier, status..."
      />

      {showCreate && (
        <CreatePOModal
          suppliers={suppliers}
          onClose={() => setShowCreate(false)}
          onCreated={() => load()}
        />
      )}
      {detailPO && (
        <PODetailModal
          po={detailPO}
          suppliers={suppliers}
          onClose={() => setDetailPO(null)}
          onUpdated={() => { load(); setDetailPO(null); }}
        />
      )}
    </div>
  );
};

export default PurchaseOrdersPage;
