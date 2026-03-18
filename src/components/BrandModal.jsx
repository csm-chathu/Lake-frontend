import React, { useMemo, useState } from 'react';
import api from '../api/client.js';

export default function BrandModal({
  isOpen,
  brand,
  index,
  suppliers = [],
  onSave,
  onCancel,
  onAddBatch,
  onRemoveBatch,
  onBatchChange
}) {
  const [selectedImageFile, setSelectedImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  const totalStock = useMemo(() => {
    if (!brand) return 0;
    return (brand.batches || []).reduce((sum, batch) => sum + (Number(batch.quantity) || 0), 0);
  }, [brand]);

  const handleImageSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedImageFile(file);
    const reader = new FileReader();
    reader.onload = (event) => {
      setImagePreview(event.target?.result);
    };
    reader.readAsDataURL(file);
  };

  const uploadBrandImage = async (fileOverride = null) => {
    const fileToUpload = fileOverride || selectedImageFile;
    if (!fileToUpload) return true;

    setIsUploadingImage(true);
    try {
      const formData = new FormData();
      formData.append('file', fileToUpload);
      if (brand?.id) {
        formData.append('brand_id', String(brand.id));
      }

      const response = await api.post('/uploads/medicine-brand-image', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          Accept: 'application/json'
        }
      });

      const data = response?.data;
      if (data?.fileUrl) {
        const newBrand = { ...brand, image_url: data.fileUrl };
        onSave(index, newBrand);
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
    // Save brand changes before closing modal
    if (onSave) {
      onSave(index, brand);
    }
    onCancel();
  };

  if (!isOpen || !brand) return null;

  return (
    <div className="modal modal-open">
      <div className="modal-box w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white pb-4 border-b border-base-200 mb-4 -mx-6 px-6 pt-6">
          <h3 className="font-bold text-lg text-slate-800">
            {brand.id ? '✏️ Edit Brand' : '➕ Add New Brand'}
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            Configure brand details, pricing, and stock batches
          </p>
        </div>

        <div className="space-y-4">
          {/* Brand Basic Information */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 bg-base-50 p-3 rounded-lg">
            <label className="flex flex-col gap-2">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Brand Name *</span>
              <input
                type="text"
                className="input input-bordered input-sm"
                value={brand.name}
                onChange={(e) => {
                  const newBrand = { ...brand, name: e.target.value };
                  onSave(index, newBrand);
                }}
                placeholder="Brand name"
              />
            </label>
            <label className="flex flex-col gap-2">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Price *</span>
              <input
                type="number"
                min="0"
                step="0.01"
                className="input input-bordered input-sm"
                value={brand.price}
                onChange={(e) => {
                  const newBrand = { ...brand, price: e.target.value };
                  onSave(index, newBrand);
                }}
                placeholder="0.00"
              />
            </label>
            <label className="flex flex-col gap-2">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Wholesale Price</span>
              <input
                type="number"
                min="0"
                step="0.01"
                className="input input-bordered input-sm"
                value={brand.wholesale_price ?? ''}
                onChange={(e) => {
                  const newBrand = { ...brand, wholesale_price: e.target.value };
                  onSave(index, newBrand);
                }}
                placeholder="0.00"
              />
            </label>
            <div className="flex flex-col gap-2">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Total Stock</span>
              <input
                type="number"
                className="input input-bordered input-sm bg-base-200"
                value={totalStock}
                readOnly
                placeholder="Auto calculated"
              />
            </div>
          </div>

          {/* Barcode & Supplier for Brand (Legacy fields) */}
          <div className="grid gap-3 sm:grid-cols-2 bg-base-50 p-3 rounded-lg">
            <label className="flex flex-col gap-2">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Barcode</span>
              <input
                type="text"
                className="input input-bordered input-sm"
                value={brand.barcode}
                onChange={(e) => {
                  const newBrand = { ...brand, barcode: e.target.value };
                  onSave(index, newBrand);
                }}
                placeholder="Brand-level barcode (optional)"
              />
            </label>
            <label className="flex flex-col gap-2">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Supplier</span>
              <select
                className="select select-bordered select-sm"
                value={brand.supplier_id}
                onChange={(e) => {
                  const newBrand = { ...brand, supplier_id: e.target.value };
                  onSave(index, newBrand);
                }}
              >
                <option value="">Default supplier</option>
                {suppliers.map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {/* Brand Image Upload */}
          <div className="bg-base-50 p-4 rounded-lg border border-base-200">
            <label className="flex flex-col gap-3">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500">📸 Brand Image (Optional)</span>
              
              <div className="flex gap-4 items-start">
                {/* Image Preview */}
                <div className="flex-shrink-0">
                  {imagePreview || brand.image_url ? (
                    <div className="w-24 h-24 bg-base-200 rounded border border-base-300 overflow-hidden flex items-center justify-center">
                      <img
                        src={imagePreview || brand.image_url}
                        alt="Brand preview"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="w-24 h-24 bg-base-200 rounded border border-base-300 flex items-center justify-center text-xs text-slate-400">
                      No image
                    </div>
                  )}
                </div>

                {/* File Input & Upload */}
                <div className="flex-grow flex flex-col gap-2">
                  <input
                    type="file"
                    className="file-input file-input-bordered file-input-sm w-full"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleImageSelect}
                    disabled={isUploadingImage}
                  />
                  <p className="text-xs text-slate-500">
                    Max 5MB • JPG, PNG, or WebP
                  </p>
                  {selectedImageFile && !isUploadingImage && (
                    <button
                      type="button"
                      className="btn btn-sm btn-primary"
                      onClick={() => uploadBrandImage()}
                      disabled={isUploadingImage}
                    >
                      Add image
                    </button>
                  )}
                  {isUploadingImage && (
                    <p className="text-xs text-primary flex items-center gap-1">
                      <span className="loading loading-spinner loading-xs"></span>
                      Uploading image...
                    </p>
                  )}
                  {brand.image_url && !selectedImageFile && (
                    <p className="text-xs text-success">✓ Image set</p>
                  )}
                </div>
              </div>
            </label>
          </div>

          {/* Batches Section */}
          <div className="border border-base-200 bg-base-50 rounded-lg p-4">
            <div className="mb-3 flex items-center justify-between">
              <label className="text-sm font-semibold text-slate-700">
                📦 Stock Batches ({(brand.batches || []).length})
              </label>
              <button
                type="button"
                className="btn btn-xs btn-primary"
                onClick={() => onAddBatch(index)}
              >
                Add batch
              </button>
            </div>

            {(brand.batches || []).length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-4 italic">
                No batches yet. Add one to get started.
              </p>
            ) : (
              <div className="space-y-2">
                {/* Batch Headers */}
                <div className="hidden lg:grid grid-cols-[repeat(5,minmax(0,1fr))_40px] gap-2 text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">
                  <div>Batch #</div>
                  <div>Barcode</div>
                  <div>Supplier</div>
                  <div>Expiry</div>
                  <div>Qty</div>
                  <div></div>
                </div>

                {/* Batch Rows - Responsive Grid for Mobile, Flex Columns for Desktop */}
                {(brand.batches || []).map((batch, batchIndex) => (
                  <div
                    key={`${batch.id || 'new'}-${batchIndex}`}
                    className="bg-white border border-base-300 rounded p-2 lg:p-0 lg:border-0 lg:grid lg:grid-cols-[repeat(5,minmax(0,1fr))_40px] lg:gap-2 lg:items-center space-y-2 lg:space-y-0"
                  >
                    {/* Batch Number */}
                    <input
                      type="text"
                      className="input input-bordered input-xs w-full"
                      value={batch.batch_number}
                      onChange={(e) => onBatchChange(index, batchIndex, 'batch_number', e.target.value)}
                      placeholder="Batch #"
                    />

                    {/* Barcode */}
                    <input
                      type="text"
                      className="input input-bordered input-xs w-full"
                      value={batch.barcode || ''}
                      onChange={(e) => onBatchChange(index, batchIndex, 'barcode', e.target.value)}
                      placeholder="Barcode"
                    />

                    {/* Supplier */}
                    <select
                      className="select select-bordered select-xs w-full"
                      value={batch.supplier_id || ''}
                      onChange={(e) => onBatchChange(index, batchIndex, 'supplier_id', e.target.value)}
                    >
                      <option value="">Supplier</option>
                      {suppliers.map((supplier) => (
                        <option key={supplier.id} value={supplier.id}>
                          {supplier.name}
                        </option>
                      ))}
                    </select>

                    {/* Expiry Date */}
                    <input
                      type="date"
                      className="input input-bordered input-xs w-full"
                      value={batch.expiry_date ? (typeof batch.expiry_date === 'string' ? batch.expiry_date : batch.expiry_date.toISOString().split('T')[0]) : ''}
                      onChange={(e) => {
                        const dateValue = e.target.value ? new Date(e.target.value) : null;
                        onBatchChange(index, batchIndex, 'expiry_date', dateValue);
                      }}
                      placeholder="Expiry"
                    />

                    {/* Quantity */}
                    <input
                      type="number"
                      min="0"
                      className="input input-bordered input-xs w-full"
                      value={batch.quantity}
                      onChange={(e) => onBatchChange(index, batchIndex, 'quantity', e.target.value)}
                      placeholder="Qty"
                    />

                    {/* Remove Button - Fixed on right */}
                    <button
                      type="button"
                      className="btn btn-xs btn-ghost text-error w-full lg:w-auto flex-shrink-0"
                      onClick={() => onRemoveBatch(index, batchIndex)}
                      title="Remove batch"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Modal Actions */}
        <div className="modal-action mt-6 sticky bottom-0 bg-white pt-4 border-t border-base-200 -mx-6 px-6 pb-6">
          <button
            type="button"
            className="btn btn-sm btn-ghost"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-sm btn-primary"
            onClick={handleDone}
            disabled={isUploadingImage}
          >
            {isUploadingImage ? 'Saving...' : 'Done'}
          </button>
        </div>
      </div>
      <div className="modal-backdrop" onClick={onCancel}></div>
    </div>
  );
}
