import React, { useEffect, useMemo, useState } from 'react';
import client from '../api/client.js';

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

const SalesHeatmapPage = () => {
  const [period, setPeriod] = useState('day');
  const [selectedDate, setSelectedDate] = useState(() => formatDateInput(new Date()));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [salesHeatmap, setSalesHeatmap] = useState([]);
  const [bestSalesTime, setBestSalesTime] = useState([]);
  const [topProductsToday, setTopProductsToday] = useState([]);
  const [topProductsThisMonth, setTopProductsThisMonth] = useState([]);
  const [slowMovingItems, setSlowMovingItems] = useState([]);

  const range = useMemo(() => getRangeByPeriod(period, selectedDate), [period, selectedDate]);

  useEffect(() => {
    const fetchSalesHeatmap = async () => {
      setLoading(true);
      setError('');
      try {
        const startDate = formatDateInput(range.start);
        const endDate = formatDateInput(new Date(range.end.getTime() - 86400000));

        const response = await client.get('/reports/sales-heatmap', {
          params: { startDate, endDate }
        });

        setSalesHeatmap(response.data.salesHeatmap || []);
        setBestSalesTime(response.data.bestSalesTime || []);
        setTopProductsToday(response.data.topProductsToday || []);
        setTopProductsThisMonth(response.data.topProductsThisMonth || []);
        setSlowMovingItems(response.data.slowMovingItems || []);
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to load sales heatmap analytics');
        setSalesHeatmap([]);
        setBestSalesTime([]);
        setTopProductsToday([]);
        setTopProductsThisMonth([]);
        setSlowMovingItems([]);
      } finally {
        setLoading(false);
      }
    };

    fetchSalesHeatmap();
  }, [range]);

  const maxHeatValue = useMemo(
    () => Math.max(...salesHeatmap.map((item) => Number(item.total) || 0), 0),
    [salesHeatmap]
  );

  const getHeatClass = (value) => {
    const numeric = Number(value) || 0;
    if (maxHeatValue <= 0 || numeric <= 0) return 'bg-base-200 text-slate-500';
    const ratio = numeric / maxHeatValue;
    if (ratio >= 0.75) return 'bg-primary text-primary-content';
    if (ratio >= 0.5) return 'bg-primary/70 text-primary-content';
    if (ratio >= 0.25) return 'bg-primary/40 text-slate-800';
    return 'bg-primary/20 text-slate-700';
  };

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold text-slate-800">Sales Heatmap</h1>
        <p className="text-sm text-slate-500">POS-only analytics for best sales times and product movement trends.</p>
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
        <div className="rounded-2xl border border-base-300 bg-base-100 p-12 text-center text-slate-500 shadow-sm">
          <div className="flex justify-center mb-4">
            <div className="h-12 w-12 rounded-full border-4 border-slate-200 border-t-primary animate-spin" />
          </div>
          Loading sales heatmap…
        </div>
      ) : (
        <>
          <section className="rounded-2xl border border-base-300 bg-base-100 p-5 shadow-sm space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-slate-800">Best Sales Time</h3>
                <p className="text-xs text-slate-500">Shows which time sales are highest.</p>
              </div>
              <div className="text-sm text-slate-700">
                {bestSalesTime.length > 0 ? (
                  bestSalesTime.map((slot, idx) => (
                    <p key={`${slot.label}-${idx}`} className="text-sm font-semibold text-slate-800">{slot.label} 🔥</p>
                  ))
                ) : (
                  <p className="text-xs text-slate-500">No peak slots yet</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8">
              {salesHeatmap.map((slot) => (
                <div
                  key={slot.hour}
                  className={`rounded-lg border border-base-300 p-2 text-center ${getHeatClass(slot.total)}`}
                  title={`${slot.label}: ${currencyFormatter.format(Number(slot.total || 0))}`}
                >
                  <p className="text-[11px] font-semibold">{slot.label}</p>
                  <p className="text-[11px] mt-1">{currencyFormatter.format(Number(slot.total || 0))}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="grid gap-4 lg:grid-cols-3">
            <div className="rounded-2xl border border-base-300 bg-base-100 p-5 shadow-sm">
              <h3 className="mb-4 text-lg font-semibold text-slate-800">Top Products Today</h3>
              {topProductsToday.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-base-300">
                        <th className="px-2 py-2 text-left font-semibold text-slate-700">Product</th>
                        <th className="px-2 py-2 text-right font-semibold text-slate-700">Qty</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topProductsToday.map((item, idx) => (
                        <tr key={`${item.name}-${idx}`} className="border-b border-base-200 hover:bg-base-200/30">
                          <td className="px-2 py-2 text-slate-800">{item.name}</td>
                          <td className="px-2 py-2 text-right font-semibold text-slate-800">{item.soldQty}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="py-8 text-center text-slate-400">No sales today</div>
              )}
            </div>

            <div className="rounded-2xl border border-base-300 bg-base-100 p-5 shadow-sm">
              <h3 className="mb-4 text-lg font-semibold text-slate-800">Top Products This Month</h3>
              {topProductsThisMonth.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-base-300">
                        <th className="px-2 py-2 text-left font-semibold text-slate-700">Product</th>
                        <th className="px-2 py-2 text-right font-semibold text-slate-700">Qty</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topProductsThisMonth.map((item, idx) => (
                        <tr key={`${item.name}-${idx}`} className="border-b border-base-200 hover:bg-base-200/30">
                          <td className="px-2 py-2 text-slate-800">{item.name}</td>
                          <td className="px-2 py-2 text-right font-semibold text-slate-800">{item.soldQty}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="py-8 text-center text-slate-400">No monthly sales data</div>
              )}
            </div>

            <div className="rounded-2xl border border-base-300 bg-base-100 p-5 shadow-sm">
              <h3 className="mb-4 text-lg font-semibold text-slate-800">Slow Moving Items</h3>
              {slowMovingItems.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-base-300">
                        <th className="px-2 py-2 text-left font-semibold text-slate-700">Product</th>
                        <th className="px-2 py-2 text-right font-semibold text-slate-700">Sold</th>
                        <th className="px-2 py-2 text-right font-semibold text-slate-700">Stock</th>
                      </tr>
                    </thead>
                    <tbody>
                      {slowMovingItems.map((item, idx) => (
                        <tr key={`${item.name}-${idx}`} className="border-b border-base-200 hover:bg-base-200/30">
                          <td className="px-2 py-2 text-slate-800">{item.name}</td>
                          <td className="px-2 py-2 text-right font-semibold text-slate-700">{item.soldQty}</td>
                          <td className="px-2 py-2 text-right font-semibold text-slate-800">{item.stock}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="py-8 text-center text-slate-400">No item movement data</div>
              )}
            </div>
          </section>
        </>
      )}
    </section>
  );
};

export default SalesHeatmapPage;
