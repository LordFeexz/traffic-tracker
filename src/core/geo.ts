export interface GeoLocation {
  country?: string;
  countryCode?: string;
  region?: string;
  city?: string;
}

export interface GeoProvider {
  lookup(ip: string, headers?: Record<string, string> | Headers): Promise<GeoLocation> | GeoLocation;
}

const DISPLAY_NAMES = new Intl.DisplayNames(['en'], { type: 'region' });

export function countryName(code: string): string {
  try {
    return DISPLAY_NAMES.of(code) || code;
  } catch {
    return code;
  }
}
