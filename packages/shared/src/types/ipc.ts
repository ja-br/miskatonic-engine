import { z } from 'zod';

/**
 * Base IPC message structure
 */
export const IPCMessageSchema = z.object({
  id: z.string(),
  timestamp: z.number(),
  channel: z.string(),
  data: z.unknown(),
});

export type IPCMessage = z.infer<typeof IPCMessageSchema>;

/**
 * File operation types
 */
export const FileReadRequestSchema = z.object({
  path: z.string(),
  encoding: z.enum(['utf-8', 'binary']).default('utf-8'),
});

export type FileReadRequest = z.infer<typeof FileReadRequestSchema>;

export const FileReadResponseSchema = z.object({
  success: z.boolean(),
  data: z.string().optional(),
  error: z.string().optional(),
});

export type FileReadResponse = z.infer<typeof FileReadResponseSchema>;

export const FileWriteRequestSchema = z.object({
  path: z.string(),
  data: z.string(),
});

export type FileWriteRequest = z.infer<typeof FileWriteRequestSchema>;

export const FileWriteResponseSchema = z.object({
  success: z.boolean(),
  error: z.string().optional(),
});

export type FileWriteResponse = z.infer<typeof FileWriteResponseSchema>;

// Arbitrary file read (outside sandbox, for user-selected files)
export const FileReadArbitraryRequestSchema = z.object({
  path: z.string(),
  encoding: z.enum(['utf-8', 'base64']).default('utf-8'),
});

export type FileReadArbitraryRequest = z.infer<typeof FileReadArbitraryRequestSchema>;

export const FileReadArbitraryResponseSchema = z.object({
  success: z.boolean(),
  data: z.string().optional(),
  error: z.string().optional(),
});

export type FileReadArbitraryResponse = z.infer<typeof FileReadArbitraryResponseSchema>;

/**
 * Window operation types
 */
export const WindowStateSchema = z.object({
  isMaximized: z.boolean(),
  isMinimized: z.boolean(),
  isFullscreen: z.boolean(),
  bounds: z.object({
    x: z.number(),
    y: z.number(),
    width: z.number(),
    height: z.number(),
  }),
});

export type WindowState = z.infer<typeof WindowStateSchema>;

/**
 * System info types
 */
export const SystemInfoSchema = z.object({
  platform: z.enum(['win32', 'darwin', 'linux']),
  arch: z.string(),
  version: z.string(),
  memory: z.object({
    total: z.number(),
    free: z.number(),
  }),
});

export type SystemInfo = z.infer<typeof SystemInfoSchema>;

export const GPUInfoSchema = z.object({
  vendor: z.string(),
  renderer: z.string(),
  webglVersion: z.string(),
  extensions: z.array(z.string()),
});

export type GPUInfo = z.infer<typeof GPUInfoSchema>;

/**
 * App info types
 */
export const AppVersionSchema = z.object({
  version: z.string(),
  electronVersion: z.string(),
  chromeVersion: z.string(),
  nodeVersion: z.string(),
});

export type AppVersion = z.infer<typeof AppVersionSchema>;

/**
 * Dialog operation types
 */
export const FileFilterSchema = z.object({
  name: z.string(),
  extensions: z.array(z.string()),
});

export type FileFilter = z.infer<typeof FileFilterSchema>;

export const OpenFileDialogRequestSchema = z.object({
  title: z.string().optional(),
  defaultPath: z.string().optional(),
  buttonLabel: z.string().optional(),
  filters: z.array(FileFilterSchema).optional(),
  properties: z
    .array(z.enum(['openFile', 'openDirectory', 'multiSelections', 'showHiddenFiles']))
    .optional(),
});

export type OpenFileDialogRequest = z.infer<typeof OpenFileDialogRequestSchema>;

export const OpenFileDialogResponseSchema = z.object({
  canceled: z.boolean(),
  filePaths: z.array(z.string()),
});

export type OpenFileDialogResponse = z.infer<typeof OpenFileDialogResponseSchema>;

export const SaveFileDialogRequestSchema = z.object({
  title: z.string().optional(),
  defaultPath: z.string().optional(),
  buttonLabel: z.string().optional(),
  filters: z.array(FileFilterSchema).optional(),
  properties: z.array(z.enum(['showHiddenFiles', 'createDirectory', 'showOverwriteConfirmation'])).optional(),
});

export type SaveFileDialogRequest = z.infer<typeof SaveFileDialogRequestSchema>;

export const SaveFileDialogResponseSchema = z.object({
  canceled: z.boolean(),
  filePath: z.string().optional(),
});

export type SaveFileDialogResponse = z.infer<typeof SaveFileDialogResponseSchema>;

export const MessageBoxRequestSchema = z.object({
  type: z.enum(['none', 'info', 'error', 'question', 'warning']).optional(),
  title: z.string().optional(),
  message: z.string(),
  detail: z.string().optional(),
  buttons: z.array(z.string()).optional(),
  defaultId: z.number().optional(),
  cancelId: z.number().optional(),
});

export type MessageBoxRequest = z.infer<typeof MessageBoxRequestSchema>;

export const MessageBoxResponseSchema = z.object({
  response: z.number(), // Index of the button clicked
  checkboxChecked: z.boolean().optional(),
});

export type MessageBoxResponse = z.infer<typeof MessageBoxResponseSchema>;
