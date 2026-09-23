import type { TrafficAdapter } from './adapter';
import type { CacheAdapter } from './core/cache';
import type { GeoProvider, GeoLocation } from './core/geo';
import { TrafficCollectService, type RequestMeta } from './core/collect';
import { TrafficQueryService } from './core/query';
import { CacheService } from './core/cache';
import { parseUserAgent } from './core/ua';
import { truncateIp, hashIp } from './core/ip';
import type { CollectPayload, AnalyticsEvent, CRangeQueryDTO, CSessionListQueryDTO } from './types';
import type { RealtimeAdapter } from './realtime/types';

export interface TrafficTrackerConfig {
  database: TrafficAdapter;
  internalHosts?: string[];
  geo?: GeoProvider;
  cache?: CacheAdapter;
  realtime?: RealtimeAdapter;
}

export class TrafficTracker {
  public collect: TrafficCollectService;
  public query: TrafficQueryService;
  private geo?: GeoProvider;
  public realtime?: RealtimeAdapter;

  constructor(private config: TrafficTrackerConfig) {
    this.collect = new TrafficCollectService(config.database, config.internalHosts);
    this.query = new TrafficQueryService(config.database, new CacheService(config.cache));
    this.geo = config.geo;
    this.realtime = config.realtime;
  }

  async handleCollect(payload: CollectPayload, req: { userAgent?: string; ip?: string; headers?: Record<string, string> | Headers }): Promise<void> {
    const ua = parseUserAgent(req.userAgent);
    let geoLoc: GeoLocation | undefined;
    
    if (this.geo && req.ip) {
      try {
        geoLoc = await this.geo.lookup(req.ip, req.headers);
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

    if (this.realtime) {
      try {
        const events = payload.events || [];
        let latestPath: string | undefined;
        let latestTitle: string | undefined;
        let ended = false;
        let sessionStartDate: Date | undefined;

        for (const event of events) {
          const eventDate = new Date(event.ts);
          if (event.type === 'session_start') {
            sessionStartDate = eventDate;
            await this.realtime.recordSessionStart(payload.site, eventDate);
            latestPath = latestPath || event.entryPath;
            latestTitle = latestTitle || event.entryTitle;
          } else if (event.type === 'pageview') {
            await this.realtime.recordPageview(payload.site, eventDate);
            latestPath = event.path;
            latestTitle = event.title;
            ended = false;
          } else if (event.type === 'heartbeat') {
            latestPath = event.path;
            ended = false;
          } else if (event.type === 'session_end') {
            ended = true;
          }
        }

        if (ended) {
          await this.realtime.remove(payload.site, payload.sessionId);
        } else if (latestPath) {
          const startEvent = events.find((e: any) => e.type === 'session_start') as any;
          await this.realtime.touch(
            payload.site,
            payload.sessionId,
            {
              path: latestPath,
              title: latestTitle,
              countryCode: geoLoc?.countryCode,
              deviceType: ua.deviceType,
              referrerType: startEvent?.referrer ? 'referral' : 'direct'
            },
            sessionStartDate || new Date()
          );
        }
      } catch (err) {
        // Silently ignore realtime dispatch failures
      }
    }
  }
}

export function createTrafficTracker(config: TrafficTrackerConfig): TrafficTracker {
  return new TrafficTracker(config);
}

export * from './types';
export * from './adapter';
export * from './realtime/types';
