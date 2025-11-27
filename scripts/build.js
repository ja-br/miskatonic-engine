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
    // Build workspace packages first (in dependency order)
    console.log('🔨 Building workspace packages...');

    // CRITICAL: Build order must respect dependencies
    // Packages must build BEFORE packages that depend on them
    // This is a topological sort of the dependency graph
    const workspacePackages = [
      // Leaf packages (no internal dependencies)
      'shared',
      'events',

      // Second level (depend on leaf packages)
      'ecs',
      'resources',

      // Third level (depend on second level)
      'physics',
      'network',
      'rendering',
      'debug-console',

      // Fourth level (Electron processes, depend on shared)
      'main',
      'preload',

      // Top level (depends on everything)
      'core',
    ];

    const rootDir = path.join(__dirname, '..');

    for (const pkg of workspacePackages) {
      const pkgPath = path.join(rootDir, 'packages', pkg);
      const pkgJsonPath = path.join(pkgPath, 'package.json');

      if (!fs.existsSync(pkgJsonPath)) {
        console.warn(`  ⚠️  Package ${pkg} not found, skipping`);
        continue;
      }

      const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));

      if (pkgJson.scripts && pkgJson.scripts.build) {
        console.log(`  Building ${pkg}...`);
        try {
          execSync('npm run build', {
            cwd: pkgPath,
            stdio: 'inherit',
            env: { ...process.env, NODE_ENV: 'production' },
          });
        } catch (buildError) {
          throw new Error(`Failed to build ${pkg}: ${buildError.message}`);
        }

        // Verify critical outputs exist
        if (pkgJson.main) {
          const mainPath = path.join(pkgPath, pkgJson.main);
          if (!fs.existsSync(mainPath)) {
            throw new Error(`Build verification failed: ${pkg} - ${pkgJson.main} not created`);
          }
        }
        if (pkgJson.types) {
          const typesPath = path.join(pkgPath, pkgJson.types);
          if (!fs.existsSync(typesPath)) {
            throw new Error(`Build verification failed: ${pkg} - ${pkgJson.types} not created`);
          }
        }
      } else {
        console.log(`  Skipping ${pkg} (no build script)`);
      }
    }

    console.log('✅ Workspace packages built\n');

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
