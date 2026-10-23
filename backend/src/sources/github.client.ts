import { notConfigured } from '../common/not-configured';

export interface GithubRepo {
  id: number;
  name: string;
  fullName: string;
  description: string | null;
  url: string;
  language: string | null;
  topics: string[];
  pushedAt: string | null;
  createdAt: string | null;
  stars: number;
}

export interface GithubRelease {
  id: number;
  name: string | null;
  tag: string;
  body: string | null;
  publishedAt: string | null;
  url: string;
}

/** The slice of GitHub the product uses. Public data only: no repository scopes are requested. */
export interface GithubClient {
  /** The page GitHub shows the person to approve access. */
  authorizeUrl(state: string): string;
  exchangeCode(code: string): Promise<{ accessToken: string }>;
  getUser(token: string): Promise<{ id: number; login: string }>;
  /** Public repositories the person owns, most recently pushed first. Forks are left out. */
  listRepos(token: string, login: string): Promise<GithubRepo[]>;
  getReadme(token: string, fullName: string): Promise<string | null>;
  listReleases(token: string, fullName: string, limit: number): Promise<GithubRelease[]>;
}

/** Used when no GitHub app is set up: every use answers 503 NOT_CONFIGURED. */
export class UnconfiguredGithub implements GithubClient {
  authorizeUrl(): string {
    return notConfigured('GitHub connection');
  }
  exchangeCode(): Promise<{ accessToken: string }> {
    return notConfigured('GitHub connection');
  }
  getUser(): Promise<{ id: number; login: string }> {
    return notConfigured('GitHub connection');
  }
  listRepos(): Promise<GithubRepo[]> {
    return notConfigured('GitHub connection');
  }
  getReadme(): Promise<string | null> {
    return notConfigured('GitHub connection');
  }
  listReleases(): Promise<GithubRelease[]> {
    return notConfigured('GitHub connection');
  }
}

interface RawRepo {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  html_url: string;
  language: string | null;
  topics?: string[];
  pushed_at: string | null;
  created_at: string | null;
  stargazers_count: number;
  fork: boolean;
  private: boolean;
}

export class HttpGithubClient implements GithubClient {
  constructor(
    private readonly clientId: string,
    private readonly clientSecret: string,
    /** Where GitHub sends the person back to: this API's callback address. */
    private readonly redirectUri: string,
    private readonly fetcher: typeof fetch = fetch,
  ) {}

  authorizeUrl(state: string): string {
    const params = new URLSearchParams({ client_id: this.clientId, redirect_uri: this.redirectUri, state });
    return `https://github.com/login/oauth/authorize?${params}`;
  }

  async exchangeCode(code: string) {
    const response = await this.fetcher('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: this.clientId, client_secret: this.clientSecret, code, redirect_uri: this.redirectUri }),
    });
    const body = (await response.json()) as { access_token?: string; error?: string };
    if (!response.ok || !body.access_token) throw new Error(`GitHub did not accept the code (${body.error ?? response.status}).`);
    return { accessToken: body.access_token };
  }

  private async api<T>(token: string, path: string, accept = 'application/vnd.github+json'): Promise<T | null> {
    const response = await this.fetcher(`https://api.github.com${path}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: accept, 'User-Agent': 'tracck', 'X-GitHub-Api-Version': '2022-11-28' },
    });
    if (response.status === 404) return null;
    if (response.status === 401) throw new Error('GitHub rejected the access token.');
    if (!response.ok) throw new Error(`GitHub request failed (${response.status}).`);
    return (accept.includes('raw') ? ((await response.text()) as unknown) : await response.json()) as T;
  }

  async getUser(token: string) {
    const user = await this.api<{ id: number; login: string }>(token, '/user');
    if (!user) throw new Error('GitHub did not return the account.');
    return { id: user.id, login: user.login };
  }

  async listRepos(token: string, login: string) {
    const repos = (await this.api<RawRepo[]>(token, `/users/${encodeURIComponent(login)}/repos?per_page=100&sort=pushed&type=owner`)) ?? [];
    return repos
      .filter((repo) => !repo.fork && !repo.private)
      .map<GithubRepo>((repo) => ({
        id: repo.id,
        name: repo.name,
        fullName: repo.full_name,
        description: repo.description,
        url: repo.html_url,
        language: repo.language,
        topics: repo.topics ?? [],
        pushedAt: repo.pushed_at,
        createdAt: repo.created_at,
        stars: repo.stargazers_count,
      }));
  }

  getReadme(token: string, fullName: string) {
    return this.api<string>(token, `/repos/${fullName}/readme`, 'application/vnd.github.raw+json');
  }

  async listReleases(token: string, fullName: string, limit: number) {
    const releases =
      (await this.api<
        { id: number; name: string | null; tag_name: string; body: string | null; published_at: string | null; html_url: string }[]
      >(token, `/repos/${fullName}/releases?per_page=${limit}`)) ?? [];
    return releases.map<GithubRelease>((release) => ({
      id: release.id,
      name: release.name,
      tag: release.tag_name,
      body: release.body,
      publishedAt: release.published_at,
      url: release.html_url,
    }));
  }
}
