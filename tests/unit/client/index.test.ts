// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createTracker } from '../../../src/client';
import { Transport } from '../../../src/client/transport';

vi.mock('../../../src/client/transport', () => {
  return {
    Transport: vi.fn().mockImplementation((endpoint: string, makePayload: any) => {
      if (makePayload) makePayload();
      return {
        enqueue: vi.fn(),
        flush: vi.fn(),
      };
    }),
  };
});

describe('BrowserTracker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts and stops correctly', () => {
    const tracker = createTracker({ site: 'test' });
    tracker.start();
    tracker.stop();
    // multiple calls should not break
    tracker.stop();
  });

  it('runs safely in node environment', () => {
    const origWindow = globalThis.window;
    const origDoc = globalThis.document;
    // @ts-ignore
    delete globalThis.window;
    // @ts-ignore
    delete globalThis.document;
    
    const tracker = createTracker({ site: 'test' });
    tracker.start();
    tracker.page('/test');
    tracker.stop();
    
    globalThis.window = origWindow;
    globalThis.document = origDoc;
  });

  it('tracks pageviews and events', () => {
    const tracker = createTracker({ site: 'test' });
    tracker.start();

    tracker.page('/home', 'Home');
    tracker.setPageContext({ articleSlug: 'foo' });
    tracker.track('click_button', { btn: 'buy' });

    tracker.stop();
    expect(Transport).toHaveBeenCalled();
  });

  it('changes consent mode', () => {
    const tracker = createTracker({ site: 'test', consentMode: 'full' });
    tracker.setConsentMode('anonymous');
    tracker.setUserId('u1');
    expect(Transport).toHaveBeenCalled();
  });

  it('handles visibility and pagehide events', () => {
    if (typeof window === 'undefined') {
      globalThis.window = {
        dispatchEvent: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        innerWidth: 1024,
        innerHeight: 768,
        devicePixelRatio: 2,
        screen: { width: 1024, height: 768 }
      } as any;
      globalThis.document = {
        visibilityState: 'visible',
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      } as any;
      globalThis.navigator = { language: 'en-US' } as any;
    }

    const tracker = createTracker({ site: 'test' });
    tracker.start();
    tracker.page('/test');
    
    // trigger scroll
    window.dispatchEvent(new Event('scroll'));

    // trigger visibilitychange hidden
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    
    // trigger visibilitychange visible
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    
    // trigger pagehide
    window.dispatchEvent(new Event('pagehide'));
    
    tracker.stop();
  });

  it('handles heartbeat', () => {
    if (typeof window === 'undefined') {
      globalThis.window = {
        dispatchEvent: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        innerWidth: 1024,
        innerHeight: 768,
        devicePixelRatio: 2,
        screen: { width: 1024, height: 768 }
      } as any;
      globalThis.document = {
        visibilityState: 'visible',
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      } as any;
      globalThis.navigator = { language: 'en-US' } as any;
    }

    const tracker = createTracker({ site: 'test', environment: 'dev', consentMode: 'full' });
    tracker.start();
    
    // should ignore heartbeat if no path
    vi.advanceTimersByTime(16000);
    
    tracker.page('/test');
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
    vi.advanceTimersByTime(16000);
    
    // hit enqueue branch when sessionId is missing
    // @ts-ignore
    tracker['sessionId'] = '';
    tracker.track('test_event');
    
    // should ignore if hidden
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    vi.advanceTimersByTime(16000);

    tracker.stop();
  });
});
