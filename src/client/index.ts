import type { AnalyticsEvent, ClientContext, CollectPayload, ConsentMode, PageContext, PageviewEvent } from '../types';
import { IdentityManager } from './identity';
import { PageTimer } from './timing';
import { Transport } from './transport';

const HEARTBEAT_MS = 15000;

export interface TrackerOptions {
  site: string;
  environment?: string;
  consentMode?: ConsentMode;
  userId?: string;
  endpoint?: string;
}

export interface Tracker {
  start(): void;
  stop(): void;
  page(path: string, title?: string, query?: string): void;
  setConsentMode(mode: ConsentMode): void;
  setUserId(userId?: string): void;
  setPageContext(context: PageContext): void;
  track(name: string, props?: Record<string, string | number | boolean>): void;
}

function readClientContext(): ClientContext {
  if (typeof window === 'undefined') {
    return { screenW: 0, screenH: 0, viewportW: 0, viewportH: 0, dpr: 1, language: '', timezone: '' };
  }
  return {
    screenW: window.screen.width,
    screenH: window.screen.height,
    viewportW: window.innerWidth,
    viewportH: window.innerHeight,
    dpr: window.devicePixelRatio || 1,
    language: navigator.language || '',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || ''
  };
}

class BrowserTracker implements Tracker {
  private readonly transport: Transport;
  private readonly identity: IdentityManager;

  private consentMode: ConsentMode;
  private userId?: string;

  private sessionId = '';
  private visitorId?: string;
  private sessionStartedAt = 0;

  private currentPath: string | null = null;
  private currentTitle?: string;
  private sequence = 0;
  private timer: PageTimer | null = null;
  private pendingPageview: PageviewEvent | null = null;
  private pageContext: PageContext = {};

  private heartbeat: ReturnType<typeof setInterval> | null = null;
  private started = false;
  private listeners: Array<() => void> = [];

  constructor(private readonly options: TrackerOptions) {
    this.consentMode = options.consentMode || 'anonymous';
    this.userId = options.userId;
    this.identity = new IdentityManager(this.consentMode);
    
    const defaultEndpoint = '/api/traffic/collect'; // Reasonable default
    this.transport = new Transport(
      options.endpoint || defaultEndpoint,
      (): Omit<CollectPayload, 'events'> => ({
        site: this.options.site,
        environment: this.options.environment || 'production',
        consentMode: this.consentMode,
        sessionId: this.sessionId,
        visitorId: this.consentMode === 'full' ? this.visitorId : undefined,
        userId: this.userId
      })
    );
  }

  start(): void {
    if (this.started) return;
    this.started = true;
    
    if (typeof document === 'undefined' || typeof window === 'undefined') return;

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        this.timer?.pause();
        this.endVisit();
      } else {
        this.timer?.resume();
        this.identity.touch();
      }
    };
    const onPageHide = () => {
      this.timer?.pause();
      this.endVisit();
    };
    const onScroll = () => this.timer?.recordScroll();

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', onPageHide);
    window.addEventListener('scroll', onScroll, { passive: true });
    
    this.listeners = [
      () => document.removeEventListener('visibilitychange', onVisibility),
      () => window.removeEventListener('pagehide', onPageHide),
      () => window.removeEventListener('scroll', onScroll)
    ];

    this.heartbeat = setInterval(() => {
      if (document.visibilityState === 'hidden' || !this.currentPath) return;
      this.identity.touch();
      this.enqueue({ type: 'heartbeat', path: this.currentPath, ts: Date.now() });
    }, HEARTBEAT_MS);
  }

  stop(): void {
    if (!this.started) return;
    this.started = false;
    this.listeners.forEach((off) => off());
    this.listeners = [];
    if (this.heartbeat !== null) {
      clearInterval(this.heartbeat);
      this.heartbeat = null;
    }
    this.endVisit();
  }

  page(path: string, title?: string, query?: string): void {
    const now = Date.now();
    this.closeCurrentPage(now);

    const { sessionId, visitorId, isNewSession } = this.identity.resolve(now);
    this.sessionId = sessionId;
    this.visitorId = visitorId;

    if (isNewSession) {
      this.sessionStartedAt = now;
      this.sequence = 0;
      this.enqueue({
        type: 'session_start',
        entryPath: path,
        entryTitle: title,
        referrer: typeof document !== 'undefined' ? document.referrer || '' : '',
        ts: now,
        ...readClientContext()
      });
    }

    const referrer = this.currentPath ?? (typeof document !== 'undefined' ? document.referrer ?? '' : '');
    this.sequence += 1;
    this.currentPath = path;
    this.currentTitle = title;
    this.pageContext = {};
    this.timer = new PageTimer(now);
    this.timer.recordScroll();

    const event: PageviewEvent = {
      type: 'pageview',
      path,
      title,
      query,
      referrer,
      sequence: this.sequence,
      viewportW: typeof window !== 'undefined' ? window.innerWidth || 0 : 0,
      viewportH: typeof window !== 'undefined' ? window.innerHeight || 0 : 0,
      ts: now
    };
    this.pendingPageview = event;
    this.enqueue(event, { immediate: true });
  }

  setConsentMode(mode: ConsentMode): void {
    if (mode === this.consentMode) return;

    this.consentMode = mode;
    this.identity.setMode(mode);
    if (mode === 'anonymous') this.visitorId = undefined;

    const { sessionId, visitorId } = this.identity.resolve();
    this.sessionId = sessionId;
    this.visitorId = visitorId;
  }

  setUserId(userId?: string): void {
    this.userId = userId;
  }

  setPageContext(context: PageContext): void {
    this.pageContext = { ...this.pageContext, ...context };
    if (this.pendingPageview) Object.assign(this.pendingPageview, context);
  }

  track(name: string, props?: Record<string, string | number | boolean>): void {
    if (!this.currentPath) return;
    this.identity.touch();
    this.enqueue({ type: 'event', name, path: this.currentPath, props, ts: Date.now() });
  }

  private closeCurrentPage(now: number): void {
    if (!this.currentPath || !this.timer) return;
    const { durationMs, visibleMs, maxScrollPct } = this.timer.snapshot(now);
    this.enqueue({
      type: 'page_exit',
      path: this.currentPath,
      sequence: this.sequence,
      durationMs,
      visibleMs,
      maxScrollPct,
      ts: now
    });
    this.pendingPageview = null;
  }

  private endVisit(): void {
    if (!this.currentPath) {
      this.transport.flush({ beacon: true });
      return;
    }
    const now = Date.now();
    const exitPath = this.currentPath;
    const exitTitle = this.currentTitle;
    this.closeCurrentPage(now);
    this.enqueue({
      type: 'session_end',
      exitPath,
      exitTitle,
      durationMs: Math.max(0, now - this.sessionStartedAt),
      pageCount: this.sequence,
      ts: now
    });
    this.currentPath = null;
    this.timer = null;
    this.transport.flush({ beacon: true });
  }

  private enqueue(event: AnalyticsEvent, opts?: { immediate?: boolean }): void {
    if (!this.sessionId) {
      const { sessionId, visitorId } = this.identity.resolve(event.ts);
      this.sessionId = sessionId;
      this.visitorId = visitorId;
    }
    const enriched = event.type === 'pageview' ? Object.assign(event, this.pageContext) : event;
    this.transport.enqueue(enriched, opts);
  }
}

export function createTracker(options: TrackerOptions): Tracker {
  return new BrowserTracker(options);
}
