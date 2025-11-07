import { session } from 'electron';
import log from 'electron-log';

/**
 * Handles permission requests from renderer
 */
export class PermissionHandler {
  /**
   * Setup permission handlers
   */
  static setup(): void {
    session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
      log.info(`Permission requested: ${permission}`);

      // Allow only specific permissions needed for game engine
      const allowedPermissions = [
        'notifications',
        'fullscreen',
        'pointerLock', // For FPS controls
        'audioCapture', // For voice chat (future)
        'videoCapture', // For streaming (future)
      ];

      if (allowedPermissions.includes(permission)) {
        callback(true);
      } else {
        log.warn(`Denied permission: ${permission}`);
        callback(false);
      }
    });
  }
}
