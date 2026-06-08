import React from 'react';
import { Syringe } from 'lucide-react';
import { formatDateInput } from '../pages/appointmentsHelpers.js';

export default function VaccineFollowUp({
  hasVaccineMedicine,
  vaccinationPlan,
  formState,
  updateVaccinationPlan,
  firstVaccineMedicineName,
  vaccineNames = []
}) {
  if (!hasVaccineMedicine) return null;

  const baseString = vaccinationPlan.administeredAt || formatDateInput(formState.date) || formatDateInput(new Date());
  const baseDate = baseString ? new Date(baseString) : new Date();

  const defaultTwoWeeks = (() => {
    if (Number.isNaN(baseDate.valueOf())) return '';
    const copy = new Date(baseDate);
    copy.setDate(copy.getDate() + 14);
    return formatDateInput(copy.toISOString());
  })();

  const currentNextDue = formatDateInput(vaccinationPlan.nextDueAt) || defaultTwoWeeks;

  const PRESETS = [
    { label: '3 days',   type: 'days',   amount: 3 },
    { label: '2 weeks',  type: 'days',   amount: 14 },
    { label: '1 month',  type: 'months', amount: 1 },
    { label: '3 months', type: 'months', amount: 3 },
    { label: '6 months', type: 'months', amount: 6 },
    { label: '1 year',   type: 'years',  amount: 1 }
  ];

  return (
    <div className="overflow-hidden rounded-2xl border border-emerald-200 bg-white shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-emerald-100 bg-emerald-50 px-4 py-3">
        <div className="flex items-center gap-2">
          <Syringe size={15} className="text-emerald-600" />
          <h3 className="text-sm font-semibold text-emerald-900">Vaccine Follow-up</h3>
        </div>
        <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700">
          Vaccine detected
        </span>
      </div>

      <div className="grid gap-4 p-4 sm:grid-cols-2">
        {/* Vaccine name */}
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Vaccine name</label>
          <input
            type="text"
            className="input input-sm input-bordered w-full bg-white text-sm text-slate-800 placeholder:text-slate-400 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
            value={vaccinationPlan.vaccineName || ''}
            onChange={(e) =>
              updateVaccinationPlan((plan) => ({ ...plan, vaccineName: e.target.value, enabled: true }))
            }
            placeholder={firstVaccineMedicineName || 'Rabies, DHP, etc.'}
            list="vaccine-name-options"
            autoComplete="on"
          />
          <datalist id="vaccine-name-options">
            {vaccineNames.map((name) => <option key={name} value={name} />)}
          </datalist>
        </div>

        {/* Next vaccine date */}
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Next vaccine date</label>
          <input
            type="date"
            className="input input-sm input-bordered w-full bg-white text-sm text-slate-800 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
            value={formatDateInput(vaccinationPlan.nextDueAt)}
            onChange={(e) =>
              updateVaccinationPlan((plan) => ({ ...plan, nextDueAt: formatDateInput(e.target.value), enabled: true }))
            }
          />
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {PRESETS.map((preset) => {
              const working = baseDate && !Number.isNaN(baseDate.valueOf()) ? new Date(baseDate) : new Date();
              let target = '';
              if (!Number.isNaN(working.valueOf())) {
                if (preset.type === 'days') working.setDate(working.getDate() + preset.amount);
                else if (preset.type === 'months') working.setMonth(working.getMonth() + preset.amount);
                else if (preset.type === 'years') working.setFullYear(working.getFullYear() + preset.amount);
                target = formatDateInput(working.toISOString());
              }
              const isActive = target && target === currentNextDue;
              return (
                <button
                  key={preset.label}
                  type="button"
                  className={`rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition ${
                    isActive
                      ? 'border-emerald-400 bg-emerald-100 text-emerald-800'
                      : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700'
                  }`}
                  onClick={() => {
                    if (!target) return;
                    updateVaccinationPlan((plan) => ({ ...plan, nextDueAt: target, enabled: true }));
                  }}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
