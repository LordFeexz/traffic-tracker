import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MemoryCacheAdapter, CacheService } from '../../src/core/cache';

describe('MemoryCacheAdapter', () => {
  it('returns undefined for missing key', () => {
    const c = new MemoryCacheAdapter();
    expect(c.get('nonexistent')).toBeUndefined();
  });

  it('stores and retrieves a value', () => {
    const c = new MemoryCacheAdapter();
    c.set('foo', 'bar');
    expect(c.get('foo')).toBe('bar');
  });

  it('expires entries after TTL', () => {
    vi.useFakeTimers();
    const c = new MemoryCacheAdapter();
    c.set('exp', 42, 1); // 1 second TTL
    expect(c.get('exp')).toBe(42);

    vi.advanceTimersByTime(1500);
    expect(c.get('exp')).toBeUndefined();
    vi.useRealTimers();
  });

  it('evicts oldest entry when maxSize is reached', () => {
    const c = new MemoryCacheAdapter(2);
    c.set('a', 1);
    c.set('b', 2);
    c.set('c', 3); // Should evict 'a'

    expect(c.get('a')).toBeUndefined();
    expect(c.get('b')).toBe(2);
    expect(c.get('c')).toBe(3);
  });
});

describe('CacheService', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('fetches and caches via getOrSet', async () => {
    const adapter = new MemoryCacheAdapter();
    const svc = new CacheService(adapter);
    const fetcher = vi.fn().mockResolvedValue('value');

    const r1 = await svc.getOrSet('k', fetcher, 60);
    const r2 = await svc.getOrSet('k', fetcher, 60);

    expect(r1).toBe('value');
    expect(r2).toBe('value');
    expect(fetcher).toHaveBeenCalledTimes(1); // Second call uses cache
  });
});
