import { describe, it, expect, beforeEach } from 'vitest';
import { TrafficCollectService } from '../../src/core/collect';
import { createMockAdapter } from '../helpers/mock-adapter';
import type { CollectPayload } from '../../src/types';

describe('TrafficCollectService', () => {
  let adapter: ReturnType<typeof createMockAdapter>;
  let service: TrafficCollectService;

  beforeEach(() => {
    adapter = createMockAdapter();
    service = new TrafficCollectService(adapter);
  });

  const baseMeta = {
    ua: { deviceType: 'desktop' as const },
    ipTruncated: '127.0.0.0',
    ipHash: 'abc',
    geo: { countryCode: 'US' }
  };

  it('ingests a basic session and pageview', async () => {
    const payload: CollectPayload = {
      site: 'test',
      environment: 'production',
      consentMode: 'full',
      sessionId: 's1',
      visitorId: 'v1',
      events: [
        { type: 'session_start', ts: 1000, entryPath: '/', referrer: '', screenW: 0, screenH: 0, viewportW: 0, viewportH: 0, dpr: 1, language: '', timezone: '' },
        { type: 'pageview', ts: 1005, path: '/', sequence: 1, referrer: '', viewportW: 800, viewportH: 600 }
      ]
    };

    await service.ingest(payload, baseMeta);

    expect(adapter.sessions.size).toBe(1);
    expect(adapter.pageviews.size).toBe(1);

    const session = adapter.sessions.get('s1')!;
    expect(session.visitorId).toBe('v1');
    expect(session.entryPath).toBe('/');
    expect(session.pageCount).toBe(1);
  });

  it('strips visitorId in anonymous mode', async () => {
    const payload: CollectPayload = {
      site: 'test',
      environment: 'production',
      consentMode: 'anonymous',
      sessionId: 's2',
      visitorId: 'v2', // Should be ignored
      events: [
        { type: 'session_start', ts: 1000, entryPath: '/', referrer: '', screenW: 0, screenH: 0, viewportW: 0, viewportH: 0, dpr: 1, language: '', timezone: '' }
      ]
    };

    await service.ingest(payload, baseMeta);

    const session = adapter.sessions.get('s2')!;
    expect(session.visitorId).toBeUndefined();
  });

  it('updates session duration on page_exit', async () => {
    const payload: CollectPayload = {
      site: 'test',
      environment: 'production',
      consentMode: 'anonymous',
      sessionId: 's3',
      events: [
        { type: 'pageview', ts: 1000, path: '/blog', sequence: 1, referrer: '', viewportW: 800, viewportH: 600 },
        { type: 'page_exit', ts: 5000, path: '/blog', sequence: 1, durationMs: 4000, visibleMs: 4000, maxScrollPct: 50 }
      ]
    };

    await service.ingest(payload, baseMeta);
    
    const pv = adapter.pageviews.get('s3:1')!;
    expect(pv.durationMs).toBe(4000);
    expect(pv.maxScrollPct).toBe(50);
  });

  it('handles session_end and custom events', async () => {
    const payload: CollectPayload = {
      site: 'test',
      environment: 'production',
      consentMode: 'anonymous',
      sessionId: 's4',
      events: [
        { type: 'session_start', ts: 1000, entryPath: '/', referrer: '', screenW: 0, screenH: 0, viewportW: 0, viewportH: 0, dpr: 1, language: '', timezone: '' },
        { type: 'pageview', ts: 1005, path: '/', sequence: 1, referrer: '', viewportW: 800, viewportH: 600 },
        { type: 'event', ts: 2000, name: 'click', path: '/', props: { btn: 'buy' } },
        { type: 'session_end', ts: 5000, durationMs: 4000, pageCount: 1, exitPath: '/' }
      ]
    };

    await service.ingest(payload, baseMeta);

    expect(adapter.events.length).toBe(1);
    expect(adapter.events[0].name).toBe('click');
    expect(adapter.pageviews.get('s4:1')?.isExit).toBe(true);
  });
});
