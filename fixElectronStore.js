/**
 * Fix Electron Store
 * 
 * This script fixes the corrupted electron-store configuration files.
 * It targets all possible locations where the config files might be stored.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

// List of possible app names
const possibleAppNames = ['obsidian-converter', 'codex-md'];

// List of possible config file names
const possibleConfigFiles = ['config.json', 'TranscriptionService.json'];

// Determine the possible electron-store paths based on the platform
const getPossiblePaths = () => {
  const paths = [];
  
  for (const appName of possibleAppNames) {
    if (process.platform === 'win32') {
      paths.push(path.join(os.homedir(), 'AppData', 'Roaming', appName));
    } else if (process.platform === 'darwin') {
      paths.push(path.join(os.homedir(), 'Library', 'Application Support', appName));
    } else {
      paths.push(path.join(os.homedir(), '.config', appName));
    }
  }
  
  return paths;
};

// Check and fix config files
const fixConfigFiles = () => {
  const configPaths = getPossiblePaths();
  
  for (const configPath of configPaths) {
    console.log(`Checking directory: ${configPath}`);
    
    if (!fs.existsSync(configPath)) {
      console.log(`Directory does not exist: ${configPath}`);
      continue;
    }
    
    // Check each possible config file
    for (const configFile of possibleConfigFiles) {
      const filePath = path.join(configPath, configFile);
      
      if (fs.existsSync(filePath)) {
        console.log(`Found config file: ${filePath}`);
        
        try {
          // Try to read and parse the file
          const content = fs.readFileSync(filePath, 'utf8');
          JSON.parse(content);
          console.log(`Config file is valid JSON: ${filePath}`);
        } catch (error) {
          console.log(`Config file is corrupted: ${filePath}`);
          console.log(`Error: ${error.message}`);
          
          // Create a backup
          const backupFile = `${filePath}.backup-${Date.now()}`;
          fs.copyFileSync(filePath, backupFile);
          console.log(`Created backup at: ${backupFile}`);
          
          // Create a new empty config
          const emptyConfig = JSON.stringify({}, null, 2);
          fs.writeFileSync(filePath, emptyConfig);
          console.log(`Reset config file with empty configuration: ${filePath}`);
        }
      } else {
        console.log(`Config file does not exist: ${filePath}`);
        
        // Create directory if it doesn't exist
        if (!fs.existsSync(configPath)) {
          fs.mkdirSync(configPath, { recursive: true });
          console.log(`Created config directory: ${configPath}`);
        }
        
        // Create a new empty config
        const emptyConfig = JSON.stringify({}, null, 2);
        fs.writeFileSync(filePath, emptyConfig);
        console.log(`Created empty config file at: ${filePath}`);
      }
    }
  }
  
  console.log('Done! The application should now start without the JSON parse error.');
};

// Run the fix
fixConfigFiles();
