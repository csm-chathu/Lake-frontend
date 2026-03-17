const PaymentFooter = ({
  paymentType,
  paymentStatus,
  settledAt,
  onPaymentTypeChange,
  onPaymentStatusChange,
  onSettledAtChange,
  paymentStatusOptions
}) => (
  <div className="flex flex-wrap items-center gap-3">
    <div className="text-sm font-medium text-slate-600 hidden">Payment</div>
    <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Payment type">
      {[{
        key: 'cash',
        label: 'Cash',
        icon: '💵',
        helper: 'Paid at counter'
      }, {
        key: 'credit',
        label: 'Credit',
        icon: '💳',
        helper: 'Balance due later'
      }].map((option) => {
        const active = paymentType === option.key;
        return (
          <button
            key={option.key}
            type="button"
            className={`flex min-w-[140px] items-start gap-3 rounded-lg border px-3 py-2 text-left shadow-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500 ${active ? 'border-emerald-500 bg-emerald-50 text-emerald-900' : 'border-slate-200 bg-white hover:border-emerald-200'}`}
            onClick={() => onPaymentTypeChange(option.key)}
            role="radio"
            aria-checked={active}
          >
            <span className="text-lg" aria-hidden>{option.icon}</span>
            <div className="flex-1">
              <p className="text-sm font-semibold">{option.label}</p>
              <p className="text-[11px] text-slate-500">{option.helper}</p>
            </div>
            {active ? <span className="text-[11px] font-semibold text-emerald-700">Selected</span> : null}
          </button>
        );
      })}
    </div>
    {paymentType === 'credit' && (
      <div className="flex flex-wrap items-center gap-2">
        <select
          className="select select-sm select-bordered w-36"
          value={paymentStatus}
          onChange={(event) => onPaymentStatusChange(event.target.value)}
        >
          {paymentStatusOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>

        {paymentStatus === 'paid' && (
          <div className="ml-2 flex items-center gap-2">
            <label className="text-sm font-medium text-slate-600">Settled on</label>
            <input
              type="datetime-local"
              value={settledAt || ''}
              onChange={(event) => onSettledAtChange(event.target.value)}
              className="input input-sm input-bordered"
            />
          </div>
        )}
      </div>
    )}
  </div>
);

export default PaymentFooter;
