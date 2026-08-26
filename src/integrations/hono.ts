import type { TrafficTracker } from '../index';
import { CollectSchema } from '../types';
import type {Context} from 'hono'

export function createHonoTrafficHandler(tracker: TrafficTracker) {
  return async (c: Context) => {
    try {
      const body = await c.req.text();
      const parsed = JSON.parse(body);
      
      const result = await CollectSchema.safeParseAsync(parsed);
      if (!result.success) {
        return c.json({ error: 'Invalid payload', details: result.error.flatten() }, 400);
      }

      const ip = c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || '127.0.0.1';
      const userAgent = c.req.header('user-agent');

      tracker.handleCollect(result.data, {
        userAgent,
        ip: ip.split(',')[0].trim()
      });

      return new Response(null, { status: 204 });
    } catch (error) {
      console.error('[traffic-tracker] ingest error:', error);
      return c.json({ error: 'Internal Server Error' }, 500);
    }
  };
}
