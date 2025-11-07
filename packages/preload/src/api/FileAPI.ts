import { ipcRenderer } from 'electron';
import { IPC_CHANNELS, FileReadResponse, FileWriteResponse } from '@miskatonic/shared';

/**
 * File API exposed to renderer
 */
export function createFileAPI() {
  return {
    /**
     * Read a file from the userData directory
     */
    read: (path: string, encoding: 'utf-8' | 'binary' = 'utf-8'): Promise<FileReadResponse> => {
      return ipcRenderer.invoke(IPC_CHANNELS.FILE_READ, { path, encoding });
    },

    /**
     * Write a file to the userData directory
     */
    write: (path: string, data: string): Promise<FileWriteResponse> => {
      return ipcRenderer.invoke(IPC_CHANNELS.FILE_WRITE, { path, data });
    },
  };
}

export type FileAPI = ReturnType<typeof createFileAPI>;
