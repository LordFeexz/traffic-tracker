import type { LiveVisitor, LiveVisitorPatch, RealtimeAdapter, RealtimeAggregate } from './types';

export interface MemoryRealtimeOptions {
  sessionTtlMs?: number;
  sparklineMinutes?: number;
}

export class MemoryRealtimeAdapter implements RealtimeAdapter {
  private sessionTtlMs: number;
  private sparklineMinutes: number;

  private sessions = new Map<string, Map<string, { lastSeen: number; visitor: LiveVisitor }>>();
  private minutePv = new Map<string, Map<number, number>>();
  private dayCounters = new Map<string, Map<string, { pageviews: number; sessions: number }>>();

  constructor(options?: MemoryRealtimeOptions) {
    this.sessionTtlMs = options?.sessionTtlMs ?? 60_000;
    this.sparklineMinutes = options?.sparklineMinutes ?? 30;
  }

  private utcDay(at: Date): string {
    return at.toISOString().slice(0, 10);
  }

  async touch(
    site: string,
    sessionId: string,
    patch: LiveVisitorPatch,
    at: Date = new Date()
  ): Promise<void> {
    let siteSessions = this.sessions.get(site);
    if (!siteSessions) {
      siteSessions = new Map();
      this.sessions.set(site, siteSessions);
    }

    const existing = siteSessions.get(sessionId)?.visitor;
    const merged: LiveVisitor = {
      path: patch.path,
      title: patch.title ?? existing?.title,
      countryCode: patch.countryCode ?? existing?.countryCode,
      deviceType: patch.deviceType ?? existing?.deviceType ?? 'desktop',
      referrerType: patch.referrerType ?? existing?.referrerType ?? 'direct'
    };

    siteSessions.set(sessionId, { lastSeen: at.getTime(), visitor: merged });
  }

  async remove(site: string, sessionId: string): Promise<void> {
    const siteSessions = this.sessions.get(site);
    if (siteSessions) {
      siteSessions.delete(sessionId);
    }
  }

  async recordPageview(site: string, at: Date = new Date()): Promise<void> {
    const minute = Math.floor(at.getTime() / 60_000);
    let sitePv = this.minutePv.get(site);
    if (!sitePv) {
      sitePv = new Map();
      this.minutePv.set(site, sitePv);
    }
    sitePv.set(minute, (sitePv.get(minute) ?? 0) + 1);

    const day = this.utcDay(at);
    let siteDays = this.dayCounters.get(site);
    if (!siteDays) {
      siteDays = new Map();
      this.dayCounters.set(site, siteDays);
    }
    const currentDay = siteDays.get(day) ?? { pageviews: 0, sessions: 0 };
    currentDay.pageviews += 1;
    siteDays.set(day, currentDay);
  }

  async recordSessionStart(site: string, at: Date = new Date()): Promise<void> {
    const day = this.utcDay(at);
    let siteDays = this.dayCounters.get(site);
    if (!siteDays) {
      siteDays = new Map();
      this.dayCounters.set(site, siteDays);
    }
    const currentDay = siteDays.get(day) ?? { pageviews: 0, sessions: 0 };
    currentDay.sessions += 1;
    siteDays.set(day, currentDay);
  }

  async snapshot(site: string, now: Date = new Date()): Promise<RealtimeAggregate> {
    const cutoff = now.getTime() - this.sessionTtlMs;
    const siteSessions = this.sessions.get(site);
    const visitors: LiveVisitor[] = [];

    if (siteSessions) {
      for (const [id, record] of Array.from(siteSessions.entries())) {
        if (record.lastSeen < cutoff) {
          siteSessions.delete(id);
        } else {
          visitors.push(record.visitor);
        }
      }
    }

    const currentMinute = Math.floor(now.getTime() / 60_000);
    const sitePv = this.minutePv.get(site);
    const pageviewsPerMinute = Array.from({ length: this.sparklineMinutes }, (_, i) => {
      const min = currentMinute - (this.sparklineMinutes - 1 - i);
      return sitePv?.get(min) ?? 0;
    });

    const day = this.utcDay(now);
    const dayStat = this.dayCounters.get(site)?.get(day) ?? { pageviews: 0, sessions: 0 };

    return {
      activeVisitors: visitors.length,
      visitors,
      pageviewsPerMinute,
      today: { ...dayStat }
    };
  }

  async liveSessionIds(site: string, now: Date = new Date()): Promise<Set<string>> {
    const cutoff = now.getTime() - this.sessionTtlMs;
    const siteSessions = this.sessions.get(site);
    const result = new Set<string>();

    if (siteSessions) {
      for (const [id, record] of siteSessions.entries()) {
        if (record.lastSeen >= cutoff) {
          result.add(id);
        }
      }
    }

    return result;
  }
}

export function createMemoryRealtimeAdapter(options?: MemoryRealtimeOptions): RealtimeAdapter {
  return new MemoryRealtimeAdapter(options);
}
