import type { 
  CRangeQueryDTO, 
  CSessionListQueryDTO, 
  EntryExitStats, 
  GeoStats, 
  OverviewStats, 
  PageStat, 
  ReferrerStats, 
  SessionsPage, 
  TechStats 
} from './types';
import type { ResolvedRange } from './core/range.js';

export interface SessionUpsertData {
  sessionId: string;
  visitorId?: string;
  userId?: string;
  site: string;
  environment: string;
  consentMode: string;
  
  startedAt: Date;
  lastSeenAt: Date;
  endedAt?: Date;
  durationMs: number;
  pageCount: number;

  entryPath: string;
  entryTitle?: string;
  exitPath?: string;
  exitTitle?: string;

  referrer?: string;
  referrerHost?: string;
  referrerType: string;
  utm?: {
    source?: string;
    medium?: string;
    campaign?: string;
    term?: string;
    content?: string;
  };

  userAgent?: string;
  browser?: string;
  browserVersion?: string;
  os?: string;
  deviceType: string;

  screenW?: number;
  screenH?: number;
  viewportW?: number;
  viewportH?: number;
  dpr?: number;
  language?: string;
  timezone?: string;

  ipTruncated?: string;
  ipHash?: string;
  country?: string;
  countryCode?: string;
  region?: string;
  city?: string;

  createdAt: Date;
}

export interface PageviewUpsertData {
  sessionId: string;
  visitorId?: string;
  site: string;
  environment: string;

  path: string;
  title?: string;
  query?: string;
  articleSlug?: string;
  category?: string;

  referrer?: string;
  sequence: number;

  startedAt: Date;
  endedAt?: Date;
  durationMs: number;
  visibleMs: number;
  maxScrollPct: number;
  isExit: boolean;

  deviceType: string;
  countryCode?: string;
  ipHash?: string;

  createdAt: Date;
}

export interface TrafficEventInsert {
  sessionId: string;
  visitorId?: string;
  site: string;
  environment: string;
  name: string;
  path: string;
  props?: Record<string, string | number | boolean>;
  occurredAt: Date;
  createdAt: Date;
}

export interface TrafficAdapter {
  upsertSession(sessionId: string, data: Partial<SessionUpsertData>, setOnInsert: Partial<SessionUpsertData>): Promise<void>;
  
  upsertPageview(sessionId: string, sequence: number, data: Partial<PageviewUpsertData>, setOnInsert: Partial<PageviewUpsertData>): Promise<void>;
  bulkUpsertPageviews(ops: Array<{ sessionId: string, sequence: number, data: Partial<PageviewUpsertData>, setOnInsert: Partial<PageviewUpsertData> }>): Promise<void>;
  markExitPage(sessionId: string, sequence: number): Promise<void>;
  
  insertEvents(events: TrafficEventInsert[]): Promise<void>;
  
  queryOverview(query: CRangeQueryDTO, range: ResolvedRange): Promise<OverviewStats>;
  queryPages(query: CRangeQueryDTO, range: ResolvedRange): Promise<PageStat[]>;
  queryEntryExit(query: CRangeQueryDTO, range: ResolvedRange): Promise<EntryExitStats>;
  queryReferrers(query: CRangeQueryDTO, range: ResolvedRange): Promise<ReferrerStats>;
  queryGeo(query: CRangeQueryDTO, range: ResolvedRange): Promise<GeoStats>;
  queryTech(query: CRangeQueryDTO, range: ResolvedRange): Promise<TechStats>;
  querySessions(query: CSessionListQueryDTO, range: ResolvedRange): Promise<SessionsPage>;
}
