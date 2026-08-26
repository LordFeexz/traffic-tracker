export interface ParsedUserAgent {
  browser?: string;
  browserVersion?: string;
  os?: string;
  deviceType: 'desktop' | 'mobile' | 'tablet' | 'bot';
}

const BOTS = [
  'googlebot',
  'bingbot',
  'yandexbot',
  'duckduckbot',
  'slurp',
  'baiduspider',
  'ia_archiver',
  'twitterbot',
  'facebookexternalhit',
  'rogerbot',
  'linkedinbot',
  'embedly',
  'quora link preview',
  'showyoubot',
  'outbrain',
  'pinterest/0.',
  'developers.google.com/+/web/snippet',
  'slackbot',
  'vkshare',
  'w3c_validator',
  'redditbot',
  'applebot',
  'whatsapp',
  'flipboard',
  'tumblr',
  'bitlybot',
  'skypeuripreview',
  'nuzzel',
  'discordbot',
  'google page speed',
  'qwantify',
  'pinterestbot',
  'bitrix link preview',
  'xing-contenttabreceiver',
  'chrome-lighthouse',
  'telegrambot',
  'google-inspectiontool'
];

export function parseUserAgent(ua?: string): ParsedUserAgent {
  if (!ua) {
    return { deviceType: 'desktop' };
  }

  const lowerUa = ua.toLowerCase();

  // 1. Bot check
  if (BOTS.some((bot) => lowerUa.includes(bot))) {
    return { deviceType: 'bot' };
  }

  let browser: string | undefined;
  let browserVersion: string | undefined;
  let os: string | undefined;
  let deviceType: 'desktop' | 'mobile' | 'tablet' = 'desktop';

  // 2. Device Type
  if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(lowerUa)) {
    deviceType = 'tablet';
  } else if (
    /Mobile|iP(hone|od)|Android|BlackBerry|IEMobile|Kindle|Silk-Accelerated|(hpw|web)OS|Opera M(obi|ini)/.test(
      ua
    )
  ) {
    deviceType = 'mobile';
  }

  // 3. OS
  if (lowerUa.includes('windows')) {
    os = 'Windows';
  } else if (lowerUa.includes('mac') && !lowerUa.includes('iphone') && !lowerUa.includes('ipad')) {
    os = 'macOS';
  } else if (lowerUa.includes('linux') && !lowerUa.includes('android')) {
    os = 'Linux';
  } else if (lowerUa.includes('android')) {
    os = 'Android';
  } else if (lowerUa.includes('iphone') || lowerUa.includes('ipad')) {
    os = 'iOS';
  }

  // 4. Browser
  const match = /(opera|chrome|safari|firefox|msie|trident(?=\/))\/?\s*(\d+)/i.exec(ua) || [];
  let temp;

  if (/trident/i.test(match[1])) {
    temp = /\brv[ :]+(\d+)/g.exec(ua) || [];
    browser = 'IE';
    browserVersion = temp[1] || '';
  } else if (match[1] === 'Chrome') {
    temp = ua.match(/\b(OPR|Edge?)\/(\d+)/);
    if (temp != null) {
      browser = temp[1].replace('OPR', 'Opera').replace('Edg', 'Edge');
      browserVersion = temp[2];
    }
  }

  if (!browser) {
    match[1] = match[1] || '';
    match[2] = match[2] || '';
    
    if (match[1]) {
        browser = match[1].replace('MSIE', 'IE');
        browserVersion = match[2];
    }
  }

  return {
    browser,
    browserVersion,
    os,
    deviceType
  };
}

export function screenSizeBucket(width: number): string {
  if (width < 640) return '< 640px';
  if (width < 768) return '640px - 768px';
  if (width < 1024) return '768px - 1024px';
  if (width < 1280) return '1024px - 1280px';
  if (width < 1536) return '1280px - 1536px';
  return '>= 1536px';
}
