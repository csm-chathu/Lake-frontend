import React, { useMemo, useState, useEffect } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, PackageOpen, Scissors, Stethoscope, Tag, WalletCards, Wrench } from 'lucide-react';
import useEntityApi from '../hooks/useEntityApi.js';
import { calculateMedicinesTotal } from './AppointmentMedicineSelector.jsx';
import PaymentFooter from './PaymentFooter.jsx';

const currencyFormatter = new Intl.NumberFormat('en-LK', { style: 'currency', currency: 'LKR' });

const capitalizeFirstLetter = (string) => {
  if (typeof string !== 'string' || string.length === 0) return string;
  return string.charAt(0).toUpperCase() + string.slice(1);
};

const inputClass =
  'input input-sm input-bordered w-28 bg-white text-sm text-slate-800 placeholder:text-slate-400 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-100';

const useChargeKeyDown = (setter) => (e) => {
  if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
  e.preventDefault();
  const current = Number.parseFloat(e.target.value) || 0;
  const next = Math.max(0, current + (e.key === 'ArrowUp' ? 10 : -10));
  setter(String(next));
};

function PresetButton({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md border px-2 py-0.5 text-left transition ${
        active
          ? 'border-blue-400 bg-blue-50 text-blue-700 shadow-sm'
          : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700'
      }`}
    >
      {children}
    </button>
  );
}

function SectionCard({ icon: Icon, label, children }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-2 shadow-sm">
      <div className="mb-1.5 flex items-center gap-1.5">
        <Icon size={11} className="text-slate-400" />
        <span className="text-[9px] font-semibold uppercase tracking-wide text-slate-400">{label}</span>
      </div>
      {children}
    </div>
  );
}

export default function AppointmentChargesSummary({
  formState,
  setFormState,
  brandLookup,
  chargePresets = [],
  surgeryChargePresets = [],
  disposableChargePresets: disposableChargePresetsProp = [],
  paymentStatusOptions = []
}) {
  const { items: disposableChargePresetsApi } = useEntityApi('disposabal-charge-presets');
  const disposableChargePresets =
    Array.isArray(disposableChargePresetsProp) && disposableChargePresetsProp.length
      ? disposableChargePresetsProp
      : (Array.isArray(disposableChargePresetsApi) ? disposableChargePresetsApi.filter((p) => p.active !== false) : []);

  const { items: discountsApi, loading: discountsLoading } = useEntityApi('discounts');
  const discounts = Array.isArray(discountsApi) ? discountsApi.filter((d) => d.active !== false) : [];

  const doctorChargeValue = useMemo(() => {
    const p = Number.parseFloat(formState.doctorCharge);
    return Number.isNaN(p) ? 0 : p;
  }, [formState.doctorCharge]);

  const surgeryChargeValue = useMemo(() => {
    const p = Number.parseFloat(formState.surgeryCharge);
    return Number.isNaN(p) ? 0 : p;
  }, [formState.surgeryCharge]);

  const serviceChargeValue = useMemo(() => {
    const p = Number.parseFloat(formState.otherCharge);
    return Number.isNaN(p) ? 0 : p;
  }, [formState.otherCharge]);

  const disposableChargeValue = useMemo(() => {
    const p = Number.parseFloat(formState.disposableCharge);
    return Number.isNaN(p) ? 0 : p;
  }, [formState.disposableCharge]);

  const medicinesTotal = useMemo(
    () => calculateMedicinesTotal(formState.medicines || [], brandLookup),
    [formState.medicines, brandLookup]
  );

  const discountValue = useMemo(() => {
    const p = Number.parseFloat(formState.discount);
    return Number.isNaN(p) ? 0 : p;
  }, [formState.discount]);

  const totalChargeEstimate = useMemo(() => {
    const gross = doctorChargeValue + surgeryChargeValue + serviceChargeValue + disposableChargeValue + medicinesTotal;
    return Number(Math.max(gross - discountValue, 0).toFixed(2));
  }, [doctorChargeValue, surgeryChargeValue, serviceChargeValue, disposableChargeValue, medicinesTotal, discountValue]);

  const set = (name, value) => setFormState((prev) => ({ ...prev, [name]: value }));
  const onDoctorKeyDown    = useChargeKeyDown((v) => set('doctorCharge', v));
  const onSurgeryKeyDown   = useChargeKeyDown((v) => set('surgeryCharge', v));
  const onDisposableKeyDown= useChargeKeyDown((v) => set('disposableCharge', v));
  const onOtherKeyDown     = useChargeKeyDown((v) => set('otherCharge', v));
  const onDiscountKeyDown  = useChargeKeyDown((v) => set('discount', v));

  const doctorPresets =
    Array.isArray(chargePresets) && chargePresets.length
      ? chargePresets
      : [
          { id: 'p1', label: 'Standard', value: 300 },
          { id: 'p2', label: 'Priority', value: 500 },
          { id: 'p3', label: 'Default', value: 800 }
        ];

  const disposablePresets =
    Array.isArray(disposableChargePresets) && disposableChargePresets.length
      ? disposableChargePresets
      : [
          { id: 'd1', label: 'Standard', value: 100 },
          { id: 'd2', label: 'Premium', value: 200 }
        ];

  const surgeryPresets = Array.isArray(surgeryChargePresets)
    ? surgeryChargePresets.filter((p) => p.active !== false)
    : [];

  const gross = doctorChargeValue + surgeryChargeValue + serviceChargeValue + disposableChargeValue + medicinesTotal;

  const hasSecondaryCharges = surgeryChargeValue > 0 || disposableChargeValue > 0 || serviceChargeValue > 0 || discountValue > 0;
  const [showMore, setShowMore] = useState(hasSecondaryCharges);

  // Auto-expand when an existing appointment with secondary charges is loaded
  useEffect(() => {
    if (hasSecondaryCharges) setShowMore(true);
  }, [hasSecondaryCharges]);

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50 px-3 py-2">
        <WalletCards size={13} className="text-slate-500" />
        <h3 className="text-sm font-semibold text-slate-800">Charges &amp; Payment</h3>
      </div>

      <div className="space-y-2 p-2">

        {/* Doctor Charge — always visible */}
        <SectionCard icon={Stethoscope} label="Doctor Charge">
          <div className="flex flex-wrap items-center gap-1.5">
            {(() => {
              const current = typeof formState.doctorCharge === 'string' ? formState.doctorCharge : '';
              const numeric = Number.parseFloat(current) || 0;
              return (
                <>
                  {doctorPresets.map((preset) => {
                    const active = Number(preset.value) === numeric;
                    return (
                      <PresetButton key={preset.id ?? preset.value} active={active} onClick={() => set('doctorCharge', active ? '' : String(preset.value))}>
                        <span className="block text-xs font-bold leading-tight">{currencyFormatter.format(preset.value)}</span>
                        <span className="block text-[9px] font-normal opacity-70">{preset.label}</span>
                      </PresetButton>
                    );
                  })}
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={current}
                    onChange={(e) => set('doctorCharge', e.target.value)}
                    onKeyDown={onDoctorKeyDown}
                    placeholder="Custom"
                    className={inputClass}
                  />
                </>
              );
            })()}
          </div>
        </SectionCard>

        {/* Toggle for secondary charges */}
        <button
          type="button"
          onClick={() => setShowMore((v) => !v)}
          className="flex w-full items-center justify-between rounded-lg border border-dashed border-slate-200 px-2.5 py-1.5 text-left text-xs font-medium text-slate-500 hover:border-slate-300 hover:bg-slate-50 transition"
        >
          <span>{showMore ? 'Hide extra charges' : '+ Surgery / Disposable / Other / Discount'}</span>
          {showMore ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </button>

        {/* Secondary charges — collapsible */}
        {showMore && (
          <div className="space-y-1.5">
            {/* Surgery Charge */}
            {surgeryPresets.length > 0 && (
              <SectionCard icon={Scissors} label="Surgery Charge">
                <div className="flex flex-wrap items-center gap-1.5">
                  {(() => {
                    const current = typeof formState.surgeryCharge === 'string' ? formState.surgeryCharge : '';
                    const numeric = Number.parseFloat(current) || 0;
                    return (
                      <>
                        {surgeryPresets.map((preset) => {
                          const active = Number(preset.value) === numeric;
                          return (
                            <PresetButton key={preset.id ?? preset.value} active={active} onClick={() => set('surgeryCharge', active ? '' : String(preset.value))}>
                              <span className="block text-xs font-bold leading-tight">{currencyFormatter.format(preset.value)}</span>
                              <span className="block text-[9px] font-normal opacity-70">{preset.label}</span>
                            </PresetButton>
                          );
                        })}
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={current}
                          onChange={(e) => set('surgeryCharge', e.target.value)}
                          onKeyDown={onSurgeryKeyDown}
                          placeholder="Custom"
                          className={inputClass}
                        />
                      </>
                    );
                  })()}
                </div>
              </SectionCard>
            )}

            {/* Disposable Charge */}
            <SectionCard icon={PackageOpen} label="Disposable Charge">
              <div className="flex flex-wrap items-center gap-1.5">
                {(() => {
                  const current = typeof formState.disposableCharge === 'string' ? formState.disposableCharge : '';
                  const numeric = Number.parseFloat(current) || 0;
                  return (
                    <>
                      {disposablePresets.map((preset) => {
                        const active = Number(preset.value) === numeric;
                        return (
                          <PresetButton key={preset.id ?? preset.value} active={active} onClick={() => set('disposableCharge', active ? '' : String(preset.value))}>
                            <span className="block text-xs font-bold leading-tight">{currencyFormatter.format(preset.value)}</span>
                            <span className="block text-[9px] font-normal opacity-70">{preset.label}</span>
                          </PresetButton>
                        );
                      })}
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={current}
                        onChange={(e) => set('disposableCharge', e.target.value)}
                        onKeyDown={onDisposableKeyDown}
                        placeholder="Custom"
                        className={inputClass}
                      />
                    </>
                  );
                })()}
              </div>
            </SectionCard>

            {/* Other / Service Charge */}
            <SectionCard icon={Wrench} label="Other / Service Charge">
              <div className="flex flex-wrap items-center gap-1.5">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={typeof formState.otherCharge === 'string' ? formState.otherCharge : ''}
                  onChange={(e) => set('otherCharge', e.target.value)}
                  onKeyDown={onOtherKeyDown}
                  placeholder="Amount"
                  className={inputClass}
                />
                <input
                  type="text"
                  value={typeof formState.otherChargeReason === 'string' ? formState.otherChargeReason : ''}
                  onChange={(e) => set('otherChargeReason', capitalizeFirstLetter(e.target.value))}
                  placeholder="Reason (optional)"
                  className="input input-sm input-bordered flex-1 min-w-[120px] bg-white text-sm text-slate-800 placeholder:text-slate-400 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-100"
                />
              </div>
            </SectionCard>

            {/* Discount */}
            <SectionCard icon={Tag} label="Discount">
              <div className="flex flex-wrap items-center gap-1.5">
                {discountsLoading && <span className="text-xs text-slate-400">Loading...</span>}
                {discounts.length > 0
                  ? discounts.map((preset) => {
                      const v = Number(((gross * Number(preset.value)) / 100).toFixed(2));
                      const active = Number(v) === Number(discountValue);
                      return (
                        <PresetButton key={preset.id ?? preset.value} active={active} onClick={() => set('discount', active ? '' : String(v))}>
                          <span className="text-xs font-semibold">{preset.label}</span>
                        </PresetButton>
                      );
                    })
                  : <span className="text-xs text-slate-400">No presets. Enter amount below.</span>
                }
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formState.discount || ''}
                  onChange={(e) => set('discount', e.target.value)}
                  onKeyDown={onDiscountKeyDown}
                  placeholder="Custom"
                  className={inputClass}
                />
              </div>
            </SectionCard>
          </div>
        )}

        {/* Charge breakdown */}
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          {[
            { label: 'Doctor', value: doctorChargeValue },
            { label: 'Surgery', value: surgeryChargeValue },
            { label: 'Service', value: serviceChargeValue },
            { label: 'Disposable', value: disposableChargeValue },
            { label: 'Medicines', value: medicinesTotal },
          ].filter(({ value }) => value > 0).map(({ label, value }, i) => (
            <div key={label} className={`flex items-center justify-between px-3 py-1.5 ${i > 0 ? 'border-t border-slate-100' : ''}`}>
              <span className="text-[11px] text-slate-500">{label}</span>
              <span className="text-[11px] font-semibold tabular-nums text-slate-800">
                {currencyFormatter.format(value)}
              </span>
            </div>
          ))}
          {discountValue > 0 && (
            <div className="flex items-center justify-between border-t border-emerald-100 bg-emerald-50 px-3 py-1.5">
              <span className="text-[11px] font-medium text-emerald-600">Discount</span>
              <span className="text-[11px] font-semibold tabular-nums text-emerald-600">− {currencyFormatter.format(discountValue)}</span>
            </div>
          )}
          <div className="flex items-center justify-between border-t-2 border-blue-300 bg-blue-600 px-3 py-2">
            <span className="text-xs font-bold text-blue-100">Total</span>
            <span className="text-sm font-bold tabular-nums text-white">{currencyFormatter.format(totalChargeEstimate)}</span>
          </div>
        </div>

        {/* Payment */}
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">
          <div className="mb-1 flex items-center gap-2">
            <span className="text-[9px] font-semibold uppercase tracking-wide text-slate-400">Payment Method</span>
          </div>
          <PaymentFooter
            paymentType={formState.paymentType}
            paymentStatus={formState.paymentStatus}
            settledAt={formState.settledAt}
            onPaymentTypeChange={(value) => set('paymentType', value)}
            onPaymentStatusChange={(value) => set('paymentStatus', value)}
            onSettledAtChange={(value) => set('settledAt', value)}
            paymentStatusOptions={paymentStatusOptions}
          />
        </div>

        {/* Credit warning */}
        {formState.paymentType === 'credit' && formState.paymentStatus !== 'paid' && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5">
            <AlertTriangle size={12} className="mt-0.5 shrink-0 text-amber-500" />
            <p className="text-xs text-amber-700">
              <strong>Credit payment:</strong> Remember to mark this visit as paid once the balance is settled.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
