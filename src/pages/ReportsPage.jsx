import React, { useMemo, useState, useEffect } from 'react';
import client from '../api/client.js';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

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

const COLORS = ['#3b82f6', '#ef4444'];

const ReportsPage = () => {
  const [period, setPeriod] = useState('day');
  const [selectedDate, setSelectedDate] = useState(() => formatDateInput(new Date()));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Revenue data
  const [appointmentRevenue, setAppointmentRevenue] = useState(0);
  const [salesRevenue, setSalesRevenue] = useState(0);
  
  // Gender distribution
  const [genderData, setGenderData] = useState([]);
  
  // Common reasons
  const [commonReasons, setCommonReasons] = useState([]);
  
  // Most visited patients
  const [mostVisitedPatients, setMostVisitedPatients] = useState([]);
  
  // Summary statistics
  const [summaryStats, setSummaryStats] = useState({
    totalAppointments: 0,
    totalSales: 0,
    totalPatients: 0
  });

  const range = useMemo(() => getRangeByPeriod(period, selectedDate), [period, selectedDate]);

  useEffect(() => {
    const fetchReportData = async () => {
      setLoading(true);
      setError(null);
      try {
        const startDate = formatDateInput(range.start);
        const endDate = formatDateInput(new Date(range.end.getTime() - 86400000));
        
        const response = await client.get('/reports/comprehensive', {
          params: { startDate, endDate }
        });

        // Revenue data
        setAppointmentRevenue(response.data.appointmentRevenue || 0);
        setSalesRevenue(response.data.salesRevenue || 0);

        // Gender distribution
        setGenderData([
          { name: 'Male', value: response.data.maleCount || 0, fill: '#3b82f6' },
          { name: 'Female', value: response.data.femaleCount || 0, fill: '#ef4444' }
        ]);

        // Common reasons (top 5)
        setCommonReasons(response.data.commonReasons || []);

        // Most visited patients (top 10)
        setMostVisitedPatients(response.data.mostVisitedPatients || []);

        // Summary stats
        setSummaryStats({
          totalAppointments: response.data.totalAppointments || 0,
          totalSales: response.data.totalSales || 0,
          totalPatients: response.data.totalPatients || 0
        });
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to load report data');
        setAppointmentRevenue(0);
        setSalesRevenue(0);
        setGenderData([]);
        setCommonReasons([]);
        setMostVisitedPatients([]);
      } finally {
        setLoading(false);
      }
    };

    fetchReportData();
  }, [range]);

  const totalRevenue = Number((appointmentRevenue + salesRevenue).toFixed(2));

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold text-slate-800">Reports & Analytics</h1>
        <p className="text-sm text-slate-500">Comprehensive system overview with detailed analytics, revenue tracking, and patient statistics.</p>
      </div>

      {error && (
        <div className="alert alert-error shadow-sm">
          <span>{error}</span>
        </div>
      )}

      {/* Period Selector */}
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
        <div className="rounded-2xl border border-base-300 bg-base-100 p-12 text-center text-slate-500 shadow-sm">
          <div className="flex justify-center mb-4">
            <div className="h-12 w-12 rounded-full border-4 border-slate-200 border-t-primary animate-spin" />
          </div>
          Loading report data…
        </div>
      ) : (
        <>
          {/* Revenue Summary Cards */}
          <section className="grid gap-4 md:grid-cols-4">
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
            <div className="rounded-2xl border border-base-300 bg-base-100 p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Appointments</p>
              <p className="mt-2 text-2xl font-bold text-slate-800">{summaryStats.totalAppointments}</p>
            </div>
          </section>

          {/* Statistics Overview */}
          <section className="grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-base-300 bg-base-100 p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Total Patients Visited</p>
              <p className="mt-2 text-2xl font-bold text-slate-800">{summaryStats.totalPatients}</p>
            </div>
            <div className="rounded-2xl border border-base-300 bg-base-100 p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Total Sales</p>
              <p className="mt-2 text-2xl font-bold text-slate-800">{summaryStats.totalSales}</p>
            </div>
            <div className="rounded-2xl border border-base-300 bg-base-100 p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Avg Revenue/Appointment</p>
              <p className="mt-2 text-2xl font-bold text-slate-800">
                {summaryStats.totalAppointments > 0 
                  ? currencyFormatter.format(totalRevenue / summaryStats.totalAppointments)
                  : '₨0.00'}
              </p>
            </div>
          </section>

          {/* Charts Section */}
          <section className="grid gap-4 md:grid-cols-2">
            {/* Gender Distribution Chart */}
            <div className="rounded-2xl border border-base-300 bg-base-100 p-5 shadow-sm">
              <h3 className="mb-4 text-lg font-semibold text-slate-800">Gender Distribution</h3>
              {genderData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={genderData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, value }) => `${name}: ${value}`}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {genderData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-[300px] items-center justify-center text-slate-400">
                  No data available
                </div>
              )}
            </div>

            {/* Summary Stats Box */}
            <div className="rounded-2xl border border-base-300 bg-base-100 p-5 shadow-sm">
              <h3 className="mb-4 text-lg font-semibold text-slate-800">Summary</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-base-200 pb-2">
                  <span className="text-sm text-slate-600">Total Appointments</span>
                  <span className="font-bold text-slate-800">{summaryStats.totalAppointments}</span>
                </div>
                <div className="flex items-center justify-between border-b border-base-200 pb-2">
                  <span className="text-sm text-slate-600">Unique Patients</span>
                  <span className="font-bold text-slate-800">{summaryStats.totalPatients}</span>
                </div>
                <div className="flex items-center justify-between border-b border-base-200 pb-2">
                  <span className="text-sm text-slate-600">Direct Sales Count</span>
                  <span className="font-bold text-slate-800">{summaryStats.totalSales}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-600">Gender Split</span>
                  <span className="text-sm font-semibold text-slate-800">
                    {genderData[0]?.value || 0}M / {genderData[1]?.value || 0}F
                  </span>
                </div>
              </div>
            </div>
          </section>

          {/* Top 5 Common Reasons */}
          <section className="rounded-2xl border border-base-300 bg-base-100 p-5 shadow-sm">
            <h3 className="mb-4 text-lg font-semibold text-slate-800">Top 5 Most Common Reasons</h3>
            {commonReasons.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-base-300">
                      <th className="px-4 py-3 text-left font-semibold text-slate-700">Reason</th>
                      <th className="px-4 py-3 text-right font-semibold text-slate-700">Count</th>
                      <th className="px-4 py-3 text-right font-semibold text-slate-700">Percentage</th>
                    </tr>
                  </thead>
                  <tbody>
                    {commonReasons.slice(0, 5).map((reason, idx) => (
                      <tr key={idx} className="border-b border-base-200 hover:bg-base-200/30">
                        <td className="px-4 py-3 text-slate-800">{reason.reason || 'N/A'}</td>
                        <td className="px-4 py-3 text-right font-semibold text-slate-800">{reason.count}</td>
                        <td className="px-4 py-3 text-right text-slate-600">
                          {summaryStats.totalAppointments > 0 
                            ? ((reason.count / summaryStats.totalAppointments) * 100).toFixed(1)
                            : 0}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="py-8 text-center text-slate-400">No data available</div>
            )}
          </section>

          {/* Most Visited Patients */}
          <section className="rounded-2xl border border-base-300 bg-base-100 p-5 shadow-sm">
            <h3 className="mb-4 text-lg font-semibold text-slate-800">Most Visited Patients (Top 10)</h3>
            {mostVisitedPatients.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-base-300">
                      <th className="px-4 py-3 text-left font-semibold text-slate-700">Patient Name</th>
                      <th className="px-4 py-3 text-left font-semibold text-slate-700">Owner</th>
                      <th className="px-4 py-3 text-center font-semibold text-slate-700">Visits</th>
                      <th className="px-4 py-3 text-right font-semibold text-slate-700">Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mostVisitedPatients.slice(0, 10).map((patient, idx) => (
                      <tr key={idx} className="border-b border-base-200 hover:bg-base-200/30">
                        <td className="px-4 py-3 font-medium text-slate-800">{patient.name || 'N/A'}</td>
                        <td className="px-4 py-3 text-slate-700">{patient.ownerName || 'N/A'}</td>
                        <td className="px-4 py-3 text-center font-semibold text-slate-800">{patient.visitCount}</td>
                        <td className="px-4 py-3 text-right text-slate-800">
                          {currencyFormatter.format(patient.totalRevenue || 0)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="py-8 text-center text-slate-400">No data available</div>
            )}
          </section>
        </>
      )}
    </section>
  );
};

export default ReportsPage;
