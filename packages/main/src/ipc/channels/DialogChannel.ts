import { IpcMainInvokeEvent, dialog, BrowserWindow } from 'electron';
import { BaseChannelHandler } from '../types';
import { IPC_CHANNELS } from '@miskatonic/shared';
import {
  OpenFileDialogRequest,
  OpenFileDialogRequestSchema,
  OpenFileDialogResponse,
  OpenFileDialogResponseSchema,
  SaveFileDialogRequest,
  SaveFileDialogRequestSchema,
  SaveFileDialogResponse,
  SaveFileDialogResponseSchema,
  MessageBoxRequest,
  MessageBoxRequestSchema,
  MessageBoxResponse,
  MessageBoxResponseSchema,
} from '@miskatonic/shared';
import log from 'electron-log';

/**
 * Handler for open file dialog
 */
export class OpenFileDialogHandler extends BaseChannelHandler<
  OpenFileDialogRequest,
  OpenFileDialogResponse
> {
  channel = IPC_CHANNELS.DIALOG_OPEN_FILE;
  requestSchema = OpenFileDialogRequestSchema;
  responseSchema = OpenFileDialogResponseSchema;

  async handle(
    event: IpcMainInvokeEvent,
    request: OpenFileDialogRequest
  ): Promise<OpenFileDialogResponse> {
    try {
      const window = BrowserWindow.fromWebContents(event.sender);

      if (!window || window.isDestroyed()) {
        log.error('Invalid or destroyed window context for open file dialog');
        return {
          canceled: true,
          filePaths: [],
        };
      }

      const result = await dialog.showOpenDialog(window, {
        title: request.title,
        defaultPath: request.defaultPath,
        buttonLabel: request.buttonLabel,
        filters: request.filters,
        properties: request.properties as ('openFile' | 'openDirectory' | 'multiSelections' | 'showHiddenFiles')[],
      });

      log.debug(`Open file dialog result: ${result.canceled ? 'canceled' : result.filePaths.join(', ')}`);

      return {
        canceled: result.canceled,
        filePaths: result.filePaths,
      };
    } catch (error) {
      log.error('Open file dialog error:', error);
      return {
        canceled: true,
        filePaths: [],
      };
    }
  }
}

/**
 * Handler for save file dialog
 */
export class SaveFileDialogHandler extends BaseChannelHandler<
  SaveFileDialogRequest,
  SaveFileDialogResponse
> {
  channel = IPC_CHANNELS.DIALOG_SAVE_FILE;
  requestSchema = SaveFileDialogRequestSchema;
  responseSchema = SaveFileDialogResponseSchema;

  async handle(
    event: IpcMainInvokeEvent,
    request: SaveFileDialogRequest
  ): Promise<SaveFileDialogResponse> {
    try {
      const window = BrowserWindow.fromWebContents(event.sender);

      if (!window || window.isDestroyed()) {
        log.error('Invalid or destroyed window context for save file dialog');
        return {
          canceled: true,
          filePath: undefined,
        };
      }

      const result = await dialog.showSaveDialog(window, {
        title: request.title,
        defaultPath: request.defaultPath,
        buttonLabel: request.buttonLabel,
        filters: request.filters,
        properties: request.properties as ('showHiddenFiles' | 'createDirectory' | 'showOverwriteConfirmation')[],
      });

      log.debug(`Save file dialog result: ${result.canceled ? 'canceled' : result.filePath}`);

      return {
        canceled: result.canceled,
        filePath: result.filePath,
      };
    } catch (error) {
      log.error('Save file dialog error:', error);
      return {
        canceled: true,
        filePath: undefined,
      };
    }
  }
}

/**
 * Handler for message box dialog
 */
export class MessageBoxDialogHandler extends BaseChannelHandler<
  MessageBoxRequest,
  MessageBoxResponse
> {
  channel = IPC_CHANNELS.DIALOG_MESSAGE_BOX;
  requestSchema = MessageBoxRequestSchema;
  responseSchema = MessageBoxResponseSchema;

  async handle(
    event: IpcMainInvokeEvent,
    request: MessageBoxRequest
  ): Promise<MessageBoxResponse> {
    try {
      const window = BrowserWindow.fromWebContents(event.sender);

      if (!window || window.isDestroyed()) {
        log.error('Invalid or destroyed window context for message box dialog');
        return {
          response: -1,
          checkboxChecked: false,
        };
      }

      const result = await dialog.showMessageBox(window, {
        type: request.type,
        title: request.title,
        message: request.message,
        detail: request.detail,
        buttons: request.buttons,
        defaultId: request.defaultId,
        cancelId: request.cancelId,
      });

      log.debug(`Message box dialog result: button ${result.response} clicked`);

      return {
        response: result.response,
        checkboxChecked: result.checkboxChecked,
      };
    } catch (error) {
      log.error('Message box dialog error:', error);
      return {
        response: -1,
        checkboxChecked: false,
      };
    }
  }
}
