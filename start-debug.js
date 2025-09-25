const { spawn } = require('child_process');
const path = require('path');

// Set environment to show DevTools
process.env.ELECTRON_ENABLE_LOGGING = '1';
process.env.NODE_ENV = 'production';

console.log('Starting Electron app with debug output...\n');

const electron = spawn(
  'npx',
  ['electron', 'dist/main.js'],
  {
    stdio: 'inherit',
    env: {
      ...process.env,
      ELECTRON_ENABLE_LOGGING: '1',
      NODE_ENV: 'production'
    },
    shell: true
  }
);

electron.on('close', (code) => {
  console.log(`\nElectron app exited with code ${code}`);
});

electron.on('error', (err) => {
  console.error('Failed to start Electron app:', err);
});