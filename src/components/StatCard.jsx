const colorMap = {
  blue:    { iconBg: 'bg-blue-100',    iconText: 'text-blue-600'    },
  emerald: { iconBg: 'bg-emerald-100', iconText: 'text-emerald-600' },
  amber:   { iconBg: 'bg-amber-100',   iconText: 'text-amber-600'   },
  rose:    { iconBg: 'bg-rose-100',    iconText: 'text-rose-600'    },
  sky:     { iconBg: 'bg-sky-100',     iconText: 'text-sky-600'     },
  violet:  { iconBg: 'bg-violet-100',  iconText: 'text-violet-600'  },
  primary: { iconBg: 'bg-blue-100',    iconText: 'text-blue-600'    },
};

// trend: positive number = up (green), negative = down (red), omit for no badge
// trendLabel: e.g. "vs yesterday"
const StatCard = ({ title, value, icon, color = 'blue', onClick, trend, trendLabel }) => {
  const { iconBg, iconText } = colorMap[color] ?? colorMap.blue;
  const hasTrend = trend !== undefined && trend !== null;
  const trendUp = hasTrend && trend > 0;
  const trendDown = hasTrend && trend < 0;

  return (
    <article
      className={`flex flex-col gap-4 rounded-2xl border border-base-300 bg-white p-5 shadow-sm ${
        onClick ? 'cursor-pointer transition hover:shadow-md hover:border-blue-200' : ''
      }`}
      onClick={onClick}
      onKeyDown={(e) => {
        if (!onClick) return;
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); }
      }}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${iconBg}`}>
            <span className={`text-xl leading-none ${iconText}`}>{icon}</span>
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-800 leading-none">{value}</p>
            <p className="mt-1 text-xs font-medium uppercase tracking-wide text-slate-400">{title}</p>
          </div>
        </div>
        {hasTrend && (
          <span className={`inline-flex items-center gap-0.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
            trendUp   ? 'bg-emerald-100 text-emerald-700' :
            trendDown ? 'bg-rose-100 text-rose-700' :
                        'bg-slate-100 text-slate-500'
          }`}>
            {trendUp ? '↑' : trendDown ? '↓' : ''}
            {Math.abs(trend)}%
          </span>
        )}
      </div>
      {hasTrend && trendLabel && (
        <p className={`text-[11px] font-medium ${
          trendUp ? 'text-emerald-600' : trendDown ? 'text-rose-600' : 'text-slate-400'
        }`}>
          {trendUp ? '↑' : trendDown ? '↓' : ''}{Math.abs(trend)}% {trendLabel}
        </p>
      )}
    </article>
  );
};

export default StatCard;
