import React, { useState } from 'react';
import Sidebar from './Sidebar.jsx';
import Navbar from './NavBar.jsx';
import PrinterConfigModal from './PrinterConfigModal.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { useClinicSettings } from '../context/ClinicSettingsContext.jsx';
import { getPosNavItems, isPosUserType } from '../constants/navigation.js';

const Layout = ({ children }) => {
  const auth = useAuth();
  const location = useLocation();
  const { settings } = useClinicSettings();
  const [isCashierMenuOpen, setIsCashierMenuOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const onLoginPage = location.pathname === '/login';
  const showWatermark = !onLoginPage;
  const isCashier = isPosUserType(auth?.user?.user_type);

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900">
      {window.electronAPI?.isElectron && <PrinterConfigModal />}
      {!onLoginPage && auth && auth.user && !isCashier ? <Sidebar /> : null}
      <div className="flex-1 flex flex-col bg-slate-50">
        {!onLoginPage && auth && auth.user ? (
          <Navbar
            isCashier={isCashier}
            onToggleCashierMenu={() => setIsCashierMenuOpen((prev) => !prev)}
            onToggleSidebar={() => setIsSidebarOpen((prev) => !prev)}
          />
        ) : null}
        <main className={`flex-1 overflow-y-auto relative ${onLoginPage ? '' : 'px-6 py-3 lg:px-12 lg:py-4'}`}>
          <div className={`${onLoginPage ? '' : 'mx-auto w-full max-w-8xl space-y-8'} relative`}>{children}</div>

          {!onLoginPage && auth?.user && !isCashier ? (
            <div className="fixed right-1 top-1/2 -translate-y-1/2 z-50 flex flex-col gap-2">
              <Link
                to="/appointments"
                className="btn btn-sm shadow-lg hover:shadow-xl py-10 px-2 min-h-[210px] w-10 bg-blue-700 hover:bg-blue-600 border-blue-700 text-white"
                style={{ writingMode: 'vertical-rl' }}
                title="Treatment"
              >
                🗓️ Treatment
              </Link>
              <Link
                to="/sales"
                className="btn btn-sm shadow-lg hover:shadow-xl py-10 px-2 min-h-[230px] w-10 bg-amber-500 hover:bg-amber-400 border-amber-500 text-white"
                style={{ writingMode: 'vertical-rl' }}
                title="Direct Sales"
              >
                🧾 Direct Sales
              </Link>
            </div>
          ) : null}

          {!onLoginPage && auth?.user && !isCashier && isSidebarOpen ? (
            <>
              <button
                type="button"
                className="fixed inset-0 z-40 bg-black/30 lg:hidden"
                onClick={() => setIsSidebarOpen(false)}
                aria-label="Close sidebar"
              />
              <aside className="fixed left-0 top-0 z-50 flex h-full w-64 flex-col border-r border-slate-800 bg-[#0d1b3e] text-slate-100 shadow-2xl lg:hidden">
                <div className="flex items-center justify-between border-b border-slate-800 px-4 py-4">
                  <p className="text-sm font-semibold tracking-wide">{settings?.name}</p>
                  <button
                    type="button"
                    className="btn btn-xs btn-outline"
                    onClick={() => setIsSidebarOpen(false)}
                  >
                    ✕
                  </button>
                </div>
                <Sidebar onNavClick={() => setIsSidebarOpen(false)} mobile />
              </aside>
            </>
          ) : null}

          {!onLoginPage && auth?.user && isCashier && isCashierMenuOpen ? (
            <>
              <button
                type="button"
                className="fixed inset-0 z-40 bg-black/30"
                onClick={() => setIsCashierMenuOpen(false)}
                aria-label="Close menu"
              />
              <aside className="fixed left-0 top-0 z-50 flex h-full w-72 flex-col border-r border-slate-800 bg-[#0d1b3e] text-slate-100 shadow-2xl">
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
                              isActive ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
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

        </main>
      </div>
    </div>
  );
};

export default Layout;
