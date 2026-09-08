import type { GeoProvider, GeoLocation } from '../core/geo';
import { countryName } from '../core/geo';

interface GeoIpLiteModule {
  lookup(ip: string): { country: string; region: string; city: string } | null;
}

export function createGeoIpLiteProvider(): GeoProvider {
  let geoip: GeoIpLiteModule | null = null;
  
  return {
    async lookup(ip: string): Promise<GeoLocation> {
      if (!geoip) {
        try {
          // Dynamically import geoip-lite so it's strictly optional
          // @ts-ignore - Ignore type error if not installed
          geoip = (await import('geoip-lite')) as GeoIpLiteModule;
        } catch (e) {
          throw new Error('geoip-lite is not installed. Please run: npm install geoip-lite');
        }
      }

      if (!geoip) return {};
      
      const geo = geoip.lookup(ip);
      if (!geo) return {};

      return {
        countryCode: geo.country,
        country: countryName(geo.country),
        city: geo.city,
        region: geo.region
      };
    }
  };
}
