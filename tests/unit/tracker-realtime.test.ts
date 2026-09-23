import { describe, it, expect, vi } from 'vitest';
import { createTrafficTracker } from '../../src/index';
import { createMockAdapter } from '../helpers/mock-adapter';
import type { CollectPayload } from '../../src/types';
import type { RealtimeAdapter } from '../../src/realtime/types';

describe('TrafficTracker with Realtime', () => {
  const adapter = createMockAdapter();

  it('automatically dispatches session_start, pageview, heartbeat, and touches realtime', async () => {
    const mockRealtime: RealtimeAdapter = {
      touch: vi.fn(async () => {}),
      remove: vi.fn(async () => {}),
      recordPageview: vi.fn(async () => {}),
      recordSessionStart: vi.fn(async () => {}),
      snapshot: vi.fn(async () => ({ activeVisitors: 1, visitors: [], pageviewsPerMinute: [], today: { pageviews: 1, sessions: 1 } }))
    };

    const tracker = createTrafficTracker({
      database: adapter,
      realtime: mockRealtime
    });

    expect(tracker.realtime).toBe(mockRealtime);

    const payload: CollectPayload = {
      site: 'site-rt',
      environment: 'production',
      consentMode: 'anonymous',
      sessionId: 's-rt-1',
      events: [
        {
          type: 'session_start',
          ts: Date.now(),
          entryPath: '/home',
          entryTitle: 'Home',
          referrer: 'https://google.com'
        },
        {
          type: 'pageview',
          ts: Date.now(),
          path: '/home/detail',
          title: 'Detail',
          sequence: 1
        },
        {
          type: 'heartbeat',
          ts: Date.now(),
          path: '/home/detail',
          sequence: 1
        }
      ]
    };

    await tracker.handleCollect(payload, {
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)',
      ip: '1.2.3.4'
    });

    expect(mockRealtime.recordSessionStart).toHaveBeenCalledWith('site-rt', expect.any(Date));
    expect(mockRealtime.recordPageview).toHaveBeenCalledWith('site-rt', expect.any(Date));
    expect(mockRealtime.touch).toHaveBeenCalledWith(
      'site-rt',
      's-rt-1',
      expect.objectContaining({
        path: '/home/detail',
        title: 'Detail',
        deviceType: 'mobile',
        referrerType: 'referral'
      }),
      expect.any(Date)
    );
  });

  it('removes session on session_end', async () => {
    const mockRealtime: RealtimeAdapter = {
      touch: vi.fn(async () => {}),
      remove: vi.fn(async () => {}),
      recordPageview: vi.fn(async () => {}),
      recordSessionStart: vi.fn(async () => {}),
      snapshot: vi.fn()
    };

    const tracker = createTrafficTracker({
      database: adapter,
      realtime: mockRealtime
    });

    const payload: CollectPayload = {
      site: 'site-rt',
      environment: 'production',
      consentMode: 'anonymous',
      sessionId: 's-rt-end',
      events: [
        {
          type: 'session_end',
          ts: Date.now()
        }
      ]
    };

    await tracker.handleCollect(payload, { ip: '1.2.3.4' });
    expect(mockRealtime.remove).toHaveBeenCalledWith('site-rt', 's-rt-end');
    expect(mockRealtime.touch).not.toHaveBeenCalled();
  });

  it('silently ignores realtime failures and handles empty events', async () => {
    const faultyRealtime: RealtimeAdapter = {
      touch: vi.fn(async () => { throw new Error('redis dead'); }),
      remove: vi.fn(),
      recordPageview: vi.fn(),
      recordSessionStart: vi.fn(),
      snapshot: vi.fn()
    };

    const tracker = createTrafficTracker({
      database: adapter,
      realtime: faultyRealtime
    });

    const payload: CollectPayload = {
      site: 'site-rt',
      environment: 'production',
      consentMode: 'anonymous',
      sessionId: 's-fail',
      events: [
        {
          type: 'session_start',
          ts: Date.now(),
          entryPath: '/test'
        }
      ]
    };

    await expect(tracker.handleCollect(payload, {})).resolves.toBeUndefined();

    // Payload with empty events
    await expect(tracker.handleCollect({ ...payload, events: [] }, {})).resolves.toBeUndefined();
  });
});
