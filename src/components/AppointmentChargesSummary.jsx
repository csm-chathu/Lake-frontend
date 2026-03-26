import React, { useMemo } from 'react';
import useEntityApi from '../hooks/useEntityApi.js';
import { calculateMedicinesTotal } from './AppointmentMedicineSelector.jsx';
import PaymentFooter from './PaymentFooter.jsx';

const currencyFormatter = new Intl.NumberFormat('en-LK', { style: 'currency', currency: 'LKR' });

const capitalizeFirstLetter = (string) => {
  if (typeof string !== 'string' || string.length === 0) {
    return string;
  }
  return string.charAt(0).toUpperCase() + string.slice(1);
};

export default function AppointmentChargesSummary({
  formState,
  setFormState,
  brandLookup,
  chargePresets = [],
  surgeryChargePresets = [],
  disposableChargePresets: disposableChargePresetsProp = [],
  paymentStatusOptions = []
}) {
  // Load disposable charge presets from API if not provided
  const { items: disposableChargePresetsApi, loading: disposableLoading } = useEntityApi('disposabal-charge-presets');
  const disposableChargePresets =
    Array.isArray(disposableChargePresetsProp) && disposableChargePresetsProp.length
      ? disposableChargePresetsProp
      : (Array.isArray(disposableChargePresetsApi) ? disposableChargePresetsApi.filter((p) => p.active !== false) : []);
  // compute derived values locally so callers don't need to already calculate them
  const doctorChargeValue = useMemo(() => {
    const parsed = Number.parseFloat(formState.doctorCharge);
    return Number.isNaN(parsed) ? 0 : parsed;
  }, [formState.doctorCharge]);

  const surgeryChargeValue = useMemo(() => {
    const parsed = Number.parseFloat(formState.surgeryCharge);
    return Number.isNaN(parsed) ? 0 : parsed;
  }, [formState.surgeryCharge]);


  const serviceChargeValue = useMemo(() => {
    const parsed = Number.parseFloat(formState.otherCharge);
    return Number.isNaN(parsed) ? 0 : parsed;
  }, [formState.otherCharge]);

  // Disposable Charge
  const disposableChargeValue = useMemo(() => {
    const parsed = Number.parseFloat(formState.disposableCharge);
    return Number.isNaN(parsed) ? 0 : parsed;
  }, [formState.disposableCharge]);

  const medicinesTotal = useMemo(
    () => calculateMedicinesTotal(formState.medicines || [], brandLookup),
    [formState.medicines, brandLookup]
  );

  const discountValue = useMemo(() => {
    const parsed = Number.parseFloat(formState.discount);
    return Number.isNaN(parsed) ? 0 : parsed;
  }, [formState.discount]);

  const totalChargeEstimate = useMemo(() => {
    const gross = doctorChargeValue + surgeryChargeValue + serviceChargeValue + disposableChargeValue + medicinesTotal;
    return Number(Math.max(gross - discountValue, 0).toFixed(2));
  }, [doctorChargeValue, surgeryChargeValue, serviceChargeValue, disposableChargeValue, medicinesTotal, discountValue]);

  const handleChangeField = (name, value) => {
    setFormState((prev) => ({ ...prev, [name]: value }));
  };

  return (
    <div className="rounded-xl border border-base-300 bg-base-100 shadow-sm">
      {/* Header */}
      <div className="border-b border-base-200 bg-base-200/30 px-5 py-3">
        <h3 className="text-base font-semibold text-slate-800">💰 Charges Summary</h3>
        <p className="mt-0.5 text-xs text-slate-500">
          Configure charges and view real-time totals
        </p>
      </div>

      <div className="p-5">
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-4">
            {/* Doctor Charge */}
            <div className="rounded-lg border border-base-200 bg-base-50 p-4">
            <label className="mb-2 block text-sm font-semibold text-slate-700">
              👨‍⚕️ Doctor Charge
            </label>
            <div className="flex flex-wrap items-center gap-2">
              {(() => {
                const current = typeof formState.doctorCharge === 'string' ? formState.doctorCharge : '';
                const numeric = Number.parseFloat(current) || 0;
                const presetsList =
                  Array.isArray(chargePresets) && chargePresets.length
                    ? chargePresets
                    : [
                        { id: 'p1', label: 'Standard', value: 300 },
                        { id: 'p2', label: 'Priority', value: 500 },
                        { id: 'p3', label: 'Default', value: 800 }
                      ];

                return (
                  <>
                    {presetsList.map((preset) => {
                      const valueNum = Number(preset.value);
                      const active = Number(valueNum) === Number(numeric);
                      return (
                        <button
                          type="button"
                          key={preset.id ?? preset.name ?? preset.value}
                          className={`btn btn-sm ${active ? 'btn-primary' : 'btn-ghost border border-base-300'}`}
                          onClick={() => handleChangeField('doctorCharge', String(preset.value))}
                        >
                          {preset.label}
                          <span className="ml-1 text-xs opacity-70">
                            {currencyFormatter.format(preset.value)}
                          </span>
                        </button>
                      );
                    })}
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-slate-500">or</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={current}
                        onChange={(e) => handleChangeField('doctorCharge', e.target.value)}
                        placeholder="Custom amount"
                        className="input input-sm input-bordered w-36"
                      />
                    </div>
                  </>
                );
              })()}
            </div>
            </div>

            {/* Disposable Charge */}
            <div className="rounded-lg border border-base-200 bg-base-50 p-4">
              <label className="mb-2 block text-sm font-semibold text-slate-700">
                🧻 Disposable Charge
              </label>
              <div className="flex flex-wrap items-center gap-2">
                {(() => {
                  const current = typeof formState.disposableCharge === 'string' ? formState.disposableCharge : '';
                  const numeric = Number.parseFloat(current) || 0;
                  const presetsList =
                    Array.isArray(disposableChargePresets) && disposableChargePresets.length
                      ? disposableChargePresets
                      : [
                          { id: 'd1', label: 'Standard', value: 100 },
                          { id: 'd2', label: 'Premium', value: 200 },
                          { id: 'd3', label: 'Custom', value: 0 }
                        ];
                  return (
                    <>
                      {presetsList.map((preset) => {
                        const valueNum = Number(preset.value);
                        const active = Number(valueNum) === Number(numeric);
                        return (
                          <button
                            type="button"
                            key={preset.id ?? preset.name ?? preset.value}
                            className={`btn btn-sm ${active ? 'btn-primary' : 'btn-ghost border border-base-300'}`}
                            onClick={() => handleChangeField('disposableCharge', String(preset.value))}
                          >
                            {preset.label}
                            <span className="ml-1 text-xs opacity-70">
                              {currencyFormatter.format(preset.value)}
                            </span>
                          </button>
                        );
                      })}
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-slate-500">or</span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={current}
                          onChange={(e) => handleChangeField('disposableCharge', e.target.value)}
                          placeholder="Custom amount"
                          className="input input-sm input-bordered w-36"
                        />
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>

            {/* Other/Service Charge */}
            <div className="rounded-lg border border-base-200 bg-base-50 p-4">
            <label className="mb-2 block text-sm font-semibold text-slate-700">
              🔧 Other / Service Charge
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="number"
                min="0"
                step="0.01"
                value={typeof formState.otherCharge === 'string' ? formState.otherCharge : ''}
                onChange={(e) => handleChangeField('otherCharge', e.target.value)}
                placeholder="Amount"
                className="input input-sm input-bordered w-32"
              />
              <input
                type="text"
                value={typeof formState.otherChargeReason === 'string' ? formState.otherChargeReason : ''}
                onChange={(e) => handleChangeField('otherChargeReason', capitalizeFirstLetter(e.target.value))}
                placeholder="Reason (optional)"
                className="input input-sm input-bordered flex-1 min-w-[200px]"
              />
            </div>
            </div>

            {/* Discount */}
            <div className="rounded-lg border border-base-200 bg-base-50 p-4">
            <label className="mb-2 block text-sm font-semibold text-slate-700">
              🎟️ Discount
            </label>
            <div className="flex flex-wrap items-center gap-2">
              {[0, 10, 20, 30, 40, 50].map((pct) => {
                const gross = doctorChargeValue + surgeryChargeValue + serviceChargeValue + disposableChargeValue + medicinesTotal;
                const v = Number(((gross * pct) / 100).toFixed(2));
                const active = Number(v) === Number(discountValue);
                return (
                  <button
                    type="button"
                    key={pct}
                    className={`btn btn-sm ${active ? 'btn-primary' : 'btn-ghost border border-base-300'}`}
                    onClick={() => handleChangeField('discount', String(v))}
                  >
                    {pct === 0 ? 'No discount' : `${pct}%`}
                  </button>
                );
              })}
            </div>
            {discountValue > 0 && (
              <div className="mt-2 text-xs text-emerald-600 font-medium">
                ✓ Discount applied: {currencyFormatter.format(discountValue)}
              </div>
            )}
            </div>
          </div>

          <div className="space-y-4">
            {/* Surgery Charge */}
            {Array.isArray(surgeryChargePresets) &&
              surgeryChargePresets.filter((preset) => preset.active !== false).length > 0 && (
                <div className="rounded-lg border border-base-200 bg-base-50 p-4">
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    🏥 Surgery Charge
                  </label>
                  <div className="flex flex-wrap items-center gap-2">
                    {(() => {
                      const current = typeof formState.surgeryCharge === 'string' ? formState.surgeryCharge : '';
                      const numeric = Number.parseFloat(current) || 0;
                      const presetsList = surgeryChargePresets.filter((preset) => preset.active !== false);

                      return (
                        <>
                          {presetsList.map((preset) => {
                            const valueNum = Number(preset.value);
                            const active = Number(valueNum) === Number(numeric);
                            return (
                              <button
                                type="button"
                                key={preset.id ?? preset.name ?? preset.value}
                                className={`btn btn-sm ${active ? 'btn-primary' : 'btn-ghost border border-base-300'}`}
                                onClick={() => handleChangeField('surgeryCharge', String(preset.value))}
                              >
                                {preset.label}
                                <span className="ml-1 text-xs opacity-70">
                                  {currencyFormatter.format(preset.value)}
                                </span>
                              </button>
                            );
                          })}
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs text-slate-500">or</span>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={current}
                              onChange={(e) => handleChangeField('surgeryCharge', e.target.value)}
                              placeholder="Custom amount"
                              className="input input-sm input-bordered w-36"
                            />
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </div>
              )}

            {/* Summary as small colored boxes */}
            <div className="flex flex-wrap gap-2 my-2">
              <div className="px-3 py-2 rounded bg-blue-50 border border-blue-200 text-blue-900 text-xs font-semibold flex-1 min-w-[120px] flex flex-col items-center">
                <span className="mb-0.5">Doctor</span>
                <span className="text-base font-bold">{currencyFormatter.format(doctorChargeValue)}</span>
              </div>
              <div className="px-3 py-2 rounded bg-purple-50 border border-purple-200 text-purple-900 text-xs font-semibold flex-1 min-w-[120px] flex flex-col items-center">
                <span className="mb-0.5">Surgery</span>
                <span className="text-base font-bold">{currencyFormatter.format(surgeryChargeValue)}</span>
              </div>
              <div className="px-3 py-2 rounded bg-amber-50 border border-amber-200 text-amber-900 text-xs font-semibold flex-1 min-w-[120px] flex flex-col items-center">
                <span className="mb-0.5">Service</span>
                <span className="text-base font-bold">{currencyFormatter.format(serviceChargeValue)}</span>
              </div>
              <div className="px-3 py-2 rounded bg-yellow-50 border border-yellow-200 text-yellow-900 text-xs font-semibold flex-1 min-w-[120px] flex flex-col items-center">
                <span className="mb-0.5">Disposable</span>
                <span className="text-base font-bold">{currencyFormatter.format(disposableChargeValue)}</span>
              </div>
              <div className="px-3 py-2 rounded bg-green-50 border border-green-200 text-green-900 text-xs font-semibold flex-1 min-w-[120px] flex flex-col items-center">
                <span className="mb-0.5">Medicines</span>
                <span className="text-base font-bold">{currencyFormatter.format(medicinesTotal)}</span>
              </div>
              {discountValue > 0 && (
                <div className="px-3 py-2 rounded bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex-1 min-w-[120px] flex flex-col items-center">
                  <span className="mb-0.5">Discount</span>
                  <span className="text-base font-bold">- {currencyFormatter.format(discountValue)}</span>
                </div>
              )}
              <div className="px-3 py-2 rounded bg-primary/10 border border-primary/30 text-primary text-xs font-bold flex-1 min-w-[120px] flex flex-col items-center">
                <span className="mb-0.5">Total</span>
                <span className="text-lg font-bold">{currencyFormatter.format(totalChargeEstimate)}</span>
              </div>
            </div>

            <div className="rounded-lg border border-base-200 bg-base-50 p-3">
              <PaymentFooter
                paymentType={formState.paymentType}
                paymentStatus={formState.paymentStatus}
                settledAt={formState.settledAt}
                onPaymentTypeChange={(value) => handleChangeField('paymentType', value)}
                onPaymentStatusChange={(value) => handleChangeField('paymentStatus', value)}
                onSettledAtChange={(value) => handleChangeField('settledAt', value)}
                paymentStatusOptions={paymentStatusOptions}
              />
            </div>

            {/* Payment Notice */}
            {formState.paymentType === 'credit' && formState.paymentStatus !== 'paid' && (
              <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 flex items-start gap-2">
                <span className="text-amber-600 text-lg">⚠️</span>
                <p className="text-sm text-amber-700 flex-1">
                  <strong>Credit Payment:</strong> Remember to mark this visit as paid once the balance is settled.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
