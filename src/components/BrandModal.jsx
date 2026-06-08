import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, ChevronDown, ChevronUp, Image, Package, Plus, Printer, Tag, Trash2, X } from 'lucide-react';
import api from '../api/client.js';

export default function BrandModal({
  isOpen,
  brand,
  index,
  medicineName = '',
  itemType = [],
  suppliers = [],
  onSave,
  onCancel,
  onAddBatch,
  onRemoveBatch,
  onBatchChange,
  onPrintBarcode
}) {
  const isServiceOnly = itemType.length === 1 && itemType[0] === 'service';
  const [selectedImageFile, setSelectedImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const totalStock = useMemo(() => {
    if (!brand) return 0;
    return (brand.batches || []).reduce((sum, batch) => sum + (Number(batch.quantity) || 0), 0);
  }, [brand]);

  const handleImageSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedImageFile(file);
    const reader = new FileReader();
    reader.onload = (event) => setImagePreview(event.target?.result);
    reader.readAsDataURL(file);
  };

  const uploadBrandImage = async (fileOverride = null) => {
    const fileToUpload = fileOverride || selectedImageFile;
    if (!fileToUpload) return true;
    setIsUploadingImage(true);
    try {
      const formData = new FormData();
      formData.append('file', fileToUpload);
      if (brand?.id) formData.append('brand_id', String(brand.id));
      const response = await api.post('/uploads/medicine-brand-image', formData, {
        headers: { 'Content-Type': 'multipart/form-data', Accept: 'application/json' }
      });
      const data = response?.data;
      if (data?.fileUrl) {
        onSave(index, { ...brand, image_url: data.fileUrl });
        setSelectedImageFile(null);
        setImagePreview(null);
      }
      return true;
    } catch (error) {
      console.error('Image upload error:', error);
      alert('Failed to upload image. Please try again.');
      return false;
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleDone = () => {
    if (onSave) onSave(index, brand);
    onCancel();
  };

  const markDirty = () => setIsDirty(true);

  const update = (field, value) => {
    markDirty();
    onSave(index, { ...brand, [field]: value });
  };

  // Show advanced badge if any advanced field has a non-default value
  const hasAdvancedValues =
    (brand?.wholesale_price && Number(brand.wholesale_price) > 0) ||
    (brand?.unit_type && brand.unit_type !== 'unit') ||
    (brand?.barcode && brand.barcode.trim()) ||
    (brand?.image_url && brand.image_url.trim()) ||
    (brand?.unit_cost && Number(brand.unit_cost) > 0);

  if (!isOpen || !brand) return null;

  return createPortal(
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-[200] bg-black/40 backdrop-blur-sm" onClick={onCancel} />

      {/* Scroll container */}
      <div className="fixed inset-0 z-[210] overflow-y-auto">
        <div className="flex min-h-full items-center justify-center px-4 py-8">
          <div
            className="relative w-full max-w-4xl rounded-2xl border border-slate-200 bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-5 py-3.5 rounded-t-2xl">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
                  <Tag size={15} />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-slate-800">
                    {brand.id ? 'Edit brand' : 'Add brand'}
                    {medicineName && <span className="ml-1.5 text-slate-400 font-normal">— {medicineName}</span>}
                  </h2>
                  <p className="text-[11px] text-slate-400">Fill in the essentials; expand Advanced for more options</p>
                </div>
              </div>
              <button
                onClick={onCancel}
                className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-100 transition"
              >
                <X size={15} />
              </button>
            </div>

            <div className="p-5">
              <div className={`grid gap-5 ${isServiceOnly ? 'grid-cols-1' : 'grid-cols-2'}`}>

                {/* ── LEFT COLUMN — essentials ── */}
                <div className="space-y-4">

                  {/* Essential fields */}
                  <div className="space-y-3">
                    <label className="flex flex-col gap-1">
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Brand name *</span>
                      <input
                        type="text"
                        className="input input-bordered input-sm"
                        value={brand.name}
                        onChange={(e) => update('name', e.target.value)}
                        placeholder="e.g. Amoxil 250mg"
                        autoFocus
                      />
                    </label>

                    <label className="flex flex-col gap-1">
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Selling price (LKR) *</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        className="input input-bordered input-sm"
                        value={brand.price}
                        onChange={(e) => update('price', e.target.value)}
                        placeholder="0.00"
                      />
                    </label>

                    {!isServiceOnly && (
                    <label className="flex flex-col gap-1">
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Supplier</span>
                      <select
                        className="select select-bordered select-sm"
                        value={brand.supplier_id}
                        onChange={(e) => update('supplier_id', e.target.value)}
                      >
                        <option value="">— None —</option>
                        {suppliers.map((s) => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                      </select>
                    </label>
                    )}

                    {!isServiceOnly && <div className="flex flex-col gap-1">
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Total stock</span>
                      <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                        <Package size={14} className="text-slate-400" />
                        <span className="text-sm font-semibold text-slate-700">{totalStock}</span>
                        <span className="text-xs text-slate-400">units across all batches</span>
                      </div>
                    </div>}
                  </div>

                  {/* Advanced toggle — hidden for service */}
                  {!isServiceOnly && <button
                    type="button"
                    onClick={() => setShowAdvanced((v) => !v)}
                    className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition"
                  >
                    <span className="flex items-center gap-2">
                      Advanced settings
                      {hasAdvancedValues && !showAdvanced && (
                        <span className="rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] font-bold text-blue-700">filled</span>
                      )}
                    </span>
                    {showAdvanced ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>}

                  {/* Advanced fields */}
                  {!isServiceOnly && showAdvanced && (
                    <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Advanced</p>

                      <label className="flex flex-col gap-1">
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Buying / wholesale price</span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          className="input input-bordered input-sm"
                          value={brand.wholesale_price ?? ''}
                          onChange={(e) => update('wholesale_price', e.target.value)}
                          placeholder="0.00"
                        />
                      </label>

                      <div className="grid grid-cols-2 gap-3">
                        <label className="flex flex-col gap-1">
                          <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Package type</span>
                          <select
                            className="select select-bordered select-sm"
                            value={brand.unit_type || 'unit'}
                            onChange={(e) => {
                              const val = e.target.value;
                              markDirty();
                              if (val === 'unit') onSave(index, { ...brand, unit_type: val, conversion: 1, scale: 'unit' });
                              else update('unit_type', val);
                            }}
                          >
                            {['bottle', 'packet', 'tube', 'sachet', 'box', 'unit'].map((u) => (
                              <option key={u} value={u}>{u.charAt(0).toUpperCase() + u.slice(1)}</option>
                            ))}
                          </select>
                        </label>

                        <label className="flex flex-col gap-1">
                          <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Measurement</span>
                          <select
                            className="select select-bordered select-sm"
                            value={brand.scale || 'ml'}
                            onChange={(e) => {
                              const val = e.target.value;
                              markDirty();
                              if (val === 'unit') onSave(index, { ...brand, scale: val, unit_type: 'unit', conversion: 1 });
                              else update('scale', val);
                            }}
                          >
                            {['ml', 'l', 'g', 'mg', 'kg', 'unit'].map((s) => (
                              <option key={s} value={s}>{s}</option>
                            ))}
                          </select>
                        </label>

                        <label className="flex flex-col gap-1">
                          <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Units per package</span>
                          <input
                            type="number"
                            min="1"
                            step="1"
                            className="input input-bordered input-sm"
                            value={brand.conversion || '1'}
                            onChange={(e) => update('conversion', e.target.value)}
                            placeholder="1"
                            disabled={brand.unit_type === 'unit'}
                          />
                        </label>

                        <label className="flex flex-col gap-1">
                          <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Cost per unit</span>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            className="input input-bordered input-sm"
                            value={brand.unit_cost ?? ''}
                            onChange={(e) => update('unit_cost', e.target.value)}
                            placeholder="0.00"
                          />
                        </label>
                      </div>

                      {/* Barcode */}
                      <label className="flex flex-col gap-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Barcode</span>
                          {onPrintBarcode && (
                            <button
                              type="button"
                              onClick={() => onPrintBarcode(brand)}
                              className="inline-flex items-center gap-1 text-[10px] text-slate-500 hover:text-slate-700"
                            >
                              <Printer size={11} /> Print
                            </button>
                          )}
                        </div>
                        <input
                          type="text"
                          className="input input-bordered input-sm"
                          value={brand.barcode}
                          onChange={(e) => update('barcode', e.target.value)}
                          placeholder="Optional"
                        />
                      </label>

                      {/* Brand image */}
                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Brand image</span>
                        <div className="flex items-center gap-3">
                          <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-white flex items-center justify-center">
                            {imagePreview || brand.image_url ? (
                              <img src={imagePreview || brand.image_url} alt="Brand" className="h-full w-full object-cover" />
                            ) : (
                              <Image size={18} className="text-slate-300" />
                            )}
                          </div>
                          <div className="flex flex-col gap-1 flex-1">
                            <input
                              type="file"
                              className="file-input file-input-bordered file-input-xs w-full"
                              accept="image/jpeg,image/png,image/webp"
                              onChange={handleImageSelect}
                              disabled={isUploadingImage}
                            />
                            {selectedImageFile && !isUploadingImage && (
                              <button type="button" className="btn btn-xs btn-primary self-start" onClick={() => uploadBrandImage()}>
                                Upload
                              </button>
                            )}
                            {isUploadingImage && <span className="text-[11px] text-blue-600">Uploading…</span>}
                            {brand.image_url && !selectedImageFile && <span className="text-[11px] text-emerald-600">Saved</span>}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* ── RIGHT COLUMN — stock batches (hidden for service) ── */}
                {!isServiceOnly && <div className="flex flex-col">
                  <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 flex-1">
                    <div className="mb-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Package size={13} className="text-slate-400" />
                        <span className="text-xs font-semibold text-slate-600">
                          Stock batches
                          <span className="ml-1.5 rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] font-bold text-blue-700">
                            {(brand.batches || []).length}
                          </span>
                        </span>
                      </div>
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 btn btn-xs rounded-lg border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100"
                        onClick={() => { markDirty(); onAddBatch(index); }}
                      >
                        <Plus size={12} /> Add batch
                      </button>
                    </div>

                    {(brand.batches || []).length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-10 text-center gap-2">
                        <Package size={28} className="text-slate-200" />
                        <p className="text-sm text-slate-400">No stock batches yet.</p>
                        <p className="text-[11px] text-slate-400">Click <span className="font-semibold">Add batch</span> to record a delivery.</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {(brand.batches || []).map((batch, batchIndex) => (
                          <div
                            key={`${batch.id || 'new'}-${batchIndex}`}
                            className="rounded-xl border border-slate-200 bg-white p-3"
                          >
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-[11px] font-semibold text-slate-500">Batch {batchIndex + 1}</span>
                              <button
                                type="button"
                                title="Remove batch"
                                className="inline-flex items-center justify-center h-6 w-6 rounded-lg border border-rose-200 bg-rose-50 text-rose-500 hover:bg-rose-100 transition"
                                onClick={() => { markDirty(); onRemoveBatch(index, batchIndex); }}
                              >
                                <Trash2 size={11} />
                              </button>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <label className="flex flex-col gap-1">
                                <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Expiry date</span>
                                <input
                                  type="date"
                                  className="input input-bordered input-xs w-full"
                                  value={
                                    batch.expiry_date
                                      ? typeof batch.expiry_date === 'string'
                                        ? batch.expiry_date
                                        : batch.expiry_date.toISOString().split('T')[0]
                                      : ''
                                  }
                                  onChange={(e) => { markDirty(); onBatchChange(index, batchIndex, 'expiry_date', e.target.value ? new Date(e.target.value) : null); }}
                                />
                              </label>
                              <label className="flex flex-col gap-1">
                                <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Quantity</span>
                                <input
                                  type="number"
                                  min="0"
                                  className="input input-bordered input-xs w-full"
                                  value={batch.quantity}
                                  onChange={(e) => { markDirty(); onBatchChange(index, batchIndex, 'quantity', e.target.value); }}
                                  placeholder="0"
                                />
                              </label>
                              <label className="col-span-2 flex flex-col gap-1">
                                <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Supplier</span>
                                <select
                                  className="select select-bordered select-xs w-full"
                                  value={batch.supplier_id || ''}
                                  onChange={(e) => { markDirty(); onBatchChange(index, batchIndex, 'supplier_id', e.target.value); }}
                                >
                                  <option value="">— None —</option>
                                  {suppliers.map((s) => (
                                    <option key={s.id} value={s.id}>{s.name}</option>
                                  ))}
                                </select>
                              </label>
                              {/* Advanced batch fields */}
                              {showAdvanced && (
                                <>
                                  <label className="flex flex-col gap-1">
                                    <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Batch #</span>
                                    <input
                                      type="text"
                                      className="input input-bordered input-xs w-full"
                                      value={batch.batch_number}
                                      onChange={(e) => { markDirty(); onBatchChange(index, batchIndex, 'batch_number', e.target.value); }}
                                      placeholder="Auto"
                                    />
                                  </label>
                                  <label className="flex flex-col gap-1">
                                    <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Batch barcode</span>
                                    <input
                                      type="text"
                                      className="input input-bordered input-xs w-full"
                                      value={batch.barcode || ''}
                                      onChange={(e) => { markDirty(); onBatchChange(index, batchIndex, 'barcode', e.target.value); }}
                                      placeholder="Optional"
                                    />
                                  </label>
                                </>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>}

              </div>
            </div>

            {/* Footer */}
            <div className="border-t border-slate-100 bg-slate-50 px-5 py-3 rounded-b-2xl space-y-2">
              {isDirty && (
                <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                  <AlertTriangle size={13} className="shrink-0" />
                  Changes applied — click <span className="font-semibold mx-0.5">Update item</span> in the item form to save to the database.
                </div>
              )}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 btn btn-sm btn-ghost rounded-xl"
                  onClick={onCancel}
                >
                  <X size={14} /> Cancel
                </button>
                <button
                  type="button"
                  className="inline-flex items-center gap-2 btn btn-sm btn-primary rounded-xl px-5"
                  onClick={handleDone}
                  disabled={isUploadingImage}
                >
                  {isUploadingImage ? 'Saving…' : 'Done'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}
