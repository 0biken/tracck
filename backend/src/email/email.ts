// Sending email. One interface, so the provider can change without touching the
// features that send: Resend when configured, a no-op that says so when not.

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export type EmailFailureKind = 'retryable' | 'permanent';

export class EmailError extends Error {
  constructor(
    public readonly kind: EmailFailureKind,
    message: string,
  ) {
    super(message);
    this.name = 'EmailError';
  }
}

export interface EmailSender {
  /** False when no provider is set up. Features that need email check this before promising it. */
  readonly configured: boolean;
  send(message: EmailMessage): Promise<void>;
}

export class UnconfiguredEmail implements EmailSender {
  readonly configured = false;
  async send(): Promise<void> {
    throw new EmailError('permanent', 'Email is not set up on this server.');
  }
}

/** Resend over its REST API. */
export class ResendEmail implements EmailSender {
  readonly configured = true;

  constructor(
    private readonly apiKey: string,
    private readonly from: string,
    private readonly fetcher: typeof fetch = fetch,
  ) {}

  async send(message: EmailMessage): Promise<void> {
    let response: Response;
    try {
      response = await this.fetcher('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: this.from, to: [message.to], subject: message.subject, text: message.text, html: message.html }),
        signal: AbortSignal.timeout(15_000),
      });
    } catch {
      throw new EmailError('retryable', 'Could not reach the email provider.');
    }
    if (response.ok) return;
    // Rate limits and provider faults pass; a rejected address or key will not.
    throw new EmailError(response.status === 429 || response.status >= 500 ? 'retryable' : 'permanent', `The email provider answered ${response.status}.`);
  }
}

/** Keeps what was sent, for tests. */
export class MemoryEmail implements EmailSender {
  readonly configured = true;
  readonly sent: EmailMessage[] = [];
  fail: EmailFailureKind | null = null;

  async send(message: EmailMessage): Promise<void> {
    if (this.fail) throw new EmailError(this.fail, 'The email provider is down.');
    this.sent.push(message);
  }
}
