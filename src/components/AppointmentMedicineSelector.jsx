import React from 'react';
import { createPortal } from 'react-dom';

const currencyFormatter = new Intl.NumberFormat('en-LK', { style: 'currency', currency: 'LKR' });
const plainNumberFormatter = new Intl.NumberFormat('en-LK', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});
const defaultOverlayStyle = { left: 0, top: 0, width: 0 };

const DropdownPortal = ({ children, style }) => {
  if (typeof document === 'undefined') {
    return null;
  }

  return createPortal(
    <ul
      className="z-50 max-h-60 overflow-y-auto rounded-xl border border-base-300 bg-base-100 shadow-xl"
      style={{
        position: 'absolute',
        left: style.left,
        top: style.top,
        minWidth: style.width,
        width: style.width
      }}
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

const AppointmentMedicineSelector = ({
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
}) => {
  const rows = Array.isArray(value) ? value : [];
  const hasBrandOptions = brandOptions.length > 0;
  const [activeIndex, setActiveIndex] = React.useState(null);
  const [overlayStyle, setOverlayStyle] = React.useState(defaultOverlayStyle);
  const blurTimeoutRef = React.useRef(null);
  const inputRefs = React.useRef([]);

  const updateOverlay = React.useCallback(
    (index) => {
      if (typeof window === 'undefined') {
        return;
      }
      const element = inputRefs.current[index];
      if (!element) {
        return;
      }
      const rect = element.getBoundingClientRect();
      setOverlayStyle({
        left: rect.left + window.scrollX,
        top: rect.bottom + window.scrollY + 4,
        width: rect.width
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
    // Determine default quantity based on medicine type
    const labelLower = (option.label || '').toLowerCase();
    const isVaccine = labelLower.includes('vaccine');
    const isMeasuredInMl = labelLower.includes(' ml') || labelLower.includes('ml ');
    const defaultQuantity = (isVaccine || isMeasuredInMl) ? '0.5' : '1';

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
    if (event.key !== 'Enter') {
      return;
    }

    const [firstOption] = row.filteredOptions;
    if (!firstOption) {
      return;
    }

    event.preventDefault();
    handleSelectOption(rowIndex, firstOption);
  };

  return (
    <div className="rounded-xl border border-base-200 bg-white p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-slate-700">Item dispensed</p>
          <p className="text-xs text-slate-500">Track dispensed brands to include them in billing.</p>
        </div>
        {!hideAddButton && (
          <button
            type="button"
            className="btn btn-sm btn-outline"
            onClick={handleAddRow}
            disabled={!hasBrandOptions || loading}
          >
            {addButtonLabel}
          </button>
        )}
      </div>

      {loading ? (
        <div className="rounded-xl border border-dashed border-base-300 bg-white p-4 text-center text-sm text-slate-500">
          Loading available medicines…
        </div>
      ) : rowsWithComputed.length === 0 ? (
        <div className="rounded-xl border border-dashed border-base-300 bg-white p-4 text-sm text-slate-500">
          {hasBrandOptions
            ? 'No medicines selected for this appointment.'
            : 'No medicines configured yet. Head to the Medicines tab to add inventory.'}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="table table-sm">
            <thead>
              <tr className="text-xs uppercase text-slate-500">
                <th className="text-left w-2/5">Brand</th>
                <th className="text-left">Scale</th>
                <th className="text-right">Unit price</th>
                <th className="w-28 text-right">Quantity</th>
                <th className="text-right">Line total</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rowsWithComputed.map((row, index) => (
                <tr key={`${row.medicineBrandId || 'new'}-${index}`}>
                  <td className="align-top">
                    {lockBrandSelection ? (
                      <div className="flex gap-2 items-start">
                        {row.option?.image_url && (
                          <div className="flex-shrink-0 w-10 h-10 bg-base-200 rounded border border-base-300 overflow-hidden">
                            <img
                              src={row.option.image_url}
                              alt={row.option?.label}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        )}
                        <span className="text-sm font-medium text-slate-700">
                          {row.option?.label || row.label || '—'}
                          {row.option ? ` {${plainNumberFormatter.format(row.unitPrice)}}` : ''}
                        </span>
                      </div>
                    ) : (
                      <div className="relative">
                        {!hasBrandOptions && !row.label && (
                          <p className="mb-2 text-[11px] uppercase tracking-wide text-warning">
                            Brand catalog unavailable — add inventory first.
                          </p>
                        )}
                        <input
                          type="text"
                          ref={(element) => {
                            inputRefs.current[index] = element;
                          }}
                          className="input input-bordered input-sm w-full pr-12"
                          placeholder={
                            hasBrandOptions ? 'Search medicine brands' : 'No brands available'
                          }
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
                            {row.filteredOptions.map((option) => {
                              const isSelected = option.value === row.medicineBrandId;
                              return (
                                <li key={option.value}>
                                  <button
                                    type="button"
                                    className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm transition ${
                                      isSelected ? 'bg-primary/10 text-primary' : 'hover:bg-base-200'
                                    }`}
                                    onMouseDown={(event) => event.preventDefault()}
                                    onClick={() => handleSelectOption(index, option)}
                                  >
                                    <span className="flex-1">{option.label}</span>
                                    <span className="text-xs text-slate-500">
                                      {Number.isFinite(option.price)
                                        ? currencyFormatter.format(
                                        (Number(option.price) || 0) / (Number(option.conversion) || 1)
                                      )
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
                      </div>
                    )}
                  </td>
                  <td className="text-left align-top text-sm text-slate-600">
                    {row.option ? (
                      <div>
                        <span>{row.option.scale || '—'}</span>
                        {row.option.conversion > 1 && (
                          <div className="text-xs text-slate-400 font-normal">
                            (1 to {row.option.conversion})
                          </div>
                        )}
                      </div>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="text-right text-sm text-slate-600">
                    {row.option ? (
                      <div>
                        <span>{currencyFormatter.format(row.unitPrice)}</span>
                        {row.originalUnitPrice !== row.unitPrice && (
                          <div className="text-xs text-slate-400 font-normal">
                            (was {currencyFormatter.format(row.originalUnitPrice)})
                          </div>
                        )}
                      </div>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="text-right">
                    <input
                      type="number"
                      min={quantityMin}
                      step={quantityStep}
                      className="input input-xs w-12 text-right text-xs"
                      value={row.quantity || ''}
                      onChange={(event) => handleUpdateRow(index, { quantity: event.target.value })}
                    />
                  </td>
                  <td className="text-right text-sm font-medium text-slate-700">
                    {row.option && row.quantity > 0
                      ? currencyFormatter.format(row.totalPrice)
                      : '—'}
                  </td>
                  <td className="text-right">
                    <button
                      type="button"
                      className="btn btn-xs btn-ghost text-error"
                      onClick={() => handleRemoveRow(index)}
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="h-4 w-4"
                        aria-hidden="true"
                      >
                        <path d="M3 6h18" />
                        <path d="M8 6v12a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2V6" />
                        <path d="M10 6V4a2 2 0 0 1 2-2h0a2 2 0 0 1 2 2v2" />
                        <path d="M10 11v6" />
                        <path d="M14 11v6" />
                      </svg>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {rowsWithComputed.length > 0 && brandOptions.length > 0 && (
        <div className="mt-4 flex justify-end text-sm font-semibold text-slate-700">
          Medicine subtotal: {currencyFormatter.format(medicinesTotal)}
        </div>
      )}
    </div>
  );
};

export default AppointmentMedicineSelector;
