import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useClinicSettings } from '../context/ClinicSettingsContext.jsx';

const Navbar = ({ isCashier = false, onToggleCashierMenu = () => {}, onToggleSidebar = () => {} }) => {
  const auth = useAuth();
  const { settings } = useClinicSettings();

  if (!auth?.user) {
    return null;
  }

  const displayName = auth.user.name || auth.user.email || 'Team member';
  const userType = auth.user.user_type ? (auth.user.user_type.charAt(0).toUpperCase() + auth.user.user_type.slice(1)) : 'User';

  return (
    <header className="sticky top-0 z-30 border-b-2 border-blue-500/30 bg-white/95 backdrop-blur shadow-sm">
      <div className="mx-auto flex w-full max-w-8xl items-center justify-between px-6 py-3 lg:px-12">
        <div className="flex items-center gap-3">
          {isCashier ? (
            <>
              <button type="button" className="btn btn-sm btn-outline border-blue-300 text-blue-700 hover:bg-blue-50" onClick={onToggleCashierMenu} aria-label="Open menu">
                ☰
              </button>
              <Link to="/" className="btn btn-sm btn-outline border-blue-300 text-blue-700 hover:bg-blue-50" title="Home">
                🏠 Home
              </Link>
            </>
          ) : (
            <button type="button" className="btn btn-sm btn-outline border-blue-300 text-blue-700 hover:bg-blue-50 lg:hidden" onClick={onToggleSidebar} aria-label="Open sidebar">
              ☰
            </button>
          )}
          <div className="border-l-2 border-blue-500 pl-3">
            <p className="text-[11px] uppercase tracking-[0.3em] text-blue-600 font-medium">{settings?.name}</p>
            <p className="text-base font-semibold text-slate-800">{settings?.tagline}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to="/getting-started"
            className="hidden sm:inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-100 transition"
          >
            🚀 Getting Started
          </Link>
          <div className="text-right">
            <p className="text-sm font-semibold text-slate-800">{displayName}</p>
            <p className="text-xs text-blue-600 font-medium">{userType}</p>
          </div>
          <button type="button" className="btn btn-sm border-blue-400 text-blue-700 bg-blue-50 hover:bg-blue-100" onClick={auth.logout}>
            Logout
          </button>
        </div>
      </div>
    </header>
  );
};

export default Navbar;
