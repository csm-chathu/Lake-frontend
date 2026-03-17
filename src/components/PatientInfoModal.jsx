import React, { useState } from 'react';
import PatientProfileTabs from './PatientProfileTabs.jsx';

// This component wraps the existing profile tabs inside a self-contained
// modal. It keeps its own tab state so the selection inside the popup does
// not interfere with any tabs that may be rendered elsewhere.

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

  return (
    <div
      className="modal modal-open"
      onClick={(e) => {
        // close only when clicking outside the modal-box
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      style={{marginTop:'-1px'}}
    >
      <div className="modal-box relative z-50 w-full max-w-5xl" onClick={(e) => e.stopPropagation()} > 
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Patient profile</h2>
          <button className="btn btn-sm btn-ghost" onClick={onClose}>Close</button>
        </div>
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
  );
};

export default PatientInfoModal;
