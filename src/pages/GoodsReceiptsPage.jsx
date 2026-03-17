import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createGoodsReceipt, fetchGoodsReceipts, fetchPurchaseOrders } from '../api/procurement.js';
import api from '../api/client.js';
import EntityTable from '../components/EntityTable.jsx';

const fmt = new Intl.NumberFormat('en-LK', { style: 'currency', currency: 'LKR' });

const emptyLine = () => ({
  description: '',
  quantity: '',
  unitCost: '',
  wholesalePrice: '',
  sellingPrice: '',
  barcode: '',
  stockItemId: '',
  medicineBrandId: '',
  batchNumber: '',
  expiryDate: '',
});

const emptyGRN = () => ({
  supplierId: '',
  purchaseOrderId: '',
  receivedDate: new Date().toISOString().slice(0, 10),
  notes: '',
  items: [emptyLine()],
});

const asArray = (value) => {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.data)) return value.data;
  if (Array.isArray(value?.items)) return value.items;
  if (Array.isArray(value?.results)) return value.results;
  return [];
};

const flattenMedicineVariants = (value) =>
  asArray(value).flatMap((medicine) =>
    asArray(medicine?.brands).map((brand) => ({
      id: brand.id,
      medicineName: medicine.name,
      label: `${medicine.name} - ${brand.name || 'Variant'}`,
      sellingPrice: Number(brand.price) || 0,
      wholesalePrice: Number(brand.wholesale_price) || 0,
      barcode: brand.barcode || '',
    }))
  );

const extractMedicineNames = (value) =>
  Array.from(new Set(asArray(value).map((medicine) => String(medicine?.name || '').trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b));

const normalizeGRN = (grn) => ({
  ...grn,
  grnNumber: grn.grnNumber ?? grn.grn_number ?? `GRN-${grn.id}`,
  supplierId: grn.supplierId ?? grn.supplier_id ?? null,
  purchaseOrderId: grn.purchaseOrderId ?? grn.purchase_order_id ?? null,
  receivedDate: grn.receivedDate ?? grn.receiptDate ?? grn.receipt_date ?? null,
  items: Array.isArray(grn.items) ? grn.items : [],
  totalCost: Number(grn.totalCost ?? grn.total_cost ?? 0),
});

const normalizePO = (po) => ({
  ...po,
  poNumber: po.poNumber ?? po.po_number ?? `PO-${po.id}`,
});

// ── GRN Detail Modal ──────────────────────────────────────────────────────────

const GRNDetailModal = ({ grn, suppliers, onClose }) => {
  const supplier = suppliers.find((s) => s.id === grn.supplierId || s.id === grn.supplier_id);
  const items = Array.isArray(grn.items) ? grn.items : [];
  const columns = useMemo(
    () => [
      { header: 'Description', accessor: 'description', render: (li) => li.description || '—' },
      { header: 'Qty', accessor: 'quantity', render: (li) => li.quantity ?? 0 },
      { header: 'Unit Cost', accessor: 'unitCost', render: (li) => fmt.format(Number(li.unitCost) || 0) },
      { header: 'Wholesale Price', accessor: 'wholesalePrice', render: (li) => fmt.format(Number(li.wholesalePrice) || 0) },
      { header: 'Selling Price', accessor: 'sellingPrice', render: (li) => fmt.format(Number(li.sellingPrice) || 0) },
      { header: 'Barcode', accessor: 'barcode', render: (li) => li.barcode || '—' },
      { header: 'Batch', accessor: 'batchNumber', render: (li) => li.batchNumber || '—' },
      {
        header: 'Expiry',
        accessor: 'expiryDate',
        render: (li) => (li.expiryDate ? new Date(li.expiryDate).toLocaleDateString('en-LK') : '—'),
      },
    ],
    []
  );

  return (
    <dialog open className="modal modal-open">
      <div className="modal-box w-11/12 max-w-2xl bg-white text-slate-900">
        <button onClick={onClose} className="btn btn-sm btn-circle btn-ghost absolute right-3 top-3">✕</button>
        <div className="mb-4">
          <h3 className="text-lg font-bold text-slate-900">{grn.grnNumber}</h3>
          <p className="text-xs text-slate-400">
            Supplier: {supplier?.name ?? '—'}
            {grn.receivedDate && ` · Received: ${new Date(grn.receivedDate).toLocaleDateString('en-LK')}`}
          </p>
        </div>

        <EntityTable
          columns={columns}
          data={items.map((item, index) => ({ id: index + 1, ...item }))}
          loading={false}
          emptyMessage="No GRN line items."
          bodyMaxHeightClass="max-h-[320px]"
          enableSearch={false}
        />

        {grn.notes && <p className="text-xs text-slate-400">Notes: {grn.notes}</p>}
      </div>
      <div className="modal-backdrop" onClick={onClose} />
    </dialog>
  );
};

// ── CreateGRNModal ────────────────────────────────────────────────────────────

const CreateGRNModal = ({ suppliers, purchaseOrders, medicineVariants, medicineNames, onClose, onCreated }) => {
  const [form, setForm] = useState(emptyGRN());
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const setField = (k, v) => setForm((p) => ({ ...p, [k]: v }));
  const setLine = (idx, k, v) =>
    setForm((p) => ({ ...p, items: p.items.map((l, i) => (i === idx ? { ...l, [k]: v } : l)) }));
  const addLine = () => setForm((p) => ({ ...p, items: [...p.items, emptyLine()] }));
  const removeLine = (idx) => setForm((p) => ({ ...p, items: p.items.filter((_, i) => i !== idx) }));

  // Prefill items from linked PO
  const handlePOChange = (poId) => {
    setField('purchaseOrderId', poId);
    if (!poId) return;
    const po = purchaseOrders.find((p) => String(p.id) === String(poId));
    if (po && Array.isArray(po.items) && po.items.length > 0) {
      setForm((prev) => ({
        ...prev,
        purchaseOrderId: poId,
        supplierId: String(po.supplierId || po.supplier_id || prev.supplierId),
        items: po.items.map((li) => ({
          description: li.description ?? '',
          quantity: String(li.quantity ?? ''),
          unitCost: String(li.unitCost ?? ''),
          wholesalePrice: String(li.wholesalePrice ?? ''),
          sellingPrice: String(li.sellingPrice ?? ''),
          barcode: li.barcode ?? '',
          stockItemId: String(li.stockItemId ?? li.stock_item_id ?? ''),
          medicineBrandId: String(li.medicineBrandId ?? li.medicine_brand_id ?? ''),
          batchNumber: '',
          expiryDate: '',
        })),
      }));
    }
  };

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
          wholesalePrice: l.wholesalePrice !== '' ? Number(l.wholesalePrice) : undefined,
          sellingPrice: l.sellingPrice !== '' ? Number(l.sellingPrice) : undefined,
          barcode: l.barcode || undefined,
          stockItemId: l.stockItemId ? Number(l.stockItemId) : undefined,
          medicineBrandId: l.medicineBrandId ? Number(l.medicineBrandId) : undefined,
          batchNumber: l.batchNumber || undefined,
          expiryDate: l.expiryDate || undefined,
        })),
      };
      const res = await createGoodsReceipt(payload);
      onCreated?.(res.data ?? res);
      onClose();
    } catch (ex) {
      setErr(ex.message);
    } finally {
      setSaving(false);
    }
  };

  const lineTotal = (li) => (Number(li.quantity) || 0) * (Number(li.unitCost) || 0);
  const grandTotal = form.items.reduce((s, li) => s + lineTotal(li), 0);

  return (
    <dialog open className="modal modal-open">
      <div className="modal-box w-[96vw] max-w-6xl bg-white text-slate-900 p-0 overflow-hidden flex flex-col max-h-[92vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 shrink-0">
          <div>
            <h3 className="text-lg font-bold text-slate-900">New Goods Receipt (GRN)</h3>
            <p className="text-xs text-slate-400 mt-0.5">Record received stock and update inventory</p>
          </div>
          <button onClick={onClose} className="btn btn-sm btn-circle btn-ghost">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          {/* Meta fields */}
          <div className="px-6 py-4 border-b border-slate-100 shrink-0">
            <div className="grid grid-cols-3 gap-4">
              <label className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Supplier *</span>
                <select required
                  className="select select-sm select-bordered w-full"
                  value={form.supplierId}
                  onChange={(e) => setField('supplierId', e.target.value)}
                >
                  <option value="">Select supplier…</option>
                  {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Link to PO</span>
                <select
                  className="select select-sm select-bordered w-full"
                  value={form.purchaseOrderId}
                  onChange={(e) => handlePOChange(e.target.value)}
                >
                  <option value="">— None —</option>
                  {purchaseOrders
                    .filter((p) => p.status !== 'cancelled' && p.status !== 'received')
                    .map((p) => <option key={p.id} value={p.id}>{p.poNumber}</option>)}
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Received Date</span>
                <input type="date"
                  className="input input-sm input-bordered w-full"
                  value={form.receivedDate}
                  onChange={(e) => setField('receivedDate', e.target.value)}
                />
              </label>
            </div>
          </div>

          {/* Items table — scrollable */}
          <div className="flex flex-col flex-1 overflow-hidden px-6 py-4">
            <div className="flex items-center justify-between mb-3 shrink-0">
              <span className="text-sm font-semibold text-slate-700">
                Items Received
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
                    <th className="min-w-[180px]">Item Name *</th>
                    <th className="min-w-[120px]">Variant</th>
                    <th className="w-20 text-right">Qty *</th>
                    <th className="w-28 text-right">Unit Cost</th>
                    <th className="w-28 text-right">Wholesale</th>
                    <th className="w-28 text-right">Sell Price</th>
                    <th className="w-28 text-right">Line Total</th>
                    <th className="w-28">Barcode</th>
                    <th className="w-24">Batch #</th>
                    <th className="w-32">Expiry</th>
                    <th className="w-10" />
                  </tr>
                </thead>
                <tbody>
                  {form.items.map((li, idx) => (
                    <tr key={idx} className="align-top hover:bg-slate-50 border-b border-slate-100">
                      <td className="text-center text-xs text-slate-400 pt-2.5">{idx + 1}</td>

                      {/* Item name */}
                      <td className="py-1.5">
                        <input type="text" required
                          list={`grn-item-names-${idx}`}
                          placeholder="Type or select item"
                          className="input input-xs input-bordered w-full"
                          value={li.description}
                          onChange={(e) => setLine(idx, 'description', e.target.value)}
                        />
                        <datalist id={`grn-item-names-${idx}`}>
                          {medicineNames.map((name) => <option key={name} value={name} />)}
                        </datalist>
                      </td>

                      {/* Variant */}
                      <td className="py-1.5">
                        <select
                          className="select select-xs select-bordered w-full"
                          value={li.medicineBrandId}
                          onChange={(e) => {
                            const value = e.target.value;
                            const selectedVariant = medicineVariants.find((variant) => String(variant.id) === String(value));
                            setForm((prev) => ({
                              ...prev,
                              items: prev.items.map((line, lineIndex) => {
                                if (lineIndex !== idx) {
                                  return line;
                                }

                                return {
                                  ...line,
                                  medicineBrandId: value,
                                  sellingPrice: selectedVariant ? String(selectedVariant.sellingPrice ?? '') : line.sellingPrice,
                                  wholesalePrice: selectedVariant ? String(selectedVariant.wholesalePrice ?? '') : line.wholesalePrice,
                                  barcode: selectedVariant && !line.barcode ? selectedVariant.barcode : line.barcode,
                                };
                              })
                            }));
                          }}
                        >
                          <option value="">— variant —</option>
                          {medicineVariants
                            .filter((v) => !li.description || v.medicineName.toLowerCase() === li.description.toLowerCase())
                            .map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}
                        </select>
                      </td>

                      {/* Qty */}
                      <td className="py-1.5">
                        <input type="number" min="1" required
                          className="input input-xs input-bordered w-full text-right"
                          value={li.quantity}
                          onChange={(e) => setLine(idx, 'quantity', e.target.value)}
                        />
                      </td>

                      {/* Unit Cost */}
                      <td className="py-1.5">
                        <input type="number" min="0" step="0.01"
                          className="input input-xs input-bordered w-full text-right"
                          value={li.unitCost}
                          onChange={(e) => setLine(idx, 'unitCost', e.target.value)}
                        />
                      </td>

                      {/* Wholesale Price */}
                      <td className="py-1.5">
                        <input type="number" min="0" step="0.01"
                          className="input input-xs input-bordered w-full text-right"
                          value={li.wholesalePrice}
                          onChange={(e) => setLine(idx, 'wholesalePrice', e.target.value)}
                        />
                      </td>

                      {/* Selling Price */}
                      <td className="py-1.5">
                        <input type="number" min="0" step="0.01"
                          className="input input-xs input-bordered w-full text-right"
                          value={li.sellingPrice}
                          onChange={(e) => setLine(idx, 'sellingPrice', e.target.value)}
                        />
                      </td>

                      {/* Line total (read-only) */}
                      <td className="py-1.5 text-right text-xs font-semibold text-slate-700 pt-2.5 pr-2">
                        {fmt.format(lineTotal(li))}
                      </td>

                      {/* Barcode */}
                      <td className="py-1.5">
                        <input type="text" placeholder="—"
                          className="input input-xs input-bordered w-full"
                          value={li.barcode}
                          onChange={(e) => setLine(idx, 'barcode', e.target.value)}
                        />
                      </td>

                      {/* Batch */}
                      <td className="py-1.5">
                        <input type="text" placeholder="—"
                          className="input input-xs input-bordered w-full"
                          value={li.batchNumber}
                          onChange={(e) => setLine(idx, 'batchNumber', e.target.value)}
                        />
                      </td>

                      {/* Expiry */}
                      <td className="py-1.5">
                        <input type="date"
                          className="input input-xs input-bordered w-full"
                          value={li.expiryDate}
                          onChange={(e) => setLine(idx, 'expiryDate', e.target.value)}
                        />
                      </td>

                      {/* Remove */}
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
                    <td colSpan={7} className="text-right text-xs pr-2 py-2">Grand Total</td>
                    <td className="text-right text-sm pr-2 py-2 text-primary">{fmt.format(grandTotal)}</td>
                    <td colSpan={4} />
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
                {saving ? 'Saving…' : 'Record GRN'}
              </button>
            </div>
          </div>
        </form>
      </div>
      <div className="modal-backdrop" onClick={onClose} />
    </dialog>
  );
};

// ── GoodsReceiptsPage ─────────────────────────────────────────────────────────

const GoodsReceiptsPage = () => {
  const [grns, setGRNs] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [purchaseOrders, setPOs] = useState([]);
  const [medicineVariants, setMedicineVariants] = useState([]);
  const [medicineNames, setMedicineNames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [detailGRN, setDetailGRN] = useState(null);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [total, setTotal] = useState(0);
  const [lastPage, setLastPage] = useState(1);

  const supplierById = useMemo(
    () => Object.fromEntries(suppliers.map((s) => [String(s.id), s])),
    [suppliers]
  );

  const poById = useMemo(
    () => Object.fromEntries(purchaseOrders.map((p) => [String(p.id), p])),
    [purchaseOrders]
  );

  const columns = useMemo(
    () => [
      {
        header: 'GRN #',
        accessor: 'grnNumber',
        render: (grn) => <span className="font-mono text-xs font-semibold text-primary">{grn.grnNumber}</span>,
      },
      {
        header: 'Supplier',
        accessor: 'supplierId',
        render: (grn) => supplierById[String(grn.supplierId)]?.name ?? '—',
      },
      {
        header: 'Received Date',
        accessor: 'receivedDate',
        render: (grn) => (grn.receivedDate ? new Date(grn.receivedDate).toLocaleDateString('en-LK') : '—'),
      },
      {
        header: 'Linked PO',
        accessor: 'purchaseOrderId',
        render: (grn) => poById[String(grn.purchaseOrderId)]?.poNumber ?? '—',
      },
      {
        header: 'Items',
        accessor: 'items',
        render: (grn) => Array.isArray(grn.items) ? grn.items.length : 0,
      },
      {
        header: 'Total Cost',
        accessor: 'totalCost',
        render: (grn) => fmt.format(Number(grn.totalCost) || 0),
      },
      {
        header: 'View',
        accessor: 'id',
        render: (grn) => (
          <button className="btn btn-xs btn-ghost text-primary" onClick={() => setDetailGRN(grn)} aria-label="View goods receipt">
            👁️
          </button>
        ),
      },
    ],
    [poById, supplierById]
  );

  const load = useCallback(async () => {
    setLoading(true);
    setErr('');
    try {
      const [grnRes, supRes, poRes, medRes] = await Promise.all([
        fetchGoodsReceipts({ q: query || undefined, page, perPage }),
        api.get('/suppliers').then((r) => r.data),
        fetchPurchaseOrders(),
        api.get('/medicines').then((r) => r.data),
      ]);
      setGRNs(asArray(grnRes).map(normalizeGRN));
      if (grnRes && typeof grnRes === 'object') {
        setTotal(Number(grnRes.total) || 0);
        setLastPage(Number(grnRes.last_page) || 1);
      }
      setSuppliers(asArray(supRes));
      setPOs(asArray(poRes).map(normalizePO));
      setMedicineVariants(flattenMedicineVariants(medRes));
      setMedicineNames(extractMedicineNames(medRes));
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }, [page, perPage, query]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Goods Receipts (GRN)</h1>
          <p className="text-xs text-slate-400 mt-0.5">Record GRNs, receive stock, and update inventory</p>
        </div>
        <button className="btn btn-sm btn-primary" onClick={() => setShowCreate(true)}>+ New GRN</button>
      </div>

      {err && <div className="alert alert-error text-sm">{err}</div>}

      <div className="flex items-center gap-2">
        <input
          type="text"
          className="input input-bordered input-sm w-72"
          placeholder="Search GRN, supplier, notes..."
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setPage(1);
          }}
        />
      </div>

      <EntityTable
        columns={columns}
        data={grns}
        loading={loading}
        emptyMessage="No goods receipts."
        bodyMaxHeightClass="max-h-[560px]"
        enableSearch={false}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <select
            className="select select-sm select-bordered"
            value={perPage}
            onChange={(e) => {
              setPerPage(Number(e.target.value) || 10);
              setPage(1);
            }}
          >
            {[10, 20, 50].map((size) => <option key={size} value={size}>{size} / page</option>)}
          </select>
        </div>

        <div className="flex items-center gap-2 text-sm text-slate-600">
          <span>{total} record(s)</span>
          <button
            className="btn btn-xs btn-outline"
            disabled={page <= 1 || loading}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Prev
          </button>
          <span>Page {page} / {lastPage}</span>
          <button
            className="btn btn-xs btn-outline"
            disabled={page >= lastPage || loading}
            onClick={() => setPage((p) => Math.min(lastPage, p + 1))}
          >
            Next
          </button>
        </div>
      </div>

      {showCreate && (
        <CreateGRNModal
          suppliers={suppliers}
          purchaseOrders={purchaseOrders}
          medicineVariants={medicineVariants}
          medicineNames={medicineNames}
          onClose={() => setShowCreate(false)}
          onCreated={() => { load(); }}
        />
      )}
      {detailGRN && (
        <GRNDetailModal
          grn={detailGRN}
          suppliers={suppliers}
          onClose={() => setDetailGRN(null)}
        />
      )}
    </div>
  );
};

export default GoodsReceiptsPage;
