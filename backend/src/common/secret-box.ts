import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { notConfigured } from './not-configured';

const VERSION = 'v1';

/**
 * Encrypts small secrets (provider access tokens, webhook signing secrets) before
 * they are stored. AES-256-GCM: tampered data fails to decrypt instead of
 * returning garbage. The key never leaves the server.
 */
export class SecretBox {
  private readonly key: Buffer | null;

  constructor(base64Key?: string) {
    this.key = base64Key ? Buffer.from(base64Key, 'base64') : null;
    if (this.key && this.key.length !== 32) {
      throw new Error('TOKEN_ENCRYPTION_KEY must be 32 random bytes, base64 encoded.');
    }
  }

  get configured() {
    return this.key !== null;
  }

  /** The key label stored next to each secret, so keys can be rotated later. */
  get keyVersion() {
    return VERSION;
  }

  encrypt(plaintext: string): string {
    const key = this.requireKey();
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const body = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    return [VERSION, iv.toString('base64'), cipher.getAuthTag().toString('base64'), body.toString('base64')].join(':');
  }

  decrypt(payload: string): string {
    const key = this.requireKey();
    const [version, iv, tag, body] = payload.split(':');
    if (version !== VERSION || !iv || !tag || !body) throw new Error('Unreadable secret.');
    const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64'));
    decipher.setAuthTag(Buffer.from(tag, 'base64'));
    return Buffer.concat([decipher.update(Buffer.from(body, 'base64')), decipher.final()]).toString('utf8');
  }

  /** Raw key bytes, for signing short-lived tokens. */
  signingKey(): Uint8Array {
    return new Uint8Array(this.requireKey());
  }

  private requireKey(): Buffer {
    return this.key ?? notConfigured('Secure storage of tokens');
  }
}
