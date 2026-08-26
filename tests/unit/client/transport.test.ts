import { describe, it, expect, vi } from 'vitest';
import { Transport } from '../../../src/client/transport';
import type { CollectPayload } from '../../../src/types';

const makeEnvelope = (): Omit<CollectPayload, 'events'> => ({
  site: 'test',
  environment: 'production',
  consentMode: 'anonymous',
  sessionId: 's1'
});

describe('Transport', () => {
  it('does not flush if queue is empty', () => {
    const fetchSpy = vi.fn();
    const originalFetch = globalThis.fetch;
    globalThis.fetch = fetchSpy as any;

    const transport = new Transport('/collect', makeEnvelope);
    transport.flush();

    expect(fetchSpy).not.toHaveBeenCalled();
    globalThis.fetch = originalFetch;
  });

  it('sends events on flush', () => {
    const fetchSpy = vi.fn().mockResolvedValue(new Response());
    const originalFetch = globalThis.fetch;
    globalThis.fetch = fetchSpy as any;

    const transport = new Transport('/collect', makeEnvelope);
    transport.enqueue({ type: 'pageview', ts: 1000, path: '/', sequence: 1, referrer: '', viewportW: 800, viewportH: 600 });
    transport.flush();

    expect(fetchSpy).toHaveBeenCalledOnce();
    const [url, opts] = fetchSpy.mock.calls[0];
    expect(url).toBe('/collect');
    const body = JSON.parse(opts.body);
    expect(body.events).toHaveLength(1);
    expect(body.events[0].type).toBe('pageview');

    globalThis.fetch = originalFetch;
  });

  it('flushes immediately when max queue is exceeded', () => {
    const fetchSpy = vi.fn().mockResolvedValue(new Response());
    const originalFetch = globalThis.fetch;
    globalThis.fetch = fetchSpy as any;

    const transport = new Transport('/collect', makeEnvelope);
    for (let i = 0; i < 100; i++) {
      transport.enqueue({ type: 'pageview', ts: i, path: '/', sequence: i, referrer: '', viewportW: 0, viewportH: 0 });
    }

    expect(fetchSpy).toHaveBeenCalledOnce();
    globalThis.fetch = originalFetch;
  });

  it('flushes with immediate option', () => {
    const fetchSpy = vi.fn().mockResolvedValue(new Response());
    const originalFetch = globalThis.fetch;
    globalThis.fetch = fetchSpy as any;

    const transport = new Transport('/collect', makeEnvelope);
    transport.enqueue({ type: 'pageview', ts: 1000, path: '/', sequence: 1, referrer: '', viewportW: 0, viewportH: 0 }, { immediate: true });

    expect(fetchSpy).toHaveBeenCalledOnce();
    globalThis.fetch = originalFetch;
  });

  it('flushes immediately if beacon is true', () => {
    const originalNavigator = globalThis.navigator;
    Object.defineProperty(globalThis, 'navigator', { value: { sendBeacon: vi.fn() }, configurable: true });
    const transport = new Transport('/api', () => ({ sessionId: 's1', site: 'test', environment: 'prod', consentMode: 'full' }));
    transport.enqueue({ type: 'pageview', ts: 1, path: '/', sequence: 1, referrer: '', viewportW: 100, viewportH: 100 });
    transport.flush({ beacon: true });
    expect(navigator.sendBeacon).toHaveBeenCalled();
    if (originalNavigator) {
      Object.defineProperty(globalThis, 'navigator', { value: originalNavigator, configurable: true });
    } else {
      // @ts-ignore
      delete globalThis.navigator;
    }
  });

  it('falls back to fetch if sendBeacon is missing', () => {
    const originalFetch = globalThis.fetch;
    const originalNavigator = globalThis.navigator;
    globalThis.fetch = vi.fn().mockResolvedValue(new Response()) as any;
    Object.defineProperty(globalThis, 'navigator', { value: {}, configurable: true });
    const transport = new Transport('/api', () => ({ sessionId: 's1', site: 'test', environment: 'prod', consentMode: 'full' }));
    transport.enqueue({ type: 'pageview', ts: 1, path: '/', sequence: 1, referrer: '', viewportW: 100, viewportH: 100 });
    transport.flush({ beacon: true });
    expect(globalThis.fetch).toHaveBeenCalled();
    globalThis.fetch = originalFetch;
    if (originalNavigator) {
      Object.defineProperty(globalThis, 'navigator', { value: originalNavigator, configurable: true });
    } else {
      // @ts-ignore
      delete globalThis.navigator;
    }
  });

  it('ignores flush if queue is empty', () => {
    const originalFetch = globalThis.fetch;
    const originalNavigator = globalThis.navigator;
    globalThis.fetch = vi.fn() as any;
    Object.defineProperty(globalThis, 'navigator', { value: { sendBeacon: vi.fn() }, configurable: true });
    const transport = new Transport('/api', () => ({ sessionId: 's1', site: 'test', environment: 'prod', consentMode: 'full' }));
    transport.flush();
    expect(globalThis.fetch).not.toHaveBeenCalled();
    expect(globalThis.navigator.sendBeacon).not.toHaveBeenCalled();
    globalThis.fetch = originalFetch;
    if (originalNavigator) {
      Object.defineProperty(globalThis, 'navigator', { value: originalNavigator, configurable: true });
    } else {
      // @ts-ignore
      delete globalThis.navigator;
    }
  });
});
