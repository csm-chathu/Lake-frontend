import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Eye,
  Printer,
  Search,
  ScrollText,
  X,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import EntityTable from '../components/EntityTable.jsx';
import api from '../api/client.js';

const currencyFormatter = new Intl.NumberFormat('en-LK', { style: 'currency', currency: 'LKR' });

const formatMoney = (value) => currencyFormatter.format(Number(value) || 0);

const DirectSalesHistoryPage = () => {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [totalRecords, setTotalRecords] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const hasDateFilter = dateFrom || dateTo;

  useEffect(() => {
    setPage(1);
  }, [searchQuery, perPage, dateFrom, dateTo]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const loadSales = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/direct-sales', {
        params: {
          q: searchQuery || undefined,
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
      setError(e.message || 'Failed to load direct sales.');
      setItems([]);
      setTotalRecords(0);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  }, [page, perPage, searchQuery, dateFrom, dateTo]);

  useEffect(() => {
    loadSales();
  }, [loadSales]);

  const openReprint = useCallback((sale) => {
    const lineItems = (sale.items || []).map((entry) => {
      const medicineName = entry?.brand?.medicine?.name || '';
      const brandName = entry?.brand?.name || '';
      const label = [medicineName, brandName].filter(Boolean).join(' — ') || 'Item';
      return {
        label,
        qty: Number(entry.quantity) || 0,
        unit: Number(entry.unitPrice) || 0
      };
    });
    navigate('/sales/receipt', {
      state: {
        from: 'history',
        sale: {
          invoiceReference: sale.saleReference || `Sale #${sale.id}`,
          saleDate: sale.date || null,
          discount: Number(sale.discount) || 0,
          serviceCharge: Number(sale.serviceCharge) || 0,
          estimated: Number(sale.total) || 0,
          paymentType: sale.paymentType || 'cash',
          paymentStatus: sale.paymentStatus || 'paid',
          lineItems,
        }
      }
    });
  }, [navigate]);

  const columns = useMemo(
    () => [
      {
        header: 'Date & Time',
        accessor: 'date',
        render: (sale) => {
          const date = new Date(sale.date);
          if (Number.isNaN(date.valueOf())) {
            return '—';
          }

          return (
            <div className="flex flex-col gap-0.5">
              <span className="font-medium text-slate-800">{date.toLocaleDateString()}</span>
              <span className="text-xs text-slate-400">{date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
          );
        }
      },
      {
        header: 'Reference',
        accessor: 'saleReference',
        render: (sale) => (
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
              #{sale.id}
            </span>
            <span className="font-medium text-slate-800">{sale.saleReference || `Sale #${sale.id}`}</span>
          </div>
        )
      },
      {
        header: 'Items & Price',
        accessor: 'items',
        render: (sale) => {
          const entries = sale.items || [];
          if (entries.length === 0) {
            return <span className="text-slate-400">—</span>;
          }

          return (
            <div className="space-y-1">
              {entries.map((entry) => {
                const medicineName = entry?.brand?.medicine?.name || '';
                const brandName = entry?.brand?.name || '';
                const label = [medicineName, brandName].filter(Boolean).join(' — ') || 'Item';
                const qty = Number(entry.quantity) || 0;
                const lineTotal = Number(entry.lineTotal) || 0;

                return (
                  <div key={entry.id} className="flex items-center justify-between gap-3 text-xs">
                    <span className="text-slate-700">{label} <span className="text-slate-400">x{qty}</span></span>
                    <span className="font-medium text-slate-800">{formatMoney(lineTotal)}</span>
                  </div>
                );
              })}
            </div>
          );
        }
      },
      {
        header: 'Totals',
        accessor: 'total',
        render: (sale) => (
          <div className="space-y-1 text-xs">
            <p className="text-slate-600">Subtotal: <span className="font-medium text-slate-800">{formatMoney(sale.subtotal)}</span></p>
            <p className="text-slate-600">Discount: <span className="font-medium text-emerald-700">{formatMoney(sale.discount)}</span></p>
            <p className="text-sm font-semibold text-slate-900">Total: {formatMoney(sale.total)}</p>
          </div>
        )
      },
      {
        header: '',
        accessor: 'action',
        render: (sale) => (
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100 transition"
            onClick={() => openReprint(sale)}
          >
            <Eye size={13} />
            <Printer size={13} />
            View & Reprint
          </button>
        )
      }
    ],
    [openReprint]
  );

  return (
    <section className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-600">
          <ScrollText size={22} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Direct Sales History</h1>
          <p className="text-sm text-slate-400">Browse previous direct sales and reprint invoices in one place.</p>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <AlertTriangle size={16} className="shrink-0" />
          {error}
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-end gap-3">
          <div className="relative flex-1 min-w-[240px]">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search reference or item..."
              className="input input-bordered w-full pl-9 text-sm"
            />
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

      <EntityTable
        columns={columns}
        data={items}
        loading={loading}
        loadingMessage="Loading sales history..."
        bodyMaxHeightClass="max-h-[72vh]"
        emptyMessage="No direct sales recorded yet."
        enableSearch={false}
      />

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-3 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 uppercase tracking-wide">Rows per page</span>
          <select
            className="select select-sm select-bordered"
            value={perPage}
            onChange={(e) => setPerPage(Number(e.target.value) || 10)}
          >
            {[10, 20, 50].map((size) => <option key={size} value={size}>{size}</option>)}
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

    </section>
  );
};

export default DirectSalesHistoryPage;
