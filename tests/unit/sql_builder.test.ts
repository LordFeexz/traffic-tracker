import { describe, it, expect } from 'vitest';
import { SqlAnalyticsQueryBuilder } from '../../src/adapters/sql/builder';
import { SqliteDialect, PgDialect, MysqlDialect } from '../../src/adapters/sql/dialect';
import { resolveRange } from '../../src/core/range';

describe('SqlAnalyticsQueryBuilder', () => {
  it('generates the same number of placeholders as bound values', () => {
    const builder = new SqlAnalyticsQueryBuilder(new SqliteDialect(), {
      sessions: 'sessions',
      pageviews: 'pageviews'
    });

    const query = { site: 'test-site', range: '7d' as const, limit: 10, page: 1 };
    const range = resolveRange(query);

    const { sql, values } = builder.buildQueryAll(query, range);

    const placeholderCount = (sql.match(/\?/g) || []).length;
    
    expect(placeholderCount).toBeGreaterThan(0);
    expect(placeholderCount).toBe(values.length);
  });

  it('uses standard boolean true syntax compatible with postgres', () => {
    const builder = new SqlAnalyticsQueryBuilder(new SqliteDialect(), {
      sessions: 'sessions',
      pageviews: 'pageviews'
    });
    const query = { site: 'test-site', range: '7d' as const, limit: 10, page: 1 };
    const range = resolveRange(query);
    
    const { sql } = builder.buildQueryAll(query, range);
    
    expect(sql).toContain('is_exit = true');
    expect(sql).not.toContain('is_exit = 1');
  });

  it('calculates and binds limit and offset correctly', () => {
    const builder = new SqlAnalyticsQueryBuilder(new SqliteDialect(), {
      sessions: 'sessions',
      pageviews: 'pageviews'
    });
    
    // Page 3 with limit 15 should result in OFFSET 30
    const query = { site: 'test-site', range: '7d' as const, limit: 15, page: 3 };
    const range = resolveRange(query);
    
    const { values } = builder.buildQueryAll(query, range);
    
    // The very last parameter pushed is offset, preceded by limit for sessions_list
    const offset = values[values.length - 1];
    const limit = values[values.length - 2];
    
    expect(limit).toBe(15);
    expect(offset).toBe(30);
  });

  it('formats json correctly for PostgreSQL dialect', () => {
    // Let's actually use PgDialect for this test
    const pgBuilder = new SqlAnalyticsQueryBuilder(new PgDialect(), {
      sessions: 'sessions',
      pageviews: 'pageviews'
    });

    const query = { site: 'test-site', range: '24h' as const, limit: 10, page: 1 };
    const range = resolveRange(query);
    const { sql } = pgBuilder.buildQueryAll(query, range);

    // PostgreSQL should use json_build_object and json_agg
    expect(sql).toContain('json_build_object');
    expect(sql).toContain('json_agg');
    expect(sql).toContain("date_trunc('hour'");
  });

  it('formats json correctly for MySQL dialect', () => {
    const mysqlBuilder = new SqlAnalyticsQueryBuilder(new MysqlDialect(), {
      sessions: 'sessions',
      pageviews: 'pageviews'
    });

    const query = { site: 'test-site', range: '24h' as const, limit: 10, page: 1 };
    const range = resolveRange(query);
    const { sql } = mysqlBuilder.buildQueryAll(query, range);

    // MySQL should use JSON_OBJECT and JSON_ARRAYAGG
    expect(sql).toContain('JSON_OBJECT');
    expect(sql).toContain('JSON_ARRAYAGG');
    expect(sql).toContain("DATE_FORMAT(");
  });

  it('binds custom date ranges correctly', () => {
    const builder = new SqlAnalyticsQueryBuilder(new SqliteDialect(), {
      sessions: 'sessions',
      pageviews: 'pageviews'
    });

    const customFrom = '2026-01-01T00:00:00.000Z';
    const customTo = '2026-01-05T00:00:00.000Z';

    const query = { 
      site: 'custom-site', 
      range: '7d' as const, // will be ignored because from/to are provided
      from: customFrom,
      to: customTo,
      limit: 10, 
      page: 1 
    };

    const range = resolveRange(query);
    const { values } = builder.buildQueryAll(query, range);

    // Site is pushed first, then from, then to for the current range
    expect(values[0]).toBe('custom-site');
    expect(values[1]).toBe(customFrom);
    expect(values[2]).toBe(customTo);
  });
});
