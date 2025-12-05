import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import StatCard from '../components/StatCard.jsx';
import useEntityApi from '../hooks/useEntityApi.js';

const currencyFormatter = new Intl.NumberFormat('en-LK', {
  style: 'currency',
  currency: 'LKR'
});

const computeNetOutstandingAmount = (appointment) => {
  if (!appointment) {
    return 0;
  }

  if (appointment.totalCharge !== null && appointment.totalCharge !== undefined) {
    const parsedTotal = Number.parseFloat(appointment.totalCharge);
    return Number.isNaN(parsedTotal) ? 0 : Number(parsedTotal.toFixed(2));
  }

  let sum = 0;
  const doctor = Number.parseFloat(appointment.doctorCharge ?? 0);
  if (!Number.isNaN(doctor) && doctor > 0) {
    sum += doctor;
  }

  if (Array.isArray(appointment.medicines)) {
    appointment.medicines.forEach((item) => {
      const totalPrice = Number.parseFloat(item?.totalPrice ?? 0);
      if (!Number.isNaN(totalPrice) && totalPrice > 0) {
        sum += totalPrice;
      }
    });
  }

  const discount = Number.parseFloat(appointment.discount ?? 0);
  if (!Number.isNaN(discount) && discount > 0) {
    sum -= discount;
  }

  return sum > 0 ? Number(sum.toFixed(2)) : 0;
};

const DashboardPage = () => {
  const { items: patients, loading: patientsLoading } = useEntityApi('patients');
  const { items: owners, loading: ownersLoading } = useEntityApi('owners');
  const { items: veterinarians, loading: vetsLoading } = useEntityApi('veterinarians');
  const { items: appointments, loading: appointmentsLoading } = useEntityApi('appointments');

  const totalPatients = patients.length;
  const totalOwners = owners.length;
  const totalVets = veterinarians.length;

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const endOfToday = new Date(startOfToday.valueOf() + 24 * 60 * 60 * 1000);

  const aggregation = appointments.reduce(
    (acc, appointment) => {
      const appointmentDate = new Date(appointment.date);
      if (Number.isNaN(appointmentDate.valueOf())) {
        return acc;
      }
      if (appointmentDate >= now) {
        acc.upcoming += 1;
      }
      if (appointmentDate >= startOfToday && appointmentDate < endOfToday) {
        acc.today.push(appointment);
      }
      return acc;
    },
    { upcoming: 0, today: [] }
  );

  const upcomingAppointments = aggregation.upcoming;
  const todaysAppointments = aggregation.today;

  todaysAppointments.sort((a, b) => new Date(a.date) - new Date(b.date));

  const outstandingCredits = useMemo(() => {
    const credits = appointments.filter((appointment) => {
      if (appointment.paymentType !== 'credit') {
        return false;
      }
      const status = appointment.paymentStatus || 'pending';
      return status !== 'paid';
    });

    return credits.sort((a, b) => new Date(a.date) - new Date(b.date));
  }, [appointments]);

  const totalOutstandingAmount = useMemo(
    () => {
      const total = outstandingCredits.reduce(
        (sum, appointment) => sum + computeNetOutstandingAmount(appointment),
        0
      );
      return Number(total.toFixed(2));
    },
    [outstandingCredits]
  );

  const loading = patientsLoading || ownersLoading || vetsLoading || appointmentsLoading;

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-semibold text-slate-800">Clinic overview</h1>
          <p className="text-sm text-slate-500">Stay ahead of today&apos;s caseload and upcoming visits.</p>
        </div>
        <Link to="/appointments" className="btn btn-primary btn-sm h-10 px-5">
          + New appointment
        </Link>
      </div>
      {loading ? (
        <div className="rounded-2xl border border-base-300 bg-base-100 p-6 text-center text-slate-500 shadow-sm">
          Loading data…
        </div>
      ) : (
        <>
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard title="Registered Patients" value={totalPatients} icon="🐾" />
            <StatCard title="Active Owners" value={totalOwners} icon="👤" />
            <StatCard title="Veterinary Team" value={totalVets} icon="🩺" />
            <StatCard title="Upcoming Appointments" value={upcomingAppointments} icon="📅" />
          </section>
          <section className="grid gap-4 lg:grid-cols-[2fr,1fr]">
            <div className="rounded-2xl border border-base-300 bg-base-100 p-6 shadow-sm">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-slate-800">Today&apos;s visits</h2>
                  <p className="text-xs text-slate-500">
                    {todaysAppointments.length} appointment{todaysAppointments.length === 1 ? '' : 's'} scheduled for today.
                  </p>
                </div>
                <Link to="/appointments" className="btn btn-xs btn-outline">
                  Manage schedule
                </Link>
              </div>
              {todaysAppointments.length === 0 ? (
                <div className="rounded-xl border border-dashed border-base-300 bg-base-200/40 p-6 text-sm text-slate-500">
                  No visits booked for today.
                </div>
              ) : (
                <ul className="space-y-3">
                  {todaysAppointments.slice(0, 6).map((appointment) => {
                    const appointmentDate = new Date(appointment.date);
                    const timeString = appointmentDate.toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit'
                    });
                    return (
                      <li
                        key={appointment.id}
                        className="flex items-start justify-between gap-3 rounded-xl border border-base-200 bg-base-100 p-4 shadow-sm"
                      >
                        <div>
                          <p className="text-sm font-semibold text-slate-800">
                            {appointment.patient?.name || 'Unnamed patient'}
                          </p>
                          <p className="text-xs text-slate-500">
                            {appointment.reason || 'Reason not specified'}
                          </p>
                          {appointment.veterinarian && (
                            <p className="mt-1 text-[11px] uppercase tracking-wide text-slate-400">
                              Dr. {appointment.veterinarian.firstName} {appointment.veterinarian.lastName}
                            </p>
                          )}
                        </div>
                        <div className="text-right">
                          <span className="inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                            {timeString}
                          </span>
                          <p className="mt-1 text-[11px] uppercase tracking-wide text-slate-400">
                            {appointment.status || 'Scheduled'}
                          </p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
              {todaysAppointments.length > 6 && (
                <div className="mt-4 text-right text-xs text-primary">
                  Showing first 6 visits. View all in the schedule.
                </div>
              )}
            </div>
            <div className="flex flex-col gap-4">
              <div className="rounded-2xl border border-base-300 bg-base-100 p-6 shadow-sm text-sm text-slate-600">
                <h3 className="text-base font-semibold text-slate-800">Quick shortcuts</h3>
                <ul className="mt-3 space-y-2 text-xs text-slate-500">
                  <li>
                    <Link to="/patients" className="link link-primary">
                      Register a new patient
                    </Link>
                  </li>
                  <li>
                    <Link to="/medicines" className="link link-primary">
                      Update medicine pricing
                    </Link>
                  </li>
                  <li>
                    <Link to="/appointments/history" className="link link-primary">
                      Review past appointments
                    </Link>
                  </li>
                </ul>
              </div>
              <div className="rounded-2xl border border-amber-300 bg-amber-50 p-6 shadow-sm text-sm text-amber-800">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h3 className="text-base font-semibold">Unpaid credit visits</h3>
                  <span className="rounded-full bg-amber-200 px-3 py-1 text-xs font-semibold text-amber-800">
                    {outstandingCredits.length}
                  </span>
                </div>
                {outstandingCredits.length === 0 ? (
                  <p className="text-xs text-amber-700/80">All credit visits are settled.</p>
                ) : (
                  <>
                    <p className="text-xs text-amber-700/80">
                      Balance due: {currencyFormatter.format(totalOutstandingAmount)}
                    </p>
                    <ul className="mt-3 max-h-60 space-y-2 overflow-y-auto pr-1 text-xs">
                      {outstandingCredits.map((appointment) => {
                        const appointmentDate = new Date(appointment.date);
                        const dateLabel = Number.isNaN(appointmentDate.valueOf())
                          ? 'Date unknown'
                          : appointmentDate.toLocaleDateString();
                        const amount = computeNetOutstandingAmount(appointment);
                        return (
                          <li
                            key={`credit-${appointment.id}`}
                            className="rounded-lg border border-amber-200 bg-white/70 p-3 shadow-sm"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="font-semibold text-amber-900">
                                  {appointment.patient?.name || 'Unnamed patient'}
                                </p>
                                <p className="text-[11px] text-amber-700/80">
                                  {appointment.reason || 'Reason not specified'}
                                </p>
                                <p className="text-[11px] text-amber-600/80">{dateLabel}</p>
                              </div>
                              <span className="text-sm font-semibold text-amber-800">
                                {currencyFormatter.format(amount)}
                              </span>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                    <div className="mt-3 text-right text-[11px]">
                      <Link to="/appointments/history" className="link link-primary">
                        Clear credit balances
                      </Link>
                    </div>
                  </>
                )}
              </div>
            </div>
          </section>
        </>
      )}
    </section>
  );
};

export default DashboardPage;
