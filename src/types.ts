import { z } from 'zod';

export type ConsentMode = 'full' | 'anonymous';
export type DeviceType = 'desktop' | 'mobile' | 'tablet' | 'bot';
export type ReferrerType = 'direct' | 'internal' | 'search' | 'social' | 'referral';

export interface UtmParams {
  source?: string;
  medium?: string;
  campaign?: string;
  term?: string;
  content?: string;
}

export interface ClientContext {
  screenW: number;
  screenH: number;
  viewportW: number;
  viewportH: number;
  dpr: number;
  language: string;
  timezone: string;
}

export interface PageContext {
  articleSlug?: string;
  category?: string;
}

export interface BaseEvent {
  ts: number;
}

export interface SessionStartEvent extends BaseEvent, ClientContext {
  type: 'session_start';
  entryPath: string;
  entryTitle?: string;
  referrer: string;
}

export interface PageviewEvent extends BaseEvent, PageContext {
  type: 'pageview';
  path: string;
  title?: string;
  query?: string;
  referrer: string;
  sequence: number;
  viewportW: number;
  viewportH: number;
}

export interface PageExitEvent extends BaseEvent {
  type: 'page_exit';
  path: string;
  sequence: number;
  durationMs: number;
  visibleMs: number;
  maxScrollPct: number;
}

export interface HeartbeatEvent extends BaseEvent {
  type: 'heartbeat';
  path: string;
}

export interface SessionEndEvent extends BaseEvent {
  type: 'session_end';
  exitPath: string;
  exitTitle?: string;
  durationMs: number;
  pageCount: number;
}

export interface CustomEvent extends BaseEvent {
  type: 'event';
  name: string;
  path: string;
  props?: Record<string, string | number | boolean>;
}

export type AnalyticsEvent =
  | SessionStartEvent
  | PageviewEvent
  | PageExitEvent
  | HeartbeatEvent
  | SessionEndEvent
  | CustomEvent;

export interface CollectPayload {
  site: string;
  environment: string;
  consentMode: ConsentMode;
  sessionId: string;
  visitorId?: string;
  userId?: string;
  events: AnalyticsEvent[];
}

export interface NamedCount {
  name: string;
  count: number;
}

export interface TimeseriesPoint {
  t: string;
  sessions: number;
  pageviews: number;
  visitors: number;
}

export interface OverviewTotals {
  sessions: number;
  visitors: number;
  pageviews: number;
  avgSessionDurationMs: number;
  pagesPerSession: number;
  bounceRate: number;
}

export interface OverviewStats {
  range: { from: string; to: string; bucket: 'hour' | 'day' };
  totals: OverviewTotals;
  previous: OverviewTotals;
  timeseries: TimeseriesPoint[];
}

export interface PageStat {
  path: string;
  title?: string;
  pageviews: number;
  visitors: number;
  avgTimeOnPageMs: number;
  exits: number;
  exitRate: number;
}

export interface EntryExitStats {
  entryPages: Array<{ path: string; sessions: number; bounceRate: number }>;
  exitPages: Array<{ path: string; sessions: number; exitRate: number }>;
}

export interface ReferrerStats {
  byType: NamedCount[];
  byHost: NamedCount[];
  campaigns: Array<{ source?: string; medium?: string; campaign?: string; sessions: number }>;
}

export interface GeoStats {
  countries: Array<{ code: string; name: string; sessions: number; pageviews: number }>;
  regions: NamedCount[];
  cities: NamedCount[];
}

export interface TechStats {
  devices: NamedCount[];
  browsers: NamedCount[];
  os: NamedCount[];
  screenSizes: NamedCount[];
}

export interface SessionRow {
  sessionId: string;
  startedAt: string;
  lastSeenAt: string;
  endedAt?: string;
  durationMs: number;
  pageCount: number;
  isBounce: boolean;
  entryPath: string;
  exitPath?: string;
  referrerHost?: string;
  referrerType: ReferrerType;
  deviceType: DeviceType;
  browser?: string;
  os?: string;
  screenW?: number;
  screenH?: number;
  ipTruncated?: string;
  countryCode?: string;
  country?: string;
  city?: string;
  isLive: boolean;
}

export interface SessionsPage {
  sessions: SessionRow[];
  total: number;
  page: number;
  limit: number;
}

export interface AllStats {
  overview: OverviewStats;
  pages: PageStat[];
  entryExit: EntryExitStats;
  referrers: ReferrerStats;
  geo: GeoStats;
  tech: TechStats;
  sessions: SessionsPage;
}

// Zod schemas for validation

const ConsentModeEnum = z.enum(['full', 'anonymous']);

const Path = z.string().min(1).max(512);
const Title = z.string().max(512).optional();
const Id = z.string().min(1).max(128);

const BaseEventSchema = z.object({ ts: z.number().int().nonnegative() });

const SessionStartSchema = BaseEventSchema.extend({
  type: z.literal('session_start'),
  entryPath: Path,
  entryTitle: Title,
  referrer: z.string().max(2048).default(''),
  screenW: z.number().int().nonnegative().max(20000).default(0),
  screenH: z.number().int().nonnegative().max(20000).default(0),
  viewportW: z.number().int().nonnegative().max(20000).default(0),
  viewportH: z.number().int().nonnegative().max(20000).default(0),
  dpr: z.number().nonnegative().max(10).default(1),
  language: z.string().max(35).default(''),
  timezone: z.string().max(64).default('')
});

const PageviewSchema = BaseEventSchema.extend({
  type: z.literal('pageview'),
  path: Path,
  title: Title,
  query: z.string().max(2048).optional(),
  referrer: z.string().max(2048).default(''),
  sequence: z.number().int().positive().max(10000),
  viewportW: z.number().int().nonnegative().max(20000).default(0),
  viewportH: z.number().int().nonnegative().max(20000).default(0),
  articleSlug: z.string().max(256).optional(),
  category: z.string().max(128).optional()
});

const MAX_DWELL_MS = 6 * 60 * 60 * 1000;

const PageExitSchema = BaseEventSchema.extend({
  type: z.literal('page_exit'),
  path: Path,
  sequence: z.number().int().positive().max(10000),
  durationMs: z.number().nonnegative().max(MAX_DWELL_MS).catch(MAX_DWELL_MS),
  visibleMs: z.number().nonnegative().max(MAX_DWELL_MS).catch(MAX_DWELL_MS),
  maxScrollPct: z.number().min(0).max(100).catch(0)
});

const HeartbeatSchema = BaseEventSchema.extend({ type: z.literal('heartbeat'), path: Path });

const SessionEndSchema = BaseEventSchema.extend({
  type: z.literal('session_end'),
  exitPath: Path,
  exitTitle: Title,
  durationMs: z.number().nonnegative().max(24 * 60 * 60 * 1000).catch(0),
  pageCount: z.number().int().nonnegative().max(10000).catch(0)
});

const CustomEventSchema = BaseEventSchema.extend({
  type: z.literal('event'),
  name: z.string().min(1).max(128),
  path: Path,
  props: z.record(z.union([z.string().max(512), z.number(), z.boolean()])).optional()
});

export const TrafficEventSchema = z.discriminatedUnion('type', [
  SessionStartSchema,
  PageviewSchema,
  PageExitSchema,
  HeartbeatSchema,
  SessionEndSchema,
  CustomEventSchema
]);

export const CollectSchema = z.object({
  site: z.string().min(1).max(128),
  environment: z.string().min(1).max(32).default('production'),
  consentMode: ConsentModeEnum,
  sessionId: Id,
  visitorId: Id.optional(),
  userId: Id.optional(),
  events: z.array(TrafficEventSchema).min(1).max(100)
});

export const RangeQuery = z.object({
  site: z.string().min(1).max(128),
  range: z.enum(['today', '24h', '7d', '30d', '90d']).default('7d'),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  limit: z.coerce.number().int().positive().max(100).default(10)
});

export const SessionListQuery = RangeQuery.extend({
  page: z.coerce.number().int().positive().max(1000).default(1),
  limit: z.coerce.number().int().positive().max(100).default(25)
});

export type CRangeQueryDTO = z.infer<typeof RangeQuery>;
export type CSessionListQueryDTO = z.infer<typeof SessionListQuery>;
