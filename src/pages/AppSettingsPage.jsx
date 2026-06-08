import { useState } from 'react';
import { AlertTriangle, CheckCircle2, Database, Download, HardDrive, Upload } from 'lucide-react';

const isElectron = Boolean(window.electronAPI?.isElectron);

// ── Menu config — add new sections/items here ─────────────────────────────────
const MENU = [
  {
    section: 'Database',
    items: [
      { id: 'export', label: 'Export DB',    icon: '💾' },
      { id: 'import', label: 'Import DB',    icon: '📂' },
      { id: 'db-info', label: 'DB Info',     icon: '🗄️' },
    ],
  },
];

// ── Status banner ─────────────────────────────────────────────────────────────
const StatusBanner = ({ status }) => {
  if (!status) return null;
  return (
    <div className={`flex items-start gap-2 rounded-xl border px-4 py-3 text-sm ${
      status.ok
        ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
        : 'border-rose-200 bg-rose-50 text-rose-700'
    }`}>
      {status.ok
        ? <CheckCircle2 size={15} className="mt-0.5 shrink-0" />
        : <AlertTriangle size={15} className="mt-0.5 shrink-0" />}
      <span>{status.message}</span>
    </div>
  );
};

// ── Panel: Export ─────────────────────────────────────────────────────────────
const ExportPanel = () => {
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);

  const handle = async () => {
    setBusy(true);
    setStatus(null);
    try {
      const result = await window.electronAPI.exportDb();
      if (!result.canceled) {
        setStatus(result.success
          ? { ok: true,  message: `Saved to: ${result.path}` }
          : { ok: false, message: result.error || 'Export failed.' });
      }
    } catch (err) {
      setStatus({ ok: false, message: err.message || 'Unexpected error.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-slate-800">Export Database</h2>
        <p className="text-xs text-slate-400 mt-0.5">Save a copy of the current database as a backup.</p>
      </div>
      {!isElectron && (
        <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          <AlertTriangle size={15} className="shrink-0" /> Only available in the desktop app.
        </div>
      )}
      <p className="text-sm text-slate-600">
        Exports <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">localhost.sqlite</code> to a location you choose.
        Run backups regularly to prevent data loss.
      </p>
      <button
        type="button"
        className="inline-flex items-center gap-2 btn btn-primary btn-sm rounded-xl px-5"
        onClick={handle}
        disabled={busy || !isElectron}
      >
        <Download size={15} />
        {busy ? 'Exporting…' : 'Export database'}
      </button>
      <StatusBanner status={status} />
    </div>
  );
};

// ── Panel: Import ─────────────────────────────────────────────────────────────
const ImportPanel = () => {
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);

  const handle = async () => {
    setBusy(true);
    setStatus(null);
    setConfirm(false);
    try {
      const result = await window.electronAPI.importDb();
      if (!result.canceled) {
        setStatus(result.success
          ? { ok: true,  message: 'Database imported. Restart the app for changes to take effect.' }
          : { ok: false, message: result.error || 'Import failed.' });
      }
    } catch (err) {
      setStatus({ ok: false, message: err.message || 'Unexpected error.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-slate-800">Import Database</h2>
        <p className="text-xs text-slate-400 mt-0.5">Replace the current database with a backup file.</p>
      </div>
      {!isElectron && (
        <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          <AlertTriangle size={15} className="shrink-0" /> Only available in the desktop app.
        </div>
      )}
      <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
        <AlertTriangle size={15} className="mt-0.5 shrink-0" />
        <span>
          This <strong>replaces all current data</strong>. A backup is created automatically before importing.
          The app must be restarted after.
        </span>
      </div>
      <p className="text-sm text-slate-600">
        Select a <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">.sqlite</code> file previously exported from this app.
      </p>
      {!confirm ? (
        <button
          type="button"
          className="inline-flex items-center gap-2 btn btn-warning btn-sm rounded-xl px-5"
          onClick={() => setConfirm(true)}
          disabled={!isElectron}
        >
          <Upload size={15} /> Import database…
        </button>
      ) : (
        <div className="flex flex-col gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4">
          <p className="text-sm font-semibold text-rose-800">Are you sure? This cannot be undone.</p>
          <div className="flex gap-2">
            <button
              type="button"
              className="inline-flex items-center gap-2 btn btn-error btn-sm rounded-xl px-5"
              onClick={handle}
              disabled={busy}
            >
              <Upload size={15} /> {busy ? 'Importing…' : 'Yes, import now'}
            </button>
            <button type="button" className="btn btn-ghost btn-sm rounded-xl" onClick={() => setConfirm(false)} disabled={busy}>
              Cancel
            </button>
          </div>
        </div>
      )}
      <StatusBanner status={status} />
    </div>
  );
};

// ── Panel: DB Info ────────────────────────────────────────────────────────────
const DbInfoPanel = () => (
  <div className="space-y-5">
    <div>
      <h2 className="text-lg font-semibold text-slate-800">Database Info</h2>
      <p className="text-xs text-slate-400 mt-0.5">Details about the active database.</p>
    </div>
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 space-y-3 text-sm text-slate-600">
      {[
        { label: 'Engine', value: 'SQLite' },
        { label: 'File', value: <code className="rounded bg-slate-100 px-2 py-0.5 text-xs">database/localhost.sqlite</code> },
        { label: 'Mode', value: isElectron ? 'Desktop (Electron)' : 'Browser / Dev' },
      ].map(({ label, value }) => (
        <div key={label} className="flex items-center gap-3">
          <span className="w-24 shrink-0 text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</span>
          <span>{value}</span>
        </div>
      ))}
    </div>
  </div>
);

// ── Main page ─────────────────────────────────────────────────────────────────
const PANELS = {
  'export':  <ExportPanel />,
  'import':  <ImportPanel />,
  'db-info': <DbInfoPanel />,
};

const AppSettingsPage = () => {
  const [activeId, setActiveId] = useState('export');

  return (
    <section className="flex gap-0 rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden min-h-[600px]">
      {/* ── Left menu ── */}
      <aside className="w-52 shrink-0 border-r border-slate-200 bg-slate-50">
        <div className="border-b border-slate-200 px-4 py-4">
          <h1 className="text-sm font-bold text-slate-800">Settings</h1>
          <p className="text-[10px] text-slate-400 mt-0.5">System configuration</p>
        </div>
        <nav className="py-2">
          {MENU.map((group) => (
            <div key={group.section}>
              <p className="px-4 pt-3 pb-1 text-[9px] font-bold uppercase tracking-[0.18em] text-slate-400">
                {group.section}
              </p>
              {group.items.map((item) => {
                const active = activeId === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActiveId(item.id)}
                    className={`flex w-full items-center gap-2.5 px-4 py-2 text-left text-xs font-medium transition-colors ${
                      active
                        ? 'border-r-2 border-blue-600 bg-blue-50 text-blue-700'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-800'
                    }`}
                  >
                    <span className="text-sm leading-none">{item.icon}</span>
                    {item.label}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>
      </aside>

      {/* ── Right content ── */}
      <main className="flex-1 overflow-y-auto p-6">
        {PANELS[activeId] ?? (
          <p className="text-sm text-slate-400">Select a section from the left menu.</p>
        )}
      </main>
    </section>
  );
};

export default AppSettingsPage;
