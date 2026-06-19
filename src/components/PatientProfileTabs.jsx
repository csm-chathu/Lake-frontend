import { useState } from 'react';
import {
  Banknote,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  CreditCard,
  Droplets,
  ExternalLink,
  FlaskConical,
  PawPrint,
  Pill,
  RefreshCw,
  ScanLine,
  Syringe,
  Trash2,
  Upload,
  User,
} from 'lucide-react';

// Resolve medicine display label from raw API medicine row (handles nested or flat shape)
const getMedLabel = (med) => {
  if (med.label && med.label.trim()) return med.label.trim();
  const medicineName = med.brand?.medicine?.name || med.medicine?.name || '';
  const brandName = med.brand?.name || med.name || '';
  const parts = [medicineName, brandName].filter(Boolean);
  return parts.length ? parts.join(' — ') : 'Medicine';
};

const fmt = (val) => {
  const n = Number(val);
  return Number.isNaN(n) ? 0 : n;
};

const PatientProfileTabs = ({
  selectedPatient,
  selectedOwner,
  history = [],
  currencyFormatter,
  profileTab,
  onProfileTabChange,
  diagnosticReports,
  patientReportsLoading,
  patientReportsError,
  reportUploadState,
  requestReportUpload,
  onReportInputChange,
  onReportRemove,
  formatReportDisplayDate,
  makeUploadKey,
  registerUploadInput,
  editingId,
}) => {
  // expand the most recent visit by default
  const [expandedIds, setExpandedIds] = useState(() =>
    history.length > 0 ? new Set([history[0].id]) : new Set()
  );

  const toggleExpand = (id) =>
    setExpandedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const years = Number.parseInt(selectedPatient?.ageYears, 10);
  const months = Number.parseInt(selectedPatient?.ageMonths, 10);
  const ageParts = [];
  if (!Number.isNaN(years) && years > 0) ageParts.push(`${years} yr${years > 1 ? 's' : ''}`);
  if (!Number.isNaN(months) && months > 0) ageParts.push(`${months} mo${months > 1 ? 's' : ''}`);
  const ageLabel = ageParts.length ? ageParts.join(' ') : null;

  const tabs = [
    { id: 'owner',   label: 'Owner',   Icon: User },
    { id: 'history', label: 'History', Icon: ClipboardList },
    { id: 'reports', label: 'Diagnostics', Icon: FlaskConical },
  ];

  const diagnosticCards = [
    { id: 'blood', label: 'Blood report', emptyStatus: 'No blood report uploaded', accent: 'text-rose-600', iconBg: 'bg-rose-100', Icon: Droplets },
    { id: 'xray',  label: 'X-ray',        emptyStatus: 'No X-ray attached',         accent: 'text-sky-600',  iconBg: 'bg-sky-100',  Icon: ScanLine },
    { id: 'labs',  label: 'Lab summary',  emptyStatus: 'No lab files uploaded',      accent: 'text-emerald-600', iconBg: 'bg-emerald-100', Icon: FlaskConical },
  ];

  // ── Owner tab ──────────────────────────────────────────
  const renderOwnerTab = () => (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="flex flex-col gap-1">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Owner name</span>
        <span className="text-sm font-semibold text-slate-800">{selectedOwner?.firstName || '—'}</span>
        <span className="text-xs text-slate-400">
          {selectedOwner ? 'Primary guardian on file' : 'Not assigned — link from Patients page'}
        </span>
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Phone</span>
        <span className="text-sm font-medium text-slate-800">{selectedOwner?.phone || '—'}</span>
        <span className="text-xs text-slate-400">Emergency contact</span>
      </div>
      <div className="sm:col-span-2 flex flex-col gap-1">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Notes</span>
        <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
          {selectedOwner?.notes || 'No notes recorded for this owner.'}
        </p>
      </div>
    </div>
  );

  // ── History tab — full per-visit card ──────────────────
  const renderHistoryTab = () => {
    if (!Array.isArray(history) || history.length === 0) {
      return (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-400">
          No previous visits logged for this patient.
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {history.map((entry) => {
          const visitDate = entry.date ? new Date(entry.date) : null;
          const dateLabel = visitDate ? visitDate.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
          const timeLabel = visitDate ? visitDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

          const doctorCharge  = fmt(entry.doctorCharge);
          const surgeryCharge = fmt(entry.surgeryCharge);
          const otherCharge   = fmt(entry.otherCharge);
          const discount      = fmt(entry.discount);

          // Compute medicines subtotal from stored price if available, otherwise 0
          const medicines = Array.isArray(entry.medicines) ? entry.medicines : [];
          const medSubtotal = medicines.reduce((sum, m) => {
            const price = fmt(m.price ?? m.brand?.price ?? 0);
            const qty   = fmt(m.quantity ?? m.qty ?? 0);
            return sum + price * qty;
          }, 0);

          const gross = doctorCharge + surgeryCharge + otherCharge + medSubtotal;
          const total = Math.max(gross - discount, 0);

          // Fallback: use stored totalCharge if our computed one is 0
          const displayTotal = total > 0 ? total : fmt(entry.totalCharge);

          const isPaid   = entry.paymentStatus === 'paid' || entry.paymentType === 'cash';
          const isCredit = entry.paymentType === 'credit';

          const vacPlan = entry.vaccinationPlan || entry.vaccination || null;
          const hasVaccine = vacPlan?.vaccineName || vacPlan?.nextDueAt;

          const borderColor = isPaid ? 'border-l-emerald-400' : 'border-l-amber-400';

          const isExpanded = expandedIds.has(entry.id);

          return (
            <div
              key={`visit-${entry.id}`}
              className={`overflow-hidden rounded-2xl border border-slate-200 border-l-4 bg-white shadow-sm ${borderColor}`}
            >
              {/* ── Card header — click to expand/collapse ── */}
              <button
                type="button"
                onClick={() => toggleExpand(entry.id)}
                className="flex w-full flex-wrap items-start justify-between gap-3 border-b border-slate-100 bg-slate-50 px-4 py-3 text-left transition hover:bg-slate-100"
              >
                <div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-sm font-bold text-slate-800">{dateLabel}</span>
                    <span className="text-xs text-slate-400">{timeLabel}</span>
                  </div>
                  {entry.reason && (
                    <span className="mt-1 inline-block rounded-full bg-blue-100 px-2.5 py-0.5 text-[11px] font-semibold text-blue-700">
                      {entry.reason}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex flex-col items-end gap-1">
                    <span className="text-base font-bold text-slate-800">
                      {currencyFormatter.format(displayTotal)}
                    </span>
                    <div className="flex items-center gap-1.5">
                      {isCredit ? (
                        <CreditCard size={11} className="text-violet-500" />
                      ) : (
                        <Banknote size={11} className="text-emerald-500" />
                      )}
                      <span className={`text-[11px] font-semibold ${isPaid ? 'text-emerald-600' : 'text-amber-600'}`}>
                        {isCredit ? 'Credit' : 'Cash'} · {isPaid ? 'Paid' : 'Pending'}
                      </span>
                    </div>
                  </div>
                  {isExpanded
                    ? <ChevronUp size={15} className="shrink-0 text-slate-400" />
                    : <ChevronDown size={15} className="shrink-0 text-slate-400" />
                  }
                </div>
              </button>

              {/* ── Card body — visible only when expanded ── */}
              {isExpanded && <div className="grid gap-4 p-4 sm:grid-cols-2">

                {/* Charges breakdown */}
                <div>
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Charges</p>
                  <dl className="space-y-1">
                    {doctorCharge > 0 && (
                      <div className="flex justify-between text-sm">
                        <dt className="text-slate-500">Doctor fee</dt>
                        <dd className="font-medium text-slate-800">{currencyFormatter.format(doctorCharge)}</dd>
                      </div>
                    )}
                    {surgeryCharge > 0 && (
                      <div className="flex justify-between text-sm">
                        <dt className="text-slate-500">Surgery</dt>
                        <dd className="font-medium text-slate-800">{currencyFormatter.format(surgeryCharge)}</dd>
                      </div>
                    )}
                    {otherCharge > 0 && (
                      <div className="flex justify-between text-sm">
                        <dt className="text-slate-500">{entry.otherChargeReason || 'Service'}</dt>
                        <dd className="font-medium text-slate-800">{currencyFormatter.format(otherCharge)}</dd>
                      </div>
                    )}
                    {medSubtotal > 0 && (
                      <div className="flex justify-between text-sm">
                        <dt className="text-slate-500">Medicines</dt>
                        <dd className="font-medium text-slate-800">{currencyFormatter.format(medSubtotal)}</dd>
                      </div>
                    )}
                    {discount > 0 && (
                      <div className="flex justify-between text-sm">
                        <dt className="text-slate-500">Discount</dt>
                        <dd className="font-medium text-rose-600">−{currencyFormatter.format(discount)}</dd>
                      </div>
                    )}
                    <div className="flex justify-between border-t border-slate-100 pt-1 text-sm">
                      <dt className="font-semibold text-slate-700">Total</dt>
                      <dd className="font-bold text-slate-900">{currencyFormatter.format(displayTotal)}</dd>
                    </div>
                  </dl>
                </div>

                {/* Medicines dispensed */}
                <div>
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                    <span className="inline-flex items-center gap-1"><Pill size={11} /> Medicines dispensed</span>
                  </p>
                  {medicines.length === 0 ? (
                    <p className="text-xs text-slate-400">No medicines recorded</p>
                  ) : (
                    <ul className="space-y-1">
                      {medicines.map((med, idx) => {
                        const label = getMedLabel(med);
                        const qty = med.quantity ?? med.qty ?? '';
                        return (
                          <li key={idx} className="flex items-baseline justify-between gap-2 text-sm">
                            <span className="text-slate-700 truncate">{label}</span>
                            {qty !== '' && (
                              <span className="shrink-0 rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] font-semibold text-slate-600">
                                ×{qty}
                              </span>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>

                {/* Notes */}
                {entry.notes && (
                  <div className="sm:col-span-2">
                    <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Notes</p>
                    <p className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                      {entry.notes}
                    </p>
                  </div>
                )}

                {/* Vaccine follow-up */}
                {hasVaccine && (
                  <div className="sm:col-span-2 flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
                    <Syringe size={14} className="mt-0.5 shrink-0 text-emerald-600" />
                    <div className="text-xs text-emerald-800">
                      <span className="font-semibold">{vacPlan.vaccineName || 'Vaccine'}</span>
                      {vacPlan.nextDueAt && (
                        <span className="ml-2 text-emerald-600">
                          · Next due: {new Date(vacPlan.nextDueAt).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>}
            </div>
          );
        })}
      </div>
    );
  };

  // ── Reports tab ────────────────────────────────────────
  const renderReportsTab = () => {
    const reports = diagnosticReports || [];
    return (
      <div className="space-y-3">
        {!editingId && patientReportsError && (
          <div className="rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-xs text-rose-700">
            {patientReportsError}
          </div>
        )}
        {!editingId && patientReportsLoading && (
          <p className="text-xs text-slate-400">Loading diagnostics…</p>
        )}
        {diagnosticCards.map((card) => {
          const reportsForType = reports
            .filter((e) => e.type === card.id)
            .sort((a, b) => {
              const tA = new Date(a.reportedAt || a.createdAt || 0).valueOf();
              const tB = new Date(b.reportedAt || b.createdAt || 0).valueOf();
              return tB - tA;
            });
          const uploadKeyNew = makeUploadKey(card.id, 'new');
          const uploadStateNew = reportUploadState?.[uploadKeyNew];
          const busyNew = uploadStateNew?.status === 'uploading' || uploadStateNew?.status === 'saving';

          return (
            <div key={card.id} className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${card.iconBg}`}>
                    <card.Icon size={17} className={card.accent} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{card.label}</p>
                    <p className="text-[11px] text-slate-400">
                      {reportsForType.length > 0
                        ? `${reportsForType.length} file${reportsForType.length > 1 ? 's' : ''} uploaded`
                        : card.emptyStatus}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={busyNew}
                    onClick={() => requestReportUpload(card.id)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 disabled:opacity-50"
                  >
                    <Upload size={11} />
                    {busyNew ? (uploadStateNew?.status === 'uploading' ? 'Uploading…' : 'Saving…') : 'Add file'}
                  </button>
                  <input
                    type="file"
                    accept="application/pdf,image/*"
                    className="hidden"
                    ref={(node) => registerUploadInput?.(uploadKeyNew, node)}
                    onChange={(event) => onReportInputChange(card.id, null, event)}
                  />
                </div>
              </div>
              {uploadStateNew?.status === 'error' && (
                <p className="px-4 py-1.5 text-xs text-rose-600">{uploadStateNew.error}</p>
              )}
              {reportsForType.length > 0 && (
                <div className="divide-y divide-slate-100">
                  {reportsForType.map((report) => {
                    const uploadKeyReplace = makeUploadKey(card.id, report.clientId);
                    const uploadStateReplace = reportUploadState?.[uploadKeyReplace];
                    const busyReplace = uploadStateReplace?.status === 'uploading' || uploadStateReplace?.status === 'saving';
                    const fileBytesValue = Number(report.fileBytes);
                    return (
                      <div key={report.clientId} className="flex flex-wrap items-center gap-3 px-4 py-3">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-slate-800">{report.label}</p>
                          <p className="text-[11px] text-slate-400">
                            {formatReportDisplayDate(report.reportedAt)}
                            {Number.isFinite(fileBytesValue) && fileBytesValue > 0
                              ? ` · ${(fileBytesValue / 1024).toFixed(1)} KB`
                              : ''}
                          </p>
                          {uploadStateReplace?.status === 'error' && (
                            <p className="mt-0.5 text-[11px] text-rose-600">{uploadStateReplace.error}</p>
                          )}
                        </div>
                        <div className="flex shrink-0 items-center gap-1.5">
                          <a
                            href={report.fileUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-xs font-semibold text-blue-700 transition hover:bg-blue-100"
                          >
                            <ExternalLink size={11} /> View
                          </a>
                          <button
                            type="button"
                            disabled={busyReplace}
                            onClick={() => requestReportUpload(card.id, report.clientId)}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 disabled:opacity-50"
                          >
                            <RefreshCw size={11} />
                            {busyReplace ? 'Saving…' : 'Replace'}
                          </button>
                          <input
                            type="file"
                            accept="application/pdf,image/*"
                            className="hidden"
                            ref={(node) => registerUploadInput?.(uploadKeyReplace, node)}
                            onChange={(event) => onReportInputChange(card.id, report.clientId, event)}
                          />
                          <button
                            type="button"
                            onClick={() => onReportRemove(report.clientId)}
                            className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs font-semibold text-rose-600 transition hover:bg-rose-100"
                          >
                            <Trash2 size={11} /> Remove
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[240px,1fr]">
      {/* Patient identity card */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-blue-100 text-2xl font-bold text-blue-600">
            {selectedPatient?.name ? selectedPatient.name.charAt(0).toUpperCase() : <PawPrint size={22} />}
          </div>
          <div className="min-w-0">
            <p className="truncate text-base font-semibold text-slate-800">
              {selectedPatient?.name || 'Unnamed patient'}
            </p>
            <p className="text-xs text-slate-400">
              {selectedPatient?.passbookNumber ? `PB #${selectedPatient.passbookNumber}` : 'Passbook pending'}
            </p>
          </div>
        </div>
        <dl className="grid grid-cols-2 gap-3">
          {selectedPatient?.species && (
            <div>
              <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Species</dt>
              <dd className="mt-0.5 text-sm font-medium text-slate-700">{selectedPatient.species}</dd>
            </div>
          )}
          {selectedPatient?.breed && (
            <div>
              <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Breed</dt>
              <dd className="mt-0.5 text-sm font-medium text-slate-700">{selectedPatient.breed}</dd>
            </div>
          )}
          {ageLabel && (
            <div>
              <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Age</dt>
              <dd className="mt-0.5 text-sm font-medium text-slate-700">{ageLabel}</dd>
            </div>
          )}
          {selectedPatient?.weight && (
            <div>
              <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Weight</dt>
              <dd className="mt-0.5 text-sm font-medium text-slate-700">{selectedPatient.weight} kg</dd>
            </div>
          )}
          {selectedPatient?.gender && (
            <div>
              <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Gender</dt>
              <dd className="mt-0.5 text-sm font-medium text-slate-700">
                {selectedPatient.gender.charAt(0).toUpperCase() + selectedPatient.gender.slice(1)}
              </dd>
            </div>
          )}
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Visits</dt>
            <dd className="mt-0.5 text-sm font-bold text-blue-600">{history.length}</dd>
          </div>
        </dl>
      </div>

      {/* Tabs panel */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="flex gap-1 border-b border-slate-100 bg-slate-50 px-4 py-2.5">
          {tabs.map((tab) => {
            const active = profileTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onProfileTabChange(tab.id)}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  active
                    ? 'bg-white shadow-sm border border-slate-200 text-blue-700'
                    : 'text-slate-500 hover:text-slate-700 hover:bg-white/60'
                }`}
              >
                <tab.Icon size={13} />
                {tab.label}
                {tab.id === 'history' && history.length > 0 && (
                  <span className="ml-0.5 rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] font-bold text-blue-700">
                    {history.length}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <div className="p-5 overflow-y-auto max-h-[70vh]">
          {profileTab === 'owner'   && renderOwnerTab()}
          {profileTab === 'history' && renderHistoryTab()}
          {profileTab === 'reports' && renderReportsTab()}
        </div>
      </div>
    </div>
  );
};

export default PatientProfileTabs;
