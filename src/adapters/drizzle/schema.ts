import {
  pgTable,
  varchar,
  timestamp,
  integer,
  boolean,
  jsonb,
  unique,
  index
} from 'drizzle-orm/pg-core';

export const trafficSessions = pgTable(
  'traffic_sessions',
  {
    sessionId: varchar('session_id', { length: 128 }).primaryKey(),
    visitorId: varchar('visitor_id', { length: 128 }),
    userId: varchar('user_id', { length: 128 }),
    site: varchar('site', { length: 128 }).notNull(),
    environment: varchar('environment', { length: 32 }).notNull().default('production'),
    consentMode: varchar('consent_mode', { length: 20 }).notNull().default('anonymous'),

    startedAt: timestamp('started_at').notNull(),
    lastSeenAt: timestamp('last_seen_at').notNull(),
    endedAt: timestamp('ended_at'),
    durationMs: integer('duration_ms').default(0),
    pageCount: integer('page_count').default(0),

    entryPath: varchar('entry_path', { length: 512 }).notNull(),
    entryTitle: varchar('entry_title', { length: 512 }),
    exitPath: varchar('exit_path', { length: 512 }),
    exitTitle: varchar('exit_title', { length: 512 }),

    referrer: varchar('referrer', { length: 2048 }),
    referrerHost: varchar('referrer_host', { length: 256 }),
    referrerType: varchar('referrer_type', { length: 20 }).default('direct'),
    
    // Storing UTM as JSON for simplicity across adapters, though flattened cols are also fine
    utm: jsonb('utm').$type<{
      source?: string;
      medium?: string;
      campaign?: string;
      term?: string;
      content?: string;
    }>(),

    userAgent: varchar('user_agent', { length: 1024 }),
    browser: varchar('browser', { length: 128 }),
    browserVersion: varchar('browser_version', { length: 64 }),
    os: varchar('os', { length: 128 }),
    deviceType: varchar('device_type', { length: 20 }).default('desktop'),

    screenW: integer('screen_w'),
    screenH: integer('screen_h'),
    viewportW: integer('viewport_w'),
    viewportH: integer('viewport_h'),
    dpr: integer('dpr'),
    language: varchar('language', { length: 35 }),
    timezone: varchar('timezone', { length: 64 }),

    ipTruncated: varchar('ip_truncated', { length: 45 }),
    ipHash: varchar('ip_hash', { length: 64 }),
    country: varchar('country', { length: 128 }),
    countryCode: varchar('country_code', { length: 10 }),
    region: varchar('region', { length: 128 }),
    city: varchar('city', { length: 128 }),

    createdAt: timestamp('created_at').defaultNow().notNull()
  },
  (table) => {
    return {
      siteStartedAtIndex: index('ts_site_started_at_idx').on(table.site, table.startedAt),
      siteCountryStartedAtIndex: index('ts_site_country_started_at_idx').on(table.site, table.countryCode, table.startedAt),
      siteDeviceStartedAtIndex: index('ts_site_device_started_at_idx').on(table.site, table.deviceType, table.startedAt),
      siteReferrerStartedAtIndex: index('ts_site_referrer_started_at_idx').on(table.site, table.referrerType, table.startedAt),
      siteEntryStartedAtIndex: index('ts_site_entry_started_at_idx').on(table.site, table.entryPath, table.startedAt),
      siteExitStartedAtIndex: index('ts_site_exit_started_at_idx').on(table.site, table.exitPath, table.startedAt),
      visitorStartedAtIndex: index('ts_visitor_started_at_idx').on(table.visitorId, table.startedAt),
      startedAtIndex: index('ts_started_at_idx').on(table.startedAt)
    };
  }
);

export const trafficPageviews = pgTable(
  'traffic_pageviews',
  {
    sessionId: varchar('session_id', { length: 128 }).notNull(),
    visitorId: varchar('visitor_id', { length: 128 }),
    site: varchar('site', { length: 128 }).notNull(),
    environment: varchar('environment', { length: 32 }).notNull().default('production'),

    path: varchar('path', { length: 512 }).notNull(),
    title: varchar('title', { length: 512 }),
    query: varchar('query', { length: 2048 }),
    articleSlug: varchar('article_slug', { length: 256 }),
    category: varchar('category', { length: 128 }),

    referrer: varchar('referrer', { length: 2048 }),
    sequence: integer('sequence').notNull(),

    startedAt: timestamp('started_at').notNull(),
    endedAt: timestamp('ended_at'),
    durationMs: integer('duration_ms').default(0),
    visibleMs: integer('visible_ms').default(0),
    maxScrollPct: integer('max_scroll_pct').default(0),
    isExit: boolean('is_exit').default(false),

    deviceType: varchar('device_type', { length: 20 }).default('desktop'),
    countryCode: varchar('country_code', { length: 10 }),
    ipHash: varchar('ip_hash', { length: 64 }),

    createdAt: timestamp('created_at').defaultNow().notNull()
  },
  (table) => {
    return {
      pk: unique('tp_session_seq_uq').on(table.sessionId, table.sequence),
      siteStartedAtIndex: index('tp_site_started_at_idx').on(table.site, table.startedAt),
      sitePathStartedAtIndex: index('tp_site_path_started_at_idx').on(table.site, table.path, table.startedAt),
      siteArticleStartedAtIndex: index('tp_site_article_started_at_idx').on(table.site, table.articleSlug, table.startedAt),
      startedAtIndex: index('tp_started_at_idx').on(table.startedAt)
    };
  }
);

export const trafficEvents = pgTable(
  'traffic_events',
  {
    sessionId: varchar('session_id', { length: 128 }).notNull(),
    visitorId: varchar('visitor_id', { length: 128 }),
    site: varchar('site', { length: 128 }).notNull(),
    environment: varchar('environment', { length: 32 }).notNull().default('production'),
    
    name: varchar('name', { length: 128 }).notNull(),
    path: varchar('path', { length: 512 }).notNull(),
    props: jsonb('props'),
    
    occurredAt: timestamp('occurred_at').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull()
  },
  (table) => {
    return {
      siteEnvNameOccurredAtIndex: index('te_site_env_name_occurred_at_idx').on(table.site, table.environment, table.name, table.occurredAt),
      sessionIndex: index('te_session_id_idx').on(table.sessionId),
      occurredAtIndex: index('te_occurred_at_idx').on(table.occurredAt)
    };
  }
);

export const trafficSchema = {
  trafficSessions,
  trafficPageviews,
  trafficEvents
};
