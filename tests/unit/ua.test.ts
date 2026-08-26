import { describe, it, expect } from 'vitest';
import { parseUserAgent, screenSizeBucket } from '../../src/core/ua';

describe('ua utils', () => {
  describe('parseUserAgent', () => {
    it('handles empty UA', () => {
      expect(parseUserAgent(undefined)).toEqual({ deviceType: 'desktop' });
    });

    it('detects bots', () => {
      expect(parseUserAgent('Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)')).toEqual({
        deviceType: 'bot'
      });
      expect(parseUserAgent('Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)')).toEqual({
        deviceType: 'bot'
      });
    });

    it('detects mobile devices', () => {
      const res = parseUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1');
      expect(res.deviceType).toBe('mobile');
      expect(res.os).toBe('iOS');
      expect(res.browser).toBe('Safari');
    });

    it('detects desktop devices', () => {
      const res = parseUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
      expect(res.deviceType).toBe('desktop');
      expect(res.os).toBe('macOS');
      expect(res.browser).toBe('Chrome');
    });

    it('detects Windows', () => {
      expect(parseUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64)').os).toBe('Windows');
    });

    it('detects Linux', () => {
      expect(parseUserAgent('Mozilla/5.0 (X11; Linux x86_64)').os).toBe('Linux');
    });

    it('detects Android', () => {
      expect(parseUserAgent('Mozilla/5.0 (Linux; Android 10; SM-G981B) AppleWebKit/537.36').os).toBe('Android');
    });

    it('detects IE (Trident)', () => {
      const res = parseUserAgent('Mozilla/5.0 (Windows NT 10.0; Trident/7.0; rv:11.0) like Gecko');
      expect(res.browser).toBe('IE');
      expect(res.browserVersion).toBe('11');
    });

    it('detects IE (MSIE)', () => {
      const res = parseUserAgent('Mozilla/5.0 (compatible; MSIE 10.0; Windows NT 6.1; Trident/6.0)');
      expect(res.browser).toBe('IE');
      expect(res.browserVersion).toBe('10');
    });

    it('detects Edge', () => {
      const res = parseUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36 Edg/91.0.864.59');
      expect(res.browser).toBe('Edge');
      expect(res.browserVersion).toBe('91');
    });
  });

  describe('screenSizeBucket', () => {
    it('buckets widths correctly', () => {
      expect(screenSizeBucket(320)).toBe('< 640px');
      expect(screenSizeBucket(700)).toBe('640px - 768px');
      expect(screenSizeBucket(800)).toBe('768px - 1024px');
      expect(screenSizeBucket(1920)).toBe('>= 1536px');
    });
  });
});
