import type { GeoProvider, GeoLocation } from '../core/geo';
import { countryName } from '../core/geo';

export function createCloudflareGeoProvider(): GeoProvider {
  return {
    lookup(ip: string, headers?: Record<string, string> | Headers): GeoLocation {
      if (!headers) return {};

      // Helper to handle both fetch Headers and plain objects
      const getHeader = (key: string): string | undefined => {
        if (typeof Headers !== 'undefined' && headers instanceof Headers) {
          return headers.get(key) || undefined;
        }
        // Handle Record<string, string>
        const lowerKey = key.toLowerCase();
        for (const k in headers) {
          if (k.toLowerCase() === lowerKey) {
            return (headers as Record<string, string>)[k];
          }
        }
        return undefined;
      };

      const countryCode = getHeader('cf-ipcountry');
      if (!countryCode || countryCode === 'XX') {
        return {};
      }

      return {
        countryCode,
        country: countryName(countryCode),
        city: getHeader('cf-ipcity'),
        region: getHeader('cf-region')
      };
    }
  };
}
