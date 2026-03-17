import { useCallback, useState } from 'react';
import useEntityApi from '../hooks/useEntityApi.js';

const SettingsPage = () => {
  const presetsApi = useEntityApi('doctor-charge-presets');
  const { items: presets, loading, error, createItem, updateItem, deleteItem, refresh } = presetsApi;

  const surgeryPresetsApi = useEntityApi('surgery-charge-presets');
  const {
    items: surgeryPresets,
    loading: surgeryLoading,
    error: surgeryError,
    createItem: createSurgeryPreset,
    updateItem: updateSurgeryPreset,
    deleteItem: deleteSurgeryPreset,
    refresh: refreshSurgeryPresets
  } = surgeryPresetsApi;

  const empty = { name: '', label: '', value: '', active: true };
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty);

  const surgeryEmpty = { name: '', label: '', value: '', active: true };
  const [surgeryEditing, setSurgeryEditing] = useState(null);
  const [surgeryForm, setSurgeryForm] = useState(surgeryEmpty);

  const [chargesTab, setChargesTab] = useState('doctor');

  const startCreate = useCallback(() => {
    setEditing(null);
    setForm(empty);
  }, []);

  const startEdit = useCallback((item) => {
    setEditing(item.id);
    setForm({ name: item.name || '', label: item.label || '', value: String(item.value ?? ''), active: Boolean(item.active) });
  }, []);

  const startSurgeryCreate = useCallback(() => {
    setSurgeryEditing(null);
    setSurgeryForm(surgeryEmpty);
  }, []);

  const startSurgeryEdit = useCallback((item) => {
    setSurgeryEditing(item.id);
    setSurgeryForm({ name: item.name || '', label: item.label || '', value: String(item.value ?? ''), active: Boolean(item.active) });
  }, []);

  const handleSave = async () => {
    const payload = {
      name: form.name || undefined,
      label: form.label || undefined,
      value: Number.parseFloat(form.value) || 0,
      active: Boolean(form.active)
    };

    const res = editing ? await updateItem(editing, payload) : await createItem(payload);
    if (res.success) {
      setForm(empty);
      setEditing(null);
      refresh();
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this preset? This cannot be undone.')) return;
    const res = await deleteItem(id);
    if (res.success) refresh();
  };

  const handleSurgerySave = async () => {
    const payload = {
      name: surgeryForm.name || undefined,
      label: surgeryForm.label || undefined,
      value: Number.parseFloat(surgeryForm.value) || 0,
      active: Boolean(surgeryForm.active)
    };

    const res = surgeryEditing
      ? await updateSurgeryPreset(surgeryEditing, payload)
      : await createSurgeryPreset(payload);
    if (res.success) {
      setSurgeryForm(surgeryEmpty);
      setSurgeryEditing(null);
      refreshSurgeryPresets();
    }
  };

  const handleSurgeryDelete = async (id) => {
    if (!window.confirm('Delete this preset? This cannot be undone.')) return;
    const res = await deleteSurgeryPreset(id);
    if (res.success) refreshSurgeryPresets();
  };

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold text-slate-800">Settings</h1>
        <p className="text-sm text-slate-500">Clinic configuration and master data.</p>
      </div>

      <div className="rounded-2xl border border-base-300 bg-base-100 p-5 text-sm text-slate-600 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-medium text-slate-800">Charges presets</h2>
            <p className="text-xs text-slate-500">Manage shortcuts for doctor and surgery fees used on appointments.</p>
          </div>
          <div className="tabs tabs-boxed bg-base-200" role="tablist" aria-label="Charge preset types">
            <a
              href="#doctor"
              role="tab"
              className={`tab ${chargesTab === 'doctor' ? 'tab-active' : ''}`}
              onClick={(e) => { e.preventDefault(); setChargesTab('doctor'); }}
            >
              Doctor charge
            </a>
            <a
              href="#surgery"
              role="tab"
              className={`tab ${chargesTab === 'surgery' ? 'tab-active' : ''}`}
              onClick={(e) => { e.preventDefault(); setChargesTab('surgery'); }}
            >
              Surgery charge
            </a>
          </div>
        </div>

        {chargesTab === 'doctor' && (
          <div className="space-y-4">
            {error && <div className="alert alert-error">{error}</div>}
            <div className="overflow-x-auto">
              <table className="table w-full">
                <thead>
                  <tr>
                    <th>Label</th>
                    <th>Value (LKR)</th>
                    <th>Internal name</th>
                    <th>Active</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {(presets || []).map((p) => (
                    <tr key={p.id}>
                      <td className="font-medium">{p.label}</td>
                      <td>{Number.isFinite(Number(p.value)) ? Number(p.value).toFixed(2) : '-'}</td>
                      <td className="text-xs text-slate-500">{p.name || '—'}</td>
                      <td>{p.active ? 'Yes' : 'No'}</td>
                      <td className="text-right">
                        <button className="btn btn-sm btn-outline mr-2" onClick={() => startEdit(p)}>Edit</button>
                        <button className="btn btn-sm btn-error btn-outline" onClick={() => handleDelete(p.id)}>Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="rounded-lg border border-base-200 bg-white p-4">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-medium text-slate-800">{editing ? 'Edit preset' : 'Create preset'}</h3>
                <button className="btn btn-xs btn-outline" onClick={startCreate}>New preset</button>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <label className="label"><span className="label-text">Label (visible)</span></label>
                  <input className="input input-bordered w-full" value={form.label} onChange={(e) => setForm((s) => ({ ...s, label: e.target.value }))} />
                </div>
                <div>
                  <label className="label"><span className="label-text">Value (LKR)</span></label>
                  <input type="number" step="0.01" min="0" className="input input-bordered w-full" value={form.value} onChange={(e) => setForm((s) => ({ ...s, value: e.target.value }))} />
                </div>
                <div>
                  <label className="label"><span className="label-text">Internal name</span></label>
                  <input className="input input-bordered w-full" value={form.name} onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))} placeholder="optional identifier" />
                </div>
              </div>
              <div className="mt-3 flex items-center gap-3">
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={Boolean(form.active)} onChange={(e) => setForm((s) => ({ ...s, active: e.target.checked }))} />
                  <span className="text-sm text-slate-600">Active</span>
                </label>
                <div className="ml-auto flex gap-2">
                  <button className="btn btn-sm btn-ghost" onClick={() => { setForm(empty); setEditing(null); }}>Cancel</button>
                  <button className="btn btn-sm btn-primary" onClick={handleSave}>{editing ? 'Update' : 'Create'}</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {chargesTab === 'surgery' && (
          <div className="space-y-4">
            {surgeryError && <div className="alert alert-error">{surgeryError}</div>}
            <div className="overflow-x-auto">
              <table className="table w-full">
                <thead>
                  <tr>
                    <th>Label</th>
                    <th>Value (LKR)</th>
                    <th>Internal name</th>
                    <th>Active</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {(surgeryPresets || []).map((p) => (
                    <tr key={p.id}>
                      <td className="font-medium">{p.label}</td>
                      <td>{Number.isFinite(Number(p.value)) ? Number(p.value).toFixed(2) : '-'}</td>
                      <td className="text-xs text-slate-500">{p.name || '—'}</td>
                      <td>{p.active ? 'Yes' : 'No'}</td>
                      <td className="text-right">
                        <button className="btn btn-sm btn-outline mr-2" onClick={() => startSurgeryEdit(p)}>Edit</button>
                        <button className="btn btn-sm btn-error btn-outline" onClick={() => handleSurgeryDelete(p.id)}>Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="rounded-lg border border-base-200 bg-white p-4">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-medium text-slate-800">{surgeryEditing ? 'Edit preset' : 'Create preset'}</h3>
                <button className="btn btn-xs btn-outline" onClick={startSurgeryCreate}>New preset</button>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <label className="label"><span className="label-text">Label (visible)</span></label>
                  <input className="input input-bordered w-full" value={surgeryForm.label} onChange={(e) => setSurgeryForm((s) => ({ ...s, label: e.target.value }))} />
                </div>
                <div>
                  <label className="label"><span className="label-text">Value (LKR)</span></label>
                  <input type="number" step="0.01" min="0" className="input input-bordered w-full" value={surgeryForm.value} onChange={(e) => setSurgeryForm((s) => ({ ...s, value: e.target.value }))} />
                </div>
                <div>
                  <label className="label"><span className="label-text">Internal name</span></label>
                  <input className="input input-bordered w-full" value={surgeryForm.name} onChange={(e) => setSurgeryForm((s) => ({ ...s, name: e.target.value }))} placeholder="optional identifier" />
                </div>
              </div>
              <div className="mt-3 flex items-center gap-3">
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={Boolean(surgeryForm.active)} onChange={(e) => setSurgeryForm((s) => ({ ...s, active: e.target.checked }))} />
                  <span className="text-sm text-slate-600">Active</span>
                </label>
                <div className="ml-auto flex gap-2">
                  <button className="btn btn-sm btn-ghost" onClick={() => { setSurgeryForm(surgeryEmpty); setSurgeryEditing(null); }}>Cancel</button>
                  <button className="btn btn-sm btn-primary" onClick={handleSurgerySave}>{surgeryEditing ? 'Update' : 'Create'}</button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

export default SettingsPage;
