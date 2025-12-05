const StatCard = ({ title, value, icon }) => (
  <article className="flex items-center gap-4 rounded-2xl border border-base-300 bg-base-100 p-6 shadow-sm">
    <div className="grid h-14 w-14 place-items-center rounded-2xl bg-primary/15 text-2xl text-primary" aria-hidden>
      {icon}
    </div>
    <div className="flex flex-col">
      <span className="text-sm font-medium text-slate-500">{title}</span>
      <span className="text-2xl font-semibold text-slate-800">{value}</span>
    </div>
  </article>
);

export default StatCard;
