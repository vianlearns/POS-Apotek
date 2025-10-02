const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');
const express = require('express');
const isDev = process.env.NODE_ENV === 'development';

let mainWindow;
let expressApp;
let server;

// Start Express server langsung dalam Electron
function startIntegratedServer() {
  try {
    // Import dan setup Express app
    const serverPath = isDev 
      ? path.join(__dirname, '../electron/server/index-integrated.cjs')
      : path.join(__dirname, './server/index-integrated.cjs');
    
    expressApp = require(serverPath);
    
    // Start server pada port 3001
    server = expressApp.listen(3001, 'localhost', () => {
      console.log('Integrated Express server running on http://localhost:3001');
    });
    
    server.on('error', (err) => {
      console.error('Failed to start integrated server:', err);
    });
    
  } catch (error) {
    console.error('Error starting integrated server:', error);
  }
}

// Hapus static server terpisah, gunakan Express untuk serve static files
async function setupProductionServer() {
  if (!isDev) {
    const distPath = path.join(__dirname, '../dist');
    expressApp.use(express.static(distPath));
    
    // SPA fallback
    expressApp.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }
}

function createWindow() {
  // Buat window utama aplikasi
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      webSecurity: true,
      preload: path.join(__dirname, 'preload.cjs')
    },
    icon: path.join(__dirname, '../public/logo.png'),
    title: 'Hanum Farma - Sistem Manajemen Apotek',
    show: false, // Jangan tampilkan sampai ready
    titleBarStyle: 'default'
  });

  // Load aplikasi
  if (isDev) {
    mainWindow.loadURL('http://localhost:8080');
    // Buka DevTools di development
    mainWindow.webContents.openDevTools();
  } else {
    // Di production, load dari integrated server
    mainWindow.loadURL('http://localhost:3001');
  }

  // Tampilkan window setelah ready
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    
    // Focus pada window
    if (isDev) {
      mainWindow.focus();
    }
  });

  // Handle window closed
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Prevent navigation to external URLs
  mainWindow.webContents.on('will-navigate', (event, navigationUrl) => {
    const parsedUrl = new URL(navigationUrl);
    
    if (parsedUrl.origin !== 'http://localhost:8080' && 
        parsedUrl.origin !== 'http://localhost:3001' && 
        parsedUrl.origin !== 'file://') {
      event.preventDefault();
    }
  });
}

// Setup menu aplikasi
function createMenu() {
  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Keluar',
          accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
          click: () => {
            app.quit();
          }
        }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload', label: 'Muat Ulang' },
        { role: 'forceReload', label: 'Paksa Muat Ulang' },
        { role: 'toggleDevTools', label: 'Toggle Developer Tools' },
        { type: 'separator' },
        { role: 'resetZoom', label: 'Reset Zoom' },
        { role: 'zoomIn', label: 'Zoom In' },
        { role: 'zoomOut', label: 'Zoom Out' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: 'Toggle Fullscreen' }
      ]
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize', label: 'Minimize' },
        { role: 'close', label: 'Tutup' }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// Event handlers
app.whenReady().then(async () => {
  // Start integrated server
  startIntegratedServer();
  
  // Setup production server jika diperlukan
  await setupProductionServer();
  
  // Tunggu server ready
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  createWindow();
  createMenu();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  // Close integrated server if running
  if (server) {
    server.close();
  }
  
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  if (server) {
    server.close();
  }
});

// Security: Prevent new window creation
app.on('web-contents-created', (event, contents) => {
  contents.on('new-window', (event, navigationUrl) => {
    event.preventDefault();
  });
});