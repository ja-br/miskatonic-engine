const { spawn } = require('child_process');
const waitOn = require('wait-on');
const path = require('path');

async function dev() {
  console.log('🚀 Starting Miskatonic Engine development environment...\n');

  // Start Vite dev server for renderer
  console.log('📦 Starting Vite dev server...');
  const vite = spawn('npm', ['run', 'dev'], {
    cwd: path.join(__dirname, '../packages/renderer'),
    stdio: 'inherit',
    shell: true,
  });

  // Wait for Vite to be ready
  console.log('⏳ Waiting for Vite dev server...');
  try {
    await waitOn({
      resources: ['http://localhost:5173'],
      timeout: 30000,
    });
    console.log('✅ Vite dev server ready\n');
  } catch (error) {
    console.error('❌ Failed to start Vite dev server:', error);
    process.exit(1);
  }

  // Build main and preload in watch mode
  console.log('🔨 Building main process (watch mode)...');
  const mainWatch = spawn(
    'webpack',
    ['--watch', '--config', 'config/webpack.main.config.js'],
    {
      stdio: 'inherit',
      shell: true,
      env: { ...process.env, NODE_ENV: 'development' },
    }
  );

  console.log('🔨 Building preload script (watch mode)...');
  const preloadWatch = spawn(
    'webpack',
    ['--watch', '--config', 'config/webpack.preload.config.js'],
    {
      stdio: 'inherit',
      shell: true,
      env: { ...process.env, NODE_ENV: 'development' },
    }
  );

  // Wait for initial build
  console.log('⏳ Waiting for initial build...');
  await new Promise((resolve) => setTimeout(resolve, 5000));

  // Start Electron
  console.log('🎮 Starting Electron...\n');
  const electron = spawn('electron', ['.'], {
    stdio: 'inherit',
    shell: true,
    env: {
      ...process.env,
      NODE_ENV: 'development',
    },
  });

  // Handle cleanup on exit
  const cleanup = () => {
    console.log('\n🛑 Stopping development environment...');
    vite.kill();
    mainWatch.kill();
    preloadWatch.kill();
    electron.kill();
    process.exit();
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);

  electron.on('close', (code) => {
    console.log(`\n👋 Electron exited with code ${code}`);
    cleanup();
  });
}

dev().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
