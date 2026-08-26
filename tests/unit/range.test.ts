import { describe, it, expect } from 'vitest';
import { resolveRange } from '../../src/core/range';

describe('range utils', () => {
  const now = new Date('2024-01-15T12:00:00Z');

  it('resolves named ranges', () => {
    const res = resolveRange({ site: 'test', range: '24h', limit: 10 }, now);
    expect(res.bucket).toBe('hour');
    expect(res.to).toEqual(now);
    expect(res.from).toEqual(new Date('2024-01-14T12:00:00Z'));
  });

  it('resolves custom ranges', () => {
    const from = '2024-01-01T00:00:00Z';
    const to = '2024-01-10T00:00:00Z';
    const res = resolveRange({ site: 'test', range: '7d', from, to, limit: 10 }, now);
    
    expect(res.bucket).toBe('day');
    expect(res.from).toEqual(new Date(from));
    expect(res.to).toEqual(new Date(to));
  });

  it('handles today specifically', () => {
    const res = resolveRange({ site: 'test', range: 'today', limit: 10 }, now);
    expect(res.from).toEqual(new Date('2024-01-15T00:00:00Z'));
    expect(res.to).toEqual(now);
  });
});
