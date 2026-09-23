import { describe, it, expect } from 'vitest';
import { prismaMongoSchema } from '../../src/adapters/prisma-mongo/schema';

describe('Prisma Mongo Schema', () => {
  it('exports valid prisma schema definition containing all models', () => {
    expect(prismaMongoSchema).toContain('model TrafficSession');
    expect(prismaMongoSchema).toContain('type TrafficUtm');
    expect(prismaMongoSchema).toContain('model TrafficPageview');
    expect(prismaMongoSchema).toContain('model TrafficEvent');
    expect(prismaMongoSchema).toContain('@@map("traffic_sessions")');
    expect(prismaMongoSchema).toContain('@@map("traffic_pageviews")');
    expect(prismaMongoSchema).toContain('@@map("traffic_events")');
  });
});
