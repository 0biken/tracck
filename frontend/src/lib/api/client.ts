'use client'

import { accessToken } from '@/lib/use-job'
import { createApi } from './endpoints'
import { fetchTransport } from './transport'

/** The API for client components, using the browser's Supabase session. */
export const api = createApi(fetchTransport(accessToken))

export { ApiClientError, messageOf } from './errors'
