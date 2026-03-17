import React, { useState } from 'react';
import Sidebar from './Sidebar.jsx';
import Navbar from './NavBar.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { useIsFetching, useIsMutating } from '@tanstack/react-query';
import { useClinicSettings } from '../context/ClinicSettingsContext.jsx';
import { getPosNavItems, isPosUserType } from '../constants/navigation.js';

const Layout = ({ children }) => {
  const auth = useAuth();
  const location = useLocation();
  const { settings } = useClinicSettings();
  const pendingQueries = useIsFetching();
  const pendingMutations = useIsMutating();
  const showLoader = pendingQueries + pendingMutations > 0;
  const [isCashierMenuOpen, setIsCashierMenuOpen] = useState(false);

  const onLoginPage = location.pathname === '/login';
  const showWatermark = !onLoginPage;
  const isCashier = isPosUserType(auth?.user?.user_type);

  return (
    <div className="flex min-h-screen bg-white text-slate-900">
      {!onLoginPage && auth && auth.user && !isCashier ? <Sidebar /> : null}
      <div className="flex-1 flex flex-col bg-white">
        {!onLoginPage && auth && auth.user ? (
          <Navbar isCashier={isCashier} onToggleCashierMenu={() => setIsCashierMenuOpen((prev) => !prev)} />
        ) : null}
        <main className={`flex-1 overflow-y-auto relative ${onLoginPage ? '' : 'px-6 py-10 lg:px-12 lg:py-12'}`}>
          <div className={`${onLoginPage ? '' : 'mx-auto w-full max-w-8xl space-y-8'} relative`}>{children}</div>

          {!onLoginPage && auth?.user && !isCashier ? (
            <div className="fixed right-1 top-1/2 -translate-y-1/2 z-50 flex flex-col gap-2">
              <Link
                to="/appointments"
                className="btn btn-sm btn-primary shadow-lg hover:shadow-xl py-10 px-2 min-h-[210px] w-10"
                style={{ writingMode: 'vertical-rl' }}
                title="Treatment"
              >
                🗓️ Treatment
              </Link>
              <Link
                to="/sales"
                className="btn btn-sm btn-success text-white shadow-lg hover:shadow-xl py-10 px-2 min-h-[230px] w-10"
                style={{ writingMode: 'vertical-rl' }}
                title="Direct Sales"
              >
                🧾 Direct Sales
              </Link>
            </div>
          ) : null}

          {!onLoginPage && auth?.user && isCashier && isCashierMenuOpen ? (
            <>
              <button
                type="button"
                className="fixed inset-0 z-40 bg-black/30"
                onClick={() => setIsCashierMenuOpen(false)}
                aria-label="Close menu"
              />
              <aside className="fixed left-0 top-0 z-50 flex h-full w-72 flex-col border-r border-slate-800 bg-black text-slate-100 shadow-2xl">
                <div className="flex items-center justify-between border-b border-slate-800 px-4 py-4">
                  <p className="text-sm font-semibold tracking-wide">Menu</p>
                  <button
                    type="button"
                    className="btn btn-xs btn-outline"
                    onClick={() => setIsCashierMenuOpen(false)}
                  >
                    ✕
                  </button>
                </div>
                <nav className="flex-1 overflow-y-auto px-3 py-4">
                  <ul className="space-y-2">
                    {getPosNavItems(auth?.user?.user_type).map((item) => (
                      <li key={item.to}>
                        <NavLink
                          to={item.to}
                          end={Boolean(item.end)}
                          onClick={() => setIsCashierMenuOpen(false)}
                          className={({ isActive }) =>
                            `flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
                              isActive ? 'bg-primary/20 text-white' : 'text-slate-100 hover:bg-slate-800'
                            }`
                          }
                        >
                          <span className="text-lg" aria-hidden>{item.icon}</span>
                          <span>{item.label}</span>
                        </NavLink>
                      </li>
                    ))}
                  </ul>
                </nav>
              </aside>
            </>
          ) : null}

          {showWatermark && (
            <img
              src="/bg.jpg"
              alt=""
              className="pointer-events-none fixed inset-0 w-full h-full opacity-20 -z-10 object-cover"
            />
          )}

          {showLoader && (
            <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80">
              <div className="flex flex-col items-center gap-4 text-white">
                <div className="h-12 w-12 rounded-full border-4 border-white/30 border-t-white animate-spin" aria-hidden="true" />
                <div className="text-lg font-semibold tracking-wide">{settings?.name}</div>
                <div className="text-xs uppercase tracking-[0.2em] text-white/70">Loading</div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default Layout;
