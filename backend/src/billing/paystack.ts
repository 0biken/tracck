// Paystack over its REST API. Only what Tracck needs: start a payment, check one,
// and stop a subscription from renewing. Card details never reach Tracck.

import { createHmac, timingSafeEqual } from 'node:crypto';
import { ApiError } from '@tracck/shared';
import { notConfigured } from '../common/not-configured';

export interface PaystackCharge {
  status: 'success' | 'failed' | 'abandoned' | 'pending';
  reference: string;
  amountKobo: number;
  currency: string;
  paidAt: string | null;
  customerCode: string | null;
  email: string | null;
}

export interface InitializeInput {
  email: string;
  amountKobo: number;
  reference: string;
  callbackUrl: string;
  /** Paystack plan code, so the charge repeats every month. */
  planCode: string;
  metadata: Record<string, unknown>;
}

export interface PaystackClient {
  readonly configured: boolean;
  initialize(input: InitializeInput): Promise<{ authorizationUrl: string; reference: string }>;
  verify(reference: string): Promise<PaystackCharge>;
  disableSubscription(code: string, emailToken: string): Promise<void>;
}

export class UnconfiguredPaystack implements PaystackClient {
  readonly configured = false;
  initialize(): Promise<never> {
    return notConfigured('Payments');
  }
  verify(): Promise<never> {
    return notConfigured('Payments');
  }
  disableSubscription(): Promise<never> {
    return notConfigured('Payments');
  }
}

interface Envelope<T> {
  status: boolean;
  message: string;
  data: T;
}

export class HttpPaystack implements PaystackClient {
  readonly configured = true;

  constructor(
    private readonly secretKey: string,
    private readonly fetcher: typeof fetch = fetch,
  ) {}

  private async call<T>(method: 'GET' | 'POST', path: string, body?: object): Promise<T> {
    let response: Response;
    try {
      response = await this.fetcher(`https://api.paystack.co${path}`, {
        method,
        headers: { Authorization: `Bearer ${this.secretKey}`, 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(15_000),
      });
    } catch {
      throw new ApiError(502, 'PAYMENT_FAILED', 'We could not reach the payment provider. Try again in a moment.');
    }
    const json = (await response.json().catch(() => null)) as Envelope<T> | null;
    if (!response.ok || !json?.status) {
      throw new ApiError(response.status >= 500 ? 502 : 400, 'PAYMENT_FAILED', json?.message ?? 'The payment provider refused that request.');
    }
    return json.data;
  }

  async initialize(input: InitializeInput) {
    const data = await this.call<{ authorization_url: string; reference: string }>('POST', '/transaction/initialize', {
      email: input.email,
      amount: input.amountKobo,
      currency: 'NGN',
      reference: input.reference,
      callback_url: input.callbackUrl,
      plan: input.planCode,
      metadata: input.metadata,
    });
    return { authorizationUrl: data.authorization_url, reference: data.reference };
  }

  async verify(reference: string): Promise<PaystackCharge> {
    const data = await this.call<{
      status: string;
      reference: string;
      amount: number;
      currency: string;
      paid_at: string | null;
      customer?: { customer_code?: string; email?: string };
    }>('GET', `/transaction/verify/${encodeURIComponent(reference)}`);
    return {
      status: (['success', 'failed', 'abandoned'].includes(data.status) ? data.status : 'pending') as PaystackCharge['status'],
      reference: data.reference,
      amountKobo: data.amount,
      currency: data.currency,
      paidAt: data.paid_at,
      customerCode: data.customer?.customer_code ?? null,
      email: data.customer?.email ?? null,
    };
  }

  async disableSubscription(code: string, emailToken: string): Promise<void> {
    await this.call('POST', '/subscription/disable', { code, token: emailToken });
  }
}

/** Paystack signs the raw body with the secret key (HMAC-SHA512) and sends it in `x-paystack-signature`. */
export function validSignature(rawBody: Buffer, signature: string | undefined, secretKey: string): boolean {
  if (!signature) return false;
  const expected = createHmac('sha512', secretKey).update(rawBody).digest();
  let given: Buffer;
  try {
    given = Buffer.from(signature, 'hex');
  } catch {
    return false;
  }
  return given.length === expected.length && timingSafeEqual(given, expected);
}
