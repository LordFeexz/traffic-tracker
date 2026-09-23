import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RedisRealtimeAdapter, createRedisRealtimeAdapter, type MinimalRedisClient } from '../../src/realtime/redis';

describe('RedisRealtimeAdapter', () => {
  let mockRedis: MinimalRedisClient;
  let adapter: RedisRealtimeAdapter;
  let errors: Array<{ error: unknown; action: string }>;

  beforeEach(() => {
    errors = [];
    mockRedis = {
      zadd: vi.fn(async () => 1),
      zrem: vi.fn(async () => 1),
      zrangebyscore: vi.fn(async () => ['s-1']),
      zremrangebyscore: vi.fn(async () => 1),
      hset: vi.fn(async () => 1),
      hget: vi.fn(async () => JSON.stringify({ path: '/old', title: 'Old' })),
      hmget: vi.fn(async () => [JSON.stringify({ path: '/home', deviceType: 'mobile' }), null, 'invalid-json']),
      hdel: vi.fn(async () => 1),
      hgetall: vi.fn(async () => ({ pageviews: '10', sessions: '4' })),
      incr: vi.fn(async () => 1),
      hincrby: vi.fn(async () => 1),
      expire: vi.fn(async () => 1),
      mget: vi.fn(async () => ['1', '2', '3'])
    };

    adapter = new RedisRealtimeAdapter(mockRedis, {
      sparklineMinutes: 3,
      onError: (error, action) => errors.push({ error, action })
    });
  });

  it('handles touch, remove, pageview, and session_start with default and explicit dates', async () => {
    const now = new Date('2026-09-23T10:00:00Z');
    await adapter.touch('site-a', 's-1', { path: '/new' }, now);
    expect(mockRedis.zadd).toHaveBeenCalled();
    expect(mockRedis.hset).toHaveBeenCalled();

    await adapter.touch('site-a', 's-2', { path: '/default-date' }); // default date

    await adapter.recordPageview('site-a', now);
    expect(mockRedis.incr).toHaveBeenCalled();
    await adapter.recordPageview('site-a'); // default date

    await adapter.recordSessionStart('site-a', now);
    expect(mockRedis.hincrby).toHaveBeenCalled();
    await adapter.recordSessionStart('site-a'); // default date

    await adapter.remove('site-a', 's-1');
    expect(mockRedis.zrem).toHaveBeenCalled();
    expect(mockRedis.hdel).toHaveBeenCalled();
  });

  it('handles touch with corrupted or missing existing JSON in redis', async () => {
    (mockRedis.hget as any).mockResolvedValueOnce('corrupted-json');
    await adapter.touch('site-a', 's-1', { path: '/corrupt-test' });
    expect(mockRedis.hset).toHaveBeenCalled();

    (mockRedis.hget as any).mockResolvedValueOnce(null);
    await adapter.touch('site-a', 's-1', { path: '/null-test' });
    expect(mockRedis.hset).toHaveBeenCalled();
  });

  it('generates snapshots accurately including stale purge', async () => {
    const now = new Date('2026-09-23T10:00:00Z');
    const snap = await adapter.snapshot('site-a', now);

    expect(snap.activeVisitors).toBe(1);
    expect(snap.visitors[0].path).toBe('/home');
    expect(snap.today.pageviews).toBe(10);
    expect(snap.today.sessions).toBe(4);
    expect(snap.pageviewsPerMinute).toEqual([1, 2, 3]);
    expect(mockRedis.zremrangebyscore).toHaveBeenCalled();
  });

  it('handles snapshot when no stale visitors exist and no live visitors exist', async () => {
    (mockRedis.zrangebyscore as any).mockResolvedValue([]);
    (mockRedis.hgetall as any).mockResolvedValue(null);
    (mockRedis.mget as any).mockResolvedValue([]);

    const snap = await adapter.snapshot('site-a');
    expect(snap.activeVisitors).toBe(0);
    expect(snap.visitors).toEqual([]);
    expect(snap.today).toEqual({ pageviews: 0, sessions: 0 });
  });

  it('fetches liveSessionIds accurately', async () => {
    (mockRedis.zrangebyscore as any).mockResolvedValue(['s-1', 's-2']);
    const ids = await adapter.liveSessionIds('site-a');
    expect(ids.has('s-1')).toBe(true);
    expect(ids.has('s-2')).toBe(true);
  });

  it('supports client factory function returning client or Promise', async () => {
    const syncFactoryAdapter = new RedisRealtimeAdapter(() => mockRedis);
    await syncFactoryAdapter.touch('site-a', 's-1', { path: '/p' });
    expect(mockRedis.hset).toHaveBeenCalled();

    const asyncFactoryAdapter = new RedisRealtimeAdapter(async () => mockRedis);
    await asyncFactoryAdapter.touch('site-a', 's-1', { path: '/p' });
    expect(mockRedis.hset).toHaveBeenCalled();
  });

  it('handles client factory returning null or erroring gracefully', async () => {
    const nullAdapter = new RedisRealtimeAdapter(() => null, {
      onError: (err, act) => errors.push({ error: err, action: act })
    });
    await nullAdapter.touch('site-a', 's-1', { path: '/p' });
    await nullAdapter.remove('site-a', 's-1');
    await nullAdapter.recordPageview('site-a');
    await nullAdapter.recordSessionStart('site-a');
    const snap = await nullAdapter.snapshot('site-a');
    const ids = await nullAdapter.liveSessionIds('site-a');
    expect(snap.activeVisitors).toBe(0);
    expect(ids.size).toBe(0);

    const throwingAdapter = new RedisRealtimeAdapter(() => {
      throw new Error('Redis connection failure');
    }, {
      onError: (err, act) => errors.push({ error: err, action: act })
    });
    await throwingAdapter.touch('site-a', 's-1', { path: '/p' });
    expect(errors.some(e => e.action === 'getClient')).toBe(true);
  });

  it('catches and reports redis operation errors via onError without throwing', async () => {
    (mockRedis.zadd as any).mockRejectedValueOnce(new Error('zadd failed'));
    await adapter.touch('site-a', 's-1', { path: '/p' });
    expect(errors.some(e => e.action === 'touch')).toBe(true);

    (mockRedis.zrem as any).mockRejectedValueOnce(new Error('zrem failed'));
    await adapter.remove('site-a', 's-1');
    expect(errors.some(e => e.action === 'remove')).toBe(true);

    (mockRedis.incr as any).mockRejectedValueOnce(new Error('incr failed'));
    await adapter.recordPageview('site-a');
    expect(errors.some(e => e.action === 'recordPageview')).toBe(true);

    (mockRedis.hincrby as any).mockRejectedValueOnce(new Error('hincrby failed'));
    await adapter.recordSessionStart('site-a');
    expect(errors.some(e => e.action === 'recordSessionStart')).toBe(true);

    (mockRedis.zrangebyscore as any).mockRejectedValueOnce(new Error('snapshot failed'));
    const snap = await adapter.snapshot('site-a');
    expect(snap.activeVisitors).toBe(0);
    expect(errors.some(e => e.action === 'snapshot')).toBe(true);

    (mockRedis.zrangebyscore as any).mockRejectedValueOnce(new Error('liveSessionIds failed'));
    const ids = await adapter.liveSessionIds('site-a');
    expect(ids.size).toBe(0);
    expect(errors.some(e => e.action === 'liveSessionIds')).toBe(true);
  });

  it('creates adapter via factory with default options', () => {
    const ad = createRedisRealtimeAdapter(mockRedis);
    expect(ad).toBeInstanceOf(RedisRealtimeAdapter);
  });
});
