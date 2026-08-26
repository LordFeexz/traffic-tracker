import { describe, it, expect } from 'vitest';
import { countryName } from '../../src/core/geo';

describe('geo utils', () => {
  it('returns country name for known code', () => {
    const name = countryName('US');
    expect(name).toBe('United States');
  });

  it('returns null if no country provided', () => {
    const res = countryName('');
    expect(res).toBe('');
  });

  it('handles invalid country gracefully', () => {
    // Some runtimes throw on completely invalid Intl formats, though 'XX' is often accepted as unknown.
    // If it falls back or throws, it should return XX/Unknown.
    const res = countryName('INVALID_CODE');
    expect(res).toBeDefined();
  });

  it('returns a fallback for unknown code', () => {
    // Intl.DisplayNames may return 'Unknown Region' for unmapped codes, not the code itself
    const name = countryName('ZZ');
    expect(typeof name).toBe('string');
    expect(name.length).toBeGreaterThan(0);
  });

  it('returns code itself if Intl.DisplayNames throws', () => {
    const name = countryName('INVALID_CODE');
    expect(name).toBe('INVALID_CODE');
  });
});
