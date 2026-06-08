import { useState } from 'react';
import useEntityApi from '../hooks/useEntityApi.js';

// ── Menu config — add new sections/items here ─────────────────────────────────
const MENU = [
  {
    section: 'Charges',
    items: [
      { id: 'doctor',     label: 'Doctor Charges',     icon: '🩺' },
      { id: 'surgery',    label: 'Surgery Charges',     icon: '🔪' },
      { id: 'disposable', label: 'Disposable Charges',  icon: '🧤' },
      { id: 'discount',   label: 'Discounts',           icon: '🏷️' },
    ],
  },
];

// ── Reusable preset table + form ───────────────────────────────────────────────
const PresetPanel = ({ title, valueLabel = 'Value (LKR)', items, loading, error, onSave, onDelete }) => {
  const empty = { name: '', label: '', value: '', active: true };
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(empty);

  const startEdit = (item) => {
    setEditingId(item.id);
    setForm({ name: item.name || '', label: item.label || '', value: String(item.value ?? ''), active: Boolean(item.active) });
  };
  const startNew = () => { setEditingId(null); setForm(empty); };

  const handleSave = async () => {
    const payload = {
      name: form.name || undefined,
      label: form.label || undefined,
      value: Number.parseFloat(form.value) || 0,
      active: Boolean(form.active),
    };
    const ok = await onSave(editingId, payload);
    if (ok) { setForm(empty); setEditingId(null); }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">{title}</h2>
          <p className="text-xs text-slate-400 mt-0.5">Manage presets available on the treatment form.</p>
        </div>
        <button className="btn btn-sm btn-primary rounded-xl px-4" onClick={startNew}>+ New preset</button>
      </div>

      {error && <div className="alert alert-error text-sm">{error}</div>}

      {loading ? (
        <div className="space-y-2 animate-pulse">
          {[...Array(3)].map((_, i) => <div key={i} className="h-10 rounded-xl bg-slate-100" />)}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 py-10 text-center text-sm text-slate-400">
          No presets yet. Click <span className="font-semibold">+ New preset</span> to add one.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200">
          <table className="table w-full text-sm">
            <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-400">
              <tr>
                <th className="px-4 py-3">Label</th>
                <th className="px-4 py-3">{valueLabel}</th>
                <th className="px-4 py-3">Internal name</th>
                <th className="px-4 py-3">Active</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2.5 font-medium text-slate-800">{p.label}</td>
                  <td className="px-4 py-2.5 text-slate-600">
                    {Number.isFinite(Number(p.value)) ? Number(p.value).toFixed(2) : '—'}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-slate-400">{p.name || '—'}</td>
                  <td className="px-4 py-2.5">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${p.active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                      {p.active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="inline-flex gap-1">
                      <button className="btn btn-xs btn-ghost rounded-lg" onClick={() => startEdit(p)}>Edit</button>
                      <button className="btn btn-xs btn-ghost rounded-lg text-rose-500 hover:bg-rose-50" onClick={() => onDelete(p.id)}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Inline form */}
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-700">{editingId ? 'Edit preset' : 'New preset'}</h3>
          {editingId && (
            <button className="btn btn-xs btn-ghost rounded-lg" onClick={startNew}>Clear</button>
          )}
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Label (visible)</span>
            <input className="input input-bordered input-sm" value={form.label} onChange={(e) => setForm((s) => ({ ...s, label: e.target.value }))} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{valueLabel}</span>
            <input type="number" step="0.01" min="0" className="input input-bordered input-sm" value={form.value} onChange={(e) => setForm((s) => ({ ...s, value: e.target.value }))} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Internal name</span>
            <input className="input input-bordered input-sm" value={form.name} onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))} placeholder="optional" />
          </label>
        </div>
        <div className="mt-3 flex items-center gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" className="checkbox checkbox-sm" checked={Boolean(form.active)} onChange={(e) => setForm((s) => ({ ...s, active: e.target.checked }))} />
            <span className="text-sm text-slate-600">Active</span>
          </label>
          <div className="ml-auto flex gap-2">
            <button className="btn btn-sm btn-ghost rounded-xl" onClick={startNew}>Cancel</button>
            <button className="btn btn-sm btn-primary rounded-xl px-5" onClick={handleSave}>
              {editingId ? 'Update' : 'Create'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ── Main page ─────────────────────────────────────────────────────────────────
const SettingsPage = () => {
  const [activeId, setActiveId] = useState('doctor');

  const doctorApi    = useEntityApi('doctor-charge-presets');
  const surgeryApi   = useEntityApi('surgery-charge-presets');
  const disposableApi = useEntityApi('disposabal-charge-presets');
  const discountApi  = useEntityApi('discounts');

  const makeHandlers = (api) => ({
    onSave: async (editingId, payload) => {
      const res = editingId ? await api.updateItem(editingId, payload) : await api.createItem(payload);
      if (res.success) api.refresh?.();
      return res.success;
    },
    onDelete: async (id) => {
      if (!window.confirm('Delete this preset?')) return;
      const res = await api.deleteItem(id);
      if (res.success) api.refresh?.();
    },
  });

  const panels = {
    doctor: (
      <PresetPanel
        title="Doctor Charges"
        valueLabel="Value (LKR)"
        items={doctorApi.items}
        loading={doctorApi.loading}
        error={doctorApi.error}
        {...makeHandlers(doctorApi)}
      />
    ),
    surgery: (
      <PresetPanel
        title="Surgery Charges"
        valueLabel="Value (LKR)"
        items={surgeryApi.items}
        loading={surgeryApi.loading}
        error={surgeryApi.error}
        {...makeHandlers(surgeryApi)}
      />
    ),
    disposable: (
      <PresetPanel
        title="Disposable Charges"
        valueLabel="Value (LKR)"
        items={disposableApi.items}
        loading={disposableApi.loading}
        error={disposableApi.error}
        {...makeHandlers(disposableApi)}
      />
    ),
    discount: (
      <PresetPanel
        title="Discounts"
        valueLabel="Value (%)"
        items={discountApi.items}
        loading={discountApi.loading}
        error={discountApi.error}
        {...makeHandlers(discountApi)}
      />
    ),
  };

  return (
    <section className="flex gap-0 rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden min-h-[600px]">
      {/* ── Left menu panel ── */}
      <aside className="w-52 shrink-0 border-r border-slate-200 bg-slate-50">
        <div className="border-b border-slate-200 px-4 py-4">
          <h1 className="text-sm font-bold text-slate-800">Master Data</h1>
          <p className="text-[10px] text-slate-400 mt-0.5">Clinic configuration</p>
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

      {/* ── Right content panel ── */}
      <main className="flex-1 overflow-y-auto p-6">
        {panels[activeId] ?? (
          <p className="text-sm text-slate-400">Select a section from the left menu.</p>
        )}
      </main>
    </section>
  );
};

export default SettingsPage;
