import { describe, it, expect } from 'vitest';
import { createDialect } from '../../src/adapters/sql/dialect';

describe('SqlDialect', () => {
  it('creates pg dialect', () => {
    const dialect = createDialect('pg');
    expect(dialect.jsonObject({ a: '1' })).toContain('json_build_object');
    expect(dialect.jsonAgg('obj')).toContain('json_agg');
    expect(dialect.formatDate('ts', 'day')).toContain("date_trunc('day'");
    expect(dialect.formatDate('ts', 'hour')).toContain("date_trunc('hour'");
  });

  it('creates mysql dialect', () => {
    const dialect = createDialect('mysql');
    expect(dialect.jsonObject({ a: '1' })).toContain('JSON_OBJECT');
    expect(dialect.jsonAgg('obj')).toContain('JSON_ARRAYAGG');
    expect(dialect.formatDate('ts', 'day')).toContain('DATE_FORMAT');
    expect(dialect.formatDate('ts', 'hour')).toContain('%Y-%m-%d %H:00:00');
  });

  it('creates sqlite dialect', () => {
    const dialect = createDialect('sqlite');
    expect(dialect.jsonObject({ a: '1' })).toContain('json_object');
    expect(dialect.jsonAgg('obj')).toContain('json_group_array');
    expect(dialect.formatDate('ts', 'day')).toContain('substr');
    expect(dialect.formatDate('ts', 'hour')).toContain('substr');
  });

  it('throws on unknown', () => {
    expect(() => createDialect('unknown' as any)).toThrow('Unsupported SQL provider');
  });
});
