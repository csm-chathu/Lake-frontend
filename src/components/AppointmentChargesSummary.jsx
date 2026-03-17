import React, { useMemo } from 'react';
import { calculateMedicinesTotal } from './AppointmentMedicineSelector.jsx';
import PaymentFooter from './PaymentFooter.jsx';

const currencyFormatter = new Intl.NumberFormat('en-LK', { style: 'currency', currency: 'LKR' });

export default function AppointmentChargesSummary({
  formState,
  setFormState,
  brandLookup,
  chargePresets = [],
  surgeryChargePresets = [],
  paymentStatusOptions = []
}) {
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

  const medicinesTotal = useMemo(
    () => calculateMedicinesTotal(formState.medicines || [], brandLookup),
    [formState.medicines, brandLookup]
  );

  const discountValue = useMemo(() => {
    const parsed = Number.parseFloat(formState.discount);
    return Number.isNaN(parsed) ? 0 : parsed;
  }, [formState.discount]);

  const totalChargeEstimate = useMemo(() => {
    const gross = doctorChargeValue + surgeryChargeValue + serviceChargeValue + medicinesTotal;
    return Number(Math.max(gross - discountValue, 0).toFixed(2));
  }, [doctorChargeValue, surgeryChargeValue, serviceChargeValue, medicinesTotal, discountValue]);

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
                onChange={(e) => handleChangeField('otherChargeReason', e.target.value)}
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
                const gross = doctorChargeValue + surgeryChargeValue + serviceChargeValue + medicinesTotal;
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

            {/* Summary Table */}
            <div className="rounded-lg border border-base-300 overflow-hidden">
          <table className="table table-sm w-full">
            <thead className="bg-base-200">
              <tr>
                <th className="text-slate-700">Charge Type</th>
                <th className="text-right text-slate-700">Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr className="hover:bg-base-50">
                <td className="text-slate-600">Doctor Charge</td>
                <td className="text-right font-medium text-slate-800">
                  {currencyFormatter.format(doctorChargeValue)}
                </td>
              </tr>
              <tr className="hover:bg-base-50">
                <td className="text-slate-600">Surgery Charge</td>
                <td className="text-right font-medium text-slate-800">
                  {currencyFormatter.format(surgeryChargeValue)}
                </td>
              </tr>
              <tr className="hover:bg-base-50">
                <td className="text-slate-600">Other/Service Charge</td>
                <td className="text-right font-medium text-slate-800">
                  {currencyFormatter.format(serviceChargeValue)}
                </td>
              </tr>
              <tr className="hover:bg-base-50">
                <td className="text-slate-600">Medicines Subtotal</td>
                <td className="text-right font-medium text-slate-800">
                  {currencyFormatter.format(medicinesTotal)}
                </td>
              </tr>
              {discountValue > 0 && (
                <tr className="hover:bg-base-50">
                  <td className="text-rose-600">Discount</td>
                  <td className="text-right font-medium text-rose-600">
                    - {currencyFormatter.format(discountValue)}
                  </td>
                </tr>
              )}
              <tr className="border-t-2 border-base-300 bg-primary/5">
                <td className="text-base font-bold text-primary">Total Amount</td>
                <td className="text-right text-lg font-bold text-primary">
                  {currencyFormatter.format(totalChargeEstimate)}
                </td>
              </tr>
            </tbody>
          </table>
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
