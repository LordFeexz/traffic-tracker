import type { TrafficAdapter } from '../../adapter';
import { PrismaMongoTrafficAdapter, type PrismaMongoAdapterOptions } from './operations';

export type { PrismaMongoAdapterOptions };
export { PrismaMongoTrafficAdapter };

export function prismaMongoAdapter(prisma: any, options?: PrismaMongoAdapterOptions): TrafficAdapter {
  return new PrismaMongoTrafficAdapter(prisma, options);
}
