import { useMemo } from 'react';
import { X } from 'lucide-react';
import PatientSearch from './PatientSearch.jsx';

const GroupPatientRow = ({
  entry,
  index,
  patients,
  onChange,
  onRemove,
  canRemove,
}) => {
  const selectedPatient = useMemo(
    () => patients.find((p) => String(p.id) === String(entry.patientId)),
    [patients, entry.patientId]
  );

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-2 space-y-2 shadow-sm">
      <div className="flex items-center gap-2">
        <span className="shrink-0 flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-[10px] font-bold text-white">
          {index + 1}
        </span>
        <div className="flex-1">
          <PatientSearch
            query={entry.searchQuery}
            onQueryChange={(q) => onChange('searchQuery', q)}
            patients={patients}
            onSelectPatient={(patient) => {
              if (!patient) {
                onChange('patientId', '');
                onChange('searchQuery', '');
              } else {
                onChange('patientId', String(patient.id));
                onChange('searchQuery', patient.name || '');
              }
            }}
            selectedPatient={selectedPatient}
          />
        </div>
        {canRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="shrink-0 rounded p-0.5 text-slate-400 hover:text-rose-500 transition"
            title="Remove patient"
          >
            <X size={14} />
          </button>
        )}
      </div>
    </div>
  );
};

export default GroupPatientRow;
