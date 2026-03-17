import React, { useCallback, useEffect, useState } from 'react';
import { closeDay, fetchDayEndSummary } from '../api/billing.js';

const fmt = new Intl.NumberFormat('en-LK', { style: 'currency', currency: 'LKR' });

const todayISO = () => new Date().toISOString().slice(0, 10);

const DayEndPage = () => {
  const [date, setDate] = useState(todayISO());
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  // Close-day form
  const [cashCounted, setCashCounted] = useState('');
  const [notes, setNotes] = useState('');
  const [closing, setClosing] = useState(false);
  const [closeSuccess, setCloseSuccess] = useState('');
  const [closeErr, setCloseErr] = useState('');

  const loadSummary = useCallback(async () => {
    setLoading(true);
    setErr('');
    setSummary(null);
    try {
      const res = await fetchDayEndSummary(date);
      setSummary(res.data ?? res);
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => { loadSummary(); }, [loadSummary]);

  const handleClose = async (e) => {
    e.preventDefault();
    setClosing(true);
    setCloseErr('');
    setCloseSuccess('');
    try {
      await closeDay({
        businessDate: date,
        cashCounted: Number(cashCounted) || 0,
        notes,
      });
      setCloseSuccess('Day successfully closed.');
      await loadSummary();          // refresh to show closure record
    } catch (ex) {
      setCloseErr(ex.message);
    } finally {
      setClosing(false);
    }
  };

  const s = summary;
  const expectedCash = s ? Number(s.cashIn ?? 0) - Number(s.cashOut ?? 0) : 0;
  const counted = Number(cashCounted) || 0;
  const variance = counted - expectedCash;

  return (
    <div className="flex flex-col gap-6 p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Sales Day-End Close</h1>
          <p className="text-xs text-slate-400 mt-0.5">Reconcile cash and close daily books</p>
        </div>
        <input
          type="date"
          className="input input-sm text-slate-800"
          value={date}
          onChange={(e) => { setDate(e.target.value); setCloseSuccess(''); setCashCounted(''); }}
        />
      </div>

      {err && <div className="alert alert-error text-sm">{err}</div>}

      {/* Summary cards */}
      {loading && <div className="text-slate-400 text-sm py-6 text-center">Loading summary…</div>}

      {!loading && s && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Invoices Issued', value: s.totalInvoices ?? 0, currency: false },
              { label: 'Total Billed', value: s.totalBilled ?? 0, currency: true },
              { label: 'Cash In', value: s.cashIn ?? 0, currency: true, color: 'text-green-700' },
              { label: 'Cash Out (Refunds)', value: s.cashOut ?? 0, currency: true, color: 'text-red-600' },
              { label: 'Card / Digital', value: s.nonCashIn ?? 0, currency: true, color: 'text-blue-600' },
              { label: 'Outstanding Due', value: s.outstandingDue ?? 0, currency: true, color: Number(s.outstandingDue) > 0 ? 'text-amber-600' : undefined },
              { label: 'Refunds Count', value: s.totalRefunds ?? 0, currency: false },
              { label: 'Payments Count', value: s.totalPayments ?? 0, currency: false },
            ].map(({ label, value, currency, color }) => (
              <div key={label} className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-center">
                <p className="text-[10px] uppercase tracking-widest text-slate-500">{label}</p>
                <p className={`text-sm font-semibold mt-0.5 ${color || 'text-slate-800'}`}>
                  {currency ? fmt.format(Number(value) || 0) : value}
                </p>
              </div>
            ))}
          </div>

          {/* Breakdown by method */}
          {s.byMethod && Object.keys(s.byMethod).length > 0 && (
            <div className="rounded-md border border-slate-200 overflow-hidden">
              <div className="bg-primary/5 px-4 py-2 text-[11px] uppercase tracking-widest text-primary font-semibold">
                Payments by Method
              </div>
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="text-[11px] uppercase text-slate-400">
                  <tr>
                    <th>Method</th>
                    <th className="text-right">Amount</th>
                    <th className="text-right">Count</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(s.byMethod).map(([method, data]) => (
                    <tr key={method} className="border-b border-slate-200">
                      <td className="capitalize">{method.replace('_', ' ')}</td>
                      <td className="text-right">{fmt.format(Number(data.amount) || 0)}</td>
                      <td className="text-right">{data.count ?? 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Existing closure info */}
          {s.closure && (
            <div className="rounded-lg border border-green-200 bg-green-50 p-4">
              <p className="text-sm font-semibold text-green-700 mb-1">✓ Day Already Closed</p>
              <p className="text-xs text-slate-700">
                Cash counted: <strong>{fmt.format(Number(s.closure.cashCounted) || 0)}</strong>
                {' · '}Expected: <strong>{fmt.format(Number(s.closure.expectedCash) || 0)}</strong>
                {' · '}Variance: <strong className={Number(s.closure.variance) !== 0 ? 'text-amber-600' : 'text-green-700'}>
                  {fmt.format(Number(s.closure.variance) || 0)}
                </strong>
              </p>
              {s.closure.notes && <p className="text-xs text-slate-400 mt-1">{s.closure.notes}</p>}
              <p className="text-[10px] text-slate-400 mt-1">Closed by user #{s.closure.userId} at {s.closure.updatedAt ? new Date(s.closure.updatedAt).toLocaleString('en-LK') : '—'}</p>
            </div>
          )}

          {/* Close day form */}
          {!s.closure && (
            <form onSubmit={handleClose} className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-4">
              <h2 className="text-sm font-semibold text-slate-800">Close Day</h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-slate-400">
                    Cash Counted (LKR)
                    {cashCounted !== '' && (
                      <span className={`ml-2 ${variance >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                        Variance: {fmt.format(variance)}
                      </span>
                    )}
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    className="input input-sm w-full"
                    placeholder={`Expected: ${fmt.format(expectedCash)}`}
                    value={cashCounted}
                    onChange={(e) => setCashCounted(e.target.value)}
                  />
                </label>

                <label className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-slate-400">Notes</span>
                  <input
                    type="text"
                    className="input input-sm w-full"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Optional remarks"
                  />
                </label>
              </div>

              {closeErr && <p className="text-error text-xs">{closeErr}</p>}
              {closeSuccess && <p className="text-success text-xs">{closeSuccess}</p>}

              <div className="flex justify-end">
                <button type="submit" disabled={closing} className="btn btn-sm btn-primary">
                  {closing ? 'Closing…' : 'Close Day'}
                </button>
              </div>
            </form>
          )}
        </>
      )}
    </div>
  );
};

export default DayEndPage;
