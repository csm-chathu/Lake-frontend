import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import EntityTable from '../components/EntityTable.jsx';
import InvoicePrintModal from '../components/InvoicePrintModal.jsx';
import api from '../api/client.js';

const currencyFormatter = new Intl.NumberFormat('en-LK', { style: 'currency', currency: 'LKR' });

const formatSaleDate = (value) => {
  if (!value) {
    return '—';
  }
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) {
    return '—';
  }
  return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
};

const DirectSalesHistoryPage = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [totalRecords, setTotalRecords] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [invoiceModal, setInvoiceModal] = useState({ open: false, data: null });
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const closeInvoiceModal = useCallback(() => {
    setInvoiceModal({ open: false, data: null });
  }, []);

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

    setInvoiceModal({
      open: true,
      data: {
        doctorCharge: 0,
        surgeryCharge: 0,
        otherCharge: 0,
        medicinesSubtotal: Number(sale.subtotal) || 0,
        discount: Number(sale.discount) || 0,
        estimated: Number(sale.total) || 0,
        patientName: sale.saleReference || `Sale #${sale.id}`,
        appointmentId: null,
        medicines: sale.items || [],
        lineItems
      }
    });
  }, []);

  const columns = useMemo(
    () => [
      {
        header: 'Date',
        accessor: 'date',
        render: (sale) => formatSaleDate(sale.date)
      },
      {
        header: 'Reference',
        accessor: 'saleReference',
        render: (sale) => sale.saleReference || `Sale #${sale.id}`
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
                    <span className="text-slate-700">{label} (x{qty})</span>
                    <span className="font-medium text-slate-800">{currencyFormatter.format(lineTotal)}</span>
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
            <p>Subtotal: <span className="font-medium">{currencyFormatter.format(Number(sale.subtotal) || 0)}</span></p>
            <p>Discount: <span className="font-medium">{currencyFormatter.format(Number(sale.discount) || 0)}</span></p>
            <p className="text-sm font-semibold">Total: {currencyFormatter.format(Number(sale.total) || 0)}</p>
          </div>
        )
      },
      {
        header: 'Action',
        accessor: 'action',
        render: (sale) => (
          <button
            type="button"
            className="btn btn-xs btn-outline btn-primary"
            onClick={() => openReprint(sale)}
          >
            View & Reprint
          </button>
        )
      }
    ],
    [openReprint]
  );

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-slate-800">Direct Sales History</h1>
            <p className="text-sm text-slate-500">View sold items with prices and reprint invoices anytime.</p>
          </div>
        </div>
      </div>

      {error && (
        <div className="alert alert-error shadow-sm">
          <span>{error}</span>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <input
          type="search"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder="Search reference, item, payment..."
          className="input input-sm input-bordered flex-1 min-w-[200px]"
        />
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

      <EntityTable
        columns={columns}
        data={items}
        loading={loading}
        bodyMaxHeightClass="max-h-[72vh]"
        emptyMessage="No direct sales recorded yet."
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

      <InvoicePrintModal
        open={invoiceModal.open}
        invoice={invoiceModal.data}
        onClose={closeInvoiceModal}
        currencyFormatter={currencyFormatter}
        showDoctorCharge={false}
      />
    </section>
  );
};

export default DirectSalesHistoryPage;
