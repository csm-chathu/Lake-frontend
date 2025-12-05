import React from 'react';
import { NavLink } from 'react-router-dom';

const navItems = [
  { to: '/', label: 'Dashboard', description: 'Today at a glance', end: true },
  { to: '/patients', label: 'Patients', description: 'Records & history' },
  { to: '/owners', label: 'Owners', description: 'Contacts & notes' },
  { to: '/veterinarians', label: 'Veterinarian', description: 'Team roster' },
  { to: '/medicines', label: 'Medicines', description: 'Inventory & pricing' },
  { to: '/appointments', label: 'Schedule', description: 'Book and manage', end: true },
  { to: '/appointments/history', label: 'History', description: 'Past visits' }
];

const baseLinkClasses =
  'group flex items-start gap-3 rounded-lg border border-transparent px-3 py-3 text-sm font-medium transition-[background,box-shadow,border-color] hover:border-slate-500/50 hover:bg-slate-800/60';

const activeLinkClasses =
  'border-primary/70 bg-primary/20 text-white shadow-md shadow-primary/20 hover:border-primary hover:bg-primary/30';

const Sidebar = () => (
  <aside className="hidden min-h-screen w-64 flex-col border-r border-slate-800 bg-slate-900 text-slate-100 lg:flex">
    <div className="flex items-center gap-3 border-b border-slate-800 px-5 pb-5 pt-8">
      <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/70 shadow-lg shadow-primary/40">
        <img src="/logo-mark.svg" alt="Clinic mark" className="h-7 w-7" />
      </span>
      <div>
        <p className="text-base font-semibold tracking-tight text-white">Lake Clinic</p>
        <p className="text-[10px] uppercase tracking-[0.24em] text-slate-400">Care dashboard</p>
      </div>
    </div>
    <nav className="flex-1 overflow-y-auto px-3 py-5">
      <ul className="flex flex-col gap-1.5">
        {navItems.map((item) => (
          <li key={item.to}>
            <NavLink
              to={item.to}
              end={Boolean(item.end)}
              className={({ isActive }) =>
                `${baseLinkClasses} ${isActive ? activeLinkClasses : 'text-slate-600'} `
              }
            >
              <div className="flex flex-1 flex-col">
                <span className="text-sm font-semibold tracking-tight">{item.label}</span>
                <span className="text-[11px] font-normal text-slate-400 group-hover:text-slate-300">
                  {item.description}
                </span>
              </div>
              <span
                className="mt-1 hidden h-6 w-6 items-center justify-center rounded-full border border-primary/60 text-[10px] font-semibold text-primary group-hover:flex"
                aria-hidden
              >
                →
              </span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
    <div className="mx-4 mb-5 rounded-xl border border-slate-700 bg-slate-800/80 p-4 text-xs text-slate-300 shadow-sm shadow-black/30">
      <p className="mb-2 text-sm font-semibold text-white">Clinic pulse</p>
      <div className="space-y-1.5">
        <p>• Monitor walk-ins from the schedule view.</p>
        <p>• Confirm medicine stock after each visit.</p>
      </div>
    </div>
  </aside>
);

export default Sidebar;
