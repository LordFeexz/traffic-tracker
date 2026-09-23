import type { LiveVisitor, LiveVisitorPatch, RealtimeAdapter, RealtimeAggregate } from './types';

export interface RedisRealtimeOptions {
  keyPrefix?: string;
  sessionTtlMs?: number;
  sparklineMinutes?: number;
  minuteBucketTtlSeconds?: number;
  dayCounterTtlSeconds?: number;
  onError?: (error: unknown, action: string) => void;
}

export interface MinimalRedisClient {
  zadd(key: string, score: number, member: string): Promise<unknown>;
  zrem(key: string, member: string): Promise<unknown>;
  zrangebyscore(key: string, min: number | string, max: number | string): Promise<string[]>;
  zremrangebyscore(key: string, min: number | string, max: number | string): Promise<unknown>;
  hset(key: string, field: string, value: string): Promise<unknown>;
  hget(key: string, field: string): Promise<string | null | undefined>;
  hmget(key: string, ...fields: string[]): Promise<Array<string | null | undefined>>;
  hdel(key: string, ...fields: string[]): Promise<unknown>;
  hgetall(key: string): Promise<Record<string, string> | null | undefined>;
  incr(key: string): Promise<number>;
  hincrby(key: string, field: string, increment: number): Promise<number>;
  expire(key: string, seconds: number): Promise<unknown>;
  mget(...keys: string[]): Promise<Array<string | null | undefined>>;
}

export type RedisClientOrFactory =
  | MinimalRedisClient
  | (() => MinimalRedisClient | Promise<MinimalRedisClient | null | undefined> | null | undefined);

export class RedisRealtimeAdapter implements RealtimeAdapter {
  private keyPrefix: string;
  private sessionTtlMs: number;
  private sparklineMinutes: number;
  private minuteBucketTtlSeconds: number;
  private dayCounterTtlSeconds: number;
  private onError?: (error: unknown, action: string) => void;

  constructor(
    private clientOrFactory: RedisClientOrFactory,
    options?: RedisRealtimeOptions
  ) {
    this.keyPrefix = options?.keyPrefix ?? 'traffic:rt:';
    this.sessionTtlMs = options?.sessionTtlMs ?? 60_000;
    this.sparklineMinutes = options?.sparklineMinutes ?? 30;
    this.minuteBucketTtlSeconds = options?.minuteBucketTtlSeconds ?? 45 * 60;
    this.dayCounterTtlSeconds = options?.dayCounterTtlSeconds ?? 48 * 60 * 60;
    this.onError = options?.onError;
  }

  private async getClient(): Promise<MinimalRedisClient | null> {
    try {
      if (typeof this.clientOrFactory === 'function') {
        const client = await this.clientOrFactory();
        return client ?? null;
      }
      return this.clientOrFactory ?? null;
    } catch (error) {
      this.handleError(error, 'getClient');
      return null;
    }
  }

  private ns(site: string, suffix: string): string {
    return `${this.keyPrefix}${site}:${suffix}`;
  }

  private utcDay(at: Date): string {
    return at.toISOString().slice(0, 10);
  }

  private handleError(error: unknown, action: string): void {
    if (this.onError) {
      this.onError(error, action);
    }
  }

  async touch(
    site: string,
    sessionId: string,
    patch: LiveVisitorPatch,
    at: Date = new Date()
  ): Promise<void> {
    try {
      const redis = await this.getClient();
      if (!redis) return;

      const metaKey = this.ns(site, 'meta');
      const existingRaw = await redis.hget(metaKey, sessionId);
      let existing: Partial<LiveVisitor> = {};
      if (existingRaw) {
        try {
          existing = JSON.parse(existingRaw) as Partial<LiveVisitor>;
        } catch {
          // ignore corrupted existing json
        }
      }

      const merged: LiveVisitor = {
        path: patch.path,
        title: patch.title ?? existing.title,
        countryCode: patch.countryCode ?? existing.countryCode,
        deviceType: patch.deviceType ?? existing.deviceType ?? 'desktop',
        referrerType: patch.referrerType ?? existing.referrerType ?? 'direct'
      };

      await Promise.all([
        redis.zadd(this.ns(site, 'sessions'), at.getTime(), sessionId),
        redis.hset(metaKey, sessionId, JSON.stringify(merged))
      ]);
    } catch (error) {
      this.handleError(error, 'touch');
    }
  }

  async remove(site: string, sessionId: string): Promise<void> {
    try {
      const redis = await this.getClient();
      if (!redis) return;

      await Promise.all([
        redis.zrem(this.ns(site, 'sessions'), sessionId),
        redis.hdel(this.ns(site, 'meta'), sessionId)
      ]);
    } catch (error) {
      this.handleError(error, 'remove');
    }
  }

  async recordPageview(site: string, at: Date = new Date()): Promise<void> {
    try {
      const redis = await this.getClient();
      if (!redis) return;

      const minuteKey = this.ns(site, `pv:${Math.floor(at.getTime() / 60_000)}`);
      const dayKey = this.ns(site, `day:${this.utcDay(at)}`);

      await Promise.all([
        redis.incr(minuteKey).then(() => redis.expire(minuteKey, this.minuteBucketTtlSeconds)),
        redis
          .hincrby(dayKey, 'pageviews', 1)
          .then(() => redis.expire(dayKey, this.dayCounterTtlSeconds))
      ]);
    } catch (error) {
      this.handleError(error, 'recordPageview');
    }
  }

  async recordSessionStart(site: string, at: Date = new Date()): Promise<void> {
    try {
      const redis = await this.getClient();
      if (!redis) return;

      const dayKey = this.ns(site, `day:${this.utcDay(at)}`);
      await redis.hincrby(dayKey, 'sessions', 1);
      await redis.expire(dayKey, this.dayCounterTtlSeconds);
    } catch (error) {
      this.handleError(error, 'recordSessionStart');
    }
  }

  async snapshot(site: string, now: Date = new Date()): Promise<RealtimeAggregate> {
    const empty: RealtimeAggregate = {
      activeVisitors: 0,
      visitors: [],
      pageviewsPerMinute: Array<number>(this.sparklineMinutes).fill(0),
      today: { pageviews: 0, sessions: 0 }
    };

    try {
      const redis = await this.getClient();
      if (!redis) return empty;

      const cutoff = now.getTime() - this.sessionTtlMs;
      const sessionsKey = this.ns(site, 'sessions');
      const metaKey = this.ns(site, 'meta');

      const stale = await redis.zrangebyscore(sessionsKey, 0, cutoff);
      if (stale.length > 0) {
        await Promise.all([
          redis.zremrangebyscore(sessionsKey, 0, cutoff),
          redis.hdel(metaKey, ...stale)
        ]);
      }

      const liveIds = await redis.zrangebyscore(sessionsKey, cutoff, '+inf');
      const visitors: LiveVisitor[] = [];
      if (liveIds.length > 0) {
        const raw = await redis.hmget(metaKey, ...liveIds);
        for (const entry of raw) {
          if (!entry) continue;
          try {
            visitors.push(JSON.parse(entry) as LiveVisitor);
          } catch {
            // ignore corrupted item
          }
        }
      }

      const currentMinute = Math.floor(now.getTime() / 60_000);
      const minuteKeys = Array.from({ length: this.sparklineMinutes }, (_, i) =>
        this.ns(site, `pv:${currentMinute - (this.sparklineMinutes - 1 - i)}`)
      );

      const [minuteValues, dayCounters] = await Promise.all([
        minuteKeys.length > 0 ? redis.mget(...minuteKeys) : Promise.resolve([]),
        redis.hgetall(this.ns(site, `day:${this.utcDay(now)}`))
      ]);

      return {
        activeVisitors: liveIds.length,
        visitors,
        pageviewsPerMinute: minuteValues.map(v => Number(v ?? 0) || 0),
        today: {
          pageviews: Number(dayCounters?.pageviews ?? 0) || 0,
          sessions: Number(dayCounters?.sessions ?? 0) || 0
        }
      };
    } catch (error) {
      this.handleError(error, 'snapshot');
      return empty;
    }
  }

  async liveSessionIds(site: string, now: Date = new Date()): Promise<Set<string>> {
    try {
      const redis = await this.getClient();
      if (!redis) return new Set();

      const cutoff = now.getTime() - this.sessionTtlMs;
      const ids = await redis.zrangebyscore(this.ns(site, 'sessions'), cutoff, '+inf');
      return new Set(ids);
    } catch (error) {
      this.handleError(error, 'liveSessionIds');
      return new Set();
    }
  }
}

export function createRedisRealtimeAdapter(
  clientOrFactory: RedisClientOrFactory,
  options?: RedisRealtimeOptions
): RealtimeAdapter {
  return new RedisRealtimeAdapter(clientOrFactory, options);
}
