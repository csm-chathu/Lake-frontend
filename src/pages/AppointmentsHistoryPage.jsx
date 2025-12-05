import React, { useCallback, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import EntityTable from '../components/EntityTable.jsx';
import useEntityApi from '../hooks/useEntityApi.js';

const currencyFormatter = new Intl.NumberFormat('en-LK', { style: 'currency', currency: 'LKR' });

const formatCharge = (value) => {
  if (value === null || value === undefined || value === '') {
    return '—';
  }
  const numeric = typeof value === 'number' ? value : Number.parseFloat(value);
  if (Number.isNaN(numeric)) {
    return '—';
  }
  return currencyFormatter.format(numeric);
};

const renderNotesCell = (appointment) => {
  const rawNotes = typeof appointment.notes === 'string' ? appointment.notes.trim() : '';
  if (!rawNotes) {
    return 'No notes';
  }
  if (rawNotes.length <= 80) {
    return rawNotes;
  }
  return `${rawNotes.slice(0, 77)}...`;
};

const formatSettledAt = (value) => {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) {
    return null;
  }
  return date.toLocaleString();
};

const buildPaymentMeta = (appointment) => {
  const isCredit = appointment?.paymentType === 'credit';
  const rawStatus = appointment?.paymentStatus || (isCredit ? 'pending' : 'paid');
  const label = rawStatus === 'paid' ? 'Paid' : 'Pending';
  const statusText = isCredit ? (rawStatus === 'paid' ? 'Paid' : 'Pending • Due later') : label;
  const statusClass = rawStatus === 'paid' ? 'text-emerald-600' : 'text-amber-600';
  const settledLabel = rawStatus === 'paid' ? formatSettledAt(appointment?.settledAt) : null;

  return {
    isCredit,
    rawStatus,
    label,
    statusText,
    statusClass,
    settledLabel
  };
};

const AppointmentsHistoryPage = () => {
  const navigate = useNavigate();
  const { items, loading, error, deleteItem } = useEntityApi('appointments');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedAppointment, setExpandedAppointment] = useState(null);

  const columns = useMemo(
    () => [
      {
        header: 'Date',
        accessor: 'date',
        render: (appointment) => {
          const date = new Date(appointment.date);
          return Number.isNaN(date.valueOf()) ? '—' : date.toLocaleString();
        }
      },
      {
        header: 'Patient',
        accessor: 'patient',
        render: (appointment) => (
          <div className="flex flex-col">
            <span className="font-medium text-slate-800">{appointment.patient?.name || 'Unknown patient'}</span>
            <span className="text-xs text-slate-500">
              {appointment.isWalkIn ? 'Walk-in • ' : ''}
              {appointment.veterinarian
                ? `Dr. ${appointment.veterinarian.firstName} ${appointment.veterinarian.lastName}`.trim()
                : 'Unassigned'}
            </span>
          </div>
        )
      },
      {
        header: 'Owner',
        accessor: 'owner',
        render: (appointment) => {
          const owner = appointment.patient?.owner;
          const ownerName = owner ? [owner.firstName, owner.lastName].filter(Boolean).join(' ') : '';
          return (
            <div className="flex flex-col">
              <span className="font-medium text-slate-800">{ownerName || '—'}</span>
              {owner?.phone && <span className="text-xs text-slate-500">{owner.phone}</span>}
            </div>
          );
        }
      },
      {
        header: 'Reason',
        accessor: 'reason',
        render: (appointment) => (
          <div>
            <p className="font-medium text-slate-800">{appointment.reason || 'Not specified'}</p>
            {appointment.notes && (
              <p className="text-xs text-slate-500">{renderNotesCell(appointment)}</p>
            )}
          </div>
        )
      },
      {
        header: 'Payment',
        accessor: 'payment',
        render: (appointment) => {
          const paymentMeta = buildPaymentMeta(appointment);

          return (
            <div className="flex flex-col">
              <span className="font-medium text-slate-800 capitalize">
                {paymentMeta.isCredit ? 'Credit' : 'Cash'}
              </span>
              <span className={`text-xs font-semibold ${paymentMeta.statusClass}`}>{paymentMeta.statusText}</span>
              {paymentMeta.settledLabel && (
                <span className="text-[11px] text-slate-400">Settled {paymentMeta.settledLabel}</span>
              )}
            </div>
          );
        }
      },
      {
        header: '',
        accessor: 'actions',
        render: (appointment) => (
          <button
            type="button"
            className="btn btn-xs btn-outline"
            onClick={() => setExpandedAppointment(appointment)}
          >
            Details
          </button>
        )
      }
    ],
    [setExpandedAppointment]
  );

  const handleEdit = useCallback(
    (appointment) => {
      navigate('/appointments', { state: { appointmentId: appointment.id } });
    },
    [navigate]
  );

  const handleDelete = useCallback((id) => deleteItem(id), [deleteItem]);

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filteredAppointments = useMemo(() => {
    const sorted = [...items].sort((a, b) => new Date(b.date) - new Date(a.date));

    if (!normalizedQuery) {
      return sorted;
    }

    return sorted.filter((appointment) => {
      const haystacks = [
        appointment.reason,
        appointment.status,
        appointment.patient?.name,
        appointment.patient?.owner?.firstName,
        appointment.patient?.owner?.lastName,
        appointment.veterinarian
          ? `${appointment.veterinarian.firstName} ${appointment.veterinarian.lastName}`
          : '',
        appointment.notes,
        appointment.discount,
        appointment.paymentType,
        appointment.paymentStatus
      ];

      const medicineLabels = Array.isArray(appointment.medicines)
        ? appointment.medicines.map((medicine) => {
            const names = [];
            if (medicine.brand?.medicine?.name) {
              names.push(medicine.brand.medicine.name);
            }
            if (medicine.brand?.name) {
              names.push(medicine.brand.name);
            }
            return names.join(' ');
          })
        : [];

      const combined = [...haystacks, ...medicineLabels]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return combined.includes(normalizedQuery);
    });
  }, [items, normalizedQuery]);

  const handleCloseModal = () => {
    setExpandedAppointment(null);
  };

  const expandedPaymentMeta = expandedAppointment ? buildPaymentMeta(expandedAppointment) : null;

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold text-slate-800">Appointment history</h1>
        <p className="text-sm text-slate-500">Review past and upcoming visits, adjust entries, or clear outdated records.</p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Link to="/appointments" className="btn btn-primary btn-sm">
          Schedule appointment
        </Link>
        <div className="relative flex-1 min-w-[260px]">
          <input
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search by patient, owner, doctor, reason, or billing details"
            className="input input-bordered w-full pl-10"
          />
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
        </div>
      </div>
      {error && (
        <div className="alert alert-error shadow-sm">
          <span>{error}</span>
        </div>
      )}
      <EntityTable
        columns={columns}
        data={filteredAppointments}
        loading={loading}
        onEdit={handleEdit}
        onDelete={handleDelete}
        emptyMessage="No appointments recorded yet."
      />
      {expandedAppointment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 px-4">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-3xl border border-base-300 bg-base-100 p-6 shadow-2xl">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold text-slate-800">Appointment details</h2>
                <p className="text-xs text-slate-500">
                  {new Date(expandedAppointment.date).toLocaleString()} •{' '}
                  {expandedAppointment.status?.replace(/^[a-z]/, (match) => match.toUpperCase())}
                </p>
              </div>
              <button type="button" className="btn btn-sm btn-ghost" onClick={handleCloseModal}>
                Close
              </button>
            </div>
            <div className="grid gap-4 rounded-2xl border border-base-300 bg-base-100 p-5">
              <dl className="grid gap-3 text-sm text-slate-600 sm:grid-cols-2">
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Patient</dt>
                  <dd className="font-medium text-slate-800">
                    {expandedAppointment.patient?.name || 'Unknown patient'}
                  </dd>
                  {expandedAppointment.patient?.owner && (
                    <p className="text-xs text-slate-500">
                      Owner: {expandedAppointment.patient.owner.firstName || '—'}
                      {expandedAppointment.patient.owner.phone
                        ? ` • ${expandedAppointment.patient.owner.phone}`
                        : ''}
                    </p>
                  )}
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Veterinarian</dt>
                  <dd className="font-medium text-slate-800">
                    {expandedAppointment.veterinarian
                      ? `${expandedAppointment.veterinarian.firstName} ${expandedAppointment.veterinarian.lastName}`.trim()
                      : 'Unassigned'}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Reason</dt>
                  <dd className="font-medium text-slate-800">{expandedAppointment.reason || 'Not recorded'}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Visit type</dt>
                  <dd className="font-medium text-slate-800">
                    {expandedAppointment.isWalkIn ? 'Walk-in appointment' : 'Scheduled appointment'}
                  </dd>
                </div>
              </dl>
              <div className="space-y-3">
                <div className="rounded-xl border border-base-300 bg-base-100 p-4">
                  <h3 className="mb-3 text-sm font-semibold text-slate-800">Charges</h3>
                  <dl className="grid gap-2 text-sm text-slate-600 sm:grid-cols-2">
                    <div className="flex items-center justify-between">
                      <dt>Doctor charge</dt>
                      <dd className="font-medium text-slate-800">
                        {formatCharge(expandedAppointment.doctorCharge)}
                      </dd>
                    </div>
                    <div className="flex items-center justify-between">
                      <dt>Medicine subtotal</dt>
                      <dd className="font-medium text-slate-800">
                        {formatCharge(expandedAppointment.medicinesTotal ?? expandedAppointment.totalMedicines ?? 0)}
                      </dd>
                    </div>
                    <div className="flex items-center justify-between">
                      <dt>Discount</dt>
                      <dd className="font-medium text-emerald-700">
                        {expandedAppointment.discount && Number(expandedAppointment.discount) > 0
                          ? `- ${formatCharge(expandedAppointment.discount)}`
                          : '—'}
                      </dd>
                    </div>
                    <div className="flex items-center justify-between sm:col-span-2">
                      <dt className="uppercase tracking-wide text-xs text-slate-500">Total charge</dt>
                      <dd className="text-base font-semibold text-slate-900">
                        {formatCharge(expandedAppointment.totalCharge)}
                      </dd>
                    </div>
                  </dl>
                  <div className="mt-4 rounded-lg bg-base-200/60 p-3">
                    <p className="text-xs uppercase tracking-wide text-slate-500">Payment</p>
                    <div className="mt-2 flex flex-wrap items-center justify-between gap-3 text-sm">
                      <span className="font-medium text-slate-800 capitalize">
                        {expandedPaymentMeta?.isCredit ? 'Credit' : 'Cash'}
                      </span>
                      <span className={`text-xs font-semibold ${expandedPaymentMeta?.statusClass || 'text-slate-500'}`}>
                        {expandedPaymentMeta?.statusText || 'Paid'}
                      </span>
                    </div>
                    {expandedPaymentMeta?.settledLabel && (
                      <p className="mt-1 text-xs text-slate-500">Settled {expandedPaymentMeta.settledLabel}</p>
                    )}
                    {expandedPaymentMeta?.isCredit && expandedPaymentMeta.rawStatus !== 'paid' && (
                      <p className="mt-1 text-xs text-amber-600">Credit balance due after the visit.</p>
                    )}
                  </div>
                </div>
                <div className="rounded-xl border border-base-300 bg-base-100 p-4">
                  <h3 className="mb-3 text-sm font-semibold text-slate-800">Medicines dispensed</h3>
                  {Array.isArray(expandedAppointment.medicines) && expandedAppointment.medicines.length > 0 ? (
                    <ul className="space-y-2 text-sm text-slate-600">
                      {expandedAppointment.medicines.map((item) => {
                        const labelParts = [];
                        if (item.brand?.medicine?.name) {
                          labelParts.push(item.brand.medicine.name);
                        }
                        if (item.brand?.name) {
                          labelParts.push(item.brand.name);
                        }
                        const label = labelParts.length ? labelParts.join(' — ') : 'Unknown brand';
                        const quantity = Number.parseInt(item.quantity, 10) || 0;
                        return (
                          <li key={item.id} className="flex justify-between gap-3">
                            <span>{label}</span>
                            <span className="text-slate-500">Qty {quantity}</span>
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <p className="text-sm text-slate-500">No medicines recorded for this visit.</p>
                  )}
                </div>
                {expandedAppointment.notes && (
                  <div className="rounded-xl border border-base-300 bg-base-100 p-4 text-sm text-slate-600">
                    <h3 className="mb-2 text-sm font-semibold text-slate-800">Clinical notes</h3>
                    <p>{expandedAppointment.notes}</p>
                  </div>
                )}
              </div>
              <div className="flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  className="btn btn-sm btn-outline"
                  onClick={() => {
                    handleCloseModal();
                    handleEdit(expandedAppointment);
                  }}
                >
                  Edit appointment
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-error"
                  onClick={() => {
                    handleDelete(expandedAppointment.id);
                    handleCloseModal();
                  }}
                >
                  Delete appointment
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default AppointmentsHistoryPage;
