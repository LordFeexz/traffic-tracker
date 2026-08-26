import type { ReferrerType, UtmParams } from '../types';

const SEARCH_RE =
  /(^|\.)(google|bing|yahoo|duckduckgo|baidu|yandex|ecosia|brave|startpage|qwant|naver|seznam|ask)\./i;

const SOCIAL_RE =
  /(^|\.)(facebook|fb|instagram|twitter|x|t\.co|linkedin|lnkd|pinterest|reddit|tiktok|youtube|youtu\.be|whatsapp|telegram|threads|tumblr|vk|line\.me|quora|medium|snapchat|discord)\./i;

export interface ClassifiedReferrer {
  referrer?: string;
  referrerHost?: string;
  referrerType: ReferrerType;
}

export function classifyReferrer(
  referrer: string | undefined,
  internalHosts: string[] = []
): ClassifiedReferrer {
  const raw = referrer?.trim();
  if (!raw) return { referrerType: 'direct' };

  if (raw.startsWith('/')) return { referrer: raw, referrerType: 'internal' };

  let host: string;
  try {
    host = new URL(raw).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return { referrer: raw, referrerType: 'referral' };
  }

  const isInternal =
    host === 'localhost' ||
    host === '127.0.0.1' ||
    internalHosts.some((h) => host === h || host.endsWith(`.${h}`));

  if (isInternal) {
    return { referrer: raw, referrerHost: host, referrerType: 'internal' };
  }

  const type: ReferrerType = SEARCH_RE.test(`${host}.`)
    ? 'search'
    : SOCIAL_RE.test(`${host}.`)
      ? 'social'
      : 'referral';

  return { referrer: raw, referrerHost: host, referrerType: type };
}

export function parseUtm(query: string | undefined): UtmParams | undefined {
  if (!query) return undefined;
  const params = new URLSearchParams(query.startsWith('?') ? query.slice(1) : query);
  const utm: UtmParams = {
    source: params.get('utm_source') ?? undefined,
    medium: params.get('utm_medium') ?? undefined,
    campaign: params.get('utm_campaign') ?? undefined,
    term: params.get('utm_term') ?? undefined,
    content: params.get('utm_content') ?? undefined
  };
  return Object.values(utm).some(Boolean) ? utm : undefined;
}
