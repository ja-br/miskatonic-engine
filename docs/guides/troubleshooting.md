# Troubleshooting Guide

## Build Errors

### TypeScript Error: TS6059 File not under 'rootDir'

**Symptom**: Webpack compilation fails with errors like:
```
TS6059: File '/path/to/shared/src/index.ts' is not under 'rootDir'
```

**Solution**: This happens when `rootDir` is set in tsconfig.json for monorepo packages. Remove `rootDir` from all package tsconfig.json files:

```json
{
  "compilerOptions": {
    "outDir": "./dist",
    // Remove "rootDir": "./src"
  }
}
```

### Cannot find module '@miskatonic/shared'

**Symptom**: TypeScript can't resolve the shared package.

**Solution**:
1. Ensure dependencies are installed: `npm install`
2. Check package.json has correct reference: `"@miskatonic/shared": "*"`
3. Verify workspace structure in root package.json

### Port 5173 Already in Use

**Symptom**: Vite fails to start dev server.

**Solutions**:
1. Kill the process using the port:
   ```bash
   lsof -ti:5173 | xargs kill -9
   ```
2. Change port in `packages/renderer/vite.config.ts`:
   ```ts
   server: {
     port: 5174, // Use different port
   }
   ```

## Runtime Errors

### ElectronAPI not available

**Symptom**: `window.electronAPI is undefined` in renderer.

**Causes**:
1. Preload script not loading
2. Context isolation disabled
3. Webpack build failed

**Solutions**:
1. Check preload path in WindowConfig
2. Verify preload script compiled: `ls dist/preload/index.js`
3. Check browser console for preload errors

### IPC Handler Errors

**Symptom**: IPC calls fail with validation errors.

**Solution**: Check that request matches Zod schema:
```typescript
// Request must match FileReadRequestSchema
const result = await window.electronAPI.file.read('path.txt', 'utf-8');
```

### Renderer Crash

**Symptom**: Window shows crash page or reloads.

**Solution**:
1. Check main process logs: `~/Library/Logs/miskatonic-engine/`
2. Look for crash dumps: `~/Library/Application Support/miskatonic-engine/crashes/`
3. Check for memory leaks or infinite loops

## Development Issues

### Hot Reload Not Working

**Symptom**: Changes don't reflect without manual refresh.

**Solutions**:
1. Renderer: Check Vite HMR WebSocket connection
2. Main/Preload: These require manual Electron restart (no HMR)
3. Use `npm run dev` which includes watch mode

### Webpack Watch Mode Stuck

**Symptom**: Webpack rebuilds indefinitely or doesn't detect changes.

**Solution**:
1. Kill all node processes: `pkill -f webpack`
2. Clean build artifacts: `npm run clean`
3. Restart dev environment: `npm run dev`

### TypeScript IntelliSense Not Working

**Symptom**: VS Code doesn't show type hints.

**Solutions**:
1. Reload VS Code window: `Cmd+Shift+P` → "Reload Window"
2. Select workspace TypeScript: `Cmd+Shift+P` → "Select TypeScript Version" → "Use Workspace Version"
3. Rebuild: `npm run build`

## Testing Issues

### Tests Fail to Import Modules

**Symptom**: Vitest can't resolve `@miskatonic/shared`.

**Solution**: Check vitest.config.ts has correct aliases:
```ts
resolve: {
  alias: {
    '@miskatonic/shared': path.resolve(__dirname, 'packages/shared/src'),
  }
}
```

### Coverage Reports Empty

**Symptom**: Coverage shows 0% despite tests passing.

**Solution**: Ensure test files are in `tests/` directory and source files in `packages/*/src/`.

## Platform-Specific Issues

### macOS

#### App Won't Launch
- Check Gatekeeper: System Preferences → Security & Privacy
- Verify app is signed (development builds are not)

### Windows

#### Build Fails with EPERM
- Disable antivirus temporarily
- Run terminal as Administrator
- Close all Electron instances

### Linux

#### Missing Dependencies
Install required libraries:
```bash
sudo apt-get install libgtk-3-0 libnotify4 libnss3 libxss1 libxtst6 xdg-utils libatspi2.0-0 libdrm2 libgbm1 libxcb-dri3-0
```

## Getting Help

If none of these solutions work:

1. Check logs:
   - Main process: `~/Library/Logs/miskatonic-engine/` (macOS)
   - Renderer: Browser DevTools console

2. Clean everything and rebuild:
   ```bash
   npm run clean
   rm -rf node_modules package-lock.json
   npm install
   npm run build
   ```

3. Check GitHub Issues: (future)

4. Ask in Discord: (future)

## Common Warnings

### npm WARN deprecated

**Safe to ignore** - These are warnings about outdated dependencies in sub-dependencies. They don't affect functionality.

### Electron Security Warnings

If you see security warnings in the console, **do not ignore them**. These indicate security misconfigurations. Check:
- Context isolation enabled
- Node integration disabled
- WebSecurity enabled
- CSP headers set

## Performance Issues

### High Memory Usage

**Normal**: 300-600MB is expected
**High**: >1GB indicates a problem

**Solutions**:
1. Check for memory leaks with Chrome DevTools Memory profiler
2. Verify renderer process isn't accumulating entities
3. Check for circular references

### Low FPS

**Target**: 60 FPS
**Minimum**: 30 FPS

**Solutions**:
1. Enable GPU acceleration (should be default)
2. Check draw call count (target <500)
3. Profile with Chrome DevTools Performance tab
4. Reduce entity count or enable culling

---

For more help, see:
- [Development Setup](development-setup.md)
- [Architecture Docs](../architecture/)
- [GitHub Issues](https://github.com/miskatonic/engine/issues) (future)
