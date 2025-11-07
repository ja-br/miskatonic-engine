module.exports = {
  appId: 'com.miskatonic.engine',
  productName: 'Miskatonic Engine',
  directories: {
    output: 'release',
    buildResources: 'build',
  },
  files: ['dist/**/*', 'package.json'],
  mac: {
    category: 'public.app-category.developer-tools',
    target: ['dmg', 'zip'],
    hardenedRuntime: true,
    gatekeeperAssess: false,
  },
  win: {
    target: ['nsis', 'portable'],
    icon: 'build/icon.ico',
  },
  linux: {
    target: ['AppImage', 'deb'],
    category: 'Development',
  },
  publish: null, // Disable auto-publish for now
};
