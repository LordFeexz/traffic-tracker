import { describe, it, expect, beforeEach } from 'vitest';
import { IdentityManager, SESSION_TIMEOUT_MS } from '../../../src/client/identity';

describe('Client IdentityManager', () => {
  beforeEach(() => {
    // Clear globals if needed or mock localStorage
    if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.clear();
    }
  });

  it('generates IDs in full mode', () => {
    const manager = new IdentityManager('full');
    const { sessionId, visitorId, isNewSession } = manager.resolve();
    
    expect(sessionId).toBeTruthy();
    expect(visitorId).toBeTruthy();
    expect(isNewSession).toBe(true);
  });

  it('maintains session if active', () => {
    const manager = new IdentityManager('full');
    const first = manager.resolve(1000);
    manager.touch(); // simulates activity
    
    // Resolve slightly later
    const second = manager.resolve(2000);
    
    expect(second.sessionId).toBe(first.sessionId);
    expect(second.visitorId).toBe(first.visitorId);
    expect(second.isNewSession).toBe(false);
  });

  it('expires session after timeout', () => {
    const manager = new IdentityManager('full');
    const first = manager.resolve(1000);
    
    // Resolve past timeout
    const second = manager.resolve(1000 + SESSION_TIMEOUT_MS + 100);
    
    expect(second.sessionId).not.toBe(first.sessionId);
    expect(second.visitorId).toBe(first.visitorId); // Visitor persists
    expect(second.isNewSession).toBe(true);
  });

  it('generates memory-only IDs in anonymous mode', () => {
    const manager = new IdentityManager('anonymous');
    const { sessionId, visitorId, isNewSession } = manager.resolve();
    
    expect(sessionId).toBeTruthy();
    expect(visitorId).toBeUndefined();
    expect(isNewSession).toBe(true);
  });
});
