import { Link } from 'react-router-dom';
import {
  StartTreatmentIcon,
  OwnerTabIcon,
  HistoryTabIcon,
  ReportsTabIcon,
  BloodReportIcon,
  XrayIcon,
  LabSummaryIcon
} from './PatientProfileIcons.jsx';

const PatientProfileTabs = ({
  selectedPatient,
  selectedOwner,
  history = [],
  currencyFormatter,
  profileTab,
  onProfileTabChange,
  startedTreatment,
  onStartTreatment,
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
  editingId
}) => {
  const ageParts = [];
  const years = Number.parseInt(selectedPatient?.ageYears, 10);
  const months = Number.parseInt(selectedPatient?.ageMonths, 10);
  if (!Number.isNaN(years) && years > 0) {
    ageParts.push(`${years} yr${years > 1 ? 's' : ''}`);
  }
  if (!Number.isNaN(months) && months > 0) {
    ageParts.push(`${months} mo${months > 1 ? 's' : ''}`);
  }
  const ageLabel = ageParts.length ? ageParts.join(' ') : 'Not recorded';

  const infoRows = [
    { label: 'Age (years)', value: Number.isFinite(years) && years > 0 ? years : 'Not recorded' },
    { label: 'Age (months)', value: Number.isFinite(months) && months > 0 ? months : 'Not recorded' },
    { label: 'Weight', value: selectedPatient?.weight ? `${selectedPatient.weight} kg` : '—' }
  ];

  const diagnosticCards = [
    {
      id: 'blood',
      label: 'Blood report',
      status: 'Pending upload',
      accent: 'bg-rose-50 text-rose-700',
      iconBg: 'bg-rose-100/80',
      Icon: BloodReportIcon
    },
    {
      id: 'xray',
      label: 'X-ray',
      status: 'No file attached',
      accent: 'bg-sky-50 text-sky-700',
      iconBg: 'bg-sky-100/80',
      Icon: XrayIcon
    },
    {
      id: 'labs',
      label: 'Lab summary',
      status: 'Add latest lab notes',
      accent: 'bg-emerald-50 text-emerald-700',
      iconBg: 'bg-emerald-100/80',
      Icon: LabSummaryIcon
    }
  ];

  const tabs = [
    {
      id: 'owner',
      label: 'Owner details',
      Icon: OwnerTabIcon,
      iconBg: 'bg-amber-100/70 text-amber-600'
    },
    {
      id: 'history',
      label: 'Medical history',
      Icon: HistoryTabIcon,
      iconBg: 'bg-indigo-100/70 text-indigo-600'
    },
    {
      id: 'reports',
      label: 'Diagnostics',
      Icon: ReportsTabIcon,
      iconBg: 'bg-emerald-100/70 text-emerald-600'
    }
  ];

  const renderOwnerTab = () => (
    <div className="grid gap-4 sm:grid-cols-2 text-sm text-slate-600">
      <div>
        <p className="text-xs uppercase tracking-wide text-slate-400">Owner</p>
        <p className="text-base font-semibold text-slate-800 mt-1">{selectedOwner?.firstName || 'Not assigned'}</p>
        <p className="text-xs text-slate-500">
          {selectedOwner ? 'Primary guardian on file.' : 'Link this patient to an owner from the Patients page.'}
        </p>
      </div>
      <div>
        <p className="text-xs uppercase tracking-wide text-slate-400">Phone</p>
        <p className="text-base font-medium text-slate-800 mt-1">{selectedOwner?.phone || '—'}</p>
        <p className="text-xs text-slate-500">Emergency contact</p>
      </div>
      <div className="sm:col-span-2">
        <p className="text-xs uppercase tracking-wide text-slate-400">Notes</p>
        <p className="mt-1 rounded-xl border border-dashed border-base-300 bg-base-200/40 p-3 text-sm text-slate-700">
          {selectedOwner?.notes || 'No extra notes recorded for this owner.'}
        </p>
        {/* <p className="mt-2 hidden text-xs text-primary sm:block">
          <Link to="/owners" className="link link-primary">Update owner record</Link>
        </p> */}
      </div>
    </div>
  );

  const renderHistoryTab = () => (
    !Array.isArray(history) || history.length === 0 ? (
      <div className="rounded-xl border border-dashed border-base-300 bg-base-100 p-6 text-sm text-slate-500">
        No previous visits logged for this patient.
      </div>
    ) : (
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-base-200 text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-slate-400">
              <th className="py-2 pr-4">Date</th>
              <th className="py-2 pr-4">Reason</th>
              <th className="py-2 text-right">Charges</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-base-200">
            {history.map((entry) => {
              const visitDate = entry.date ? new Date(entry.date) : null;
              const dateLabel = visitDate ? visitDate.toLocaleDateString() : '—';
              const timeLabel = visitDate ? visitDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
              return (
                <tr key={`history-${entry.id}`} className="text-slate-700">
                  <td className="py-2 pr-4">
                    <div className="font-medium">{dateLabel}</div>
                    <div className="text-xs text-slate-500">{timeLabel}</div>
                  </td>
                  <td className="py-2 pr-4">{entry.reason || '—'}</td>
                  <td className="py-2 text-right font-semibold">{currencyFormatter.format(entry.totalCharge || 0)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    )
  );

  const renderReportsTab = () => {
    const reports = diagnosticReports || [];
    return (
      <div className="space-y-4">
        {!editingId && patientReportsError && (
          <div className="rounded-xl border border-rose-100 bg-rose-50 p-3 text-xs text-rose-700">
            {patientReportsError}
          </div>
        )}
        {!editingId && patientReportsLoading && (
          <div className="text-xs text-slate-500">Loading patient diagnostics…</div>
        )}
        {diagnosticCards.map((card) => {
          const reportsForType = reports
            .filter((entry) => entry.type === card.id)
            .sort((a, b) => {
              const timeA = new Date(a.reportedAt || a.createdAt || a.updatedAt || 0).valueOf() || 0;
              const timeB = new Date(b.reportedAt || b.createdAt || b.updatedAt || 0).valueOf() || 0;
              return timeB - timeA;
            });
          const uploadKeyNew = makeUploadKey(card.id, 'new');
          const uploadStateNew = reportUploadState[uploadKeyNew];
          const uploadingNew = uploadStateNew?.status === 'uploading';
          const savingNew = uploadStateNew?.status === 'saving';
          return (
            <div
              key={card.id}
              className="rounded-2xl border border-base-200 bg-base-100 p-5 shadow-sm"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${card.iconBg}`}>
                    {card.Icon ? <card.Icon /> : null}
                  </div>
                  <div>
                    <p className="text-base font-semibold text-slate-800">{card.label}</p>
                    <p className={`text-xs font-medium ${card.accent}`}>
                      {reportsForType.length > 0
                        ? `${reportsForType.length} uploaded`
                        : card.status}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="btn btn-xs btn-outline"
                    disabled={uploadingNew || savingNew}
                    onClick={() => requestReportUpload(card.id)}
                  >
                    {uploadingNew ? 'Uploading…' : savingNew ? 'Saving…' : 'Add file'}
                  </button>
                  <input
                    type="file"
                    accept="application/pdf,image/*"
                    className="hidden"
                    ref={(node) => registerUploadInput?.(uploadKeyNew, node)}
                    onChange={(event) => onReportInputChange(card.id, null, event)}
                  />
                </div>
                {uploadStateNew?.status === 'error' && (
                  <p className="text-xs text-rose-600">{uploadStateNew.error}</p>
                )}
              </div>
              {reportsForType.length === 0 ? (
                <p className="mt-3 text-sm text-slate-500">
                  Attach lab reports, imaging files, or any supporting document for this category.
                </p>
              ) : (
                <div className="mt-4 overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="text-xs uppercase tracking-wide text-slate-400">
                        <th className="py-2 pr-4 text-left">Label</th>
                        <th className="py-2 pr-4 text-left">Uploaded</th>
                        <th className="py-2 pr-4 text-left">Type</th>
                        <th className="py-2 pr-4 text-left">Size</th>
                        <th className="py-2 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-base-200">
                      {reportsForType.map((report) => {
                        const uploadKeyReplace = makeUploadKey(card.id, report.clientId);
                        const uploadStateReplace = reportUploadState[uploadKeyReplace];
                        const replacing = uploadStateReplace?.status === 'uploading';
                        const savingReplace = uploadStateReplace?.status === 'saving';
                        const fileBytesValue = Number(report.fileBytes);
                        return (
                          <tr key={report.clientId}>
                            <td className="py-2 pr-4 font-medium text-slate-800">{report.label}</td>
                            <td className="py-2 pr-4 text-slate-500">{formatReportDisplayDate(report.reportedAt)}</td>
                            <td className="py-2 pr-4 text-slate-500">{report.mimeType || '—'}</td>
                            <td className="py-2 pr-4 text-slate-500">
                              {Number.isFinite(fileBytesValue) && fileBytesValue > 0
                                ? `${(fileBytesValue / 1024).toFixed(1)} KB`
                                : '—'}
                            </td>
                            <td className="py-2 text-right">
                              <div className="flex flex-wrap justify-end gap-2">
                                <a
                                  href={report.fileUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="btn btn-xs btn-primary"
                                >
                                  View
                                </a>
                                <button
                                  type="button"
                                  className="btn btn-xs btn-outline"
                                  disabled={replacing || savingReplace}
                                  onClick={() => requestReportUpload(card.id, report.clientId)}
                                >
                                  {replacing ? 'Replacing…' : savingReplace ? 'Saving…' : 'Replace'}
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
                                  className="btn btn-xs btn-outline btn-error"
                                  onClick={() => onReportRemove(report.clientId)}
                                >
                                  Remove
                                </button>
                              </div>
                              {uploadStateReplace?.status === 'error' && (
                                <div className="mt-1 text-[11px] text-rose-600">{uploadStateReplace.error}</div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[320px,1fr]">
      <div className="rounded-2xl border border-base-300 bg-base-100 p-5 shadow-sm space-y-4">
        <div className="flex items-start gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-2xl font-semibold text-primary">
            {selectedPatient?.name ? selectedPatient.name.charAt(0).toUpperCase() : '🐾'}
          </div>
          <div>
            <p className="text-xl font-semibold text-slate-800 whitespace-nowrap truncate">
              {selectedPatient?.name || 'Unnamed patient'}
              {(ageLabel !== 'Not recorded' || selectedPatient?.weight != null) && (
                <span className="text-base font-normal text-slate-500">
                  {` — ${ageLabel}${selectedPatient?.weight != null ? `, ${selectedPatient.weight} kg` : ''}`}
                </span>
              )}
            </p>
            <p className="text-sm text-slate-500">{selectedPatient?.passbookNumber ? `Passbook ${selectedPatient.passbookNumber}` : 'Passbook pending'}</p>
          </div>
        </div>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
          {infoRows.map((row) => (
            <div key={`info-${row.label}`}>
              <dt className="text-xs uppercase tracking-wide text-slate-400">{row.label}</dt>
              <dd className="text-sm font-medium text-slate-800">{row.value}</dd>
            </div>
          ))}
        </dl>
        {/* {startedTreatment ? (
          <span className="badge border-none bg-emerald-100 text-emerald-700">Treatment in progress</span>
        ) : (
          <button
            type="button"
            className="btn btn-primary w-full gap-2"
            onClick={onStartTreatment}
          >
            <StartTreatmentIcon className="h-4 w-4" />
            Start treatment
          </button>
        )} */}
      </div>
      <div className="rounded-2xl border border-base-300 bg-base-100 shadow-sm">
        <div className="border-b border-base-200 px-5 pt-4">
          <div role="tablist" className="tabs tabs-boxed bg-base-100/40">
            {tabs.map((tab) => {
              const active = profileTab === tab.id;
              const Icon = tab.Icon;
              return (
                <button
                  type="button"
                  role="tab"
                  aria-selected={active}
                  key={tab.id}
                  onClick={() => onProfileTabChange(tab.id)}
                  className={`tab gap-2 text-xs font-semibold ${active ? 'tab-active text-primary' : 'text-slate-500'}`}
                >
                  {Icon ? (
                    <span className={`flex h-7 w-7 items-center justify-center rounded-full ${tab.iconBg}`}>
                      <Icon className="h-3.5 w-3.5" />
                    </span>
                  ) : null}
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
        <div className="p-5">
          {profileTab === 'owner' && renderOwnerTab()}
          {profileTab === 'history' && renderHistoryTab()}
          {profileTab === 'reports' && renderReportsTab()}
        </div>
      </div>
    </div>
  );
};

export default PatientProfileTabs;
