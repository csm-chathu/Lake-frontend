const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  send: (channel, data) => ipcRenderer.send(channel, data),
  on: (channel, listener) => ipcRenderer.on(channel, listener),
});

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,

  // App info
  getAppInfo:      () => ipcRenderer.invoke('app:get-info'),
  selectIcon:      () => ipcRenderer.invoke('app:select-icon'),

  // Printers
  listPrinters:    () => ipcRenderer.invoke('printers:list'),
  getPrinters:     () => ipcRenderer.invoke('printers:get'),
  getPrinterConfig:  () => ipcRenderer.invoke('printers:get-config'),
  savePrinterConfig: (config) => ipcRenderer.invoke('printers:save-config', config),

  // Printing
  printReceipt:          (html, printerName) => ipcRenderer.invoke('printers:print-receipt', html, printerName),
  printReceiptEscPos:    (data) => ipcRenderer.invoke('printers:print-escpos', data),
  printReceiptWithDialog: (html) => ipcRenderer.invoke('printers:print-receipt-dialog', html),
  printBarcode:          (html, printerName) => ipcRenderer.invoke('printers:print-barcode', html, printerName),

  // Database
  exportDb: () => ipcRenderer.invoke('db:export'),
  importDb: () => ipcRenderer.invoke('db:import'),

  // Logging
  onMainLog: (callback) => ipcRenderer.on('main:log', (_e, msg) => callback(msg)),
});

