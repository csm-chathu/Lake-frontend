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
  unit_type: 'unit',
  conversion: 1,
  unit_cost: '',
  scale: 'ml',
  batches: [createEmptyBatch()]
});

const createEmptyItem = (type = ['medicine']) => ({
  name: '',
  description: '',
  type,
  brands: [createEmptyBrand()]
});

const MedicinesPage = () => {
  const { items, loading, error, createItem, updateItem, deleteItem, setParams } = useEntityApi('medicines');
  // Filter for type 'medicine' only
  // Type filter state
  const [typeFilter, setTypeFilter] = useState('all');
  useEffect(() => {
    if (typeFilter === 'all') {
      setParams({});
    } else {
      setParams({ type: typeFilter });
    }
  }, [setParams, typeFilter]);
  const location = useLocation();
  const [formState, setFormState] = useState(() => createEmptyItem(['medicine']));
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
      { header: 'Type', accessor: 'type', render: (item) => Array.isArray(item.type) ? item.type.map(t => t.charAt(0).toUpperCase() + t.slice(1)).join(', ') : (item.type ? item.type.charAt(0).toUpperCase() + item.type.slice(1) : '—') },
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
    // For type, ensure it's always an array
    if (field === 'type') {
      setFormState((prev) => ({ ...prev, type: value }));
    } else {
      setFormState((prev) => ({ ...prev, [field]: value }));
    }
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
    setFormState(createEmptyItem(['medicine']));
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

      // Batch number is now optional, but if batches exist, check their quantities
      const batches = brand.batches || [];
      for (const batch of batches) {
        if (batch.batch_number && batch.batch_number.trim() !== '') {
          const quantityValue = Number.parseInt(batch.quantity, 10);
          if (Number.isNaN(quantityValue) || quantityValue < 0) {
            return 'Batch quantity must be zero or greater.';
          }
        }
      }
    }

    return '';
  };

  // Helper to generate a UUID (RFC4122 v4, simple version)
  function uuidv4() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  const buildPayload = () => {
    const normalizedBrands = formState.brands
      .filter((brand) => brand.name.trim())
      .map((brand) => {
        const priceValue = Number.parseFloat(brand.price);
        const wholesalePriceValue = Number.parseFloat(brand.wholesale_price);
        let batches = Array.isArray(brand.batches) ? brand.batches : [];

        // If no batches, but user entered expiry_date, quantity, or supplier_id at brand level, create a batch
        const hasBatchInfo = !!(brand.expiry_date || brand.stock || brand.supplier_id);
        if (!batches.length && hasBatchInfo) {
          let expiryDate = null;
          if (brand.expiry_date) {
            if (brand.expiry_date instanceof Date) {
              expiryDate = brand.expiry_date.toISOString().split('T')[0];
            } else if (typeof brand.expiry_date === 'string' && brand.expiry_date.trim()) {
              expiryDate = brand.expiry_date;
            }
          }
          batches = [{
            batch_number: uuidv4(),
            quantity: brand.stock ?? 0,
            expiry_date: expiryDate,
            supplier_id: brand.supplier_id || null
          }];
        }

        // If user entered a batch with expiry_date or quantity but no batch_number, auto-generate batch_number
        batches = batches.map((batch) => {
          let batchNumber = batch.batch_number;
          if (!batchNumber || !batchNumber.trim()) {
            if (batch.expiry_date || batch.quantity || batch.supplier_id) {
              batchNumber = uuidv4();
            }
          }
          return { ...batch, batch_number: batchNumber };
        });

        const normalizedBatches = batches
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
          unit_type: brand.unit_type || 'unit',
          conversion: brand.conversion || 1,
          unit_cost: Number(brand.unit_cost) || 0,
          scale: brand.scale || 'ml',
          batches: normalizedBatches
        };
      });

    return {
      name: formState.name.trim(),
      description: formState.description.trim(),
      type: Array.isArray(formState.type) ? formState.type : [formState.type],
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
      type: Array.isArray(item.type) ? item.type : item.type ? [item.type] : ['medicine'],
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
              unit_type: brand.unit_type || 'unit',
              conversion: brand.conversion || 1,
              unit_cost:
                brand.unit_cost !== undefined && brand.unit_cost !== null
                  ? Number(brand.unit_cost).toFixed(2)
                  : '',
              scale: brand.scale || 'ml',
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
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-slate-800">Stock</h1>
          <p className="text-sm text-slate-500">
            Manage inventory items, track brand pricing, and keep appointment billing accurate.
          </p>
        </div>
        <div className="mt-2 md:mt-0">
          <label className="text-xs font-medium text-slate-600 mr-2">Filter by type:</label>
          <select
            className="input input-sm input-bordered"
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value)}
          >
            <option value="all">All</option>
            <option value="medicine">Medicine</option>
            <option value="item">Item</option>
            <option value="service">Service</option>
          </select>
        </div>
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
                      <div className="grid gap-4 lg:grid-cols-2" style={{ position: 'relative' }}>
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
                        <div style={{ position: 'absolute', right: 0, top: 0 }} className="flex items-center gap-4">
                          <label className="flex items-center gap-1">
                            <input
                              type="checkbox"
                              checked={formState.type.includes('medicine')}
                              onChange={() => {
                                setFormState((prev) => {
                                  const typeArr = prev.type.includes('medicine')
                                    ? prev.type.filter(t => t !== 'medicine')
                                    : [...prev.type, 'medicine'];
                                  return { ...prev, type: typeArr };
                                });
                              }}
                            />
                            <span className="text-xs font-medium text-slate-600">Medicine</span>
                          </label>
                          <label className="flex items-center gap-1">
                            <input
                              type="checkbox"
                              checked={formState.type.includes('item')}
                              onChange={() => {
                                setFormState((prev) => {
                                  const typeArr = prev.type.includes('item')
                                    ? prev.type.filter(t => t !== 'item')
                                    : [...prev.type, 'item'];
                                  return { ...prev, type: typeArr };
                                });
                              }}
                            />
                            <span className="text-xs font-medium text-slate-600">Item</span>
                          </label>
                          <label className="flex items-center gap-1">
                            <input
                              type="checkbox"
                              checked={formState.type.includes('service')}
                              onChange={() => {
                                setFormState((prev) => {
                                  const typeArr = prev.type.includes('service')
                                    ? prev.type.filter(t => t !== 'service')
                                    : [...prev.type, 'service'];
                                  return { ...prev, type: typeArr };
                                });
                              }}
                            />
                            <span className="text-xs font-medium text-slate-600">Service</span>
                          </label>
                        </div>
            <div />
            <div />
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
                    <div key={brand.id || 'new-' + index} className="flex items-center gap-2 rounded-lg border border-base-300 bg-white p-3 hover:shadow-sm transition-shadow">
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
