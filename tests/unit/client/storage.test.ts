import { describe, it, expect } from 'vitest';
import { LocalStorage } from '../../../src/client/storage';

describe('LocalStorage', () => {
  it('stores and retrieves values from memory when window is unavailable', () => {
    const ls = new LocalStorage();
    expect(ls.get('key')).toBeNull();

    ls.set('key', 'hello');
    expect(ls.get('key')).toBe('hello');

    ls.remove('key');
    expect(ls.get('key')).toBeNull();
  });

  it('handles localStorage throwing errors', () => {
    const mockStorage = {
      getItem: () => { throw new Error('Blocked'); },
      setItem: () => { throw new Error('Blocked'); },
      removeItem: () => { throw new Error('Blocked'); },
    };
    globalThis.window = { localStorage: mockStorage } as any;

    const ls = new LocalStorage();
    ls.set('k', 'v'); 
    expect(ls.get('k')).toBe('v'); 

    ls.remove('k');
    expect(ls.get('k')).toBeNull();

    delete (globalThis as any).window;
  });
});
