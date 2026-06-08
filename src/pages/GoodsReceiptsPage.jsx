import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, ChevronLeft, ChevronRight, Eye, PackageCheck, Plus, Search, X } from 'lucide-react';
import { createGoodsReceipt, fetchGoodsReceipts, fetchPurchaseOrders } from '../api/procurement.js';
import api from '../api/client.js';
import EntityTable from '../components/EntityTable.jsx';
import CreatableSelect from 'react-select/creatable';

const fmt = new Intl.NumberFormat('en-LK', { style: 'currency', currency: 'LKR' });

const emptyLine = () => ({
  description: '',
  quantity: '',
  unitType: 'unit',
  scale: 'ml',
  conversion: 1,
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
      unitType: brand.unit_type ?? 'unit',
      unitCost: Number(brand.unit_cost) || 0,
      conversion: Number(brand.conversion) || 1,
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

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center px-4 backdrop-blur-sm">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative z-[10000] w-full max-w-5xl rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 bg-slate-50 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-blue-600">
              <PackageCheck size={18} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-800">{grn.grnNumber}</h3>
              <p className="text-xs text-slate-400">
                Supplier: {supplier?.name ?? '—'}
                {grn.receivedDate && ` · Received: ${new Date(grn.receivedDate).toLocaleDateString('en-LK')}`}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700">
            <X size={16} />
          </button>
        </div>

        <div className="p-6">
          <EntityTable
            columns={columns}
            data={items.map((item, index) => ({ id: index + 1, ...item }))}
            loading={false}
            emptyMessage="No GRN line items."
            bodyMaxHeightClass="max-h-[320px]"
            enableSearch={false}
          />
        </div>

      </div>
    </div>
  , document.body);
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
          unitType: li.unitType ?? 'bottle',
          conversion: li.conversion ?? 1,
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

  // Helper to generate a UUID (RFC4122 v4, simple version)
  function uuidv4() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.supplierId) { setErr('Please select a supplier.'); return; }
    setSaving(true);
    setErr('');
    try {
      const payload = {
        ...form,
        items: form.items.map((l) => {
          let batchNumber = l.batchNumber;
          if (!batchNumber || !batchNumber.trim()) {
            batchNumber = uuidv4();
          }
          return {
            description: l.description,
            quantity: Number(l.quantity) || 0,
            unitType: l.unitType,
            scale: l.scale,
            conversion: Number(l.conversion) || 1,
            unitCost: Number(l.unitCost) || 0,
            wholesalePrice: l.wholesalePrice !== '' ? Number(l.wholesalePrice) : undefined,
            sellingPrice: l.sellingPrice !== '' ? Number(l.sellingPrice) : undefined,
            barcode: l.barcode || undefined,
            stockItemId: l.stockItemId ? Number(l.stockItemId) : undefined,
            medicineBrandId: l.medicineBrandId ? Number(l.medicineBrandId) : undefined,
            batchNumber,
            expiryDate: l.expiryDate || undefined,
          };
        }),
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

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center px-4 backdrop-blur-sm">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative z-[10000] w-[96vw] max-w-7xl overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-900 shadow-2xl flex max-h-[92vh] flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 shrink-0">
          <div>
            <h3 className="text-lg font-bold text-slate-900">New Goods Receipt (GRN)</h3>
            <p className="text-xs text-slate-400 mt-0.5">Record received stock and update inventory</p>
          </div>
          <button onClick={onClose} className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"><X size={16} /></button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          {/* Meta fields */}
          <div className="px-6 py-4 border-b border-slate-100 shrink-0">
            <div className="grid grid-cols-3 gap-4">
              <label className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Supplier *</span>
                <select required
                  className="select select-xs select-bordered w-full"
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
                  className="select select-xs select-bordered w-full"
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
                  className="input input-xs input-bordered w-full"
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
              <button type="button" onClick={addLine} className="inline-flex items-center gap-1.5 btn btn-sm btn-outline btn-primary rounded-xl">
                <Plus size={14} /> Add row
              </button>
            </div>

            <div className="overflow-auto flex-1 rounded-xl border border-slate-200">
              <div className="divide-y divide-slate-200">
                {form.items.map((li, idx) => (
                  <div key={idx} className={`p-4 ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`} style={{ position: 'relative', zIndex: form.items.length - idx }}>
                    <div className="flex items-start gap-4">
                      <div className="text-center text-xs text-slate-400 pt-7 w-6">{idx + 1}</div>
                      <div className="flex-1 grid grid-cols-12 gap-x-4 gap-y-3 items-start">
                        {/* --- Row 1 --- */}
                        <div className="form-control col-span-12 sm:col-span-6 md:col-span-3">
                          <span className="label-text text-xs font-semibold text-slate-500">Item Name *</span>
                          <CreatableSelect
                            isClearable
                            placeholder="Type or select item"
                            options={medicineNames.map(name => ({ value: name, label: name }))}
                            value={li.description ? { value: li.description, label: li.description } : null}
                            onChange={(option) => {
                              setLine(idx, 'description', option ? option.value : '');
                              // When an item is selected, filter variants
                              const selectedVariant = medicineVariants.find((variant) => variant.medicineName.toLowerCase() === (option ? option.value.toLowerCase() : ''));
                              if (selectedVariant) {
                                setLine(idx, 'medicineBrandId', String(selectedVariant.id));
                                setLine(idx, 'sellingPrice', String(selectedVariant.sellingPrice ?? ''));
                                setLine(idx, 'wholesalePrice', String(selectedVariant.wholesalePrice ?? ''));
                                if (!li.barcode) {
                                  setLine(idx, 'barcode', selectedVariant.barcode);
                                }
                              }
                            }}
                            onCreateOption={(inputValue) => setLine(idx, 'description', inputValue)}
                            menuPortalTarget={document.body}
                            styles={{
                              control: (base, state) => ({
                                ...base,
                                minHeight: '2rem',
                                height: '2rem',
                                fontSize: '0.875rem',
                                borderColor: state.isFocused ? 'hsl(var(--p))' : 'hsl(var(--bc) / 0.2)',
                                backgroundColor: 'hsl(var(--b1))',
                                borderRadius: 'var(--rounded-btn, 0.5rem)',
                                boxShadow: state.isFocused ? '0 0 0 1px hsl(var(--p))' : 'none',
                                '&:hover': {
                                  borderColor: state.isFocused ? 'hsl(var(--p))' : 'hsl(var(--bc) / 0.2)',
                                }
                              }),
                              input: (base) => ({ ...base, margin: 0, padding: 0, color: 'hsl(var(--bc))' }),
                              valueContainer: (base) => ({ ...base, padding: '0 0.5rem' }),
                              dropdownIndicator: (base) => ({ ...base, padding: '0 0.5rem' }),
                              clearIndicator: (base) => ({ ...base, padding: '0 0.5rem' }),
                              menu: (base) => ({ ...base, backgroundColor: 'white' }),
                              menuPortal: (base) => ({ ...base, zIndex: 9999 }),
                              option: (base, state) => ({
                                ...base,
                                backgroundColor: state.isSelected ? 'hsl(var(--p))' : (state.isFocused ? 'hsl(var(--p) / 0.2)' : 'transparent'),
                                color: state.isSelected ? 'hsl(var(--pc))' : 'hsl(var(--bc))',
                              }),
                            }}
                          />
                        </div>
                        <label className="form-control col-span-12 sm:col-span-6 md:col-span-2">
                          <span className="label-text text-xs font-semibold text-slate-500">Variant</span>
                          <select
                            className="select select-sm select-bordered w-full mt-1"
                            value={li.medicineBrandId}
                            onChange={(e) => {
                              const value = e.target.value;
                              const selectedVariant = medicineVariants.find((variant) => String(variant.id) === String(value));
                              setForm((prev) => ({
                                ...prev,
                                items: prev.items.map((line, lineIndex) => {
                                  if (lineIndex !== idx) return line;

                                  if (!selectedVariant) {
                                    return { ...line, medicineBrandId: value };
                                  }

                                  return {
                                    ...line,
                                    medicineBrandId: value,
                                    sellingPrice: String(selectedVariant.sellingPrice ?? ''),
                                    wholesalePrice: String(selectedVariant.wholesalePrice ?? ''),
                                    barcode: line.barcode || selectedVariant.barcode || '',
                                    unitType: selectedVariant.unitType,
                                    unitCost: String(selectedVariant.unitCost ?? ''),
                                    conversion: selectedVariant.conversion,
                                  };
                                })
                              }));
                            }}
                          >
                            <option value="">— variant —</option>
                            {medicineVariants.filter((v) => !li.description || v.medicineName.toLowerCase() === li.description.toLowerCase()).map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}
                          </select>
                        </label>
                        <label className="form-control col-span-6 sm:col-span-3 md:col-span-1">
                          <span className="label-text text-xs font-semibold text-slate-500">Qty *</span>
                          <input type="number" min="1" required
                            className="input input-sm input-bordered w-full text-right mt-1"
                            value={li.quantity}
                            onChange={(e) => setLine(idx, 'quantity', e.target.value)}
                          />
                        </label>
                        <label className="form-control col-span-6 sm:col-span-3 md:col-span-2">
                          <span className="label-text text-xs font-semibold text-slate-500">Unit Cost</span>
                          <input type="number" min="0" step="0.01"
                            className="input input-sm input-bordered w-full text-right mt-1"
                            value={li.unitCost}
                            onChange={(e) => setLine(idx, 'unitCost', e.target.value)}
                          />
                        </label>
                        <label className="form-control col-span-6 sm:col-span-3 md:col-span-2">
                          <span className="label-text text-xs font-semibold text-slate-500">Wholesale Price</span>
                          <input type="number" min="0" step="0.01"
                            className="input input-sm input-bordered w-full text-right mt-1"
                            value={li.wholesalePrice}
                            onChange={(e) => setLine(idx, 'wholesalePrice', e.target.value)}
                          />
                        </label>
                        <label className="form-control col-span-6 sm:col-span-3 md:col-span-2">
                          <span className="label-text text-xs font-semibold text-slate-500">Selling Price</span>
                          <input type="number" min="0" step="0.01"
                            className="input input-sm input-bordered w-full text-right mt-1"
                            value={li.sellingPrice}
                            onChange={(e) => setLine(idx, 'sellingPrice', e.target.value)}
                          />
                        </label>

                        {/* --- Row 2 --- */}
                        <label className="form-control col-span-6 sm:col-span-3 md:col-span-1">
                          <span className="label-text text-xs font-semibold text-slate-500">Unit Type</span>
                          <select
                            className="select select-sm select-bordered w-full mt-1"
                            value={li.unitType}
                            onChange={(e) => {
                              const newUnitType = e.target.value;
                              setLine(idx, 'unitType', newUnitType);
                              if (newUnitType === 'unit') {
                                setLine(idx, 'conversion', 1);
                                setLine(idx, 'scale', 'unit');
                              }
                            }}
                          >
                            <option value="bottle">bottle</option>
                            <option value="packet">packet</option>
                            <option value="tube">tube</option>
                            <option value="sachet">sachet</option>
                            <option value="box">box</option>
                            <option value="unit">unit</option>
                          </select>
                        </label>
                        <label className="form-control col-span-6 sm:col-span-3 md:col-span-1">
                            <span className="label-text text-xs font-semibold text-slate-500">Scale</span>
                            <select
                                className="select select-sm select-bordered w-full mt-1"
                                value={li.scale}
                                onChange={(e) => {
                                    const newScale = e.target.value;
                                    setLine(idx, 'scale', newScale);
                                    if (newScale === 'unit') {
                                        setLine(idx, 'unitType', 'unit');
                                        setLine(idx, 'conversion', 1);
                                    }
                                }}
                            >
                                <option value="ml">ml</option>
                                <option value="l">l</option>
                                <option value="g">g</option>
                                <option value="mg">mg</option>
                                <option value="kg">kg</option>
                                <option value="unit">unit</option>
                            </select>
                        </label>
                        {li.unitType !== 'unit' && (
                          <>
                            <label className="form-control col-span-6 sm:col-span-3 md:col-span-1">
                              <span className="label-text text-xs font-semibold text-slate-500">Conv.</span>
                              <input type="number" min="1"
                                className="input input-sm input-bordered w-full text-right mt-1"
                                value={li.conversion}
                                onChange={(e) => setLine(idx, 'conversion', e.target.value)}
                              />
                            </label>
                            <div className="form-control col-span-6 sm:col-span-3 md:col-span-1">
                              <span className="label-text text-xs font-semibold text-slate-500">Cost/Use</span>
                              <div className="text-right text-sm text-slate-700 pt-2 pr-2">
                                {fmt.format((Number(li.unitCost) || 0) / (Number(li.conversion) || 1))}
                              </div>
                            </div>
                          </>
                        )}
                        {li.unitType !== 'unit' && (
                          <div className="form-control col-span-6 sm:col-span-3 md:col-span-1">
                            <span className="label-text text-xs font-semibold text-slate-500">Sell/Use</span>
                            <div className="text-right text-sm text-slate-700 pt-2 pr-2">
                              {fmt.format((Number(li.sellingPrice) || 0) / (Number(li.conversion) || 1))}
                            </div>
                          </div>
                        )}
                        <div className="form-control col-span-6 sm:col-span-3 md:col-span-2">
                          <span className="label-text text-xs font-semibold text-slate-500">Line Total</span>
                          <div className="text-right text-sm font-semibold text-slate-700 pt-2 pr-2">
                            {fmt.format(lineTotal(li))}
                          </div>
                        </div>
                        <label className="form-control col-span-6 sm:col-span-4 md:col-span-2">
                          <span className="label-text text-xs font-semibold text-slate-500">Barcode</span>
                          <input type="text" placeholder="—"
                            className="input input-sm input-bordered w-full mt-1"
                            value={li.barcode}
                            onChange={(e) => setLine(idx, 'barcode', e.target.value)}
                          />
                        </label>
                        <label className="form-control col-span-6 sm:col-span-4 md:col-span-2">
                          <span className="label-text text-xs font-semibold text-slate-500">Batch #</span>
                          <input type="text" placeholder="—"
                            className="input input-sm input-bordered w-full mt-1"
                            value={li.batchNumber}
                            onChange={(e) => setLine(idx, 'batchNumber', e.target.value)}
                          />
                        </label>
                        <label className="form-control col-span-12 sm:col-span-4 md:col-span-2">
                          <span className="label-text text-xs font-semibold text-slate-500">Expiry</span>
                          <input type="date"
                            className="input input-sm input-bordered w-full mt-1"
                            value={li.expiryDate}
                            onChange={(e) => setLine(idx, 'expiryDate', e.target.value)}
                          />
                        </label>
                      </div>
                      <div className="pt-6">

                        {/* Remove */}
                          <button type="button"
                            disabled={form.items.length === 1}
                            className="btn btn-xs btn-ghost text-error disabled:opacity-30"
                            onClick={() => removeLine(idx)}
                            title="Remove row"
                          ><X size={12} /></button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex justify-end items-center p-4 bg-slate-50 font-semibold text-slate-700 border-t border-slate-200 mt-auto">
                <span className="text-right text-xs pr-2 py-2">Grand Total</span>
                <span className="text-right text-sm pr-2 py-2 text-primary">{fmt.format(grandTotal)}</span>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-slate-100 shrink-0 space-y-3">
            

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
    </div>
  , document.body);
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
          <button className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-blue-200 bg-blue-50 text-blue-600 hover:bg-blue-100" onClick={() => setDetailGRN(grn)} aria-label="View goods receipt">
            <Eye size={13} />
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
    <section className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-600">
          <PackageCheck size={22} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Goods Receipts (GRN)</h1>
          <p className="text-sm text-slate-400">Record received stock and link it to purchase orders.</p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-end gap-3">
          <label className="relative min-w-[240px] flex-1">
            <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-400">Search GRN records</span>
            <Search size={15} className="pointer-events-none absolute left-3 top-[33px] text-slate-400" />
            <input
              type="text"
              className="input input-bordered w-full pl-9 text-sm"
              placeholder="Search GRN, supplier, notes..."
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
            />
          </label>
          <button className="inline-flex items-center gap-2 btn btn-sm btn-primary rounded-xl" onClick={() => setShowCreate(true)}>
            <Plus size={14} /> New GRN
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
        data={grns}
        loading={loading}
        loadingMessage="Loading goods receipts..."
        emptyMessage="No goods receipts."
        bodyMaxHeightClass="max-h-[560px]"
        enableSearch={false}
      />

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-3 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 uppercase tracking-wide">Rows per page</span>
          <select
            className="select select-sm select-bordered"
            value={perPage}
            onChange={(e) => {
              setPerPage(Number(e.target.value) || 10);
              setPage(1);
            }}
          >
            {[10, 20, 50].map((size) => <option key={size} value={size}>{size}</option>)}
          </select>
          <span className="ml-2 text-sm text-slate-500">
            <span className="font-semibold text-slate-800">{total}</span> records total
          </span>
        </div>

        <div className="flex items-center gap-1">
          <button
            className="inline-flex items-center gap-1 btn btn-sm btn-ghost rounded-lg px-3"
            disabled={page <= 1 || loading}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            <ChevronLeft size={15} /> Prev
          </button>
          <span className="rounded-lg bg-blue-50 px-3 py-1 text-sm font-semibold text-blue-700">{page} / {lastPage}</span>
          <button
            className="inline-flex items-center gap-1 btn btn-sm btn-ghost rounded-lg px-3"
            disabled={page >= lastPage || loading}
            onClick={() => setPage((p) => Math.min(lastPage, p + 1))}
          >
            Next <ChevronRight size={15} />
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
    </section>
  );
};

export default GoodsReceiptsPage;
