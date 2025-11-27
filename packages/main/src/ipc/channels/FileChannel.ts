import { IpcMainInvokeEvent, app } from 'electron';
import { promises as fs, createReadStream, createWriteStream } from 'fs';
import path from 'path';
import { BaseChannelHandler } from '../types';
import { IPC_CHANNELS } from '@miskatonic/shared';
import {
  FileReadRequest,
  FileReadRequestSchema,
  FileReadResponse,
  FileReadResponseSchema,
  FileWriteRequest,
  FileWriteRequestSchema,
  FileWriteResponse,
  FileWriteResponseSchema,
  FileReadArbitraryRequest,
  FileReadArbitraryRequestSchema,
  FileReadArbitraryResponse,
  FileReadArbitraryResponseSchema,
} from '@miskatonic/shared';
import { MiskatonicError, ErrorCode } from '@miskatonic/shared';
import log from 'electron-log';

// File size threshold for using streaming (5MB)
const STREAMING_THRESHOLD = 5 * 1024 * 1024;

/**
 * Handler for file read operations
 */
export class FileReadHandler extends BaseChannelHandler<FileReadRequest, FileReadResponse> {
  channel = IPC_CHANNELS.FILE_READ;
  requestSchema = FileReadRequestSchema;
  responseSchema = FileReadResponseSchema;

  async handle(_event: IpcMainInvokeEvent, request: FileReadRequest): Promise<FileReadResponse> {
    try {
      // Resolve path relative to userData directory for security
      const userDataPath = path.resolve(app.getPath('userData'));
      const requestedPath = path.normalize(request.path).replace(/^(\.\.(\/|\\|$))+/, '');
      const fullPath = path.resolve(path.join(userDataPath, requestedPath));

      // Prevent directory traversal with robust checks
      // 1. Normalize and resolve all paths
      // 2. Check canonical path starts with userDataPath
      // 3. Verify no symlinks escape the sandbox
      if (!fullPath.startsWith(userDataPath)) {
        throw new MiskatonicError(
          ErrorCode.FILE_ACCESS_DENIED,
          'Path must be within user data directory'
        );
      }

      // Check if path is a symlink and resolve it
      const stats = await fs.lstat(fullPath).catch(() => null);
      if (stats?.isSymbolicLink()) {
        const realPath = await fs.realpath(fullPath);
        if (!realPath.startsWith(userDataPath)) {
          throw new MiskatonicError(
            ErrorCode.FILE_ACCESS_DENIED,
            'Symlinks outside user data directory are not allowed'
          );
        }
      }

      // Check file size to determine if we should use streaming
      const fileStats = await fs.stat(fullPath);
      let data: string;

      if (fileStats.size > STREAMING_THRESHOLD) {
        // Use streaming for large files to avoid blocking
        log.debug(`Streaming large file (${fileStats.size} bytes): ${request.path}`);
        data = await this.readFileStreaming(fullPath, request.encoding);
      } else {
        // Use regular read for small files
        data = await fs.readFile(fullPath, request.encoding);
      }

      log.debug(`Read file: ${request.path} (${fileStats.size} bytes)`);

      return {
        success: true,
        data,
      };
    } catch (error) {
      if (error instanceof MiskatonicError) {
        throw error;
      }

      const nodeError = error as NodeJS.ErrnoException;
      if (nodeError.code === 'ENOENT') {
        return {
          success: false,
          error: 'File not found',
        };
      }

      log.error('File read error:', error);
      return {
        success: false,
        error: String(error),
      };
    }
  }

  /**
   * Read file using streams for large files
   */
  private async readFileStreaming(
    filePath: string,
    encoding: BufferEncoding
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      const stream = createReadStream(filePath, { encoding });

      stream.on('data', (chunk: string | Buffer) => {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, encoding));
      });

      stream.on('end', () => {
        resolve(Buffer.concat(chunks).toString(encoding));
      });

      stream.on('error', (error) => {
        reject(error);
      });
    });
  }
}

/**
 * Handler for file write operations
 */
export class FileWriteHandler extends BaseChannelHandler<FileWriteRequest, FileWriteResponse> {
  channel = IPC_CHANNELS.FILE_WRITE;
  requestSchema = FileWriteRequestSchema;
  responseSchema = FileWriteResponseSchema;

  async handle(_event: IpcMainInvokeEvent, request: FileWriteRequest): Promise<FileWriteResponse> {
    try {
      const userDataPath = path.resolve(app.getPath('userData'));
      const requestedPath = path.normalize(request.path).replace(/^(\.\.(\/|\\|$))+/, '');
      const fullPath = path.resolve(path.join(userDataPath, requestedPath));

      // Prevent directory traversal with robust checks
      if (!fullPath.startsWith(userDataPath)) {
        throw new MiskatonicError(
          ErrorCode.FILE_ACCESS_DENIED,
          'Path must be within user data directory'
        );
      }

      // Check if parent directory is a symlink
      const parentDir = path.dirname(fullPath);
      const parentStats = await fs.lstat(parentDir).catch(() => null);
      if (parentStats?.isSymbolicLink()) {
        const realParent = await fs.realpath(parentDir);
        if (!realParent.startsWith(userDataPath)) {
          throw new MiskatonicError(
            ErrorCode.FILE_ACCESS_DENIED,
            'Cannot write to paths with symlinks outside user data directory'
          );
        }
      }

      // Ensure directory exists
      await fs.mkdir(path.dirname(fullPath), { recursive: true });

      // Check data size to determine if we should use streaming
      const dataSize = Buffer.byteLength(request.data, 'utf-8');

      if (dataSize > STREAMING_THRESHOLD) {
        // Use streaming for large files to avoid blocking
        log.debug(`Streaming write for large file (${dataSize} bytes): ${request.path}`);
        await this.writeFileStreaming(fullPath, request.data);
      } else {
        // Use regular write for small files
        await fs.writeFile(fullPath, request.data, 'utf-8');
      }

      log.debug(`Wrote file: ${request.path} (${dataSize} bytes)`);

      return { success: true };
    } catch (error) {
      log.error('File write error:', error);
      return {
        success: false,
        error: String(error),
      };
    }
  }

  /**
   * Write file using streams for large files
   */
  private async writeFileStreaming(filePath: string, data: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const stream = createWriteStream(filePath, { encoding: 'utf-8' });

      stream.on('finish', () => {
        resolve();
      });

      stream.on('error', (error) => {
        reject(error);
      });

      stream.write(data);
      stream.end();
    });
  }
}

/**
 * Handler for reading arbitrary files (outside sandbox)
 * Used for user-selected files via file dialog
 */
export class FileReadArbitraryHandler extends BaseChannelHandler<
  FileReadArbitraryRequest,
  FileReadArbitraryResponse
> {
  channel = IPC_CHANNELS.FILE_READ_ARBITRARY;
  requestSchema = FileReadArbitraryRequestSchema;
  responseSchema = FileReadArbitraryResponseSchema;

  async handle(
    _event: IpcMainInvokeEvent,
    request: FileReadArbitraryRequest
  ): Promise<FileReadArbitraryResponse> {
    try {
      // Read file from absolute path (user-selected via dialog)
      // No sandboxing - trust that user selected this file
      const fullPath = path.resolve(request.path);

      // Check if file exists
      const stats = await fs.stat(fullPath).catch(() => null);
      if (!stats) {
        return {
          success: false,
          error: 'File not found',
        };
      }

      let data: string;

      if (request.encoding === 'base64') {
        // Read as buffer and convert to base64
        const buffer = await fs.readFile(fullPath);
        data = buffer.toString('base64');
      } else {
        // Read as text
        data = await fs.readFile(fullPath, 'utf-8');
      }

      log.debug(`Read arbitrary file: ${request.path} (${stats.size} bytes, ${request.encoding})`);

      return {
        success: true,
        data,
      };
    } catch (error) {
      log.error('Arbitrary file read error:', error);
      return {
        success: false,
        error: String(error),
      };
    }
  }
}
