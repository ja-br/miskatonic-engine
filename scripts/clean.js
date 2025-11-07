const fs = require('fs');
const path = require('path');

function clean() {
  console.log('🧹 Cleaning build artifacts...\n');

  const dirsToClean = [
    path.join(__dirname, '../dist'),
    path.join(__dirname, '../release'),
    path.join(__dirname, '../packages/main/dist'),
    path.join(__dirname, '../packages/preload/dist'),
    path.join(__dirname, '../packages/renderer/dist'),
    path.join(__dirname, '../packages/shared/dist'),
  ];

  for (const dir of dirsToClean) {
    if (fs.existsSync(dir)) {
      console.log(`  Removing ${path.relative(process.cwd(), dir)}`);
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }

  // Clean .tsbuildinfo files
  const findAndRemove = (dir, pattern) => {
    if (!fs.existsSync(dir)) return;
    const files = fs.readdirSync(dir);
    for (const file of files) {
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        findAndRemove(fullPath, pattern);
      } else if (file.match(pattern)) {
        console.log(`  Removing ${path.relative(process.cwd(), fullPath)}`);
        fs.unlinkSync(fullPath);
      }
    }
  };

  findAndRemove(path.join(__dirname, '..'), /\.tsbuildinfo$/);

  console.log('\n✅ Clean complete!\n');
}

clean();
