import { describe, it, expect } from 'vitest';
import { PageTimer } from '../../../src/client/timing';

describe('PageTimer', () => {
  it('tracks duration from start', () => {
    const now = 1000;
    const timer = new PageTimer(now);

    // Not yet resumed from visible state (no document in node)
    const snap = timer.snapshot(3000);
    expect(snap.durationMs).toBe(2000);
    expect(snap.maxScrollPct).toBe(0);
  });

  it('accumulates visible time through pause/resume', () => {
    const timer = new PageTimer(1000);

    // Simulate it starts hidden (visibleAt is null because document is undefined in Node)
    timer.resume(1000);
    timer.pause(2500);
    timer.resume(3000);

    const snap = timer.snapshot(5000);
    // visible: 1500 (1000->2500) + 2000 (3000->5000) = 3500
    expect(snap.visibleMs).toBe(3500);
    expect(snap.durationMs).toBe(4000);
  });

  it('does not double count if already paused', () => {
    const timer = new PageTimer(1000);
    timer.pause(2000); // already paused (visibleAt is null in node env)
    timer.pause(3000); // no-op

    const snap = timer.snapshot(4000);
    expect(snap.visibleMs).toBe(0);
  });

  it('does not double count if already resumed', () => {
    const timer = new PageTimer(1000);
    timer.resume(1000);
    timer.resume(2000); // no-op

    const snap = timer.snapshot(3000);
    // visibleMs should be 2000 (from 1000->3000) not doubled
    expect(snap.visibleMs).toBe(2000);
  });

  it('records max scroll percentage', () => {
    globalThis.window = {} as any;
    globalThis.document = {
      documentElement: { scrollTop: 500, scrollHeight: 2000, clientHeight: 1000 },
      body: { scrollTop: 500, scrollHeight: 2000 }
    } as any;

    const timer = new PageTimer(1000);
    timer.recordScroll();

    // pct = (500 / (2000 - 1000)) * 100 = 50
    const snap = timer.snapshot(1000);
    expect(snap.maxScrollPct).toBe(50);

    // scroll further
    (globalThis.document as any).documentElement.scrollTop = 800;
    timer.recordScroll();
    expect(timer.snapshot(1000).maxScrollPct).toBe(80);

    // scroll less (should not decrease maxScroll)
    (globalThis.document as any).documentElement.scrollTop = 200;
    timer.recordScroll();
    expect(timer.snapshot(1000).maxScrollPct).toBe(80);

    delete (globalThis as any).window;
    delete (globalThis as any).document;
  });
});
