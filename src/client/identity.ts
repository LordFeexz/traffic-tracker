import { LocalStorage } from './storage';
import type { ConsentMode } from '../types';

export const SESSION_TIMEOUT_MS = 30 * 60 * 1000;

function uuidv4(): string {
  // Simple UUID implementation since crypto.randomUUID isn't always available
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export class IdentityManager {
  private storage = new LocalStorage();
  private mode: ConsentMode;

  private memorySessionId: string | null = null;
  private memoryLastSeen = 0;

  constructor(mode: ConsentMode) {
    this.mode = mode;
  }

  setMode(mode: ConsentMode): void {
    this.mode = mode;
    if (mode === 'anonymous') {
      this.storage.remove('vid');
      this.storage.remove('sid');
      this.storage.remove('sls');
    }
  }

  touch(): void {
    const now = Date.now();
    if (this.mode === 'full') {
      this.storage.set('sls', now.toString());
    } else {
      this.memoryLastSeen = now;
    }
  }

  resolve(now = Date.now()): { sessionId: string; visitorId?: string; isNewSession: boolean } {
    if (this.mode === 'full') {
      let visitorId = this.storage.get('vid');
      if (!visitorId) {
        visitorId = uuidv4();
        this.storage.set('vid', visitorId);
      }

      const storedSid = this.storage.get('sid');
      const lastSeen = parseInt(this.storage.get('sls') || '0', 10);
      let sessionId = storedSid;
      let isNewSession = false;

      if (!sessionId || now - lastSeen > SESSION_TIMEOUT_MS) {
        sessionId = uuidv4();
        this.storage.set('sid', sessionId);
        isNewSession = true;
      }
      this.storage.set('sls', now.toString());

      return { sessionId, visitorId, isNewSession };
    }

    // Anonymous mode
    let isNewSession = false;
    if (!this.memorySessionId || now - this.memoryLastSeen > SESSION_TIMEOUT_MS) {
      this.memorySessionId = uuidv4();
      isNewSession = true;
    }
    this.memoryLastSeen = now;
    
    return { sessionId: this.memorySessionId, isNewSession };
  }
}
