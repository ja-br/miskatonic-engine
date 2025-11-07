import { z } from 'zod';
/**
 * Base IPC message structure
 */
export declare const IPCMessageSchema: z.ZodObject<{
    id: z.ZodString;
    timestamp: z.ZodNumber;
    channel: z.ZodString;
    data: z.ZodUnknown;
}, "strip", z.ZodTypeAny, {
    id: string;
    timestamp: number;
    channel: string;
    data?: unknown;
}, {
    id: string;
    timestamp: number;
    channel: string;
    data?: unknown;
}>;
export type IPCMessage = z.infer<typeof IPCMessageSchema>;
/**
 * File operation types
 */
export declare const FileReadRequestSchema: z.ZodObject<{
    path: z.ZodString;
    encoding: z.ZodDefault<z.ZodEnum<["utf-8", "binary"]>>;
}, "strip", z.ZodTypeAny, {
    path: string;
    encoding: "utf-8" | "binary";
}, {
    path: string;
    encoding?: "utf-8" | "binary" | undefined;
}>;
export type FileReadRequest = z.infer<typeof FileReadRequestSchema>;
export declare const FileReadResponseSchema: z.ZodObject<{
    success: z.ZodBoolean;
    data: z.ZodOptional<z.ZodString>;
    error: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    success: boolean;
    data?: string | undefined;
    error?: string | undefined;
}, {
    success: boolean;
    data?: string | undefined;
    error?: string | undefined;
}>;
export type FileReadResponse = z.infer<typeof FileReadResponseSchema>;
export declare const FileWriteRequestSchema: z.ZodObject<{
    path: z.ZodString;
    data: z.ZodString;
}, "strip", z.ZodTypeAny, {
    data: string;
    path: string;
}, {
    data: string;
    path: string;
}>;
export type FileWriteRequest = z.infer<typeof FileWriteRequestSchema>;
export declare const FileWriteResponseSchema: z.ZodObject<{
    success: z.ZodBoolean;
    error: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    success: boolean;
    error?: string | undefined;
}, {
    success: boolean;
    error?: string | undefined;
}>;
export type FileWriteResponse = z.infer<typeof FileWriteResponseSchema>;
/**
 * Window operation types
 */
export declare const WindowStateSchema: z.ZodObject<{
    isMaximized: z.ZodBoolean;
    isMinimized: z.ZodBoolean;
    isFullscreen: z.ZodBoolean;
    bounds: z.ZodObject<{
        x: z.ZodNumber;
        y: z.ZodNumber;
        width: z.ZodNumber;
        height: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        x: number;
        y: number;
        width: number;
        height: number;
    }, {
        x: number;
        y: number;
        width: number;
        height: number;
    }>;
}, "strip", z.ZodTypeAny, {
    isMaximized: boolean;
    isMinimized: boolean;
    isFullscreen: boolean;
    bounds: {
        x: number;
        y: number;
        width: number;
        height: number;
    };
}, {
    isMaximized: boolean;
    isMinimized: boolean;
    isFullscreen: boolean;
    bounds: {
        x: number;
        y: number;
        width: number;
        height: number;
    };
}>;
export type WindowState = z.infer<typeof WindowStateSchema>;
/**
 * System info types
 */
export declare const SystemInfoSchema: z.ZodObject<{
    platform: z.ZodEnum<["win32", "darwin", "linux"]>;
    arch: z.ZodString;
    version: z.ZodString;
    memory: z.ZodObject<{
        total: z.ZodNumber;
        free: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        total: number;
        free: number;
    }, {
        total: number;
        free: number;
    }>;
}, "strip", z.ZodTypeAny, {
    platform: "win32" | "darwin" | "linux";
    arch: string;
    version: string;
    memory: {
        total: number;
        free: number;
    };
}, {
    platform: "win32" | "darwin" | "linux";
    arch: string;
    version: string;
    memory: {
        total: number;
        free: number;
    };
}>;
export type SystemInfo = z.infer<typeof SystemInfoSchema>;
export declare const GPUInfoSchema: z.ZodObject<{
    vendor: z.ZodString;
    renderer: z.ZodString;
    webglVersion: z.ZodString;
    extensions: z.ZodArray<z.ZodString, "many">;
}, "strip", z.ZodTypeAny, {
    vendor: string;
    renderer: string;
    webglVersion: string;
    extensions: string[];
}, {
    vendor: string;
    renderer: string;
    webglVersion: string;
    extensions: string[];
}>;
export type GPUInfo = z.infer<typeof GPUInfoSchema>;
/**
 * App info types
 */
export declare const AppVersionSchema: z.ZodObject<{
    version: z.ZodString;
    electronVersion: z.ZodString;
    chromeVersion: z.ZodString;
    nodeVersion: z.ZodString;
}, "strip", z.ZodTypeAny, {
    version: string;
    electronVersion: string;
    chromeVersion: string;
    nodeVersion: string;
}, {
    version: string;
    electronVersion: string;
    chromeVersion: string;
    nodeVersion: string;
}>;
export type AppVersion = z.infer<typeof AppVersionSchema>;
//# sourceMappingURL=ipc.d.ts.map