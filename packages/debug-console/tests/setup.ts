/**
 * Vitest setup file for debug-console tests
 * Ensures localStorage is available in jsdom environment
 */

// jsdom doesn't always provide localStorage by default in all versions
// Manually ensure it's available with an in-memory implementation
if (typeof globalThis.localStorage === 'undefined') {
  const storage = new Map<string, string>();

  // @ts-expect-error - Mocking browser localStorage
  globalThis.localStorage = {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
    clear: () => storage.clear(),
    get length() {
      return storage.size;
    },
    key: (index: number) => {
      const keys = Array.from(storage.keys());
      return keys[index] ?? null;
    },
  };
}
