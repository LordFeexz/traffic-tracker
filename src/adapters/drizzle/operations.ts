import type { TrafficAdapter, SessionUpsertData, PageviewUpsertData, TrafficEventInsert } from '../../adapter';
import type { CRangeQueryDTO, CSessionListQueryDTO, OverviewStats, PageStat, EntryExitStats, ReferrerStats, GeoStats, TechStats, SessionsPage } from '../../types';
import type { ResolvedRange } from '../../core/range';
import { sql, eq, and, desc, gte, lt, count, avg, sum } from 'drizzle-orm';
import { trafficSessions, trafficPageviews, trafficEvents } from './schema';

export interface DrizzleSchemaConfig {
  sessions: any;
  pageviews: any;
  events: any;
}

export class DrizzleTrafficAdapter implements TrafficAdapter {
  private sessions: any;
  private pageviews: any;
  private events: any;

  constructor(private db: any, schema?: DrizzleSchemaConfig) {
    this.sessions = schema?.sessions ?? trafficSessions;
    this.pageviews = schema?.pageviews ?? trafficPageviews;
    this.events = schema?.events ?? trafficEvents;
  }

  async upsertSession(sessionId: string, data: Partial<SessionUpsertData>, setOnInsert: Partial<SessionUpsertData>): Promise<void> {
    const insertData = { ...setOnInsert, ...data, sessionId } as any;
    
    // We only update mutable fields on conflict
    const updateData: any = { ...data };
    
    // For timestamps we want to advance them
    if (data.lastSeenAt) {
      updateData.lastSeenAt = sql`GREATEST(${this.sessions.lastSeenAt}, ${data.lastSeenAt.toISOString()})`;
    }
    if (data.pageCount) {
      updateData.pageCount = sql`GREATEST(${this.sessions.pageCount}, ${data.pageCount})`;
    }
    
    // EndedAt is tricky. In Mongo we conditionally removed it if lastSeenAt > endedAt.
    // In SQL we can use a CASE statement.
    if (data.lastSeenAt) {
        updateData.endedAt = sql`CASE WHEN ${data.lastSeenAt.toISOString()} > COALESCE(${this.sessions.endedAt}, '1970-01-01'::timestamp) THEN NULL ELSE ${this.sessions.endedAt} END`;
    }
    // Only set duration if we can
    updateData.durationMs = sql`GREATEST(0, EXTRACT(EPOCH FROM (COALESCE(${this.sessions.endedAt}, ${this.sessions.lastSeenAt}) - ${this.sessions.startedAt})) * 1000)`;

    // Remove undefined
    Object.keys(updateData).forEach(key => updateData[key as keyof typeof updateData] === undefined && delete updateData[key as keyof typeof updateData]);

    if (Object.keys(updateData).length > 0) {
      await this.db.insert(this.sessions)
        .values(insertData)
        .onConflictDoUpdate({
          target: this.sessions.sessionId,
          set: updateData
        });
    } else {
      await this.db.insert(this.sessions)
        .values(insertData)
        .onConflictDoNothing();
    }
  }

  async upsertPageview(sessionId: string, sequence: number, data: Partial<PageviewUpsertData>, setOnInsert: Partial<PageviewUpsertData>): Promise<void> {
    const insertData = { ...setOnInsert, ...data, sessionId, sequence } as any;
    
    const updateData: any = { ...data };
    if (data.durationMs !== undefined) {
        updateData.durationMs = sql`GREATEST(COALESCE(${this.pageviews.durationMs}, 0), ${data.durationMs})`;
    }
    if (data.visibleMs !== undefined) {
        updateData.visibleMs = sql`GREATEST(COALESCE(${this.pageviews.visibleMs}, 0), ${data.visibleMs})`;
    }
    if (data.maxScrollPct !== undefined) {
        updateData.maxScrollPct = sql`GREATEST(COALESCE(${this.pageviews.maxScrollPct}, 0), ${data.maxScrollPct})`;
    }

    Object.keys(updateData).forEach(key => updateData[key as keyof typeof updateData] === undefined && delete updateData[key as keyof typeof updateData]);

    if (Object.keys(updateData).length > 0) {
      await this.db.insert(this.pageviews)
        .values(insertData)
        .onConflictDoUpdate({
          target: [this.pageviews.sessionId, this.pageviews.sequence],
          set: updateData
        });
    } else {
      await this.db.insert(this.pageviews)
        .values(insertData)
        .onConflictDoNothing();
    }
  }

  async bulkUpsertPageviews(ops: Array<{ sessionId: string, sequence: number, data: Partial<PageviewUpsertData>, setOnInsert: Partial<PageviewUpsertData> }>): Promise<void> {
    // For SQLite, bulk upsert might be limited, but Drizzle supports array inserts
    // However, onConflictDoUpdate with different values per row is not supported directly in standard bulk insert in all dialects.
    // For MVP, we will run them sequentially or in a transaction.
    await this.db.transaction(async (tx: any) => {
        for (const op of ops) {
            const insertData = { ...op.setOnInsert, ...op.data, sessionId: op.sessionId, sequence: op.sequence } as any;
            const updateData: any = { ...op.data };
            if (op.data.durationMs !== undefined) {
                updateData.durationMs = sql`GREATEST(COALESCE(${this.pageviews.durationMs}, 0), ${op.data.durationMs})`;
            }
            if (op.data.visibleMs !== undefined) {
                updateData.visibleMs = sql`GREATEST(COALESCE(${this.pageviews.visibleMs}, 0), ${op.data.visibleMs})`;
            }
            if (op.data.maxScrollPct !== undefined) {
                updateData.maxScrollPct = sql`GREATEST(COALESCE(${this.pageviews.maxScrollPct}, 0), ${op.data.maxScrollPct})`;
            }
            Object.keys(updateData).forEach(key => updateData[key as keyof typeof updateData] === undefined && delete updateData[key as keyof typeof updateData]);

            if (Object.keys(updateData).length > 0) {
                await tx.insert(this.pageviews)
                    .values(insertData)
                    .onConflictDoUpdate({
                        target: [this.pageviews.sessionId, this.pageviews.sequence],
                        set: updateData
                    });
            } else {
                await tx.insert(this.pageviews)
                    .values(insertData)
                    .onConflictDoNothing();
            }
        }
    });
  }

  async markExitPage(sessionId: string, sequence: number): Promise<void> {
    await this.db.update(this.pageviews)
      .set({ isExit: true })
      .where(and(eq(this.pageviews.sessionId, sessionId), eq(this.pageviews.sequence, sequence)));
  }

  async insertEvents(events: TrafficEventInsert[]): Promise<void> {
    if (events.length === 0) return;
    await this.db.insert(this.events).values(events);
  }

  private matchSessions(query: CRangeQueryDTO, from: Date, to: Date) {
    return and(
      eq(this.sessions.site, query.site),
      sql`${this.sessions.deviceType} != 'bot'`,
      gte(this.sessions.startedAt, from),
      lt(this.sessions.startedAt, to)
    );
  }
  
  private matchPageviews(query: CRangeQueryDTO, from: Date, to: Date) {
    return and(
      eq(this.pageviews.site, query.site),
      sql`${this.pageviews.deviceType} != 'bot'`,
      gte(this.pageviews.startedAt, from),
      lt(this.pageviews.startedAt, to)
    );
  }

  async queryOverview(query: CRangeQueryDTO, range: ResolvedRange): Promise<OverviewStats> {
    const getTotals = async (from: Date, to: Date) => {
        const [sessionRes] = await this.db.select({
            sessions: count(),
            visitors: sql<number>`count(distinct coalesce(${this.sessions.visitorId}, ${this.sessions.ipHash}))`,
            avgSessionDurationMs: avg(this.sessions.durationMs),
            bounces: sql<number>`sum(case when ${this.sessions.pageCount} <= 1 then 1 else 0 end)`
        }).from(this.sessions).where(this.matchSessions(query, from, to));

        const [pvRes] = await this.db.select({
            pageviews: count()
        }).from(this.pageviews).where(this.matchPageviews(query, from, to));

        const sessions = Number(sessionRes?.sessions || 0);
        return {
            sessions,
            visitors: Number(sessionRes?.visitors || 0),
            pageviews: Number(pvRes?.pageviews || 0),
            avgSessionDurationMs: Number(sessionRes?.avgSessionDurationMs || 0),
            pagesPerSession: sessions > 0 ? Number(pvRes?.pageviews || 0) / sessions : 0,
            bounceRate: sessions > 0 ? Number(sessionRes?.bounces || 0) / sessions : 0
        };
    };

    const [totals, previous] = await Promise.all([
        getTotals(range.from, range.to),
        getTotals(range.prevFrom, range.prevTo)
    ]);

    // Timeseries requires grouping by time bucket (day/hour)
    // For SQLite, DATE_TRUNC doesn't exist, we'll use a simpler approximation if needed, 
    // but in a real adapter we might need dialect-specific SQL here.
    // Assuming PG for this specific query as an example.
    
    let timeFormat = range.bucket === 'hour' ? 'YYYY-MM-DD HH24:00:00' : 'YYYY-MM-DD 00:00:00';
    
    // SQLite doesn't support to_char, so this is a simplified version.
    // A robust adapter would abstract this.
    const timeseriesRaw = await this.db.select({
        t: sql<string>`substr(cast(${this.sessions.startedAt} as text), 1, ${range.bucket === 'hour' ? 13 : 10})`,
        sessions: count(),
        visitors: sql<number>`count(distinct coalesce(${this.sessions.visitorId}, ${this.sessions.ipHash}))`
    }).from(this.sessions)
      .where(this.matchSessions(query, range.from, range.to))
      .groupBy(sql`1`)
      .orderBy(sql`1`);
      
    const pvTimeseriesRaw = await this.db.select({
        t: sql<string>`substr(cast(${this.pageviews.startedAt} as text), 1, ${range.bucket === 'hour' ? 13 : 10})`,
        pageviews: count()
    }).from(this.pageviews)
      .where(this.matchPageviews(query, range.from, range.to))
      .groupBy(sql`1`);

    const pvMap = new Map(pvTimeseriesRaw.map((p: any) => [p.t, Number(p.pageviews)]));

    const timeseries = timeseriesRaw.map((t: any) => ({
        t: t.t,
        sessions: Number(t.sessions),
        visitors: Number(t.visitors),
        pageviews: pvMap.get(t.t) || 0
    }));

    return {
        range: { from: range.from.toISOString(), to: range.to.toISOString(), bucket: range.bucket },
        totals,
        previous,
        timeseries
    };
  }

  async queryPages(query: CRangeQueryDTO, range: ResolvedRange): Promise<PageStat[]> {
    const res = await this.db.select({
        path: this.pageviews.path,
        title: sql<string>`max(${this.pageviews.title})`,
        pageviews: count(),
        visitors: sql<number>`count(distinct coalesce(${this.pageviews.visitorId}, ${this.pageviews.ipHash}))`,
        exits: sql<number>`sum(case when ${this.pageviews.isExit} = true then 1 else 0 end)`,
        totalVisibleMs: sum(this.pageviews.visibleMs),
        timedViews: sql<number>`sum(case when ${this.pageviews.visibleMs} > 0 then 1 else 0 end)`
    }).from(this.pageviews)
      .where(this.matchPageviews(query, range.from, range.to))
      .groupBy(this.pageviews.path)
      .orderBy(desc(count()))
      .limit(query.limit);

    return res.map((r: any) => ({
        path: r.path,
        title: r.title,
        pageviews: Number(r.pageviews),
        visitors: Number(r.visitors),
        exits: Number(r.exits),
        avgTimeOnPageMs: r.timedViews > 0 ? Number(r.totalVisibleMs) / Number(r.timedViews) : 0,
        exitRate: r.pageviews > 0 ? Number(r.exits) / Number(r.pageviews) : 0
    }));
  }

  async queryEntryExit(query: CRangeQueryDTO, range: ResolvedRange): Promise<EntryExitStats> {
    const entryRes = await this.db.select({
        path: this.sessions.entryPath,
        sessions: count(),
        bounces: sql<number>`sum(case when ${this.sessions.pageCount} <= 1 then 1 else 0 end)`
    }).from(this.sessions)
      .where(this.matchSessions(query, range.from, range.to))
      .groupBy(this.sessions.entryPath)
      .orderBy(desc(count()))
      .limit(query.limit);

    const exitRes = await this.db.select({
        path: this.sessions.exitPath,
        sessions: count()
    }).from(this.sessions)
      .where(and(this.matchSessions(query, range.from, range.to), sql`${this.sessions.exitPath} IS NOT NULL`))
      .groupBy(this.sessions.exitPath)
      .orderBy(desc(count()))
      .limit(query.limit);

    return {
        entryPages: entryRes.map((r: any) => ({
            path: r.path,
            sessions: Number(r.sessions),
            bounceRate: r.sessions > 0 ? Number(r.bounces) / Number(r.sessions) : 0
        })),
        exitPages: exitRes.map((r: any) => ({
            path: r.path as string,
            sessions: Number(r.sessions),
            exitRate: 0 // Cannot compute exitRate strictly from sessions without total PVs for that exit page, mock zero for now
        }))
    };
  }

  async queryReferrers(query: CRangeQueryDTO, range: ResolvedRange): Promise<ReferrerStats> {
    const typeRes = await this.db.select({
        name: sql<string>`coalesce(${this.sessions.referrerType}, 'Unknown')`,
        count: count()
    }).from(this.sessions)
      .where(this.matchSessions(query, range.from, range.to))
      .groupBy(this.sessions.referrerType)
      .orderBy(desc(count()))
      .limit(10);

    const hostRes = await this.db.select({
        name: sql<string>`coalesce(${this.sessions.referrerHost}, 'Unknown')`,
        count: count()
    }).from(this.sessions)
      .where(and(this.matchSessions(query, range.from, range.to), sql`${this.sessions.referrerHost} IS NOT NULL`, sql`${this.sessions.referrerHost} != ''`))
      .groupBy(this.sessions.referrerHost)
      .orderBy(desc(count()))
      .limit(query.limit);

    return {
        byType: typeRes.map((r: any) => ({ name: r.name, count: Number(r.count) })),
        byHost: hostRes.map((r: any) => ({ name: r.name, count: Number(r.count) })),
        campaigns: [] // Complex JSON extraction omitted for MVP mock
    };
  }

  async queryGeo(query: CRangeQueryDTO, range: ResolvedRange): Promise<GeoStats> {
    const countryRes = await this.db.select({
        code: this.sessions.countryCode,
        sessions: count(),
        pageviews: sql<number>`sum(case when ${this.sessions.pageCount} > 0 then ${this.sessions.pageCount} else 1 end)`
    }).from(this.sessions)
      .where(and(this.matchSessions(query, range.from, range.to), sql`${this.sessions.countryCode} IS NOT NULL`, sql`${this.sessions.countryCode} != ''`))
      .groupBy(this.sessions.countryCode)
      .orderBy(desc(count()))
      .limit(query.limit);

    return {
        countries: countryRes.map((r: any) => ({
            code: r.code as string,
            name: r.code as string, // Real implementation uses Intl.DisplayNames
            sessions: Number(r.sessions),
            pageviews: Number(r.pageviews)
        })),
        regions: [],
        cities: []
    };
  }

  async queryTech(query: CRangeQueryDTO, range: ResolvedRange): Promise<TechStats> {
    const deviceRes = await this.db.select({
        name: sql<string>`coalesce(${this.sessions.deviceType}, 'Unknown')`,
        count: count()
    }).from(this.sessions)
      .where(this.matchSessions(query, range.from, range.to))
      .groupBy(this.sessions.deviceType)
      .orderBy(desc(count()))
      .limit(10);

    return {
        devices: deviceRes.map((r: any) => ({ name: r.name, count: Number(r.count) })),
        browsers: [],
        os: [],
        screenSizes: []
    };
  }

  async querySessions(query: CSessionListQueryDTO, range: ResolvedRange): Promise<SessionsPage> {
    const limit = query.limit || 25;
    const page = query.page || 1;
    const offset = (page - 1) * limit;

    const [countRes] = await this.db.select({ total: count() })
      .from(this.sessions)
      .where(this.matchSessions(query, range.from, range.to));

    const rows = await this.db.select()
      .from(this.sessions)
      .where(this.matchSessions(query, range.from, range.to))
      .orderBy(desc(this.sessions.lastSeenAt))
      .limit(limit)
      .offset(offset);

    return {
      total: Number(countRes?.total || 0),
      page,
      limit,
      sessions: rows.map((s: any) => ({
        sessionId: s.sessionId,
        startedAt: s.startedAt.toISOString(),
        lastSeenAt: s.lastSeenAt.toISOString(),
        endedAt: s.endedAt?.toISOString(),
        durationMs: s.durationMs || 0,
        pageCount: s.pageCount || 0,
        isBounce: (s.pageCount || 0) <= 1,
        entryPath: s.entryPath,
        exitPath: s.exitPath,
        referrerHost: s.referrerHost,
        referrerType: (s.referrerType || 'direct') as any,
        deviceType: (s.deviceType || 'desktop') as any,
        browser: s.browser,
        os: s.os,
        screenW: s.screenW,
        screenH: s.screenH,
        ipTruncated: s.ipTruncated,
        countryCode: s.countryCode,
        country: s.country,
        city: s.city,
        isLive: false // MVP: no realtime
      }))
    };
  }
}
