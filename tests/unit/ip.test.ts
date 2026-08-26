import { describe, it, expect } from 'vitest';
import { truncateIp, hashIp } from '../../src/core/ip';

describe('ip utils', () => {
  describe('truncateIp', () => {
    it('truncates IPv4', () => {
      expect(truncateIp('192.168.1.100')).toBe('192.168.1.0');
      expect(truncateIp('8.8.8.8')).toBe('8.8.8.0');
    });

    it('truncates IPv6', () => {
      expect(truncateIp('2001:0db8:85a3:0000:0000:8a2e:0370:7334')).toBe('2001:0db8:85a3:0000::');
      expect(truncateIp('::1')).toBe('::1'); // Too short to truncate normally
    });

    it('handles invalid or empty IP', () => {
      expect(truncateIp(undefined)).toBeUndefined();
      expect(truncateIp('')).toBeUndefined();
      expect(truncateIp('not-an-ip')).toBe('not-an-ip');
    });
  });

  describe('hashIp', () => {
    it('generates a consistent hash for the same IP', () => {
      const hash1 = hashIp('192.168.1.1');
      const hash2 = hashIp('192.168.1.1');
      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64); // SHA-256 hex string
    });

    it('returns empty string for missing IP', () => {
      expect(hashIp(undefined)).toBe('');
      expect(hashIp('')).toBe('');
    });
  });
});
