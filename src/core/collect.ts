import type { TrafficAdapter } from '../adapter';
import type { AnalyticsEvent, CollectPayload, ConsentMode } from '../types';
import type { ParsedUserAgent } from './ua';
import type { GeoLocation } from './geo';
import { classifyReferrer, parseUtm } from './referrer';

export interface RequestMeta {
  userAgent?: string;
  ipTruncated?: string;
  ipHash?: string;
  geo?: GeoLocation;
  ua: ParsedUserAgent;
}

type Doc = Record<string, unknown>;

function defined(obj: Doc): Doc {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined));
}

export class TrafficCollectService {
  constructor(
    private adapter: TrafficAdapter,
    private internalHosts: string[] = []
  ) {}

  async ingest(payload: CollectPayload, meta: RequestMeta): Promise<void> {
    const events = [...payload.events].sort((a, b) => a.ts - b.ts);
    if (events.length === 0) return;

    const now = new Date();
    const isBot = meta.ua.deviceType === 'bot';
    
    // Consent is re-applied here rather than trusted
    const visitorId = payload.consentMode === 'full' ? payload.visitorId : undefined;

    await Promise.all([
      this.writeSession(payload, events, meta, now, visitorId),
      this.writePageviews(payload, events, meta, now, visitorId),
      this.writeCustomEvents(payload, events, now, visitorId)
    ]);
  }

  private async writeSession(
    payload: CollectPayload,
    events: AnalyticsEvent[],
    meta: RequestMeta,
    now: Date,
    visitorId: string | undefined
  ): Promise<void> {
    const start = events.find((e) => e.type === 'session_start') as Extract<AnalyticsEvent, { type: 'session_start' }> | undefined;
    const end = events.findLast((e) => e.type === 'session_end') as Extract<AnalyticsEvent, { type: 'session_end' }> | undefined;
    const pageviews = events.filter((e) => e.type === 'pageview') as Extract<AnalyticsEvent, { type: 'pageview' }>[];
    const firstEvent = events[0]!;
    const lastSeenAt = new Date(events[events.length - 1]!.ts);

    const fallbackPath =
      pageviews[0]?.path ?? ('path' in firstEvent ? firstEvent.path : undefined) ?? '/';

    const referrer = classifyReferrer(start ? start.referrer : undefined, this.internalHosts);
    const utm = parseUtm(pageviews[0]?.query);
    const maxSequence = pageviews.reduce((max, pv) => Math.max(max, pv.sequence), 0);

    const immutable = defined({
      sessionId: payload.sessionId,
      site: payload.site,
      environment: payload.environment,
      startedAt: start ? new Date(start.ts) : new Date(firstEvent.ts),
      entryPath: start?.entryPath ?? fallbackPath,
      entryTitle: start?.entryTitle,
      referrer: referrer.referrer,
      referrerHost: referrer.referrerHost,
      referrerType: referrer.referrerType,
      utm,
      createdAt: now
    });

    const setOnInsert = { ...immutable };

    const mutable = defined({
      consentMode: payload.consentMode,
      visitorId,
      userId: payload.userId,
      userAgent: meta.userAgent,
      browser: meta.ua.browser,
      browserVersion: meta.ua.browserVersion,
      os: meta.ua.os,
      deviceType: meta.ua.deviceType,
      ipTruncated: meta.ipTruncated,
      ipHash: meta.ipHash,
      country: meta.geo?.country,
      countryCode: meta.geo?.countryCode,
      region: meta.geo?.region,
      city: meta.geo?.city,
      screenW: start?.screenW,
      screenH: start?.screenH,
      viewportW: start?.viewportW,
      viewportH: start?.viewportH,
      dpr: start?.dpr,
      language: start?.language || undefined,
      timezone: start?.timezone || undefined,
      exitPath: end?.exitPath,
      exitTitle: end?.exitTitle
    });

    const dataToUpdate = {
      ...mutable,
      lastSeenAt,
      pageCount: maxSequence,
      ...(end ? { endedAt: new Date(end.ts) } : {})
    };

    await this.adapter.upsertSession(payload.sessionId, dataToUpdate, setOnInsert);
  }

  private async writePageviews(
    payload: CollectPayload,
    events: AnalyticsEvent[],
    meta: RequestMeta,
    now: Date,
    visitorId: string | undefined
  ): Promise<void> {
    const ops: Array<any> = [];
    const shared = defined({
      sessionId: payload.sessionId,
      visitorId,
      site: payload.site,
      environment: payload.environment,
      deviceType: meta.ua.deviceType,
      countryCode: meta.geo?.countryCode,
      ipHash: meta.ipHash
    });

    for (const event of events) {
      if (event.type === 'pageview') {
        const referrer = classifyReferrer(event.referrer, this.internalHosts);
        ops.push({
          sessionId: payload.sessionId,
          sequence: event.sequence,
          data: {
            ...shared,
            path: event.path,
            title: event.title,
            query: event.query,
            articleSlug: event.articleSlug,
            category: event.category,
            referrer: referrer.referrer
          },
          setOnInsert: {
            startedAt: new Date(event.ts),
            createdAt: now,
            durationMs: 0,
            visibleMs: 0,
            maxScrollPct: 0,
            isExit: false
          }
        });
        continue;
      }

      if (event.type === 'page_exit') {
        ops.push({
          sessionId: payload.sessionId,
          sequence: event.sequence,
          data: {
            ...shared,
            path: event.path,
            endedAt: new Date(event.ts),
            durationMs: event.durationMs,
            visibleMs: event.visibleMs,
            maxScrollPct: event.maxScrollPct
          },
          setOnInsert: {
            startedAt: new Date(event.ts - event.durationMs),
            createdAt: now,
            isExit: false
          }
        });
        continue;
      }
    }

    if (ops.length > 0) {
      await this.adapter.bulkUpsertPageviews(ops).catch(console.error);
    }

    const sessionEnd = events.findLast(e => e.type === 'session_end') as Extract<AnalyticsEvent, { type: 'session_end' }> | undefined;
    if (sessionEnd && sessionEnd.pageCount > 0) {
      await this.adapter.markExitPage(payload.sessionId, sessionEnd.pageCount).catch(console.error);
    }
  }

  private async writeCustomEvents(
    payload: CollectPayload,
    events: AnalyticsEvent[],
    now: Date,
    visitorId: string | undefined
  ): Promise<void> {
    const custom = events.filter((e) => e.type === 'event') as Extract<AnalyticsEvent, { type: 'event' }>[];
    if (custom.length === 0) return;

    await this.adapter.insertEvents(
      custom.map((e) => ({
        sessionId: payload.sessionId,
        visitorId,
        site: payload.site,
        environment: payload.environment,
        name: e.name,
        path: e.path,
        props: e.props,
        occurredAt: new Date(e.ts),
        createdAt: now
      }))
    ).catch(console.error);
  }
}
