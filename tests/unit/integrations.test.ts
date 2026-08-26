import { describe, it, expect } from 'vitest';
import { createTrafficTracker } from '../../src/index';
import { createHonoTrafficHandler } from '../../src/integrations/hono';
import { createSvelteKitTrafficHandler } from '../../src/integrations/sveltekit';
import { createMockAdapter } from '../helpers/mock-adapter';
import type { CollectPayload } from '../../src/types';

const validPayload: CollectPayload = {
  site: 'test',
  environment: 'production',
  consentMode: 'anonymous',
  sessionId: 'int-s1',
  events: [
    {
      type: 'session_start', ts: 1000, entryPath: '/', referrer: '',
      screenW: 0, screenH: 0, viewportW: 0, viewportH: 0, dpr: 1, language: 'en', timezone: 'UTC'
    }
  ]
};

const invalidPayload = { invalid: true };

function makeTracker() {
  const adapter = createMockAdapter();
  return { adapter, tracker: createTrafficTracker({ database: adapter }) };
}

describe('Hono Integration', () => {
  it('returns 204 on valid payload', async () => {
    const { tracker } = makeTracker();
    const handler = createHonoTrafficHandler(tracker);

    const res = await handler({
      req: {
        text: async () => JSON.stringify(validPayload),
        header: (name: string) => name === 'x-forwarded-for' ? '1.2.3.4' : 'TestUA'
      },
      json: (data: any, status: number) => ({ data, status })
    } as any);

    expect(res).toBeInstanceOf(Response);
    expect((res as Response).status).toBe(204);
  });

  it('returns 400 on invalid payload', async () => {
    const { tracker } = makeTracker();
    const handler = createHonoTrafficHandler(tracker);

    const res = await handler({
      req: {
        text: async () => JSON.stringify(invalidPayload),
        header: () => undefined
      },
      json: (data: any, status: number) => ({ data, status })
    } as any);

    expect(res.status).toBe(400);
  });

  it('returns 500 on thrown error', async () => {
    const { tracker } = makeTracker();
    const handler = createHonoTrafficHandler(tracker);

    const res = await handler({
      req: {
        text: async () => { throw new Error('Boom'); },
        header: () => undefined
      },
      json: (data: any, status: number) => ({ data, status })
    } as any);

    expect(res.status).toBe(500);
  });
});

describe('SvelteKit Integration', () => {
  it('returns 204 on valid payload', async () => {
    const { tracker } = makeTracker();
    const handler = createSvelteKitTrafficHandler(tracker);

    const res = await handler({
      request: new Request('http://localhost', {
        method: 'POST',
        body: JSON.stringify(validPayload),
        headers: { 'user-agent': 'TestUA', 'content-type': 'application/json' }
      }),
      getClientAddress: () => '1.2.3.4'
    });

    expect(res.status).toBe(204);
  });

  it('returns 400 on invalid payload', async () => {
    const { tracker } = makeTracker();
    const handler = createSvelteKitTrafficHandler(tracker);

    const res = await handler({
      request: new Request('http://localhost', {
        method: 'POST',
        body: JSON.stringify(invalidPayload)
      }),
      getClientAddress: () => '1.2.3.4'
    });

    expect(res.status).toBe(400);
  });

  it('handles getClientAddress throwing', async () => {
    const { tracker } = makeTracker();
    const handler = createSvelteKitTrafficHandler(tracker);

    const res = await handler({
      request: new Request('http://localhost', {
        method: 'POST',
        body: JSON.stringify(validPayload)
      }),
      getClientAddress: () => { throw new Error('not available'); }
    });

    expect(res.status).toBe(204); // Should still succeed, falling back to 127.0.0.1
  });

  it('returns 500 on thrown error', async () => {
    const { tracker } = makeTracker();
    const handler = createSvelteKitTrafficHandler(tracker);

    const res = await handler({
      request: new Request('http://localhost', {
        method: 'POST',
        body: null as any // Force a parse error
      }),
      getClientAddress: () => '1.2.3.4'
    });

    expect(res.status).toBe(500);
  });
});
