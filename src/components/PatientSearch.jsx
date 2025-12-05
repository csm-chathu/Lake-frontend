import React, { useEffect, useMemo, useState } from 'react';

const normalize = (value) => String(value ?? '').toLowerCase().trim();

const formatStatus = (status = '') => status.replace(/^[a-z]/, (match) => match.toUpperCase());

const formatDate = (value) => {
  if (!value) return 'Date pending';
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) {
    return 'Date pending';
  }
  return date.toLocaleString();
};

const currencyFormatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

const formatCurrency = (value) => {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const numeric = typeof value === 'number' ? value : Number.parseFloat(value);
  if (Number.isNaN(numeric)) {
    return null;
  }
  return currencyFormatter.format(numeric);
};

const PatientSearch = ({
  query,
  onQueryChange,
  patients,
  onSelectPatient,
  onCreatePatient,
  selectedPatient
}) => {
  const [historyModalOpen, setHistoryModalOpen] = useState(false);

  const normalizedQuery = normalize(query);
  const hasAnyPatients = Array.isArray(patients) && patients.length > 0;

  const filteredPatients = useMemo(() => {
    if (!normalizedQuery) return [];

    return patients
      .map((patient) => ({
        ...patient,
        ownerName: patient.owner ? `${patient.owner.firstName || ''} ${patient.owner.lastName || ''}`.trim() : ''
      }))
      .filter((patient) => {
        if (!normalizedQuery) return false;
        const patientName = normalize(patient.name);
        const ownerName = normalize(patient.ownerName);
        const ownerEmail = normalize(patient.owner?.email || '');
        const ownerPhone = normalize(patient.owner?.phone || '');
        return (
          patientName.includes(normalizedQuery) ||
          ownerName.includes(normalizedQuery) ||
          ownerEmail.includes(normalizedQuery) ||
          ownerPhone.includes(normalizedQuery)
        );
      })
      .slice(0, 8);
  }, [normalizedQuery, patients]);

  const history = useMemo(() => {
    if (!selectedPatient?.appointments) return [];
    return [...selectedPatient.appointments].sort((a, b) => {
      const dateA = new Date(a.date).valueOf() || 0;
      const dateB = new Date(b.date).valueOf() || 0;
      return dateB - dateA;
    });
  }, [selectedPatient]);

  const previewHistory = history.slice(0, 2);
  const hasMoreHistory = history.length > 2;

  useEffect(() => {
    setHistoryModalOpen(false);
  }, [selectedPatient?.id]);

  const HistoryEntry = ({ appointment, isLast }) => {
    const statusClassMap = {
      scheduled: 'badge-info',
      completed: 'badge-success',
      cancelled: 'badge-error'
    };
    const badgeClass = statusClassMap[appointment.status] || 'badge-ghost';
    const chargeDisplay = formatCurrency(appointment.doctorCharge);

    return (
      <article className={`relative pb-6 ${isLast ? 'pb-0' : ''}`}>
        <span className="absolute -left-2 top-2 h-2.5 w-2.5 rounded-full bg-primary"></span>
        {!isLast && <span className="absolute -left-[1px] top-3 h-full w-px bg-base-300"></span>}
        <div className="rounded-2xl border border-base-200 bg-base-200/50 p-4 shadow-sm">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-semibold text-slate-800">{formatDate(appointment.date)}</span>
            <span className={`badge badge-sm ${badgeClass}`}>{formatStatus(appointment.status)}</span>
          </div>
          <p className="text-sm text-slate-600">{appointment.reason || 'No reason provided.'}</p>
          <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-500">
            {appointment.veterinarian && (
              <span className="inline-flex items-center gap-1">
                <span className="font-medium text-slate-600">Vet:</span>
                {appointment.veterinarian.firstName} {appointment.veterinarian.lastName}
              </span>
            )}
            {appointment.isWalkIn && <span className="badge badge-ghost badge-sm">Walk-in</span>}
            {chargeDisplay && (
              <span className="inline-flex items-center gap-1">
                <span className="font-medium text-slate-600">Charge:</span>
                {chargeDisplay}
              </span>
            )}
          </div>
          {appointment.notes && (
            <p className="mt-2 rounded-xl bg-base-100/60 p-2 text-xs text-slate-600">
              <span className="font-medium text-slate-700">Notes:</span> {appointment.notes}
            </p>
          )}
        </div>
      </article>
    );
  };

  const showCreatePrompt = Boolean(
    (normalizedQuery && filteredPatients.length === 0) || (!normalizedQuery && !hasAnyPatients)
  );

  return (
    <>
      <div className="space-y-4">
      <label htmlFor="patient-search" className="flex flex-col gap-2">
        <span className="text-sm font-medium text-slate-600">Patient</span>
        <input
          id="patient-search"
          type="search"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Search by patient, owner, email, or phone"
          className="input input-bordered"
        />
      </label>

      {!normalizedQuery && (
        <p className="text-xs text-slate-500">Start typing to search for an existing patient.</p>
      )}

      {normalizedQuery && filteredPatients.length > 0 && (
        <ul className="menu rounded-box border border-base-300 bg-base-100 shadow-sm">
          {filteredPatients.map((patient) => (
            <li key={patient.id}>
              <button
                type="button"
                onClick={() => onSelectPatient(patient)}
                className="flex flex-col items-start gap-1 px-4 py-3 text-left hover:bg-base-200/80"
              >
                <span className="text-sm font-semibold text-slate-700">{patient.name}</span>
                {patient.owner && (
                  <span className="text-xs text-slate-500">
                    Owner: {patient.ownerName || '—'}
                    {patient.owner.phone ? ` • ${patient.owner.phone}` : ''}
                  </span>
                )}
                <span className="text-xs text-slate-500">
                  {[patient.species, patient.breed].filter(Boolean).join(' • ')}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {showCreatePrompt && (
        <div className="rounded-2xl border border-dashed border-base-300 bg-base-100 p-4 text-sm text-slate-600">
          <p className="mb-3">
            {normalizedQuery
              ? 'No matching patient found. Create a new patient record to continue.'
              : 'No patients recorded yet. Add your first patient to get started.'}
          </p>
          <button type="button" className="btn btn-sm btn-outline" onClick={onCreatePatient}>
            Add a new patient
          </button>
        </div>
      )}

      {selectedPatient && (
        <div className="space-y-4 rounded-2xl border border-base-300 bg-base-100 p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold text-slate-800">{selectedPatient.name}</h3>
              <p className="text-sm text-slate-500">
                {[selectedPatient.species, selectedPatient.breed].filter(Boolean).join(' • ') || 'Species not recorded'}
              </p>
              {typeof selectedPatient.age === 'number' && (
                <p className="text-xs text-slate-500">Age: {selectedPatient.age}</p>
              )}
            </div>
            {selectedPatient.owner && (
              <div className="rounded-xl bg-base-200 px-4 py-3 text-sm text-slate-700">
                <p className="font-medium">
                  {[selectedPatient.owner.firstName, selectedPatient.owner.lastName].filter(Boolean).join(' ') || 'Owner details'}
                </p>
                {selectedPatient.owner.phone && <p className="text-xs text-slate-500">{selectedPatient.owner.phone}</p>}
                {selectedPatient.owner.email && <p className="text-xs text-slate-500">{selectedPatient.owner.email}</p>}
              </div>
            )}
          </div>

          {selectedPatient.notes && (
            <p className="rounded-xl bg-base-200/80 p-3 text-sm text-slate-600">
              <span className="font-semibold text-slate-700">Clinical notes:</span> {selectedPatient.notes}
            </p>
          )}

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Medical history</h4>
              <span className="text-[10px] uppercase tracking-widest text-slate-400">
                {history.length} record{history.length === 1 ? '' : 's'}
              </span>
            </div>
            {history.length === 0 ? (
              <p className="text-sm text-slate-500">No previous appointments recorded.</p>
            ) : (
              <>
                <div className="relative border-l border-base-300 pl-5">
                  {previewHistory.map((appointment, index) => (
                    <HistoryEntry
                      key={appointment.id}
                      appointment={appointment}
                      isLast={index === previewHistory.length - 1}
                    />
                  ))}
                </div>
                {hasMoreHistory && (
                  <button
                    type="button"
                    className="btn btn-sm btn-outline"
                    onClick={() => setHistoryModalOpen(true)}
                  >
                    View {history.length - previewHistory.length} more
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      )}
      </div>
      {historyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4">
          <div className="max-h-[85vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-base-300 bg-base-100 p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h5 className="text-lg font-semibold text-slate-800">
                  {selectedPatient?.name ? `${selectedPatient.name}'s history` : 'Medical history'}
                </h5>
                <p className="text-xs text-slate-500">
                  {history.length} record{history.length === 1 ? '' : 's'} on file
                </p>
              </div>
              <button type="button" className="btn btn-sm btn-ghost" onClick={() => setHistoryModalOpen(false)}>
                Close
              </button>
            </div>
            {history.length === 0 ? (
              <p className="text-sm text-slate-500">No previous appointments recorded.</p>
            ) : (
              <div className="relative border-l border-base-300 pl-5">
                {history.map((appointment, index) => (
                  <HistoryEntry
                    key={`history-${appointment.id}`}
                    appointment={appointment}
                    isLast={index === history.length - 1}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default PatientSearch;
