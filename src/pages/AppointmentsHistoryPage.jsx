import React, { useCallback, useMemo, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Search, CreditCard, Banknote, CheckCircle2, Clock, ChevronLeft, ChevronRight,
  Pencil, Trash2, X, Eye, AlertTriangle, Pill, FileText, CalendarDays,
  Stethoscope, ScrollText, ClipboardList, User, WalletCards, Printer,
} from 'lucide-react';
import EntityTable from '../components/EntityTable.jsx';
import api from '../api/client.js';

const currencyFormatter = new Intl.NumberFormat('en-LK', { style: 'currency', currency: 'LKR' });

const AVATAR_COLORS = [
  'bg-blue-100 text-blue-700',
  'bg-violet-100 text-violet-700',
  'bg-emerald-100 text-emerald-700',
  'bg-amber-100 text-amber-700',
  'bg-rose-100 text-rose-700',
  'bg-cyan-100 text-cyan-700',
  'bg-orange-100 text-orange-700',
  'bg-pink-100 text-pink-700',
  'bg-indigo-100 text-indigo-700',
  'bg-teal-100 text-teal-700',
];

const getAvatarColor = (name) => {
  if (!name) return AVATAR_COLORS[0];
  const code = name.trim().toUpperCase().charCodeAt(0);
  return AVATAR_COLORS[code % AVATAR_COLORS.length];
};

const formatCharge = (value) => {
  if (value === null || value === undefined || value === '') return '—';
  const numeric = typeof value === 'number' ? value : Number.parseFloat(value);
  if (Number.isNaN(numeric)) return '—';
  return currencyFormatter.format(numeric);
};

const renderNotesCell = (appointment) => {
  const rawNotes = typeof appointment.notes === 'string' ? appointment.notes.trim() : '';
  if (!rawNotes) return 'No notes';
  if (rawNotes.length <= 80) return rawNotes;
  return `${rawNotes.slice(0, 77)}...`;
};

const formatSettledAt = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return null;
  return date.toLocaleString();
};

const buildPaymentMeta = (appointment) => {
  const isCredit = appointment?.paymentType === 'credit';
  const rawStatus = appointment?.paymentStatus || (isCredit ? 'pending' : 'paid');
  const label = rawStatus === 'paid' ? 'Paid' : 'Pending';
  const statusText = isCredit ? (rawStatus === 'paid' ? 'Paid' : 'Pending • Due later') : label;
  const settledLabel = rawStatus === 'paid' ? formatSettledAt(appointment?.settledAt) : null;
  return { isCredit, rawStatus, label, statusText, settledLabel };
};

const PaymentBadge = ({ meta }) => {
  const isPaid = meta?.rawStatus === 'paid';
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
      isPaid ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
    }`}>
      {isPaid
        ? <CheckCircle2 size={11} className="shrink-0" />
        : <Clock size={11} className="shrink-0" />}
      {meta?.statusText}
    </span>
  );
};

const InfoRow = ({ label, children }) => (
  <div className="flex flex-col gap-0.5">
    <dt className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{label}</dt>
    <dd className="text-sm font-medium text-slate-800">{children}</dd>
  </div>
);

const ChargeRow = ({ label, value, highlight }) => (
  <div className={`flex items-center justify-between py-1.5 ${highlight ? 'border-t border-slate-100 mt-1 pt-2.5' : ''}`}>
    <span className={`${highlight ? 'text-xs font-bold uppercase tracking-wide text-slate-500' : 'text-sm text-slate-600'}`}>{label}</span>
    <span className={`font-semibold ${highlight ? 'text-base text-slate-900' : 'text-slate-800'}`}>{value}</span>
  </div>
);

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
  const [expandedAppointment, setExpandedAppointment] = useState(null);
  const [deleteCandidate, setDeleteCandidate] = useState(null);
  const navigateToReceipt = useCallback((appointment) => {
    const meds = Array.isArray(appointment.medicines) ? appointment.medicines : [];
    const medicinesSubtotal = Number(appointment.medicinesTotal ?? appointment.totalMedicines ?? 0)
      || meds.reduce((sum, med) => sum + (Number(med.brand?.price ?? 0) * (Number.parseFloat(med.quantity) || 0)), 0);
    const doctorCharge = Number(appointment.doctorCharge ?? 0);
    const surgeryCharge = Number(appointment.surgeryCharge ?? appointment.surgery_charge ?? 0);
    const otherCharge = Number(appointment.otherCharge ?? appointment.other_charge ?? 0);
    const discount = Number(appointment.discount ?? 0);
    const estimated = Number(appointment.totalCharge ?? Math.max(doctorCharge + surgeryCharge + otherCharge + medicinesSubtotal - discount, 0));
    navigate('/appointments/receipt', {
      state: {
        from: 'history',
        appointmentDate: appointment.date,
        invoice: {
          patientName: appointment.patient?.name || 'Unknown',
          ownerName: appointment.patient?.owner
            ? [appointment.patient.owner.firstName, appointment.patient.owner.lastName].filter(Boolean).join(' ')
            : '',
          reason: appointment.reason || '',
          appointmentId: appointment.id,
          doctorCharge,
          surgeryCharge,
          otherCharge,
          otherChargeReason: appointment.otherChargeReason || null,
          medicinesSubtotal,
          discount,
          estimated,
          medicines: Array.isArray(appointment.medicines) ? appointment.medicines : [],
          paymentType: appointment.paymentType || 'cash',
          paymentStatus: appointment.paymentStatus || 'paid',
        },
      },
    });
  }, [navigate]);

  useEffect(() => {
    if (location?.state?.paymentFilter) {
      try { navigate(location.pathname, { replace: true }); } catch { /* ignore */ }
    }
  }, [location, navigate]);

  const columns = useMemo(() => [
    {
      header: 'Date & Time',
      accessor: 'date',
      render: (appointment) => {
        const date = new Date(appointment.date);
        if (Number.isNaN(date.valueOf())) return '—';
        return (
          <div className="flex flex-col gap-0.5">
            <span className="font-medium text-slate-800">{date.toLocaleDateString()}</span>
            <span className="text-xs text-slate-400">{date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
        );
      }
    },
    {
      header: 'Patient',
      accessor: 'patient',
      render: (appointment) => (
        <div className="flex items-center gap-2.5">
          <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${getAvatarColor(appointment.patient?.name)}`}>
            {(appointment.patient?.name || '?').charAt(0).toUpperCase()}
          </div>
          <div className="flex flex-col">
            <span className="font-medium text-slate-800">{appointment.patient?.name || 'Unknown'}</span>
            <span className="text-xs text-slate-400 flex items-center gap-1">
              {appointment.isWalkIn && <span className="text-amber-500 font-medium">Walk-in •</span>}
              {appointment.veterinarian
                ? `Dr. ${appointment.veterinarian.firstName} ${appointment.veterinarian.lastName}`.trim()
                : 'Unassigned'}
            </span>
          </div>
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
            {owner?.phone && <span className="text-xs text-slate-400">{owner.phone}</span>}
          </div>
        );
      }
    },
    {
      header: 'Reason',
      accessor: 'reason',
      render: (appointment) => (
        <div className="flex flex-col gap-0.5">
          <span className="font-medium text-slate-800">{appointment.reason || 'Not specified'}</span>
          {appointment.notes && (
            <span className="text-xs text-slate-400 italic">{renderNotesCell(appointment)}</span>
          )}
        </div>
      )
    },
    {
      header: 'Payment',
      accessor: 'payment',
      render: (appointment) => {
        const meta = buildPaymentMeta(appointment);
        return (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold ${
              meta.isCredit ? 'bg-violet-100 text-violet-700' : 'bg-slate-100 text-slate-600'
            }`}>
              {meta.isCredit
                ? <><CreditCard size={11} className="shrink-0" /> Credit</>
                : <><Banknote size={11} className="shrink-0" /> Cash</>}
            </span>
            <PaymentBadge meta={meta} />
          </div>
        );
      }
    },
    {
      header: '',
      accessor: 'view',
      render: (appointment) => (
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100 transition"
          onClick={() => setExpandedAppointment(appointment)}
        >
          <Eye size={13} />
          View
        </button>
      )
    }
  ], []);

  const handleEdit = useCallback((appointment) => {
    navigate('/appointments', { state: { appointmentId: appointment.id } });
  }, [navigate]);

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

  useEffect(() => { loadAppointments(); }, [loadAppointments]);

  const requestDelete = useCallback((id) => { setDeleteCandidate(id); }, []);
  const cancelDelete = useCallback(() => setDeleteCandidate(null), []);

  const confirmDelete = useCallback(async () => {
    if (!deleteCandidate) return;
    await api.delete(`/appointments/${deleteCandidate}`);
    await loadAppointments();
    setDeleteCandidate(null);
    setExpandedAppointment((prev) => (prev?.id === deleteCandidate ? null : prev));
  }, [deleteCandidate, loadAppointments]);

  useEffect(() => { setPage(1); }, [searchQuery, paymentFilter, perPage, dateFrom, dateTo]);
  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [page, totalPages]);

  const handleCloseModal = () => setExpandedAppointment(null);
  const expandedPaymentMeta = expandedAppointment ? buildPaymentMeta(expandedAppointment) : null;
  const hasDateFilter = dateFrom || dateTo;

  return (
    <section className="space-y-6">

      {/* Page Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-600">
          <ScrollText size={22} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Treatment History</h1>
          <p className="text-sm text-slate-400">Review past visits, adjust entries, or clear outdated records.</p>
        </div>
      </div>

      {/* Filter Card */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-end gap-3">
          <div className="relative flex-1 min-w-[240px]">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search patient, owner, doctor, reason…"
              className="input input-bordered w-full pl-9 text-sm"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Payment type</label>
            <select
              value={paymentFilter}
              onChange={(e) => setPaymentFilter(e.target.value)}
              className="select select-bordered select-sm min-w-[130px]"
            >
              <option value="all">All payments</option>
              <option value="cash">Cash</option>
              <option value="credit">Credit</option>
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Date from</label>
            <input
              type="date"
              className="input input-sm input-bordered"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Date to</label>
            <input
              type="date"
              className="input input-sm input-bordered"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
          </div>

          {hasDateFilter && (
            <button
              type="button"
              className="inline-flex items-center gap-1.5 btn btn-sm btn-ghost text-slate-500"
              onClick={() => { setDateFrom(''); setDateTo(''); }}
            >
              <X size={14} /> Clear dates
            </button>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <AlertTriangle size={16} className="shrink-0" />
          {error}
        </div>
      )}

      {/* Table */}
      <EntityTable
        columns={columns}
        data={items}
        loading={loading}
        loadingMessage="Loading treatment history..."
        onEdit={handleEdit}
        onDelete={requestDelete}
        emptyMessage="No appointments recorded yet."
        enableSearch={false}
      />

      {/* Pagination Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-3 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 uppercase tracking-wide">Rows per page</span>
          <select
            className="select select-sm select-bordered"
            value={perPage}
            onChange={(e) => setPerPage(Number(e.target.value) || 10)}
          >
            {[10, 20, 50].map((size) => (
              <option key={size} value={size}>{size}</option>
            ))}
          </select>
          <span className="ml-2 text-sm text-slate-500">
            <span className="font-semibold text-slate-800">{totalRecords}</span> records total
          </span>
        </div>

        <div className="flex items-center gap-1">
          <button
            className="inline-flex items-center gap-1 btn btn-sm btn-ghost rounded-lg px-3"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            <ChevronLeft size={15} /> Prev
          </button>
          <span className="rounded-lg bg-blue-50 px-3 py-1 text-sm font-semibold text-blue-700">
            {page} / {totalPages}
          </span>
          <button
            className="inline-flex items-center gap-1 btn btn-sm btn-ghost rounded-lg px-3"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            Next <ChevronRight size={15} />
          </button>
        </div>
      </div>

      {/* Details Modal */}
      {expandedAppointment && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 px-4 backdrop-blur-sm">
          <div className="relative z-[10000] max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl">

            {/* Modal Header */}
            <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-slate-100 bg-white px-6 py-5">
              <div className="flex items-center gap-3">
                <div className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold ${getAvatarColor(expandedAppointment.patient?.name)}`}>
                  {(expandedAppointment.patient?.name || '?').charAt(0).toUpperCase()}
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-800">
                    {expandedAppointment.patient?.name || 'Unknown Patient'}
                  </h2>
                  <p className="text-xs text-slate-400">
                    {new Date(expandedAppointment.date).toLocaleString()} •{' '}
                    <span className="capitalize">{expandedAppointment.status?.replace(/_/g, ' ') || 'Completed'}</span>
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="inline-flex items-center justify-center h-8 w-8 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
                onClick={handleCloseModal}
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-5 p-6">

              {/* Info Grid */}
              <div className="grid grid-cols-2 gap-4 rounded-xl border border-slate-100 bg-slate-50 p-4 sm:grid-cols-3">
                <InfoRow label="Patient">
                  <span className="flex items-center gap-1.5">
                    <User size={13} className="text-slate-400" />
                    {expandedAppointment.patient?.name || 'Unknown'}
                  </span>
                </InfoRow>
                <InfoRow label="Owner">
                  {expandedAppointment.patient?.owner
                    ? [expandedAppointment.patient.owner.firstName, expandedAppointment.patient.owner.lastName].filter(Boolean).join(' ')
                    : '—'}
                </InfoRow>
                <InfoRow label="Veterinarian">
                  <span className="flex items-center gap-1.5">
                    <Stethoscope size={13} className="text-slate-400" />
                    {expandedAppointment.veterinarian
                      ? `Dr. ${expandedAppointment.veterinarian.firstName} ${expandedAppointment.veterinarian.lastName}`.trim()
                      : 'Unassigned'}
                  </span>
                </InfoRow>
                <InfoRow label="Visit type">
                  <span className="flex items-center gap-1.5">
                    <CalendarDays size={13} className="text-slate-400" />
                    {expandedAppointment.isWalkIn ? 'Walk-in' : 'Scheduled'}
                  </span>
                </InfoRow>
                {expandedAppointment.patient?.owner?.phone && (
                  <InfoRow label="Owner phone">
                    {expandedAppointment.patient.owner.phone}
                  </InfoRow>
                )}
                <InfoRow label="Reason">
                  <span className="flex items-center gap-1.5">
                    <ClipboardList size={13} className="text-slate-400" />
                    {expandedAppointment.reason || 'Not recorded'}
                  </span>
                </InfoRow>
              </div>

              {/* Charges */}
              <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50 px-4 py-3">
                  <WalletCards size={15} className="text-slate-500" />
                  <h3 className="text-sm font-semibold text-slate-800">Charges & Payment</h3>
                </div>
                <div className="px-4 py-3">
                  <ChargeRow label="Doctor charge" value={formatCharge(expandedAppointment.doctorCharge)} />
                  <ChargeRow label="Surgery charge" value={formatCharge(expandedAppointment.surgeryCharge ?? expandedAppointment.surgery_charge ?? 0)} />
                  <ChargeRow label="Other / service charge" value={formatCharge(expandedAppointment.otherCharge ?? expandedAppointment.other_charge ?? 0)} />
                  <ChargeRow label="Medicine subtotal" value={formatCharge(expandedAppointment.medicinesTotal ?? expandedAppointment.totalMedicines ?? 0)} />
                  {Number(expandedAppointment.discount) > 0 && (
                    <div className="flex items-center justify-between py-1.5">
                      <span className="text-sm text-emerald-700">Discount</span>
                      <span className="font-semibold text-emerald-700">− {formatCharge(expandedAppointment.discount)}</span>
                    </div>
                  )}
                  <ChargeRow
                    label="Total charge"
                    value={formatCharge((() => {
                      const stored = Number(expandedAppointment.totalCharge);
                      if (stored > 0) return stored;
                      const dc = Number(expandedAppointment.doctorCharge ?? 0);
                      const sc = Number(expandedAppointment.surgeryCharge ?? expandedAppointment.surgery_charge ?? 0);
                      const oc = Number(expandedAppointment.otherCharge ?? expandedAppointment.other_charge ?? 0);
                      const mc = Number(expandedAppointment.medicinesTotal ?? expandedAppointment.totalMedicines ?? 0);
                      const disc = Number(expandedAppointment.discount ?? 0);
                      return Math.max(dc + sc + oc + mc - disc, 0);
                    })())}
                    highlight
                  />
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-slate-50 px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-semibold ${
                      expandedPaymentMeta?.isCredit ? 'bg-violet-100 text-violet-700' : 'bg-slate-100 text-slate-600'
                    }`}>
                      {expandedPaymentMeta?.isCredit
                        ? <><CreditCard size={11} /> Credit</>
                        : <><Banknote size={11} /> Cash</>}
                    </span>
                    <PaymentBadge meta={expandedPaymentMeta} />
                  </div>
                  {expandedPaymentMeta?.settledLabel && (
                    <span className="text-xs text-slate-400">Settled {expandedPaymentMeta.settledLabel}</span>
                  )}
                  {expandedPaymentMeta?.isCredit && expandedPaymentMeta.rawStatus !== 'paid' && (
                    <span className="text-xs text-amber-600">Credit balance due after the visit.</span>
                  )}
                </div>
              </div>

              {/* Medicines */}
              <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50 px-4 py-3">
                  <Pill size={15} className="text-slate-500" />
                  <h3 className="text-sm font-semibold text-slate-800">Items Dispensed</h3>
                </div>
                <div className="px-4 py-3">
                  {Array.isArray(expandedAppointment.medicines) && expandedAppointment.medicines.length > 0 ? (
                    <ul className="space-y-2">
                      {expandedAppointment.medicines.map((item) => {
                        const label = [item.brand?.medicine?.name, item.brand?.name].filter(Boolean).join(' — ') || 'Unknown brand';
                        const qty = Number.parseFloat(item.quantity) || 0;
                        return (
                          <li key={item.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
                            <span className="text-slate-700">{label}</span>
                            <span className="rounded-md bg-white px-2 py-0.5 text-xs font-semibold text-slate-500 border border-slate-200">
                              Qty {qty}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <p className="text-sm text-slate-400 italic">No medicines recorded for this visit.</p>
                  )}
                </div>
              </div>

              {/* Notes */}
              {expandedAppointment.notes && (
                <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                  <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50 px-4 py-3">
                    <FileText size={15} className="text-slate-500" />
                    <h3 className="text-sm font-semibold text-slate-800">Clinical Notes</h3>
                  </div>
                  <p className="px-4 py-3 text-sm text-slate-600 leading-relaxed">{expandedAppointment.notes}</p>
                </div>
              )}

              {/* Actions */}
              <div className="flex flex-wrap justify-end gap-2 pt-1">
                <button
                  type="button"
                  className="inline-flex items-center gap-2 btn btn-sm rounded-xl border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  onClick={() => { handleCloseModal(); handleEdit(expandedAppointment); }}
                >
                  <Pencil size={14} /> Edit appointment
                </button>
                <button
                  type="button"
                  className="inline-flex items-center gap-2 btn btn-sm rounded-xl border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100"
                  onClick={() => navigateToReceipt(expandedAppointment)}
                >
                  <Printer size={14} /> Print Receipt
                </button>
                <button
                  type="button"
                  className="inline-flex items-center gap-2 btn btn-sm rounded-xl border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100"
                  onClick={() => { requestDelete(expandedAppointment.id); handleCloseModal(); }}
                >
                  <Trash2 size={14} /> Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      , document.body)}

      {/* Delete Confirm Modal */}
      {deleteCandidate && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center px-4 backdrop-blur-sm">
          <div className="absolute inset-0 bg-black/40" onClick={cancelDelete} />
          <div className="relative z-[10000] w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-rose-100 text-rose-600">
              <Trash2 size={22} />
            </div>
            <h3 className="mb-1 text-base font-bold text-slate-800">Delete appointment?</h3>
            <p className="mb-5 text-sm text-slate-500">This action cannot be undone. The record will be permanently removed.</p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="inline-flex items-center gap-1.5 btn btn-sm btn-ghost rounded-xl"
                onClick={cancelDelete}
              >
                <X size={14} /> Cancel
              </button>
              <button
                type="button"
                className="inline-flex items-center gap-1.5 btn btn-sm rounded-xl bg-rose-600 text-white hover:bg-rose-700 border-rose-600"
                onClick={confirmDelete}
              >
                <Trash2 size={14} /> Delete
              </button>
            </div>
          </div>
        </div>
      , document.body)}

    </section>
  );
};

export default AppointmentsHistoryPage;
