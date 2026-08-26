import { createHash } from 'crypto';

let currentSalt = createHash('sha256').update(new Date().toISOString().slice(0, 10)).digest('hex');
let saltDate = new Date().toISOString().slice(0, 10);

function getDailySalt(): string {
  const today = new Date().toISOString().slice(0, 10);
  if (today !== saltDate) {
    saltDate = today;
    currentSalt = createHash('sha256').update(today).digest('hex');
  }
  return currentSalt;
}

export function truncateIp(ip?: string | null): string | undefined {
  if (!ip) return undefined;
  
  // IPv4
  if (ip.includes('.')) {
    const parts = ip.split('.');
    if (parts.length === 4) {
      return `${parts[0]}.${parts[1]}.${parts[2]}.0`;
    }
  }
  
  // IPv6
  if (ip.includes(':')) {
    const parts = ip.split(':');
    if (parts.length >= 4) {
      return `${parts[0]}:${parts[1]}:${parts[2]}:${parts[3]}::`;
    }
  }
  
  return ip;
}

export function hashIp(ip?: string | null): string {
  if (!ip) return '';
  return createHash('sha256')
    .update(getDailySalt() + ip)
    .digest('hex');
}
