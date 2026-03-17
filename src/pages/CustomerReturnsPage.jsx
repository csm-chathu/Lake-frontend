import React, { useCallback, useEffect, useMemo, useState } from 'react';
import api from '../api/client.js';
import EntityTable from '../components/EntityTable.jsx';

const fmt = new Intl.NumberFormat('en-LK', { style: 'currency', currency: 'LKR' });

// ── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_COLORS = {
  pending:  'badge-warning',
  approved: 'badge-success',
  rejected: 'badge-error',
};

const emptyItem = () => ({
  description: '',
  medicineBrandId: '',
  quantity: '1',
  unitPrice: '',
  isDamaged: false,
  itemReason: '',
});

const emptyForm = () => ({
  returnDate: new Date().toISOString().slice(0, 10),
  customerName: '',
  originalSaleRef: '',
  reason: '',
  status: 'pending',
  refundMethod: 'cash',
  refundAmount: '',
  notes: '',
  items: [emptyItem()],
});

const asArray = (v) => {
  if (Array.isArray(v)) return v;
  if (Array.isArray(v?.data)) return v.data;
  return [];
};

const buildSaleItemDescription = (item) => {
  const medicineName = item?.brand?.medicine?.name;
  const brandName = item?.brand?.name;
  if (medicineName && brandName) {
    return `${medicineName} - ${brandName}`;
  }
  if (brandName) {
    return brandName;
  }
  return 'Returned item';
};

// ── CreateReturnModal ─────────────────────────────────────────────────────────

const CreateReturnModal = ({ medicineVariants, onClose, onCreated }) => {
  const [form, setForm]     = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [err, setErr]       = useState('');
  const [scanInput, setScanInput] = useState('');
  const [scanLoading, setScanLoading] = useState(false);
  const [scanMessage, setScanMessage] = useState('');

  const setField = (k, v) => setForm((p) => ({ ...p, [k]: v }));
  const setLine  = (idx, k, v) =>
    setForm((p) => ({ ...p, items: p.items.map((l, i) => (i === idx ? { ...l, [k]: v } : l)) }));
  const addLine    = () => setForm((p) => ({ ...p, items: [...p.items, emptyItem()] }));
  const removeLine = (idx) => setForm((p) => ({ ...p, items: p.items.filter((_, i) => i !== idx) }));

  const lineTotal = (li) => (Number(li.quantity) || 0) * (Number(li.unitPrice) || 0);
  const itemsTotal = form.items.reduce((s, li) => s + lineTotal(li), 0);
  const refundDisplay = form.refundAmount !== '' ? Number(form.refundAmount) : itemsTotal;

  const handleScanInvoice = async () => {
    const query = String(scanInput || '').trim();
    if (!query) {
      setScanMessage('Scan or enter an invoice barcode/reference first.');
      return;
    }

    setScanLoading(true);
    setErr('');
    setScanMessage('');

    try {
      const response = await api.get('/direct-sales', {
        params: {
          q: query,
          perPage: 10,
          page: 1
        }
      });

      const rows = asArray(response?.data);
      const normalizedQuery = query.toLowerCase();

      const matchedSale = rows.find((sale) =>
        String(sale?.saleReference || '').trim().toLowerCase() === normalizedQuery
      ) || rows[0];

      if (!matchedSale) {
        setScanMessage('No matching invoice found for this barcode/reference.');
        return;
      }

      const mappedItems = asArray(matchedSale.items)
        .map((item) => ({
          description: buildSaleItemDescription(item),
          medicineBrandId: item?.medicineBrandId ? String(item.medicineBrandId) : '',
          quantity: String(Number(item?.quantity) || 1),
          unitPrice: String(Number(item?.unitPrice) || 0),
          isDamaged: false,
          itemReason: ''
        }));

      const nextItems = mappedItems.length > 0 ? mappedItems : [emptyItem()];

      setForm((prev) => ({
        ...prev,
        originalSaleRef: matchedSale.saleReference || query,
        refundAmount: String(Number(matchedSale.total || 0)),
        reason: prev.reason || `Customer return for invoice ${matchedSale.saleReference || query}`,
        items: nextItems
      }));

      setScanMessage(`Invoice loaded: ${matchedSale.saleReference || query}`);
    } catch (ex) {
      setScanMessage(ex?.response?.data?.message || ex.message || 'Unable to scan invoice right now.');
    } finally {
      setScanLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.returnDate) { setErr('Return date is required.'); return; }
    setSaving(true);
    setErr('');
    try {
      const payload = {
        returnDate:      form.returnDate,
        customerName:    form.customerName || undefined,
        originalSaleRef: form.originalSaleRef || undefined,
        reason:          form.reason || undefined,
        status:          form.status,
        refundMethod:    form.refundMethod,
        refundAmount:    form.refundAmount !== '' ? Number(form.refundAmount) : undefined,
        notes:           form.notes || undefined,
        items:           form.items
          .filter((li) => li.description || li.medicineBrandId)
          .map((li) => ({
            description:     li.description || undefined,
            medicineBrandId: li.medicineBrandId ? Number(li.medicineBrandId) : undefined,
            quantity:        Number(li.quantity) || 1,
            unitPrice:       Number(li.unitPrice) || 0,
            isDamaged:       Boolean(li.isDamaged),
            itemReason:      li.itemReason || undefined,
          })),
      };
      const { data } = await api.post('/customer-returns', payload);
      onCreated?.(data);
      onClose();
    } catch (ex) {
      setErr(ex?.response?.data?.message || ex.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <dialog open className="modal modal-open">
      <div className="modal-box w-[96vw] max-w-5xl bg-white text-slate-900 p-0 overflow-hidden flex flex-col max-h-[92vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 shrink-0">
          <div>
            <h3 className="text-lg font-bold text-slate-900">New Customer Return</h3>
            <p className="text-xs text-slate-400 mt-0.5">Record items returned by a customer and issue a refund or exchange</p>
          </div>
          <button onClick={onClose} className="btn btn-sm btn-circle btn-ghost">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          {/* Meta fields */}
          <div className="px-6 py-4 border-b border-slate-100 shrink-0">
            <div className="grid grid-cols-3 gap-4">
              <label className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Return Date *</span>
                <input type="date" required className="input input-sm input-bordered w-full"
                  value={form.returnDate} onChange={(e) => setField('returnDate', e.target.value)} />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Customer Name</span>
                <input type="text" className="input input-sm input-bordered w-full" placeholder="Optional"
                  value={form.customerName} onChange={(e) => setField('customerName', e.target.value)} />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Original Sale Ref</span>
                <input type="text" className="input input-sm input-bordered w-full" placeholder="Sale #, invoice #…"
                  value={form.originalSaleRef} onChange={(e) => setField('originalSaleRef', e.target.value)} />
              </label>
              <div className="col-span-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="flex flex-wrap items-end gap-2">
                  <label className="flex flex-col gap-1 flex-1 min-w-[240px]">
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Scan Bill Barcode / Invoice Ref</span>
                    <input
                      type="text"
                      className="input input-sm input-bordered w-full"
                      placeholder="Scan barcode then press Enter"
                      value={scanInput}
                      onChange={(e) => setScanInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleScanInvoice();
                        }
                      }}
                    />
                  </label>
                  <button type="button" className="btn btn-sm btn-outline btn-primary" onClick={handleScanInvoice} disabled={scanLoading}>
                    {scanLoading ? 'Scanning…' : 'Scan & Fill'}
                  </button>
                </div>
                {scanMessage && (
                  <p className={`mt-2 text-xs ${scanMessage.startsWith('Invoice loaded:') ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {scanMessage}
                  </p>
                )}
              </div>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Refund Method</span>
                <select className="select select-sm select-bordered w-full"
                  value={form.refundMethod} onChange={(e) => setField('refundMethod', e.target.value)}>
                  <option value="cash">Cash</option>
                  <option value="credit">Credit (store credit)</option>
                  <option value="exchange">Exchange</option>
                  <option value="none">None</option>
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</span>
                <select className="select select-sm select-bordered w-full"
                  value={form.status} onChange={(e) => setField('status', e.target.value)}>
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Refund Amount
                  <span className="ml-1 text-slate-400 normal-case font-normal">
                    (auto: {fmt.format(itemsTotal)})
                  </span>
                </span>
                <input type="number" min="0" step="0.01" className="input input-sm input-bordered w-full"
                  placeholder={String(itemsTotal.toFixed(2))}
                  value={form.refundAmount} onChange={(e) => setField('refundAmount', e.target.value)} />
              </label>
              <label className="flex flex-col gap-1 col-span-3">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Return Reason</span>
                <input type="text" className="input input-sm input-bordered w-full"
                  placeholder="Defective product, wrong item, overcharge…"
                  value={form.reason} onChange={(e) => setField('reason', e.target.value)} />
              </label>
            </div>
          </div>

          {/* Items table */}
          <div className="flex flex-col flex-1 overflow-hidden px-6 py-4">
            <div className="flex items-center justify-between mb-3 shrink-0">
              <span className="text-sm font-semibold text-slate-700">
                Returned Items
                <span className="ml-2 badge badge-sm badge-neutral">{form.items.length}</span>
              </span>
              <button type="button" onClick={addLine} className="btn btn-sm btn-outline btn-primary gap-1">
                + Add row
              </button>
            </div>

            <div className="overflow-auto flex-1 rounded-xl border border-slate-200">
              <table className="table table-sm w-full">
                <thead className="sticky top-0 z-10 bg-slate-100 text-slate-600">
                  <tr>
                    <th className="w-6 text-center">#</th>
                    <th className="min-w-[180px]">Item / Description</th>
                    <th className="min-w-[150px]">Variant (optional)</th>
                    <th className="w-20 text-right">Qty</th>
                    <th className="w-28 text-right">Unit Price</th>
                    <th className="w-28 text-right">Line Total</th>
                    <th className="w-24 text-center">Damaged?</th>
                    <th className="min-w-[150px]">Item Reason</th>
                    <th className="w-10" />
                  </tr>
                </thead>
                <tbody>
                  {form.items.map((li, idx) => (
                    <tr key={idx} className="align-top hover:bg-slate-50 border-b border-slate-100">
                      <td className="text-center text-xs text-slate-400 pt-2.5">{idx + 1}</td>

                      <td className="py-1.5">
                        <input type="text"
                          placeholder="Item name"
                          className="input input-xs input-bordered w-full"
                          value={li.description}
                          onChange={(e) => setLine(idx, 'description', e.target.value)}
                        />
                      </td>

                      <td className="py-1.5">
                        <select className="select select-xs select-bordered w-full"
                          value={li.medicineBrandId}
                          onChange={(e) => setLine(idx, 'medicineBrandId', e.target.value)}>
                          <option value="">— select variant —</option>
                          {medicineVariants.map((v) => (
                            <option key={v.id} value={v.id}>{v.label}</option>
                          ))}
                        </select>
                      </td>

                      <td className="py-1.5">
                        <input type="number" min="0.01" step="0.01"
                          className="input input-xs input-bordered w-full text-right"
                          value={li.quantity}
                          onChange={(e) => setLine(idx, 'quantity', e.target.value)}
                        />
                      </td>

                      <td className="py-1.5">
                        <input type="number" min="0" step="0.01"
                          className="input input-xs input-bordered w-full text-right"
                          value={li.unitPrice}
                          onChange={(e) => setLine(idx, 'unitPrice', e.target.value)}
                        />
                      </td>

                      <td className="py-1.5 text-right text-xs font-semibold text-slate-700 pt-2.5 pr-2">
                        {fmt.format(lineTotal(li))}
                      </td>

                      <td className="py-1.5 text-center">
                        <input
                          type="checkbox"
                          className="checkbox checkbox-xs"
                          checked={Boolean(li.isDamaged)}
                          onChange={(e) => setLine(idx, 'isDamaged', e.target.checked)}
                        />
                      </td>

                      <td className="py-1.5">
                        <input type="text" placeholder="Damaged, expired…"
                          className="input input-xs input-bordered w-full"
                          value={li.itemReason}
                          onChange={(e) => setLine(idx, 'itemReason', e.target.value)}
                        />
                      </td>

                      <td className="py-1.5 text-center">
                        <button type="button"
                          disabled={form.items.length === 1}
                          className="btn btn-xs btn-ghost text-error disabled:opacity-30"
                          onClick={() => removeLine(idx)}
                          title="Remove row"
                        >✕</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-50 font-semibold text-slate-700">
                    <td colSpan={6} className="text-right text-xs pr-2 py-2">Items Total</td>
                    <td className="text-right text-sm pr-2 py-2">{fmt.format(itemsTotal)}</td>
                    <td colSpan={2} />
                  </tr>
                  <tr className="bg-emerald-50 font-bold text-emerald-700">
                    <td colSpan={6} className="text-right text-xs pr-2 py-2">Refund Amount</td>
                    <td className="text-right text-sm pr-2 py-2">{fmt.format(refundDisplay)}</td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-slate-100 shrink-0 space-y-3">
            <label className="flex flex-col gap-1">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Notes</span>
              <textarea rows={2} className="textarea textarea-bordered textarea-sm w-full"
                value={form.notes} onChange={(e) => setField('notes', e.target.value)} />
            </label>
            {err && <p className="text-error text-xs">{err}</p>}
            <div className="flex justify-end gap-2">
              <button type="button" className="btn btn-sm btn-ghost" onClick={onClose}>Cancel</button>
              <button type="submit" disabled={saving} className="btn btn-sm btn-primary min-w-28">
                {saving ? 'Saving…' : 'Save Return'}
              </button>
            </div>
          </div>
        </form>
      </div>
      <div className="modal-backdrop" onClick={onClose} />
    </dialog>
  );
};

// ── StatusBadge ───────────────────────────────────────────────────────────────

const StatusBadge = ({ status }) => (
  <span className={`badge badge-sm ${STATUS_COLORS[status] ?? 'badge-ghost'}`}>
    {status ?? '—'}
  </span>
);

// ── DetailModal ───────────────────────────────────────────────────────────────

const DetailModal = ({ ret, onClose, onStatusChange }) => {
  const [status, setStatus] = useState(ret.status);
  const [saving, setSaving] = useState(false);

  const handleStatusSave = async () => {
    if (status === ret.status) { onClose(); return; }
    setSaving(true);
    try {
      await api.put(`/customer-returns/${ret.id}`, { status });
      onStatusChange?.(ret.id, status);
      onClose();
    } catch (e) {
      // keep open
    } finally {
      setSaving(false);
    }
  };

  const items = Array.isArray(ret.items) ? ret.items : [];

  return (
    <dialog open className="modal modal-open">
      <div className="modal-box w-[96vw] max-w-3xl bg-white text-slate-900">
        <button onClick={onClose} className="btn btn-sm btn-circle btn-ghost absolute right-3 top-3">✕</button>

        <div className="mb-4">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-bold">{ret.returnReference}</h3>
            <StatusBadge status={ret.status} />
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            {ret.returnDate && `Date: ${ret.returnDate}`}
            {ret.customerName && ` · Customer: ${ret.customerName}`}
            {ret.originalSaleRef && ` · Ref: ${ret.originalSaleRef}`}
          </p>
          {ret.reason && <p className="text-sm text-slate-600 mt-2">Reason: {ret.reason}</p>}
        </div>

        {/* Items */}
        {items.length > 0 && (
          <div className="overflow-x-auto rounded-xl border border-slate-200 mb-4">
            <table className="table table-sm w-full">
              <thead className="bg-slate-100 text-slate-600">
                <tr>
                  <th>Item</th>
                  <th className="text-right w-16">Qty</th>
                  <th className="text-right w-28">Unit Price</th>
                  <th className="text-right w-28">Line Total</th>
                  <th>Reason</th>
                </tr>
              </thead>
              <tbody>
                {items.map((li, i) => (
                  <tr key={i} className="hover:bg-slate-50">
                    <td>{li.description || li.brand?.name || '—'}</td>
                    <td className="text-right">{li.quantity}</td>
                    <td className="text-right">{fmt.format(Number(li.unitPrice || 0))}</td>
                    <td className="text-right font-semibold">{fmt.format(Number(li.lineTotal || 0))}</td>
                    <td className="text-xs text-slate-500">{li.itemReason || '—'}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-emerald-50 font-bold text-emerald-700">
                  <td colSpan={3} className="text-right text-xs">Refund Amount</td>
                  <td className="text-right">{fmt.format(Number(ret.refundAmount || 0))}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4 text-sm mb-4">
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Refund Method</p>
            <p className="font-medium capitalize">{ret.refundMethod || '—'}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Refund Amount</p>
            <p className="font-bold text-emerald-600">{fmt.format(Number(ret.refundAmount || 0))}</p>
          </div>
        </div>

        {ret.notes && (
          <p className="text-xs text-slate-500 mb-4">Notes: {ret.notes}</p>
        )}

        {/* Status update inline */}
        <div className="flex items-center justify-between border-t border-slate-100 pt-4">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">Update status:</span>
            <select className="select select-xs select-bordered"
              value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
          <div className="flex gap-2">
            <button type="button" className="btn btn-sm btn-ghost" onClick={onClose}>Close</button>
            <button type="button" className="btn btn-sm btn-primary" disabled={saving} onClick={handleStatusSave}>
              {saving ? 'Saving…' : 'Save status'}
            </button>
          </div>
        </div>
      </div>
      <div className="modal-backdrop" onClick={onClose} />
    </dialog>
  );
};

// ── CustomerReturnsPage ───────────────────────────────────────────────────────

const CustomerReturnsPage = () => {
  const [returns, setReturns]               = useState([]);
  const [medicineVariants, setMedVariants]  = useState([]);
  const [loading, setLoading]               = useState(true);
  const [err, setErr]                       = useState('');
  const [showCreate, setShowCreate]         = useState(false);
  const [detailRet, setDetailRet]           = useState(null);

  // Filters
  const [query, setQuery]           = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [dateFrom, setDateFrom]     = useState('');
  const [dateTo, setDateTo]         = useState('');
  const [page, setPage]             = useState(1);
  const [perPage, setPerPage]       = useState(15);
  const [total, setTotal]           = useState(0);
  const [lastPage, setLastPage]     = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    setErr('');
    try {
      const params = {
        per_page: perPage,
        page,
        ...(query && { q: query }),
        ...(filterStatus && { status: filterStatus }),
        ...(dateFrom && { date_from: dateFrom }),
        ...(dateTo && { date_to: dateTo }),
      };
      const [retRes, medRes] = await Promise.all([
        api.get('/customer-returns', { params }).then((r) => r.data),
        medicineVariants.length === 0
          ? api.get('/medicines').then((r) => r.data)
          : Promise.resolve(null),
      ]);
      setReturns(asArray(retRes));
      setTotal(Number(retRes?.total) || 0);
      setLastPage(Number(retRes?.last_page) || 1);

      if (medRes !== null) {
        const variants = asArray(medRes).flatMap((m) =>
          asArray(m?.brands).map((b) => ({
            id:    b.id,
            label: `${m.name} - ${b.name || 'Variant'}`,
          }))
        );
        setMedVariants(variants);
      }
    } catch (e) {
      setErr(e?.response?.data?.message || e.message);
    } finally {
      setLoading(false);
    }
  }, [page, perPage, query, filterStatus, dateFrom, dateTo]);

  useEffect(() => { load(); }, [load]);

  const handleStatusChange = (id, newStatus) => {
    setReturns((prev) =>
      prev.map((r) => (r.id === id ? { ...r, status: newStatus } : r))
    );
  };

  const columns = useMemo(() => [
    {
      header: 'Ref #',
      accessor: 'returnReference',
      render: (r) => <span className="font-mono text-xs font-semibold text-primary">{r.returnReference}</span>,
    },
    {
      header: 'Date',
      accessor: 'returnDate',
      render: (r) => r.returnDate || '—',
    },
    {
      header: 'Customer',
      accessor: 'customerName',
      render: (r) => r.customerName || '—',
    },
    {
      header: 'Sale Ref',
      accessor: 'originalSaleRef',
      render: (r) => r.originalSaleRef || '—',
    },
    {
      header: 'Items',
      accessor: 'items',
      render: (r) => Array.isArray(r.items) ? r.items.length : 0,
    },
    {
      header: 'Refund',
      accessor: 'refundAmount',
      render: (r) => (
        <span className="font-semibold text-emerald-600">{fmt.format(Number(r.refundAmount || 0))}</span>
      ),
    },
    {
      header: 'Method',
      accessor: 'refundMethod',
      render: (r) => <span className="capitalize">{r.refundMethod || '—'}</span>,
    },
    {
      header: 'Status',
      accessor: 'status',
      render: (r) => <StatusBadge status={r.status} />,
    },
    {
      header: 'View',
      accessor: 'id',
      render: (r) => (
        <button className="btn btn-xs btn-ghost text-primary" onClick={() => setDetailRet(r)}>
          👁️
        </button>
      ),
    },
  ], []);

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Customer Returns</h1>
          <p className="text-xs text-slate-400 mt-0.5">Record and manage items returned by customers with refund tracking</p>
        </div>
        <button className="btn btn-sm btn-primary" onClick={() => setShowCreate(true)}>+ New Return</button>
      </div>

      {err && <div className="alert alert-error text-sm">{err}</div>}

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-base-300 bg-base-100 p-3 shadow-sm">
        <label className="flex flex-col gap-1">
          <span className="text-xs text-slate-500">Search</span>
          <input type="text" className="input input-sm input-bordered w-56"
            placeholder="Ref #, customer, sale ref…"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setPage(1); }} />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs text-slate-500">Status</span>
          <select className="select select-sm select-bordered w-32"
            value={filterStatus} onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }}>
            <option value="">All</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs text-slate-500">From</span>
          <input type="date" className="input input-sm input-bordered"
            value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }} />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs text-slate-500">To</span>
          <input type="date" className="input input-sm input-bordered"
            value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }} />
        </label>

        {(query || filterStatus || dateFrom || dateTo) && (
          <button className="btn btn-sm btn-ghost self-end"
            onClick={() => { setQuery(''); setFilterStatus(''); setDateFrom(''); setDateTo(''); setPage(1); }}>
            Clear
          </button>
        )}

        {/* Summary totals */}
        {returns.length > 0 && (
          <div className="ml-auto flex gap-5 text-right">
            <div>
              <p className="text-xs text-slate-400">Showing</p>
              <p className="text-sm font-bold text-slate-700">{total} return(s)</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Total refund</p>
              <p className="text-sm font-bold text-emerald-600">
                {fmt.format(returns.reduce((s, r) => s + Number(r.refundAmount || 0), 0))}
              </p>
            </div>
          </div>
        )}
      </div>

      <EntityTable
        columns={columns}
        data={returns}
        loading={loading}
        emptyMessage="No customer returns recorded yet."
        bodyMaxHeightClass="max-h-[560px]"
        enableSearch={false}
      />

      {/* Pagination */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <select className="select select-sm select-bordered"
          value={perPage}
          onChange={(e) => { setPerPage(Number(e.target.value)); setPage(1); }}>
          {[10, 15, 25, 50].map((s) => <option key={s} value={s}>{s} / page</option>)}
        </select>

        <div className="flex items-center gap-2 text-sm text-slate-600">
          <span>{total} record(s)</span>
          <button className="btn btn-xs btn-outline"
            disabled={page <= 1 || loading}
            onClick={() => setPage((p) => Math.max(1, p - 1))}>Prev</button>
          <span>Page {page} / {lastPage}</span>
          <button className="btn btn-xs btn-outline"
            disabled={page >= lastPage || loading}
            onClick={() => setPage((p) => Math.min(lastPage, p + 1))}>Next</button>
        </div>
      </div>

      {showCreate && (
        <CreateReturnModal
          medicineVariants={medicineVariants}
          onClose={() => setShowCreate(false)}
          onCreated={() => load()}
        />
      )}

      {detailRet && (
        <DetailModal
          ret={detailRet}
          onClose={() => setDetailRet(null)}
          onStatusChange={handleStatusChange}
        />
      )}
    </div>
  );
};

export default CustomerReturnsPage;
