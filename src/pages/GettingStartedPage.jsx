import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Circle } from 'lucide-react';

const STORAGE_KEY = 'vetfinal_getting_started_checks';

// ── Checklist data ────────────────────────────────────────────────────────────
const CHECKLIST = [
  {
    group: '1 — Clinic Information',
    items: [
      { id: 'clinic-name',    label: 'Enter clinic name and contact details',   hint: 'Master Data → Clinic Settings' },
      { id: 'clinic-logo',    label: 'Upload your clinic logo',                 hint: 'Appears on invoices and receipts' },
      { id: 'printer-setup',  label: 'Configure receipt and barcode printers',  hint: 'Settings → Printer Config' },
    ],
  },
  {
    group: '2 — Staff & Accounts',
    items: [
      { id: 'add-vets',       label: 'Add veterinarian profiles',               hint: 'Veterinarians page' },
      { id: 'add-employees',  label: 'Add employee accounts',                   hint: 'Employees page' },
    ],
  },
  {
    group: '3 — Charge Presets',
    items: [
      { id: 'doctor-charges',     label: 'Set doctor consultation charge presets',  hint: 'Master Data → Doctor Charges' },
      { id: 'surgery-charges',    label: 'Set surgery charge presets',              hint: 'Master Data → Surgery Charges' },
      { id: 'disposable-charges', label: 'Set disposable charge presets',           hint: 'Master Data → Disposable Charges' },
      { id: 'discounts',          label: 'Configure discount presets',              hint: 'Master Data → Discounts' },
    ],
  },
  {
    group: '4 — Stock & Suppliers',
    items: [
      { id: 'add-suppliers',  label: 'Add your medicine suppliers',             hint: 'Suppliers page' },
      { id: 'add-medicines',  label: 'Add medicines with brands and pricing',   hint: 'Medicines page' },
      { id: 'add-batches',    label: 'Record initial stock batches with expiry', hint: 'Edit each medicine → Brands → Add batch' },
    ],
  },
  {
    group: '5 — Patient Registry',
    items: [
      { id: 'add-owners',     label: 'Register first owner accounts',           hint: 'Manage Owners' },
      { id: 'add-patients',   label: 'Add initial patient records',             hint: 'Manage Patients' },
    ],
  },
  {
    group: '6 — Test Run',
    items: [
      { id: 'test-appointment', label: 'Create and complete a test appointment',  hint: 'Treatment page' },
      { id: 'test-billing',     label: 'Test billing and receipt printing',       hint: 'Verify charges and print flow' },
      { id: 'test-sale',        label: 'Run a test direct sale',                  hint: 'Direct Sale page' },
      { id: 'test-day-end',     label: 'Verify day-end close process',            hint: 'Day-End Close page' },
    ],
  },
];

const ALL_IDS = CHECKLIST.flatMap((g) => g.items.map((i) => i.id));

// ── Guide sections (non-checklist content) ────────────────────────────────────
const CLINIC_SETUP_CONTENT = (
  <div className="space-y-5 text-sm text-slate-600">
    <p>Before going live, make sure the following areas are configured:</p>
    {[
      { title: 'Clinic Details', desc: 'Name, address, phone number and logo appear on all printed invoices and receipts. Keep them accurate.', link: '/settings', linkLabel: 'Open Master Data' },
      { title: 'Printer Setup', desc: 'Configure your POS thermal receipt printer and barcode label printer. The app supports silent printing via Electron.', link: '/app-settings', linkLabel: 'Open Settings' },
      { title: 'Charge Presets', desc: 'Create shortcuts for commonly used doctor, surgery and disposable charges so staff can bill quickly during appointments.', link: '/settings', linkLabel: 'Open Master Data' },
      { title: 'Supplier List', desc: 'Add your medicine and product suppliers before recording stock batches — each batch can be linked to its supplier for traceability.', link: '/suppliers', linkLabel: 'Go to Suppliers' },
    ].map(({ title, desc, link, linkLabel }) => (
      <div key={title} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <p className="font-semibold text-slate-800 mb-1">{title}</p>
        <p className="text-xs text-slate-500 mb-3">{desc}</p>
        <Link to={link} className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800">
          {linkLabel} →
        </Link>
      </div>
    ))}
  </div>
);

const DAILY_WORKFLOW_CONTENT = (
  <div className="space-y-5 text-sm text-slate-600">
    <p>A typical day in VetFinal follows this flow:</p>
    {[
      { step: '1', title: 'Open Appointments', desc: 'Go to Treatment → create or open today\'s appointments. Enter patient, reason, charges, and dispensed medicines.' },
      { step: '2', title: 'Direct Sales', desc: 'Use Direct Sale for walk-in medicine purchases without a full appointment. Print a receipt immediately.' },
      { step: '3', title: 'Monitor Stock', desc: 'Check the Low Stock Alerts page and Medicines page for batches nearing expiry. Reorder via Purchase Orders.' },
      { step: '4', title: 'Day-End Close', desc: 'At the end of the day run the Day-End Close to get a summary of cash, card, and credit transactions for reconciliation.' },
      { step: '5', title: 'Reports', desc: 'Use the Reports & Summary page to review revenue, appointment volume, and outstanding credit balances.' },
    ].map(({ step, title, desc }) => (
      <div key={step} className="flex gap-4">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-700">{step}</div>
        <div>
          <p className="font-semibold text-slate-800">{title}</p>
          <p className="text-xs text-slate-500 mt-0.5">{desc}</p>
        </div>
      </div>
    ))}
  </div>
);

const FEATURES_CONTENT = (
  <div className="space-y-4 text-sm text-slate-600">
    {[
      { icon: '🗓️', title: 'Treatment / Appointments', desc: 'Full appointment management — patient, owner, vet, reason, medicines dispensed, charges, billing and receipt printing.' },
      { icon: '🧾', title: 'Direct Sales (POS)', desc: 'Quick medicine sales without an appointment. Supports barcode scanning, discounts, and thermal receipt printing.' },
      { icon: '💊', title: 'Medicines & Stock', desc: 'Track brands, batch numbers, expiry dates, stock levels, and supplier linkage. Low-stock and expiry alerts on the dashboard.' },
      { icon: '🏭', title: 'Procurement', desc: 'Raise purchase orders, record goods receipts, manage supplier invoices and credit notes.' },
      { icon: '👥', title: 'Patients & Owners', desc: 'Full patient registry with owner linkage, species, breed, weight, age and clinical history.' },
      { icon: '📊', title: 'Reports & Analytics', desc: 'Revenue summary, appointment counts, sales heatmap, day-end close, and income/expense tracking.' },
      { icon: '✉️', title: 'SMS Logs', desc: 'View all outgoing SMS messages sent from the system (appointment reminders, etc.).' },
      { icon: '🗂️', title: 'Master Data', desc: 'Charge presets, discount presets — configure once, reuse everywhere across the system.' },
    ].map(({ icon, title, desc }) => (
      <div key={title} className="flex gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
        <span className="text-xl leading-none mt-0.5">{icon}</span>
        <div>
          <p className="font-semibold text-slate-800 text-sm">{title}</p>
          <p className="text-xs text-slate-500 mt-0.5">{desc}</p>
        </div>
      </div>
    ))}
  </div>
);

const TIPS_CONTENT = (
  <div className="space-y-4 text-sm text-slate-600">
    {[
      { color: 'amber', icon: '⚠️', title: 'Back up your database regularly', desc: 'Use Settings → Export DB to save a copy of your data. Store it on a USB drive or cloud folder. Do this daily once you go live.' },
      { color: 'rose',  icon: '🔴', title: 'Never delete stock batches carelessly', desc: 'Removing a batch removes its stock quantity. If a batch was already used in billing, deleting it will cause stock discrepancies.' },
      { color: 'blue',  icon: '💡', title: 'Use charge presets to speed up billing', desc: 'Set up presets in Master Data for your most common fees. They appear as one-click buttons on the treatment form.' },
      { color: 'emerald', icon: '✅', title: 'Run day-end close every day', desc: 'The day-end summary gives you a cash reconciliation report. Running it daily keeps your financial records accurate.' },
    ].map(({ color, icon, title, desc }) => {
      const bg = { amber: 'bg-amber-50 border-amber-200', rose: 'bg-rose-50 border-rose-200', blue: 'bg-blue-50 border-blue-200', emerald: 'bg-emerald-50 border-emerald-200' }[color];
      const text = { amber: 'text-amber-800', rose: 'text-rose-800', blue: 'text-blue-800', emerald: 'text-emerald-800' }[color];
      return (
        <div key={title} className={`rounded-xl border p-4 ${bg}`}>
          <p className={`font-semibold text-sm flex items-center gap-2 ${text}`}><span>{icon}</span>{title}</p>
          <p className={`text-xs mt-1 ${text} opacity-80`}>{desc}</p>
        </div>
      );
    })}
  </div>
);

// ── Menu config ───────────────────────────────────────────────────────────────
const MENU = [
  {
    section: 'Guide Sections',
    items: [
      { id: 'checklist',  label: 'Go-Live Checklist', icon: '✅', badge: true },
      { id: 'clinic',     label: 'Clinic Setup',       icon: '🏥' },
      { id: 'workflow',   label: 'Daily Workflow',      icon: '📅' },
      { id: 'features',   label: 'Features Overview',   icon: '🔍' },
      { id: 'tips',       label: 'Important Tips',      icon: '⚠️' },
    ],
  },
];

// ── Checklist panel ───────────────────────────────────────────────────────────
const ChecklistPanel = ({ checked, onToggle, onReset }) => {
  const total = ALL_IDS.length;
  const done  = ALL_IDS.filter((id) => checked[id]).length;
  const pct   = total ? Math.round((done / total) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-800">Go-Live Checklist</h2>
          <p className="text-xs text-slate-400 mt-0.5">Tick off each item before you start using the system for real transactions.</p>
        </div>
        <button type="button" className="text-xs text-slate-400 hover:text-slate-600 underline" onClick={onReset}>
          Reset all
        </button>
      </div>

      {/* Progress */}
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-slate-600">Setup Progress</span>
          <span className={`text-sm font-bold ${pct === 100 ? 'text-emerald-600' : 'text-amber-600'}`}>{pct}%</span>
        </div>
        <div className="h-2.5 w-full rounded-full bg-slate-200 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${pct === 100 ? 'bg-emerald-500' : 'bg-amber-500'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="mt-2 text-[11px] text-slate-400">{done} of {total} items completed</p>
      </div>

      {/* Groups */}
      {CHECKLIST.map((group) => (
        <div key={group.group} className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <div className="border-b border-slate-100 bg-slate-50 px-5 py-3">
            <h3 className="text-sm font-semibold text-slate-700">{group.group}</h3>
          </div>
          <ul className="divide-y divide-slate-100">
            {group.items.map((item) => {
              const done = Boolean(checked[item.id]);
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    className="flex w-full items-start gap-3 px-5 py-3.5 text-left hover:bg-slate-50 transition-colors"
                    onClick={() => onToggle(item.id)}
                  >
                    <span className={`mt-0.5 shrink-0 ${done ? 'text-emerald-500' : 'text-slate-300'}`}>
                      {done ? <CheckCircle2 size={18} /> : <Circle size={18} />}
                    </span>
                    <span className="flex-1">
                      <span className={`text-sm font-medium ${done ? 'line-through text-slate-400' : 'text-slate-800'}`}>
                        {item.label}
                      </span>
                      {item.hint && (
                        <span className="block text-[11px] text-slate-400 mt-0.5">{item.hint}</span>
                      )}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
};

// ── Static panels ─────────────────────────────────────────────────────────────
const STATIC_PANELS = {
  clinic:   { title: 'Clinic Setup',      subtitle: 'Configure your clinic before going live.', content: CLINIC_SETUP_CONTENT },
  workflow: { title: 'Daily Workflow',     subtitle: 'How a typical day runs in VetFinal.',       content: DAILY_WORKFLOW_CONTENT },
  features: { title: 'Features Overview', subtitle: 'What the system can do for your clinic.',   content: FEATURES_CONTENT },
  tips:     { title: 'Important Tips',    subtitle: 'Avoid common mistakes from day one.',        content: TIPS_CONTENT },
};

// ── Main page ─────────────────────────────────────────────────────────────────
const GettingStartedPage = () => {
  const [activeId, setActiveId] = useState('checklist');
  const [checked, setChecked] = useState(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); }
    catch { return {}; }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(checked));
  }, [checked]);

  const toggle = useCallback((id) => {
    setChecked((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const reset = useCallback(() => {
    if (window.confirm('Reset all checklist items?')) setChecked({});
  }, []);

  const done  = ALL_IDS.filter((id) => checked[id]).length;
  const total = ALL_IDS.length;

  const staticPanel = STATIC_PANELS[activeId];

  return (
    <section className="flex gap-0 rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden min-h-[700px]">
      {/* ── Left menu ── */}
      <aside className="w-56 shrink-0 border-r border-slate-200 bg-slate-50">
        <div className="border-b border-slate-200 px-4 py-4">
          <h1 className="text-sm font-bold text-slate-800">Getting Started</h1>
          <p className="text-[10px] text-slate-400 mt-0.5">VetFinal setup guide</p>
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
                    className={`flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-xs font-medium transition-colors ${
                      active
                        ? 'border-r-2 border-blue-600 bg-blue-50 text-blue-700'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-800'
                    }`}
                  >
                    <span className="text-sm leading-none">{item.icon}</span>
                    <span className="flex-1">{item.label}</span>
                    {item.badge && (
                      <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                        done === total ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                      }`}>
                        {done}/{total}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>
      </aside>

      {/* ── Right content ── */}
      <main className="flex-1 overflow-y-auto p-6">
        {activeId === 'checklist' ? (
          <ChecklistPanel checked={checked} onToggle={toggle} onReset={reset} />
        ) : staticPanel ? (
          <div className="space-y-5">
            <div>
              <h2 className="text-lg font-bold text-slate-800">{staticPanel.title}</h2>
              <p className="text-xs text-slate-400 mt-0.5">{staticPanel.subtitle}</p>
            </div>
            {staticPanel.content}
          </div>
        ) : (
          <p className="text-sm text-slate-400">Select a section from the left menu.</p>
        )}
      </main>
    </section>
  );
};

export default GettingStartedPage;
