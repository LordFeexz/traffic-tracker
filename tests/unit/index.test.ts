import { describe, it, expect } from 'vitest';
import { createTrafficTracker } from '../../src/index';
import { createMockAdapter } from '../helpers/mock-adapter';
import type { CollectPayload } from '../../src/types';

describe('TrafficTracker (index)', () => {
  const adapter = createMockAdapter();
  const tracker = createTrafficTracker({ database: adapter });

  it('creates tracker with collect and query services', () => {
    expect(tracker.collect).toBeDefined();
    expect(tracker.query).toBeDefined();
  });

  it('handleCollect ingests a payload', async () => {
    adapter.reset();

    const payload: CollectPayload = {
      site: 'test',
      environment: 'production',
      consentMode: 'anonymous',
      sessionId: 'idx-s1',
      events: [
        {
          type: 'session_start', ts: 1000, entryPath: '/home', referrer: '',
          screenW: 1920, screenH: 1080, viewportW: 1280, viewportH: 720, dpr: 1, language: 'en', timezone: 'UTC'
        }
      ]
    };

    await tracker.handleCollect(payload, {
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0',
      ip: '1.2.3.4'
    });

    expect(adapter.sessions.size).toBe(1);
  });

  it('handleCollect with geo provider', async () => {
    adapter.reset();

    const geoProvider = {
      lookup: async (_ip: string) => ({ countryCode: 'US', country: 'United States' })
    };

    const trackerWithGeo = createTrafficTracker({ database: adapter, geo: geoProvider });

    const payload: CollectPayload = {
      site: 'test',
      environment: 'production',
      consentMode: 'anonymous',
      sessionId: 'idx-s2',
      events: [
        {
          type: 'session_start', ts: 1000, entryPath: '/', referrer: '',
          screenW: 0, screenH: 0, viewportW: 0, viewportH: 0, dpr: 1, language: 'en', timezone: 'UTC'
        }
      ]
    };

    await trackerWithGeo.handleCollect(payload, { ip: '8.8.8.8' });

    const session = adapter.sessions.get('idx-s2');
    expect(session?.countryCode).toBe('US');
  });

  it('handleCollect handles geo provider error gracefully', async () => {
    adapter.reset();

    const failingGeo = {
      lookup: async (_ip: string) => { throw new Error('geo failed'); }
    };

    const trackerBad = createTrafficTracker({ database: adapter, geo: failingGeo });

    const payload: CollectPayload = {
      site: 'test',
      environment: 'production',
      consentMode: 'anonymous',
      sessionId: 'idx-s3',
      events: [
        {
          type: 'session_start', ts: 1000, entryPath: '/', referrer: '',
          screenW: 0, screenH: 0, viewportW: 0, viewportH: 0, dpr: 1, language: 'en', timezone: 'UTC'
        }
      ]
    };

    // Should not throw
    await expect(trackerBad.handleCollect(payload, { ip: '1.1.1.1' })).resolves.toBeUndefined();
  });
});
