import { useMemo, useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import EntityTable from '../components/EntityTable.jsx';
import useEntityApi from '../hooks/useEntityApi.js';
import BrandModal from '../components/BrandModal.jsx';
import api from '../api/client.js';

const currencyFormatter = new Intl.NumberFormat('en-LK', { style: 'currency', currency: 'LKR' });

const createEmptyBatch = () => ({
  id: null,
  batch_number: '',
  expiry_date: null,
  quantity: '',
  barcode: '',
  supplier_id: ''
});

const createEmptyBrand = () => ({
  id: null,
  name: '',
  price: '',
  wholesale_price: '',
  stock: '',
  expiry_date: null,
  barcode: '',
  image_url: '',
  supplier_id: '',
  batch_number: '',
  batches: [createEmptyBatch()]
});

const createEmptyItem = () => ({
  name: '',
  description: '',
  brands: [createEmptyBrand()]
});

const MedicinesPage = () => {
  const { items, loading, error, createItem, updateItem, deleteItem } = useEntityApi('medicines');
  const location = useLocation();
  const [formState, setFormState] = useState(() => createEmptyItem());
  const [editingId, setEditingId] = useState(null);
  const [formError, setFormError] = useState('');
  const [suppliers, setSuppliers] = useState([]);
  const [isBrandModalOpen, setIsBrandModalOpen] = useState(false);
  const [editingBrandIndex, setEditingBrandIndex] = useState(null);
  const formSectionRef = useRef(null);
  const handledFocusNavigationKeyRef = useRef(null);

  useEffect(() => {
    const fetchSuppliers = async () => {
      try {
        const response = await api.get('/suppliers');
        setSuppliers(response.data);
      } catch (err) {
        console.error('Failed to fetch suppliers:', err);
      }
    };
    fetchSuppliers();
  }, []);

  const columns = useMemo(
    () => [
      { header: 'Name', accessor: 'name' },
      {
        header: 'Description',
        accessor: 'description',
        render: (item) => (item.description ? item.description : '—')
      },
      {
        header: 'Brands',
        accessor: 'brands',
        render: (item) => {
          if (!Array.isArray(item.brands) || item.brands.length === 0) {
            return '—';
          }
          return (
            <ul className="space-y-2 text-xs text-slate-600">
              {item.brands.map((brand) => {
                const price = Number(brand.price);
                const formattedPrice = Number.isNaN(price)
                  ? '—'
                  : currencyFormatter.format(price);
                const wholesalePrice = Number(brand.wholesale_price);
                const formattedWholesalePrice = Number.isNaN(wholesalePrice)
                  ? '—'
                  : currencyFormatter.format(wholesalePrice);
                const batches = Array.isArray(brand.batches) ? brand.batches : [];
                const totalStock = batches.length
                  ? batches.reduce((sum, batch) => sum + (Number(batch.quantity) || 0), 0)
                  : (brand.stock ?? 0);
                  const supplier = suppliers.find(s => s.id === brand.supplier_id);
                return (
                  <li key={brand.id} className="border-b border-slate-100 pb-1 last:border-0">
                    <div className="font-medium text-slate-700">{brand.name}</div>
                    <div className="flex flex-wrap gap-3 mt-0.5">
                      <span>Price: {formattedPrice}</span>
                      <span>Wholesale: {formattedWholesalePrice}</span>
                      <span>Stock: {totalStock}</span>
                    </div>
                    {batches.length > 0 && (
                      <ul className="mt-1 space-y-1 text-[11px] text-slate-500">
                        {batches.map((batch) => (
                          <li key={batch.id || batch.batch_number}>
                            Batch {batch.batch_number} • Qty {batch.quantity} • Exp {batch.expiry_date ? new Date(batch.expiry_date).toLocaleDateString() : '—'}
                          </li>
                        ))}
                      </ul>
                    )}
                    {brand.barcode && <div className="text-slate-500 mt-0.5">Barcode: {brand.barcode}</div>}
                      {supplier && <div className="text-slate-500 mt-0.5">Supplier: {supplier.name}</div>}
                  </li>
                );
              })}
            </ul>
          );
        }
      }
    ],
      [suppliers]
  );

  const handleFieldChange = (field, value) => {
    setFormState((prev) => ({ ...prev, [field]: value }));
  };

  const handleBrandChange = (index, field, value) => {
    setFormState((prev) => {
      const brands = prev.brands.map((brand, idx) => {
        if (idx === index) {
          // Handle date objects for expiry_date field
          if (field === 'expiry_date' && value instanceof Date) {
            return { ...brand, [field]: value };
          }
          return { ...brand, [field]: value };
        }
        return brand;
      });
      return { ...prev, brands };
    });
  };

  const handleBatchChange = (brandIndex, batchIndex, field, value) => {
    setFormState((prev) => {
      const brands = prev.brands.map((brand, currentBrandIndex) => {
        if (currentBrandIndex !== brandIndex) {
          return brand;
        }

        const batches = (brand.batches || []).map((batch, currentBatchIndex) => {
          if (currentBatchIndex !== batchIndex) {
            return batch;
          }

          if (field === 'expiry_date' && value instanceof Date) {
            return { ...batch, [field]: value };
          }

          return { ...batch, [field]: value };
        });

        return { ...brand, batches };
      });

      return { ...prev, brands };
    });
  };

  const handleAddBatch = (brandIndex) => {
    setFormState((prev) => {
      const brands = prev.brands.map((brand, currentBrandIndex) => {
        if (currentBrandIndex !== brandIndex) {
          return brand;
        }

        return { ...brand, batches: [...(brand.batches || []), createEmptyBatch()] };
      });

      return { ...prev, brands };
    });
  };

  const handleRemoveBatch = (brandIndex, batchIndex) => {
    setFormState((prev) => {
      const brands = prev.brands.map((brand, currentBrandIndex) => {
        if (currentBrandIndex !== brandIndex) {
          return brand;
        }

        const nextBatches = (brand.batches || []).filter((_, currentBatchIndex) => currentBatchIndex !== batchIndex);
        return { ...brand, batches: nextBatches.length ? nextBatches : [createEmptyBatch()] };
      });

      return { ...prev, brands };
    });
  };

  const handleAddBrand = () => {
    setFormState((prev) => ({
      ...prev,
      brands: [...prev.brands, createEmptyBrand()]
    }));
  };

  const handleRemoveBrand = (index) => {
    setFormState((prev) => {
      const nextBrands = prev.brands.filter((_, idx) => idx !== index);
      return { ...prev, brands: nextBrands.length ? nextBrands : [createEmptyBrand()] };
    });
  };

  const handleOpenBrandModal = (index) => {
    setEditingBrandIndex(index);
    setIsBrandModalOpen(true);
  };

  const handleSaveBrand = (index, updatedBrand) => {
    setFormState((prev) => {
      const brands = prev.brands.map((brand, idx) => (idx === index ? updatedBrand : brand));
      return { ...prev, brands };
    });
  };

  const handleCloseBrandModal = () => {
    setIsBrandModalOpen(false);
    setEditingBrandIndex(null);
  };

  const handleAddBatchFromModal = (brandIndex) => {
    handleAddBatch(brandIndex);
  };

  const handleRemoveBatchFromModal = (brandIndex, batchIndex) => {
    handleRemoveBatch(brandIndex, batchIndex);
  };

  const handleBatchChangeFromModal = (brandIndex, batchIndex, field, value) => {
    handleBatchChange(brandIndex, batchIndex, field, value);
  };

  const resetForm = () => {
    setEditingId(null);
    setFormError('');
    setFormState(createEmptyItem());
  };

  const validateForm = () => {
    const name = formState.name.trim();
    if (!name) {
      return 'Item name is required.';
    }

    const normalizedBrands = formState.brands.filter((brand) => brand.name.trim());
    if (!normalizedBrands.length) {
      return 'Add at least one brand for this item.';
    }

    for (const brand of normalizedBrands) {
      const priceValue = Number.parseFloat(brand.price);
      if (Number.isNaN(priceValue) || priceValue < 0) {
        return 'Brand prices must be zero or greater.';
      }

      const wholesalePriceValue = Number.parseFloat(brand.wholesale_price);
      if (Number.isNaN(wholesalePriceValue) || wholesalePriceValue < 0) {
        return 'Brand wholesale prices must be zero or greater.';
      }

      const validBatches = (brand.batches || []).filter((batch) => batch.batch_number?.trim());
      if (!validBatches.length) {
        return 'Add at least one batch number for each brand.';
      }

      for (const batch of validBatches) {
        const quantityValue = Number.parseInt(batch.quantity, 10);
        if (Number.isNaN(quantityValue) || quantityValue < 0) {
          return 'Batch quantity must be zero or greater.';
        }
      }
    }

    return '';
  };

  const buildPayload = () => {
    const normalizedBrands = formState.brands
      .filter((brand) => brand.name.trim())
      .map((brand) => {
        const priceValue = Number.parseFloat(brand.price);
        const wholesalePriceValue = Number.parseFloat(brand.wholesale_price);
        const normalizedBatches = (brand.batches || [])
          .filter((batch) => batch.batch_number?.trim())
          .map((batch) => {
            let expiryDate = null;
            if (batch.expiry_date) {
              if (batch.expiry_date instanceof Date) {
                expiryDate = batch.expiry_date.toISOString().split('T')[0];
              } else if (typeof batch.expiry_date === 'string' && batch.expiry_date.trim()) {
                expiryDate = batch.expiry_date;
              }
            }

            return {
              ...(batch.id ? { id: Number(batch.id) } : {}),
              batch_number: batch.batch_number.trim(),
              expiry_date: expiryDate,
              quantity: Number.parseInt(batch.quantity, 10) || 0,
              barcode: batch.barcode?.trim() || null,
              supplier_id: batch.supplier_id ? Number(batch.supplier_id) : null
            };
          });

        const stockValue = normalizedBatches.reduce((sum, batch) => sum + (Number(batch.quantity) || 0), 0);
        
        // Format date for API
        let expiryDate = null;
        if (brand.expiry_date) {
          if (brand.expiry_date instanceof Date) {
            expiryDate = brand.expiry_date.toISOString().split('T')[0];
          } else if (typeof brand.expiry_date === 'string' && brand.expiry_date.trim()) {
            expiryDate = brand.expiry_date;
          }
        }
        
        return {
          ...(brand.id ? { id: Number(brand.id) } : {}),
          name: brand.name.trim(),
          price: Number(priceValue.toFixed(2)),
          wholesale_price: Number(wholesalePriceValue.toFixed(2)),
          stock: stockValue,
          expiry_date: expiryDate,
          barcode: brand.barcode?.trim() || null,
          image_url: brand.image_url?.trim() || null,
          supplier_id: brand.supplier_id || null,
          batch_number: brand.batch_number?.trim() || null,
          batches: normalizedBatches
        };
      });

    return {
      name: formState.name.trim(),
      description: formState.description.trim(),
      brands: normalizedBrands
    };
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setFormError('');

    const validationMessage = validateForm();
    if (validationMessage) {
      setFormError(validationMessage);
      return;
    }

    const payload = buildPayload();
    const action = editingId ? updateItem(editingId, payload) : createItem(payload);
    const result = await action;

    if (result.success) {
      resetForm();
    } else if (result.message) {
      setFormError(result.message);
    }
  };

  const handleEdit = (item, options = {}) => {
    setEditingId(item.id);
    setFormError('');
    setFormState({
      name: item.name || '',
      description: item.description || '',
      brands:
        Array.isArray(item.brands) && item.brands.length
          ? item.brands.map((brand) => ({
              id: brand.id,
              name: brand.name || '',
              price:
                brand.price !== undefined && brand.price !== null
                  ? Number(brand.price).toFixed(2)
                  : '',
              wholesale_price:
                brand.wholesale_price !== undefined && brand.wholesale_price !== null
                  ? Number(brand.wholesale_price).toFixed(2)
                  : '',
              stock: brand.stock !== undefined && brand.stock !== null ? brand.stock : '',
              expiry_date: brand.expiry_date ? new Date(brand.expiry_date) : null,
              barcode: brand.barcode || '',
              image_url: brand.image_url || '',
              supplier_id: brand.supplier_id || '',
              batch_number: brand.batch_number || '',
              batches:
                Array.isArray(brand.batches) && brand.batches.length
                  ? brand.batches.map((batch) => ({
                      id: batch.id,
                      batch_number: batch.batch_number || '',
                      expiry_date: batch.expiry_date ? new Date(batch.expiry_date) : null,
                      quantity: batch.quantity ?? '',
                      barcode: batch.barcode || '',
                      supplier_id: batch.supplier_id || ''
                    }))
                  : [
                      {
                        id: null,
                        batch_number: brand.batch_number || '',
                        expiry_date: brand.expiry_date ? new Date(brand.expiry_date) : null,
                        quantity: brand.stock ?? '',
                        barcode: brand.barcode || '',
                        supplier_id: brand.supplier_id || ''
                      }
                    ]
            }))
          : [createEmptyBrand()]
    });
    formSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });

    if (typeof options.openBrandIndex === 'number' && options.openBrandIndex >= 0) {
      setEditingBrandIndex(options.openBrandIndex);
      setIsBrandModalOpen(true);
    }
  };

  useEffect(() => {
    const focusBatch = location.state?.focusBatch;
    if (!focusBatch || loading || !Array.isArray(items) || items.length === 0) {
      return;
    }

    if (handledFocusNavigationKeyRef.current === location.key) {
      return;
    }

    const targetItem = items.find((item) => {
      if (focusBatch.medicineId && Number(item.id) === Number(focusBatch.medicineId)) {
        return true;
      }
      if (focusBatch.medicineName && item.name === focusBatch.medicineName) {
        return true;
      }
      return false;
    });

    if (!targetItem) {
      handledFocusNavigationKeyRef.current = location.key;
      return;
    }

    const brands = Array.isArray(targetItem.brands) ? targetItem.brands : [];
    const targetBrandIndex = brands.findIndex((brand) => {
      if (focusBatch.brandId && Number(brand.id) === Number(focusBatch.brandId)) {
        return true;
      }
      if (focusBatch.brandName && brand.name === focusBatch.brandName) {
        return true;
      }

      const batches = Array.isArray(brand.batches) ? brand.batches : [];
      return batches.some((batch) => {
        if (focusBatch.batchId && Number(batch.id) === Number(focusBatch.batchId)) {
          return true;
        }
        if (focusBatch.batchNumber && batch.batch_number === focusBatch.batchNumber) {
          return true;
        }
        return false;
      });
    });

    handleEdit(targetItem, {
      openBrandIndex: targetBrandIndex >= 0 ? targetBrandIndex : 0
    });

    handledFocusNavigationKeyRef.current = location.key;
  }, [items, loading, location.key, location.state]);

  const handleDelete = async (id) => {
    setFormError('');
    const result = await deleteItem(id);
    if (!result.success && result.message) {
      setFormError(result.message);
    }
    if (result.success && editingId === id) {
      resetForm();
    }
  };

  const submitLabel = editingId ? 'Update item' : 'Add item';

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold text-slate-800">Items</h1>
        <p className="text-sm text-slate-500">
          Manage inventory items, track brand pricing, and keep appointment billing accurate.
        </p>
      </div>

      <section ref={formSectionRef} className="rounded-2xl border border-base-300 bg-base-100 p-6 shadow-sm">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-semibold text-slate-800">
            {editingId ? 'Update item' : 'Create item'}
          </h2>
          {editingId && (
            <button type="button" className="btn btn-sm btn-ghost" onClick={resetForm}>
              Cancel edit
            </button>
          )}
        </div>

        {formError && (
          <div className="alert alert-error mb-4 shadow-sm">
            <span>{formError}</span>
          </div>
        )}

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="grid gap-4 lg:grid-cols-2">
            <label className="flex flex-col gap-2">
              <span className="text-xs font-medium text-slate-600">Item name</span>
              <input
                type="text"
                className="input input-bordered input-sm"
                value={formState.name}
                onChange={(event) => handleFieldChange('name', event.target.value)}
                placeholder="Antibiotic"
              />
            </label>
            <label className="flex flex-col gap-2">
              <span className="text-xs font-medium text-slate-600">Description</span>
              <input
                type="text"
                className="input input-bordered input-sm"
                value={formState.description}
                onChange={(event) => handleFieldChange('description', event.target.value)}
                placeholder="Common use, dosage notes, etc."
              />
            </label>
          </div>

          <div className="rounded-xl border border-base-200 bg-base-50 p-4">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-medium text-slate-700">Brand Details</p>
                <p className="text-xs text-slate-500">List each brand variation with pricing, stock, and tracking info.</p>
              </div>
              <button type="button" className="btn btn-sm btn-outline" onClick={handleAddBrand}>
                Add brand
              </button>
            </div>

            <div className="space-y-2">
              {formState.brands.length === 0 ? (
                <p className="text-center text-sm text-slate-500 py-4">No brands added yet.</p>
              ) : (
                formState.brands.map((brand, index) => {
                  const totalStock = (brand.batches || []).reduce(
                    (sum, batch) => sum + (Number(batch.quantity) || 0),
                    0
                  );
                  const supplier = suppliers.find((s) => s.id === brand.supplier_id);

                  return (
                    <div key={`${brand.id || 'new'}-${index}`} className="flex items-center gap-2 rounded-lg border border-base-300 bg-white p-3 hover:shadow-sm transition-shadow">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-slate-700 truncate">{brand.name || '(Unnamed)'}</p>
                        <div className="mt-1 flex flex-wrap gap-3 text-xs text-slate-500">
                          <span>💰 {currencyFormatter.format(brand.price || 0)}</span>
                          <span>📦 Stock: {totalStock}</span>
                          {brand.barcode && <span>🏷️ {brand.barcode}</span>}
                          {supplier && <span>🏢 {supplier.name}</span>}
                          <span>🔗 {(brand.batches || []).length} batches</span>
                        </div>
                      </div>
                      <div className="flex gap-2 flex-shrink-0">
                        <button
                          type="button"
                          className="btn btn-sm btn-outline"
                          onClick={() => handleOpenBrandModal(index)}
                          title="Edit brand and batches"
                        >
                          ✏️
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm btn-error btn-outline"
                          onClick={() => handleRemoveBrand(index)}
                          title="Remove brand"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="flex justify-end">
            <button type="submit" className="btn btn-primary px-6">
              {submitLabel}
            </button>
          </div>
        </form>

        {/* Brand Modal */}
        {isBrandModalOpen && editingBrandIndex !== null && (
          <BrandModal
            isOpen={isBrandModalOpen}
            brand={formState.brands[editingBrandIndex]}
            index={editingBrandIndex}
            suppliers={suppliers}
            onSave={handleSaveBrand}
            onCancel={handleCloseBrandModal}
            onAddBatch={handleAddBatchFromModal}
            onRemoveBatch={handleRemoveBatchFromModal}
            onBatchChange={handleBatchChangeFromModal}
          />
        )}
      </section>

      {error && (
        <div className="alert alert-error shadow-sm">
          <span>{error}</span>
        </div>
      )}

      <EntityTable
        columns={columns}
        data={items}
        loading={loading}
        onEdit={handleEdit}
        onDelete={handleDelete}
        emptyMessage="No items recorded yet."
      />
    </section>
  );
};

export default MedicinesPage;
