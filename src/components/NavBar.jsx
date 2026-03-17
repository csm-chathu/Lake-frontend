import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useClinicSettings } from '../context/ClinicSettingsContext.jsx';

const Navbar = ({ isCashier = false, onToggleCashierMenu = () => {} }) => {
  const auth = useAuth();
  const { settings } = useClinicSettings();

  if (!auth?.user) {
    return null;
  }

  const displayName = auth.user.name || auth.user.email || 'Team member';
  const userType = auth.user.user_type ? (auth.user.user_type.charAt(0).toUpperCase() + auth.user.user_type.slice(1)) : 'User';

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex w-full max-w-8xl items-center justify-between px-6 py-4 lg:px-12">
        <div className="flex items-center gap-3">
          {isCashier ? (
            <>
              <button type="button" className="btn btn-sm btn-outline" onClick={onToggleCashierMenu} aria-label="Open menu">
                ☰
              </button>
              <Link to="/" className="btn btn-sm btn-outline" title="Home">
                🏠 Home
              </Link>
            </>
          ) : null}
          <div>
          <p className="text-[11px] uppercase tracking-[0.3em] text-slate-400">{settings?.name}</p>
          <p className="text-lg font-semibold text-slate-900">{settings?.tagline}</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-sm font-semibold text-slate-900">{displayName}</p>
            <p className="text-xs text-slate-500">{userType}</p>
          </div>
          <button type="button" className="btn btn-sm btn-outline" onClick={auth.logout}>
            Logout
          </button>
        </div>
      </div>
    </header>
  );
};

export default Navbar;
