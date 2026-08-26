export interface CacheAdapter {
  get<T>(key: string): Promise<T | undefined> | T | undefined;
  set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> | void;
}

export class MemoryCacheAdapter implements CacheAdapter {
  private cache = new Map<string, { value: any; expiry: number | null }>();
  private maxSize: number;

  constructor(maxSize = 1000) {
    this.maxSize = maxSize;
  }

  get<T>(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;

    if (entry.expiry !== null && Date.now() > entry.expiry) {
      this.cache.delete(key);
      return undefined;
    }

    return entry.value as T;
  }

  set<T>(key: string, value: T, ttlSeconds?: number): void {
    if (this.cache.size >= this.maxSize) {
      // Very simple LRU eviction (deletes first inserted key, Maps preserve insertion order)
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }

    this.cache.set(key, {
      value,
      expiry: ttlSeconds ? Date.now() + ttlSeconds * 1000 : null
    });
  }
}

export class CacheService {
  constructor(private adapter: CacheAdapter = new MemoryCacheAdapter()) {}

  async getOrSet<T>(key: string, fn: () => Promise<T>, ttlSeconds?: number): Promise<T> {
    const cached = await this.adapter.get<T>(key);
    if (cached !== undefined) {
      return cached;
    }

    const value = await fn();
    await this.adapter.set(key, value, ttlSeconds);
    return value;
  }
}
