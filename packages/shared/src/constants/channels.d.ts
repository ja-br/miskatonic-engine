/**
 * IPC channel names - centralized for type safety
 * All IPC communication between main and renderer processes uses these constants
 */
export declare const IPC_CHANNELS: {
    readonly FILE_READ: "file:read";
    readonly FILE_WRITE: "file:write";
    readonly FILE_DELETE: "file:delete";
    readonly FILE_WATCH: "file:watch";
    readonly WINDOW_MINIMIZE: "window:minimize";
    readonly WINDOW_MAXIMIZE: "window:maximize";
    readonly WINDOW_CLOSE: "window:close";
    readonly WINDOW_FULLSCREEN: "window:fullscreen";
    readonly WINDOW_STATE_CHANGED: "window:state-changed";
    readonly SYSTEM_INFO: "system:info";
    readonly SYSTEM_GPU_INFO: "system:gpu-info";
    readonly SYSTEM_OPEN_DEV_TOOLS: "system:open-devtools";
    readonly APP_QUIT: "app:quit";
    readonly APP_VERSION: "app:version";
    readonly APP_PATH: "app:path";
};
export type IPCChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS];
//# sourceMappingURL=channels.d.ts.map