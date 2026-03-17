// color can be any Tailwind color name such as "primary", "emerald", "rose", etc.
// the component applies a rich background colour and white text for high contrast.
// Tailwind can't see dynamic template strings during purge, so we map colours
// explicitly to ensure the required classes are generated.
const StatCard = ({ title, value, icon, color = 'primary', onClick }) => {
  const colorMap = {
    emerald: {
      cardBg: 'bg-emerald-600',
      cardBorder: 'border-emerald-700'
    },
    sky: {
      cardBg: 'bg-sky-600',
      cardBorder: 'border-sky-700'
    },
    rose: {
      cardBg: 'bg-rose-600',
      cardBorder: 'border-rose-700'
    },
    amber: {
      cardBg: 'bg-amber-600',
      cardBorder: 'border-amber-700'
    },
    primary: {
      cardBg: 'bg-primary-600',
      cardBorder: 'border-primary-700'
    }
  };

  const { cardBg, cardBorder } = colorMap[color] || colorMap.primary;

  return (
    <article
      className={`flex items-center gap-4 rounded-2xl border ${cardBorder} ${cardBg} p-6 shadow-sm ${onClick ? 'cursor-pointer transition hover:brightness-110' : ''}`}
      onClick={onClick}
      onKeyDown={(event) => {
        if (!onClick) {
          return;
        }
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onClick();
        }
      }}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      <span className="text-3xl text-white" aria-hidden>{icon}</span>
      <div className="flex flex-col">
        <span className="text-sm font-medium text-white">{title}</span>
        <span className="text-2xl font-semibold text-white">{value}</span>
      </div>
    </article>
  );
};

export default StatCard;
