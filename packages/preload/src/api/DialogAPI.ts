import { ipcRenderer } from 'electron';
import { IPC_CHANNELS } from '@miskatonic/shared';
import type {
  OpenFileDialogRequest,
  OpenFileDialogResponse,
  SaveFileDialogRequest,
  SaveFileDialogResponse,
  MessageBoxRequest,
  MessageBoxResponse,
  FileFilter,
} from '@miskatonic/shared';

/**
 * Dialog API exposed to renderer process
 * Provides access to native OS dialogs
 */
export interface DialogAPI {
  /**
   * Show an open file dialog
   */
  openFile(options?: {
    title?: string;
    defaultPath?: string;
    buttonLabel?: string;
    filters?: FileFilter[];
    multiSelect?: boolean;
    showHiddenFiles?: boolean;
  }): Promise<OpenFileDialogResponse>;

  /**
   * Show an open directory dialog
   */
  openDirectory(options?: {
    title?: string;
    defaultPath?: string;
    buttonLabel?: string;
    multiSelect?: boolean;
    showHiddenFiles?: boolean;
  }): Promise<OpenFileDialogResponse>;

  /**
   * Show a save file dialog
   */
  saveFile(options?: {
    title?: string;
    defaultPath?: string;
    buttonLabel?: string;
    filters?: FileFilter[];
    showHiddenFiles?: boolean;
    createDirectory?: boolean;
    showOverwriteConfirmation?: boolean;
  }): Promise<SaveFileDialogResponse>;

  /**
   * Show a message box dialog
   */
  messageBox(options: {
    type?: 'none' | 'info' | 'error' | 'question' | 'warning';
    title?: string;
    message: string;
    detail?: string;
    buttons?: string[];
    defaultId?: number;
    cancelId?: number;
  }): Promise<MessageBoxResponse>;
}

/**
 * Create the dialog API implementation
 */
export function createDialogAPI(): DialogAPI {
  return {
    async openFile(options = {}) {
      const properties: Array<'openFile' | 'multiSelections' | 'showHiddenFiles'> = ['openFile'];
      if (options.multiSelect) {
        properties.push('multiSelections');
      }
      if (options.showHiddenFiles) {
        properties.push('showHiddenFiles');
      }

      const request: OpenFileDialogRequest = {
        title: options.title,
        defaultPath: options.defaultPath,
        buttonLabel: options.buttonLabel,
        filters: options.filters,
        properties,
      };

      return ipcRenderer.invoke(IPC_CHANNELS.DIALOG_OPEN_FILE, request);
    },

    async openDirectory(options = {}) {
      const properties: Array<'openDirectory' | 'multiSelections' | 'showHiddenFiles'> = ['openDirectory'];
      if (options.multiSelect) {
        properties.push('multiSelections');
      }
      if (options.showHiddenFiles) {
        properties.push('showHiddenFiles');
      }

      const request: OpenFileDialogRequest = {
        title: options.title,
        defaultPath: options.defaultPath,
        buttonLabel: options.buttonLabel,
        properties,
      };

      return ipcRenderer.invoke(IPC_CHANNELS.DIALOG_OPEN_FILE, request);
    },

    async saveFile(options = {}) {
      const properties: Array<'showHiddenFiles' | 'createDirectory' | 'showOverwriteConfirmation'> = [];
      if (options.showHiddenFiles) {
        properties.push('showHiddenFiles');
      }
      if (options.createDirectory) {
        properties.push('createDirectory');
      }
      if (options.showOverwriteConfirmation !== false) {
        properties.push('showOverwriteConfirmation');
      }

      const request: SaveFileDialogRequest = {
        title: options.title,
        defaultPath: options.defaultPath,
        buttonLabel: options.buttonLabel,
        filters: options.filters,
        properties: properties.length > 0 ? properties : undefined,
      };

      return ipcRenderer.invoke(IPC_CHANNELS.DIALOG_SAVE_FILE, request);
    },

    async messageBox(options) {
      const request: MessageBoxRequest = {
        type: options.type,
        title: options.title,
        message: options.message,
        detail: options.detail,
        buttons: options.buttons,
        defaultId: options.defaultId,
        cancelId: options.cancelId,
      };

      return ipcRenderer.invoke(IPC_CHANNELS.DIALOG_MESSAGE_BOX, request);
    },
  };
}
