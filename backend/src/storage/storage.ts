// Private object storage for uploaded CVs and exported resumes. Buckets are never
// public: files are reached only by the server, or through a short-lived signed link.

import { notConfigured } from '../common/not-configured';

export interface ObjectStorage {
  put(key: string, body: Buffer, contentType: string): Promise<void>;
  get(key: string): Promise<Buffer>;
  /** A link that works for `seconds`, for downloads. */
  signedUrl(key: string, seconds: number): Promise<string>;
  remove(keys: string[]): Promise<void>;
  /** Removes every object under a prefix, for example one person's folder. */
  removePrefix(prefix: string): Promise<void>;
}

/** Used when Supabase Storage is not set up: every use answers 503 NOT_CONFIGURED. */
export class UnconfiguredStorage implements ObjectStorage {
  put(): Promise<void> {
    return notConfigured('File storage');
  }
  get(): Promise<Buffer> {
    return notConfigured('File storage');
  }
  signedUrl(): Promise<string> {
    return notConfigured('File storage');
  }
  remove(): Promise<void> {
    return notConfigured('File storage');
  }
  removePrefix(): Promise<void> {
    return notConfigured('File storage');
  }
}

const PAGE = 1000;

/** Supabase Storage over its REST API, with the project's secret key (sb_secret_...). */
export class SupabaseStorage implements ObjectStorage {
  private ensured = false;

  constructor(
    private readonly baseUrl: string,
    private readonly secretKey: string,
    private readonly bucket: string,
    private readonly fetcher: typeof fetch = fetch,
  ) {}

  /** The secret key goes in the apikey header, as Supabase documents for secret keys. */
  private headers(extra: Record<string, string> = {}) {
    return { apikey: this.secretKey, ...extra };
  }

  private url(path: string) {
    return `${this.baseUrl.replace(/\/$/, '')}/storage/v1${path}`;
  }

  private objectPath(key: string) {
    return `/object/${this.bucket}/${key.split('/').map(encodeURIComponent).join('/')}`;
  }

  /** Creates the private bucket the first time it is needed. A bucket that exists is fine. */
  private async ensureBucket() {
    if (this.ensured) return;
    const response = await this.fetcher(this.url('/bucket'), {
      method: 'POST',
      headers: this.headers({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ id: this.bucket, name: this.bucket, public: false }),
    });
    if (!response.ok && response.status !== 409 && !(await response.clone().text()).includes('already exists')) {
      throw new Error(`Storage bucket setup failed (${response.status}).`);
    }
    this.ensured = true;
  }

  async put(key: string, body: Buffer, contentType: string) {
    await this.ensureBucket();
    const response = await this.fetcher(this.url(this.objectPath(key)), {
      method: 'POST',
      headers: this.headers({ 'Content-Type': contentType, 'x-upsert': 'true' }),
      body: new Uint8Array(body),
    });
    if (!response.ok) throw new Error(`Storage upload failed (${response.status}).`);
  }

  async get(key: string) {
    const response = await this.fetcher(this.url(this.objectPath(key)), { headers: this.headers() });
    if (!response.ok) throw new Error(`Storage download failed (${response.status}).`);
    return Buffer.from(await response.arrayBuffer());
  }

  async signedUrl(key: string, seconds: number) {
    const response = await this.fetcher(this.url(`/object/sign/${this.bucket}/${key.split('/').map(encodeURIComponent).join('/')}`), {
      method: 'POST',
      headers: this.headers({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ expiresIn: seconds }),
    });
    if (!response.ok) throw new Error(`Storage link failed (${response.status}).`);
    const { signedURL } = (await response.json()) as { signedURL: string };
    return `${this.baseUrl.replace(/\/$/, '')}/storage/v1${signedURL}`;
  }

  async remove(keys: string[]) {
    if (keys.length === 0) return;
    const response = await this.fetcher(this.url(`/object/${this.bucket}`), {
      method: 'DELETE',
      headers: this.headers({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ prefixes: keys }),
    });
    if (!response.ok) throw new Error(`Storage delete failed (${response.status}).`);
  }

  /** Folders are listed one level at a time, so this walks down to every file under the prefix. */
  async removePrefix(prefix: string) {
    const files: string[] = [];
    const walk = async (directory: string): Promise<void> => {
      for (let offset = 0; ; offset += PAGE) {
        const listed = await this.fetcher(this.url(`/object/list/${this.bucket}`), {
          method: 'POST',
          headers: this.headers({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({ prefix: directory, limit: PAGE, offset }),
        });
        // A bucket that was never created holds nothing to remove.
        if (listed.status === 404) return;
        if (!listed.ok) throw new Error(`Storage list failed (${listed.status}).`);
        const entries = (await listed.json()) as { name: string; id: string | null }[];
        for (const entry of entries) {
          if (entry.id === null) await walk(`${directory}/${entry.name}`);
          else files.push(`${directory}/${entry.name}`);
        }
        if (entries.length < PAGE) return;
      }
    };
    await walk(prefix.replace(/\/$/, ''));
    for (let start = 0; start < files.length; start += 100) await this.remove(files.slice(start, start + 100));
  }
}

/** In-memory storage for tests. */
export class MemoryStorage implements ObjectStorage {
  readonly objects = new Map<string, { body: Buffer; contentType: string }>();

  async put(key: string, body: Buffer, contentType: string) {
    this.objects.set(key, { body, contentType });
  }
  async get(key: string) {
    const object = this.objects.get(key);
    if (!object) throw new Error('No such object.');
    return object.body;
  }
  async signedUrl(key: string, seconds: number) {
    return `https://storage.test/${key}?expires=${seconds}`;
  }
  async remove(keys: string[]) {
    for (const key of keys) this.objects.delete(key);
  }
  async removePrefix(prefix: string) {
    for (const key of [...this.objects.keys()]) if (key.startsWith(prefix)) this.objects.delete(key);
  }
}
