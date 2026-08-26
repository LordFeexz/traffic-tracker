import type { CRangeQueryDTO } from '../types';

export interface ResolvedRange {
  from: Date;
  to: Date;
  bucket: 'hour' | 'day';
  prevFrom: Date;
  prevTo: Date;
}

const RANGE_MS: Record<string, number> = {
  '24h': 24 * 3_600_000,
  '7d': 7 * 86_400_000,
  '30d': 30 * 86_400_000,
  '90d': 90 * 86_400_000
};

export function resolveRange(query: CRangeQueryDTO, now = new Date()): ResolvedRange {
  let from: Date;
  let to: Date;

  if (query.from && query.to) {
    from = new Date(query.from);
    to = new Date(query.to);
  } else if (query.range === 'today') {
    from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    to = now;
  } else {
    to = now;
    from = new Date(now.getTime() - (RANGE_MS[query.range] ?? RANGE_MS['7d']!));
  }

  const span = Math.max(1, to.getTime() - from.getTime());
  const bucket: 'hour' | 'day' = span <= 2 * 86_400_000 ? 'hour' : 'day';

  return {
    from,
    to,
    bucket,
    prevFrom: new Date(from.getTime() - span),
    prevTo: from
  };
}
