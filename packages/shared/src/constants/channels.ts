/**
 * IPC channel names - centralized for type safety
 * All IPC communication between main and renderer processes uses these constants
 */
export const IPC_CHANNELS = {
  // File operations
  FILE_READ: 'file:read',
  FILE_WRITE: 'file:write',
  FILE_DELETE: 'file:delete',
  FILE_WATCH: 'file:watch',

  // Window operations
  WINDOW_MINIMIZE: 'window:minimize',
  WINDOW_MAXIMIZE: 'window:maximize',
  WINDOW_CLOSE: 'window:close',
  WINDOW_FULLSCREEN: 'window:fullscreen',
  WINDOW_STATE_CHANGED: 'window:state-changed',

  // System operations
  SYSTEM_INFO: 'system:info',
  SYSTEM_GPU_INFO: 'system:gpu-info',
  SYSTEM_OPEN_DEV_TOOLS: 'system:open-devtools',

  // Dialog operations
  DIALOG_OPEN_FILE: 'dialog:open-file',
  DIALOG_OPEN_DIRECTORY: 'dialog:open-directory',
  DIALOG_SAVE_FILE: 'dialog:save-file',
  DIALOG_MESSAGE_BOX: 'dialog:message-box',

  // App operations
  APP_QUIT: 'app:quit',
  APP_VERSION: 'app:version',
  APP_PATH: 'app:path',
} as const;

export type IPCChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS];
