import { describe, it, expect } from 'vitest';
import {
  FileReadRequestSchema,
  SystemInfoSchema,
  validate,
  safeValidate,
} from '@miskatonic/shared';

describe('IPC Type Validation', () => {
  describe('FileReadRequestSchema', () => {
    it('validates correct file read request', () => {
      const request = {
        path: 'test.txt',
        encoding: 'utf-8' as const,
      };

      const result = FileReadRequestSchema.parse(request);
      expect(result).toEqual(request);
    });

    it('rejects invalid encoding', () => {
      const request = {
        path: 'test.txt',
        encoding: 'invalid',
      };

      expect(() => FileReadRequestSchema.parse(request)).toThrow();
    });

    it('uses default encoding', () => {
      const request = {
        path: 'test.txt',
      };

      const result = FileReadRequestSchema.parse(request);
      expect(result.encoding).toBe('utf-8');
    });
  });

  describe('SystemInfoSchema', () => {
    it('validates system info', () => {
      const info = {
        platform: 'darwin' as const,
        arch: 'x64',
        version: '10.15.7',
        memory: {
          total: 16000000000,
          free: 8000000000,
        },
      };

      const result = SystemInfoSchema.parse(info);
      expect(result).toEqual(info);
    });

    it('rejects invalid platform', () => {
      const info = {
        platform: 'invalid',
        arch: 'x64',
        version: '10.15.7',
        memory: {
          total: 16000000000,
          free: 8000000000,
        },
      };

      expect(() => SystemInfoSchema.parse(info)).toThrow();
    });
  });

  describe('validate helper', () => {
    it('validates correct data', () => {
      const data = { path: 'test.txt' };
      const result = validate(FileReadRequestSchema, data);
      expect(result.path).toBe('test.txt');
      expect(result.encoding).toBe('utf-8');
    });

    it('throws MiskatonicError on validation failure', () => {
      const data = { path: 'test.txt', encoding: 'invalid' };
      expect(() => validate(FileReadRequestSchema, data)).toThrow();
    });
  });

  describe('safeValidate helper', () => {
    it('returns data on success', () => {
      const data = { path: 'test.txt' };
      const result = safeValidate(FileReadRequestSchema, data);
      expect(result).not.toBeNull();
      expect(result?.path).toBe('test.txt');
    });

    it('returns null on failure', () => {
      const data = { path: 'test.txt', encoding: 'invalid' };
      const result = safeValidate(FileReadRequestSchema, data);
      expect(result).toBeNull();
    });
  });
});
