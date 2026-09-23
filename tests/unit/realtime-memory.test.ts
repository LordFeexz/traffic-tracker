import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryRealtimeAdapter, createMemoryRealtimeAdapter } from '../../src/realtime/memory';

describe('MemoryRealtimeAdapter', () => {
  let adapter: MemoryRealtimeAdapter;

  beforeEach(() => {
    adapter = new MemoryRealtimeAdapter({ sessionTtlMs: 60_000, sparklineMinutes: 5 });
  });

  it('records pageviews and session starts with explicit dates', async () => {
    const now = new Date('2026-09-23T10:00:00Z');
    await adapter.recordSessionStart('test-site', now);
    await adapter.recordSessionStart('test-site', now); // second session start on same day
    await adapter.recordPageview('test-site', now);
    await adapter.recordPageview('test-site', now); // second pv on same minute

    const snap = await adapter.snapshot('test-site', now);
    expect(snap.today.sessions).toBe(2);
    expect(snap.today.pageviews).toBe(2);
    expect(snap.pageviewsPerMinute[4]).toBe(2);
  });

  it('records pageviews and session starts with default dates', async () => {
    const defaultSite = 'default-site';
    await adapter.recordSessionStart(defaultSite);
    await adapter.recordPageview(defaultSite);

    const snap = await adapter.snapshot(defaultSite);
    expect(snap.today.sessions).toBe(1);
    expect(snap.today.pageviews).toBe(1);
    expect(snap.pageviewsPerMinute[4]).toBe(1);
  });

  it('touches, aggregates, updates and purges expired live visitors', async () => {
    const now = new Date('2026-09-23T10:00:00Z');
    await adapter.touch(
      'test-site',
      's-1',
      { path: '/home', title: 'Home', deviceType: 'mobile', referrerType: 'direct' },
      now
    );
    // Update existing s-1
    await adapter.touch(
      'test-site',
      's-1',
      { path: '/jobs' },
      now
    );
    // Add second session s-2 with default date
    await adapter.touch('test-site', 's-2', { path: '/about' });

    let snap = await adapter.snapshot('test-site', now);
    expect(snap.activeVisitors).toBeGreaterThanOrEqual(1);

    const ids = await adapter.liveSessionIds('test-site', now);
    expect(ids.has('s-1')).toBe(true);

    // After 70s, s-1 expires
    const future = new Date(now.getTime() + 70_000);
    snap = await adapter.snapshot('test-site', future);
    expect(snap.visitors.some(v => v.path === '/jobs')).toBe(false);

    const futureIds = await adapter.liveSessionIds('test-site', future);
    expect(futureIds.has('s-1')).toBe(false);
  });

  it('removes session on remove()', async () => {
    const now = new Date();
    await adapter.touch('test-site', 's-1', { path: '/home' }, now);
    await adapter.remove('test-site', 's-1');
    await adapter.remove('non-existent-site', 's-1');

    const snap = await adapter.snapshot('test-site', now);
    expect(snap.activeVisitors).toBe(0);
  });

  it('handles empty/non-existent sites in snapshot and liveSessionIds', async () => {
    const emptySnap = await adapter.snapshot('unknown-site');
    expect(emptySnap.activeVisitors).toBe(0);
    expect(emptySnap.visitors).toEqual([]);
    expect(emptySnap.today).toEqual({ pageviews: 0, sessions: 0 });

    const emptyIds = await adapter.liveSessionIds('unknown-site');
    expect(emptyIds.size).toBe(0);
  });

  it('initializes with default options via factory function', () => {
    const defaultAdapter = createMemoryRealtimeAdapter();
    expect(defaultAdapter).toBeInstanceOf(MemoryRealtimeAdapter);
  });
});
