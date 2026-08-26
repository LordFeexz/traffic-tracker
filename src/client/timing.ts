export class PageTimer {
  private startedAt: number;
  private visibleAt: number | null;
  private totalVisibleMs = 0;
  private maxScroll = 0;

  constructor(now = Date.now()) {
    this.startedAt = now;
    this.visibleAt =
      typeof document !== 'undefined' && document.visibilityState === 'visible' ? now : null;
  }

  recordScroll(): void {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;
    const h = document.documentElement;
    const b = document.body;
    const st = 'scrollTop';
    const sh = 'scrollHeight';

    // @ts-ignore
    const pct = ((h[st] || b[st]) / ((h[sh] || b[sh]) - h.clientHeight)) * 100;
    if (!isNaN(pct) && pct > this.maxScroll) {
      this.maxScroll = Math.min(100, Math.round(pct));
    }
  }

  pause(now = Date.now()): void {
    if (this.visibleAt !== null) {
      this.totalVisibleMs += now - this.visibleAt;
      this.visibleAt = null;
    }
  }

  resume(now = Date.now()): void {
    if (this.visibleAt === null) {
      this.visibleAt = now;
    }
  }

  snapshot(now = Date.now()): { durationMs: number; visibleMs: number; maxScrollPct: number } {
    let visible = this.totalVisibleMs;
    if (this.visibleAt !== null) {
      visible += now - this.visibleAt;
    }
    return {
      durationMs: now - this.startedAt,
      visibleMs: visible,
      maxScrollPct: this.maxScroll
    };
  }
}
