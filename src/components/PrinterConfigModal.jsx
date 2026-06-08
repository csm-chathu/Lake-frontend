import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Printer, X } from 'lucide-react';

const PrinterConfigModal = () => {
  const [open, setOpen] = useState(false);
  const [printers, setPrinters] = useState([]);
  const [config, setConfig] = useState({ pos: {}, barcode: {} });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!window.electron) return;

    const handler = async () => {
      const [printerList, currentConfig] = await Promise.all([
        window.electronAPI.listPrinters().catch(() => []),
        window.electronAPI.getPrinterConfig().catch(() => ({ pos: {}, barcode: {} })),
      ]);
      setPrinters(printerList);
      setConfig(currentConfig);
      setSaved(false);
      setOpen(true);
    };

    window.electron.on('printer-config:open', handler);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const handleSave = async () => {
    setSaving(true);
    await window.electronAPI.savePrinterConfig(config);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setOpen(false), 800);
  };

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[10000] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
      <div className="relative z-10 w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div className="flex items-center gap-2">
            <Printer size={18} className="text-slate-500" />
            <h2 className="text-base font-semibold text-slate-800">Printer configuration</h2>
          </div>
          <button className="btn btn-xs btn-ghost btn-circle" onClick={() => setOpen(false)}>
            <X size={14} />
          </button>
        </div>

        <div className="space-y-4 p-5">
          {printers.length === 0 && (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
              No printers detected on this machine.
            </p>
          )}

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">POS receipt printer</label>
            <select
              className="select select-bordered w-full"
              value={config.pos?.name || ''}
              onChange={(e) => setConfig((c) => ({ ...c, pos: { ...c.pos, name: e.target.value } }))}
            >
              <option value="">— select printer —</option>
              {printers.map((p) => (
                <option key={p.name} value={p.name}>
                  {p.name}{p.isDefault ? ' (default)' : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Barcode label printer</label>
            <select
              className="select select-bordered w-full"
              value={config.barcode?.name || ''}
              onChange={(e) => setConfig((c) => ({ ...c, barcode: { ...c.barcode, name: e.target.value } }))}
            >
              <option value="">— select printer —</option>
              {printers.map((p) => (
                <option key={p.name} value={p.name}>
                  {p.name}{p.isDefault ? ' (default)' : ''}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-5 py-4">
          <button className="btn btn-sm btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
          <button className="btn btn-sm btn-primary" onClick={handleSave} disabled={saving}>
            {saved ? 'Saved!' : saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  , document.body);
};

export default PrinterConfigModal;
