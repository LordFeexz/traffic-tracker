import type { TrafficTracker } from '../index';
import { CollectSchema } from '../types';

export function createSvelteKitTrafficHandler(tracker: TrafficTracker) {
  return async ({ request, getClientAddress }: { request: Request; getClientAddress: () => string }) => {
    try {
      const body = await request.text();
      const parsed = JSON.parse(body);
      
      const result = await CollectSchema.safeParseAsync(parsed);
      if (!result.success) {
        return new Response(JSON.stringify({ error: 'Invalid payload', details: result.error.flatten() }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      let ip = '127.0.0.1';
      try {
        ip = getClientAddress();
      } catch {
        // Some adapters might throw if IP isn't available
      }
      
      const userAgent = request.headers.get('user-agent') || undefined;

      tracker.handleCollect(result.data, {
        userAgent,
        ip
      });

      return new Response(null, { status: 204 });
    } catch (error) {
      console.error('[traffic-tracker] ingest error:', error);
      return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  };
}
