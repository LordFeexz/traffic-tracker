import { describe, it, expect, vi } from 'vitest';
import { createCloudflareGeoProvider } from '../../src/geo/cloudflare';
import { createGeoIpLiteProvider } from '../../src/geo/geoip-lite';

describe('Geo Providers', () => {
  describe('Cloudflare Geo Provider', () => {
    it('returns empty object if headers are not provided', () => {
      const provider = createCloudflareGeoProvider();
      const res = provider.lookup('1.2.3.4');
      expect(res).toEqual({});
    });

    it('returns empty object if cf-ipcountry is missing', () => {
      const provider = createCloudflareGeoProvider();
      const res = provider.lookup('1.2.3.4', { 'user-agent': 'test' });
      expect(res).toEqual({});
    });

    it('returns empty object if cf-ipcountry is XX', () => {
      const provider = createCloudflareGeoProvider();
      const res = provider.lookup('1.2.3.4', { 'cf-ipcountry': 'XX' });
      expect(res).toEqual({});
    });

    it('extracts geo data from Record headers (case-insensitive)', () => {
      const provider = createCloudflareGeoProvider();
      const res = provider.lookup('1.2.3.4', {
        'CF-IPCountry': 'US',
        'cf-ipcity': 'San Francisco',
        'cf-region': 'California'
      });
      expect(res).toEqual({
        countryCode: 'US',
        country: 'United States',
        city: 'San Francisco',
        region: 'California'
      });
    });

    it('extracts geo data from Headers object', () => {
      const provider = createCloudflareGeoProvider();
      const headers = new Headers();
      headers.set('cf-ipcountry', 'GB');
      headers.set('cf-ipcity', 'London');
      headers.set('cf-region', 'England');
      
      const res = provider.lookup('1.2.3.4', headers);
      expect(res).toEqual({
        countryCode: 'GB',
        country: 'United Kingdom',
        city: 'London',
        region: 'England'
      });
    });
  });

  describe('GeoIpLite Provider', () => {
    it('looks up ip using geoip-lite dynamically', async () => {
      const provider = createGeoIpLiteProvider();
      
      // We don't mock it completely because we want to test that it actually calls geoip-lite
      // 8.8.8.8 is US
      const res = await provider.lookup('8.8.8.8');
      
      // If geoip-lite is correctly loaded, it should return US.
      expect(res.countryCode).toBe('US');
      expect(res.country).toBe('United States');
    });

    it('returns empty object for local ip', async () => {
      const provider = createGeoIpLiteProvider();
      const res = await provider.lookup('127.0.0.1');
      expect(res).toEqual({});
    });
  });
});
