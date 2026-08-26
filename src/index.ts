import type { TrafficAdapter } from './adapter';
import type { CacheAdapter } from './core/cache';
import type { GeoProvider, GeoLocation } from './core/geo';
import { TrafficCollectService, type RequestMeta } from './core/collect';
import { TrafficQueryService } from './core/query';
import { CacheService } from './core/cache';
import { parseUserAgent } from './core/ua';
import { truncateIp, hashIp } from './core/ip';
import type { CollectPayload, AnalyticsEvent, CRangeQueryDTO, CSessionListQueryDTO } from './types';

export interface TrafficTrackerConfig {
  database: TrafficAdapter;
  internalHosts?: string[];
  geo?: GeoProvider;
  cache?: CacheAdapter;
}

export class TrafficTracker {
  public collect: TrafficCollectService;
  public query: TrafficQueryService;
  private geo?: GeoProvider;

  constructor(private config: TrafficTrackerConfig) {
    this.collect = new TrafficCollectService(config.database, config.internalHosts);
    this.query = new TrafficQueryService(config.database, new CacheService(config.cache));
    this.geo = config.geo;
  }

  async handleCollect(payload: CollectPayload, req: { userAgent?: string; ip?: string }): Promise<void> {
    const ua = parseUserAgent(req.userAgent);
    let geoLoc: GeoLocation | undefined;
    
    if (this.geo && req.ip) {
      try {
        geoLoc = await this.geo.lookup(req.ip);
      } catch (err) {
        // Silently ignore geo lookup failures
      }
    }

    const meta: RequestMeta = {
      userAgent: req.userAgent,
      ipTruncated: truncateIp(req.ip),
      ipHash: hashIp(req.ip),
      geo: geoLoc || {},
      ua
    };

    await this.collect.ingest(payload, meta);
  }
}

export function createTrafficTracker(config: TrafficTrackerConfig): TrafficTracker {
  return new TrafficTracker(config);
}

export * from './types';
export * from './adapter';
