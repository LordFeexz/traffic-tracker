import type { TrafficAdapter } from '../../adapter';
import { DrizzleTrafficAdapter, type DrizzleSchemaConfig } from './operations';

export interface DrizzleAdapterOptions {
  provider: 'pg' | 'mysql' | 'sqlite';
  schema?: DrizzleSchemaConfig; // Allow overriding schema
}

export function drizzleAdapter(db: any, options: DrizzleAdapterOptions): TrafficAdapter {
  return new DrizzleTrafficAdapter(db, options.schema);
}

export * from './schema';
