// Stand-ins for the outside world in tests: GitHub, web pages, and the clock.

import { UnsafeUrlError, type SafeFetch, type SafeFetchOptions, type SafeFetchResult } from '../common/safe-fetch';
import type { InitializeInput, PaystackCharge, PaystackClient } from '../billing/paystack';
import { GithubTokenRejectedError, type GithubClient, type GithubRelease, type GithubRepo, type GithubTokens } from '../sources/github.client';

export class FakeGithub implements GithubClient {
  user = { id: 4242, login: 'toluadebayo' };
  repos: GithubRepo[] = [];
  readmes = new Map<string, string>();
  /** Every repository whose README was read, in order: tests use it to see what a sync skipped. */
  reads: string[] = [];
  releases = new Map<string, GithubRelease[]>();
  /** The access token GitHub accepts. Null once it has expired or been revoked. */
  accepted: string | null = 'gh-test-token';
  /** Refresh tokens GitHub still exchanges. Each works once, because GitHub rotates them. */
  refreshTokens = new Set<string>();
  private issued = 0;

  /** The access token expires; the refresh token still works. */
  expireAccessToken() {
    this.accepted = null;
  }

  /** The person revokes access: nothing works any more. */
  revoke() {
    this.accepted = null;
    this.refreshTokens.clear();
  }

  authorizeUrl(state: string) {
    return `https://github.test/login/oauth/authorize?state=${encodeURIComponent(state)}`;
  }

  async exchangeCode(code: string): Promise<GithubTokens> {
    if (code !== 'good-code') throw new Error('GitHub did not accept the code (bad_verification_code).');
    return this.issue('gh-test-token', 'ghr-test-1');
  }

  async refreshAccessToken(refreshToken: string): Promise<GithubTokens> {
    if (!this.refreshTokens.delete(refreshToken)) throw new GithubTokenRejectedError('GitHub did not accept the refresh token.');
    this.issued += 1;
    return this.issue(`gh-test-${this.issued}`, `ghr-test-${this.issued}`);
  }

  private issue(accessToken: string, refreshToken: string): GithubTokens {
    this.accepted = accessToken;
    this.refreshTokens.add(refreshToken);
    return { accessToken, refreshToken, expiresIn: null };
  }

  private check(token: string) {
    if (token !== this.accepted) throw new GithubTokenRejectedError('GitHub rejected the access token.');
  }

  async getUser() {
    return this.user;
  }

  async listRepos(token: string) {
    this.check(token);
    return this.repos;
  }

  async getReadme(token: string, fullName: string) {
    this.reads.push(fullName);
    this.check(token);
    return this.readmes.get(fullName) ?? null;
  }

  async listReleases(token: string, fullName: string) {
    this.check(token);
    return this.releases.get(fullName) ?? [];
  }
}

export function repo(name: string, overrides: Partial<GithubRepo> = {}): GithubRepo {
  return {
    id: Math.floor(Math.random() * 1e9),
    name,
    fullName: `toluadebayo/${name}`,
    description: `${name} description`,
    url: `https://github.com/toluadebayo/${name}`,
    language: 'TypeScript',
    topics: [],
    pushedAt: '2026-08-18T10:00:00Z',
    createdAt: '2026-04-01T10:00:00Z',
    stars: 3,
    ...overrides,
  };
}

/** Serves fixed pages. Anything else is refused the way the real fetcher refuses private addresses. */
export class FakeSafeFetch implements SafeFetch {
  pages = new Map<string, Partial<SafeFetchResult>>();
  /** Every request made, in order, for tests that check what was sent. */
  requests: { url: string; options?: SafeFetchOptions }[] = [];

  async request(url: string, options?: SafeFetchOptions): Promise<SafeFetchResult> {
    this.requests.push({ url, options });
    const page = this.pages.get(url);
    if (!page) throw new UnsafeUrlError('We could not find that address.');
    return { status: 200, contentType: 'text/html', text: '', finalUrl: url, ...page };
  }
}

/** Paystack, with the outcome of each payment set by the test. */
export class FakePaystack implements PaystackClient {
  readonly configured = true;
  initialized: InitializeInput[] = [];
  disabled: { code: string; token: string }[] = [];
  /** What verifying a reference answers; a reference not listed is still pending. */
  charges = new Map<string, Partial<PaystackCharge>>();

  async initialize(input: InitializeInput) {
    this.initialized.push(input);
    return { authorizationUrl: `https://checkout.paystack.test/${input.reference}`, reference: input.reference };
  }

  async verify(reference: string): Promise<PaystackCharge> {
    return { status: 'pending', reference, amountKobo: 0, currency: 'NGN', paidAt: null, customerCode: null, email: null, ...this.charges.get(reference) };
  }

  async disableSubscription(code: string, token: string) {
    this.disabled.push({ code, token });
  }
}
