import React from 'react';
import { formatDateInput } from '../pages/appointmentsHelpers.js';

export default function VaccineFollowUp({
  hasVaccineMedicine,
  vaccinationPlan,
  formState,
  updateVaccinationPlan,
  firstVaccineMedicineName,
  vaccineNames = []
}) {
  if (!hasVaccineMedicine) {
    return null;
  }

  return (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-emerald-900">Vaccine follow-up</p>
          <p className="text-xs text-emerald-800">Set the next vaccine date now so it is saved with this visit.</p>
        </div>
        <span className="text-[11px] uppercase tracking-wide text-emerald-700">Vaccine detected</span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="form-control w-full">
          <span className="label-text text-xs font-semibold uppercase tracking-wide text-emerald-900">Vaccine name</span>
          <input
            type="text"
            className="input input-sm input-bordered bg-white"
            value={vaccinationPlan.vaccineName || ''}
            onChange={(event) =>
              updateVaccinationPlan((plan) => ({ ...plan, vaccineName: event.target.value, enabled: true }))
            }
            placeholder={firstVaccineMedicineName || 'Rabies, DHP, etc.'}
            list="vaccine-name-options"
            autoComplete="on"
          />
          <datalist id="vaccine-name-options">
            {vaccineNames.map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>
        </label>
        <label className="form-control w-full">
          <span className="label-text text-xs font-semibold uppercase tracking-wide text-emerald-900">Next vaccine date</span>
          <input
            type="date"
            className="input input-sm input-bordered bg-white"
            value={formatDateInput(vaccinationPlan.nextDueAt)}
            onChange={(event) =>
              updateVaccinationPlan((plan) => ({ ...plan, nextDueAt: formatDateInput(event.target.value), enabled: true }))
            }
          />
          {(() => {
            const baseString = vaccinationPlan.administeredAt || formatDateInput(formState.date) || formatDateInput(new Date());
            const baseDate = baseString ? new Date(baseString) : new Date();
            const defaultTwoWeeks = (() => {
              if (Number.isNaN(baseDate.valueOf())) return '';
              const copy = new Date(baseDate);
              copy.setDate(copy.getDate() + 14);
              return formatDateInput(copy.toISOString());
            })();
            const currentNextDue = formatDateInput(vaccinationPlan.nextDueAt) || defaultTwoWeeks;

            return (
              <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-emerald-800">
                {[{
                  label: '3 days', type: 'days', amount: 3
                }, {
                  label: '2 weeks', type: 'days', amount: 14
                }, {
                  label: '1 month', type: 'months', amount: 1
                }, {
                  label: '3 months', type: 'months', amount: 3
                }, {
                  label: '6 months', type: 'months', amount: 6
                }, {
                  label: '1 year', type: 'years', amount: 1
                }].map((preset) => {
                  const workingBase = baseDate && !Number.isNaN(baseDate.valueOf()) ? new Date(baseDate) : new Date();
                  let target = '';
                  if (!Number.isNaN(workingBase.valueOf())) {
                    if (preset.type === 'days') {
                      workingBase.setDate(workingBase.getDate() + preset.amount);
                    } else if (preset.type === 'months') {
                      workingBase.setMonth(workingBase.getMonth() + preset.amount);
                    } else if (preset.type === 'years') {
                      workingBase.setFullYear(workingBase.getFullYear() + preset.amount);
                    }
                    target = formatDateInput(workingBase.toISOString());
                  }
                  const isActive = target && target === currentNextDue;
                  return (
                    <button
                      key={preset.label}
                      type="button"
                      className={`badge badge-lg border px-3 py-2 ${
                        isActive
                          ? 'bg-emerald-200 text-emerald-900 border-emerald-300'
                          : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
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
            );
          })()}
        </label>
      </div>
    </div>
  );
}
