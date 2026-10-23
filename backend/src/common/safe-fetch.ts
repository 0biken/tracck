// Fetching a link a person typed in (a portfolio) or an address an organisation
// gave us (a webhook) must never reach inside our own network. Every address a
// name resolves to is checked, and every redirect is checked again.

import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

export interface SafeFetchResult {
  status: number;
  contentType: string;
  text: string;
  finalUrl: string;
}

export interface SafeFetchOptions {
  method?: 'GET' | 'POST';
  headers?: Record<string, string>;
  body?: string;
  maxBytes?: number;
  timeoutMs?: number;
  maxRedirects?: number;
}

export interface SafeFetch {
  request(url: string, options?: SafeFetchOptions): Promise<SafeFetchResult>;
}

export class UnsafeUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnsafeUrlError';
  }
}

/** True for loopback, private, link-local, carrier-grade NAT, multicast and cloud metadata addresses. */
export function isPrivateAddress(address: string): boolean {
  const version = isIP(address);
  if (version === 4) {
    const [a, b] = address.split('.').map(Number);
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 192 && b === 0) ||
      a >= 224
    );
  }
  if (version === 6) {
    const lower = address.toLowerCase();
    if (lower === '::' || lower === '::1') return true;
    if (lower.startsWith('fc') || lower.startsWith('fd')) return true; // unique local
    if (lower.startsWith('fe8') || lower.startsWith('fe9') || lower.startsWith('fea') || lower.startsWith('feb')) return true; // link-local
    if (lower.startsWith('ff')) return true; // multicast
    const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    return mapped ? isPrivateAddress(mapped[1]) : false;
  }
  return true;
}

async function assertPublicUrl(raw: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new UnsafeUrlError('That is not a valid link.');
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new UnsafeUrlError('Only web links can be read.');
  if (url.username || url.password) throw new UnsafeUrlError('Links with a username or password cannot be read.');

  const host = url.hostname.replace(/^\[|\]$/g, '');
  const addresses = isIP(host) ? [{ address: host }] : await lookup(host, { all: true }).catch(() => []);
  if (addresses.length === 0) throw new UnsafeUrlError('We could not find that address.');
  if (addresses.some((entry) => isPrivateAddress(entry.address))) throw new UnsafeUrlError('That address cannot be read.');
  return url;
}

/** Reads at most `maxBytes` of a response body, then stops. */
async function readLimited(response: Response, maxBytes: number): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) return '';
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > maxBytes) {
      await reader.cancel();
      throw new UnsafeUrlError('That page is too large to read.');
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString('utf8');
}

export function createSafeFetch(fetcher: typeof fetch = fetch): SafeFetch {
  return {
    async request(raw, options = {}) {
      const maxRedirects = options.maxRedirects ?? 3;
      let current = raw;
      for (let hop = 0; hop <= maxRedirects; hop++) {
        const url = await assertPublicUrl(current);
        const response = await fetcher(url, {
          method: options.method ?? 'GET',
          headers: { 'User-Agent': 'TracckBot/1.0', Accept: 'text/html,text/plain,application/json', ...options.headers },
          body: options.body,
          redirect: 'manual',
          signal: AbortSignal.timeout(options.timeoutMs ?? 10_000),
        });

        if (response.status >= 300 && response.status < 400 && response.headers.get('location')) {
          current = new URL(response.headers.get('location')!, url).toString();
          continue;
        }
        return {
          status: response.status,
          contentType: response.headers.get('content-type') ?? '',
          text: await readLimited(response, options.maxBytes ?? 1_000_000),
          finalUrl: url.toString(),
        };
      }
      throw new UnsafeUrlError('That link redirects too many times.');
    },
  };
}
