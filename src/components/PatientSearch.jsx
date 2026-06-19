import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, UserPlus } from 'lucide-react';

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
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [inlineName, setInlineName] = useState('');
  const inlineNameEditedRef = useRef(false);
  const listRef = useRef(null);

  const filteredPatients = useMemo(() => {
    if (!normalizedQuery) return [];
    return patients
      .map((patient) => ({
        ...patient,
        ownerName: patient.owner
          ? `${patient.owner.firstName || ''} ${patient.owner.lastName || ''}`.trim()
          : ''
      }))
      .filter((patient) => {
        const patientName = normalize(patient.name);
        const passbook = normalize(patient.passbookNumber || patient.passbook_number || '');
        const ownerName = normalize(patient.ownerName);
        const ownerPhone = normalize(patient.owner?.phone || '');
        const ownerEmail = normalize(patient.owner?.email || '');
        return (
          patientName.includes(normalizedQuery) ||
          passbook.includes(normalizedQuery) ||
          ownerName.includes(normalizedQuery) ||
          ownerPhone.includes(normalizedQuery) ||
          ownerEmail.includes(normalizedQuery)
        );
      })
      .slice(0, 8);
  }, [normalizedQuery, patients]);

  const isQuerySelected = Boolean(
    selectedPatient && normalize(selectedPatient.name) === normalizedQuery
  );
  const showSuggestions = Boolean(normalizedQuery && filteredPatients.length > 0 && !isQuerySelected);
  const showCreatePrompt = Boolean(
    (normalizedQuery && filteredPatients.length === 0) || (!normalizedQuery && !hasAnyPatients)
  );

  // Reset highlight and create form when query changes
  useEffect(() => {
    setHighlightedIndex(-1);
    setShowInlineCreate(false);
  }, [normalizedQuery]);

  // Sync inline name from query while user hasn't manually edited it
  useEffect(() => {
    if (!showCreatePrompt) {
      inlineNameEditedRef.current = false;
      setInlineName('');
      return;
    }
    if (!inlineNameEditedRef.current) {
      setInlineName(query);
    }
  }, [showCreatePrompt, query]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlightedIndex < 0 || !listRef.current) return;
    const item = listRef.current.children[highlightedIndex];
    item?.scrollIntoView({ block: 'nearest' });
  }, [highlightedIndex]);

  const handleKeyDown = (e) => {
    if (!showSuggestions) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      e.stopPropagation(); // prevent page-level field navigation
      setHighlightedIndex((prev) => Math.min(prev + 1, filteredPatients.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      e.stopPropagation();
      setHighlightedIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter' && highlightedIndex >= 0) {
      e.preventDefault();
      onSelectPatient(filteredPatients[highlightedIndex]);
      setHighlightedIndex(-1);
    } else if (e.key === 'Escape') {
      setHighlightedIndex(-1);
    }
  };

  return (
    <div className="space-y-1.5">
      {/* Search row — name input appears inline when registering a new patient */}
      <div className="flex items-center gap-1.5">
        <div className="relative flex-1">
          <Search
            size={11}
            className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-slate-400"
            aria-hidden="true"
          />
          <input
            id="patient-search"
            type="search"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search by name, passbook or phone…"
            className="input input-sm input-bordered w-full pl-6 bg-white text-sm text-slate-800 placeholder:text-slate-400 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-100"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
          />
        </div>

        {/* Inline name input — shown only when creating a new patient */}
        {showCreatePrompt && renderCreateForm && (
          <>
            <div className="h-3.5 w-px shrink-0 bg-slate-200" />
            <div className="relative shrink-0">
              <UserPlus size={10} className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-blue-400" />
              <input
                type="text"
                value={inlineName}
                onChange={(e) => {
                  inlineNameEditedRef.current = true;
                  setInlineName(e.target.value);
                }}
                placeholder="Patient name *"
                className="input input-xs input-bordered w-36 pl-6 bg-blue-50 text-xs text-slate-800 placeholder:text-blue-300 border-blue-200 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-100"
              />
            </div>
          </>
        )}
        {inlineRight && <div>{inlineRight}</div>}
      </div>

      {/* Dropdown results */}
      {showSuggestions && (
        <ul
          ref={listRef}
          className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg"
          role="listbox"
        >
          {filteredPatients.map((patient, index) => {
            const highlighted = index === highlightedIndex;
            const ageYears  = Number.parseInt(patient.ageYears, 10);
            const ageMonths = Number.parseInt(patient.ageMonths, 10);
            const ageParts  = [];
            if (!Number.isNaN(ageYears)  && ageYears  > 0) ageParts.push(`${ageYears} yr${ageYears > 1 ? 's' : ''}`);
            if (!Number.isNaN(ageMonths) && ageMonths > 0) ageParts.push(`${ageMonths} mo${ageMonths > 1 ? 's' : ''}`);
            const ageString = ageParts.length ? ageParts.join(' ') : null;

            return (
              <li key={patient.id} role="option" aria-selected={highlighted}>
                <button
                  type="button"
                  onClick={() => { onSelectPatient(patient); setHighlightedIndex(-1); }}
                  onMouseEnter={() => setHighlightedIndex(index)}
                  className={`flex w-full flex-col items-start gap-0.5 px-3 py-1.5 text-left transition ${
                    highlighted ? 'bg-blue-50' : 'hover:bg-slate-50'
                  } ${index > 0 ? 'border-t border-slate-100' : ''}`}
                >
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className={`text-sm font-semibold ${highlighted ? 'text-blue-800' : 'text-slate-800'}`}>
                      {patient.name}
                    </span>
                    {patient.gender && (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                        {patient.gender.charAt(0).toUpperCase()}
                      </span>
                    )}
                    {(patient.passbookNumber || patient.passbook_number) && (
                      <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-semibold text-sky-700">
                        PB {patient.passbookNumber || patient.passbook_number}
                      </span>
                    )}
                    {patient.species && (
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                        {patient.species}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-3 text-[11px] text-slate-400">
                    {patient.ownerName && <span>Owner: {patient.ownerName}{patient.owner?.phone ? ` · ${patient.owner.phone}` : ''}</span>}
                    {ageString && <span>{ageString}{patient.weight != null ? ` · ${patient.weight} kg` : ''}</span>}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {/* Registration form */}
      {renderCreateForm && (
        <div className="w-full max-w-none">
          {renderCreateForm({ normalizedQuery, query, filteredPatients, inlineName })}
        </div>
      )}
    </div>
  );
};

export default PatientSearch;
