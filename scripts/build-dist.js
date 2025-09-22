const fs = require('fs');
const path = require('path');

// Simple build script to create a distributable version
// This bypasses electron-builder issues on Windows

const sourceDir = path.join(__dirname, '..', 'dist');
const releaseDir = path.join(__dirname, '..', 'release', 'manual-build');

// Create release directory
if (!fs.existsSync(releaseDir)) {
  fs.mkdirSync(releaseDir, { recursive: true });
}

// Copy dist files
function copyRecursive(src, dest) {
  const stats = fs.statSync(src);
  if (stats.isDirectory()) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest);
    }
    fs.readdirSync(src).forEach(childItemName => {
      copyRecursive(
        path.join(src, childItemName),
        path.join(dest, childItemName)
      );
    });
  } else {
    fs.copyFileSync(src, dest);
  }
}

console.log('Creating manual distribution...');
copyRecursive(sourceDir, path.join(releaseDir, 'dist'));

// Copy package.json
fs.copyFileSync(
  path.join(__dirname, '..', 'package.json'),
  path.join(releaseDir, 'package.json')
);

// Create a simple start script
const startScript = `@echo off
echo Starting Multi-LLM Chat...
cd /d "%~dp0"
npx electron dist/main.js
pause
`;

fs.writeFileSync(path.join(releaseDir, 'start.bat'), startScript);

console.log('Manual distribution created at:', releaseDir);
console.log('To run: cd to the release/manual-build directory and run start.bat');