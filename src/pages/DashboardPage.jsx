import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Legend,
  Tooltip
} from 'recharts';
import StatCard from '../components/StatCard.jsx';
import useEntityApi from '../hooks/useEntityApi.js';
import client from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { getPosNavItems, isPosUserType } from '../constants/navigation.js';

const currencyFormatter = new Intl.NumberFormat('en-LK', {
  style: 'currency',
  currency: 'LKR'
});

const computeAppointmentTotal = (appointment) => {
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

  const surgery = Number.parseFloat(appointment.surgeryCharge ?? appointment.surgery_charge ?? 0);
  if (!Number.isNaN(surgery) && surgery > 0) {
    sum += surgery;
  }

  const other = Number.parseFloat(appointment.otherCharge ?? appointment.other_charge ?? 0);
  if (!Number.isNaN(other) && other > 0) {
    sum += other;
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
  const { user } = useAuth();
  const normalizedUserType = String(user?.user_type || '').toLowerCase();
  const { items: patients, loading: patientsLoading } = useEntityApi('patients');
  const { items: owners, loading: ownersLoading } = useEntityApi('owners');
  const { items: appointments, loading: appointmentsLoading } = useEntityApi('appointments');
  const { items: medicines, loading: medicinesLoading } = useEntityApi('medicines');
  const { data: smsCount = 0 } = useQuery({ queryKey: ['smsLogsCount'], queryFn: fetchSmsCount, staleTime: 60_000 });
  const [isExpiringModalOpen, setIsExpiringModalOpen] = useState(false);
  const canStartTreatment = ['doctor', 'admin'].includes(normalizedUserType);
  const isCashier = isPosUserType(normalizedUserType);
  const isPosAdmin = normalizedUserType === 'pos_admin';

  const totalPatients = patients.length;
  const totalOwners = owners.length;

  // Calendar state
  const [calendarDate, setCalendarDate] = useState(() => new Date());
  const [selectedDay, setSelectedDay] = useState(() => new Date());
  const [calendarNotes, setCalendarNotes] = useState(() => {
    try { return JSON.parse(localStorage.getItem('vetfinal_cal_notes') || '{}'); }
    catch { return {}; }
  });
  const [popover, setPopover] = useState(null); // { key, date, rect }
  const [noteInput, setNoteInput] = useState('');

  const NOTE_COLORS = [
    { bg: '#fef08a', border: '#eab308', shadow: '#ca8a04', text: '#713f12' },
    { bg: '#fbcfe8', border: '#ec4899', shadow: '#db2777', text: '#831843' },
    { bg: '#bbf7d0', border: '#22c55e', shadow: '#16a34a', text: '#14532d' },
    { bg: '#bfdbfe', border: '#3b82f6', shadow: '#2563eb', text: '#1e3a8a' },
    { bg: '#e9d5ff', border: '#a855f7', shadow: '#9333ea', text: '#581c87' },
    { bg: '#fed7aa', border: '#f97316', shadow: '#ea580c', text: '#7c2d12' },
  ];

  const calNoteKey = (d) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

  const saveNotes = (next) => {
    setCalendarNotes(next);
    localStorage.setItem('vetfinal_cal_notes', JSON.stringify(next));
  };

  const addNote = (key) => {
    const text = noteInput.trim();
    if (!text) return;
    const existing = calendarNotes[key] || [];
    const colorIdx = existing.length % NOTE_COLORS.length;
    saveNotes({ ...calendarNotes, [key]: [...existing, { id: `${Date.now()}`, text, colorIdx }] });
    setNoteInput('');
  };

  const deleteNote = (key, noteId) => {
    const filtered = (calendarNotes[key] || []).filter((n) => n.id !== noteId);
    const next = { ...calendarNotes };
    if (filtered.length) next[key] = filtered; else delete next[key];
    saveNotes(next);
  };

  const openPopover = (e, key, date) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    setPopover({ key, date, rect });
    setNoteInput('');
    setSelectedDay(date);
  };

  const appointmentsByDay = useMemo(() => {
    const map = new Map();
    appointments.forEach((appt) => {
      const d = new Date(appt.date);
      if (Number.isNaN(d.valueOf())) return;
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(appt);
    });
    return map;
  }, [appointments]);

  const selectedDayAppts = useMemo(() => {
    const key = `${selectedDay.getFullYear()}-${selectedDay.getMonth()}-${selectedDay.getDate()}`;
    const list = appointmentsByDay.get(key) || [];
    return [...list].sort((a, b) => new Date(a.date) - new Date(b.date));
  }, [appointmentsByDay, selectedDay]);

  // compute gender distribution for doughnut chart
  const genderStats = useMemo(() => {
    const maleCount = patients.filter((p) => p.gender === 'male').length;
    const femaleCount = patients.filter((p) => p.gender === 'female').length;
    return [
      { name: 'Male', value: maleCount, fill: '#3b82f6' },
      { name: 'Female', value: femaleCount, fill: '#ec4899' }
    ];
  }, [patients]);

  const now = new Date();
  const dayInMs = 24 * 60 * 60 * 1000;
  const startOfTodayMs = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0).valueOf();
  const startOfToday = new Date(startOfTodayMs);
  const endOfToday = new Date(startOfTodayMs + dayInMs);

  const todaysAppointments = appointments.filter((appointment) => {
    const appointmentDate = new Date(appointment.date);
    if (Number.isNaN(appointmentDate.valueOf())) {
      return false;
    }
    return appointmentDate >= startOfToday && appointmentDate < endOfToday;
  });

  todaysAppointments.sort((a, b) => new Date(a.date) - new Date(b.date));

  const last7DaysStats = useMemo(() => {
    const stats = [];
    const windowStart = new Date(startOfTodayMs - 6 * dayInMs);
    const windowEnd = new Date(startOfTodayMs + dayInMs);
    const bucketCounts = new Map();

    appointments.forEach((appointment) => {
      const appointmentDate = new Date(appointment.date);
      if (Number.isNaN(appointmentDate.valueOf())) {
        return;
      }
      if (appointmentDate < windowStart || appointmentDate >= windowEnd) {
        return;
      }
      const bucketKey = new Date(
        appointmentDate.getFullYear(),
        appointmentDate.getMonth(),
        appointmentDate.getDate(),
        0,
        0,
        0,
        0
      ).valueOf();
      bucketCounts.set(bucketKey, (bucketCounts.get(bucketKey) || 0) + 1);
    });

    for (let offset = 6; offset >= 0; offset -= 1) {
      const dayStart = new Date(startOfTodayMs - offset * dayInMs);
      const key = dayStart.valueOf();
      stats.push({
        label: dayStart.toLocaleDateString(undefined, { weekday: 'short' }),
        dateLabel: dayStart.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        count: bucketCounts.get(key) || 0
      });
    }

    return stats;
  }, [appointments, dayInMs, startOfTodayMs]);

  const last7DaysTotal = useMemo(
    () => last7DaysStats.reduce((sum, stat) => sum + stat.count, 0),
    [last7DaysStats]
  );

  const weeklyAvg = last7DaysStats.length > 0 ? last7DaysTotal / last7DaysStats.length : 0;

  const chartData = last7DaysStats;

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
        (sum, appointment) => sum + computeAppointmentTotal(appointment),
        0
      );
      return Number(total.toFixed(2));
    },
    [outstandingCredits]
  );

  const expiringSoonAll = useMemo(() => {
    const list = [];
    const horizonDays = 30;

    medicines.forEach((medicine) => {
      const medicineName = medicine?.name || 'Unnamed item';
      const brands = Array.isArray(medicine?.brands) ? medicine.brands : [];
      const type = medicine?.type || 'medicine';

      brands.forEach((brand) => {
        const brandName = brand?.name || 'Unnamed brand';
        const batches = Array.isArray(brand?.batches) ? brand.batches : [];

        if (batches.length > 0) {
          batches.forEach((batch) => {
            if (!batch?.expiry_date) {
              return;
            }

            const expiryDate = new Date(batch.expiry_date);
            if (Number.isNaN(expiryDate.valueOf())) {
              return;
            }

            const expiryMidnightMs = new Date(
              expiryDate.getFullYear(),
              expiryDate.getMonth(),
              expiryDate.getDate(),
              0,
              0,
              0,
              0
            ).valueOf();
            const daysUntilExpiry = Math.floor((expiryMidnightMs - startOfTodayMs) / dayInMs);

            if (daysUntilExpiry < 0 || daysUntilExpiry > horizonDays) {
              return;
            }

            list.push({
              id: `b-${batch.id ?? `${medicineName}-${brandName}-${batch.batch_number}`}`,
              medicineId: medicine?.id ?? null,
              brandId: brand?.id ?? null,
              batchId: batch?.id ?? null,
              medicineName,
              brandName,
              batchNumber: batch.batch_number || '—',
              quantity: Number(batch.quantity) || 0,
              expiryDate,
              daysUntilExpiry,
              type
            });
          });
          return;
        }

        if (!brand?.expiry_date) {
          return;
        }

        const expiryDate = new Date(brand.expiry_date);
        if (Number.isNaN(expiryDate.valueOf())) {
          return;
        }

        const expiryMidnightMs = new Date(
          expiryDate.getFullYear(),
          expiryDate.getMonth(),
          expiryDate.getDate(),
          0,
          0,
          0,
          0
        ).valueOf();
        const daysUntilExpiry = Math.floor((expiryMidnightMs - startOfTodayMs) / dayInMs);

        if (daysUntilExpiry < 0 || daysUntilExpiry > horizonDays) {
          return;
        }

        list.push({
          id: `legacy-${brand.id ?? `${medicineName}-${brandName}`}`,
          medicineId: medicine?.id ?? null,
          brandId: brand?.id ?? null,
          batchId: null,
          medicineName,
          brandName,
          batchNumber: brand.batch_number || '—',
          quantity: Number(brand.stock) || 0,
          expiryDate,
          daysUntilExpiry,
          type
        });
      });
    });

    return list.sort((a, b) => {
      if (a.daysUntilExpiry !== b.daysUntilExpiry) {
        return a.daysUntilExpiry - b.daysUntilExpiry;
      }
      return a.medicineName.localeCompare(b.medicineName);
    });
  }, [medicines, startOfTodayMs, dayInMs]);

  const expiringSoonItems = useMemo(() => expiringSoonAll.slice(0, 10), [expiringSoonAll]);
  const expiringSoonCount = expiringSoonAll.length;
  const handleExpiringTileClick = () => setIsExpiringModalOpen(true);

  const loading = patientsLoading || ownersLoading || appointmentsLoading || medicinesLoading;
  const orderedPosTiles = useMemo(() => {
    const preferredOrder = new Map([
      ['/sales', 1],
      ['/sales/history', 2],
      ['/sales/customer-returns', 3],
      ['/sales/heatmap', 4],
      ['/stock/low-stock', 5],
      ['/medicines', 6],
      ['/suppliers', 7],
      ['/procurement/goods-receipts', 8],
      ['/procurement/purchase-orders', 9],
      ['/procurement/supplier-invoices', 10],
      ['/procurement/supplier-credit-notes', 11],
      ['/billing/day-end', 12],
      ['/employees', 13],
      ['/reports', 14]
    ]);

    return getPosNavItems(user?.user_type)
      .filter((item) => item.to && item.to !== '/')
      .slice()
      .sort((a, b) => {
        const rankA = preferredOrder.get(a.to) ?? Number.MAX_SAFE_INTEGER;
        const rankB = preferredOrder.get(b.to) ?? Number.MAX_SAFE_INTEGER;
        if (rankA !== rankB) {
          return rankA - rankB;
        }
        return String(a.label || '').localeCompare(String(b.label || ''));
      });
  }, [user?.user_type]);

  if (isCashier) {
    const tileThemeClasses = isPosAdmin
      ? [
          'border-sky-200 bg-sky-50 hover:border-sky-300',
          'border-indigo-200 bg-indigo-50 hover:border-indigo-300',
          'border-violet-200 bg-violet-50 hover:border-violet-300',
          'border-cyan-200 bg-cyan-50 hover:border-cyan-300'
        ]
      : [
          'border-emerald-200 bg-emerald-50 hover:border-emerald-300',
          'border-amber-200 bg-amber-50 hover:border-amber-300',
          'border-rose-200 bg-rose-50 hover:border-rose-300',
          'border-lime-200 bg-lime-50 hover:border-lime-300'
        ];

    const tileIconClasses = isPosAdmin
      ? ['bg-sky-100', 'bg-indigo-100', 'bg-violet-100', 'bg-cyan-100']
      : ['bg-emerald-100', 'bg-amber-100', 'bg-rose-100', 'bg-lime-100'];

    return (
      <section className="space-y-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-semibold text-slate-800">{isPosAdmin ? 'POS Admin dashboard' : 'Cashier dashboard'}</h1>
          <p className="text-sm text-slate-500">Select a menu item to continue.</p>
        </div>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {orderedPosTiles.map((item, index) => (
            <Link
              key={item.to}
              to={item.to}
              className={`group relative rounded-2xl border p-5 shadow-sm transition hover:shadow-md ${tileThemeClasses[index % tileThemeClasses.length]}`}
            >
              {item.to === '/sales/heatmap' && (
                <div className="absolute right-3 top-3 z-10">
                  <span className="absolute inset-0 rounded-full bg-error/50 blur-sm animate-pulse" />
                  <span className="absolute -inset-1 rounded-full border border-error/40 animate-ping" />
                  <span className="relative inline-flex items-center gap-1 rounded-full border border-error/70 bg-error px-2.5 py-1 text-[10px] font-extrabold tracking-wider text-error-content shadow-md">
                    <span className="text-[11px]">🔥</span>
                    HOT
                  </span>
                </div>
              )}
              <div className="flex items-center gap-3">
                <div className={`flex h-12 w-12 items-center justify-center rounded-xl text-2xl ${tileIconClasses[index % tileIconClasses.length]}`}>
                  {item.icon}
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-800">{item.label}</p>
                  <p className="text-xs text-slate-500">Open {item.label.toLowerCase()}</p>
                </div>
              </div>
            </Link>
          ))}
        </section>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-semibold text-slate-800">Clinic overview</h1>
          <p className="text-sm text-slate-500">Stay ahead of today&apos;s caseload and upcoming visits.</p>
        </div>
        {canStartTreatment && (
          <div className="flex flex-wrap items-center gap-2">
            <Link to="/appointments" className="btn btn-primary btn-sm h-10 px-5 shadow-sm">
              + New Appointment
            </Link>
            <Link to="/sales" className="btn btn-outline btn-sm h-10 px-5">
              🧾 POS Sale
            </Link>
          </div>
        )}
      </div>
      {loading ? (
        <div className="space-y-6 animate-pulse">
          {/* Stat cards */}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-3 flex items-center justify-between">
                  <div className="h-3 w-28 rounded-full bg-slate-100" />
                  <div className="h-9 w-9 rounded-xl bg-slate-100" />
                </div>
                <div className="h-8 w-16 rounded-lg bg-slate-100" />
              </div>
            ))}
          </div>
          {/* Main grid */}
          <div className="grid gap-4 lg:grid-cols-[2fr,1fr]">
            {/* Left column */}
            <div className="flex flex-col gap-4">
              {/* Chart card */}
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="mb-5 flex items-center justify-between">
                  <div className="space-y-2">
                    <div className="h-4 w-44 rounded-full bg-slate-100" />
                    <div className="h-3 w-32 rounded-full bg-slate-100" />
                  </div>
                  <div className="h-14 w-20 rounded-xl bg-slate-100" />
                </div>
                <div className="h-72 rounded-xl bg-slate-100" />
              </div>
              {/* Today's visits card */}
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="mb-4 space-y-2">
                  <div className="h-4 w-36 rounded-full bg-slate-100" />
                  <div className="h-3 w-52 rounded-full bg-slate-100" />
                </div>
                <div className="space-y-3">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="h-16 rounded-xl bg-slate-100" />
                  ))}
                </div>
              </div>
            </div>
            {/* Right column */}
            <div className="flex flex-col gap-4">
              <div className="h-64 rounded-2xl bg-slate-100" />
              <div className="h-28 rounded-2xl bg-slate-100" />
              <div className="h-52 rounded-2xl bg-slate-100" />
              <div className="h-44 rounded-2xl bg-slate-100" />
            </div>
          </div>
        </div>
      ) : (
        <>
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              title="Registered Patients"
              value={totalPatients}
              icon="🐾"
              color="blue"
            />
            <StatCard
              title="Active Owners"
              value={totalOwners}
              icon="👤"
              color="emerald"
            />
            <StatCard
              title="SMS Sent"
              value={smsCount}
              icon="✉️"
              color="violet"
            />
            <div className="flex flex-col gap-1">
              <StatCard
                title="Expiring Soon"
                value={expiringSoonCount}
                icon="⏳"
                color="rose"
                onClick={handleExpiringTileClick}
              />
              <p className="px-1 text-[11px] font-medium text-rose-600">Click to view full list</p>
            </div>
          </section>
          <section className="grid gap-4 lg:grid-cols-[2fr,1fr]">
            <div className="flex flex-col gap-4">
              <div className="rounded-2xl border border-base-300 bg-white p-6 shadow-sm">
                <div className="mb-5 flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-base font-semibold text-slate-800">Appointment Calendar</h2>
                    <p className="text-xs text-slate-400">Click a day to view scheduled visits</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setCalendarDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))}
                      className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 transition"
                    >
                      <ChevronLeft size={14} />
                    </button>
                    <span className="text-sm font-semibold text-slate-700 min-w-[110px] text-center">
                      {calendarDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
                    </span>
                    <button
                      type="button"
                      onClick={() => setCalendarDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))}
                      className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 transition"
                    >
                      <ChevronRight size={14} />
                    </button>
                  </div>
                </div>
                {(() => {
                  const year = calendarDate.getFullYear();
                  const month = calendarDate.getMonth();
                  const firstDay = new Date(year, month, 1).getDay();
                  const daysInMonth = new Date(year, month + 1, 0).getDate();
                  const todayKey = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;
                  const selectedKey = `${selectedDay.getFullYear()}-${selectedDay.getMonth()}-${selectedDay.getDate()}`;
                  const blanks = Array(firstDay).fill(null);
                  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
                  return (
                    <div>
                      {/* Day headers */}
                      <div className="grid grid-cols-7 mb-1 border-b border-slate-100 pb-1">
                        {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((d) => (
                          <div key={d} className="py-1 text-center text-[10px] font-bold uppercase tracking-wide text-slate-400">{d}</div>
                        ))}
                      </div>
                      {/* Day cells */}
                      <div className="grid grid-cols-7 gap-px bg-slate-100 border border-slate-100 rounded-xl overflow-hidden">
                        {blanks.map((_, i) => (
                          <div key={`b${i}`} className="bg-slate-50 min-h-[80px]" />
                        ))}
                        {days.map((day) => {
                          const key = `${year}-${month}-${day}`;
                          const appts = appointmentsByDay.get(key) || [];
                          const notes = calendarNotes[key] || [];
                          const isToday = key === todayKey;
                          const isSelected = key === selectedKey;
                          return (
                            <button
                              key={day}
                              type="button"
                              onClick={(e) => openPopover(e, key, new Date(year, month, day))}
                              className={`relative flex flex-col gap-1 p-1.5 text-left min-h-[80px] transition-colors
                                ${isSelected ? 'bg-blue-50 ring-2 ring-inset ring-blue-400' : isToday ? 'bg-blue-50/60' : 'bg-white hover:bg-slate-50'}`}
                            >
                              <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold self-end
                                ${isToday ? 'bg-blue-600 text-white' : isSelected ? 'text-blue-700' : 'text-slate-600'}`}>
                                {day}
                              </span>
                              {appts.length > 0 && (
                                <span className="self-start rounded-md bg-blue-100 px-1.5 py-0.5 text-[9px] font-semibold text-blue-700 leading-none">
                                  🗓 {appts.length} visit{appts.length > 1 ? 's' : ''}
                                </span>
                              )}
                              {notes.slice(0, 2).map((note) => {
                                const c = NOTE_COLORS[note.colorIdx ?? 0];
                                return (
                                  <span
                                    key={note.id}
                                    className="block w-full rounded-sm px-1.5 py-0.5 text-[9px] font-medium leading-tight truncate"
                                    style={{ background: c.bg, color: c.text, boxShadow: `1px 1px 0 ${c.shadow}` }}
                                  >
                                    {note.text}
                                  </span>
                                );
                              })}
                              {notes.length > 2 && (
                                <span className="text-[9px] text-slate-400 font-medium">+{notes.length - 2} more</span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* ── Popover portal ── */}
              {popover && createPortal(
                <>
                  <div className="fixed inset-0 z-[300]" onClick={() => setPopover(null)} />
                  <div
                    className="fixed z-[310] w-72 rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden"
                    style={{
                      top: Math.min(popover.rect.bottom + 6, window.innerHeight - 320),
                      left: Math.min(Math.max(popover.rect.left, 8), window.innerWidth - 296),
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {/* Popover header */}
                    <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-4 py-3">
                      <span className="text-sm font-semibold text-slate-800">
                        📝 {popover.date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                      </span>
                      <button type="button" onClick={() => setPopover(null)} className="text-slate-400 hover:text-slate-600 text-lg leading-none">×</button>
                    </div>

                    {/* Existing notes */}
                    <div className="p-3 space-y-2 max-h-48 overflow-y-auto">
                      {(calendarNotes[popover.key] || []).length === 0 ? (
                        <p className="text-xs text-slate-400 text-center py-3">No notes yet. Add one below.</p>
                      ) : (
                        (calendarNotes[popover.key] || []).map((note) => {
                          const c = NOTE_COLORS[note.colorIdx ?? 0];
                          return (
                            <div
                              key={note.id}
                              className="relative rounded-xl px-3 py-2.5 pr-7 text-xs font-medium leading-relaxed"
                              style={{ background: c.bg, color: c.text, boxShadow: `2px 2px 0 ${c.shadow}` }}
                            >
                              {note.text}
                              <button
                                type="button"
                                onClick={() => deleteNote(popover.key, note.id)}
                                className="absolute right-2 top-2 text-xs font-bold opacity-50 hover:opacity-100 transition"
                                style={{ color: c.text }}
                              >×</button>
                            </div>
                          );
                        })
                      )}
                    </div>

                    {/* Add input */}
                    <div className="border-t border-slate-100 p-3 flex gap-2">
                      <input
                        type="text"
                        className="input input-bordered input-sm flex-1 text-sm"
                        placeholder="Add a note…"
                        value={noteInput}
                        onChange={(e) => setNoteInput(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addNote(popover.key); } }}
                        autoFocus
                      />
                      <button
                        type="button"
                        className="btn btn-sm btn-primary rounded-xl px-3"
                        onClick={() => addNote(popover.key)}
                      >Add</button>
                    </div>
                  </div>
                </>,
                document.body
              )}

              <div className="rounded-2xl border border-base-300 bg-white p-6 shadow-sm">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-800">
                      {selectedDay.toDateString() === now.toDateString() ? "Today's visits" : selectedDay.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
                    </h2>
                    <p className="text-xs text-slate-500">
                      {selectedDayAppts.length} appointment{selectedDayAppts.length === 1 ? '' : 's'} scheduled.
                    </p>
                  </div>
                  {canStartTreatment && (
                    <Link to="/appointments" className="btn btn-xs btn-outline">
                      Start Treatment
                    </Link>
                  )}
                </div>
                {selectedDayAppts.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-base-300 bg-base-200/40 p-6 text-sm text-slate-500">
                    No visits scheduled for this day.
                  </div>
                ) : (
                  <ul className="space-y-3">
                    {selectedDayAppts.slice(0, 6).map((appointment) => {
                      const appointmentDate = new Date(appointment.date);
                      const timeString = appointmentDate.toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit'
                      });
                      const totalCharge = computeAppointmentTotal(appointment);
                      const chargeLabel = currencyFormatter.format(totalCharge);
                      const paymentTag = appointment.paymentType === 'credit' ? 'Credit' : 'Cash';
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
                            <p className="mt-1 text-xs text-slate-600">
                              {chargeLabel} ({paymentTag})
                            </p>
                          </div>
                          <div className="ml-2 self-center">
                            <Link
                              to={`/appointments/${appointment.id}`}
                              className="btn btn-xs btn-outline"
                            >
                              View
                            </Link>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
                {selectedDayAppts.length > 6 && (
                  <div className="mt-4 text-right text-xs text-primary">
                    Showing first 6 visits. View all in the schedule.
                  </div>
                )}
              </div>
            </div>
            <div className="flex flex-col gap-4">
              {/* gender doughnut chart */}
            <div className="mt-6 flex flex-col items-center w-full">
              <p className="text-sm font-semibold text-slate-800">Patients by gender</p>
              <div className="mt-2 flex justify-center w-full">
                <div className="w-full" style={{ height: 260 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={genderStats}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={70}
                        outerRadius={100}
                        label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                      />
                      <Legend verticalAlign="bottom" height={24} />
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
            <div className="rounded-2xl border border-base-300 bg-white p-6 shadow-sm text-sm text-slate-600">
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
              <div className="rounded-2xl border border-rose-300 bg-rose-50 p-6 shadow-sm text-sm text-rose-900">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h3 className="text-base font-semibold">Expiring soon (30 days)</h3>
                  <span className="rounded-full bg-rose-200 px-3 py-1 text-xs font-semibold text-rose-800">
                    {expiringSoonCount}
                  </span>
                </div>
                {expiringSoonCount === 0 ? (
                  <p className="text-xs text-rose-700/80">No batches expiring in the next 30 days.</p>
                ) : (
                  <ul className="max-h-72 space-y-2 overflow-y-auto pr-1 text-xs">
                    {expiringSoonItems.map((item) => (
                      <li key={item.id}>
                        <Link
                          to={item.type === 'item' ? '/items-variants' : '/medicines'}
                          state={{
                            focusBatch: {
                              medicineId: item.medicineId,
                              brandId: item.brandId,
                              batchId: item.batchId,
                              medicineName: item.medicineName,
                              brandName: item.brandName,
                              batchNumber: item.batchNumber
                            }
                          }}
                          className="block rounded-lg border border-rose-200 bg-white/80 p-3 shadow-sm transition hover:border-rose-300 hover:bg-white"
                        >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-semibold text-rose-900">{item.medicineName}</p>
                            <p className="text-[11px] text-rose-700/80">{item.brandName} • Batch {item.batchNumber}</p>
                            <p className="text-[11px] text-rose-700/80">
                              Qty {item.quantity} • Exp {item.expiryDate.toLocaleDateString()}
                            </p>
                          </div>
                          <span
                            className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                              item.daysUntilExpiry <= 7
                                ? 'bg-rose-200 text-rose-900'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {item.daysUntilExpiry === 0
                              ? 'Today'
                              : `${item.daysUntilExpiry} day${item.daysUntilExpiry === 1 ? '' : 's'}`}
                          </span>
                        </div>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
                {expiringSoonCount > 10 && (
                  <div className="mt-3 flex items-center justify-between text-[11px]">
                    <span className="text-rose-700/80">Showing 10 of {expiringSoonCount} items</span>
                    <button type="button" className="link link-primary" onClick={() => setIsExpiringModalOpen(true)}>
                      View all
                    </button>
                  </div>
                )}
                <div className="mt-3 text-right text-[11px]">
                  <Link to="/medicines" className="link link-primary">Manage stock batches</Link>
                </div>
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
                        const amount = computeAppointmentTotal(appointment);
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
                      <Link to="/appointments/history" state={{ paymentFilter: 'credit' }} className="link link-primary">
                        View credit balances
                      </Link>
                    </div>
                  </>
                )}
              </div>
            </div>
          </section>
        </>
      )}

      {isExpiringModalOpen && (
        <div className="modal modal-open">
          <div className="modal-box w-11/12 max-w-4xl max-h-[90vh]">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h3 className="text-lg font-semibold text-slate-800">Expiring soon batches (30 days)</h3>
              <span className="rounded-full bg-rose-100 px-3 py-1 text-xs font-semibold text-rose-800">
                {expiringSoonCount}
              </span>
            </div>

            {expiringSoonCount === 0 ? (
              <p className="text-sm text-slate-500">No batches expiring in the next 30 days.</p>
            ) : (
              <ul className="max-h-[62vh] space-y-2 overflow-y-auto pr-1 text-xs">
                {expiringSoonAll.map((item) => (
                  <li key={`modal-${item.id}`}>
                    <Link
                      to={item.type === 'item' ? '/items-variants' : '/medicines'}
                      state={{
                        focusBatch: {
                          medicineId: item.medicineId,
                          brandId: item.brandId,
                          batchId: item.batchId,
                          medicineName: item.medicineName,
                          brandName: item.brandName,
                          batchNumber: item.batchNumber
                        }
                      }}
                      className="block rounded-lg border border-rose-200 bg-white p-3 shadow-sm transition hover:border-rose-300 hover:bg-rose-50"
                      onClick={() => setIsExpiringModalOpen(false)}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-semibold text-slate-800">{item.medicineName}</p>
                          <p className="text-[11px] text-slate-600">{item.brandName} • Batch {item.batchNumber}</p>
                          <p className="text-[11px] text-slate-500">
                            Qty {item.quantity} • Exp {item.expiryDate.toLocaleDateString()}
                          </p>
                        </div>
                        <span
                          className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                            item.daysUntilExpiry <= 7
                              ? 'bg-rose-200 text-rose-900'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {item.daysUntilExpiry === 0
                            ? 'Today'
                            : `${item.daysUntilExpiry} day${item.daysUntilExpiry === 1 ? '' : 's'}`}
                        </span>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}

            <div className="modal-action">
              <button type="button" className="btn btn-sm" onClick={() => setIsExpiringModalOpen(false)}>
                Close
              </button>
            </div>
          </div>
          <button type="button" className="modal-backdrop" onClick={() => setIsExpiringModalOpen(false)}>
            close
          </button>
        </div>
      )}

    </section>
  );
};

const fetchSmsCount = async () => {
  const { data } = await client.get('/sms-logs/count');
  return data.count || 0;
};

export default DashboardPage;
