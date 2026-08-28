import type { CRangeQueryDTO, CSessionListQueryDTO } from '../../types';
import type { ResolvedRange } from '../../core/range';
import type { SqlDialect } from './dialect';

export class SqlAnalyticsQueryBuilder {
  constructor(
    private dialect: SqlDialect,
    private tables: { sessions: string; pageviews: string }
  ) {}

  buildQueryAll(query: CRangeQueryDTO & CSessionListQueryDTO, range: ResolvedRange): { sql: string; values: any[] } {
    // Collect parameters
    const values: any[] = [];
    const p = (val: any) => {
      values.push(val);
      return '?';
    };

    const sessionsTable = this.tables.sessions;
    const pageviewsTable = this.tables.pageviews;
    
    const d = this.dialect;

    const timeFmtCurrent = d.formatDate('started_at', range.bucket);

    const sqlString = `
      WITH 
        -- Current Range
        fs AS (
          SELECT * FROM ${sessionsTable}
          WHERE site = ${p(query.site)} 
            AND device_type != 'bot'
            AND started_at >= ${p(range.from.toISOString())} 
            AND started_at < ${p(range.to.toISOString())}
        ),
        fp AS (
          SELECT * FROM ${pageviewsTable}
          WHERE site = ${p(query.site)} 
            AND device_type != 'bot'
            AND started_at >= ${p(range.from.toISOString())} 
            AND started_at < ${p(range.to.toISOString())}
        ),
        -- Previous Range
        p_fs AS (
          SELECT * FROM ${sessionsTable}
          WHERE site = ${p(query.site)} 
            AND device_type != 'bot'
            AND started_at >= ${p(range.prevFrom.toISOString())} 
            AND started_at < ${p(range.prevTo.toISOString())}
        ),
        p_fp AS (
          SELECT * FROM ${pageviewsTable}
          WHERE site = ${p(query.site)} 
            AND device_type != 'bot'
            AND started_at >= ${p(range.prevFrom.toISOString())} 
            AND started_at < ${p(range.prevTo.toISOString())}
        ),
        
        -- Totals
        totals AS (
          SELECT 
            COUNT(*) as sessions,
            COUNT(DISTINCT COALESCE(visitor_id, ip_hash)) as visitors,
            COALESCE(AVG(duration_ms), 0) as avg_session_duration_ms,
            SUM(CASE WHEN page_count <= 1 THEN 1 ELSE 0 END) as bounces
          FROM fs
        ),
        pv_totals AS (
          SELECT COUNT(*) as pageviews FROM fp
        ),
        prev_totals AS (
          SELECT 
            COUNT(*) as sessions,
            COUNT(DISTINCT COALESCE(visitor_id, ip_hash)) as visitors,
            COALESCE(AVG(duration_ms), 0) as avg_session_duration_ms,
            SUM(CASE WHEN page_count <= 1 THEN 1 ELSE 0 END) as bounces
          FROM p_fs
        ),
        prev_pv_totals AS (
          SELECT COUNT(*) as pageviews FROM p_fp
        ),

        -- Timeseries
        ts_sessions AS (
          SELECT 
            ${timeFmtCurrent} as t,
            COUNT(*) as sessions,
            COUNT(DISTINCT COALESCE(visitor_id, ip_hash)) as visitors
          FROM fs
          GROUP BY 1
        ),
        ts_pageviews AS (
          SELECT 
            ${timeFmtCurrent} as t,
            COUNT(*) as pageviews
          FROM fp
          GROUP BY 1
        ),
        
        -- Pages
        pages AS (
          SELECT 
            path,
            MAX(title) as title,
            COUNT(*) as pageviews,
            COUNT(DISTINCT COALESCE(visitor_id, ip_hash)) as visitors,
            SUM(CASE WHEN is_exit = true THEN 1 ELSE 0 END) as exits,
            SUM(visible_ms) as total_visible_ms,
            SUM(CASE WHEN visible_ms > 0 THEN 1 ELSE 0 END) as timed_views
          FROM fp
          GROUP BY path
          ORDER BY pageviews DESC
          LIMIT ${p(query.limit || 50)}
        ),
        
        -- Entry / Exit
        entry_pages AS (
          SELECT 
            entry_path as path,
            COUNT(*) as sessions,
            SUM(CASE WHEN page_count <= 1 THEN 1 ELSE 0 END) as bounces
          FROM fs
          GROUP BY entry_path
          ORDER BY sessions DESC
          LIMIT ${p(query.limit || 50)}
        ),
        exit_pages AS (
          SELECT 
            exit_path as path,
            COUNT(*) as sessions
          FROM fs
          WHERE exit_path IS NOT NULL
          GROUP BY exit_path
          ORDER BY sessions DESC
          LIMIT ${p(query.limit || 50)}
        ),
        
        -- Referrers
        ref_type AS (
          SELECT 
            COALESCE(referrer_type, 'Unknown') as name,
            COUNT(*) as count
          FROM fs
          GROUP BY name
          ORDER BY count DESC
          LIMIT 10
        ),
        ref_host AS (
          SELECT 
            COALESCE(referrer_host, 'Unknown') as name,
            COUNT(*) as count
          FROM fs
          WHERE referrer_host IS NOT NULL AND referrer_host != ''
          GROUP BY name
          ORDER BY count DESC
          LIMIT ${p(query.limit || 50)}
        ),
        
        -- Geo
        geo_countries AS (
          SELECT 
            country_code as code,
            COUNT(*) as sessions,
            SUM(CASE WHEN page_count > 0 THEN page_count ELSE 1 END) as pageviews
          FROM fs
          WHERE country_code IS NOT NULL AND country_code != ''
          GROUP BY code
          ORDER BY sessions DESC
          LIMIT ${p(query.limit || 50)}
        ),
        
        -- Tech
        tech_devices AS (
          SELECT 
            COALESCE(device_type, 'Unknown') as name,
            COUNT(*) as count
          FROM fs
          GROUP BY name
          ORDER BY count DESC
          LIMIT 10
        ),
        
        -- Sessions List
        sessions_list AS (
          SELECT * FROM fs
          ORDER BY last_seen_at DESC
          LIMIT ${p(query.limit || 25)} OFFSET ${p(((query.page || 1) - 1) * (query.limit || 25))}
        ),
        
        -- JSON Packaging
        json_totals AS (
          SELECT ${d.jsonObject({
            sessions: 't.sessions',
            visitors: 't.visitors',
            pageviews: 'pt.pageviews',
            avgSessionDurationMs: 't.avg_session_duration_ms',
            pagesPerSession: 'CASE WHEN t.sessions > 0 THEN (CAST(pt.pageviews AS FLOAT) / t.sessions) ELSE 0 END',
            bounceRate: 'CASE WHEN t.sessions > 0 THEN (CAST(t.bounces AS FLOAT) / t.sessions) ELSE 0 END'
          })} as val FROM totals t CROSS JOIN pv_totals pt
        ),
        json_prev_totals AS (
          SELECT ${d.jsonObject({
            sessions: 't.sessions',
            visitors: 't.visitors',
            pageviews: 'pt.pageviews',
            avgSessionDurationMs: 't.avg_session_duration_ms',
            pagesPerSession: 'CASE WHEN t.sessions > 0 THEN (CAST(pt.pageviews AS FLOAT) / t.sessions) ELSE 0 END',
            bounceRate: 'CASE WHEN t.sessions > 0 THEN (CAST(t.bounces AS FLOAT) / t.sessions) ELSE 0 END'
          })} as val FROM prev_totals t CROSS JOIN prev_pv_totals pt
        ),
        json_timeseries AS (
          SELECT ${d.jsonAgg(d.jsonObject({
            t: 'ts.t',
            sessions: 'ts.sessions',
            visitors: 'ts.visitors',
            pageviews: 'COALESCE(tp.pageviews, 0)'
          }))} as val 
          FROM ts_sessions ts
          LEFT JOIN ts_pageviews tp ON ts.t = tp.t
        ),
        json_pages AS (
          SELECT ${d.jsonAgg(d.jsonObject({
            path: 'path',
            title: 'title',
            pageviews: 'pageviews',
            visitors: 'visitors',
            exits: 'exits',
            avgTimeOnPageMs: 'CASE WHEN timed_views > 0 THEN (CAST(total_visible_ms AS FLOAT) / timed_views) ELSE 0 END',
            exitRate: 'CASE WHEN pageviews > 0 THEN (CAST(exits AS FLOAT) / pageviews) ELSE 0 END'
          }))} as val FROM pages
        ),
        json_entry_pages AS (
          SELECT ${d.jsonAgg(d.jsonObject({
            path: 'path',
            sessions: 'sessions',
            bounceRate: 'CASE WHEN sessions > 0 THEN (CAST(bounces AS FLOAT) / sessions) ELSE 0 END'
          }))} as val FROM entry_pages
        ),
        json_exit_pages AS (
          SELECT ${d.jsonAgg(d.jsonObject({
            path: 'path',
            sessions: 'sessions',
            exitRate: '0'
          }))} as val FROM exit_pages
        ),
        json_ref_type AS (
          SELECT ${d.jsonAgg(d.jsonObject({
            name: 'name',
            count: 'count'
          }))} as val FROM ref_type
        ),
        json_ref_host AS (
          SELECT ${d.jsonAgg(d.jsonObject({
            name: 'name',
            count: 'count'
          }))} as val FROM ref_host
        ),
        json_geo_countries AS (
          SELECT ${d.jsonAgg(d.jsonObject({
            code: 'code',
            name: 'code',
            sessions: 'sessions',
            pageviews: 'pageviews'
          }))} as val FROM geo_countries
        ),
        json_tech_devices AS (
          SELECT ${d.jsonAgg(d.jsonObject({
            name: 'name',
            count: 'count'
          }))} as val FROM tech_devices
        ),
        json_sessions_list AS (
          SELECT ${d.jsonAgg(d.jsonObject({
            sessionId: 'session_id',
            startedAt: 'started_at',
            lastSeenAt: 'last_seen_at',
            endedAt: 'ended_at',
            durationMs: 'duration_ms',
            pageCount: 'page_count',
            isBounce: 'CASE WHEN page_count <= 1 THEN 1 ELSE 0 END',
            entryPath: 'entry_path',
            exitPath: 'exit_path',
            referrerHost: 'referrer_host',
            referrerType: "COALESCE(referrer_type, 'direct')",
            deviceType: "COALESCE(device_type, 'desktop')",
            browser: 'browser',
            os: 'os',
            screenW: 'screen_w',
            screenH: 'screen_h',
            ipTruncated: 'ip_truncated',
            countryCode: 'country_code',
            country: 'country',
            city: 'city',
            isLive: '0'
          }))} as val FROM sessions_list
        )
        
      SELECT 
        (SELECT val FROM json_totals) as totals,
        (SELECT val FROM json_prev_totals) as previous,
        (SELECT val FROM json_timeseries) as timeseries,
        (SELECT val FROM json_pages) as pages,
        (SELECT val FROM json_entry_pages) as entry_pages,
        (SELECT val FROM json_exit_pages) as exit_pages,
        (SELECT val FROM json_ref_type) as ref_type,
        (SELECT val FROM json_ref_host) as ref_host,
        (SELECT val FROM json_geo_countries) as geo_countries,
        (SELECT val FROM json_tech_devices) as tech_devices,
        (SELECT val FROM json_sessions_list) as sessions_list,
        (SELECT sessions FROM totals) as total_sessions
    `;

    return { sql: sqlString, values };
  }
}
