/**
 * Safe local storage utility to prevent SecurityError DOMExceptions
 * when the application is embedded in sandboxed cross-origin iframes.
 */
export const safeStorage = {
  getItem(key: string): string | null {
    try {
      return typeof window !== 'undefined' && window.localStorage ? localStorage.getItem(key) : null;
    } catch (e) {
      console.warn(`safeStorage.getItem failed for key "${key}":`, e);
      return null;
    }
  },
  setItem(key: string, value: string): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem(key, value);
      }
    } catch (e) {
      console.warn(`safeStorage.setItem failed for key "${key}":`, e);
    }
  },
  removeItem(key: string): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.removeItem(key);
      }
    } catch (e) {
      console.warn(`safeStorage.removeItem failed for key "${key}":`, e);
    }
  }
};
