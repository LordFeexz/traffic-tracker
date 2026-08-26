import type { AnalyticsEvent, CollectPayload } from '../types';

export const FLUSH_INTERVAL_MS = 5000;
export const MAX_QUEUE = 100;

export class Transport {
  private queue: AnalyticsEvent[] = [];
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private endpoint: string,
    private buildEnvelope: () => Omit<CollectPayload, 'events'>
  ) {}

  enqueue(event: AnalyticsEvent, opts?: { immediate?: boolean }): void {
    this.queue.push(event);
    if (this.queue.length >= MAX_QUEUE) {
      this.flush();
      return;
    }
    if (opts?.immediate) {
      this.flush();
    } else if (!this.timer) {
      this.timer = setTimeout(() => this.flush(), FLUSH_INTERVAL_MS);
    }
  }

  flush(opts?: { beacon?: boolean }): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (this.queue.length === 0) return;

    const batch = [...this.queue];
    this.queue = [];

    const payload: CollectPayload = {
      ...this.buildEnvelope(),
      events: batch
    };

    const data = JSON.stringify(payload);

    try {
      if (opts?.beacon && typeof navigator !== 'undefined' && navigator.sendBeacon) {
        // Blob ensures type text/plain so we don't trigger CORS preflight
        const blob = new Blob([data], { type: 'text/plain' });
        if (navigator.sendBeacon(this.endpoint, blob)) {
          return;
        }
      }

      if (typeof fetch !== 'undefined') {
        // Fallback or normal flush
        fetch(this.endpoint, {
          method: 'POST',
          body: data,
          keepalive: opts?.beacon
        }).catch(() => {
          // Fire and forget
        });
      }
    } catch {
      // Ignore
    }
  }
}
