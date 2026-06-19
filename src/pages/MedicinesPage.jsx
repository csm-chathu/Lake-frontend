import { useMemo, useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';
import JsBarcode from 'jsbarcode';
import { AlertTriangle, Filter, Package2, Pencil, Pill, Plus, Search, Tag, Trash2, X } from 'lucide-react';
import useEntityApi from '../hooks/useEntityApi.js';
import BrandModal from '../components/BrandModal.jsx';
import api from '../api/client.js';

const currencyFormatter = new Intl.NumberFormat('en-LK', { style: 'currency', currency: 'LKR' });

const buildBarcodeSvg = (value) => {
  const v = String(value || '').trim();
  if (!v || typeof document === 'undefined') return '';
  try {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    JsBarcode(svg, v, { format: 'CODE128', lineColor: '#000', width: 1, height: 28, displayValue: true, fontSize: 7, margin: 2, background: '#ffffff' });
    return svg.outerHTML;
  } catch {
    return '';
  }
};

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
  dose_sizes: [],
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
  const [searchTerm, setSearchTerm] = useState('');
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
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
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

  const handlePrintBarcode = async (brand, index) => {
    let barcodeValue = (brand.barcode || '').trim();

    if (!barcodeValue) {
      if (!brand.id) {
        setFormError('Save the item first so a numeric barcode ID can be assigned.');
        return;
      }
      barcodeValue = String(brand.id);
      setFormState((prev) => ({
        ...prev,
        brands: prev.brands.map((b, i) => (i === index ? { ...b, barcode: barcodeValue } : b))
      }));
    }

    const svgMarkup = buildBarcodeSvg(barcodeValue);
    if (!svgMarkup) {
      setFormError('Failed to generate barcode.');
      return;
    }

    const medicineName = formState.name || '';
    const brandName = brand.name || '';
    const price = currencyFormatter.format(brand.price || 0);

    const barcodeHtml = `<!DOCTYPE html>
<html><head>
  <meta charset="utf-8"/>
  <title>Barcode</title>
  <style>
    @page { size: 30mm 20mm; margin: 0; }
    * { box-sizing: border-box; }
    body { font-family: sans-serif; margin: 0; padding: 1mm; width: 30mm; height: 20mm; overflow: hidden; text-align: center; display: flex; flex-direction: column; align-items: center; justify-content: center; }
    .med   { font-size: 5.5pt; color: #444; line-height: 1.1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 28mm; }
    .brand { font-size: 7pt; font-weight: 700; line-height: 1.2; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 28mm; }
    .price { font-size: 6pt; color: #222; line-height: 1.1; margin-bottom: 0.5mm; }
    svg    { max-width: 28mm; }
  </style>
</head><body>
  <div class="med">${medicineName}</div>
  <div class="brand">${brandName}</div>
  <div class="price">${price}</div>
  ${svgMarkup}
</body></html>`;

    if (window.electronAPI?.printBarcode) {
      const config = await window.electronAPI.getPrinterConfig().catch(() => ({}));
      const printerName = config?.barcode?.name || '';
      console.log('[printBarcode] printer:', printerName || '(default)');
      const result = await window.electronAPI.printBarcode(barcodeHtml, printerName);
      console.log('[printBarcode] result:', result);
      return;
    }

    const win = window.open('', '_blank', 'width=200,height=160');
    if (!win) return;
    win.document.open();
    win.document.write(barcodeHtml.replace('</body>', `<script>window.onload=function(){setTimeout(function(){window.print();setTimeout(function(){window.close();},200)},300)}</script></body>`));
    win.document.close();
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
    setIsItemModalOpen(false);
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

      const wholesalePriceValue = brand.wholesale_price === '' || brand.wholesale_price == null
        ? 0
        : Number.parseFloat(brand.wholesale_price);
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
          dose_sizes: Array.isArray(brand.dose_sizes) ? brand.dose_sizes : [],
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

    setIsSubmitting(true);
    const payload = buildPayload();
    const action = editingId ? updateItem(editingId, payload) : createItem(payload);
    const result = await action;
    setIsSubmitting(false);

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
              dose_sizes: Array.isArray(brand.dose_sizes) ? brand.dose_sizes : [],
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
    setIsItemModalOpen(true);

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
  const normalizedQuery = searchTerm.trim().toLowerCase();
  const filteredItems = useMemo(() => {
    if (!normalizedQuery) {
      return items;
    }

    return items.filter((item) => {
      const brandNames = Array.isArray(item.brands)
        ? item.brands.map((brand) => brand?.name || '').join(' ')
        : '';
      const haystack = [item.name, item.description, brandNames]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [items, normalizedQuery]);

  return (
    <>
    <section className="space-y-6">
      {/* ── Page header ── */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-600">
            <Pill size={22} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Stock</h1>
            <p className="text-sm text-slate-400">Manage inventory items, track brand pricing, and keep billing accurate.</p>
          </div>
        </div>
        <button
          type="button"
          className="inline-flex items-center gap-2 btn btn-primary rounded-xl px-4"
          onClick={() => { resetForm(); setIsItemModalOpen(true); }}
        >
          <Plus size={16} /> New item
        </button>
      </div>

      {/* ── Filter bar ── */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-end gap-3">
          <label className="relative min-w-[220px] flex-1">
            <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-400">Search stock</span>
            <Search size={15} className="pointer-events-none absolute left-3 top-[33px] text-slate-400" />
            <input
              type="search"
              className="input input-bordered w-full pl-9 text-sm"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search by item, description, or brand"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
              <Filter size={12} /> Type
            </span>
            <select
              className="select select-bordered select-sm min-w-[160px]"
              value={typeFilter}
              onChange={(event) => setTypeFilter(event.target.value)}
            >
              <option value="all">All</option>
              <option value="medicine">Medicine</option>
              <option value="item">Item</option>
              <option value="service">Service</option>
            </select>
          </label>
          {searchTerm && (
            <button
              type="button"
              className="inline-flex items-center gap-1.5 btn btn-sm btn-ghost rounded-xl"
              onClick={() => setSearchTerm('')}
            >
              <X size={14} /> Clear
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <AlertTriangle size={16} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* ── Card grid ── */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm animate-pulse">
              <div className="mb-3 flex gap-2">
                <div className="h-5 w-16 rounded-full bg-slate-100" />
                <div className="h-5 w-12 rounded-full bg-slate-100" />
              </div>
              <div className="mb-1 h-4 w-2/3 rounded bg-slate-100" />
              <div className="h-3 w-1/2 rounded bg-slate-100" />
              <div className="mt-4 space-y-2">
                <div className="h-8 rounded-lg bg-slate-100" />
                <div className="h-8 rounded-lg bg-slate-100" />
              </div>
            </div>
          ))}
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white py-16 text-center shadow-sm">
          <Pill size={36} className="mb-3 text-slate-200" />
          <p className="text-sm font-medium text-slate-500">
            {normalizedQuery ? 'No stock items match your search.' : 'No items recorded yet.'}
          </p>
          {!normalizedQuery && (
            <button
              type="button"
              className="mt-4 inline-flex items-center gap-2 btn btn-sm btn-primary rounded-xl"
              onClick={() => { resetForm(); setIsItemModalOpen(true); }}
            >
              <Plus size={14} /> Add your first item
            </button>
          )}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredItems.map((item) => {
            const types = Array.isArray(item.type) ? item.type : item.type ? [item.type] : [];
            const brands = Array.isArray(item.brands) ? item.brands : [];
            const totalStock = brands.reduce((sum, b) => {
              const batches = Array.isArray(b.batches) ? b.batches : [];
              return sum + (batches.length
                ? batches.reduce((s, bt) => s + (Number(bt.quantity) || 0), 0)
                : (Number(b.stock) || 0));
            }, 0);

            const now = new Date();
            const soonMs = 60 * 24 * 60 * 60 * 1000;
            const expiryWarning = brands.some((b) =>
              (Array.isArray(b.batches) ? b.batches : []).some((bt) => {
                if (!bt.expiry_date) return false;
                const exp = new Date(bt.expiry_date);
                return exp - now < soonMs;
              })
            );
            const outOfStock = totalStock === 0;

            const typeBadgeClass = (t) => {
              if (t === 'medicine') return 'bg-blue-100 text-blue-700';
              if (t === 'service') return 'bg-emerald-100 text-emerald-700';
              return 'bg-violet-100 text-violet-700';
            };

            const stockBadge = outOfStock
              ? 'bg-red-100 text-red-700'
              : totalStock <= 10
              ? 'bg-amber-100 text-amber-700'
              : 'bg-emerald-100 text-emerald-700';

            return (
              <div key={item.id} className="flex flex-col rounded-2xl border border-slate-200 bg-white shadow-sm hover:shadow-md transition-shadow">
                {/* Card header */}
                <div className="flex items-start justify-between gap-2 p-4 pb-2">
                  <div className="flex flex-wrap gap-1">
                    {types.map((t) => (
                      <span key={t} className={`rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${typeBadgeClass(t)}`}>
                        {t}
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button
                      type="button"
                      title="Edit"
                      onClick={() => handleEdit(item)}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-blue-200 bg-blue-50 text-blue-600 hover:bg-blue-100 transition"
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      type="button"
                      title="Delete"
                      onClick={() => handleDelete(item.id)}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-rose-200 bg-rose-50 text-rose-500 hover:bg-rose-100 transition"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                {/* Name & description */}
                <div className="px-4 pb-3">
                  <h3 className="font-semibold text-slate-800 leading-tight">{item.name}</h3>
                  {item.description && (
                    <p className="mt-0.5 text-xs text-slate-400 line-clamp-1">{item.description}</p>
                  )}
                </div>

                {/* Brands */}
                <div className="flex-1 space-y-1.5 px-4 pb-3">
                  {brands.length === 0 ? (
                    <p className="text-xs text-slate-400 italic">No brands yet</p>
                  ) : (
                    brands.map((brand) => {
                      const batches = Array.isArray(brand.batches) ? brand.batches : [];
                      const brandStock = batches.length
                        ? batches.reduce((s, bt) => s + (Number(bt.quantity) || 0), 0)
                        : (Number(brand.stock) || 0);
                      const brandStockClass = brandStock === 0
                        ? 'bg-red-100 text-red-700'
                        : brandStock <= 10
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-emerald-100 text-emerald-700';
                      return (
                        <div key={brand.id} className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-3 py-1.5">
                          <span className="text-xs font-medium text-slate-700 truncate max-w-[120px]">{brand.name}</span>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-xs text-slate-500">{currencyFormatter.format(Number(brand.price) || 0)}</span>
                            <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${brandStockClass}`}>
                              {brandStock}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Footer — total stock + warnings */}
                <div className="flex items-center justify-between border-t border-slate-100 px-4 py-2">
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${stockBadge}`}>
                      {totalStock} in stock
                    </span>
                    {brands.length > 0 && (
                      <span className="text-[10px] text-slate-400">{brands.length} brand{brands.length > 1 ? 's' : ''}</span>
                    )}
                  </div>
                  {expiryWarning && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-600">
                      <AlertTriangle size={11} /> Expiring soon
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

    </section>

      {/* ── Item modal (outside space-y-6 to avoid margin-top offset) ── */}
      {isItemModalOpen && createPortal(
        <>
          <div className="fixed inset-0 z-[200] bg-black/40 backdrop-blur-sm" onClick={resetForm} />
          <div className="fixed inset-0 z-[210] overflow-y-auto">
            <div className="flex min-h-full items-center justify-center px-4 py-8">
              <div
                className="relative w-full max-w-xl rounded-2xl border border-slate-200 bg-white shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Header */}
                <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-5 py-3.5">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
                      <Package2 size={15} />
                    </div>
                    <h2 className="text-sm font-semibold text-slate-800">
                      {editingId ? 'Edit item' : 'New item'}
                    </h2>
                  </div>
                  <button
                    onClick={resetForm}
                    className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-100 transition"
                  >
                    <X size={15} />
                  </button>
                </div>

                {/* Body */}
                <form className="space-y-4 p-5" onSubmit={handleSubmit}>
                  {formError && (
                    <div className="flex items-center gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                      <AlertTriangle size={16} className="shrink-0" />
                      <span>{formError}</span>
                    </div>
                  )}

                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="flex flex-col gap-1">
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Item name *</span>
                      <input
                        type="text"
                        className="input input-bordered input-sm"
                        value={formState.name}
                        onChange={(event) => handleFieldChange('name', event.target.value)}
                        placeholder="e.g. Amoxicillin"
                      />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Description</span>
                      <input
                        type="text"
                        className="input input-bordered input-sm"
                        value={formState.description}
                        onChange={(event) => handleFieldChange('description', event.target.value)}
                        placeholder="Dosage notes, use, etc."
                      />
                    </label>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Item type</span>
                    <div className="flex overflow-hidden rounded-lg border border-slate-200 w-fit">
                      {[
                        { label: 'Medicine', value: ['medicine'] },
                        { label: 'Item', value: ['item'] },
                        { label: 'Medicine & Item', value: ['medicine', 'item'] },
                        { label: 'Service', value: ['service'] },
                      ].map(({ label, value }, i, arr) => {
                        const active = value.length === formState.type.length && value.every((v) => formState.type.includes(v));
                        return (
                          <button
                            key={label}
                            type="button"
                            onClick={() => setFormState((prev) => ({ ...prev, type: value }))}
                            className={`px-3 py-1.5 text-xs font-semibold transition
                              ${i < arr.length - 1 ? 'border-r border-slate-200' : ''}
                              ${active ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Brands list */}
                  <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Tag size={13} className="text-slate-400" />
                        <span className="text-xs font-semibold text-slate-600">Brands</span>
                        <span className="rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] font-bold text-blue-700">
                          {formState.brands.length}
                        </span>
                      </div>
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 btn btn-xs rounded-lg border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100"
                        onClick={handleAddBrand}
                      >
                        <Plus size={12} /> Add brand
                      </button>
                    </div>

                    <div className="space-y-2">
                      {formState.brands.length === 0 ? (
                        <p className="py-5 text-center text-sm text-slate-400">No brands yet. Add one above.</p>
                      ) : (
                        formState.brands.map((brand, index) => {
                          const totalStock = (brand.batches || []).reduce(
                            (sum, batch) => sum + (Number(batch.quantity) || 0),
                            0
                          );
                          const supplier = suppliers.find((s) => s.id === brand.supplier_id);
                          return (
                            <div
                              key={brand.id || 'new-' + index}
                              className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-3"
                            >
                              <div className="flex-1 min-w-0">
                                <input
                                  type="text"
                                  className="w-full bg-transparent text-sm font-semibold text-slate-700 outline-none border-b border-transparent focus:border-blue-400 focus:text-blue-700 transition placeholder:text-slate-400 placeholder:italic truncate"
                                  value={brand.name}
                                  placeholder="Unnamed"
                                  onChange={(e) => setFormState((prev) => ({
                                    ...prev,
                                    brands: prev.brands.map((b, i) => i === index ? { ...b, name: e.target.value } : b)
                                  }))}
                                />
                                <div className="mt-0.5 flex flex-wrap gap-2 text-[11px] text-slate-500">
                                  <span className="flex items-center gap-0.5">
                                    LKR
                                    <input
                                      type="number"
                                      min="0"
                                      step="0.01"
                                      className="w-20 bg-transparent text-[11px] text-slate-500 outline-none border-b border-transparent focus:border-blue-400 focus:text-blue-700 transition"
                                      value={brand.price}
                                      placeholder="0.00"
                                      onChange={(e) => setFormState((prev) => ({
                                        ...prev,
                                        brands: prev.brands.map((b, i) => i === index ? { ...b, price: e.target.value } : b)
                                      }))}
                                    />
                                  </span>
                                  <span>· Stock: {totalStock}</span>
                                  {brand.batches?.length > 0 && <span>· {brand.batches.length} batch{brand.batches.length > 1 ? 'es' : ''}</span>}
                                  {supplier && <span>· {supplier.name}</span>}
                                </div>
                              </div>
                              <div className="flex gap-1.5 flex-shrink-0">
                                <button
                                  title="Edit brand"
                                  type="button"
                                  className="inline-flex items-center justify-center h-7 w-7 rounded-lg border border-blue-200 bg-blue-50 text-blue-600 hover:bg-blue-100 transition"
                                  onClick={() => handleOpenBrandModal(index)}
                                >
                                  <Pencil size={13} />
                                </button>
                                <button
                                  title="Remove brand"
                                  type="button"
                                  className="inline-flex items-center justify-center h-7 w-7 rounded-lg border border-rose-200 bg-rose-50 text-rose-500 hover:bg-rose-100 transition"
                                  onClick={() => handleRemoveBrand(index)}
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="flex justify-end gap-2 border-t border-slate-100 pt-2">
                    <button
                      type="button"
                      className="inline-flex items-center gap-1.5 btn btn-sm btn-ghost rounded-xl"
                      onClick={resetForm}
                    >
                      <X size={14} /> Cancel
                    </button>
                    <button type="submit" disabled={isSubmitting} className="inline-flex items-center gap-2 btn btn-sm btn-primary rounded-xl px-5">
                      {isSubmitting
                        ? <span className="loading loading-spinner loading-xs" />
                        : <Package2 size={14} />}
                      {isSubmitting ? 'Saving…' : submitLabel}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </>,
        document.body
      )}

      {/* Brand modal */}
      {isBrandModalOpen && editingBrandIndex !== null && (
        <BrandModal
          isOpen={isBrandModalOpen}
          brand={formState.brands[editingBrandIndex]}
          index={editingBrandIndex}
          medicineName={formState.name}
          itemType={formState.type}
          suppliers={suppliers}
          onSave={handleSaveBrand}
          onCancel={handleCloseBrandModal}
          onAddBatch={handleAddBatchFromModal}
          onRemoveBatch={handleRemoveBatchFromModal}
          onBatchChange={handleBatchChangeFromModal}
          onPrintBarcode={(brand) => handlePrintBarcode(brand, editingBrandIndex)}
        />
      )}
    </>
  );
};

export default MedicinesPage;
