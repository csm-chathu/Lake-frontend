const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  send: (channel, data) => ipcRenderer.send(channel, data),
  on: (channel, listener) => ipcRenderer.on(channel, listener),
});

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  getPrinterConfig: () => ipcRenderer.invoke('printers:get-config'),
  savePrinterConfig: (config) => ipcRenderer.invoke('printers:save-config', config),
  printReceipt: (html) => ipcRenderer.invoke('printers:print-receipt', html),
  printBarcode: (html) => ipcRenderer.invoke('printers:print-barcode', html),
});
