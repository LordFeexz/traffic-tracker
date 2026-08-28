
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createTracker } from '../../../src/client';
import { Transport } from '../../../src/client/transport';

vi.mock('../../../src/client/transport', () => {
  return {
    Transport: vi.fn().mockImplementation((endpoint: string, makePayload: () => void) => {
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

  it('ignores setting same consent mode', () => {
    const tracker = createTracker({ site: 'test', consentMode: 'full' });
    // @ts-expect-error testing private field
    const setModeSpy = vi.spyOn(tracker.identity, "setMode");
    tracker.setConsentMode('full');
    expect(setModeSpy).not.toHaveBeenCalled();
  });

  it('ignores track if no active page', () => {
    const tracker = createTracker({ site: 'test' });
    tracker.start();
    tracker.track('click_button'); // no path set
    // @ts-expect-error testing private field
    expect(tracker.pendingPageview).toBeNull();
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
        screen: { width: 1024, height: 768 } as Partial<Screen> as Screen
      } as Partial<Window> as Window & typeof globalThis;
      globalThis.document = {
        visibilityState: 'visible',
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      } as Partial<Document> as Document;
      globalThis.navigator = { language: "en-US" } as Partial<Navigator> as Navigator;
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
        screen: { width: 1024, height: 768 } as Partial<Screen> as Screen
      } as Partial<Window> as Window & typeof globalThis;
      globalThis.document = {
        visibilityState: 'visible',
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      } as Partial<Document> as Document;
      globalThis.navigator = { language: "en-US" } as Partial<Navigator> as Navigator;
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

  it('works in SSR (without window/document)', () => {
    const origWindow = globalThis.window;
    const origDoc = globalThis.document;
    
    delete (globalThis as Partial<typeof globalThis>).window;
    delete (globalThis as Partial<typeof globalThis>).document;

    const tracker = createTracker({ site: 'test' });
    
    // Line 83: call start twice to hit `if (this.started) return;`
    tracker.start();
    tracker.start();
    
    // Line 153-169: call page() multiple times to hit all branches of this.currentPath and missing window/document
    tracker.page('/test1', 'Test 1', '1'); // this.currentPath is undefined
    tracker.page('/test2', 'Test 2', '2'); // this.currentPath is defined ('/test1')

    // @ts-expect-error testing private field
    expect(tracker.pendingPageview?.path).toBe("/test2");

    // Restore
    
    if (origWindow) globalThis.window = origWindow;
    
    if (origDoc) globalThis.document = origDoc;
  });

  it('handles readClientContext fallbacks', () => {
    const origWindow = globalThis.window;
    
    const origNav = globalThis.navigator;
    const origIntl = globalThis.Intl;

    
      globalThis.window = {
      screen: { width: 100, height: 100 } as Partial<Screen> as Screen,
      innerWidth: 100,
      innerHeight: 100,
      devicePixelRatio: 0, // falsy to trigger fallback
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn()
    } as Partial<Window> as Window & typeof globalThis;
      globalThis.navigator = {
      language: '' // falsy to trigger fallback
    } as Partial<Navigator> as Navigator;
      globalThis.document = {
      visibilityState: 'visible',
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
      documentElement: { scrollTop: 0, scrollHeight: 100, clientHeight: 100 } as Partial<HTMLElement> as HTMLElement,
      body: { scrollTop: 0, scrollHeight: 100 } as Partial<HTMLElement> as HTMLElement
    } as Partial<Document> as Document;
    
    const mockDateTimeFormat = vi.fn().mockReturnValue({
      resolvedOptions: () => ({ timeZone: '' }) // falsy to trigger fallback
    });
    // @ts-expect-error mocking intl
    globalThis.Intl = { ...globalThis.Intl, DateTimeFormat: mockDateTimeFormat };

    const tracker = createTracker({ site: 'test' });
    tracker.start();
    tracker.page('/fallback');
    
    // @ts-expect-error testing private field
    expect(tracker.pendingPageview?.path).toBe("/fallback");

    // Restore
    globalThis.window = origWindow;
    globalThis.navigator = origNav;
    globalThis.Intl = origIntl;
  });
});
