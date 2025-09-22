const { spawn } = require('child_process');
const path = require('path');

// Set development environment
process.env.NODE_ENV = 'development';

console.log('Starting Multi-LLM Chat in development mode...');

// Start webpack dev server for renderer
const webpackDevServer = spawn('npm', ['run', 'dev:renderer'], {
  stdio: 'inherit',
  shell: true,
});

// Start TypeScript compiler for main process
const tscWatch = spawn('npm', ['run', 'dev:main'], {
  stdio: 'inherit',
  shell: true,
});

// Wait a bit for webpack dev server to start, then start Electron
setTimeout(() => {
  console.log('Starting Electron...');
  const electron = spawn('npm', ['start'], {
    stdio: 'inherit',
    shell: true,
  });

  // Handle process cleanup
  process.on('SIGINT', () => {
    console.log('\nShutting down development servers...');
    webpackDevServer.kill();
    tscWatch.kill();
    electron.kill();
    process.exit(0);
  });
}, 3000);