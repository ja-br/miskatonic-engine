# Application Icons

This directory contains icons for the Miskatonic Engine application.

## Required Icons

### System Tray
- **icon.png** - Tray icon for macOS/Linux (16x16 or 32x32 recommended)
- **icon.ico** - Tray icon for Windows (16x16, 32x32, 48x48 sizes embedded)

### Application
- **app-icon.png** - Main application icon (512x512 recommended)
- **app-icon.icns** - macOS application icon
- **app-icon.ico** - Windows application icon

## Icon Guidelines

### Tray Icons
- Should be monochrome or simple two-color designs
- macOS: 16x16pt (32x32px @2x) template image
- Windows: 16x16 and 32x32 sizes in .ico format
- Linux: 16x16 or 22x22 PNG

### Application Icons
- Use high resolution source (1024x1024 or larger)
- Include multiple sizes in .ico/.icns for best quality
- Maintain consistent visual identity across platforms

## Creating Icons

### macOS (.icns)
```bash
iconutil -c icns icon.iconset
```

### Windows (.ico)
Use tools like ImageMagick or online converters to create multi-size .ico files.

### Placeholder Icons
Currently using placeholder icons. Replace with actual branded icons before release.
