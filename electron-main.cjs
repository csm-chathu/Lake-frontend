const { app, BrowserWindow, dialog } = require('electron');
const path = require('path');
const backend = require('./start-backend.cjs');

let win;
let splashWindow;

function createSplashWindow() {
  splashWindow = new BrowserWindow({
    width: 400,
    height: 300,
    frame: false,
    alwaysOnTop: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  splashWindow.loadURL(`data:text/html;charset=utf-8,%3C!DOCTYPE%20html%3E%3Chtml%3E%3Chead%3E%3Cstyle%3Ebody%7Bmargin%3A0%3Bpadding%3A0%3Bdisplay%3Aflex%3Balign-items%3Acenter%3Bjustify-content%3Acenter%3Bheight%3A100vh%3Bbackground%3Alinear-gradient(135deg%2C%233b82f6%2C%235b21b6)%3Bfont-family%3Asystem-ui%7D.splash%7Btext-align%3Acenter%3Bcolor%3Awhite%7Dh1%7Bmargin%3A0%3Bfont-size%3A28px%7Dp%7Bmargin%3A10px%200%200%3Bfont-size%3A14px%3Bopacity%3A0.9%7D.spinner%7Bwidth%3A50px%3Bheight%3A50px%3Bmargin%3A20px%20auto%3Bborder%3A4px%20solid%20rgba(255%2C255%2C255%2C0.3)%3Bborder-top%3A4px%20solid%20white%3Bborder-radius%3A50%25%3Banimation%3Aspin%200.8s%20linear%20infinite%7D%40keyframes%20spin%7Bto%7Btransform%3Arotate(360deg)%7D%7D%3C%2Fstyle%3E%3C%2Fhead%3E%3Cbody%3E%3Cdiv%20class%3D%22splash%22%3E%3Cdiv%20class%3D%22spinner%22%3E%3C%2Fdiv%3E%3Ch1%3EVetFinal%3C%2Fh1%3E%3Cp%3EStarting services...%3C%2Fp%3E%3C%2Fdiv%3E%3C%2Fbody%3E%3C%2Fhtml%3E`);
}

function createWindow() {
  win = new BrowserWindow({
    width: 1800,
    height: 1024,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (process.env.NODE_ENV === 'development') {
    win.loadURL('http://localhost:5173');
    win.webContents.openDevTools();
  } else {
    win.loadFile(path.join(__dirname, 'dist', 'index.html'));
  }

  // Close splash window when main window is ready
  win.once('ready-to-show', () => {
    if (splashWindow) {
      splashWindow.destroy();
    }
    win.show();
  });
}

async function startBackendWithErrorHandler() {
  try {
    console.log('[app] Starting backend services...');
    await backend.startAll();
    console.log('[app] Backend services started successfully');
  } catch (err) {
    console.error('[app] Backend startup error:', err.message);
    
    // Show error dialog
    const response = await dialog.showMessageBox({
      type: 'error',
      title: 'Backend Service Error',
      message: 'Failed to start backend services',
      detail: `${err.message}\n\nSOLUTION:\n1. Install PHP from https://www.php.net/downloads\n2. Or set PHP_PATH environment variable\n3. Or start backend manually:\n   cd backend-laravel && php artisan serve`,
      buttons: ['Try Again', 'Continue Anyway', 'Exit']
    });

    if (response.response === 0) {
      // Try again
      return startBackendWithErrorHandler();
    } else if (response.response === 2) {
      // Exit
      app.quit();
      return false;
    }
    // Continue anyway (response === 1)
  }
  
  return true;
}

app.whenReady().then(async () => {
  try {
    // Create splash screen
    createSplashWindow();

    // Start backend services
    const success = await startBackendWithErrorHandler();
    
    if (success || success === null) {
      // Create main window
      createWindow();
    } else {
      app.quit();
    }
  } catch (err) {
    console.error('[app] Unexpected error during startup:', err);
    if (splashWindow) splashWindow.destroy();
    dialog.showErrorBox('Startup Error', 'An unexpected error occurred during startup');
    app.quit();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('quit', () => {
  backend.stopAll();
});
