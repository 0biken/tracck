import type { ErrorEnvelope } from '@tracck/shared'

/** An error answer from the API, in the same shape the API sends: a code, a sentence, a correlation ID. */
export class ApiClientError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly correlationId?: string,
  ) {
    super(message)
    this.name = 'ApiClientError'
  }

  /** The feature's integration is not set up on the server. */
  get notConfigured() {
    return this.code === 'NOT_CONFIGURED'
  }

  /** A plan limit stopped this. The message says which one and when it resets. */
  get planLimit() {
    return this.code === 'PLAN_LIMIT_REACHED'
  }
}

export async function errorFromResponse(response: Response): Promise<ApiClientError> {
  try {
    const body = (await response.json()) as Partial<ErrorEnvelope>
    if (body.error) {
      return new ApiClientError(response.status, body.error.code, body.error.message, body.error.correlationId)
    }
  } catch {
    // Not JSON: fall through.
  }
  return new ApiClientError(response.status, 'UNKNOWN', 'Something went wrong. Try again.')
}

/** What to show a person when a call failed. */
export function messageOf(error: unknown): string {
  if (error instanceof ApiClientError) return error.message
  return 'We could not reach the server. Check your connection and try again.'
}
