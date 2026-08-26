import type { Db } from 'mongodb';
import type { TrafficAdapter, SessionUpsertData, PageviewUpsertData, TrafficEventInsert } from '../../adapter';
import type { CRangeQueryDTO, CSessionListQueryDTO, OverviewStats, PageStat, EntryExitStats, ReferrerStats, GeoStats, TechStats, SessionsPage } from '../../types';
import type { ResolvedRange } from '../../core/range';

export class MongoTrafficAdapter implements TrafficAdapter {
  constructor(private db: Db) {}

  private get sessions() {
    return this.db.collection('traffic_sessions');
  }

  private get pageviews() {
    return this.db.collection('traffic_pageviews');
  }

  private get events() {
    return this.db.collection('traffic_events');
  }

  async upsertSession(sessionId: string, data: Partial<SessionUpsertData>, setOnInsert: Partial<SessionUpsertData>): Promise<void> {
    const updateDoc: any = {};
    
    // Convert undefined to null for $set if needed, but usually just omit
    const $set = { ...data };
    Object.keys($set).forEach(key => $set[key as keyof typeof $set] === undefined && delete $set[key as keyof typeof $set]);

    if (data.lastSeenAt) delete $set.lastSeenAt;
    if (data.pageCount) delete $set.pageCount;

    if (Object.keys($set).length > 0) {
      updateDoc.$set = $set;
    }

    const $setOnInsert = { ...setOnInsert };
    if (Object.keys($setOnInsert).length > 0) {
      updateDoc.$setOnInsert = $setOnInsert;
    }

    if (data.lastSeenAt || data.pageCount) {
      updateDoc.$max = {
        ...(data.lastSeenAt ? { lastSeenAt: data.lastSeenAt } : {}),
        ...(data.pageCount ? { pageCount: data.pageCount } : {})
      };
    }

    // endedAt logic: If we have an existing endedAt that is older than lastSeenAt, we unset it
    // Wait, MongoDB's atomic upserts don't easily allow conditional $unset based on existing fields.
    // For MVP, we'll just set it if provided, or leave it.
    if (data.endedAt) {
      updateDoc.$set.endedAt = data.endedAt;
    }

    // Duration requires calculating difference, which isn't easy in a single atomic update without $function (slow) or update pipeline.
    // Use aggregation pipeline update for complex logic (MongoDB 4.2+):
    const pipelineUpdate = [
      {
        $set: {
          ...$set,
          ...$setOnInsert, // Note: pipeline doesn't have $setOnInsert natively in the same way, we'd need $cond
        }
      }
    ];

    // Using standard update for simplicity, duration calculated client-side or omitted if hard
    // We'll rely on the simple $max and $set
    await this.sessions.updateOne({ sessionId }, updateDoc, { upsert: true });

    // To properly calculate duration Ms we can do a secondary update or use a pipeline if needed.
    // For MVP, let's keep it simple:
    if (data.lastSeenAt) {
       await this.sessions.updateOne(
          { sessionId },
          [{
             $set: {
                durationMs: {
                   $max: [
                      0,
                      { $subtract: [{ $ifNull: ["$endedAt", "$lastSeenAt"] }, "$startedAt"] }
                   ]
                }
             }
          }]
       );
    }
  }

  async upsertPageview(sessionId: string, sequence: number, data: Partial<PageviewUpsertData>, setOnInsert: Partial<PageviewUpsertData>): Promise<void> {
    const $set = { ...data };
    Object.keys($set).forEach(key => $set[key as keyof typeof $set] === undefined && delete $set[key as keyof typeof $set]);

    const $max: any = {};
    if (data.durationMs !== undefined) {
      $max.durationMs = data.durationMs;
      delete $set.durationMs;
    }
    if (data.visibleMs !== undefined) {
      $max.visibleMs = data.visibleMs;
      delete $set.visibleMs;
    }
    if (data.maxScrollPct !== undefined) {
      $max.maxScrollPct = data.maxScrollPct;
      delete $set.maxScrollPct;
    }

    const updateDoc: any = { $set };
    if (Object.keys(setOnInsert).length > 0) updateDoc.$setOnInsert = { ...setOnInsert };
    if (Object.keys($max).length > 0) updateDoc.$max = $max;

    await this.pageviews.updateOne({ sessionId, sequence }, updateDoc, { upsert: true });
  }

  async bulkUpsertPageviews(ops: Array<{ sessionId: string, sequence: number, data: Partial<PageviewUpsertData>, setOnInsert: Partial<PageviewUpsertData> }>): Promise<void> {
    if (ops.length === 0) return;
    
    const bulk = this.pageviews.initializeUnorderedBulkOp();
    
    for (const op of ops) {
      const $set = { ...op.data };
      Object.keys($set).forEach(key => $set[key as keyof typeof $set] === undefined && delete $set[key as keyof typeof $set]);
      
      const $max: any = {};
      if (op.data.durationMs !== undefined) { $max.durationMs = op.data.durationMs; delete $set.durationMs; }
      if (op.data.visibleMs !== undefined) { $max.visibleMs = op.data.visibleMs; delete $set.visibleMs; }
      if (op.data.maxScrollPct !== undefined) { $max.maxScrollPct = op.data.maxScrollPct; delete $set.maxScrollPct; }

      const updateDoc: any = { $set };
      if (Object.keys(op.setOnInsert).length > 0) updateDoc.$setOnInsert = { ...op.setOnInsert };
      if (Object.keys($max).length > 0) updateDoc.$max = $max;

      bulk.find({ sessionId: op.sessionId, sequence: op.sequence }).upsert().updateOne(updateDoc);
    }
    
    await bulk.execute();
  }

  async markExitPage(sessionId: string, sequence: number): Promise<void> {
    await this.pageviews.updateOne({ sessionId, sequence }, { $set: { isExit: true } });
  }

  async insertEvents(events: TrafficEventInsert[]): Promise<void> {
    if (events.length === 0) return;
    await this.events.insertMany(events);
  }

  private match(query: CRangeQueryDTO, range: ResolvedRange) {
    return {
      site: query.site,
      deviceType: { $ne: 'bot' },
      startedAt: { $gte: range.from, $lt: range.to }
    };
  }

  async queryOverview(query: CRangeQueryDTO, range: ResolvedRange): Promise<OverviewStats> {
    const getTotals = async (from: Date, to: Date) => {
      const match = this.match(query, { ...range, from, to });
      
      const sessionStats = await this.sessions.aggregate([
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
      ]).toArray();

      const pvStats = await this.pageviews.aggregate([
        { $match: match },
        { $count: "pageviews" }
      ]).toArray();

      const s = sessionStats[0] || { sessions: 0, visitors: 0, bounces: 0, avgSessionDurationMs: 0 };
      const p = pvStats[0] || { pageviews: 0 };

      return {
        sessions: s.sessions,
        visitors: s.visitors,
        pageviews: p.pageviews,
        avgSessionDurationMs: s.avgSessionDurationMs,
        pagesPerSession: s.sessions > 0 ? p.pageviews / s.sessions : 0,
        bounceRate: s.sessions > 0 ? s.bounces / s.sessions : 0
      };
    };

    const [totals, previous] = await Promise.all([
      getTotals(range.from, range.to),
      getTotals(range.prevFrom, range.prevTo)
    ]);

    const formatString = range.bucket === 'hour' ? "%Y-%m-%dT%H:00:00.000Z" : "%Y-%m-%dT00:00:00.000Z";

    const tsSession = await this.sessions.aggregate([
      { $match: this.match(query, range) },
      { 
        $group: {
          _id: { $dateToString: { format: formatString, date: "$startedAt" } },
          sessions: { $sum: 1 },
          visitors: { $addToSet: { $ifNull: ["$visitorId", "$ipHash"] } }
        }
      }
    ]).toArray();

    const tsPv = await this.pageviews.aggregate([
      { $match: this.match(query, range) },
      { 
        $group: {
          _id: { $dateToString: { format: formatString, date: "$startedAt" } },
          pageviews: { $sum: 1 }
        }
      }
    ]).toArray();

    const pvMap = new Map(tsPv.map(t => [t._id, t.pageviews]));
    const timeseries = tsSession.map(t => ({
      t: t._id,
      sessions: t.sessions,
      visitors: t.visitors.length,
      pageviews: pvMap.get(t._id) || 0
    })).sort((a, b) => a.t.localeCompare(b.t));

    return {
      range: { from: range.from.toISOString(), to: range.to.toISOString(), bucket: range.bucket },
      totals,
      previous,
      timeseries
    };
  }

  async queryPages(query: CRangeQueryDTO, range: ResolvedRange): Promise<PageStat[]> {
    const res = await this.pageviews.aggregate([
      { $match: this.match(query, range) },
      {
        $group: {
          _id: "$path",
          title: { $last: "$title" }, // approximation
          pageviews: { $sum: 1 },
          visitors: { $addToSet: { $ifNull: ["$visitorId", "$ipHash"] } },
          exits: { $sum: { $cond: ["$isExit", 1, 0] } },
          totalVisibleMs: { $sum: "$visibleMs" },
          timedViews: { $sum: { $cond: [{ $gt: ["$visibleMs", 0] }, 1, 0] } }
        }
      },
      { $sort: { pageviews: -1 } },
      { $limit: query.limit }
    ]).toArray();

    return res.map(r => ({
      path: r._id,
      title: r.title,
      pageviews: r.pageviews,
      visitors: r.visitors.length,
      exits: r.exits,
      avgTimeOnPageMs: r.timedViews > 0 ? r.totalVisibleMs / r.timedViews : 0,
      exitRate: r.pageviews > 0 ? r.exits / r.pageviews : 0
    }));
  }

  async queryEntryExit(query: CRangeQueryDTO, range: ResolvedRange): Promise<EntryExitStats> {
    const entryPages = await this.sessions.aggregate([
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
    ]).toArray();

    const exitPages = await this.sessions.aggregate([
      { $match: { ...this.match(query, range), exitPath: { $exists: true, $ne: null } } },
      {
        $group: {
          _id: "$exitPath",
          sessions: { $sum: 1 }
        }
      },
      { $sort: { sessions: -1 } },
      { $limit: query.limit }
    ]).toArray();

    return {
      entryPages: entryPages.map(r => ({
        path: r._id,
        sessions: r.sessions,
        bounceRate: r.sessions > 0 ? r.bounces / r.sessions : 0
      })),
      exitPages: exitPages.map(r => ({
        path: r._id,
        sessions: r.sessions,
        exitRate: 0
      }))
    };
  }

  async queryReferrers(query: CRangeQueryDTO, range: ResolvedRange): Promise<ReferrerStats> {
    const byType = await this.sessions.aggregate([
      { $match: this.match(query, range) },
      {
        $group: {
          _id: { $ifNull: ["$referrerType", "direct"] },
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]).toArray();

    const byHost = await this.sessions.aggregate([
      { $match: { ...this.match(query, range), referrerHost: { $exists: true, $nin: [null, ''] } } },
      {
        $group: {
          _id: "$referrerHost",
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } },
      { $limit: query.limit }
    ]).toArray();

    return {
      byType: byType.map(r => ({ name: r._id, count: r.count })),
      byHost: byHost.map(r => ({ name: r._id, count: r.count })),
      campaigns: []
    };
  }

  async queryGeo(query: CRangeQueryDTO, range: ResolvedRange): Promise<GeoStats> {
    const countries = await this.sessions.aggregate([
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
    ]).toArray();

    return {
      countries: countries.map(r => ({
        code: r._id,
        name: r._id,
        sessions: r.sessions,
        pageviews: r.pageviews
      })),
      regions: [],
      cities: []
    };
  }

  async queryTech(query: CRangeQueryDTO, range: ResolvedRange): Promise<TechStats> {
    const devices = await this.sessions.aggregate([
      { $match: this.match(query, range) },
      {
        $group: {
          _id: { $ifNull: ["$deviceType", "desktop"] },
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]).toArray();

    return {
      devices: devices.map(r => ({ name: r._id, count: r.count })),
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

    const [total, sessions] = await Promise.all([
      this.sessions.countDocuments(match),
      this.sessions.find(match).sort({ lastSeenAt: -1 }).skip(skip).limit(limit).toArray()
    ]);

    return {
      total,
      page,
      limit,
      sessions: sessions.map(s => ({
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
        referrerType: s.referrerType || 'direct',
        deviceType: s.deviceType || 'desktop',
        browser: s.browser,
        os: s.os,
        screenW: s.screenW,
        screenH: s.screenH,
        ipTruncated: s.ipTruncated,
        countryCode: s.countryCode,
        country: s.country,
        city: s.city,
        isLive: false
      }))
    };
  }
}
