/**
 * Main process entry point for the Electron application.
 * Handles window management, IPC communication, and native system integration.
 * 
 * Related files:
 * - preload.js: Bridges main and renderer processes securely
 * - ipc/handlers.js: IPC main process handlers
 * - ipc/types.js: TypeScript definitions for IPC messages
 * - features/tray.js: System tray integration
 * - features/notifications.js: Native notifications
 */

const { app, BrowserWindow } = require('electron');
const path = require('path');
const Store = require('electron-store');
const crypto = require('crypto');
const machineId = require('node-machine-id');
const { setupIPCHandlers } = require('./ipc/handlers');
const { IPCChannels } = require('./ipc/types');
const TrayManager = require('./features/tray');
const NotificationManager = require('./features/notifications');

// Generate machine-specific encryption key for the store
const generateStoreKey = async () => {
  const id = await machineId.machineId();
  return crypto.createHash('sha256').update(id).digest('hex');
};

// Initialize store for settings persistence and managers
let store;
let trayManager;
let notificationManager;
app.whenReady().then(async () => {
  const encryptionKey = await generateStoreKey();
  store = new Store({ encryptionKey });
  process.env.STORE_ENCRYPTION_KEY = encryptionKey;
});

/**
 * Creates the main application window with secure configurations
 * @returns {Electron.BrowserWindow} The created window instance
 */
function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      contextIsolation: true, // Required for security
      nodeIntegration: false, // Disabled for security
      sandbox: true, // Enable sandbox for additional security
      preload: path.join(__dirname, 'preload.js')
    }
  });

  // In development, load Svelte dev server
  // In production, load built Svelte app
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
    // Open DevTools in development
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../frontend/build/index.html'));
  }

  return mainWindow;
}

// Create window and setup IPC when app is ready
app.whenReady().then(async () => {
  const mainWindow = createWindow();
  
  // Setup IPC handlers
  setupIPCHandlers(app, mainWindow);
  
  // Initialize desktop features
  trayManager = new TrayManager(mainWindow, store);
  notificationManager = new NotificationManager();
  
  // Make notification manager available to IPC handlers
  global.notificationManager = notificationManager;

  // Handle window creation on macOS when clicking dock icon
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });

  // Handle squirrel events for Windows installer
  if (require('electron-squirrel-startup')) app.quit();
});

// Quit when all windows are closed (except on macOS)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Clean up resources when quitting
app.on('will-quit', () => {
  if (trayManager) {
    trayManager.destroy();
  }
});

// Handle any uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});
