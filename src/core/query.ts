import type { TrafficAdapter } from '../adapter';
import type { CRangeQueryDTO, CSessionListQueryDTO } from '../types';
import { resolveRange } from './range.js';
import { CacheService } from './cache.js';

export class TrafficQueryService {
  constructor(
    private adapter: TrafficAdapter,
    private cache: CacheService
  ) {}

  private cacheKey(prefix: string, query: Record<string, unknown>, range: { from: Date, to: Date }): string {
    return `traffic:${prefix}:${query.site}:${range.from.getTime()}:${range.to.getTime()}:${query.limit ?? ''}:${query.page ?? ''}`;
  }

  async overview(query: CRangeQueryDTO) {
    const range = resolveRange(query);
    return this.cache.getOrSet(
      this.cacheKey('overview', query, range),
      () => this.adapter.queryOverview(query, range),
      45
    );
  }

  async pages(query: CRangeQueryDTO) {
    const range = resolveRange(query);
    return this.cache.getOrSet(
      this.cacheKey('pages', query, range),
      () => this.adapter.queryPages(query, range),
      45
    );
  }

  async entryExit(query: CRangeQueryDTO) {
    const range = resolveRange(query);
    return this.cache.getOrSet(
      this.cacheKey('entryexit', query, range),
      () => this.adapter.queryEntryExit(query, range),
      45
    );
  }

  async referrers(query: CRangeQueryDTO) {
    const range = resolveRange(query);
    return this.cache.getOrSet(
      this.cacheKey('referrers', query, range),
      () => this.adapter.queryReferrers(query, range),
      45
    );
  }

  async geo(query: CRangeQueryDTO) {
    const range = resolveRange(query);
    return this.cache.getOrSet(
      this.cacheKey('geo', query, range),
      () => this.adapter.queryGeo(query, range),
      45
    );
  }

  async tech(query: CRangeQueryDTO) {
    const range = resolveRange(query);
    return this.cache.getOrSet(
      this.cacheKey('tech', query, range),
      () => this.adapter.queryTech(query, range),
      45
    );
  }

  async sessions(query: CSessionListQueryDTO) {
    const range = resolveRange(query);
    // Don't cache session lists for too long to keep them feeling live
    return this.cache.getOrSet(
      this.cacheKey('sessions', query, range),
      () => this.adapter.querySessions(query, range),
      5
    );
  }

  async all(query: CRangeQueryDTO & CSessionListQueryDTO) {
    const range = resolveRange(query);
    return this.cache.getOrSet(
      this.cacheKey('all', query, range),
      () => this.adapter.queryAll(query, range),
      5
    );
  }
}
