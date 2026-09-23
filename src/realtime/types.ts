export interface LiveVisitor {
  path: string;
  title?: string;
  countryCode?: string;
  deviceType: string;
  referrerType: string;
}

export type LiveVisitorPatch = Partial<LiveVisitor> & { path: string };

export interface RealtimeAggregate {
  activeVisitors: number;
  visitors: LiveVisitor[];
  pageviewsPerMinute: number[];
  today: { pageviews: number; sessions: number };
}

export interface RealtimeAdapter {
  touch(site: string, sessionId: string, patch: LiveVisitorPatch, at?: Date): Promise<void>;
  remove(site: string, sessionId: string): Promise<void>;
  recordPageview(site: string, at?: Date): Promise<void>;
  recordSessionStart(site: string, at?: Date): Promise<void>;
  snapshot(site: string, now?: Date): Promise<RealtimeAggregate>;
  liveSessionIds?(site: string, now?: Date): Promise<Set<string>>;
}
