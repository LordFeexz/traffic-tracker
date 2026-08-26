import type { TrafficAdapter } from '../../adapter';
import { MongoTrafficAdapter } from './operations';
import type { Db } from 'mongodb';

export interface MongoAdapterOptions {
  // Add any MongoDB specific options here if needed later
}

export function mongoAdapter(db: Db, options?: MongoAdapterOptions): TrafficAdapter {
  return new MongoTrafficAdapter(db);
}
