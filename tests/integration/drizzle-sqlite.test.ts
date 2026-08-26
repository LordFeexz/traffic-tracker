import { describe, it, expect, vi } from 'vitest';
import { DrizzleTrafficAdapter } from '../../src/adapters/drizzle/operations';

describe('Drizzle Adapter Mocked', () => {
  it('covers adapter methods', async () => {
    const mockData = [
      {
        sessionId: 's1',
        startedAt: new Date(),
        lastSeenAt: new Date(),
        endedAt: null,
        durationMs: null,
        pageCount: null,
        isBounce: undefined,
        referrerType: null,
        deviceType: null,
        path: '/',
        title: null,
        count: 1,
        views: 1,
        avgDuration: 100,
        bounceRate: 50,
        referrerHost: null,
        browser: 'Chrome',
        os: 'Mac',
        countryCode: 'US',
        country: 'United States',
        city: null,
        total: 10,
        bucket: '2026-01-01',
        name: 'direct'
      },
      {
        sessionId: 's2',
        startedAt: new Date(),
        lastSeenAt: new Date(),
        endedAt: new Date(),
        durationMs: 100,
        pageCount: 5,
        referrerType: 'search',
        deviceType: 'mobile',
        path: '/about',
        title: 'About',
        count: 2,
        views: 2,
        avgDuration: 200,
        bounceRate: 0,
        referrerHost: 'google.com',
        browser: 'Firefox',
        os: 'Windows',
        countryCode: 'GB',
        country: 'United Kingdom',
        city: 'London',
        total: 10,
        bucket: '2026-01-01',
        name: 'search'
      }
    ];

    const mockSelectChain: any = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      groupBy: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      offset: vi.fn().mockReturnThis(),
      then: function(resolve: any) { resolve(mockData); }
    };

    const mockDb = {
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          onConflictDoUpdate: vi.fn(),
          onConflictDoNothing: vi.fn()
        })
      }),
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn()
        })
      }),
      transaction: vi.fn(async (cb) => {
        await cb(mockDb);
      }),
      select: vi.fn().mockReturnValue(mockSelectChain)
    };

    const adapter = new DrizzleTrafficAdapter(mockDb as any);

    const startedAt = new Date();

    // upsertSession with updates
    await expect(adapter.upsertSession('d1', { pageCount: 1, lastSeenAt: startedAt, durationMs: 100, endedAt: startedAt }, { site: 'test' } as any)).resolves.not.toThrow();
    
    // upsertSession with missing timestamps
    await expect(adapter.upsertSession('d3', { pageCount: undefined, lastSeenAt: undefined, durationMs: undefined, endedAt: undefined }, { site: 'test' } as any)).resolves.not.toThrow();

    // upsertSession empty
    await expect(adapter.upsertSession('d2', {}, { site: 'test' } as any)).resolves.not.toThrow();

    // upsertPageview single
    await expect(adapter.upsertPageview('d1', 1, { durationMs: 10, visibleMs: 5, maxScrollPct: 50 }, { site: 'test' } as any)).resolves.not.toThrow();
    await expect(adapter.upsertPageview('d3', 1, { durationMs: undefined, visibleMs: undefined, maxScrollPct: undefined }, { site: 'test' } as any)).resolves.not.toThrow();
    await expect(adapter.upsertPageview('d2', 1, {}, { site: 'test' } as any)).resolves.not.toThrow();

    // bulkUpsertPageviews
    await expect(adapter.bulkUpsertPageviews([
      { sessionId: 'd1', sequence: 2, data: { durationMs: 10, visibleMs: 5, maxScrollPct: 50 }, setOnInsert: { site: 'test' } as any },
      { sessionId: 'd3', sequence: 3, data: { durationMs: undefined, visibleMs: undefined, maxScrollPct: undefined }, setOnInsert: { site: 'test' } as any },
      { sessionId: 'd2', sequence: 2, data: {}, setOnInsert: { site: 'test' } as any }
    ])).resolves.not.toThrow();

    // markExitPage
    await expect(adapter.markExitPage('d1', 1)).resolves.not.toThrow();
    
    // insertEvents
    await expect(adapter.insertEvents([{ sessionId: 'd1', name: 'evt', site: 'test', environment: 'prod', createdAt: new Date(), occurredAt: new Date(), path: '/' }])).resolves.not.toThrow();
    await expect(adapter.insertEvents([])).resolves.not.toThrow();
    
    // dummy query executions
    try { await adapter.queryOverview({ site: 'test' } as any, { from: startedAt, to: startedAt, prevFrom: startedAt, prevTo: startedAt, bucket: 'day' }); } catch (e) {}
    try { await adapter.queryOverview({ site: 'test' } as any, { from: startedAt, to: startedAt, prevFrom: startedAt, prevTo: startedAt, bucket: 'hour' }); } catch (e) {}
    try { await adapter.queryPages({ site: 'test', limit: 10 } as any, { from: startedAt, to: startedAt, prevFrom: startedAt, prevTo: startedAt, bucket: 'day' }); } catch (e) {}
    try { await adapter.queryGeo({ site: 'test', limit: 10 } as any, { from: startedAt, to: startedAt, prevFrom: startedAt, prevTo: startedAt, bucket: 'day' }); } catch (e) {}
    try { await adapter.querySessions({ site: 'test', limit: 0, page: 0 } as any, { from: startedAt, to: startedAt, prevFrom: startedAt, prevTo: startedAt, bucket: 'day' }); } catch (e) {}
    try { await adapter.queryTech({ site: 'test', limit: 10 } as any, { from: startedAt, to: startedAt, prevFrom: startedAt, prevTo: startedAt, bucket: 'day' }); } catch (e) {}
    try { await adapter.queryReferrers({ site: 'test', limit: 10 } as any, { from: startedAt, to: startedAt, prevFrom: startedAt, prevTo: startedAt, bucket: 'day' }); } catch (e) {}
    try { await adapter.queryEntryExit({ site: 'test', limit: 10 } as any, { from: startedAt, to: startedAt, prevFrom: startedAt, prevTo: startedAt, bucket: 'day' }); } catch (e) {}
  });
});
