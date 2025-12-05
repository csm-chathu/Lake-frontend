import React from 'react';
import { createPortal } from 'react-dom';

const currencyFormatter = new Intl.NumberFormat('en-LK', { style: 'currency', currency: 'LKR' });
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
    const quantity = Number.parseInt(row.quantity, 10) || 0;
    if (quantity <= 0) {
      return sum;
    }
    const unitPrice = Number(option.price) || 0;
    return sum + unitPrice * quantity;
  }, 0);

  return Number(total.toFixed(2));
};

const AppointmentMedicineSelector = ({ value, onChange, brandOptions, brandLookup, loading = false }) => {
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
    const quantity = Number.parseInt(row.quantity, 10) || 0;
    const unitPrice = option ? Number(option.price) : 0;
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

    return {
      ...row,
      option,
      quantity,
      unitPrice,
      totalPrice: Number((unitPrice * quantity).toFixed(2)),
      label: option ? option.label : row.label || fallbackLabel || '',
      query,
      filteredOptions
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
    handleUpdateRow(index, {
      medicineBrandId: option.value,
      label: option.label,
      query: option.label
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
    <div className="rounded-xl border border-base-200 bg-base-100 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-slate-700">Medicines dispensed</p>
          <p className="text-xs text-slate-500">Track dispensed brands to include them in billing.</p>
        </div>
        <button
          type="button"
          className="btn btn-sm btn-outline"
          onClick={handleAddRow}
          disabled={!hasBrandOptions || loading}
        >
          Add medicine
        </button>
      </div>

      {loading ? (
        <div className="rounded-xl border border-dashed border-base-300 bg-base-200/40 p-4 text-center text-sm text-slate-500">
          Loading available medicines…
        </div>
      ) : rowsWithComputed.length === 0 ? (
        <div className="rounded-xl border border-dashed border-base-300 bg-base-200/40 p-4 text-sm text-slate-500">
          {hasBrandOptions
            ? 'No medicines selected for this appointment.'
            : 'No medicines configured yet. Head to the Medicines tab to add inventory.'}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="table table-sm">
            <thead>
              <tr className="text-xs uppercase text-slate-500">
                <th>Medicine brand</th>
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
                      {(row.medicineBrandId || row.query) && (
                        <button
                          type="button"
                          className="btn btn-ghost btn-xs absolute right-1 top-1/2 -translate-y-1/2"
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() =>
                            handleUpdateRow(index, {
                              medicineBrandId: '',
                              label: '',
                              query: ''
                            })
                          }
                        >
                          Clear
                        </button>
                      )}
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
                                      ? currencyFormatter.format(option.price)
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
                  </td>
                  <td className="text-right text-sm text-slate-600">
                    {row.option ? currencyFormatter.format(row.unitPrice) : '—'}
                  </td>
                  <td className="text-right">
                    <input
                      type="number"
                      min="1"
                      step="1"
                      className="input input-bordered input-sm w-full text-right"
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
                      Remove
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
