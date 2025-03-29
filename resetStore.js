/**
 * Reset Electron Store
 * 
 * This script resets the electron-store configuration file that might be corrupted.
 * Run this script with Node.js to fix the "Unexpected token" JSON parse error.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

// Determine the app name from package.json
const packageJson = require('./package.json');
const appName = packageJson.name || 'codex-md';

// Determine the electron-store path based on the platform
let configPath;
if (process.platform === 'win32') {
  configPath = path.join(os.homedir(), 'AppData', 'Roaming', appName);
} else if (process.platform === 'darwin') {
  configPath = path.join(os.homedir(), 'Library', 'Application Support', appName);
} else {
  configPath = path.join(os.homedir(), '.config', appName);
}

// The config.json file path
const configFile = path.join(configPath, 'config.json');

console.log('Checking for electron-store config file at:', configFile);

// Check if the file exists
if (fs.existsSync(configFile)) {
  console.log('Found config file, backing up and resetting...');
  
  // Create a backup
  const backupFile = `${configFile}.backup-${Date.now()}`;
  fs.copyFileSync(configFile, backupFile);
  console.log('Created backup at:', backupFile);
  
  // Create a new empty config
  const emptyConfig = JSON.stringify({}, null, 2);
  fs.writeFileSync(configFile, emptyConfig);
  console.log('Reset config file with empty configuration');
  
  console.log('Done! The application should now start without the JSON parse error.');
} else {
  console.log('Config file not found. Creating empty config...');
  
  // Ensure directory exists
  if (!fs.existsSync(configPath)) {
    fs.mkdirSync(configPath, { recursive: true });
    console.log('Created config directory:', configPath);
  }
  
  // Create a new empty config
  const emptyConfig = JSON.stringify({}, null, 2);
  fs.writeFileSync(configFile, emptyConfig);
  console.log('Created empty config file at:', configFile);
  
  console.log('Done! The application should now start without the JSON parse error.');
}
