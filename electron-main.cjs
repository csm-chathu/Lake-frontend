const { app, BrowserWindow, dialog, ipcMain, nativeImage, globalShortcut } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const http = require('http');
const { spawn } = require('child_process');
const backend = require('./start-backend.cjs');

// Allow Chromium print flows (including window.print) to run without dialog.
app.commandLine.appendSwitch('kiosk-printing');

// ── Windows ───────────────────────────────────────────────────────────────────
let win;
let splashWindow;

// ── Keep-alive ────────────────────────────────────────────────────────────────
let keepAliveTimer = null;
function startKeepAlive() {
  keepAliveTimer = setInterval(() => {
    const req = http.get('http://127.0.0.1:8000/api/clinic-settings', { timeout: 5000 }, () => {});
    req.on('error', () => {});
    req.end();
  }, 60000);
}
function stopKeepAlive() {
  if (keepAliveTimer) { clearInterval(keepAliveTimer); keepAliveTimer = null; }
}

// ── Database path helper ──────────────────────────────────────────────────────
function getDbPath() {
  const devPath = path.join(__dirname, '..', 'backend-laravel');
  const resourcesPath = path.join(process.resourcesPath || '', 'backend-laravel');
  const backendPath = fs.existsSync(path.join(resourcesPath, 'artisan')) ? resourcesPath : devPath;
  return path.join(backendPath, 'database', 'localhost.sqlite');
}

// ── IPC: DB export ────────────────────────────────────────────────────────────
ipcMain.handle('db:export', async () => {
  const dbPath = getDbPath();
  if (!fs.existsSync(dbPath)) return { success: false, error: 'Database file not found at ' + dbPath };
  const today = new Date().toISOString().split('T')[0];
  const { canceled, filePath } = await dialog.showSaveDialog({
    title: 'Export Database',
    defaultPath: `vetfinal-backup-${today}.sqlite`,
    filters: [{ name: 'SQLite Database', extensions: ['sqlite'] }]
  });
  if (canceled || !filePath) return { success: false, canceled: true };
  fs.copyFileSync(dbPath, filePath);
  return { success: true, path: filePath };
});

// ── IPC: DB import ────────────────────────────────────────────────────────────
ipcMain.handle('db:import', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: 'Import Database',
    filters: [{ name: 'SQLite Database', extensions: ['sqlite'] }],
    properties: ['openFile']
  });
  if (canceled || !filePaths[0]) return { success: false, canceled: true };
  const dbPath = getDbPath();
  if (fs.existsSync(dbPath)) {
    const backupPath = dbPath.replace('.sqlite', `.pre-import-${Date.now()}.sqlite`);
    fs.copyFileSync(dbPath, backupPath);
  }
  fs.copyFileSync(filePaths[0], dbPath);
  return { success: true };
});

// ── Printer config cache + defaults ──────────────────────────────────────────
let _configCache  = null;
let _printerCache = null;
let _printerCacheAt = 0;
const PRINTER_CACHE_TTL = 30_000;

const DEFAULT_APP_URL = 'http://127.0.0.1:8000';

const DEFAULT_CONFIG = {
  app:     { url: DEFAULT_APP_URL, name: 'VetFinal', icon: '' },
  barcode: { name: '', width: 30000,  height: 20000  },
  pos:     { name: '', width: 80000,  height: 304800  },
  a5:      { name: '', width: 148000, height: 210000  },
};

function getConfigPath() {
  return path.join(app.getPath('userData'), 'printer-config.json');
}

function readPrinterConfig() {
  if (_configCache) return _configCache;
  const configPath = getConfigPath();
  let config;
  if (fs.existsSync(configPath)) {
    config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } else {
    const legacyPath = path.join(__dirname, 'printer-config.json');
    config = fs.existsSync(legacyPath)
      ? JSON.parse(fs.readFileSync(legacyPath, 'utf8'))
      : DEFAULT_CONFIG;
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  }
  if (!config.app) config.app = { ...DEFAULT_CONFIG.app };
  if (!config.a5)  config.a5  = { ...DEFAULT_CONFIG.a5  };
  // Migrate: fix missing height or the bad 1,200,000 µm value that caused 25% scale.
  const STOCK_MAX = 350000; // 350 mm — safely above any real receipt, below the 1200mm bad value
  if (!config.pos || !config.pos.height || config.pos.height > STOCK_MAX) {
    config.pos = { ...(config.pos || {}), width: DEFAULT_CONFIG.pos.width, height: DEFAULT_CONFIG.pos.height };
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  }
  _configCache = config;
  return config;
}

function applyAppConfig(config) {
  if (!win || win.isDestroyed()) return;
  const { name, icon } = config.app || {};
  if (name) win.setTitle(name);
  if (icon && fs.existsSync(icon)) {
    try { win.setIcon(nativeImage.createFromPath(icon)); } catch (e) { console.warn('[icon]', e.message); }
  }
}

// Fuzzy-match a configured printer name against the live spooler list.
async function resolvePrinterName(wc, configuredName) {
  if (!configuredName) return '';
  if (!_printerCache || Date.now() - _printerCacheAt > PRINTER_CACHE_TTL) {
    _printerCache  = await wc.getPrintersAsync();
    _printerCacheAt = Date.now();
  }
  const names = _printerCache.map((p) => p.name);
  const lower = configuredName.toLowerCase();
  return (
    names.find((n) => n === configuredName) ||
    names.find((n) => n.toLowerCase() === lower) ||
    names.find((n) => n.toLowerCase().includes(lower)) ||
    names.find((n) => lower.includes(n.toLowerCase())) ||
    ''
  );
}

// ── Logging ───────────────────────────────────────────────────────────────────
function logToRenderer(msg) {
  console.log(msg);
  if (win && !win.isDestroyed()) {
    win.webContents.executeJavaScript(`console.log(${JSON.stringify(msg)})`).catch(() => {});
    win.webContents.send('main:log', msg);
  }
}

// ── ESC/POS raw byte builder ──────────────────────────────────────────────────
function buildEscPos(d) {
  const ESC = 0x1B, GS = 0x1D, LF = 0x0A;
  const W = 42;
  const b = [];

  const push   = (...v) => b.push(...v);
  const str    = s => b.push(...Buffer.from(String(s ?? '').replace(/[^ -~]/g, '?'), 'ascii'));
  const nl     = () => push(LF);
  const init   = () => push(ESC, 0x40);
  const align  = n  => push(ESC, 0x61, n);
  const bold   = n  => push(ESC, 0x45, n ? 1 : 0);
  const size   = (w, h) => push(GS, 0x21, ((Math.max(1, w) - 1) << 4) | (Math.max(1, h) - 1));
  const cut    = () => push(GS, 0x56, 0x42, 0x05);
  const pad    = (s, n, right = true) => { s = String(s ?? '').substring(0, n); return right ? s.padEnd(n) : s.padStart(n); };
  const rule   = (c = '-') => c.repeat(W);
  const kv     = (k, v) => { const vs = String(v); return pad(k, W - vs.length - 1) + ' ' + vs; };

  init();

  align(1); bold(1); size(2, 2);
  str(d.clinicName.toUpperCase()); nl();
  bold(0); size(1, 1);
  str(d.address); nl();
  str(`Tel: ${d.phone} / ${d.phone2}`); nl();
  str(d.email); nl();
  str(d.website); nl(); nl();
  bold(1); str(d.doctor); bold(0); nl();
  str(d.doctorQuals); nl();
  str(d.doctorTitle); nl(); nl();
  str('APPOINTMENT RECEIPT'); nl();

  align(0);
  str(rule('=')); nl();
  if (d.referenceLabel) { str(kv('Ref', d.referenceLabel)); nl(); }
  str(kv('Date', d.date)); nl();
  str(kv('Time', d.time)); nl();
  str(kv('Payment', d.paymentType === 'credit' ? 'Credit' : 'Cash')); nl();
  str(kv('Status', d.paymentStatus === 'paid' ? 'PAID' : 'PENDING')); nl();
  str(rule('-')); nl();

  str(kv('Patient', d.patientName || 'Unknown')); nl();
  if (d.ownerName) { str(kv('Owner', d.ownerName)); nl(); }
  if (d.reason)    { str(kv('Reason', d.reason));   nl(); }
  str(rule('-')); nl();

  str(pad('ITEM', 22) + pad('QTY', 4) + pad('PRICE', 8, false) + pad('TOTAL', 8, false)); nl();
  str(rule('-')); nl();
  for (const it of (d.lineItems || [])) {
    str(pad(it.label, 22) + pad(String(it.qty), 4) + pad(it.unitFmt, 8, false) + pad(it.totalFmt, 8, false)); nl();
  }
  str(rule('-')); nl();

  str(kv('Subtotal', d.subtotalFmt)); nl();
  if (Number(d.discount) > 0) { str(kv('Discount', `- ${d.discountFmt}`)); nl(); }
  str(rule('=')); nl();

  bold(1); size(1, 2);
  str(kv('TOTAL', d.totalFmt)); nl();
  size(1, 1); bold(0);
  str(rule('=')); nl();

  str(kv(d.paymentType === 'credit' ? 'Credit' : 'Cash', d.totalFmt)); nl();
  str(kv(d.paymentStatus === 'paid' ? 'Paid' : 'Pending', d.paymentStatus === 'paid' ? d.totalFmt : d.zeroFmt)); nl();

  nl(); align(1);
  str('*** Thank you for visiting ***'); nl();
  str(d.clinicName); nl();
  nl(); nl();
  cut();

  return Buffer.from(b);
}

// ── Send raw ESC/POS bytes to Windows print spooler ───────────────────────────
function sendRawToPrinter(buffer, printerName) {
  return new Promise((resolve) => {
    const tmp = path.join(os.tmpdir(), `escpos_${Date.now()}.bin`);
    fs.writeFileSync(tmp, buffer);

    const esc = s => s.replace(/'/g, "''");
    const ps = `
$b=[System.IO.File]::ReadAllBytes('${esc(tmp)}')
Add-Type -Language CSharp -TypeDefinition @'
using System;using System.Runtime.InteropServices;
public class WS{
  [StructLayout(LayoutKind.Sequential,CharSet=CharSet.Ansi)]
  public class DI{public string pDocName;public string pOutputFile;public string pDataType;}
  [DllImport("winspool.drv",EntryPoint="OpenPrinterA")] public static extern bool OpenPrinter(string n,out IntPtr h,IntPtr p);
  [DllImport("winspool.drv",EntryPoint="ClosePrinter")] public static extern bool ClosePrinter(IntPtr h);
  [DllImport("winspool.drv",EntryPoint="StartDocPrinterA")] public static extern int StartDoc(IntPtr h,int lv,[In,MarshalAs(UnmanagedType.LPStruct)]DI di);
  [DllImport("winspool.drv",EntryPoint="EndDocPrinter")] public static extern bool EndDoc(IntPtr h);
  [DllImport("winspool.drv",EntryPoint="StartPagePrinter")] public static extern bool StartPage(IntPtr h);
  [DllImport("winspool.drv",EntryPoint="EndPagePrinter")] public static extern bool EndPage(IntPtr h);
  [DllImport("winspool.drv",EntryPoint="WritePrinter")] public static extern bool Write(IntPtr h,byte[] buf,int n,out int w);
}
'@
$h=[IntPtr]::Zero
if(-not [WS]::OpenPrinter('${esc(printerName)}',[ref]$h,[IntPtr]::Zero)){Write-Error "OpenPrinter failed for '${esc(printerName)}'";exit 1}
$d=New-Object WS+DI;$d.pDocName='Receipt';$d.pDataType='RAW'
$job=[WS]::StartDoc($h,1,$d)
if($job -le 0){[WS]::ClosePrinter($h)|Out-Null;Write-Error "StartDocPrinter failed";exit 1}
[WS]::StartPage($h)|Out-Null
$w=0;$ok=[WS]::Write($h,$b,$b.Length,[ref]$w)
if(-not $ok){Write-Error "WritePrinter failed (wrote $w of $($b.Length) bytes)";exit 1}
[WS]::EndPage($h)|Out-Null
[WS]::EndDoc($h)|Out-Null
[WS]::ClosePrinter($h)|Out-Null
Remove-Item '${esc(tmp)}' -Force -ErrorAction SilentlyContinue
`;

    const child = spawn('powershell', ['-NonInteractive', '-NoProfile', '-Command', ps], { windowsHide: true });
    let stderr = '';
    child.stderr.on('data', d => { stderr += d.toString(); });
    child.on('close', code => {
      try { fs.unlinkSync(tmp); } catch (_e) {}
      if (code !== 0) {
        logToRenderer(`[escpos] spooler error: ${stderr}`);
        resolve({ success: false, error: stderr || `exit ${code}` });
      } else {
        logToRenderer('[escpos] done');
        resolve({ success: true, error: null });
      }
    });
  });
}

// ── IPC: ESC/POS receipt ──────────────────────────────────────────────────────
ipcMain.handle('printers:print-escpos', async (_ev, data) => {
  const name = data.printerName || readPrinterConfig().pos?.name || '';
  if (!name) return { success: false, error: 'No POS printer configured' };
  logToRenderer(`[escpos] → ${name}`);
  try {
    return await sendRawToPrinter(buildEscPos(data), name);
  } catch (err) {
    logToRenderer(`[escpos] error: ${err.message}`);
    return { success: false, error: err.message };
  }
});

// ── Silent HTML print via off-screen BrowserWindow ───────────────────────────
// Strategy:
//   1. showInactive() off-screen → real HWND so Windows doesn't fall back to dialog.
//   2. Window width = 302 px (80 mm at 96 dpi) → viewport matches paper width → scale 1.0.
//   3. Override @page CSS so the logical page equals the physical paper exactly.
//   4. Read scrollHeight AFTER layout → use as page height → 1 page, no breaks, no blank tail.
async function printHtmlToWindow(html, deviceName, pageSize, opts = {}) {
  const { silent = false, landscape = false, renderDelay = 300 } = opts;

  const popup = new BrowserWindow({
    width: 302,   // 80 mm at 96 dpi reference — matches @page and paper width
    height: 1500,
    show: false,
    webPreferences: { javascript: true, sandbox: false },
  });

  popup.setPosition(-32000, -32000);
  popup.showInactive();
  popup.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));

  return new Promise((resolve) => {
    popup.webContents.once('did-finish-load', async () => {
      // Override any @page { size } in the HTML so the logical page = physical paper.
      // "auto" lets pageSize drive dimensions → no CSS-vs-paper mismatch scale factor.
      try {
        await popup.webContents.insertCSS('@page { size: auto !important; margin: 0 !important; }');
      } catch (e) { /* non-fatal */ }

      // Use actual rendered content height as page height → single page, no page break,
      // no blank tail.  1 CSS px = 25 400/96 µm at the 96 dpi reference.
      let finalPageSize = pageSize;
      if (pageSize && pageSize.width) {
        try {
          const scrollH = await popup.webContents.executeJavaScript(
            'document.documentElement.scrollHeight'
          );
          if (scrollH > 0) {
            finalPageSize = { width: pageSize.width, height: Math.ceil(scrollH * 25400 / 96) };
          }
        } catch (e) {
          logToRenderer(`[print] scrollHeight read failed: ${e.message}`);
        }
      }

      logToRenderer(`[print] → "${deviceName || '(default)'}"  ${finalPageSize?.width}×${finalPageSize?.height} µm`);

      setTimeout(() => {
        try {
          popup.webContents.print({
            silent: false, // test first
            printBackground: true,
            deviceName: deviceName || undefined,
            margins: { marginType: 'none' },
            scaleFactor: 100,
            pageSize: {
              width: 80000,
              height: 304800
            }
          });
        } catch (err) {
          try { popup.destroy(); } catch (e) { /* already destroyed */ }
          logToRenderer(`[print] error: ${err.message}`);
          resolve({ success: false, error: err.message });
        }
      }, renderDelay);
    });
  });
}

// ── IPC: Printers list ────────────────────────────────────────────────────────
ipcMain.handle('printers:list', async () => {
  const focused = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
  if (!focused) return [];
  return focused.webContents.getPrinters();
});

ipcMain.handle('printers:get', async (event) => {
  const wc = (BrowserWindow.fromWebContents(event.sender) || BrowserWindow.getAllWindows()[0])?.webContents;
  if (!wc) return [];
  const printers = await wc.getPrintersAsync();
  return printers.map((p) => ({
    name: p.name,
    displayName: p.displayName || p.name,
    description: p.description || '',
    status: p.status,
    isDefault: p.isDefault,
    options: p.options || {},
  }));
});

// ── IPC: Printer config read/write ────────────────────────────────────────────
ipcMain.handle('printers:get-config', () => readPrinterConfig());

ipcMain.handle('printers:save-config', (_ev, config) => {
  _configCache = config;
  fs.writeFileSync(getConfigPath(), JSON.stringify(config, null, 2));
  applyAppConfig(config);
  return { success: true };
});

// ── IPC: App info ─────────────────────────────────────────────────────────────
ipcMain.handle('app:get-info', () => ({
  appName: app.getName(),
  appVersion: app.getVersion(),
  appUrl: (readPrinterConfig().app || {}).url || DEFAULT_APP_URL,
}));

// ── IPC: Icon picker ──────────────────────────────────────────────────────────
ipcMain.handle('app:select-icon', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(win, {
    title: 'Select App Icon',
    filters: [{ name: 'Images', extensions: ['ico', 'png', 'jpg', 'jpeg'] }],
    properties: ['openFile'],
  });
  return canceled ? null : filePaths[0];
});

// ── IPC: POS receipt (silent HTML print) ──────────────────────────────────────
ipcMain.handle('printers:print-receipt', async (_ev, html, printerNameOrType) => {
  const config = readPrinterConfig();
  const entry  = config[printerNameOrType] || config.pos || {};
  const configuredName = entry.name || (typeof printerNameOrType === 'string' && !config[printerNameOrType] ? printerNameOrType : '') || '';
  // Height is computed dynamically from scrollHeight inside printHtmlToWindow.
  // Only width is needed here to tell the printer the paper width.
  const pageSize = { width: entry.width || 80000, height: entry.height || 304800 };

  const wc = win && !win.isDestroyed() ? win.webContents : null;
  const deviceName = wc ? await resolvePrinterName(wc, configuredName) : configuredName;

  return printHtmlToWindow(html, deviceName, pageSize, { renderDelay: 300 });
});

// ── IPC: POS receipt (legacy alias — also silent) ────────────────────────────
ipcMain.handle('printers:print-receipt-dialog', async (_ev, html) => {
  const config = readPrinterConfig();
  const entry  = config.pos || {};
  const pageSize = { width: entry.width || 80000, height: entry.height || 304800 };
  const wc = win && !win.isDestroyed() ? win.webContents : null;
  const deviceName = wc ? await resolvePrinterName(wc, entry.name || '') : (entry.name || '');
  logToRenderer(`[print] POS receipt (alias) → printer: "${deviceName || '(default)'}"`);
  return printHtmlToWindow(html, deviceName, pageSize, { renderDelay: 300 });
});

// ── IPC: Barcode label ────────────────────────────────────────────────────────
ipcMain.handle('printers:print-barcode', async (_ev, html, printerName) => {
  const config = readPrinterConfig();
  const entry  = config.barcode || {};
  const configuredName = printerName || entry.name || '';
  const pageSize = { width: entry.width || 30000, height: entry.height || 20000 };

  const wc = win && !win.isDestroyed() ? win.webContents : null;
  const deviceName = wc ? await resolvePrinterName(wc, configuredName) : configuredName;
  logToRenderer(`[print] Barcode → printer: "${deviceName || '(default)'}" page: ${pageSize.width}×${pageSize.height}µm`);

  return printHtmlToWindow(html, deviceName, pageSize, { renderDelay: 500, landscape: true });
});

// ── Settings overlay (Ctrl+Shift+P) ──────────────────────────────────────────
function buildOverlayScript(printers, config) {
  const appCfg = config.app || {};

  function sel(key) {
    const current = (config[key] && config[key].name) || '';
    const options = printers.map((p) => {
      const selected = p.name === current ? ' selected' : '';
      return `<option value="${p.name}"${selected}>${p.name}</option>`;
    }).join('');
    return `<select id="ps-${key}" style="width:100%;padding:6px 8px;border:1px solid #ddd;border-radius:6px;font-size:13px;background:#fff"><option value="">— system default —</option>${options}</select>`;
  }

  function field(id, label, value, placeholder) {
    return `
      <label style="display:block;margin-bottom:12px">
        <span style="display:block;font-size:12px;font-weight:500;color:#555;margin-bottom:4px;text-transform:uppercase;letter-spacing:.4px">${label}</span>
        <input id="${id}" type="text" value="${value}" placeholder="${placeholder}"
          style="width:100%;padding:6px 8px;border:1px solid #ddd;border-radius:6px;font-size:13px;box-sizing:border-box">
      </label>`;
  }

  const c = JSON.stringify(config);

  return `
(function() {
  if (document.getElementById('__ps-overlay')) return;

  const backdrop = document.createElement('div');
  backdrop.id = '__ps-overlay';
  backdrop.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:2147483647;display:flex;align-items:center;justify-content:center;font-family:system-ui,sans-serif';

  backdrop.innerHTML = \`
    <div style="background:#fff;border-radius:12px;width:460px;max-width:94vw;max-height:90vh;overflow-y:auto;box-shadow:0 12px 40px rgba(0,0,0,.3)">
      <div style="padding:20px 24px 16px;border-bottom:1px solid #eee;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;background:#fff;z-index:1">
        <span style="font-size:16px;font-weight:600;color:#111">App Settings</span>
        <button id="__ps-close" style="background:none;border:none;font-size:20px;cursor:pointer;color:#888;line-height:1;padding:0 4px">&#x2715;</button>
      </div>
      <div style="padding:20px 24px">
        <div style="font-size:11px;font-weight:600;color:#888;text-transform:uppercase;letter-spacing:.6px;margin-bottom:12px">Application</div>
        ${field('ps-app-name', 'App Name', appCfg.name || '', 'e.g. VetFinal')}
        <label style="display:block;margin-bottom:20px">
          <span style="display:block;font-size:12px;font-weight:500;color:#555;margin-bottom:4px;text-transform:uppercase;letter-spacing:.4px">App Icon</span>
          <div style="display:flex;gap:8px;align-items:center">
            <input id="ps-app-icon" type="text" value="${appCfg.icon || ''}" placeholder="Path to .ico or .png"
              style="flex:1;padding:6px 8px;border:1px solid #ddd;border-radius:6px;font-size:13px">
            <button id="__ps-browse" style="padding:6px 12px;border:1px solid #ddd;border-radius:6px;background:#f5f5f5;cursor:pointer;font-size:13px;white-space:nowrap">Browse…</button>
          </div>
        </label>
        <div style="font-size:11px;font-weight:600;color:#888;text-transform:uppercase;letter-spacing:.6px;margin-bottom:12px">Printers</div>
        <label style="display:block;margin-bottom:12px">
          <span style="display:block;font-size:12px;font-weight:500;color:#555;margin-bottom:4px;text-transform:uppercase;letter-spacing:.4px">Barcode Printer</span>
          ${sel('barcode')}
        </label>
        <label style="display:block;margin-bottom:12px">
          <span style="display:block;font-size:12px;font-weight:500;color:#555;margin-bottom:4px;text-transform:uppercase;letter-spacing:.4px">POS Receipt Printer</span>
          ${sel('pos')}
        </label>
        <label style="display:block;margin-bottom:20px">
          <span style="display:block;font-size:12px;font-weight:500;color:#555;margin-bottom:4px;text-transform:uppercase;letter-spacing:.4px">A5 Printer</span>
          ${sel('a5')}
        </label>
        <div id="__ps-msg" style="font-size:13px;min-height:18px;margin-bottom:12px;color:green;text-align:center"></div>
        <div style="display:flex;gap:10px;justify-content:flex-end">
          <button id="__ps-cancel" style="padding:8px 18px;border:1px solid #ddd;border-radius:7px;background:#f5f5f5;cursor:pointer;font-size:14px">Cancel</button>
          <button id="__ps-save" style="padding:8px 22px;border:none;border-radius:7px;background:#2563eb;color:#fff;cursor:pointer;font-size:14px;font-weight:500">Save</button>
        </div>
      </div>
    </div>
  \`;

  function close() { backdrop.remove(); }

  backdrop.querySelector('#__ps-close').onclick = close;
  backdrop.querySelector('#__ps-cancel').onclick = close;
  backdrop.addEventListener('mousedown', (e) => { if (e.target === backdrop) close(); });

  backdrop.querySelector('#__ps-browse').onclick = async function() {
    const iconPath = await window.electronAPI.selectIcon();
    if (iconPath) document.getElementById('ps-app-icon').value = iconPath;
  };

  backdrop.querySelector('#__ps-save').onclick = async function() {
    const config = ${c};
    if (!config.app) config.app = {};
    config.app.name  = document.getElementById('ps-app-name').value.trim();
    config.app.icon  = document.getElementById('ps-app-icon').value.trim();
    config.barcode.name = document.getElementById('ps-barcode').value;
    config.pos.name     = document.getElementById('ps-pos').value;
    config.a5.name      = document.getElementById('ps-a5').value;

    const btn = backdrop.querySelector('#__ps-save');
    btn.disabled = true; btn.textContent = 'Saving…';
    try {
      await window.electronAPI.savePrinterConfig(config);
      document.getElementById('__ps-msg').textContent = 'Saved!';
      setTimeout(close, 900);
    } catch(err) {
      document.getElementById('__ps-msg').style.color = 'red';
      document.getElementById('__ps-msg').textContent = 'Save failed: ' + err.message;
      btn.disabled = false; btn.textContent = 'Save';
    }
  };

  document.body.appendChild(backdrop);
})();
`;
}

// ── Splash window ─────────────────────────────────────────────────────────────
function createSplashWindow() {
  splashWindow = new BrowserWindow({
    width: 400,
    height: 300,
    frame: false,
    alwaysOnTop: true,
    webPreferences: { nodeIntegration: false, contextIsolation: true }
  });

  splashWindow.loadURL(`data:text/html;charset=utf-8,%3C!DOCTYPE%20html%3E%3Chtml%3E%3Chead%3E%3Cstyle%3Ebody%7Bmargin%3A0%3Bpadding%3A0%3Bdisplay%3Aflex%3Balign-items%3Acenter%3Bjustify-content%3Acenter%3Bheight%3A100vh%3Bbackground%3Alinear-gradient(135deg%2C%233b82f6%2C%235b21b6)%3Bfont-family%3Asystem-ui%7D.splash%7Btext-align%3Acenter%3Bcolor%3Awhite%7Dh1%7Bmargin%3A0%3Bfont-size%3A28px%7Dp%7Bmargin%3A10px%200%200%3Bfont-size%3A14px%3Bopacity%3A0.9%7D.spinner%7Bwidth%3A50px%3Bheight%3A50px%3Bmargin%3A20px%20auto%3Bborder%3A4px%20solid%20rgba(255%2C255%2C255%2C0.3)%3Bborder-top%3A4px%20solid%20white%3Bborder-radius%3A50%25%3Banimation%3Aspin%200.8s%20linear%20infinite%7D%40keyframes%20spin%7Bto%7Btransform%3Arotate(360deg)%7D%7D%3C%2Fstyle%3E%3C%2Fhead%3E%3Cbody%3E%3Cdiv%20class%3D%22splash%22%3E%3Cdiv%20class%3D%22spinner%22%3E%3C%2Fdiv%3E%3Ch1%3EVetFinal%3C%2Fh1%3E%3Cp%3EStarting%20services...%3C%2Fp%3E%3C%2Fdiv%3E%3C%2Fbody%3E%3C%2Fhtml%3E`);
}

// ── Main window ───────────────────────────────────────────────────────────────
function createWindow() {
  const cfg     = readPrinterConfig();
  const appName = (cfg.app && cfg.app.name) || 'VetFinal';
  const appIcon = (cfg.app && cfg.app.icon) || '';

  win = new BrowserWindow({
    width: 1800,
    height: 1024,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.setTitle(appName);
  if (appIcon && fs.existsSync(appIcon)) {
    try { win.setIcon(nativeImage.createFromPath(appIcon)); } catch (e) { console.warn('[icon]', e.message); }
  }

  if (process.env.NODE_ENV === 'development') {
    win.loadURL('http://localhost:5173');
    win.webContents.openDevTools();
  } else {
    win.loadURL(DEFAULT_APP_URL);
  }

  // Ctrl+P → open printer config modal in renderer (existing frontend hook)
  win.webContents.on('before-input-event', (event, input) => {
    if (input.control && input.key.toLowerCase() === 'p' && input.type === 'keyDown') {
      event.preventDefault();
      win.webContents.send('printer-config:open');
    }
  });

  win.once('ready-to-show', () => {
    if (splashWindow) { splashWindow.destroy(); splashWindow = null; }
    win.show();
  });

  win.on('closed', () => { win = null; });
}

// ── Backend startup ───────────────────────────────────────────────────────────
async function startBackendWithErrorHandler() {
  try {
    console.log('[app] Starting backend services...');
    await backend.startAll();
    console.log('[app] Backend services started successfully');
  } catch (err) {
    console.error('[app] Backend startup error:', err.message);

    const response = await dialog.showMessageBox({
      type: 'error',
      title: 'Backend Service Error',
      message: 'Failed to start backend services',
      detail: `${err.message}\n\nSOLUTION:\n1. Install PHP from https://www.php.net/downloads\n2. Or set PHP_PATH environment variable\n3. Or start backend manually:\n   cd backend-laravel && php artisan serve`,
      buttons: ['Try Again', 'Continue Anyway', 'Exit']
    });

    if (response.response === 0) return startBackendWithErrorHandler();
    if (response.response === 2) { app.quit(); return false; }
  }
  return true;
}

// ── App lifecycle ─────────────────────────────────────────────────────────────
app.whenReady().then(async () => {
  try {
    createSplashWindow();

    const success = await startBackendWithErrorHandler();
    if (!success) { app.quit(); return; }

    startKeepAlive();
    createWindow();

    // Ctrl+Shift+P → in-app settings overlay (printer + icon config)
    globalShortcut.register('CommandOrControl+Shift+P', async () => {
      if (!win || win.isDestroyed()) return;
      const printers = await win.webContents.getPrintersAsync();
      const config   = readPrinterConfig();
      const script   = buildOverlayScript(printers, config);
      win.webContents.executeJavaScript(script).catch(() => {});
    });

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  } catch (err) {
    console.error('[app] Unexpected error during startup:', err);
    if (splashWindow) splashWindow.destroy();
    dialog.showErrorBox('Startup Error', 'An unexpected error occurred during startup');
    app.quit();
  }
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('quit', () => {
  stopKeepAlive();
  backend.stopAll();
});
