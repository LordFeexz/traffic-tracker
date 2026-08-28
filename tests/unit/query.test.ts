import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TrafficQueryService } from '../../src/core/query';
import { CacheService } from '../../src/core/cache';
import { createMockAdapter } from '../helpers/mock-adapter';

describe('TrafficQueryService', () => {
  const baseQuery = { site: 'test', range: '7d' as const, limit: 10 };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-06-01T12:00:00Z'));
  });

  afterEach(() => vi.useRealTimers());

  function setup() {
    const adapter = createMockAdapter();
    const cache = new CacheService();
    const service = new TrafficQueryService(adapter, cache);
    return { adapter, service };
  }

  it('overview is cached on second call', async () => {
    const adapter = createMockAdapter();
    const cache = new CacheService();
    const querySpy = vi.spyOn(adapter, 'queryOverview');
    const service = new TrafficQueryService(adapter, cache);

    await service.overview(baseQuery);
    await service.overview(baseQuery);

    // Adapter should only be called once since result is cached
    expect(querySpy).toHaveBeenCalledTimes(1);
  });

  it('pages delegates to adapter', async () => {
    const { service } = setup();
    const res = await service.pages(baseQuery);
    expect(res).toBeInstanceOf(Array);
  });

  it('entryExit delegates to adapter', async () => {
    const { service } = setup();
    const res = await service.entryExit(baseQuery);
    expect(res).toBeDefined();
    expect(res.entryPages).toBeInstanceOf(Array);
    expect(res.exitPages).toBeInstanceOf(Array);
  });

  it('referrers delegates to adapter', async () => {
    const { service } = setup();
    const res = await service.referrers(baseQuery);
    expect(res.byType).toBeInstanceOf(Array);
    expect(res.byHost).toBeInstanceOf(Array);
  });

  it('geo delegates to adapter', async () => {
    const { service } = setup();
    const res = await service.geo(baseQuery);
    expect(res.countries).toBeInstanceOf(Array);
  });

  it('tech delegates to adapter', async () => {
    const { service } = setup();
    const res = await service.tech(baseQuery);
    expect(res.devices).toBeInstanceOf(Array);
  });

  it('sessions delegates to adapter', async () => {
    const { service } = setup();
    const res = await service.sessions({ site: 'test', range: '7d', limit: 10, page: 1 });
    expect(res.sessions).toBeInstanceOf(Array);
  });

  it('all delegates to adapter', async () => {
    const { service } = setup();
    const res = await service.all({ site: 'test', range: '7d', limit: 10, page: 1 });
    expect(res.overview).toBeDefined();
    expect(res.pages).toBeInstanceOf(Array);
    expect(res.sessions.sessions).toBeInstanceOf(Array);
  });
});
