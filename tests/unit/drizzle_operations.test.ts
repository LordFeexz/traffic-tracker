import { describe, it, expect, vi } from 'vitest';
import { DrizzleTrafficAdapter } from '../../src/adapters/drizzle/operations';

describe('Drizzle Row Extraction', () => {
  it('extracts rows correctly when driver returns an array of objects (postgres.js format)', async () => {
    const mockDb = {
      execute: vi.fn().mockResolvedValue([
        {
          totals: '{"sessions": 6, "visitors": 5}',
          previous: '{}',
          timeseries: '[]',
          pages: '[]',
          entry_pages: '[]',
          exit_pages: '[]',
          ref_type: '[]',
          ref_host: '[]',
          geo_countries: '[]',
          tech_devices: '[]',
          sessions_list: '[]',
          total_sessions: 6
        }
      ])
    };
    
    const adapter = new DrizzleTrafficAdapter(mockDb as any, 'pg');
    (adapter as any).dialect = 'pg';

    const range = { from: new Date(), to: new Date(), prevFrom: new Date(), prevTo: new Date(), bucket: 'day' as const };
    const result = await adapter.queryAll({ site: 'test', limit: 10, page: 1, range: '7d' }, range);
    
    expect(result.overview.totals.sessions).toBe(6);
    expect(result.overview.totals.visitors).toBe(5);
  });

  it('extracts rows correctly when driver returns { rows: [...] } (node-postgres format)', async () => {
    const mockDb = {
      execute: vi.fn().mockResolvedValue({
        rows: [
          {
            totals: '{"sessions": 8}',
            previous: '{}',
            timeseries: '[]',
            pages: '[]',
            entry_pages: '[]',
            exit_pages: '[]',
            ref_type: '[]',
            ref_host: '[]',
            geo_countries: '[]',
            tech_devices: '[]',
            sessions_list: '[]',
            total_sessions: 8
          }
        ]
      })
    };
    
    const adapter = new DrizzleTrafficAdapter(mockDb as any, 'pg');
    const range = { from: new Date(), to: new Date(), prevFrom: new Date(), prevTo: new Date(), bucket: 'day' as const };
    const result = await adapter.queryAll({ site: 'test', limit: 10, page: 1, range: '7d' }, range);
    
    expect(result.overview.totals.sessions).toBe(8);
  });
});
