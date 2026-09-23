import { describe, it, expect, vi, beforeEach } from 'vitest';
import { prismaMongoAdapter, PrismaMongoTrafficAdapter } from '../../src/adapters/prisma-mongo';
import { mongoAdapter } from '../../src/adapters/mongodb';
import { drizzleAdapter } from '../../src/adapters/drizzle';

describe('PrismaMongoTrafficAdapter', () => {
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      trafficSession: {
        upsert: vi.fn().mockResolvedValue({}),
        aggregateRaw: vi.fn().mockResolvedValue([]),
      },
      trafficPageview: {
        upsert: vi.fn().mockResolvedValue({}),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        aggregateRaw: vi.fn().mockResolvedValue([]),
      },
      trafficEvent: {
        createMany: vi.fn().mockResolvedValue({ count: 1 }),
        aggregateRaw: vi.fn().mockResolvedValue([]),
      },
      $runCommandRaw: vi.fn().mockResolvedValue({ ok: 1 }),
    };
  });

  describe('Adapters Factory Exports', () => {
    it('creates mongoAdapter instance', () => {
      const mockDb: any = { collection: vi.fn() };
      const adapter = mongoAdapter(mockDb);
      expect(adapter).toBeDefined();
    });

    it('creates drizzleAdapter instance', () => {
      const mockDrizzle: any = {};
      const adapter = drizzleAdapter(mockDrizzle, { provider: 'sqlite' });
      expect(adapter).toBeDefined();
    });
  });

  describe('Constructor & Model Names', () => {
    it('creates instance with default camelCase models', () => {
      const adapter = prismaMongoAdapter(mockPrisma);
      expect(adapter).toBeInstanceOf(PrismaMongoTrafficAdapter);
    });

    it('falls back to PascalCase models when camelCase is absent', () => {
      const pascalPrisma = {
        TrafficSession: { upsert: vi.fn() },
        TrafficPageview: { upsert: vi.fn() },
        TrafficEvent: { createMany: vi.fn() },
      };
      const adapter = prismaMongoAdapter(pascalPrisma);
      expect(adapter).toBeInstanceOf(PrismaMongoTrafficAdapter);
    });

    it('uses custom model names from options', () => {
      const customPrisma = {
        mySession: { upsert: vi.fn() },
        myPageview: { upsert: vi.fn() },
        myEvent: { createMany: vi.fn() },
      };
      const adapter = prismaMongoAdapter(customPrisma, {
        sessionModel: 'mySession',
        pageviewModel: 'myPageview',
        eventModel: 'myEvent',
      });
      expect(adapter).toBeInstanceOf(PrismaMongoTrafficAdapter);
    });

    it('throws error when model does not exist on prisma client', async () => {
      const adapter = prismaMongoAdapter({});
      await expect(adapter.upsertSession('s1', {}, {})).rejects.toThrow('Prisma model');
      await expect(adapter.upsertPageview('s1', 1, {}, {})).rejects.toThrow('Prisma model');
      await expect(adapter.insertEvents([{ sessionId: 's1', site: 't', name: 'e', path: '/', occurredAt: new Date(), createdAt: new Date(), environment: 'p' }])).rejects.toThrow('Prisma model');
    });
  });

  describe('upsertSession branch coverage', () => {
    const fullData: any = {
      site: 'mia-apps',
      environment: 'production',
      consentMode: 'full',
      visitorId: 'v1',
      userId: 'u1',
      lastSeenAt: new Date('2026-09-22T10:00:00.000Z'),
      endedAt: new Date('2026-09-22T10:00:00.000Z'),
      exitPath: '/exit',
      exitTitle: 'Exit Title',
      pageCount: 5,
      durationMs: 50000,
      referrer: 'https://google.com',
      referrerHost: 'google.com',
      referrerType: 'search',
      utm: { source: 'google' },
      userAgent: 'Mozilla/5.0',
      browser: 'Chrome',
      browserVersion: '120',
      os: 'Android',
      deviceType: 'mobile',
      screenW: 1080,
      screenH: 2400,
      viewportW: 412,
      viewportH: 915,
      dpr: 2.6,
      language: 'id',
      timezone: 'Asia/Jakarta',
      ipTruncated: '192.168.1.0',
      ipHash: 'hash123',
      country: 'Indonesia',
      countryCode: 'ID',
      region: 'Jakarta',
      city: 'Jakarta',
    };

    const fullSetOnInsert: any = {
      site: 'mia-apps-2',
      environment: 'staging',
      consentMode: 'anonymous',
      startedAt: new Date('2026-09-22T09:00:00.000Z'),
      lastSeenAt: new Date('2026-09-22T09:30:00.000Z'),
      endedAt: new Date('2026-09-22T09:30:00.000Z'),
      durationMs: 30000,
      pageCount: 2,
      entryPath: '/home',
      entryTitle: 'Home',
      exitPath: '/exit-2',
      exitTitle: 'Exit 2',
      referrer: 'https://bing.com',
      referrerHost: 'bing.com',
      referrerType: 'direct',
      utm: { source: 'bing' },
      userAgent: 'UA-2',
      browser: 'Safari',
      browserVersion: '17',
      os: 'iOS',
      deviceType: 'desktop',
      screenW: 800,
      screenH: 600,
      viewportW: 400,
      viewportH: 300,
      dpr: 2,
      language: 'en',
      timezone: 'UTC',
      ipTruncated: '10.0.0.0',
      ipHash: 'iphash',
      country: 'US',
      countryCode: 'US',
      region: 'CA',
      city: 'SF',
      visitorId: 'v2',
      userId: 'u2',
      createdAt: new Date('2026-09-22T09:00:00.000Z'),
    };

    it('covers branches with full data and empty setOnInsert', async () => {
      const adapter = prismaMongoAdapter(mockPrisma);
      await adapter.upsertSession('s1', fullData, {});
      expect(mockPrisma.trafficSession.upsert).toHaveBeenCalled();
      expect(mockPrisma.$runCommandRaw).toHaveBeenCalled();
    });

    it('covers branches with empty data and full setOnInsert', async () => {
      const adapter = prismaMongoAdapter(mockPrisma);
      await adapter.upsertSession('s2', {}, fullSetOnInsert);
      expect(mockPrisma.trafficSession.upsert).toHaveBeenCalled();
      expect(mockPrisma.$runCommandRaw).not.toHaveBeenCalled();
    });

    it('covers branches with both data and setOnInsert populated', async () => {
      const adapter = prismaMongoAdapter(mockPrisma);
      await adapter.upsertSession('s3', fullData, fullSetOnInsert);
      expect(mockPrisma.trafficSession.upsert).toHaveBeenCalled();
    });

    it('covers branches with completely empty data and empty setOnInsert', async () => {
      const adapter = prismaMongoAdapter(mockPrisma);
      await adapter.upsertSession('s4', {}, {});
      expect(mockPrisma.trafficSession.upsert).toHaveBeenCalled();
    });

    it('works when $runCommandRaw is not defined on prisma client', async () => {
      delete mockPrisma.$runCommandRaw;
      const adapter = prismaMongoAdapter(mockPrisma);
      await expect(adapter.upsertSession('s5', { lastSeenAt: new Date() }, {})).resolves.toBeUndefined();
    });
  });

  describe('upsertPageview & bulkUpsertPageviews branch coverage', () => {
    const fullData: any = {
      site: 'mia-apps',
      environment: 'production',
      path: '/jobs',
      title: 'Jobs',
      query: '?q=flutter',
      articleSlug: 'flutter-job',
      category: 'tech',
      referrer: 'ref',
      startedAt: new Date(),
      endedAt: new Date(),
      durationMs: 4000,
      visibleMs: 3500,
      maxScrollPct: 90,
      isExit: true,
      deviceType: 'mobile',
      countryCode: 'ID',
      ipHash: 'hash',
      visitorId: 'v1',
    };

    const fullSetOnInsert: any = {
      site: 'mia-apps-2',
      environment: 'staging',
      path: '/news',
      title: 'News',
      query: '?cat=all',
      articleSlug: 'news-1',
      category: 'general',
      referrer: 'ref-2',
      startedAt: new Date(),
      endedAt: new Date(),
      durationMs: 2000,
      visibleMs: 1500,
      maxScrollPct: 50,
      isExit: false,
      deviceType: 'desktop',
      countryCode: 'US',
      ipHash: 'hash-2',
      visitorId: 'v2',
      createdAt: new Date(),
    };

    it('covers pageview branches with full data and empty setOnInsert', async () => {
      const adapter = prismaMongoAdapter(mockPrisma);
      await adapter.upsertPageview('s1', 1, fullData, {});
      expect(mockPrisma.trafficPageview.upsert).toHaveBeenCalled();
    });

    it('covers pageview branches with empty data and full setOnInsert', async () => {
      const adapter = prismaMongoAdapter(mockPrisma);
      await adapter.upsertPageview('s1', 2, {}, fullSetOnInsert);
      expect(mockPrisma.trafficPageview.upsert).toHaveBeenCalled();
    });

    it('covers pageview branches with both data and setOnInsert populated', async () => {
      const adapter = prismaMongoAdapter(mockPrisma);
      await adapter.upsertPageview('s1', 3, fullData, fullSetOnInsert);
      expect(mockPrisma.trafficPageview.upsert).toHaveBeenCalled();
    });

    it('covers pageview branches with completely empty objects', async () => {
      const adapter = prismaMongoAdapter(mockPrisma);
      await adapter.upsertPageview('s1', 4, {}, {});
      expect(mockPrisma.trafficPageview.upsert).toHaveBeenCalled();
    });

    it('bulkUpsertPageviews returns immediately on empty array', async () => {
      const adapter = prismaMongoAdapter(mockPrisma);
      await adapter.bulkUpsertPageviews([]);
      expect(mockPrisma.trafficPageview.upsert).not.toHaveBeenCalled();
    });

    it('bulkUpsertPageviews executes multiple operations', async () => {
      const adapter = prismaMongoAdapter(mockPrisma);
      await adapter.bulkUpsertPageviews([
        { sessionId: 's1', sequence: 1, data: {}, setOnInsert: { path: '/1' } },
        { sessionId: 's1', sequence: 2, data: {}, setOnInsert: { path: '/2' } },
      ]);
      expect(mockPrisma.trafficPageview.upsert).toHaveBeenCalledTimes(2);
    });
  });

  describe('markExitPage', () => {
    it('calls updateMany with isExit true', async () => {
      const adapter = prismaMongoAdapter(mockPrisma);
      await adapter.markExitPage('s1', 3);
      expect(mockPrisma.trafficPageview.updateMany).toHaveBeenCalledWith({
        where: { sessionId: 's1', sequence: 3 },
        data: { isExit: true },
      });
    });
  });

  describe('insertEvents', () => {
    it('returns immediately on empty array', async () => {
      const adapter = prismaMongoAdapter(mockPrisma);
      await adapter.insertEvents([]);
      expect(mockPrisma.trafficEvent.createMany).not.toHaveBeenCalled();
    });

    it('creates multiple events covering props and environment branches', async () => {
      const adapter = prismaMongoAdapter(mockPrisma);
      const occurredAt = new Date();
      await adapter.insertEvents([
        {
          sessionId: 's1',
          site: 'mia-apps',
          environment: 'production',
          name: 'click',
          path: '/home',
          props: { button: 'submit' },
          occurredAt,
          createdAt: occurredAt,
        },
        {
          sessionId: 's1',
          site: 'mia-apps',
          environment: '',
          name: 'view',
          path: '/home',
          occurredAt,
          createdAt: undefined as any,
        }
      ]);

      expect(mockPrisma.trafficEvent.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({ name: 'click', environment: 'production' }),
          expect.objectContaining({ name: 'view', environment: 'production' }),
        ]),
      });
    });
  });

  describe('Query Methods & Data Parsers', () => {
    const query = { site: 'mia-apps', range: '7d' as const, limit: 10 };
    const range = {
      from: new Date('2026-09-15T00:00:00.000Z'),
      to: new Date('2026-09-22T00:00:00.000Z'),
      bucket: 'day' as const,
      prevFrom: new Date('2026-09-08T00:00:00.000Z'),
      prevTo: new Date('2026-09-15T00:00:00.000Z'),
    };

    it('queryOverview handles numbers, objects, and empty stats', async () => {
      const adapter = prismaMongoAdapter(mockPrisma);

      mockPrisma.trafficSession.aggregateRaw
        .mockResolvedValueOnce([{ sessions: { $numberInt: '10' }, visitors: { $numberInt: '8' }, bounces: 2, avgSessionDurationMs: 15000 }])
        .mockResolvedValueOnce([{ _id: '2026-09-20', sessions: 5, visitors: ['v1', 'v2'] }])
        .mockResolvedValueOnce([{ sessions: 5, visitors: 4, bounces: 1, totalDuration: 50000 }]);

      mockPrisma.trafficPageview.aggregateRaw
        .mockResolvedValueOnce([{ pageviews: { $numberLong: '30' } }])
        .mockResolvedValueOnce([{ _id: '2026-09-20', pageviews: 15 }])
        .mockResolvedValueOnce([{ pageviews: 20 }]);

      const res = await adapter.queryOverview(query, range);
      expect(res.totals.sessions).toBe(10);
      expect(res.totals.visitors).toBe(8);
      expect(res.totals.pageviews).toBe(30);
      expect(res.totals.bounceRate).toBe(0.2);
      expect(res.totals.pagesPerSession).toBe(3);
      expect(res.timeseries).toHaveLength(1);
    });

    it('queryOverview handles zero sessions and hour bucket', async () => {
      const adapter = prismaMongoAdapter(mockPrisma);
      mockPrisma.trafficSession.aggregateRaw
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);
      mockPrisma.trafficPageview.aggregateRaw
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const res = await adapter.queryOverview(query, { ...range, bucket: 'hour' });
      expect(res.totals.sessions).toBe(0);
      expect(res.totals.pagesPerSession).toBe(0);
      expect(res.totals.bounceRate).toBe(0);
    });

    it('queryPages maps page statistics covering all branches', async () => {
      const adapter = prismaMongoAdapter(mockPrisma);
      mockPrisma.trafficPageview.aggregateRaw.mockResolvedValueOnce([
        { _id: '/jobs', title: 'Jobs', pageviews: 50, visitors: ['v1'], exits: 10, totalVisibleMs: 100000, timedViews: 20 },
        { _id: null, title: null, pageviews: 0, visitors: 0, exits: 0, totalVisibleMs: 0, timedViews: 0 },
      ]);

      const pages = await adapter.queryPages(query, range);
      expect(pages).toHaveLength(2);
      expect(pages[0].path).toBe('/jobs');
      expect(pages[0].avgTimeOnPageMs).toBe(5000);
      expect(pages[0].exitRate).toBe(0.2);
      expect(pages[1].path).toBe('/');
      expect(pages[1].exitRate).toBe(0);
    });

    it('queryQueries maps search query stats with default limit', async () => {
      const adapter = prismaMongoAdapter(mockPrisma);
      mockPrisma.trafficPageview.aggregateRaw.mockResolvedValueOnce([
        { _id: 'flutter developer', pageviews: { $numberInt: '12' }, visitors: ['v1', 'v2'] },
        { _id: null, pageviews: 5, visitors: 3 },
      ]);

      const queries = await adapter.queryQueries({ site: 'mia-apps', range: '7d', limit: 0 as any }, range);
      expect(queries).toHaveLength(2);
      expect(queries[0].query).toBe('flutter developer');
      expect(queries[0].pageviews).toBe(12);
      expect(queries[1].query).toBe('');
    });

    it('queryEntryExit maps entry and exit pages', async () => {
      const adapter = prismaMongoAdapter(mockPrisma);
      mockPrisma.trafficSession.aggregateRaw
        .mockResolvedValueOnce([
          { _id: '/home', sessions: 20, bounces: 5 },
          { _id: null, sessions: 0, bounces: 0 },
        ])
        .mockResolvedValueOnce([{ _id: '/checkout', sessions: 15 }, { _id: null, sessions: 5 }]);

      const res = await adapter.queryEntryExit(query, range);
      expect(res.entryPages).toHaveLength(2);
      expect(res.entryPages[0].path).toBe('/home');
      expect(res.entryPages[0].bounceRate).toBe(0.25);
      expect(res.entryPages[1].path).toBe('/');
      expect(res.entryPages[1].bounceRate).toBe(0);
      expect(res.exitPages[0].path).toBe('/checkout');
      expect(res.exitPages[1].path).toBe('/');
    });

    it('queryReferrers maps byType and byHost', async () => {
      const adapter = prismaMongoAdapter(mockPrisma);
      mockPrisma.trafficSession.aggregateRaw
        .mockResolvedValueOnce([{ _id: null, count: 10 }])
        .mockResolvedValueOnce([{ _id: 'google.com', count: 8 }, { _id: null, count: 2 }]);

      const res = await adapter.queryReferrers(query, range);
      expect(res.byType[0].name).toBe('direct');
      expect(res.byType[0].count).toBe(10);
      expect(res.byHost[0].name).toBe('google.com');
      expect(res.byHost[1].name).toBe('');
    });

    it('queryGeo maps countries', async () => {
      const adapter = prismaMongoAdapter(mockPrisma);
      mockPrisma.trafficSession.aggregateRaw.mockResolvedValueOnce([
        { _id: 'ID', sessions: 50, pageviews: 120 },
      ]);

      const res = await adapter.queryGeo(query, range);
      expect(res.countries[0].code).toBe('ID');
      expect(res.countries[0].sessions).toBe(50);
      expect(res.countries[0].pageviews).toBe(120);
    });

    it('queryTech maps devices', async () => {
      const adapter = prismaMongoAdapter(mockPrisma);
      mockPrisma.trafficSession.aggregateRaw.mockResolvedValueOnce([
        { _id: null, count: 30 },
        { _id: 'mobile', count: 70 },
      ]);

      const res = await adapter.queryTech(query, range);
      expect(res.devices[0].name).toBe('desktop');
      expect(res.devices[1].name).toBe('mobile');
    });

    it('querySessions maps sessions page with Extended JSON dates and numbers', async () => {
      const adapter = prismaMongoAdapter(mockPrisma);
      mockPrisma.trafficSession.aggregateRaw
        .mockResolvedValueOnce([{ count: 100 }])
        .mockResolvedValueOnce([
          {
            sessionId: 'sess-1',
            startedAt: { $date: '2026-09-22T08:00:00.000Z' },
            lastSeenAt: '2026-09-22T08:30:00.000Z',
            endedAt: new Date('2026-09-22T08:30:00.000Z'),
            durationMs: { $numberDouble: '1800000' },
            pageCount: 1,
            entryPath: '/home',
            exitPath: '/jobs',
            referrerHost: 'google.com',
            referrerType: 'search',
            deviceType: 'mobile',
            browser: 'Chrome',
            os: 'Android',
            screenW: 1080,
            screenH: 2400,
            ipTruncated: '192.168.1.0',
            countryCode: 'ID',
            country: 'Indonesia',
            city: 'Jakarta',
          },
          {
            sessionId: 'sess-2',
            startedAt: null,
            lastSeenAt: { $date: new Date() },
            endedAt: null,
            durationMs: 'invalid_number',
            pageCount: 3,
            entryPath: null,
            exitPath: null,
            referrerHost: null,
            referrerType: null,
            deviceType: null,
            browser: null,
            os: null,
            screenW: undefined,
            screenH: undefined,
            ipTruncated: null,
            countryCode: null,
            country: null,
            city: null,
          }
        ]);

      const res = await adapter.querySessions({ site: 'mia-apps', range: '7d', page: 0 as any, limit: 0 as any }, range);
      expect(res.total).toBe(100);
      expect(res.page).toBe(1);
      expect(res.limit).toBe(25);
      expect(res.sessions).toHaveLength(2);
      expect(res.sessions[0].isBounce).toBe(true);
      expect(res.sessions[0].durationMs).toBe(1800000);
      expect(res.sessions[1].isBounce).toBe(false);
      expect(res.sessions[1].durationMs).toBe(0);
      expect(res.sessions[1].entryPath).toBe('/');
      expect(res.sessions[1].referrerType).toBe('direct');
      expect(res.sessions[1].deviceType).toBe('desktop');
    });

    it('queryAll executes all facets and formats output', async () => {
      const adapter = prismaMongoAdapter(mockPrisma);

      mockPrisma.trafficSession.aggregateRaw
        .mockResolvedValueOnce([
          {
            totals: [{ sessions: 10, visitors: ['v1'], bounces: 2, totalDuration: 60000 }],
            timeseries: [{ _id: '2026-09-20', sessions: 5, visitors: ['v1'] }],
            entryPages: [{ _id: '/home', sessions: 8, bounces: 1 }],
            exitPages: [{ _id: '/bye', sessions: 7 }],
            refType: [{ _id: 'direct', count: 6 }],
            refHost: [{ _id: 'example.com', count: 4 }],
            geoCountries: [{ _id: 'ID', sessions: 10, pageviews: 20 }],
            techDevices: [{ _id: 'mobile', count: 10 }],
          }
        ])
        .mockResolvedValueOnce([
          {
            totalCount: [{ count: 1 }],
            sessionsList: [
              {
                sessionId: 's1',
                startedAt: new Date(),
                lastSeenAt: new Date(),
                endedAt: new Date(),
                durationMs: 12000,
                pageCount: 2,
                entryPath: '/start',
                exitPath: '/end',
                referrerHost: 'host.com',
                referrerType: 'direct',
                deviceType: 'mobile',
                browser: 'Chrome',
                os: 'Android',
                screenW: 1080,
                screenH: 1920,
                ipTruncated: '1.2.3.0',
                countryCode: 'ID',
                country: 'Indonesia',
                city: 'Jakarta',
              },
              {
                sessionId: 's2',
                startedAt: null,
                lastSeenAt: null,
                pageCount: 1,
              }
            ]
          }
        ])
        .mockResolvedValueOnce([
          { sessions: 8, visitors: ['v0'], bounces: 1, totalDuration: 40000 }
        ]);

      mockPrisma.trafficPageview.aggregateRaw
        .mockResolvedValueOnce([
          {
            totals: [{ pageviews: 25 }],
            timeseries: [{ _id: '2026-09-20', pageviews: 12 }],
            pages: [
              { _id: '/home', title: 'Home', pageviews: 25, visitors: ['v1'], exits: 5, totalVisibleMs: 50000, timedViews: 10 },
              { _id: null, title: null, pageviews: 0, visitors: 0, exits: 0, totalVisibleMs: 0, timedViews: 0 },
            ]
          }
        ])
        .mockResolvedValueOnce([{ count: 18 }])
        .mockResolvedValueOnce([{ _id: 'search-kw', pageviews: 3, visitors: ['v1'] }]);

      const all = await adapter.queryAll({ site: 'mia-apps', range: '7d', limit: 10 }, range);
      expect(all.overview.totals.sessions).toBe(10);
      expect(all.overview.totals.pageviews).toBe(25);
      expect(all.overview.previous.sessions).toBe(8);
      expect(all.overview.previous.pageviews).toBe(18);
      expect(all.pages).toHaveLength(2);
      expect(all.pages[0].exitRate).toBe(0.2);
      expect(all.pages[1].exitRate).toBe(0);
      expect(all.entryExit.entryPages).toHaveLength(1);
      expect(all.referrers.byType).toHaveLength(1);
      expect(all.geo.countries).toHaveLength(1);
      expect(all.tech.devices).toHaveLength(1);
      expect(all.sessions.total).toBe(1);
      expect(all.sessions.sessions[0].browser).toBe('Chrome');
      expect(all.sessions.sessions[1].deviceType).toBe('desktop');
    });

    it('queryAll handles empty facet responses and numeric visitor totals', async () => {
      const adapter = prismaMongoAdapter(mockPrisma);

      mockPrisma.trafficSession.aggregateRaw
        .mockResolvedValueOnce([{ totals: [{ sessions: 5, visitors: 4, bounces: 0, totalDuration: 0 }] }])
        .mockResolvedValueOnce([{}])
        .mockResolvedValueOnce([{ sessions: 0, visitors: 0, bounces: 0, totalDuration: 0 }]);

      mockPrisma.trafficPageview.aggregateRaw
        .mockResolvedValueOnce([{}])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const all = await adapter.queryAll({ site: 'mia-apps', range: '7d', limit: 10 }, range);
      expect(all.overview.totals.sessions).toBe(5);
      expect(all.overview.previous.sessions).toBe(0);
      expect(all.sessions.total).toBe(0);
    });
  });
});
