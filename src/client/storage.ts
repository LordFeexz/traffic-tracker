export class LocalStorage {
  private memory = new Map<string, string>();

  get(key: string): string | null {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        return window.localStorage.getItem(key);
      }
    } catch {
      // Third-party cookie blocking throws here in Safari/Firefox
    }
    return this.memory.get(key) || null;
  }

  set(key: string, value: string): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(key, value);
        return;
      }
    } catch {
      // Ignore
    }
    this.memory.set(key, value);
  }

  remove(key: string): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(key);
      }
    } catch {
      // Ignore
    }
    this.memory.delete(key);
  }
}
