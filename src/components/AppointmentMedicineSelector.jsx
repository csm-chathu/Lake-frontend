import React from 'react';
import { createPortal } from 'react-dom';

const currencyFormatter = new Intl.NumberFormat('en-LK', { style: 'currency', currency: 'LKR' });
const defaultOverlayStyle = { left: 0, top: 0, width: 0, openUpward: false };

const DropdownPortal = ({ children, style }) => {
  if (typeof document === 'undefined') return null;

  const posStyle = style.openUpward
    ? { position: 'fixed', left: style.left, bottom: style.bottom, minWidth: style.width, width: style.width }
    : { position: 'fixed', left: style.left, top: style.top, minWidth: style.width, width: style.width };

  return createPortal(
    <ul
      className="z-50 max-h-60 overflow-y-auto rounded-xl border border-base-300 bg-base-100 shadow-xl"
      style={posStyle}
    >
      {children}
    </ul>,
    document.body
  );
};

export const calculateMedicinesTotal = (rows = [], brandLookup = new Map()) => {
  const total = rows.reduce((sum, row) => {
    const option = brandLookup.get(String(row.medicineBrandId));
    if (!option) {
      return sum;
    }
    // allow fractional quantities (e.g. 0.5, 0.2)
    const quantity = Number.parseFloat(row.quantity) || 0;
    if (quantity <= 0) {
      return sum;
    }
    const unitPrice = Number(option.price) || 0;
    const conversion = Number(option.conversion) || 1;
    return sum + (unitPrice / conversion) * quantity;
  }, 0);

  return Number(total.toFixed(2));
};

const AppointmentMedicineSelector = React.forwardRef(function AppointmentMedicineSelector({
  value,
  onChange,
  brandOptions,
  brandLookup,
  loading = false,
  addButtonLabel = 'Add medicine',
  hideAddButton = false,
  lockBrandSelection = false,
  quantityStep = '0.1',
  quantityMin = '0'
}, ref) {
  const rows = Array.isArray(value) ? value : [];
  const hasBrandOptions = brandOptions.length > 0;
  const [activeIndex, setActiveIndex] = React.useState(null);
  const [highlightedOptionIndex, setHighlightedOptionIndex] = React.useState(-1);
  const [overlayStyle, setOverlayStyle] = React.useState(defaultOverlayStyle);
  const blurTimeoutRef = React.useRef(null);
  const inputRefs = React.useRef([]);

  React.useImperativeHandle(ref, () => ({
    focusFirst: () => {
      const el = inputRefs.current[0];
      if (el) { el.focus(); el.select(); }
    }
  }));

  const updateOverlay = React.useCallback(
    (index) => {
      if (typeof window === 'undefined') return;
      const element = inputRefs.current[index];
      if (!element) return;
      const rect = element.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      const openUpward = spaceBelow < 240 && spaceAbove > spaceBelow;
      setOverlayStyle({
        left: rect.left,
        top: openUpward ? undefined : rect.bottom + 4,
        bottom: openUpward ? (window.innerHeight - rect.top + 4) : undefined,
        width: rect.width,
        openUpward
      });
    },
    []
  );

  React.useEffect(
    () => () => {
      if (blurTimeoutRef.current) {
        clearTimeout(blurTimeoutRef.current);
      }
    },
    []
  );

  React.useEffect(() => {
    if (activeIndex !== null) {
      updateOverlay(activeIndex);
    }
  }, [activeIndex, updateOverlay]);

  React.useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    const handleViewportChange = () => {
      if (activeIndex !== null) {
        updateOverlay(activeIndex);
      }
    };

    window.addEventListener('scroll', handleViewportChange, true);
    window.addEventListener('resize', handleViewportChange);

    return () => {
      window.removeEventListener('scroll', handleViewportChange, true);
      window.removeEventListener('resize', handleViewportChange);
    };
  }, [activeIndex, updateOverlay]);

  inputRefs.current.length = rows.length;

  const rowsWithComputed = rows.map((row) => {
    const option = brandLookup.get(String(row.medicineBrandId));
    const quantity = Number.parseFloat(row.quantity) || 0;
    const originalUnitPrice = option ? Number(option.price) || 0 : 0;
    const conversion = option ? Number(option.conversion) || 1 : 1;
    const unitPrice = originalUnitPrice / conversion;
    const fallbackLabel = [option?.medicine?.name, option?.name].filter(Boolean).join(' — ');
    const query = typeof row.query === 'string' && row.query.length > 0 ? row.query : fallbackLabel || row.label || '';
    const normalizedQuery = query.trim().toLowerCase();
    const filteredOptions = hasBrandOptions
      ? brandOptions
          .filter((candidate) =>
            normalizedQuery ? candidate.label.toLowerCase().includes(normalizedQuery) : true
          )
          .slice(0, 10)
      : [];

    const selectedLabel = option?.label || row.label || fallbackLabel || '';
    const [parsedMedicineName = '', parsedBrandName = ''] = String(selectedLabel).split(' — ');

    return {
      ...row,
      option,
      quantity,
      unitPrice,
      originalUnitPrice,
      totalPrice: Number((unitPrice * quantity).toFixed(2)),
      label: option ? option.label : row.label || fallbackLabel || '',
      query,
      filteredOptions,
      medicineName: option?.medicineName || option?.medicine?.name || parsedMedicineName || '—',
      brandName: option?.brandName || option?.name || parsedBrandName || '—'
    };
  });

  const medicinesTotal = calculateMedicinesTotal(rows, brandLookup);

  const focusRow = (index) => {
    if (blurTimeoutRef.current) {
      clearTimeout(blurTimeoutRef.current);
    }
    setActiveIndex(index);
    setHighlightedOptionIndex(-1);
    updateOverlay(index);
  };

  const scheduleBlur = () => {
    if (blurTimeoutRef.current) {
      clearTimeout(blurTimeoutRef.current);
    }
    blurTimeoutRef.current = setTimeout(() => {
      setActiveIndex(null);
      setOverlayStyle(defaultOverlayStyle);
    }, 120);
  };

  const handleAddRow = () => {
    if (!hasBrandOptions) {
      return;
    }
    const nextRows = [...rows, { medicineBrandId: '', quantity: '1', label: '', query: '' }];
    onChange(nextRows);
    const nextIndex = nextRows.length - 1;
    setActiveIndex(nextIndex);
    setTimeout(() => {
      const element = inputRefs.current[nextIndex];
      if (element) {
        element.focus();
        updateOverlay(nextIndex);
      }
    }, 0);
  };

  const handleUpdateRow = (index, changes) => {
    const next = rows.map((row, idx) => {
      if (idx !== index) {
        return row;
      }
      const updated = { ...row, ...changes };

      if (Object.prototype.hasOwnProperty.call(changes, 'medicineBrandId')) {
        const option = brandLookup.get(String(updated.medicineBrandId));
        if (option) {
          updated.label = option.label;
          updated.query = option.label;
        } else if (!Object.prototype.hasOwnProperty.call(changes, 'label')) {
          updated.label = '';
        }
      }

      if (
        Object.prototype.hasOwnProperty.call(changes, 'query') &&
        !Object.prototype.hasOwnProperty.call(changes, 'label')
      ) {
        updated.label = updated.query;
      }

      // Enforce integer-only quantities when quantityStep is "1"
      if (Object.prototype.hasOwnProperty.call(changes, 'quantity') && quantityStep === '1') {
        const parsed = Number.parseFloat(updated.quantity) || 0;
        updated.quantity = String(Math.max(0, Math.round(parsed)));
      }

      return updated;
    });

    onChange(next);
    if (activeIndex === index) {
      updateOverlay(index);
    }
  };

  const handleRemoveRow = (index) => {
    const next = rows.filter((_, idx) => idx !== index);
    onChange(next);
    setActiveIndex((current) => {
      if (current === null) {
        return current;
      }
      if (current === index) {
        setOverlayStyle(defaultOverlayStyle);
        return null;
      }
      if (current > index) {
        return current - 1;
      }
      return current;
    });
  };

  const handleSearchChange = (index, value) => {
    const currentRow = rows[index] || {};
    const existingOption = brandLookup.get(String(currentRow.medicineBrandId));
    const existingLabel = existingOption ? existingOption.label : currentRow.label || '';
    const updates = { query: value, label: value };

    if (value !== existingLabel) {
      updates.medicineBrandId = '';
    }

    handleUpdateRow(index, updates);
    if (activeIndex === index) {
      updateOverlay(index);
    }
  };

  const handleSelectOption = (index, option) => {
    let defaultQuantity;
    if (Array.isArray(option.doseSizes) && option.doseSizes.length > 0) {
      defaultQuantity = String(option.doseSizes[0]);
    } else {
      const labelLower = (option.label || '').toLowerCase();
      const isVaccine = labelLower.includes('vaccine');
      const isMeasuredInMl = labelLower.includes(' ml') || labelLower.includes('ml ');
      defaultQuantity = (isVaccine || isMeasuredInMl) ? '0.5' : '1';
    }

    handleUpdateRow(index, {
      medicineBrandId: option.value,
      label: option.label,
      query: option.label,
      quantity: defaultQuantity
    });
    setActiveIndex(null);
    setOverlayStyle(defaultOverlayStyle);
  };

  const handleInputKeyDown = (event, rowIndex, row) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setHighlightedOptionIndex((prev) => Math.min(prev + 1, row.filteredOptions.length - 1));
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setHighlightedOptionIndex((prev) => Math.max(prev - 1, 0));
      return;
    }
    if (event.key === 'Escape') {
      setActiveIndex(null);
      setHighlightedOptionIndex(-1);
      setOverlayStyle(defaultOverlayStyle);
      return;
    }
    if (event.key !== 'Enter') {
      return;
    }

    const option = highlightedOptionIndex >= 0
      ? row.filteredOptions[highlightedOptionIndex]
      : row.filteredOptions[0];
    if (!option) return;

    event.preventDefault();
    handleSelectOption(rowIndex, option);
    setHighlightedOptionIndex(-1);
  };

  const isFractional = quantityStep !== '1';

  return (
    <div className="rounded-xl border border-base-200 bg-white p-2">
      <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-medium text-slate-600">Items dispensed</p>
        <div className="flex items-center gap-2">
          {rowsWithComputed.length > 0 && brandOptions.length > 0 && (
            <span className="text-xs font-semibold text-slate-500">
              Subtotal: {currencyFormatter.format(medicinesTotal)}
            </span>
          )}
          {!hideAddButton && (
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-md border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700 hover:bg-blue-100 transition disabled:opacity-40"
              onClick={handleAddRow}
              disabled={!hasBrandOptions || loading}
            >
              + {addButtonLabel}
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="rounded-lg border border-dashed border-base-300 bg-white px-3 py-2 text-center text-xs text-slate-500">
          Loading available medicines…
        </div>
      ) : rowsWithComputed.length === 0 ? (
        <div className="rounded-lg border border-dashed border-base-300 bg-white px-3 py-2 text-xs text-slate-400 text-center">
          {hasBrandOptions
            ? 'No medicines added yet — click + to add.'
            : 'No medicines configured yet. Head to the Medicines tab to add inventory.'}
        </div>
      ) : (
        <div className="space-y-1.5">
          {rowsWithComputed.map((row, index) => (
            <div key={`${row.medicineBrandId || 'new'}-${index}`} className="rounded-lg border border-slate-100 bg-slate-50 p-1.5">
              {/* Top row: search/name + qty controls + total + delete */}
              <div className="flex items-center gap-2">
                {/* Medicine name / search */}
                <div className="relative min-w-0 flex-1">
                  {lockBrandSelection ? (
                    <div>
                      <span className="text-xs font-semibold text-slate-800">
                        {row.option?.label || row.label || '—'}
                      </span>
                      {row.option && (
                        <span className="ml-1.5 text-[11px] text-slate-400">
                          {currencyFormatter.format(row.unitPrice)} each
                        </span>
                      )}
                    </div>
                  ) : (
                    <>
                      <input
                        type="text"
                        ref={(element) => { inputRefs.current[index] = element; }}
                        className="input input-sm input-bordered w-full bg-white text-sm"
                        placeholder={hasBrandOptions ? 'Search medicine…' : 'No brands available'}
                        value={row.query || ''}
                        onFocus={() => focusRow(index)}
                        onBlur={scheduleBlur}
                        onChange={(event) => handleSearchChange(index, event.target.value)}
                        onKeyDown={(event) => handleInputKeyDown(event, index, row)}
                        readOnly={!hasBrandOptions && Boolean(row.label)}
                        disabled={!hasBrandOptions && !row.label}
                      />
                      {activeIndex === index && hasBrandOptions && overlayStyle.width > 0 && (
                        <DropdownPortal style={overlayStyle}>
                          {row.filteredOptions.map((option, optIdx) => {
                            const isSelected = option.value === row.medicineBrandId;
                            const isHighlighted = optIdx === highlightedOptionIndex;
                            return (
                              <li key={option.value}>
                                <button
                                  type="button"
                                  className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm transition ${
                                    isHighlighted ? 'bg-base-300 text-base-content' : isSelected ? 'bg-primary/10 text-primary' : 'hover:bg-base-200'
                                  }`}
                                  onMouseDown={(event) => event.preventDefault()}
                                  onMouseEnter={() => setHighlightedOptionIndex(optIdx)}
                                  onClick={() => { handleSelectOption(index, option); setHighlightedOptionIndex(-1); }}
                                >
                                  <span className="flex-1">{option.label}</span>
                                  <span className="text-xs text-slate-500">
                                    {Number.isFinite(option.price)
                                      ? currencyFormatter.format((Number(option.price) || 0) / (Number(option.conversion) || 1))
                                      : '—'}
                                  </span>
                                </button>
                              </li>
                            );
                          })}
                          {row.filteredOptions.length === 0 && (
                            <li className="px-3 py-2 text-sm text-slate-500">No matches found.</li>
                          )}
                        </DropdownPortal>
                      )}
                    </>
                  )}
                  {row.option && (
                    <div className="mt-0.5 text-[11px] text-slate-400">
                      {currencyFormatter.format(row.unitPrice)} each
                      {row.option.scale && row.option.scale !== 'unit' && (
                        <span className="ml-1.5 rounded bg-slate-100 px-1 py-0.5 font-medium text-slate-500">{row.option.scale}</span>
                      )}
                    </div>
                  )}
                </div>

                {/* Quantity controls */}
                <div className="flex shrink-0 items-center gap-1">
                  {isFractional ? (
                    <input
                      type="number"
                      min={quantityMin}
                      step={quantityStep}
                      className="input input-sm w-16 text-center text-sm font-medium"
                      value={row.quantity || ''}
                      onChange={(event) => handleUpdateRow(index, { quantity: event.target.value })}
                    />
                  ) : (
                    <>
                      <button
                        type="button"
                        className="flex h-5 w-5 items-center justify-center rounded border border-slate-200 bg-white text-xs font-bold text-slate-600 hover:bg-slate-100 transition disabled:opacity-30"
                        onClick={() => {
                          const current = Number.parseFloat(row.quantity) || 0;
                          if (current > 1) handleUpdateRow(index, { quantity: String(current - 1) });
                        }}
                        disabled={Number.parseFloat(row.quantity) <= 1}
                      >
                        −
                      </button>
                      <span className="min-w-[1.5rem] text-center text-xs font-semibold text-slate-700">
                        {row.quantity || 0}
                      </span>
                      <button
                        type="button"
                        className="flex h-5 w-5 items-center justify-center rounded border border-slate-200 bg-white text-xs font-bold text-slate-600 hover:bg-slate-100 transition"
                        onClick={() => {
                          const current = Number.parseFloat(row.quantity) || 0;
                          handleUpdateRow(index, { quantity: String(current + 1) });
                        }}
                      >
                        +
                      </button>
                    </>
                  )}
                </div>

                {/* Line total */}
                <span className="shrink-0 w-20 text-right text-xs font-semibold text-slate-700">
                  {row.option && row.quantity > 0 ? currencyFormatter.format(row.totalPrice) : '—'}
                </span>

                {/* Delete */}
                <button
                  type="button"
                  className="shrink-0 flex h-5 w-5 items-center justify-center rounded text-slate-300 hover:bg-rose-50 hover:text-rose-500 transition"
                  onClick={() => handleRemoveRow(index)}
                  aria-label="Remove"
                >
                  ×
                </button>
              </div>

              {/* Dose chips */}
              {row.option && Array.isArray(row.option.doseSizes) && row.option.doseSizes.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {row.option.doseSizes.map((size, idx) => {
                    const sizeLabel = `${size}${row.option.scale && row.option.scale !== 'unit' ? row.option.scale : ''}`;
                    const isActive = String(row.quantity) === String(size);
                    return (
                      <button
                        key={idx}
                        type="button"
                        className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold transition ${
                          isActive
                            ? 'border-blue-500 bg-blue-600 text-white'
                            : 'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100'
                        }`}
                        onClick={() => handleUpdateRow(index, { quantity: String(size) })}
                      >
                        {sizeLabel}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
});

export default AppointmentMedicineSelector;
