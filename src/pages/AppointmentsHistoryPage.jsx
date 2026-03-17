import React, { useCallback, useMemo, useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import EntityTable from '../components/EntityTable.jsx';
import api from '../api/client.js';

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
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [totalRecords, setTotalRecords] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const location = useLocation();
  const [paymentFilter, setPaymentFilter] = useState(() => (location?.state?.paymentFilter ? location.state.paymentFilter : 'all'));
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  useEffect(() => {
    // clear location state after consuming to avoid persistent filtering when navigating back
    if (location?.state && location.state.paymentFilter) {
      try {
        navigate(location.pathname, { replace: true });
      } catch (e) {
        // ignore
      }
    }
  }, [location, navigate]);
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

  const [deleteCandidate, setDeleteCandidate] = useState(null);

  const loadAppointments = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/appointments', {
        params: {
          q: searchQuery || undefined,
          paymentType: paymentFilter !== 'all' ? paymentFilter : undefined,
          dateFrom: dateFrom || undefined,
          dateTo: dateTo || undefined,
          page,
          perPage,
        },
      }).then((r) => r.data);

      const rows = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
      setItems(rows);
      setTotalRecords(Number(res?.total) || rows.length);
      setTotalPages(Number(res?.last_page) || 1);
    } catch (e) {
      setError(e.message || 'Failed to load appointments.');
      setItems([]);
      setTotalRecords(0);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  }, [page, perPage, paymentFilter, searchQuery, dateFrom, dateTo]);

  useEffect(() => {
    loadAppointments();
  }, [loadAppointments]);

  const requestDelete = useCallback((id) => {
    setDeleteCandidate(id);
  }, []);

  const confirmDelete = useCallback(async () => {
    if (!deleteCandidate) return;
    await api.delete(`/appointments/${deleteCandidate}`);
    await loadAppointments();
    // close candidate after deletion
    setDeleteCandidate(null);
    // also close expanded details if it was the one being deleted
    setExpandedAppointment((prev) => (prev && prev.id === deleteCandidate ? null : prev));
  }, [deleteCandidate, loadAppointments]);

  const cancelDelete = useCallback(() => setDeleteCandidate(null), []);

  useEffect(() => {
    setPage(1);
  }, [searchQuery, paymentFilter, perPage, dateFrom, dateTo]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

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
        {/* <Link to="/appointments" className="btn btn-primary btn-sm">
          Schedule appointment
        </Link> */}
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
        <div>
          <select
            value={paymentFilter}
            onChange={(e) => setPaymentFilter(e.target.value)}
            className="select select-sm"
            aria-label="Filter by payment type"
          >
            <option value="all">All payments</option>
            <option value="cash">Cash</option>
            <option value="credit">Credit</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1 text-xs text-slate-500 whitespace-nowrap">
            From
            <input
              type="date"
              className="input input-sm input-bordered"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
          </label>
          <label className="flex items-center gap-1 text-xs text-slate-500 whitespace-nowrap">
            To
            <input
              type="date"
              className="input input-sm input-bordered"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
          </label>
          {(dateFrom || dateTo) && (
            <button
              type="button"
              className="btn btn-xs btn-ghost text-slate-500"
              onClick={() => { setDateFrom(''); setDateTo(''); }}
            >
              ✕ Clear dates
            </button>
          )}
        </div>
      </div>
      {error && (
        <div className="alert alert-error shadow-sm">
          <span>{error}</span>
        </div>
      )}
      <EntityTable
        columns={columns}
        data={items}
        loading={loading}
        onEdit={handleEdit}
        onDelete={requestDelete}
        emptyMessage="No appointments recorded yet."
        enableSearch={false}
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <select
            className="select select-sm select-bordered"
            value={perPage}
            onChange={(e) => setPerPage(Number(e.target.value) || 10)}
          >
            {[10, 20, 50].map((size) => <option key={size} value={size}>{size} / page</option>)}
          </select>
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <span>{totalRecords} record(s)</span>
          <button className="btn btn-xs btn-outline" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Prev</button>
          <span>Page {page} / {totalPages}</span>
          <button className="btn btn-xs btn-outline" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>Next</button>
        </div>
      </div>
      {expandedAppointment && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 px-4">
          <div className="relative z-[10000] max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-3xl border border-base-300 bg-base-100 p-6 shadow-2xl">
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
                      <dt>Surgery charge</dt>
                      <dd className="font-medium text-slate-800">
                        {formatCharge(expandedAppointment.surgeryCharge ?? expandedAppointment.surgery_charge ?? 0)}
                      </dd>
                    </div>
                    <div className="flex items-center justify-between">
                      <dt>Other/service charge</dt>
                      <dd className="font-medium text-slate-800">
                        {formatCharge(expandedAppointment.otherCharge ?? expandedAppointment.other_charge ?? 0)}
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
                        const quantity = Number.parseFloat(item.quantity) || 0;
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
                    requestDelete(expandedAppointment.id);
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
      {deleteCandidate && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/40" onClick={cancelDelete} />
          <div className="relative z-[10000] w-full max-w-md rounded-xl bg-white p-6 shadow-lg">
            <h3 className="text-lg font-semibold mb-3">Confirm deletion</h3>
            <p className="text-sm text-slate-600 mb-4">Are you sure you want to delete this appointment? This action cannot be undone.</p>
            <div className="flex justify-end gap-2">
              <button type="button" className="btn btn-ghost" onClick={cancelDelete}>Cancel</button>
              <button type="button" className="btn btn-error" onClick={confirmDelete}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default AppointmentsHistoryPage;
