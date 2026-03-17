import React, { useEffect, useMemo, useState } from 'react';

const normalize = (value) => String(value ?? '').toLowerCase().trim();

const PatientSearch = ({
  query,
  onQueryChange,
  patients,
  onSelectPatient,
  onCreatePatient,
  selectedPatient,
  renderCreateForm,
  inlineRight = null
}) => {

  const normalizedQuery = normalize(query);
  const hasAnyPatients = Array.isArray(patients) && patients.length > 0;
  const [showInlineCreate, setShowInlineCreate] = useState(false);

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
        const passbook = normalize(patient.passbookNumber || patient.passbook_number || '');
        const ownerName = normalize(patient.ownerName);
        const ownerEmail = normalize(patient.owner?.email || '');
        const ownerPhone = normalize(patient.owner?.phone || '');
        return (
          patientName.includes(normalizedQuery) ||
          passbook.includes(normalizedQuery) ||
          ownerName.includes(normalizedQuery) ||
          ownerEmail.includes(normalizedQuery) ||
          ownerPhone.includes(normalizedQuery)
        );
      })
      .slice(0, 8);
  }, [normalizedQuery, patients]);

  const showCreatePrompt = Boolean(
    (normalizedQuery && filteredPatients.length === 0) || (!normalizedQuery && !hasAnyPatients)
  );

  const isQuerySelected = Boolean(
    selectedPatient && normalize(selectedPatient.name) === normalizedQuery
  );
  const showSuggestions = normalizedQuery && filteredPatients.length > 0 && !isQuerySelected;

  useEffect(() => {
    setShowInlineCreate(false);
  }, [normalizedQuery]);

  const searchColClass = inlineRight ? 'md:col-span-5' : 'md:col-span-12';
  const rightColClass = 'md:col-span-7';

  return (
    <>
      <div className="space-y-4">
        <div className="grid gap-3 md:grid-cols-12 md:items-end">
          <label htmlFor="patient-search" className={`flex flex-col gap-2 w-full ${searchColClass}`}>
            <span className="text-sm font-medium text-slate-600">Patient Name / Passbook number or phone number</span>
            <div className="relative">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                aria-hidden="true"
              >
                <circle cx="11" cy="11" r="7" />
                <line x1="16.65" y1="16.65" x2="21" y2="21" />
              </svg>
              <input
                id="patient-search"
                type="search"
                value={query}
                onChange={(event) => onQueryChange(event.target.value)}
                placeholder="Search by patient name, passbook number or phone number"
                className="input input-bordered w-full pl-9"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
              />
            </div>
          </label>
          {inlineRight ? <div className={rightColClass}>{inlineRight}</div> : null}
        </div>

      {!normalizedQuery && (
        <p className="text-xs text-slate-500">Start typing to search for an existing patient.</p>
      )}

      {showSuggestions && (
        <ul className="menu rounded-box border border-sky-200 bg-sky-50 shadow-lg ring-1 ring-sky-100">
          {filteredPatients.map((patient) => (
            <li key={patient.id}>
              <button
                type="button"
                onClick={() => onSelectPatient(patient)}
                className="flex flex-col items-start gap-1 px-4 py-3 text-left hover:bg-sky-100/90 focus:bg-sky-100/90"
              >
                <div className="flex w-full flex-wrap items-center gap-2 text-sm font-semibold text-slate-700">
                  <span>{patient.name}</span>
                  {patient.gender && (
                    <span className="badge badge-sm badge-outline ml-1">
                      {patient.gender.charAt(0).toUpperCase() + patient.gender.slice(1)}
                    </span>
                  )}
                  {(patient.passbookNumber || patient.passbook_number) && (
                    <span className="badge badge-sm border-sky-300 bg-white text-sky-700">
                      {patient.passbookNumber || patient.passbook_number}
                    </span>
                  )}
                </div>
                {patient.owner && (
                  <span className="text-xs text-slate-500">
                    Owner: {patient.ownerName || '—'}
                    {patient.owner.phone ? ` • ${patient.owner.phone}` : ''}
                  </span>
                )}
                <span className="text-xs text-slate-500 whitespace-nowrap">
                  {(() => {
                    const years = Number.parseInt(patient.ageYears, 10);
                    const months = Number.parseInt(patient.ageMonths, 10);
                    const parts = [];
                    if (!Number.isNaN(years) && years > 0) {
                      parts.push(`${years} yr${years > 1 ? 's' : ''}`);
                    }
                    if (!Number.isNaN(months) && months > 0) {
                      parts.push(`${months} mo${months > 1 ? 's' : ''}`);
                    }
                    const ageString = parts.length ? `Age: ${parts.join(' ')}` : 'Age not recorded';
                    const weightString = patient.weight != null ? ` • ${patient.weight} kg` : '';
                    return ageString + weightString;
                  })()}
                </span>
              </button>
            </li>
          ))}

        </ul>
      )}

      {/* always show registration form if parent provided one */}
      {renderCreateForm && (
        <div className="mt-4 w-full max-w-none">
          {renderCreateForm({ normalizedQuery, query, filteredPatients })}
        </div>
      )}


      </div>
    </>
  );
};

export default PatientSearch;
