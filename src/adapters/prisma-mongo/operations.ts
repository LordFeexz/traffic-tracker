import type { TrafficAdapter, SessionUpsertData, PageviewUpsertData, TrafficEventInsert } from '../../adapter';
import type { 
  CRangeQueryDTO, 
  CSessionListQueryDTO, 
  OverviewStats, 
  PageStat, 
  EntryExitStats, 
  ReferrerStats, 
  GeoStats, 
  TechStats, 
  SessionsPage, 
  AllStats, 
  QueryStat 
} from '../../types';
import type { ResolvedRange } from '../../core/range';

export interface PrismaMongoAdapterOptions {
  sessionModel?: string;
  pageviewModel?: string;
  eventModel?: string;
}

function parseNum(v: any): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === 'number') return v;
  if (typeof v === 'object') {
    if ('$numberInt' in v) return parseInt(v.$numberInt, 10);
    if ('$numberDouble' in v) return parseFloat(v.$numberDouble);
    if ('$numberLong' in v) return parseInt(v.$numberLong, 10);
  }
  const n = Number(v);
  return isNaN(n) ? 0 : n;
}

function parseDateStr(v: any): string {
  if (!v) return new Date().toISOString();
  if (typeof v === 'string') return v;
  if (v instanceof Date) return v.toISOString();
  if (typeof v === 'object' && '$date' in v) {
    return typeof v.$date === 'string' ? v.$date : new Date(v.$date).toISOString();
  }
  return new Date(v).toISOString();
}

export class PrismaMongoTrafficAdapter implements TrafficAdapter {
  private prisma: any;
  private sessionModelName: string;
  private pageviewModelName: string;
  private eventModelName: string;

  constructor(prisma: any, options?: PrismaMongoAdapterOptions) {
    this.prisma = prisma;
    this.sessionModelName = options?.sessionModel || (prisma.trafficSession ? 'trafficSession' : 'TrafficSession');
    this.pageviewModelName = options?.pageviewModel || (prisma.trafficPageview ? 'trafficPageview' : 'TrafficPageview');
    this.eventModelName = options?.eventModel || (prisma.trafficEvent ? 'trafficEvent' : 'TrafficEvent');
  }

  private get sessions() {
    const model = this.prisma[this.sessionModelName];
    if (!model) throw new Error(`Prisma model "${this.sessionModelName}" not found on prisma client.`);
    return model;
  }

  private get pageviews() {
    const model = this.prisma[this.pageviewModelName];
    if (!model) throw new Error(`Prisma model "${this.pageviewModelName}" not found on prisma client.`);
    return model;
  }

  private get events() {
    const model = this.prisma[this.eventModelName];
    if (!model) throw new Error(`Prisma model "${this.eventModelName}" not found on prisma client.`);
    return model;
  }

  async upsertSession(sessionId: string, data: Partial<SessionUpsertData>, setOnInsert: Partial<SessionUpsertData>): Promise<void> {
    const createData: Record<string, any> = {
      sessionId,
      site: data.site ?? setOnInsert.site ?? '',
      environment: data.environment ?? setOnInsert.environment ?? 'production',
      consentMode: data.consentMode ?? setOnInsert.consentMode ?? 'anonymous',
      startedAt: setOnInsert.startedAt ?? data.startedAt ?? new Date(),
      lastSeenAt: data.lastSeenAt ?? setOnInsert.lastSeenAt ?? new Date(),
      entryPath: setOnInsert.entryPath ?? data.entryPath ?? '/',
      referrerType: setOnInsert.referrerType ?? data.referrerType ?? 'direct',
      deviceType: setOnInsert.deviceType ?? data.deviceType ?? 'desktop',
      durationMs: data.durationMs ?? setOnInsert.durationMs ?? 0,
      pageCount: data.pageCount ?? setOnInsert.pageCount ?? 0,
      createdAt: setOnInsert.createdAt ?? new Date()
    };

    if (data.visitorId !== undefined || setOnInsert.visitorId !== undefined) createData.visitorId = data.visitorId ?? setOnInsert.visitorId;
    if (data.userId !== undefined || setOnInsert.userId !== undefined) createData.userId = data.userId ?? setOnInsert.userId;
    if (data.endedAt !== undefined || setOnInsert.endedAt !== undefined) createData.endedAt = data.endedAt ?? setOnInsert.endedAt;
    if (data.entryTitle !== undefined || setOnInsert.entryTitle !== undefined) createData.entryTitle = data.entryTitle ?? setOnInsert.entryTitle;
    if (data.exitPath !== undefined || setOnInsert.exitPath !== undefined) createData.exitPath = data.exitPath ?? setOnInsert.exitPath;
    if (data.exitTitle !== undefined || setOnInsert.exitTitle !== undefined) createData.exitTitle = data.exitTitle ?? setOnInsert.exitTitle;
    if (data.referrer !== undefined || setOnInsert.referrer !== undefined) createData.referrer = data.referrer ?? setOnInsert.referrer;
    if (data.referrerHost !== undefined || setOnInsert.referrerHost !== undefined) createData.referrerHost = data.referrerHost ?? setOnInsert.referrerHost;
    if (data.utm !== undefined || setOnInsert.utm !== undefined) createData.utm = data.utm ?? setOnInsert.utm;
    if (data.userAgent !== undefined || setOnInsert.userAgent !== undefined) createData.userAgent = data.userAgent ?? setOnInsert.userAgent;
    if (data.browser !== undefined || setOnInsert.browser !== undefined) createData.browser = data.browser ?? setOnInsert.browser;
    if (data.browserVersion !== undefined || setOnInsert.browserVersion !== undefined) createData.browserVersion = data.browserVersion ?? setOnInsert.browserVersion;
    if (data.os !== undefined || setOnInsert.os !== undefined) createData.os = data.os ?? setOnInsert.os;
    if (data.screenW !== undefined || setOnInsert.screenW !== undefined) createData.screenW = data.screenW ?? setOnInsert.screenW;
    if (data.screenH !== undefined || setOnInsert.screenH !== undefined) createData.screenH = data.screenH ?? setOnInsert.screenH;
    if (data.viewportW !== undefined || setOnInsert.viewportW !== undefined) createData.viewportW = data.viewportW ?? setOnInsert.viewportW;
    if (data.viewportH !== undefined || setOnInsert.viewportH !== undefined) createData.viewportH = data.viewportH ?? setOnInsert.viewportH;
    if (data.dpr !== undefined || setOnInsert.dpr !== undefined) createData.dpr = data.dpr ?? setOnInsert.dpr;
    if (data.language !== undefined || setOnInsert.language !== undefined) createData.language = data.language ?? setOnInsert.language;
    if (data.timezone !== undefined || setOnInsert.timezone !== undefined) createData.timezone = data.timezone ?? setOnInsert.timezone;
    if (data.ipTruncated !== undefined || setOnInsert.ipTruncated !== undefined) createData.ipTruncated = data.ipTruncated ?? setOnInsert.ipTruncated;
    if (data.ipHash !== undefined || setOnInsert.ipHash !== undefined) createData.ipHash = data.ipHash ?? setOnInsert.ipHash;
    if (data.country !== undefined || setOnInsert.country !== undefined) createData.country = data.country ?? setOnInsert.country;
    if (data.countryCode !== undefined || setOnInsert.countryCode !== undefined) createData.countryCode = data.countryCode ?? setOnInsert.countryCode;
    if (data.region !== undefined || setOnInsert.region !== undefined) createData.region = data.region ?? setOnInsert.region;
    if (data.city !== undefined || setOnInsert.city !== undefined) createData.city = data.city ?? setOnInsert.city;

    const updateData: Record<string, any> = {};
    if (data.site !== undefined) updateData.site = data.site;
    if (data.environment !== undefined) updateData.environment = data.environment;
    if (data.consentMode !== undefined) updateData.consentMode = data.consentMode;
    if (data.visitorId !== undefined) updateData.visitorId = data.visitorId;
    if (data.userId !== undefined) updateData.userId = data.userId;
    if (data.lastSeenAt !== undefined) updateData.lastSeenAt = data.lastSeenAt;
    if (data.endedAt !== undefined) updateData.endedAt = data.endedAt;
    if (data.exitPath !== undefined) updateData.exitPath = data.exitPath;
    if (data.exitTitle !== undefined) updateData.exitTitle = data.exitTitle;
    if (data.pageCount !== undefined) updateData.pageCount = data.pageCount;
    if (data.durationMs !== undefined) updateData.durationMs = data.durationMs;

    await this.sessions.upsert({
      where: { sessionId },
      create: createData,
      update: updateData
    });

    if (typeof this.prisma.$runCommandRaw === 'function' && data.lastSeenAt) {
      await this.prisma.$runCommandRaw({
        update: 'traffic_sessions',
        updates: [
          {
            q: { sessionId },
            u: [
              {
                $set: {
                  durationMs: {
                    $max: [
                      0,
                      { $subtract: [{ $ifNull: ["$endedAt", "$lastSeenAt"] }, "$startedAt"] }
                    ]
                  }
                }
              }
            ]
          }
        ]
      });
    }
  }

  async upsertPageview(sessionId: string, sequence: number, data: Partial<PageviewUpsertData>, setOnInsert: Partial<PageviewUpsertData>): Promise<void> {
    const createData: Record<string, any> = {
      sessionId,
      sequence,
      site: data.site ?? setOnInsert.site ?? '',
      environment: data.environment ?? setOnInsert.environment ?? 'production',
      path: data.path ?? setOnInsert.path ?? '/',
      startedAt: setOnInsert.startedAt ?? data.startedAt ?? new Date(),
      durationMs: data.durationMs ?? setOnInsert.durationMs ?? 0,
      visibleMs: data.visibleMs ?? setOnInsert.visibleMs ?? 0,
      maxScrollPct: data.maxScrollPct ?? setOnInsert.maxScrollPct ?? 0,
      isExit: data.isExit ?? setOnInsert.isExit ?? false,
      deviceType: data.deviceType ?? setOnInsert.deviceType ?? 'desktop',
      createdAt: setOnInsert.createdAt ?? new Date()
    };

    if (data.visitorId !== undefined || setOnInsert.visitorId !== undefined) createData.visitorId = data.visitorId ?? setOnInsert.visitorId;
    if (data.title !== undefined || setOnInsert.title !== undefined) createData.title = data.title ?? setOnInsert.title;
    if (data.query !== undefined || setOnInsert.query !== undefined) createData.query = data.query ?? setOnInsert.query;
    if (data.articleSlug !== undefined || setOnInsert.articleSlug !== undefined) createData.articleSlug = data.articleSlug ?? setOnInsert.articleSlug;
    if (data.category !== undefined || setOnInsert.category !== undefined) createData.category = data.category ?? setOnInsert.category;
    if (data.referrer !== undefined || setOnInsert.referrer !== undefined) createData.referrer = data.referrer ?? setOnInsert.referrer;
    if (data.endedAt !== undefined || setOnInsert.endedAt !== undefined) createData.endedAt = data.endedAt ?? setOnInsert.endedAt;
    if (data.countryCode !== undefined || setOnInsert.countryCode !== undefined) createData.countryCode = data.countryCode ?? setOnInsert.countryCode;
    if (data.ipHash !== undefined || setOnInsert.ipHash !== undefined) createData.ipHash = data.ipHash ?? setOnInsert.ipHash;

    const updateData: Record<string, any> = {};
    if (data.title !== undefined) updateData.title = data.title;
    if (data.endedAt !== undefined) updateData.endedAt = data.endedAt;
    if (data.durationMs !== undefined) updateData.durationMs = data.durationMs;
    if (data.visibleMs !== undefined) updateData.visibleMs = data.visibleMs;
    if (data.maxScrollPct !== undefined) updateData.maxScrollPct = data.maxScrollPct;
    if (data.isExit !== undefined) updateData.isExit = data.isExit;

    await this.pageviews.upsert({
      where: {
        sessionId_sequence: {
          sessionId,
          sequence
        }
      },
      create: createData,
      update: updateData
    });
  }

  async bulkUpsertPageviews(ops: Array<{ sessionId: string, sequence: number, data: Partial<PageviewUpsertData>, setOnInsert: Partial<PageviewUpsertData> }>): Promise<void> {
    if (ops.length === 0) return;
    await Promise.all(
      ops.map(op => this.upsertPageview(op.sessionId, op.sequence, op.data, op.setOnInsert))
    );
  }

  async markExitPage(sessionId: string, sequence: number): Promise<void> {
    await this.pageviews.updateMany({
      where: { sessionId, sequence },
      data: { isExit: true }
    });
  }

  async insertEvents(events: TrafficEventInsert[]): Promise<void> {
    if (events.length === 0) return;
    await this.events.createMany({
      data: events.map(e => ({
        sessionId: e.sessionId,
        visitorId: e.visitorId,
        site: e.site,
        environment: e.environment || 'production',
        name: e.name,
        path: e.path,
        props: e.props ?? undefined,
        occurredAt: e.occurredAt,
        createdAt: e.createdAt || new Date()
      }))
    });
  }

  private match(query: CRangeQueryDTO, range: { from: Date; to: Date }) {
    return {
      site: query.site,
      deviceType: { $ne: 'bot' },
      startedAt: {
        $gte: { $date: range.from.toISOString() },
        $lt: { $date: range.to.toISOString() }
      }
    };
  }

  async queryOverview(query: CRangeQueryDTO, range: ResolvedRange): Promise<OverviewStats> {
    const getTotals = async (from: Date, to: Date) => {
      const match = this.match(query, { from, to });
      
      const sessionStatsPromise = this.sessions.aggregateRaw({
        pipeline: [
          { $match: match },
          { 
            $group: {
              _id: null,
              sessions: { $sum: 1 },
              visitors: { $addToSet: { $ifNull: ["$visitorId", "$ipHash"] } },
              bounces: { $sum: { $cond: [{ $lte: ["$pageCount", 1] }, 1, 0] } },
              totalDuration: { $sum: "$durationMs" }
            }
          },
          {
            $project: {
              sessions: 1,
              visitors: { $size: "$visitors" },
              bounces: 1,
              avgSessionDurationMs: { $cond: [{ $eq: ["$sessions", 0] }, 0, { $divide: ["$totalDuration", "$sessions"] }] }
            }
          }
        ]
      });

      const pvStatsPromise = this.pageviews.aggregateRaw({
        pipeline: [
          { $match: match },
          { $count: "pageviews" }
        ]
      });

      const [sessionStatsRaw, pvStatsRaw] = await Promise.all([sessionStatsPromise, pvStatsPromise]);
      const s = ((sessionStatsRaw as any[])[0] || {}) as any;
      const p = ((pvStatsRaw as any[])[0] || {}) as any;

      const sessions = parseNum(s.sessions);
      const visitors = parseNum(s.visitors);
      const pageviews = parseNum(p.pageviews);
      const avgSessionDurationMs = parseNum(s.avgSessionDurationMs);
      const bounces = parseNum(s.bounces);

      return {
        sessions,
        visitors,
        pageviews,
        avgSessionDurationMs,
        pagesPerSession: sessions > 0 ? pageviews / sessions : 0,
        bounceRate: sessions > 0 ? bounces / sessions : 0
      };
    };

    const [totals, previous] = await Promise.all([
      getTotals(range.from, range.to),
      getTotals(range.prevFrom, range.prevTo)
    ]);

    const formatString = range.bucket === 'hour' ? "%Y-%m-%dT%H:00:00.000Z" : "%Y-%m-%dT00:00:00.000Z";

    const [tsSessionRaw, tsPvRaw] = await Promise.all([
      this.sessions.aggregateRaw({
        pipeline: [
          { $match: this.match(query, range) },
          { 
            $group: {
              _id: { $dateToString: { format: formatString, date: "$startedAt" } },
              sessions: { $sum: 1 },
              visitors: { $addToSet: { $ifNull: ["$visitorId", "$ipHash"] } }
            }
          }
        ]
      }),
      this.pageviews.aggregateRaw({
        pipeline: [
          { $match: this.match(query, range) },
          { 
            $group: {
              _id: { $dateToString: { format: formatString, date: "$startedAt" } },
              pageviews: { $sum: 1 }
            }
          }
        ]
      })
    ]);

    const tsSession = tsSessionRaw as any[];
    const tsPv = tsPvRaw as any[];

    const pvMap = new Map(tsPv.map((t: any) => [String(t._id), parseNum(t.pageviews)]));
    const timeseries = tsSession.map((t: any) => {
      const id = String(t._id);
      return {
        t: id,
        sessions: parseNum(t.sessions),
        visitors: Array.isArray(t.visitors) ? t.visitors.length : parseNum(t.visitors),
        pageviews: pvMap.get(id) || 0
      };
    }).sort((a, b) => a.t.localeCompare(b.t));

    return {
      range: { from: range.from.toISOString(), to: range.to.toISOString(), bucket: range.bucket },
      totals,
      previous,
      timeseries
    };
  }

  async queryPages(query: CRangeQueryDTO, range: ResolvedRange): Promise<PageStat[]> {
    const res = (await this.pageviews.aggregateRaw({
      pipeline: [
        { $match: this.match(query, range) },
        {
          $group: {
            _id: "$path",
            title: { $last: "$title" },
            pageviews: { $sum: 1 },
            visitors: { $addToSet: { $ifNull: ["$visitorId", "$ipHash"] } },
            exits: { $sum: { $cond: ["$isExit", 1, 0] } },
            totalVisibleMs: { $sum: "$visibleMs" },
            timedViews: { $sum: { $cond: [{ $gt: ["$visibleMs", 0] }, 1, 0] } }
          }
        },
        { $sort: { pageviews: -1 } },
        { $limit: query.limit }
      ]
    })) as any[];

    return res.map((r: any) => {
      const pageviews = parseNum(r.pageviews);
      const exits = parseNum(r.exits);
      const timedViews = parseNum(r.timedViews);
      const totalVisibleMs = parseNum(r.totalVisibleMs);

      return {
        path: String(r._id || '/'),
        title: r.title ? String(r.title) : undefined,
        pageviews,
        visitors: Array.isArray(r.visitors) ? r.visitors.length : parseNum(r.visitors),
        exits,
        avgTimeOnPageMs: timedViews > 0 ? totalVisibleMs / timedViews : 0,
        exitRate: pageviews > 0 ? exits / pageviews : 0
      };
    });
  }

  async queryQueries(query: CRangeQueryDTO, range: ResolvedRange): Promise<QueryStat[]> {
    const res = (await this.pageviews.aggregateRaw({
      pipeline: [
        { $match: { ...this.match(query, range), query: { $exists: true, $ne: "", $type: "string" } } },
        {
          $group: {
            _id: "$query",
            pageviews: { $sum: 1 },
            visitors: { $addToSet: { $ifNull: ["$visitorId", "$ipHash"] } }
          }
        },
        { $sort: { pageviews: -1 } },
        { $limit: query.limit || 50 }
      ]
    })) as any[];

    return res.map((r: any) => ({
      query: String(r._id || ''),
      pageviews: parseNum(r.pageviews),
      visitors: Array.isArray(r.visitors) ? r.visitors.length : parseNum(r.visitors)
    }));
  }

  async queryEntryExit(query: CRangeQueryDTO, range: ResolvedRange): Promise<EntryExitStats> {
    const [entryPagesRaw, exitPagesRaw] = await Promise.all([
      this.sessions.aggregateRaw({
        pipeline: [
          { $match: this.match(query, range) },
          {
            $group: {
              _id: "$entryPath",
              sessions: { $sum: 1 },
              bounces: { $sum: { $cond: [{ $lte: ["$pageCount", 1] }, 1, 0] } }
            }
          },
          { $sort: { sessions: -1 } },
          { $limit: query.limit }
        ]
      }),
      this.sessions.aggregateRaw({
        pipeline: [
          { $match: { ...this.match(query, range), exitPath: { $exists: true, $ne: null } } },
          {
            $group: {
              _id: "$exitPath",
              sessions: { $sum: 1 }
            }
          },
          { $sort: { sessions: -1 } },
          { $limit: query.limit }
        ]
      })
    ]);

    const entryPages = entryPagesRaw as any[];
    const exitPages = exitPagesRaw as any[];

    return {
      entryPages: entryPages.map((r: any) => {
        const sessions = parseNum(r.sessions);
        const bounces = parseNum(r.bounces);
        return {
          path: String(r._id || '/'),
          sessions,
          bounceRate: sessions > 0 ? bounces / sessions : 0
        };
      }),
      exitPages: exitPages.map((r: any) => ({
        path: String(r._id || '/'),
        sessions: parseNum(r.sessions),
        exitRate: 0
      }))
    };
  }

  async queryReferrers(query: CRangeQueryDTO, range: ResolvedRange): Promise<ReferrerStats> {
    const [byTypeRaw, byHostRaw] = await Promise.all([
      this.sessions.aggregateRaw({
        pipeline: [
          { $match: this.match(query, range) },
          {
            $group: {
              _id: { $ifNull: ["$referrerType", "direct"] },
              count: { $sum: 1 }
            }
          },
          { $sort: { count: -1 } },
          { $limit: 10 }
        ]
      }),
      this.sessions.aggregateRaw({
        pipeline: [
          { $match: { ...this.match(query, range), referrerHost: { $exists: true, $nin: [null, ''] } } },
          {
            $group: {
              _id: "$referrerHost",
              count: { $sum: 1 }
            }
          },
          { $sort: { count: -1 } },
          { $limit: query.limit }
        ]
      })
    ]);

    const byType = byTypeRaw as any[];
    const byHost = byHostRaw as any[];

    return {
      byType: byType.map((r: any) => ({ name: String(r._id || 'direct'), count: parseNum(r.count) })),
      byHost: byHost.map((r: any) => ({ name: String(r._id || ''), count: parseNum(r.count) })),
      campaigns: []
    };
  }

  async queryGeo(query: CRangeQueryDTO, range: ResolvedRange): Promise<GeoStats> {
    const countriesRaw = (await this.sessions.aggregateRaw({
      pipeline: [
        { $match: { ...this.match(query, range), countryCode: { $exists: true, $nin: [null, ''] } } },
        {
          $group: {
            _id: "$countryCode",
            sessions: { $sum: 1 },
            pageviews: { $sum: { $cond: [{ $gt: ["$pageCount", 0] }, "$pageCount", 1] } }
          }
        },
        { $sort: { sessions: -1 } },
        { $limit: query.limit }
      ]
    })) as any[];

    return {
      countries: countriesRaw.map((r: any) => ({
        code: String(r._id),
        name: String(r._id),
        sessions: parseNum(r.sessions),
        pageviews: parseNum(r.pageviews)
      })),
      regions: [],
      cities: []
    };
  }

  async queryTech(query: CRangeQueryDTO, range: ResolvedRange): Promise<TechStats> {
    const devicesRaw = (await this.sessions.aggregateRaw({
      pipeline: [
        { $match: this.match(query, range) },
        {
          $group: {
            _id: { $ifNull: ["$deviceType", "desktop"] },
            count: { $sum: 1 }
          }
        },
        { $sort: { count: -1 } },
        { $limit: 10 }
      ]
    })) as any[];

    return {
      devices: devicesRaw.map((r: any) => ({ name: String(r._id || 'desktop'), count: parseNum(r.count) })),
      browsers: [],
      os: [],
      screenSizes: []
    };
  }

  async querySessions(query: CSessionListQueryDTO, range: ResolvedRange): Promise<SessionsPage> {
    const limit = query.limit || 25;
    const page = query.page || 1;
    const skip = (page - 1) * limit;

    const match = this.match(query, range);

    const [totalCountRaw, sessionsRaw] = await Promise.all([
      this.sessions.aggregateRaw({
        pipeline: [
          { $match: match },
          { $count: "count" }
        ]
      }),
      this.sessions.aggregateRaw({
        pipeline: [
          { $match: match },
          { $sort: { lastSeenAt: -1 } },
          { $skip: skip },
          { $limit: limit }
        ]
      })
    ]);

    const total = parseNum(((totalCountRaw as any[])[0] || {}).count);
    const sessions = (sessionsRaw as any[]).map((s: any) => {
      const pageCount = parseNum(s.pageCount);
      return {
        sessionId: String(s.sessionId),
        startedAt: parseDateStr(s.startedAt),
        lastSeenAt: parseDateStr(s.lastSeenAt),
        endedAt: s.endedAt ? parseDateStr(s.endedAt) : undefined,
        durationMs: parseNum(s.durationMs),
        pageCount,
        isBounce: pageCount <= 1,
        entryPath: String(s.entryPath || '/'),
        exitPath: s.exitPath ? String(s.exitPath) : undefined,
        referrerHost: s.referrerHost ? String(s.referrerHost) : undefined,
        referrerType: (s.referrerType as any) || 'direct',
        deviceType: (s.deviceType as any) || 'desktop',
        browser: s.browser ? String(s.browser) : undefined,
        os: s.os ? String(s.os) : undefined,
        screenW: s.screenW !== undefined ? parseNum(s.screenW) : undefined,
        screenH: s.screenH !== undefined ? parseNum(s.screenH) : undefined,
        ipTruncated: s.ipTruncated ? String(s.ipTruncated) : undefined,
        countryCode: s.countryCode ? String(s.countryCode) : undefined,
        country: s.country ? String(s.country) : undefined,
        city: s.city ? String(s.city) : undefined,
        isLive: false
      };
    });

    return {
      total,
      page,
      limit,
      sessions
    };
  }

  async queryAll(query: CRangeQueryDTO & CSessionListQueryDTO, range: ResolvedRange): Promise<AllStats> {
    const formatString = range.bucket === 'hour' ? "%Y-%m-%dT%H:00:00.000Z" : "%Y-%m-%dT00:00:00.000Z";

    const matchSessions = this.match(query, range);
    const matchPageviews = this.match(query, range);
    const matchPrevSessions = this.match(query, { from: range.prevFrom, to: range.prevTo });
    const matchPrevPageviews = this.match(query, { from: range.prevFrom, to: range.prevTo });

    const sessionFacet = {
      totals: [
        { 
          $group: {
            _id: null,
            sessions: { $sum: 1 },
            visitors: { $addToSet: { $ifNull: ["$visitorId", "$ipHash"] } },
            bounces: { $sum: { $cond: [{ $lte: ["$pageCount", 1] }, 1, 0] } },
            totalDuration: { $sum: "$durationMs" }
          }
        }
      ],
      timeseries: [
        { 
          $group: {
            _id: { $dateToString: { format: formatString, date: "$startedAt" } },
            sessions: { $sum: 1 },
            visitors: { $addToSet: { $ifNull: ["$visitorId", "$ipHash"] } }
          }
        }
      ],
      entryPages: [
        {
          $group: {
            _id: "$entryPath",
            sessions: { $sum: 1 },
            bounces: { $sum: { $cond: [{ $lte: ["$pageCount", 1] }, 1, 0] } }
          }
        },
        { $sort: { sessions: -1 } },
        { $limit: query.limit || 50 }
      ],
      exitPages: [
        { $match: { exitPath: { $exists: true, $ne: null } } },
        {
          $group: {
            _id: "$exitPath",
            sessions: { $sum: 1 }
          }
        },
        { $sort: { sessions: -1 } },
        { $limit: query.limit || 50 }
      ],
      refType: [
        {
          $group: {
            _id: { $ifNull: ["$referrerType", "direct"] },
            count: { $sum: 1 }
          }
        },
        { $sort: { count: -1 } },
        { $limit: 10 }
      ],
      refHost: [
        { $match: { referrerHost: { $exists: true, $nin: [null, ''] } } },
        {
          $group: {
            _id: "$referrerHost",
            count: { $sum: 1 }
          }
        },
        { $sort: { count: -1 } },
        { $limit: query.limit || 50 }
      ],
      geoCountries: [
        { $match: { countryCode: { $exists: true, $nin: [null, ''] } } },
        {
          $group: {
            _id: "$countryCode",
            sessions: { $sum: 1 },
            pageviews: { $sum: { $cond: [{ $gt: ["$pageCount", 0] }, "$pageCount", 1] } }
          }
        },
        { $sort: { sessions: -1 } },
        { $limit: query.limit || 50 }
      ],
      techDevices: [
        {
          $group: {
            _id: { $ifNull: ["$deviceType", "desktop"] },
            count: { $sum: 1 }
          }
        },
        { $sort: { count: -1 } },
        { $limit: 10 }
      ]
    };

    const sessionListFacet = {
      sessionsList: [
        { $sort: { lastSeenAt: -1 } },
        { $skip: ((query.page || 1) - 1) * (query.limit || 25) },
        { $limit: query.limit || 25 }
      ],
      totalCount: [
        { $count: "count" }
      ]
    };

    const pageviewFacet = {
      totals: [
        { $count: "pageviews" }
      ],
      timeseries: [
        { 
          $group: {
            _id: { $dateToString: { format: formatString, date: "$startedAt" } },
            pageviews: { $sum: 1 }
          }
        }
      ],
      pages: [
        {
          $group: {
            _id: "$path",
            title: { $last: "$title" },
            pageviews: { $sum: 1 },
            visitors: { $addToSet: { $ifNull: ["$visitorId", "$ipHash"] } },
            exits: { $sum: { $cond: ["$isExit", 1, 0] } },
            totalVisibleMs: { $sum: "$visibleMs" },
            timedViews: { $sum: { $cond: [{ $gt: ["$visibleMs", 0] }, 1, 0] } }
          }
        },
        { $sort: { pageviews: -1 } },
        { $limit: query.limit || 50 }
      ]
    };

    const [
      sessionResRaw,
      sessionListResRaw,
      pvResRaw,
      prevSessionTotalsRaw,
      prevPvTotalsRaw
    ] = await Promise.all([
      this.sessions.aggregateRaw({ pipeline: [{ $match: matchSessions }, { $facet: sessionFacet }] }),
      this.sessions.aggregateRaw({ pipeline: [{ $match: matchSessions }, { $facet: sessionListFacet }] }),
      this.pageviews.aggregateRaw({ pipeline: [{ $match: matchPageviews }, { $facet: pageviewFacet }] }),
      this.sessions.aggregateRaw({
        pipeline: [
          { $match: matchPrevSessions },
          { 
            $group: {
              _id: null,
              sessions: { $sum: 1 },
              visitors: { $addToSet: { $ifNull: ["$visitorId", "$ipHash"] } },
              bounces: { $sum: { $cond: [{ $lte: ["$pageCount", 1] }, 1, 0] } },
              totalDuration: { $sum: "$durationMs" }
            }
          }
        ]
      }),
      this.pageviews.aggregateRaw({
        pipeline: [
          { $match: matchPrevPageviews },
          { $count: "count" }
        ]
      })
    ]);

    const s = (sessionResRaw as any[])[0] || {};
    const sList = (sessionListResRaw as any[])[0] || {};
    const p = (pvResRaw as any[])[0] || {};

    const sTotals = (s.totals && s.totals[0]) || { sessions: 0, visitors: [], bounces: 0, totalDuration: 0 };
    const pTotals = (p.totals && p.totals[0]) || { pageviews: 0 };
    const prevSTotals = ((prevSessionTotalsRaw as any[])[0]) || { sessions: 0, visitors: [], bounces: 0, totalDuration: 0 };
    const prevPTotals = parseNum(((prevPvTotalsRaw as any[])[0])?.count);

    const sSessions = parseNum(sTotals.sessions);
    const sVisitors = Array.isArray(sTotals.visitors) ? sTotals.visitors.length : parseNum(sTotals.visitors);
    const pPageviews = parseNum(pTotals.pageviews);
    const sTotalDuration = parseNum(sTotals.totalDuration);
    const sBounces = parseNum(sTotals.bounces);

    const prevSessions = parseNum(prevSTotals.sessions);
    const prevVisitors = Array.isArray(prevSTotals.visitors) ? prevSTotals.visitors.length : parseNum(prevSTotals.visitors);
    const prevDuration = parseNum(prevSTotals.totalDuration);
    const prevBounces = parseNum(prevSTotals.bounces);

    const totals = {
      sessions: sSessions,
      visitors: sVisitors,
      pageviews: pPageviews,
      avgSessionDurationMs: sSessions > 0 ? sTotalDuration / sSessions : 0,
      pagesPerSession: sSessions > 0 ? pPageviews / sSessions : 0,
      bounceRate: sSessions > 0 ? sBounces / sSessions : 0
    };

    const previous = {
      sessions: prevSessions,
      visitors: prevVisitors,
      pageviews: prevPTotals,
      avgSessionDurationMs: prevSessions > 0 ? prevDuration / prevSessions : 0,
      pagesPerSession: prevSessions > 0 ? prevPTotals / prevSessions : 0,
      bounceRate: prevSessions > 0 ? prevBounces / prevSessions : 0
    };

    const pvTimeseries = (p.timeseries || []) as any[];
    const pvMap = new Map(pvTimeseries.map((t: any) => [String(t._id), parseNum(t.pageviews)]));

    const sTimeseries = (s.timeseries || []) as any[];
    const timeseries = sTimeseries.map((t: any) => {
      const id = String(t._id);
      return {
        t: id,
        sessions: parseNum(t.sessions),
        visitors: Array.isArray(t.visitors) ? t.visitors.length : parseNum(t.visitors),
        pageviews: pvMap.get(id) || 0
      };
    }).sort((a: any, b: any) => a.t.localeCompare(b.t));

    const pPages = (p.pages || []) as any[];
    const sEntryPages = (s.entryPages || []) as any[];
    const sExitPages = (s.exitPages || []) as any[];
    const sRefType = (s.refType || []) as any[];
    const sRefHost = (s.refHost || []) as any[];
    const sGeoCountries = (s.geoCountries || []) as any[];
    const sTechDevices = (s.techDevices || []) as any[];
    const sSessionsList = (sList.sessionsList || []) as any[];

    return {
      overview: {
        range: { from: range.from.toISOString(), to: range.to.toISOString(), bucket: range.bucket },
        totals,
        previous,
        timeseries
      },
      queries: await this.queryQueries(query, range),
      pages: pPages.map((r: any) => {
        const pageviews = parseNum(r.pageviews);
        const exits = parseNum(r.exits);
        const timedViews = parseNum(r.timedViews);
        const totalVisibleMs = parseNum(r.totalVisibleMs);
        return {
          path: String(r._id || '/'),
          title: r.title ? String(r.title) : undefined,
          pageviews,
          visitors: Array.isArray(r.visitors) ? r.visitors.length : parseNum(r.visitors),
          exits,
          avgTimeOnPageMs: timedViews > 0 ? totalVisibleMs / timedViews : 0,
          exitRate: pageviews > 0 ? exits / pageviews : 0
        };
      }),
      entryExit: {
        entryPages: sEntryPages.map((r: any) => {
          const sessions = parseNum(r.sessions);
          const bounces = parseNum(r.bounces);
          return {
            path: String(r._id || '/'),
            sessions,
            bounceRate: sessions > 0 ? bounces / sessions : 0
          };
        }),
        exitPages: sExitPages.map((r: any) => ({
          path: String(r._id || '/'),
          sessions: parseNum(r.sessions),
          exitRate: 0
        }))
      },
      referrers: {
        byType: sRefType.map((r: any) => ({ name: String(r._id || 'direct'), count: parseNum(r.count) })),
        byHost: sRefHost.map((r: any) => ({ name: String(r._id || ''), count: parseNum(r.count) })),
        campaigns: []
      },
      geo: {
        countries: sGeoCountries.map((r: any) => ({
          code: String(r._id),
          name: String(r._id),
          sessions: parseNum(r.sessions),
          pageviews: parseNum(r.pageviews)
        })),
        regions: [],
        cities: []
      },
      tech: {
        devices: sTechDevices.map((r: any) => ({ name: String(r._id || 'desktop'), count: parseNum(r.count) })),
        browsers: [],
        os: [],
        screenSizes: []
      },
      sessions: {
        total: parseNum(sList.totalCount && sList.totalCount[0]?.count),
        page: query.page || 1,
        limit: query.limit || 25,
        sessions: sSessionsList.map((sess: any) => {
          const pageCount = parseNum(sess.pageCount);
          return {
            sessionId: String(sess.sessionId),
            startedAt: parseDateStr(sess.startedAt),
            lastSeenAt: parseDateStr(sess.lastSeenAt),
            endedAt: sess.endedAt ? parseDateStr(sess.endedAt) : undefined,
            durationMs: parseNum(sess.durationMs),
            pageCount,
            isBounce: pageCount <= 1,
            entryPath: String(sess.entryPath || '/'),
            exitPath: sess.exitPath ? String(sess.exitPath) : undefined,
            referrerHost: sess.referrerHost ? String(sess.referrerHost) : undefined,
            referrerType: (sess.referrerType as any) || 'direct',
            deviceType: (sess.deviceType as any) || 'desktop',
            browser: sess.browser ? String(sess.browser) : undefined,
            os: sess.os ? String(sess.os) : undefined,
            screenW: sess.screenW !== undefined ? parseNum(sess.screenW) : undefined,
            screenH: sess.screenH !== undefined ? parseNum(sess.screenH) : undefined,
            ipTruncated: sess.ipTruncated ? String(sess.ipTruncated) : undefined,
            countryCode: sess.countryCode ? String(sess.countryCode) : undefined,
            country: sess.country ? String(sess.country) : undefined,
            city: sess.city ? String(sess.city) : undefined,
            isLive: false
          };
        })
      }
    };
  }
}
