import type { TrafficAdapter, SessionUpsertData, PageviewUpsertData, TrafficEventInsert } from '../../src/adapter';

export function createMockAdapter(): TrafficAdapter & {
  sessions: Map<string, SessionUpsertData>;
  pageviews: Map<string, PageviewUpsertData>;
  events: TrafficEventInsert[];
  reset(): void;
} {
  const sessions = new Map<string, SessionUpsertData>();
  const pageviews = new Map<string, PageviewUpsertData>();
  const events: TrafficEventInsert[] = [];

  return {
    sessions,
    pageviews,
    events,
    reset() {
      sessions.clear();
      pageviews.clear();
      events.length = 0;
    },
    
    async upsertSession(sessionId, data, setOnInsert) {
      if (!sessions.has(sessionId)) {
        sessions.set(sessionId, { ...setOnInsert, ...data } as SessionUpsertData);
      } else {
        const existing = sessions.get(sessionId)!;
        const updated = { ...existing, ...data };
        if (data.lastSeenAt) {
          updated.lastSeenAt = existing.lastSeenAt > data.lastSeenAt ? existing.lastSeenAt : data.lastSeenAt;
          if (existing.endedAt && data.lastSeenAt > existing.endedAt) {
            updated.endedAt = undefined;
          }
        }
        if (data.pageCount) {
          updated.pageCount = Math.max(existing.pageCount || 0, data.pageCount);
        }
        if (updated.startedAt && updated.lastSeenAt) {
          const end = updated.endedAt || updated.lastSeenAt;
          updated.durationMs = Math.max(0, end.getTime() - updated.startedAt.getTime());
        }
        sessions.set(sessionId, updated);
      }
    },

    async upsertPageview(sessionId, sequence, data, setOnInsert) {
      const key = `${sessionId}:${sequence}`;
      if (!pageviews.has(key)) {
        pageviews.set(key, { ...setOnInsert, ...data } as PageviewUpsertData);
      } else {
        const existing = pageviews.get(key)!;
        const updated = { ...existing, ...data };
        if (data.durationMs !== undefined) {
          updated.durationMs = Math.max(existing.durationMs || 0, data.durationMs);
        }
        if (data.visibleMs !== undefined) {
          updated.visibleMs = Math.max(existing.visibleMs || 0, data.visibleMs);
        }
        if (data.maxScrollPct !== undefined) {
          updated.maxScrollPct = Math.max(existing.maxScrollPct || 0, data.maxScrollPct);
        }
        pageviews.set(key, updated);
      }
    },

    async bulkUpsertPageviews(ops) {
      for (const op of ops) {
        await this.upsertPageview(op.sessionId, op.sequence, op.data, op.setOnInsert);
      }
    },

    async markExitPage(sessionId, sequence) {
      const key = `${sessionId}:${sequence}`;
      if (pageviews.has(key)) {
        pageviews.get(key)!.isExit = true;
      }
    },

    async insertEvents(newEvents) {
      events.push(...newEvents);
    },

    async queryOverview(query, range) {
      return {
        range: { from: range.from.toISOString(), to: range.to.toISOString(), bucket: range.bucket },
        totals: { sessions: sessions.size, visitors: sessions.size, pageviews: pageviews.size, avgSessionDurationMs: 0, pagesPerSession: 0, bounceRate: 0 },
        previous: { sessions: 0, visitors: 0, pageviews: 0, avgSessionDurationMs: 0, pagesPerSession: 0, bounceRate: 0 },
        timeseries: []
      };
    },

    async queryPages() { return []; },
    async queryEntryExit() { return { entryPages: [], exitPages: [] }; },
    async queryReferrers() { return { byType: [], byHost: [], campaigns: [] }; },
    async queryGeo() { return { countries: [], regions: [], cities: [] }; },
    async queryTech() { return { devices: [], browsers: [], os: [], screenSizes: [] }; },
    async querySessions() { return { sessions: [], total: 0, page: 1, limit: 10 }; }
  };
}
