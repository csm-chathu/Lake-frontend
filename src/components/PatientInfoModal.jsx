import { X } from 'lucide-react';
import { useState } from 'react';
import { createPortal } from 'react-dom';
import PatientProfileTabs from './PatientProfileTabs.jsx';

const PatientInfoModal = ({
  open,
  onClose,
  selectedPatient,
  selectedOwner,
  history,
  currencyFormatter,
  startedTreatment,
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
  const [profileTab, setProfileTab] = useState('owner');

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="relative mt-2 w-full max-w-5xl rounded-2xl border border-slate-200 bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-5 py-3.5 rounded-t-2xl">
          <div>
            <h2 className="text-base font-semibold text-slate-800">Patient profile</h2>
            {selectedPatient?.name && (
              <p className="text-xs text-slate-400">{selectedPatient.name}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:border-slate-300 hover:bg-slate-100"
          >
            <X size={15} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5">
          <PatientProfileTabs
            selectedPatient={selectedPatient}
            selectedOwner={selectedOwner}
            history={history}
            currencyFormatter={currencyFormatter}
            profileTab={profileTab}
            onProfileTabChange={setProfileTab}
            startedTreatment={startedTreatment}
            diagnosticReports={diagnosticReports}
            patientReportsLoading={patientReportsLoading}
            patientReportsError={patientReportsError}
            reportUploadState={reportUploadState}
            requestReportUpload={requestReportUpload}
            onReportInputChange={onReportInputChange}
            onReportRemove={onReportRemove}
            formatReportDisplayDate={formatReportDisplayDate}
            makeUploadKey={makeUploadKey}
            registerUploadInput={registerUploadInput}
            editingId={editingId}
          />
        </div>
      </div>
    </div>
  , document.body);
};

export default PatientInfoModal;
