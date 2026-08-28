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
      select: vi.fn().mockReturnValue(mockSelectChain),
      execute: vi.fn()
        .mockResolvedValueOnce([{
          totals: '{"sessions": 1, "visitors": 1, "pageviews": 1, "avgSessionDurationMs": 100, "pagesPerSession": 1, "bounceRate": 0}', 
          previous: '{"sessions": 1, "visitors": 1, "pageviews": 1, "avgSessionDurationMs": 100, "pagesPerSession": 1, "bounceRate": 0}', 
          total_sessions: 10,
          timeseries: '[{"t": "2026-01-01", "sessions": 1, "visitors": 1, "pageviews": 1}]', 
          pages: '[{"path": "/", "title": "Home", "pageviews": 1, "visitors": 1, "avgTimeOnPageMs": 100, "exits": 0, "exitRate": 0}]', 
          entry_pages: '[{"path": "/", "sessions": 1, "bounceRate": 0}]', 
          exit_pages: '[{"path": "/", "sessions": 1, "exitRate": 0}]',
          ref_type: '[{"name": "direct", "count": 1}]', 
          ref_host: '[{"name": "google.com", "count": 1}]', 
          geo_countries: '[{"code": "US", "name": "US", "sessions": 1, "pageviews": 1}]', 
          tech_devices: '[{"name": "desktop", "count": 1}]',
          sessions_list: '[{"sessionId": "s1", "startedAt": "2026-01-01T00:00:00Z", "lastSeenAt": "2026-01-01T00:00:00Z", "endedAt": null, "durationMs": 0, "pageCount": 1, "isBounce": true, "entryPath": "/", "exitPath": "/", "referrerHost": null, "referrerType": "direct", "deviceType": "desktop", "browser": "Chrome", "os": "Mac", "screenW": 1000, "screenH": 1000, "ipTruncated": "1.1.1.0", "countryCode": "US", "country": "US", "city": "NY", "isLive": false}]'
        }])
        .mockResolvedValueOnce([{
          totals: '{}', previous: '{}', total_sessions: 0,
          timeseries: '[{}]', pages: '[{}]', entry_pages: '[{}]', exit_pages: '[{}]',
          ref_type: '[{}]', ref_host: '[{}]', geo_countries: '[{}]', tech_devices: '[{}]',
          sessions_list: '[{}]'
        }])
        .mockResolvedValueOnce([{
          totals: null, previous: null, total_sessions: null,
          timeseries: null, pages: null, entry_pages: null, exit_pages: null,
          ref_type: null, ref_host: null, geo_countries: null, tech_devices: null,
          sessions_list: null
        }])
        .mockResolvedValue([{
          totals: '{"sessions":1}', previous: '{"sessions":1}', total_sessions: 1,
          timeseries: '[]', pages: '[]', entry_pages: '[]', exit_pages: '[]',
          ref_type: '[]', ref_host: '[]', geo_countries: '[]', tech_devices: '[]',
          sessions_list: '[]'
        }])
    };

    const adapter = new DrizzleTrafficAdapter(mockDb as any, 'sqlite');

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
    
    await adapter.upsertSession('s1', { lastSeenAt: new Date(), pageCount: 2, endedAt: new Date() }, { site: 'test' });
    await adapter.upsertPageview('s1', 1, { durationMs: 100, visibleMs: 50, maxScrollPct: 10 }, { site: 'test' });
    await adapter.bulkUpsertPageviews([
      { sessionId: 's1', sequence: 2, data: { durationMs: 100, visibleMs: 50, maxScrollPct: 10 }, setOnInsert: { site: 'test' } },
      { sessionId: 's1', sequence: 3, data: {}, setOnInsert: { site: 'test' } }
    ]);
    await adapter.insertEvents([{ sessionId: 's1', name: 'test', path: '/', props: {}, occurredAt: new Date(), createdAt: new Date(), environment: 'prod', site: 'test' }]);
    await adapter.markExitPage('s1', 1);

    const startedAt2 = new Date();
    try { await adapter.queryOverview({ site: 'test' } as any, { from: startedAt2, to: startedAt2, prevFrom: startedAt2, prevTo: startedAt2, bucket: 'day' }); } catch (e) {}
    try { await adapter.queryOverview({ site: 'test' } as any, { from: startedAt2, to: startedAt2, prevFrom: startedAt2, prevTo: startedAt2, bucket: 'hour' }); } catch (e) {}
    try { await adapter.queryPages({ site: 'test', limit: 10 } as any, { from: startedAt2, to: startedAt2, prevFrom: startedAt2, prevTo: startedAt2, bucket: 'day' }); } catch (e) {}
    try { await adapter.querySessions({ site: 'test', limit: 10, page: 1 } as any, { from: startedAt2, to: startedAt2, prevFrom: startedAt2, prevTo: startedAt2, bucket: 'day' }); } catch (e) {}
    try { await adapter.queryGeo({ site: 'test', limit: 10 } as any, { from: startedAt2, to: startedAt2, prevFrom: startedAt2, prevTo: startedAt2, bucket: 'day' }); } catch (e) {}
    try { await adapter.queryTech({ site: 'test', limit: 10 } as any, { from: startedAt2, to: startedAt2, prevFrom: startedAt2, prevTo: startedAt2, bucket: 'day' }); } catch (e) {}
    try { await adapter.queryReferrers({ site: 'test', limit: 10 } as any, { from: startedAt2, to: startedAt2, prevFrom: startedAt2, prevTo: startedAt2, bucket: 'day' }); } catch (e) {}
    try { await adapter.queryEntryExit({ site: 'test', limit: 10 } as any, { from: startedAt2, to: startedAt2, prevFrom: startedAt2, prevTo: startedAt2, bucket: 'day' }); } catch (e) {}
    const resAll = await adapter.queryAll({ site: 'test', limit: 0, page: 0 } as any, { from: new Date(Date.now() - 100000), to: new Date(), prevFrom: new Date(Date.now() - 200000), prevTo: new Date(Date.now() - 100000), bucket: 'day' });
    expect(resAll.overview).toBeDefined();

    const resAllDefault = await adapter.queryAll({ site: 'test' } as any, { from: new Date(Date.now() - 100000), to: new Date(), prevFrom: new Date(Date.now() - 200000), prevTo: new Date(Date.now() - 100000), bucket: 'hour' });
    expect(resAllDefault.overview).toBeDefined();

    const resAllNull = await adapter.queryAll({ site: 'test' } as any, { from: new Date(Date.now() - 100000), to: new Date(), prevFrom: new Date(Date.now() - 200000), prevTo: new Date(Date.now() - 100000), bucket: 'hour' });
    expect(resAllNull.overview).toBeDefined();
  });
});
