import { Banknote, CreditCard } from 'lucide-react';

const OPTIONS = [
  {
    key: 'cash',
    label: 'Cash',
    helper: 'Paid at counter',
    Icon: Banknote,
    activeClass: 'border-emerald-300 bg-emerald-50 text-emerald-900',
    activeIcon: 'text-emerald-600',
    badge: 'bg-emerald-100 text-emerald-700'
  },
  {
    key: 'credit',
    label: 'Credit',
    helper: 'Balance due later',
    Icon: CreditCard,
    activeClass: 'border-violet-300 bg-violet-50 text-violet-900',
    activeIcon: 'text-violet-600',
    badge: 'bg-violet-100 text-violet-700'
  }
];

const PaymentFooter = ({
  paymentType,
  paymentStatus,
  settledAt,
  onPaymentTypeChange,
  onPaymentStatusChange,
  onSettledAtChange,
  paymentStatusOptions
}) => (
  <div className="space-y-2">
    <div className="grid grid-cols-2 gap-1.5" role="radiogroup" aria-label="Payment type">
      {OPTIONS.map((option) => {
        const active = paymentType === option.key;
        return (
          <button
            key={option.key}
            type="button"
            role="radio"
            aria-checked={active}
            className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-left transition ${
              active ? option.activeClass : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
            }`}
            onClick={() => onPaymentTypeChange(option.key)}
          >
            <option.Icon
              size={13}
              className={active ? option.activeIcon : 'text-slate-400'}
            />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold leading-tight">{option.label}</p>
            </div>
            {active && (
              <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold ${option.badge}`}>✓</span>
            )}
          </button>
        );
      })}
    </div>

    {paymentType === 'credit' && (
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-col gap-0.5">
          <label className="text-[9px] font-semibold uppercase tracking-wide text-slate-400">Status</label>
          <select
            className="select select-xs select-bordered bg-white text-xs text-slate-800 focus:border-blue-400"
            value={paymentStatus}
            onChange={(event) => onPaymentStatusChange(event.target.value)}
          >
            {paymentStatusOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        {paymentStatus === 'paid' && (
          <div className="flex flex-col gap-0.5">
            <label className="text-[9px] font-semibold uppercase tracking-wide text-slate-400">Settled on</label>
            <input
              type="datetime-local"
              value={settledAt || ''}
              onChange={(event) => onSettledAtChange(event.target.value)}
              className="input input-xs input-bordered bg-white text-xs text-slate-800 focus:border-blue-400 focus:outline-none"
            />
          </div>
        )}
      </div>
    )}
  </div>
);

export default PaymentFooter;
