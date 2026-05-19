import React from 'react';
import { NavLink } from 'react-router-dom';
import { useClinicSettings } from '../context/ClinicSettingsContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { doctorNavItems, getPosNavItems, isPosUserType } from '../constants/navigation.js';

const baseLinkClasses =
  'group flex items-center gap-2 rounded-lg border border-transparent px-2 py-2 text-xs font-medium transition-[background,box-shadow,border-color] hover:border-slate-500/50 hover:bg-slate-800/60';

const activeLinkClasses =
  'border-primary/70 bg-primary/20 text-white shadow-md shadow-primary/20 hover:border-primary hover:bg-primary/30';

const Sidebar = ({ mobile = false, onNavClick = () => {} }) => {
  const { settings } = useClinicSettings();
  const { user } = useAuth();

  const navItems = isPosUserType(user?.user_type) ? getPosNavItems(user?.user_type) : doctorNavItems;

  const logoUrl = settings?.logo_url
    ? (() => { try { return new URL(settings.logo_url, window.location.href).href; } catch { return settings.logo_url; } })()
    : '';

  const nav = (
    <nav className="flex-1 overflow-y-auto px-3 py-5">
      <ul className="flex flex-col gap-0.5">
        {navItems.map((item) => (
          <li key={item.to}>
            <NavLink
              to={item.to}
              end={Boolean(item.end)}
              onClick={onNavClick}
              className={({ isActive }) =>
                `${baseLinkClasses} ${isActive ? activeLinkClasses : 'text-white'} `
              }
            >
              <div className="flex flex-1 flex-col items-start gap-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-base">{item.icon}</span>
                  <span className="text-xs font-semibold tracking-tight">{item.label}</span>
                </div>
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
  );

  if (mobile) {
    return nav;
  }

  return (
    <aside className="hidden lg:flex h-screen sticky top-0 w-56 flex-col border-r border-slate-800 bg-black text-slate-100">
      <div className="flex items-center gap-3 border-b border-slate-800 px-5 pb-5 pt-8">
        <div className="mx-auto mr-0 flex items-center">
          <div className="flex h-20 w-20 items-center justify-center p-1 shadow-md">
            {logoUrl
              ? <img src={logoUrl} alt={`${settings?.name} logo`} className="h-20 w-20 object-contain" />
              : <span className="text-3xl">🐾</span>
            }
          </div>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-[0.24em] text-slate-400">{settings?.tagline}</p>
        </div>
      </div>
      {nav}
    </aside>
  );
};

export default Sidebar;
