import { describe, it, expect, vi } from 'vitest';
import { prismaMongoAdapter, PrismaMongoTrafficAdapter } from '../../src/adapters/prisma-mongo';

describe('PrismaMongoTrafficAdapter', () => {
  const mockPrisma = {
    trafficSession: {
      upsert: vi.fn().mockResolvedValue({}),
      aggregateRaw: vi.fn().mockResolvedValue([]),
    },
    trafficPageview: {
      upsert: vi.fn().mockResolvedValue({}),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      aggregateRaw: vi.fn().mockResolvedValue([]),
    },
    trafficEvent: {
      createMany: vi.fn().mockResolvedValue({ count: 1 }),
      aggregateRaw: vi.fn().mockResolvedValue([]),
    },
    $runCommandRaw: vi.fn().mockResolvedValue({ ok: 1 }),
  };

  const adapter = prismaMongoAdapter(mockPrisma);

  it('creates instance via factory function', () => {
    expect(adapter).toBeInstanceOf(PrismaMongoTrafficAdapter);
  });

  it('upserts session using prisma.trafficSession.upsert', async () => {
    const started = new Date();
    await adapter.upsertSession('s1', {
      site: 'mia-apps',
      lastSeenAt: started,
      pageCount: 2
    }, {
      startedAt: started,
      entryPath: '/home'
    });

    expect(mockPrisma.trafficSession.upsert).toHaveBeenCalledWith({
      where: { sessionId: 's1' },
      create: expect.objectContaining({
        sessionId: 's1',
        site: 'mia-apps',
        entryPath: '/home',
        pageCount: 2
      }),
      update: expect.objectContaining({
        site: 'mia-apps',
        lastSeenAt: started,
        pageCount: 2
      })
    });
    expect(mockPrisma.$runCommandRaw).toHaveBeenCalled();
  });

  it('upserts pageview using prisma.trafficPageview.upsert with composite key', async () => {
    const started = new Date();
    await adapter.upsertPageview('s1', 1, {
      durationMs: 5000,
      visibleMs: 4000
    }, {
      site: 'mia-apps',
      path: '/jobs',
      startedAt: started
    });

    expect(mockPrisma.trafficPageview.upsert).toHaveBeenCalledWith({
      where: {
        sessionId_sequence: {
          sessionId: 's1',
          sequence: 1
        }
      },
      create: expect.objectContaining({
        sessionId: 's1',
        sequence: 1,
        site: 'mia-apps',
        path: '/jobs'
      }),
      update: expect.objectContaining({
        durationMs: 5000,
        visibleMs: 4000
      })
    });
  });

  it('marks exit page using prisma.trafficPageview.updateMany', async () => {
    await adapter.markExitPage('s1', 1);
    expect(mockPrisma.trafficPageview.updateMany).toHaveBeenCalledWith({
      where: { sessionId: 's1', sequence: 1 },
      data: { isExit: true }
    });
  });

  it('inserts events using prisma.trafficEvent.createMany', async () => {
    const occurredAt = new Date();
    await adapter.insertEvents([
      {
        sessionId: 's1',
        site: 'mia-apps',
        environment: 'production',
        name: 'button_click',
        path: '/jobs',
        occurredAt,
        createdAt: occurredAt
      }
    ]);

    expect(mockPrisma.trafficEvent.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          sessionId: 's1',
          site: 'mia-apps',
          name: 'button_click'
        })
      ]
    });
  });

  it('queries overview using aggregateRaw', async () => {
    mockPrisma.trafficSession.aggregateRaw.mockResolvedValueOnce([
      { sessions: 10, visitors: 8, bounces: 2, avgSessionDurationMs: 30000 }
    ]).mockResolvedValueOnce([
      { _id: '2026-09-22T10:00:00.000Z', sessions: 5, visitors: ['v1', 'v2'] }
    ]);
    mockPrisma.trafficPageview.aggregateRaw.mockResolvedValueOnce([
      { pageviews: 25 }
    ]).mockResolvedValueOnce([
      { _id: '2026-09-22T10:00:00.000Z', pageviews: 12 }
    ]);

    const result = await adapter.queryOverview({ site: 'mia-apps', range: '24h', limit: 10 }, {
      from: new Date('2026-09-22T00:00:00.000Z'),
      to: new Date('2026-09-22T23:59:59.000Z'),
      bucket: 'hour',
      prevFrom: new Date('2026-09-21T00:00:00.000Z'),
      prevTo: new Date('2026-09-21T23:59:59.000Z')
    });

    expect(result.totals.sessions).toBe(10);
    expect(result.totals.visitors).toBe(8);
    expect(result.totals.pageviews).toBe(25);
  });
});
