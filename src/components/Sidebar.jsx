import React from 'react';
import { NavLink } from 'react-router-dom';
import { useClinicSettings } from '../context/ClinicSettingsContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { doctorNavItems, getPosNavItems, isPosUserType } from '../constants/navigation.js';

const Sidebar = ({ mobile = false, onNavClick = () => {} }) => {
  const { settings } = useClinicSettings();
  const { user } = useAuth();

  const navItems = isPosUserType(user?.user_type) ? getPosNavItems(user?.user_type) : doctorNavItems;

  const logoUrl = settings?.logo_url
    ? `${window.location.origin}/${settings.logo_url.replace(/^\//, '')}`
    : '';

  const nav = (
    <nav className="flex-1 overflow-y-auto px-3 py-4">
      <ul className="flex flex-col gap-0.5">
        {navItems.map((item, index) => {
          if (item.section) {
            return (
              <li key={`section-${index}`} className="mb-1 mt-5 first:mt-2 px-2">
                <span className="text-[9px] font-bold uppercase tracking-[0.18em] text-slate-500">
                  {item.section}
                </span>
              </li>
            );
          }
          return (
            <li key={item.to}>
              <NavLink
                to={item.to}
                end={Boolean(item.end)}
                onClick={onNavClick}
                className={({ isActive }) =>
                  `flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-sm shadow-blue-900/40'
                      : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
                  }`
                }
              >
                <span className="text-sm leading-none">{item.icon}</span>
                <span className="tracking-tight">{item.label}</span>
              </NavLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );

  if (mobile) {
    return nav;
  }

  return (
    <aside className="hidden lg:flex h-screen sticky top-0 w-56 flex-col bg-[#0d1b3e] text-slate-100">
      <div className="flex flex-col items-center gap-2 border-b border-slate-800 px-5 pb-5 pt-6">
        <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-blue-600/20 shadow-md">
          {logoUrl
            ? <img src={logoUrl} alt={`${settings?.name} logo`} className="h-12 w-12 object-contain" />
            : <span className="text-2xl">🐾</span>
          }
        </div>
        <div className="text-center">
          <p className="text-sm font-semibold text-slate-100">{settings?.name}</p>
          <p className="text-[10px] text-slate-500">{settings?.tagline}</p>
        </div>
      </div>
      {nav}
    </aside>
  );
};

export default Sidebar;
