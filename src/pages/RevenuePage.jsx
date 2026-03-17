import React, { useMemo, useState, useEffect } from 'react';
import axios from 'axios';

const currencyFormatter = new Intl.NumberFormat('en-LK', {
  style: 'currency',
  currency: 'LKR'
});

const formatDateInput = (value) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.valueOf())) {
    return '';
  }
  const pad = (num) => String(num).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

const parseDate = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? null : date;
};

const getRangeByPeriod = (period, dateValue) => {
  const baseDate = parseDate(dateValue) || new Date();
  const start = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate());
  const end = new Date(start);

  if (period === 'day') {
    end.setDate(end.getDate() + 1);
    return { start, end };
  }

  if (period === 'week') {
    const day = start.getDay();
    const mondayOffset = day === 0 ? -6 : 1 - day;
    start.setDate(start.getDate() + mondayOffset);
    end.setTime(start.getTime());
    end.setDate(end.getDate() + 7);
    return { start, end };
  }

  if (period === 'month') {
    start.setDate(1);
    end.setFullYear(start.getFullYear(), start.getMonth() + 1, 1);
    return { start, end };
  }

  start.setMonth(0, 1);
  end.setFullYear(start.getFullYear() + 1, 0, 1);
  return { start, end };
};

const formatPeriodLabel = (period, range) => {
  const format = (date) => date.toLocaleDateString();
  if (period === 'day') {
    return format(range.start);
  }
  const inclusiveEnd = new Date(range.end);
  inclusiveEnd.setDate(inclusiveEnd.getDate() - 1);
  return `${format(range.start)} - ${format(inclusiveEnd)}`;
};

const RevenuePage = () => {
  const [period, setPeriod] = useState('day');
  const [selectedDate, setSelectedDate] = useState(() => formatDateInput(new Date()));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [appointmentRevenue, setAppointmentRevenue] = useState(0);
  const [salesRevenue, setSalesRevenue] = useState(0);

  const range = useMemo(() => getRangeByPeriod(period, selectedDate), [period, selectedDate]);

  useEffect(() => {
    const fetchRevenue = async () => {
      setLoading(true);
      setError(null);
      try {
        const startDate = formatDateInput(range.start);
        const endDate = formatDateInput(new Date(range.end.getTime() - 86400000)); // One day before end
        
        const response = await axios.get('/api/revenue', {
          params: {
            startDate,
            endDate
          }
        });

        setAppointmentRevenue(response.data.appointmentRevenue);
        setSalesRevenue(response.data.salesRevenue);
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to load revenue data');
        setAppointmentRevenue(0);
        setSalesRevenue(0);
      } finally {
        setLoading(false);
      }
    };

    fetchRevenue();
  }, [range]);

  const totalRevenue = Number((appointmentRevenue + salesRevenue).toFixed(2));

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold text-slate-800">Revenue Check</h1>
        <p className="text-sm text-slate-500">Check income by day, week, month, or year with date-based filtering.</p>
      </div>

      {error && (
        <div className="alert alert-error shadow-sm">
          <span>{error}</span>
        </div>
      )}

      <div className="rounded-2xl border border-base-300 bg-base-100 p-4 shadow-sm">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex gap-2">
            {['day', 'week', 'month', 'year'].map((option) => (
              <button
                key={option}
                type="button"
                className={`btn btn-sm ${period === option ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setPeriod(option)}
              >
                {option.charAt(0).toUpperCase() + option.slice(1)}
              </button>
            ))}
          </div>

          <label className="form-control w-full max-w-xs">
            <span className="label-text text-xs font-semibold uppercase tracking-wide text-slate-600">Select date</span>
            <input
              type="date"
              className="input input-bordered input-sm"
              value={selectedDate}
              onChange={(event) => setSelectedDate(event.target.value)}
            />
          </label>

          <div className="text-sm text-slate-600">
            Period: <span className="font-semibold text-slate-800">{formatPeriodLabel(period, range)}</span>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-base-300 bg-base-100 p-6 text-center text-slate-500 shadow-sm">
          Loading revenue…
        </div>
      ) : (
        <section className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-base-300 bg-base-100 p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Treatment Revenue</p>
            <p className="mt-2 text-2xl font-bold text-slate-800">{currencyFormatter.format(appointmentRevenue)}</p>
          </div>
          <div className="rounded-2xl border border-base-300 bg-base-100 p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">POS Revenue</p>
            <p className="mt-2 text-2xl font-bold text-slate-800">{currencyFormatter.format(salesRevenue)}</p>
          </div>
          <div className="rounded-2xl border border-primary/40 bg-primary/5 p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-primary">Total Income</p>
            <p className="mt-2 text-2xl font-bold text-slate-900">{currencyFormatter.format(totalRevenue)}</p>
          </div>
        </section>
      )}
    </section>
  );
};

export default RevenuePage;
