import { describe, it, expect } from 'vitest';
import { classifyReferrer, parseUtm } from '../../src/core/referrer';

describe('referrer utils', () => {
  describe('classifyReferrer', () => {
    it('handles direct hits', () => {
      expect(classifyReferrer(undefined)).toEqual({ referrerType: 'direct' });
      expect(classifyReferrer('')).toEqual({ referrerType: 'direct' });
      expect(classifyReferrer('   ')).toEqual({ referrerType: 'direct' });
    });

    it('handles internal paths', () => {
      expect(classifyReferrer('/about')).toEqual({ referrer: '/about', referrerType: 'internal' });
    });

    it('handles internal hosts', () => {
      expect(classifyReferrer('https://digitool.id/blog', ['digitool.id'])).toEqual({
        referrer: 'https://digitool.id/blog',
        referrerHost: 'digitool.id',
        referrerType: 'internal'
      });
      expect(classifyReferrer('http://localhost:3000')).toEqual({
        referrer: 'http://localhost:3000',
        referrerHost: 'localhost',
        referrerType: 'internal'
      });
    });

    it('classifies search engines', () => {
      expect(classifyReferrer('https://www.google.com/search?q=test').referrerType).toBe('search');
      expect(classifyReferrer('https://duckduckgo.com').referrerType).toBe('search');
      expect(classifyReferrer('https://bing.com').referrerType).toBe('search');
    });

    it('classifies social networks', () => {
      expect(classifyReferrer('https://t.co/xyz').referrerType).toBe('social');
      expect(classifyReferrer('https://m.facebook.com').referrerType).toBe('social');
      expect(classifyReferrer('https://www.linkedin.com/feed/').referrerType).toBe('social');
    });

    it('falls back to referral', () => {
      expect(classifyReferrer('https://some-random-blog.com/post')).toEqual({
        referrer: 'https://some-random-blog.com/post',
        referrerHost: 'some-random-blog.com',
        referrerType: 'referral'
      });
    });

    it('handles malformed URLs gracefully', () => {
      expect(classifyReferrer('not-a-valid-url')).toEqual({
        referrer: 'not-a-valid-url',
        referrerType: 'referral'
      });
    });
  });

  describe('parseUtm', () => {
    it('returns undefined if no utm params', () => {
      expect(parseUtm(undefined)).toBeUndefined();
      expect(parseUtm('?foo=bar')).toBeUndefined();
    });

    it('extracts utm params correctly', () => {
      expect(parseUtm('?utm_source=google&utm_medium=cpc&utm_campaign=summer_sale')).toEqual({
        source: 'google',
        medium: 'cpc',
        campaign: 'summer_sale',
        term: undefined,
        content: undefined
      });
    });
  });
});
