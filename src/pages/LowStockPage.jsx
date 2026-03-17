import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import useEntityApi from '../hooks/useEntityApi.js';

const LowStockPage = () => {
  const { items: medicines, loading, error } = useEntityApi('medicines');

  const now = new Date();
  const dayInMs = 24 * 60 * 60 * 1000;
  const startOfTodayMs = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0).valueOf();

  const expiringSoonAll = useMemo(() => {
    const list = [];
    const horizonDays = 30;

    medicines.forEach((medicine) => {
      const medicineName = medicine?.name || 'Unnamed item';
      const brands = Array.isArray(medicine?.brands) ? medicine.brands : [];

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
              daysUntilExpiry
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
          daysUntilExpiry
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

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold text-slate-800">Low Stock / Expiring Soon</h1>
        <p className="text-sm text-slate-500">POS stock risk view for upcoming expiries in the next 30 days.</p>
      </div>

      {error && (
        <div className="alert alert-error shadow-sm">
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="rounded-2xl border border-base-300 bg-base-100 p-6 text-center text-slate-500 shadow-sm">
          Loading stock alerts…
        </div>
      ) : (
        <div className="rounded-2xl border border-rose-300 bg-rose-50 p-6 shadow-sm text-sm text-rose-900">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h3 className="text-base font-semibold">Expiring soon (30 days)</h3>
            <span className="rounded-full bg-rose-200 px-3 py-1 text-xs font-semibold text-rose-800">
              {expiringSoonAll.length}
            </span>
          </div>

          {expiringSoonAll.length === 0 ? (
            <p className="text-xs text-rose-700/80">No batches expiring in the next 30 days.</p>
          ) : (
            <ul className="max-h-[70vh] space-y-2 overflow-y-auto pr-1 text-xs">
              {expiringSoonAll.map((item) => (
                <li key={item.id}>
                  <Link
                    to="/medicines"
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

          <div className="mt-3 text-right text-[11px]">
            <Link to="/medicines" className="link link-primary">Manage stock batches</Link>
          </div>
        </div>
      )}
    </section>
  );
};

export default LowStockPage;
