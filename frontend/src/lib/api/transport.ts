import { ApiClientError, errorFromResponse } from './errors'
import type { CallOptions, Query, Transport } from './endpoints'

/** The API's address. Server code prefers a private address; the browser needs the public one. */
export function apiBase(): string {
  const base = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL
  if (!base) {
    throw new ApiClientError(
      503,
      'NOT_CONFIGURED',
      'The API address is not set. Add NEXT_PUBLIC_API_URL from .env.example, then restart the app.',
    )
  }
  return base.replace(/\/$/, '')
}

export function withQuery(path: string, query?: Query): string {
  if (!query) return path
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== '') params.set(key, String(value))
  }
  const text = params.toString()
  return text ? `${path}${path.includes('?') ? '&' : '?'}${text}` : path
}

/**
 * Builds a transport over `fetch`. `getToken` supplies the Supabase access
 * token for the current context (cookies on the server, the session in the browser).
 * Every POST carries an Idempotency-Key, so a retried request is never applied twice.
 */
export function fetchTransport(getToken: () => Promise<string | null>, init: RequestInit = {}): Transport {
  return async <T,>(method: string, path: string, options: CallOptions = {}) => {
    const headers = new Headers()
    const token = await getToken()
    if (token) headers.set('Authorization', `Bearer ${token}`)
    if (method === 'POST') headers.set('Idempotency-Key', options.idempotencyKey ?? crypto.randomUUID())

    let body: BodyInit | undefined
    if (options.form) {
      body = options.form
    } else if (options.body !== undefined) {
      headers.set('Content-Type', 'application/json')
      body = JSON.stringify(options.body)
    }

    const response = await fetch(`${apiBase()}${withQuery(path, options.query)}`, { ...init, method, headers, body })
    if (!response.ok) throw await errorFromResponse(response)
    if (response.status === 204) return undefined as T
    const text = await response.text()
    return (text ? JSON.parse(text) : undefined) as T
  }
}
