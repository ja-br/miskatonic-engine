const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function build() {
  console.log('🏗️  Building Miskatonic Engine...\n');

  // Clean dist directory
  const distPath = path.join(__dirname, '../dist');
  if (fs.existsSync(distPath)) {
    console.log('🧹 Cleaning dist directory...');
    fs.rmSync(distPath, { recursive: true });
    console.log('✅ Cleaned\n');
  }

  try {
    // Build main process
    console.log('🔨 Building main process...');
    execSync('webpack --config config/webpack.main.config.js', {
      stdio: 'inherit',
      env: { ...process.env, NODE_ENV: 'production' },
    });
    console.log('✅ Main process built\n');

    // Build preload script
    console.log('🔨 Building preload script...');
    execSync('webpack --config config/webpack.preload.config.js', {
      stdio: 'inherit',
      env: { ...process.env, NODE_ENV: 'production' },
    });
    console.log('✅ Preload script built\n');

    // Build renderer
    console.log('🔨 Building renderer...');
    execSync('npm run build', {
      cwd: path.join(__dirname, '../packages/renderer'),
      stdio: 'inherit',
      env: { ...process.env, NODE_ENV: 'production' },
    });
    console.log('✅ Renderer built\n');

    console.log('🎉 Build complete! Output in dist/\n');
    console.log('📦 To create distributable packages, run:');
    console.log('   npm run dist');
  } catch (error) {
    console.error('\n❌ Build failed:', error.message);
    process.exit(1);
  }
}

build();
