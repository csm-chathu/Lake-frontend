
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertTriangle,
  CheckCircle2,
  Minus,
  Package,
  Plus,
  Receipt,
  Search,
  ShoppingCart,
  Tag,
  Trash2,
  X,
} from 'lucide-react';
import { calculateMedicinesTotal } from '../components/AppointmentMedicineSelector.jsx';
import useEntityApi from '../hooks/useEntityApi.js';
import { useClinicSettings } from '../context/ClinicSettingsContext.jsx';
import { useNavigate } from 'react-router-dom';
import api from '../api/client.js';

const currencyFormatter = new Intl.NumberFormat('en-LK', { style: 'currency', currency: 'LKR' });

const LETTER_COLORS = [
  { bg: 'bg-rose-100',    icon: 'text-rose-400'    },
  { bg: 'bg-orange-100',  icon: 'text-orange-400'  },
  { bg: 'bg-amber-100',   icon: 'text-amber-500'   },
  { bg: 'bg-yellow-100',  icon: 'text-yellow-500'  },
  { bg: 'bg-lime-100',    icon: 'text-lime-500'    },
  { bg: 'bg-green-100',   icon: 'text-green-500'   },
  { bg: 'bg-emerald-100', icon: 'text-emerald-500' },
  { bg: 'bg-teal-100',    icon: 'text-teal-500'    },
  { bg: 'bg-cyan-100',    icon: 'text-cyan-500'    },
  { bg: 'bg-sky-100',     icon: 'text-sky-500'     },
  { bg: 'bg-blue-100',    icon: 'text-blue-500'    },
  { bg: 'bg-indigo-100',  icon: 'text-indigo-500'  },
  { bg: 'bg-violet-100',  icon: 'text-violet-500'  },
  { bg: 'bg-purple-100',  icon: 'text-purple-500'  },
  { bg: 'bg-fuchsia-100', icon: 'text-fuchsia-500' },
  { bg: 'bg-pink-100',    icon: 'text-pink-500'    },
];

const getLetterColor = (name) => {
  const code = (name || '').trim().toUpperCase().charCodeAt(0) || 0;
  return LETTER_COLORS[code % LETTER_COLORS.length];
};


const generateSaleReference = () => {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, '0');
  const datePart = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
  const timePart = `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  return `DS-${datePart}-${timePart}`;
};

const createEmptySale = () => ({
  saleRef: generateSaleReference(),
  medicines: [],
  discount: '',
  serviceCharge: '',
  paymentType: 'cash',
  paymentStatus: 'paid'
});

const DirectSalesPage = () => {
  const navigate = useNavigate();
  const { settings } = useClinicSettings();
  const directSalesApi = useEntityApi('direct-sales');
  const medicinesApi = useEntityApi('medicines');
  const suppliersApi = useEntityApi('suppliers');


  const { createItem: createDirectSale, error: directSalesError, refresh: refreshDirectSales } = directSalesApi;
  const { items: medicines, error: medicinesError } = medicinesApi;
  const { refresh: refreshMedicines } = medicinesApi;
  const { items: suppliers } = suppliersApi;

  // Load discount presets from API
  const { items: discountsApi, loading: discountsLoading } = useEntityApi('discounts');
  const discountPresets = Array.isArray(discountsApi) ? discountsApi.filter((d) => d.active !== false) : [];

  const [formState, setFormState] = useState(createEmptySale);
  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [formError, setFormError] = useState('');
  const [catalogSearch, setCatalogSearch] = useState('');
  const [catalogHint, setCatalogHint] = useState('');
  const [highlightedTileIndex, setHighlightedTileIndex] = useState(-1);
  const tilesGridRef = useRef(null);

  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [addItemForm, setAddItemForm] = useState({ brandName: '', price: '', stock: '', barcode: '', expiryDate: '', supplierId: '' });
  const [addItemSelectedMedicine, setAddItemSelectedMedicine] = useState(null);
  const [addItemNameQuery, setAddItemNameQuery] = useState('');
  const [addItemDropdownOpen, setAddItemDropdownOpen] = useState(false);
  const [addItemHighlight, setAddItemHighlight] = useState(-1);
  const [addItemError, setAddItemError] = useState('');
  const [addItemSaving, setAddItemSaving] = useState(false);
  const addItemNameRef = useRef(null);

  const openAddItemModal = () => {
    const q = catalogSearch.trim();
    setAddItemForm({ brandName: q, price: '', stock: '', barcode: '', expiryDate: '', supplierId: '' });
    setAddItemNameQuery('');
    setAddItemSelectedMedicine(null);
    setAddItemDropdownOpen(!!q);
    setAddItemHighlight(-1);
    setAddItemError('');
    setShowAddItemModal(true);
  };

  const addItemMedicineSuggestions = useMemo(() => {
    const q = addItemNameQuery.trim().toLowerCase();
    if (!q) return medicines.slice(0, 8);
    return medicines.filter((m) => m.name.toLowerCase().includes(q)).slice(0, 8);
  }, [medicines, addItemNameQuery]);

  // total rows = suggestions + optional "create new" row
  const addItemHasCreateRow = addItemNameQuery.trim() &&
    !addItemMedicineSuggestions.some((m) => m.name.toLowerCase() === addItemNameQuery.trim().toLowerCase());
  const addItemTotalRows = addItemMedicineSuggestions.length + (addItemHasCreateRow ? 1 : 0);

  const selectAddItemRow = (index) => {
    if (index < addItemMedicineSuggestions.length) {
      const m = addItemMedicineSuggestions[index];
      setAddItemSelectedMedicine({ id: m.id, name: m.name });
      setAddItemNameQuery(m.name);
    } else {
      setAddItemSelectedMedicine(null);
    }
    setAddItemDropdownOpen(false);
    setAddItemHighlight(-1);
  };

  const handleAddItemNameKeyDown = (e) => {
    if (!addItemDropdownOpen || addItemTotalRows === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setAddItemHighlight((p) => Math.min(p + 1, addItemTotalRows - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setAddItemHighlight((p) => Math.max(p - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (addItemHighlight >= 0) selectAddItemRow(addItemHighlight);
    } else if (e.key === 'Escape') {
      setAddItemDropdownOpen(false);
    }
  };

  const handleAddItemSubmit = async (e) => {
    e.preventDefault();
    const brandName = addItemForm.brandName.trim();
    const price = Number(addItemForm.price);
    const stock = Number(addItemForm.stock) || 0;
    const newName = addItemNameQuery.trim();

    if (!addItemSelectedMedicine && !newName) { setAddItemError('Item name is required.'); return; }
    if (!brandName) { setAddItemError('Brand / variant name is required.'); return; }
    if (!price || price <= 0) { setAddItemError('Price must be greater than zero.'); return; }
    setAddItemSaving(true);
    setAddItemError('');
    try {
      const brand = {
        name: brandName,
        price,
        stock,
        barcode: addItemForm.barcode.trim() || null,
        expiry_date: addItemForm.expiryDate || null,
        supplier_id: addItemForm.supplierId ? Number(addItemForm.supplierId) : null,
      };
      if (addItemSelectedMedicine) {
        await api.patch(`/medicines/${addItemSelectedMedicine.id}`, { brands: [brand] });
      } else {
        await api.post('/medicines', { name: newName, type: ['medicine'], brands: [brand] });
      }
      await refreshMedicines();
      setShowAddItemModal(false);
      setCatalogSearch('');
      const itemName = addItemSelectedMedicine ? addItemSelectedMedicine.name : newName;
      setCatalogHint(`"${itemName} — ${brandName}" added. Select it from the catalog to add to cart.`);
    } catch (err) {
      setAddItemError(err?.response?.data?.message || 'Failed to create item.');
    } finally {
      setAddItemSaving(false);
    }
  };

  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(''), 3000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  // Auto-focus catalog search on mount
  useEffect(() => {
    document.querySelector('[data-catalog-search]')?.focus();
  }, []);

  // Keyboard shortcuts — registered once via ref pattern
  const kbRef = useRef({});
  kbRef.current = { isSaving };

  useEffect(() => {
    const handler = (e) => {
      // F1 → focus catalog/barcode search
      if (e.key === 'F1') {
        e.preventDefault();
        document.querySelector('[data-catalog-search]')?.focus();
        return;
      }
      // F10 → complete sale
      if (e.key === 'F10') {
        e.preventDefault();
        document.querySelector('[data-direct-sale-submit]')?.click();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const brandOptions = useMemo(() => {
    const options = [];
    medicines.forEach((medicine) => {
      if (!Array.isArray(medicine.brands)) {
        return;
      }
      medicine.brands.forEach((brand) => {
        const totalStock = Array.isArray(brand.batches) && brand.batches.length > 0
          ? brand.batches.reduce((sum, batch) => sum + (Number(batch?.quantity) || 0), 0)
          : (Number(brand.stock) || 0);

        options.push({
          value: String(brand.id),
          label: `${medicine.name} — ${brand.name}`,
          price: Number(brand.price) || 0,
          category: Array.isArray(medicine.type) ? medicine.type[0] : (medicine.type || 'other'),
          barcode: String(brand.barcode ?? '').trim(),
          barcodes: Array.from(
            new Set(
              [
                String(brand.barcode ?? '').trim(),
                ...((Array.isArray(brand.batches) ? brand.batches : [])
                  .map((batch) => String(batch?.barcode ?? '').trim())
                  .filter(Boolean))
              ].filter(Boolean)
            )
          ),
          medicineName: medicine.name,
          brandName: brand.name,
          stock: totalStock,
          image_url: brand.image_url || null,
          doseSizes: Array.isArray(brand.dose_sizes) ? brand.dose_sizes : []
        });
      });
    });
    return options.sort((a, b) => a.label.localeCompare(b.label));
  }, [medicines]);

  const brandLookup = useMemo(
    () => new Map(brandOptions.map((option) => [option.value, option])),
    [brandOptions]
  );

  const medicinesTotal = useMemo(
    () => calculateMedicinesTotal(formState.medicines || [], brandLookup),
    [formState.medicines, brandLookup]
  );

  const rawDiscountPercent = Number.parseFloat(formState.discount);
  const discountPercent = Number.isNaN(rawDiscountPercent)
    ? 0
    : Math.min(100, Math.max(0, rawDiscountPercent));
  const discountAmount = Number(((medicinesTotal * discountPercent) / 100).toFixed(2));
  const serviceCharge = Number.parseFloat(formState.serviceCharge) || 0;
  const finalTotal = Math.max(0, medicinesTotal - discountAmount + serviceCharge);

  const barcodeLookup = useMemo(() => {
    const lookup = new Map();
    brandOptions.forEach((option) => {
      (option.barcodes || []).forEach((barcode) => {
        const normalized = String(barcode || '').trim().toLowerCase();
        if (normalized) {
          lookup.set(normalized, option);
        }
      });
    });
    return lookup;
  }, [brandOptions]);


  const cartItems = useMemo(() => {
    return (formState.medicines || [])
      .map((row) => {
        const option = brandLookup.get(String(row.medicineBrandId));
        if (!option) {
          return null;
        }
        const quantity = Math.max(0, Math.round(Number.parseFloat(row.quantity) || 0));
        const unitPrice = Number(option.price) || 0;
        return {
          id: String(row.medicineBrandId),
          label: option.label,
          medicineName: option.medicineName,
          brandName: option.brandName,
          quantity,
          unitPrice,
          lineTotal: Number((quantity * unitPrice).toFixed(2)),
          stock: Number(option.stock) || 0,
          barcode: option.barcode || ''
        };
      })
      .filter((item) => item && item.quantity > 0);
  }, [brandLookup, formState.medicines]);

  const totalCartQuantity = useMemo(
    () => cartItems.reduce((sum, item) => sum + item.quantity, 0),
    [cartItems]
  );

  const filteredCatalogOptions = useMemo(() => {
    const query = catalogSearch.trim().toLowerCase();
    const source = Array.isArray(brandOptions) ? brandOptions : [];
    if (!query) return source.slice(0, 48);
    return source
      .filter((option) => {
        const labelMatch = option.label.toLowerCase().includes(query);
        const barcodeMatch = (option.barcodes || []).some((barcode) =>
          String(barcode || '').toLowerCase().includes(query)
        );
        return labelMatch || barcodeMatch;
      })
      .slice(0, 48);
  }, [brandOptions, catalogSearch]);

  const addBrandOptionToSale = useCallback((option, quantityToAdd = 1) => {
    if (!option?.value) {
      return false;
    }

    const availableStock = Number(option.stock) || 0;
    if (availableStock <= 0) {
      setCatalogHint(`Out of stock: ${option.label}`);
      return false;
    }

    const parsedAddQty = Number.parseFloat(quantityToAdd);
    const safeAddQty = Number.isNaN(parsedAddQty) || parsedAddQty <= 0 ? 1 : Math.round(parsedAddQty);

    setFormState((prev) => {
      const rows = Array.isArray(prev.medicines) ? prev.medicines : [];
      const existingIndex = rows.findIndex(
        (row) => String(row.medicineBrandId) === String(option.value)
      );

      if (existingIndex === -1) {
        const initialQty = Math.min(safeAddQty, availableStock);
        if (initialQty <= 0) {
          setCatalogHint(`Out of stock: ${option.label}`);
          return prev;
        }
        return {
          ...prev,
          medicines: [
            ...rows,
            {
              medicineBrandId: option.value,
              quantity: String(initialQty),
              label: option.label,
              query: option.label
            }
          ]
        };
      }

      const nextRows = rows.map((row, index) => {
        if (index !== existingIndex) {
          return row;
        }

        const currentQty = Number.parseFloat(row.quantity) || 0;
        const nextQty = Math.round(currentQty + safeAddQty);
        if (nextQty > availableStock) {
          setCatalogHint(`Only ${availableStock} in stock for ${option.label}`);
          return { ...row, quantity: String(availableStock) };
        }
        return { ...row, quantity: String(nextQty) };
      });

      return { ...prev, medicines: nextRows };
    });

    return true;
  }, []);

  const updateCartQuantity = useCallback((brandId, delta) => {
    const option = brandLookup.get(String(brandId));
    const availableStock = Number(option?.stock) || 0;

    setFormState((prev) => {
      const rows = Array.isArray(prev.medicines) ? prev.medicines : [];
      return {
        ...prev,
        medicines: rows
          .map((row) => {
            if (String(row.medicineBrandId) !== String(brandId)) {
              return row;
            }

            const currentQty = Math.max(0, Math.round(Number.parseFloat(row.quantity) || 0));
            const nextQty = currentQty + delta;
            if (nextQty <= 0) {
              return null;
            }

            if (availableStock > 0 && nextQty > availableStock) {
              setCatalogHint(`Only ${availableStock} in stock for ${option?.label || 'this item'}`);
              return { ...row, quantity: String(availableStock) };
            }

            return { ...row, quantity: String(nextQty) };
          })
          .filter(Boolean)
      };
    });
  }, [brandLookup]);

  const removeCartItem = useCallback((brandId) => {
    setFormState((prev) => ({
      ...prev,
      medicines: (prev.medicines || []).filter((row) => String(row.medicineBrandId) !== String(brandId))
    }));
  }, []);

  // Reset tile highlight when search query changes
  useEffect(() => {
    setHighlightedTileIndex(-1);
  }, [catalogSearch]);

  // Scroll highlighted tile into view
  useEffect(() => {
    if (highlightedTileIndex < 0) return;
    const tile = tilesGridRef.current?.children[highlightedTileIndex];
    tile?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [highlightedTileIndex]);

  // Compute how many columns are visible in the tile grid
  const getGridCols = () => {
    const grid = tilesGridRef.current;
    if (!grid || grid.children.length < 2) return 1;
    const firstTop = grid.children[0].getBoundingClientRect().top;
    let cols = 1;
    for (let i = 1; i < grid.children.length; i++) {
      if (grid.children[i].getBoundingClientRect().top > firstTop) break;
      cols++;
    }
    return cols;
  };

  const handleCatalogSearchSubmit = (event) => {
    // Arrow key navigation through tiles
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp' ||
        event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      if (filteredCatalogOptions.length === 0) return;
      event.preventDefault();
      event.stopPropagation();
      const total = filteredCatalogOptions.length;
      const cols = getGridCols();
      setHighlightedTileIndex((prev) => {
        if (event.key === 'ArrowDown') {
          if (prev === -1) return 0;
          return Math.min(prev + cols, total - 1);
        }
        if (event.key === 'ArrowUp') {
          if (prev <= 0) return -1;
          const next = prev - cols;
          return next < 0 ? -1 : next;
        }
        if (event.key === 'ArrowRight') {
          if (prev === -1) return 0;
          return Math.min(prev + 1, total - 1);
        }
        if (event.key === 'ArrowLeft') {
          if (prev <= 0) return -1;
          return prev - 1;
        }
        return prev;
      });
      return;
    }

    // Escape → clear highlight, return focus to search
    if (event.key === 'Escape') {
      setHighlightedTileIndex(-1);
      return;
    }

    if (event.key !== 'Enter') return;
    event.preventDefault();

    // Enter with a highlighted tile → add that tile
    if (highlightedTileIndex >= 0) {
      const option = filteredCatalogOptions[highlightedTileIndex];
      if (option) {
        const added = addBrandOptionToSale(option, 1);
        if (added) setCatalogHint(`Added: ${option.label}`);
      }
      return;
    }

    // Enter with no highlight → barcode / label match
    const normalized = catalogSearch.trim().toLowerCase();
    if (!normalized) return;

    const exactBarcodeMatch = barcodeLookup.get(normalized);
    if (exactBarcodeMatch) {
      const added = addBrandOptionToSale(exactBarcodeMatch, 1);
      if (added) setCatalogHint(`Added: ${exactBarcodeMatch.label}`);
      setCatalogSearch('');
      return;
    }

    const exactLabelMatch = brandOptions.find((option) => option.label.toLowerCase() === normalized);
    if (exactLabelMatch) {
      const added = addBrandOptionToSale(exactLabelMatch, 1);
      if (added) setCatalogHint(`Added: ${exactLabelMatch.label}`);
      setCatalogSearch('');
      return;
    }

    // No match at all → open the add-item modal
    if (filteredCatalogOptions.length === 0) {
      openAddItemModal();
      return;
    }

    setCatalogHint('No barcode match found. Try clicking an item tile.');
  };

  const handleChange = (name, value) => {
    setFormState((prev) => ({ ...prev, [name]: value }));
  };


  const handleSubmit = async (event) => {
    event.preventDefault();
    if (isSaving) {
      return;
    }

    setFormError('');
    setSuccessMessage('');

    if (!Array.isArray(formState.medicines) || formState.medicines.length === 0) {
      setFormError('Add at least one item to complete the sale.');
      return;
    }

    if (medicinesTotal <= 0) {
      setFormError('Sale total must be greater than zero.');
      return;
    }

    const payload = {
      saleReference: formState.saleRef.trim() || null,
      discount: discountAmount,
      items: (formState.medicines || []).map((item) => ({
        medicineBrandId: Number(item.medicineBrandId),
        quantity: Number(item.quantity)
      })),
      paymentType: formState.paymentType,
      paymentStatus: formState.paymentType === 'credit' ? formState.paymentStatus : 'paid'
    };

    if (settings.shop_type === 'spare') {
        payload.serviceCharge = serviceCharge;
    }

    setIsSaving(true);
    try {
      const result = await createDirectSale(payload);
      if (result.success) {
        const saleId = result.data?.id || null;
        const referenceName = result.data?.saleReference || formState.saleRef || `Sale #${saleId || ''}`;
        // Prefer API response items (have server-confirmed prices); fall back to form state
        const apiItems = Array.isArray(result.data?.items) ? result.data.items : [];
        const saleLineItems = apiItems.length > 0
          ? apiItems.map((entry) => ({
              label: [entry?.brand?.medicine?.name, entry?.brand?.name].filter(Boolean).join(' — ') || 'Item',
              qty: Number(entry.quantity) || 0,
              unit: Number(entry.unitPrice ?? entry.brand?.price ?? 0)
            })).filter((item) => item.qty > 0)
          : (formState.medicines || [])
              .map((row) => {
                const option = brandLookup.get(String(row.medicineBrandId));
                return {
                  label: option?.label || row.label || 'Item',
                  qty: Number.parseFloat(row.quantity) || 0,
                  unit: option ? Number(option.price) || 0 : 0
                };
              })
              .filter((item) => item.qty > 0);

        setFormState(createEmptySale());
        refreshMedicines();
        refreshDirectSales();
        navigate('/sales/receipt', {
          state: {
            from: 'sales',
            autoprint: true,
            sale: {
              invoiceReference: referenceName,
              saleDate: new Date().toISOString(),
              serviceCharge: settings.shop_type === 'spare' ? serviceCharge : 0,
              discount: discountAmount,
              estimated: Number(Math.max(medicinesTotal - discountAmount + (settings.shop_type === 'spare' ? serviceCharge : 0), 0).toFixed(2)),
              paymentType: formState.paymentType,
              paymentStatus: formState.paymentType === 'credit' ? formState.paymentStatus : 'paid',
              lineItems: saleLineItems
            }
          }
        });
      } else {
        setFormError(result.message || 'Unable to complete direct sale.');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const combinedError = formError || directSalesError || medicinesError;

  return (
    <>
    <section className="mt-0 flex flex-col gap-2 xl:h-[calc(100vh-6.5rem)] xl:-mb-12">
      {/* Removed Quick Sale title and subtitle for more screen space */}

      {successMessage && (
        <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          <CheckCircle2 size={16} className="shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {combinedError && (
        <div className="flex items-center gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <AlertTriangle size={16} className="shrink-0" />
          <span>{combinedError}</span>
        </div>
      )}

      <form
        className="flex flex-col gap-2 flex-1 min-h-0"
        onSubmit={handleSubmit}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && e.target.type !== 'submit') e.preventDefault();
        }}
      >
        <div className="flex-1 min-h-0 grid gap-2 xl:grid-cols-12">
        <div className="xl:col-span-7 min-h-0 flex flex-col">
          <div className="flex flex-col flex-1 min-h-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex-1 min-h-0">
              <div className="flex flex-col min-h-0 overflow-hidden h-full">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <h2 className="inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-700">
                    <Tag size={14} /> Products
                  </h2>
                  <span className="text-xs text-slate-500">Scan barcode or click a product to add</span>
                </div>

                <div className="mb-3 space-y-1">
                  <div className="relative">
                    <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      data-catalog-search
                      type="text"
                      className="input input-bordered input-sm w-full pl-9"
                      placeholder="Search by name or scan barcode (F1)"
                      value={catalogSearch}
                      onChange={(event) => {
                        setCatalogSearch(event.target.value);
                        if (catalogHint) setCatalogHint('');
                      }}
                      onKeyDown={handleCatalogSearchSubmit}
                    />
                  </div>
                  {catalogHint && <p className="text-xs text-emerald-600">{catalogHint}</p>}
                </div>

                {filteredCatalogOptions.length === 0 ? (
                  <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-slate-200 bg-slate-50 p-6 text-center">
                    <p className="text-sm text-slate-500">No products found{catalogSearch.trim() ? ` for "${catalogSearch.trim()}"` : ''}.</p>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-700"
                      onClick={openAddItemModal}
                    >
                      <Plus size={13} /> Add new item
                    </button>
                  </div>
                ) : (
                  <div ref={tilesGridRef} className="grid auto-rows-[160px] gap-2 overflow-auto pr-1 sm:grid-cols-2 lg:grid-cols-3" style={{minHeight: 0, maxHeight: '100%'}}>
                    {filteredCatalogOptions.map((option, index) => {
                      const stockQty = Number(option.stock) || 0;
                      const isHighlighted = highlightedTileIndex === index;
                      return (
                        <button
                          key={`tile-${option.value}`}
                          type="button"
                          className={`relative rounded-xl border p-3 text-left transition ${
                            isHighlighted
                              ? 'border-blue-400 bg-blue-50 ring-2 ring-blue-200'
                              : stockQty > 0
                                ? 'border-slate-200 bg-white hover:border-amber-300 hover:bg-amber-50/40'
                                : 'border-rose-200 bg-rose-50 opacity-80'
                          }`}
                          onMouseEnter={() => setHighlightedTileIndex(index)}
                          onMouseLeave={() => setHighlightedTileIndex(-1)}
                          onClick={() => {
                            const added = addBrandOptionToSale(option, 1);
                            if (added) setCatalogHint(`Added to cart: ${option.label}`);
                          }}
                          disabled={stockQty <= 0}
                        >
                          <div className="pr-16">
                            <div className="mb-1">
                              <p className="line-clamp-2 min-w-0 text-sm font-semibold text-slate-800">{option.medicineName}</p>
                            </div>
                            <p className="text-xs text-slate-600">{option.brandName}</p>
                            <p className="mt-1 text-[11px] text-slate-500">{option.barcode ? `Barcode: ${option.barcode}` : 'No barcode'}</p>
                            <p className="mt-1 text-[11px] font-medium text-slate-600">Stock: {stockQty}</p>
                            {stockQty <= 0 && <p className="mt-1 text-[11px] font-semibold text-rose-700">Out of stock</p>}
                            <p className="mt-1 text-sm font-bold text-emerald-600">{currencyFormatter.format(option.price)}</p>
                          </div>
                          <div className={`absolute bottom-3 right-3 h-14 w-14 overflow-hidden rounded border border-slate-200 flex items-center justify-center ${option.image_url ? 'bg-slate-100' : getLetterColor(option.medicineName).bg}`}>
                            {option.image_url
                              ? <img src={option.image_url} alt={`${option.medicineName} - ${option.brandName}`} className="h-full w-full object-cover" />
                              : <Package size={22} className={getLetterColor(option.medicineName).icon} />
                            }
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <aside className="xl:col-span-5 min-h-0 flex flex-col">
          <div className="flex flex-1 min-h-0 flex-col rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
              <div>
                <h2 className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-700">
                  <ShoppingCart size={12} /> Your Cart
                </h2>
                <p className="text-[10px] text-slate-400">{cartItems.length} product(s) · {totalCartQuantity} total</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <p className="text-[9px] font-semibold uppercase tracking-wide text-slate-400">Reference</p>
                  <p className="text-[10px] font-bold text-blue-700">{formState.saleRef}</p>
                </div>
                <div className="hidden items-center gap-1.5 sm:flex">
                  {[['F1','Search'],['F10','Complete']].map(([key, hint]) => (
                    <span key={key} className="flex items-center gap-0.5">
                      <kbd className="rounded border border-slate-300 bg-white px-1 py-0.5 font-mono text-[9px] font-semibold text-slate-600 shadow-sm">{key}</kbd>
                      <span className="text-[9px] text-slate-400">{hint}</span>
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex-1 space-y-1 overflow-auto p-3">
              {cartItems.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-center text-sm text-slate-500">
                  Your cart is empty. Click a product to add it here.
                </div>
              ) : (
                cartItems.map((item) => (
                  <div key={item.id} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 py-1.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-semibold text-slate-800">{item.medicineName}</p>
                      <p className="truncate text-[10px] text-slate-400">{item.brandName} · <span className="text-amber-600">{currencyFormatter.format(item.unitPrice)}</span></p>
                    </div>
                    <div className="inline-flex shrink-0 items-center gap-0.5">
                      <button
                        type="button"
                        className="inline-flex h-5 w-5 items-center justify-center rounded border border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100"
                        onClick={() => updateCartQuantity(item.id, -1)}
                      >
                        <Minus size={10} />
                      </button>
                      <span className="w-6 text-center text-xs font-semibold text-slate-700">{item.quantity}</span>
                      <button
                        type="button"
                        className="inline-flex h-5 w-5 items-center justify-center rounded border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"
                        onClick={() => updateCartQuantity(item.id, 1)}
                        disabled={item.quantity >= item.stock}
                      >
                        <Plus size={10} />
                      </button>
                    </div>
                    <p className="w-20 shrink-0 text-right text-xs font-bold text-slate-800">{currencyFormatter.format(item.lineTotal)}</p>
                    <button
                      type="button"
                      className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded border border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100"
                      onClick={() => removeCartItem(item.id)}
                      title="Remove item"
                    >
                      <X size={10} />
                    </button>
                  </div>
                ))
              )}
            </div>

          </div>
        </aside>
        </div>

        <div className="shrink-0">
          <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
            <div className="flex flex-wrap items-end gap-3">
              <label className="form-control w-24 shrink-0">
                <span className="label-text text-[10px] font-semibold uppercase tracking-wide text-slate-400">Discount (%)</span>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  className="input input-bordered input-sm"
                  value={formState.discount}
                  onChange={(event) => handleChange('discount', event.target.value)}
                  placeholder="0"
                />
              </label>

              {settings.shop_type === 'spare' ? (
                <label className="form-control w-24 shrink-0">
                  <span className="label-text text-[10px] font-semibold uppercase tracking-wide text-slate-400">Extra Charge</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className="input input-bordered input-sm"
                    value={formState.serviceCharge}
                    onChange={(event) => handleChange('serviceCharge', event.target.value)}
                    placeholder="0.00"
                  />
                </label>
              ) : null}

              <label className="form-control w-24 shrink-0">
                <span className="label-text text-[10px] font-semibold uppercase tracking-wide text-slate-400">Payment</span>
                <select
                  className="select select-bordered select-sm"
                  value={formState.paymentType}
                  onChange={(event) => {
                    const nextType = event.target.value;
                    setFormState((prev) => ({
                      ...prev,
                      paymentType: nextType,
                      paymentStatus: nextType === 'credit' ? prev.paymentStatus : 'paid'
                    }));
                  }}
                >
                  <option value="cash">Cash</option>
                  <option value="credit">Credit</option>
                </select>
              </label>

              <label className="form-control w-24 shrink-0">
                <span className="label-text text-[10px] font-semibold uppercase tracking-wide text-slate-400">Status</span>
                <select
                  className="select select-bordered select-sm"
                  value={formState.paymentType === 'credit' ? formState.paymentStatus : 'paid'}
                  onChange={(event) => handleChange('paymentStatus', event.target.value)}
                  disabled={formState.paymentType !== 'credit'}
                >
                  <option value="paid">Paid</option>
                  <option value="pending">Pending</option>
                </select>
              </label>

              <div className="flex flex-wrap gap-1 self-end pb-0.5">
                {discountsLoading && <span className="text-xs text-slate-400">Loading...</span>}
                {discountPresets.length > 0
                  ? discountPresets.map((preset) => {
                      const pct = Number(preset.value);
                      const isActive = discountPercent === pct;
                      return (
                        <button
                          key={preset.id ?? preset.name ?? pct}
                          type="button"
                          className={`badge badge-md cursor-pointer select-none px-2 py-2 transition ${isActive ? 'badge-primary' : 'badge-outline'}`}
                          onClick={() => handleChange('discount', String(pct))}
                          title={preset.name ? `Internal: ${preset.name}` : undefined}
                        >
                          <span className="text-[10px]">{preset.label}</span>
                        </button>
                      );
                    })
                  : [10, 20, 30, 40].map((preset) => {
                      const isActive = discountPercent === preset;
                      return (
                        <button
                          key={preset}
                          type="button"
                          className={`badge badge-md cursor-pointer select-none px-2 py-2 transition ${isActive ? 'badge-primary' : 'badge-outline'}`}
                          onClick={() => handleChange('discount', String(preset))}
                        >
                          {preset}%
                        </button>
                      );
                    })}
              </div>

              <div className="flex flex-1 items-center gap-1.5 self-end">
                <div className="rounded-lg bg-sky-500 px-3 py-1.5">
                  <p className="text-[9px] font-semibold uppercase tracking-wide text-sky-100">Items Total</p>
                  <p className="text-xs font-bold text-white">{currencyFormatter.format(medicinesTotal)}</p>
                </div>
                <div className="rounded-lg bg-amber-500 px-3 py-1.5">
                  <p className="text-[9px] font-semibold uppercase tracking-wide text-amber-100">Discount</p>
                  <p className="text-xs font-bold text-white">{currencyFormatter.format(discountAmount)}</p>
                </div>
                {settings.shop_type === 'spare' && (
                  <div className="rounded-lg bg-slate-700 px-3 py-1.5">
                    <p className="text-[9px] font-semibold uppercase tracking-wide text-slate-200">Service</p>
                    <p className="text-xs font-bold text-white">{currencyFormatter.format(serviceCharge)}</p>
                  </div>
                )}
                <div className="rounded-lg bg-emerald-600 px-3 py-1.5">
                  <p className="text-[9px] font-semibold uppercase tracking-wide text-emerald-100">Final Total</p>
                  <p className="text-xs font-bold text-white">{currencyFormatter.format(finalTotal)}</p>
                </div>

                <div className="ml-auto flex items-center gap-2">
                  <button type="submit" data-direct-sale-submit className="btn btn-primary gap-2 rounded-xl px-6 h-auto py-2" disabled={isSaving}>
                    {isSaving ? (
                      <><span className="loading loading-spinner loading-sm"></span> Completing...</>
                    ) : (
                      <div className="flex flex-col items-center leading-tight">
                        <span className="inline-flex items-center gap-1.5 text-sm font-bold"><Receipt size={14} /> Complete Sale</span>
                        <span className="text-sm font-semibold opacity-90">{currencyFormatter.format(finalTotal)}</span>
                      </div>
                    )}
                  </button>
                  {cartItems.length > 0 && (
                    <button
                      type="button"
                      className="inline-flex items-center gap-1.5 btn rounded-xl border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100"
                      onClick={() => handleChange('medicines', [])}
                    >
                      <Trash2 size={15} /> Clear cart
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </form>

    </section>

    {showAddItemModal && createPortal(
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      >
        <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
            <h2 className="text-sm font-semibold text-slate-800">Add new item</h2>
            <button type="button" onClick={() => setShowAddItemModal(false)}
              className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 text-slate-400 hover:bg-slate-100">
              <X size={14} />
            </button>
          </div>
          <form className="p-5 space-y-3" onSubmit={handleAddItemSubmit}>
            {addItemError && (
              <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{addItemError}</p>
            )}

            {/* Item name with searchable dropdown */}
            <div>
              <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-400">Item name *</span>
              <div className="relative">
                <input
                  ref={addItemNameRef}
                  type="text"
                  className="input input-bordered input-sm w-full pr-16"
                  value={addItemSelectedMedicine ? addItemSelectedMedicine.name : addItemNameQuery}
                  onChange={(e) => {
                    setAddItemSelectedMedicine(null);
                    setAddItemNameQuery(e.target.value);
                    setAddItemHighlight(-1);
                    setAddItemDropdownOpen(true);
                  }}
                  onFocus={() => setAddItemDropdownOpen(true)}
                  onBlur={() => setTimeout(() => setAddItemDropdownOpen(false), 150)}
                  onKeyDown={handleAddItemNameKeyDown}
                  placeholder="Search or type new item name…"
                  autoFocus
                />
                {addItemSelectedMedicine && (
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700">existing</span>
                )}
                {addItemDropdownOpen && addItemTotalRows > 0 && (
                  <ul className="absolute z-10 mt-1 w-full rounded-xl border border-slate-200 bg-white shadow-lg overflow-hidden max-h-52 overflow-y-auto">
                    {addItemMedicineSuggestions.map((m, idx) => (
                      <li key={m.id}>
                        <button
                          type="button"
                          className={`w-full px-3 py-2 text-left text-sm text-slate-700 ${addItemHighlight === idx ? 'bg-blue-50' : 'hover:bg-slate-50'}`}
                          onMouseEnter={() => setAddItemHighlight(idx)}
                          onMouseDown={() => selectAddItemRow(idx)}
                        >
                          {m.name}
                          <span className="ml-2 text-[10px] text-slate-400">{m.brands?.length || 0} variant(s)</span>
                        </button>
                      </li>
                    ))}
                    {addItemHasCreateRow && (
                      <li>
                        <button
                          type="button"
                          className={`w-full px-3 py-2 text-left text-sm font-semibold text-blue-700 border-t border-slate-100 ${addItemHighlight === addItemMedicineSuggestions.length ? 'bg-blue-50' : 'hover:bg-blue-50'}`}
                          onMouseEnter={() => setAddItemHighlight(addItemMedicineSuggestions.length)}
                          onMouseDown={() => selectAddItemRow(addItemMedicineSuggestions.length)}
                        >
                          + Create new: &ldquo;{addItemNameQuery.trim()}&rdquo;
                        </button>
                      </li>
                    )}
                  </ul>
                )}
              </div>
            </div>

            {/* Brand / variant */}
            <label className="block">
              <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-400">Brand / variant *</span>
              <input
                type="text"
                className="input input-bordered input-sm w-full"
                value={addItemForm.brandName}
                onChange={(e) => setAddItemForm((p) => ({ ...p, brandName: e.target.value }))}
                placeholder="e.g. 250mg Capsule"
              />
            </label>

            {/* Price + Stock */}
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-400">Price *</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="input input-bordered input-sm w-full"
                  value={addItemForm.price}
                  onChange={(e) => setAddItemForm((p) => ({ ...p, price: e.target.value }))}
                  placeholder="0.00"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-400">Stock qty</span>
                <input
                  type="number"
                  min="0"
                  step="1"
                  className="input input-bordered input-sm w-full"
                  value={addItemForm.stock}
                  onChange={(e) => setAddItemForm((p) => ({ ...p, stock: e.target.value }))}
                  placeholder="0"
                />
              </label>
            </div>

            {/* Barcode + Expiry */}
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-400">Barcode</span>
                <input
                  type="text"
                  className="input input-bordered input-sm w-full"
                  value={addItemForm.barcode}
                  onChange={(e) => setAddItemForm((p) => ({ ...p, barcode: e.target.value }))}
                  placeholder="Optional"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-400">Expiry date</span>
                <input
                  type="date"
                  className="input input-bordered input-sm w-full"
                  value={addItemForm.expiryDate}
                  onChange={(e) => setAddItemForm((p) => ({ ...p, expiryDate: e.target.value }))}
                />
              </label>
            </div>

            {/* Supplier */}
            <label className="block">
              <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-400">Supplier</span>
              <select
                className="select select-bordered select-sm w-full"
                value={addItemForm.supplierId}
                onChange={(e) => setAddItemForm((p) => ({ ...p, supplierId: e.target.value }))}
              >
                <option value="">— None —</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </label>

            <div className="flex justify-end gap-2 pt-1">
              <button type="button" className="btn btn-sm btn-ghost" onClick={() => setShowAddItemModal(false)}>Cancel</button>
              <button type="submit" className="btn btn-sm btn-primary" disabled={addItemSaving}>
                {addItemSaving ? <><span className="loading loading-spinner loading-xs" /> Saving…</> : <><Plus size={13} /> Add item</>}
              </button>
            </div>
          </form>
        </div>
      </div>,
      document.body
    )}
    </>
  );
};

export default DirectSalesPage;
