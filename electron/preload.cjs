const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods yang memungkinkan renderer process
// untuk berkomunikasi dengan main process secara aman
contextBridge.exposeInMainWorld('electronAPI', {
  // Contoh API yang bisa ditambahkan nanti jika diperlukan
  platform: process.platform,
  
  // Method untuk mendapatkan versi aplikasi
  getVersion: () => {
    return process.env.npm_package_version || '1.0.0';
  },
  
  // Method untuk print (jika diperlukan integrasi dengan printer sistem)
  print: () => {
    ipcRenderer.invoke('print-receipt');
  }
});

// Disable node integration untuk keamanan
window.nodeRequire = undefined;
window.require = undefined;
window.exports = undefined;
window.module = undefined;