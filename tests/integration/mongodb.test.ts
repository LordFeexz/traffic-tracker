import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { MongoClient, Db } from 'mongodb';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { MongoTrafficAdapter } from '../../src/adapters/mongodb/operations';
import { TrafficCollectService } from '../../src/core/collect';
import type { CollectPayload } from '../../src/types';

describe('MongoDB Adapter Integration', () => {
  let mongoServer: MongoMemoryServer;
  let client: MongoClient;
  let db: Db;
  let adapter: MongoTrafficAdapter;
  let collect: TrafficCollectService;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    client = await MongoClient.connect(uri);
    db = client.db('test-analytics');
    adapter = new MongoTrafficAdapter(db);
    collect = new TrafficCollectService(adapter);
  });

  afterAll(async () => {
    await client.close();
    await mongoServer.stop();
  });

  const baseMeta = {
    ua: { deviceType: 'desktop' as const },
    ipTruncated: '127.0.0.0',
    ipHash: 'abc',
    geo: { countryCode: 'US' }
  };

  const baseQuery = { site: 'test', range: '24h' as const, limit: 10 };
  const baseRange = {
    from: new Date(0),
    to: new Date(Date.now() + 60000),
    bucket: 'hour' as const,
    prevFrom: new Date(-86400000),
    prevTo: new Date(0)
  };

  it('ingests and aggregates a session correctly', async () => {
    const payload: CollectPayload = {
      site: 'test',
      environment: 'production',
      consentMode: 'full',
      sessionId: 's1',
      visitorId: 'v1',
      events: [
        { type: 'session_start', ts: Date.now(), entryPath: '/', referrer: 'https://google.com', screenW: 0, screenH: 0, viewportW: 0, viewportH: 0, dpr: 1, language: 'en', timezone: 'UTC' },
        { type: 'pageview', ts: Date.now(), path: '/', sequence: 1, referrer: 'https://google.com', viewportW: 800, viewportH: 600 },
        { type: 'page_exit', ts: Date.now() + 5000, path: '/', sequence: 1, durationMs: 5000, visibleMs: 4000, maxScrollPct: 75 }
      ]
    };

    await collect.ingest(payload, baseMeta);

    const sessionDoc = await db.collection('traffic_sessions').findOne({ sessionId: 's1' });
    expect(sessionDoc).toBeDefined();
    expect(sessionDoc?.visitorId).toBe('v1');

    const pvDoc = await db.collection('traffic_pageviews').findOne({ sessionId: 's1', sequence: 1 });
    expect(pvDoc).toBeDefined();
    expect(pvDoc?.path).toBe('/');

    await adapter.upsertSession('s1_exit', { exitPath: '/exit', pageCount: 2, lastSeenAt: new Date() }, { site: 'test', environment: 'production', startedAt: new Date(), entryPath: '/' } as any);
  });

  it('queries overview', async () => {
    const res = await adapter.queryOverview({ site: 'test' } as any, { from: new Date(Date.now() - 100000), to: new Date(), prevFrom: new Date(Date.now() - 200000), prevTo: new Date(Date.now() - 100000), bucket: 'day' });
    expect(res.totals).toBeDefined();
    const res2 = await adapter.queryOverview({ site: 'test' } as any, { from: new Date(Date.now() - 100000), to: new Date(), prevFrom: new Date(Date.now() - 200000), prevTo: new Date(Date.now() - 100000), bucket: 'hour' });
    expect(res2.totals).toBeDefined();
  });

  it('queryPages returns pages list', async () => {
    const res = await adapter.queryPages(baseQuery, baseRange);
    expect(res.length).toBeGreaterThan(0);
    expect(res[0].path).toBe('/');
  });

  it('queryEntryExit returns entry and exit pages', async () => {
    const res = await adapter.queryEntryExit(baseQuery, baseRange);
    expect(res.entryPages.length).toBeGreaterThan(0);
    expect(res.entryPages[0].path).toBe('/');
  });

  it('queryReferrers returns referrer breakdown', async () => {
    const res = await adapter.queryReferrers(baseQuery, baseRange);
    expect(res.byType).toBeInstanceOf(Array);
    // google.com referrer should show up
    expect(res.byHost.length).toBeGreaterThan(0);
  });

  it('queryGeo returns countries', async () => {
    const res = await adapter.queryGeo(baseQuery, baseRange);
    expect(res.countries.length).toBeGreaterThan(0);
    expect(res.countries[0].code).toBe('US');
  });

  it('queryTech returns devices', async () => {
    const res = await adapter.queryTech(baseQuery, baseRange);
    expect(res.devices.length).toBeGreaterThan(0);
    expect(res.devices[0].name).toBe('desktop');
  });

  it('querySessions returns paginated list', async () => {
    const query = { site: 'test', range: '24h' as const, limit: 25, page: 1 };
    const res = await adapter.querySessions(query, baseRange);
    expect(res.total).toBeGreaterThan(0);
    expect(res.sessions.length).toBeGreaterThan(0);
    expect(res.sessions[0].sessionId).toBe('s1');
  });

  it('bulk upserts pageviews', async () => {
    await adapter.bulkUpsertPageviews([
      { sessionId: 'sy', sequence: 1, data: { durationMs: 50, visibleMs: 25, maxScrollPct: 10 }, setOnInsert: { site: 'test' } as any },
      { sessionId: 'sy', sequence: 3, data: { durationMs: undefined, visibleMs: undefined, maxScrollPct: undefined }, setOnInsert: { site: 'test' } as any },
      { sessionId: 'sy', sequence: 2, data: {}, setOnInsert: { site: 'test' } as any }
    ]);
    const res = await adapter['pageviews'].find({ sessionId: 'sy' }).toArray();
    expect(res.length).toBe(3);
  });

  it('upserts single pageview', async () => {
    await adapter.upsertPageview('sx', 99, { durationMs: 100, visibleMs: 50, maxScrollPct: 20 }, { site: 'test', environment: 'prod', path: '/test', startedAt: new Date(), createdAt: new Date(), isExit: false, deviceType: 'desktop' });
    const res = await adapter['pageviews'].findOne({ sessionId: 'sx', sequence: 99 });
    expect(res?.durationMs).toBe(100);
  });

  it('upserts single pageview empty and undefined', async () => {
    await adapter.upsertPageview('sx', 100, {}, { site: 'test', environment: 'prod', path: '/test', startedAt: new Date(), createdAt: new Date(), isExit: false, deviceType: 'desktop' });
    await adapter.upsertPageview('sx', 101, { durationMs: undefined, visibleMs: undefined, maxScrollPct: undefined }, { site: 'test' } as any);
  });

  it('upserts session empty and undefined', async () => {
    await adapter.upsertSession('sx_empty', {}, { site: 'test', environment: 'prod', createdAt: new Date(), startedAt: new Date(), lastSeenAt: new Date(), entryPath: '/' } as any);
    await adapter.upsertSession('sx_undef', { pageCount: undefined, lastSeenAt: undefined, durationMs: undefined, endedAt: undefined }, { site: 'test' } as any);
  });

  it('queries sessions and queryAll', async () => {
    const res = await adapter.querySessions({ site: 'test', limit: 0, page: 0 } as any, { from: new Date(Date.now() - 100000), to: new Date(), prevFrom: new Date(Date.now() - 200000), prevTo: new Date(Date.now() - 100000), bucket: 'day' });
    expect(res.sessions).toBeDefined();

    const resAll = await adapter.queryAll({ site: 'test', limit: 0, page: 0 } as any, { from: new Date(Date.now() - 100000), to: new Date(), prevFrom: new Date(Date.now() - 200000), prevTo: new Date(Date.now() - 100000), bucket: 'day' });
    expect(resAll.overview).toBeDefined();
    expect(resAll.pages).toBeDefined();

    const resAllDefault = await adapter.queryAll({ site: 'test' } as any, { from: new Date(Date.now() - 100000), to: new Date(), prevFrom: new Date(Date.now() - 200000), prevTo: new Date(Date.now() - 100000), bucket: 'hour' });
    expect(resAllDefault.overview).toBeDefined();
  });

  it('queries return empty when no data', async () => {
    const emptyRange = { from: new Date(0), to: new Date(1), prevFrom: new Date(0), prevTo: new Date(1), bucket: 'day' as const };
    const resOverview = await adapter.queryOverview({ site: 'test' } as any, emptyRange);
    expect(resOverview.totals.sessions).toBe(0);
    const resPages = await adapter.queryPages({ site: 'test', limit: 10 } as any, emptyRange);
    expect(resPages.length).toBe(0);
    const resEntryExit = await adapter.queryEntryExit({ site: 'test', limit: 10 } as any, emptyRange);
    expect(resEntryExit.entryPages.length).toBe(0);
    expect(resEntryExit.exitPages.length).toBe(0);
    const resReferrers = await adapter.queryReferrers({ site: 'test', limit: 10 } as any, emptyRange);
    expect(resReferrers.byType.length).toBe(0);
    const resGeo = await adapter.queryGeo({ site: 'test', limit: 10 } as any, emptyRange);
    expect(resGeo.countries.length).toBe(0);
    const resTech = await adapter.queryTech({ site: 'test', limit: 10 } as any, emptyRange);
    expect(resTech.devices.length).toBe(0);
    
    const resAll = await adapter.queryAll({ site: 'test', limit: 10, page: 1 } as any, emptyRange);
    expect(resAll.overview.totals.sessions).toBe(0);
  });

  it('updates endedAt correctly', async () => {
    await adapter.upsertSession('s3', { endedAt: new Date() }, { site: 'test', environment: 'prod', consentMode: 'full', startedAt: new Date(), entryPath: '/', referrerType: 'direct', durationMs: 0, pageCount: 1, lastSeenAt: new Date(), deviceType: 'desktop', createdAt: new Date() });
    const res = await adapter['sessions'].findOne({ sessionId: 's3' });
    expect(res?.endedAt).toBeDefined();
  });

  it('insertEvents stores custom events', async () => {
    await adapter.insertEvents([{
      sessionId: 's1',
      site: 'test',
      environment: 'production',
      name: 'button_click',
      path: '/',
      props: { color: 'blue' },
      occurredAt: new Date(),
      createdAt: new Date()
    }]);

    const ev = await db.collection('traffic_events').findOne({ name: 'button_click' });
    expect(ev).toBeDefined();
    expect(ev?.props.color).toBe('blue');
  });

  it('markExitPage sets isExit on pageview', async () => {
    await adapter.markExitPage('s1', 1);
    const pvDoc = await db.collection('traffic_pageviews').findOne({ sessionId: 's1', sequence: 1 });
    expect(pvDoc?.isExit).toBe(true);
  });
});
