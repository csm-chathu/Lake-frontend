import React, { useCallback, useEffect, useMemo, useState } from 'react';
import AppointmentMedicineSelector, { calculateMedicinesTotal } from '../components/AppointmentMedicineSelector.jsx';
import InvoicePrintModal from '../components/InvoicePrintModal.jsx';
import useEntityApi from '../hooks/useEntityApi.js';

const currencyFormatter = new Intl.NumberFormat('en-LK', { style: 'currency', currency: 'LKR' });
const DISCOUNT_PRESETS = [10, 20, 30, 40];

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
  paymentType: 'cash',
  paymentStatus: 'paid'
});

const DirectSalesPage = () => {
  const directSalesApi = useEntityApi('direct-sales');
  const medicinesApi = useEntityApi('medicines');

  const { createItem: createDirectSale, error: directSalesError, refresh: refreshDirectSales } = directSalesApi;
  const { items: medicines, loading: medicinesLoading, error: medicinesError } = medicinesApi;
  const { refresh: refreshMedicines } = medicinesApi;

  const [formState, setFormState] = useState(createEmptySale);
  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [formError, setFormError] = useState('');
  const [catalogSearch, setCatalogSearch] = useState('');
  const [catalogHint, setCatalogHint] = useState('');
  const [invoiceModal, setInvoiceModal] = useState({ open: false, data: null });

  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => {
        setSuccessMessage('');
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

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
          barcode: typeof brand.barcode === 'string' ? brand.barcode.trim() : '',
          barcodes: Array.from(
            new Set(
              [
                typeof brand.barcode === 'string' ? brand.barcode.trim() : '',
                ...((Array.isArray(brand.batches)
                  ? brand.batches
                  : []
                )
                  .map((batch) => (typeof batch?.barcode === 'string' ? batch.barcode.trim() : ''))
                  .filter(Boolean))
              ].filter(Boolean)
            )
          ),
          medicineName: medicine.name,
          brandName: brand.name,
          stock: totalStock,
          image_url: brand.image_url || null
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
  const finalTotal = Math.max(0, medicinesTotal - discountAmount);

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

  const filteredCatalogOptions = useMemo(() => {
    const query = catalogSearch.trim().toLowerCase();
    const source = Array.isArray(brandOptions) ? brandOptions : [];

    if (!query) {
      return source.slice(0, 48);
    }

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
        return {
          ...prev,
          medicines: [
            ...rows,
            {
              medicineBrandId: option.value,
              quantity: String(safeAddQty),
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
        return { ...row, quantity: String(nextQty) };
      });

      return { ...prev, medicines: nextRows };
    });

    return true;
  }, []);

  const handleCatalogSearchSubmit = (event) => {
    if (event.key !== 'Enter') {
      return;
    }

    event.preventDefault();
    const normalized = catalogSearch.trim().toLowerCase();
    if (!normalized) {
      return;
    }

    const exactBarcodeMatch = barcodeLookup.get(normalized);
    if (exactBarcodeMatch) {
      const added = addBrandOptionToSale(exactBarcodeMatch, 1);
      if (added) {
        setCatalogHint(`Added: ${exactBarcodeMatch.label}`);
      }
      setCatalogSearch('');
      return;
    }

    const exactLabelMatch = brandOptions.find((option) => option.label.toLowerCase() === normalized);
    if (exactLabelMatch) {
      const added = addBrandOptionToSale(exactLabelMatch, 1);
      if (added) {
        setCatalogHint(`Added: ${exactLabelMatch.label}`);
      }
      setCatalogSearch('');
      return;
    }

    setCatalogHint('No barcode match found. Try clicking an item tile.');
  };

  const handleChange = (name, value) => {
    setFormState((prev) => ({ ...prev, [name]: value }));
  };

  const closeInvoiceModal = useCallback(() => {
    setInvoiceModal({ open: false, data: null });
  }, []);

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

    setIsSaving(true);
    try {
      const result = await createDirectSale(payload);
      if (result.success) {
        const saleId = result.data?.id || null;
        const referenceName = result.data?.saleReference || formState.saleRef || `Sale #${saleId || ''}`;
        const saleLineItems = (formState.medicines || [])
          .map((row) => {
            const option = brandLookup.get(String(row.medicineBrandId));
            const quantity = Number.parseFloat(row.quantity) || 0;
            const unitPrice = option ? Number(option.price) || 0 : 0;
            return {
              label: option?.label || row.label || 'Item',
              qty: quantity,
              unit: unitPrice
            };
          })
          .filter((item) => item.qty > 0);

        setInvoiceModal({
          open: true,
          data: {
            invoiceReference: referenceName,
            doctorCharge: 0,
            surgeryCharge: 0,
            otherCharge: 0,
            medicinesSubtotal: medicinesTotal,
            discount: discountAmount,
            estimated: Number(Math.max(medicinesTotal - discountAmount, 0).toFixed(2)),
            patientName: referenceName,
            appointmentId: null,
            medicines: result.data?.items || formState.medicines || [],
            lineItems: saleLineItems
          }
        });
        setSuccessMessage('Direct sale completed successfully.');
        setFormState(createEmptySale());
        refreshMedicines();
        refreshDirectSales();
      } else {
        setFormError(result.message || 'Unable to complete direct sale.');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const combinedError = formError || directSalesError || medicinesError;

  return (
    <section className="space-y-6 mt-0">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-lg font-semibold text-slate-800">Direct Sale POS</h1>
          <p className="text-xs text-slate-500">Sell medicines, shampoo, and retail items directly using appointment billing records.</p>
        </div>
      </div>

      {successMessage && (
        <div className="alert alert-success shadow-sm">
          <span>{successMessage}</span>
        </div>
      )}

      {combinedError && (
        <div className="alert alert-error shadow-sm">
          <span>{combinedError}</span>
        </div>
      )}

      <form className="grid gap-4 xl:grid-cols-12" onSubmit={handleSubmit} onKeyDown={(e) => { if (e.key === 'Enter' && e.target.type !== 'submit') e.preventDefault(); }}>
        <div className="space-y-4 xl:col-span-6">
          <div className="rounded-2xl border border-base-300 bg-base-100 p-4 shadow-sm">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">Item catalog</h2>
              <span className="text-xs text-slate-500">Click a tile or scan barcode then press Enter</span>
            </div>

            <div className="mb-3">
              <input
                type="text"
                className="input input-bordered input-sm w-full"
                placeholder="Search item name / brand / barcode"
                value={catalogSearch}
                onChange={(event) => {
                  setCatalogSearch(event.target.value);
                  if (catalogHint) {
                    setCatalogHint('');
                  }
                }}
                onKeyDown={handleCatalogSearchSubmit}
              />
              {catalogHint && <p className="mt-1 text-xs text-emerald-600">{catalogHint}</p>}
            </div>

            {filteredCatalogOptions.length === 0 ? (
              <div className="rounded-lg border border-dashed border-base-300 bg-base-50 p-4 text-sm text-slate-500">
                No matching items found.
              </div>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {filteredCatalogOptions.map((option) => (
                  <button
                    key={`tile-${option.value}`}
                    type="button"
                    className={`relative rounded-xl border p-3 text-left transition ${(Number(option.stock) || 0) > 0
                      ? 'border-base-300 bg-base-100 hover:border-primary hover:bg-primary/5'
                      : 'border-rose-200 bg-rose-50 opacity-80'}`}
                    onClick={() => {
                      const added = addBrandOptionToSale(option, 1);
                      if (added) {
                        setCatalogHint(`Added: ${option.label}`);
                      }
                    }}
                    disabled={(Number(option.stock) || 0) <= 0}
                  >
                    <div className={option.image_url ? 'pr-16' : ''}>
                      <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold text-slate-800 line-clamp-2">{option.medicineName}</p>
                      <span className="text-xs font-semibold text-primary">{currencyFormatter.format(option.price)}</span>
                      </div>
                      <p className="mt-1 text-xs text-slate-600">{option.brandName}</p>
                      <p className="mt-1 text-[11px] text-slate-500">
                        {option.barcode ? `Barcode: ${option.barcode}` : 'No barcode'}
                      </p>
                      <p className="mt-1 text-[11px] font-medium text-slate-600">Qty: {Number(option.stock) || 0}</p>
                      {(Number(option.stock) || 0) <= 0 && (
                        <p className="mt-1 text-[11px] font-semibold text-rose-700">Out of stock</p>
                      )}
                    </div>
                    {option.image_url && (
                      <div className="absolute bottom-3 right-3 h-14 w-14 bg-base-200 rounded border border-base-300 overflow-hidden flex items-center justify-center">
                        <img
                          src={option.image_url}
                          alt={`${option.medicineName} - ${option.brandName}`}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

        </div>

        <aside className="xl:col-span-6">
          <div className="sticky top-4 space-y-4 rounded-2xl border border-base-300 bg-base-100 p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">Calculations</h2>
              <div className="text-right">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Ref</p>
                <p className="text-xs font-bold text-primary">{formState.saleRef}</p>
              </div>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-600">Cart items</h3>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500">Adjust selected quantities</span>
                  {(formState.medicines || []).length > 0 && (
                    <button
                      type="button"
                      className="btn btn-xs btn-error btn-outline gap-1"
                      onClick={() => handleChange('medicines', [])}
                    >
                      🗑️ Clear
                    </button>
                  )}
                </div>
              </div>
              <AppointmentMedicineSelector
                value={formState.medicines}
                onChange={(rows) => handleChange('medicines', rows)}
                brandOptions={brandOptions}
                brandLookup={brandLookup}
                loading={medicinesLoading}
                addButtonLabel="Add item"
                hideAddButton
                lockBrandSelection
                quantityStep="1"
                quantityMin="1"
              />
            </div>

            <div className="grid gap-3 md:grid-cols-3">

              <label className="form-control w-full">
                <span className="label-text text-xs font-semibold uppercase tracking-wide text-slate-600">Discount (%)</span>
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


              <label className="form-control w-full">
                <span className="label-text text-xs font-semibold uppercase tracking-wide text-slate-600">Payment type</span>
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

              <label className="form-control w-full">
                <span className="label-text text-xs font-semibold uppercase tracking-wide text-slate-600">Payment status</span>
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


            </div>

            <div className="flex flex-wrap gap-2">
              {DISCOUNT_PRESETS.map((preset) => {
                const isActive = discountPercent === preset;
                return (
                  <button
                    key={preset}
                    type="button"
                    className={`badge badge-md cursor-pointer select-none px-3 py-2 transition ${isActive ? 'badge-primary' : 'badge-outline'}`}
                    onClick={() => handleChange('discount', String(preset))}
                  >
                    {preset}%
                  </button>
                );
              })}
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-xl bg-sky-500 p-3 flex flex-col gap-1">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-sky-100">Items total</span>
                <span className="text-base font-bold text-white">{currencyFormatter.format(medicinesTotal)}</span>
              </div>
              <div className="rounded-xl bg-amber-500 p-3 flex flex-col gap-1">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-amber-100">Discount</span>
                <span className="text-base font-bold text-white">-{currencyFormatter.format(discountAmount)}</span>
                <span className="text-[10px] font-semibold text-amber-100">{discountPercent}%</span>
              </div>
              <div className="rounded-xl bg-emerald-600 p-3 flex flex-col gap-1">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-emerald-100">Final total</span>
                <span className="text-base font-bold text-white flex items-center gap-1">💰 {currencyFormatter.format(finalTotal)}</span>
              </div>
            </div>

            <button type="submit" className="btn btn-primary w-full gap-2" disabled={isSaving}>
              {isSaving ? (
                <><span className="loading loading-spinner loading-sm"></span> Completing sale…</>
              ) : (
                <>🧾 Complete Sale</>
              )}
            </button>
          </div>
        </aside>
      </form>

      <InvoicePrintModal
        open={invoiceModal.open}
        invoice={invoiceModal.data}
        onClose={closeInvoiceModal}
        currencyFormatter={currencyFormatter}
      />
    </section>
  );
};

export default DirectSalesPage;
