// Every call the frontend makes to the API, typed from the shared contracts.
// `createApi` takes a transport, so the same endpoints work from server
// components (session token from cookies) and from the browser (token from the
// Supabase session). Paths follow docs/prd/03-architecture.md.

import type {
  BillingView,
  CheckoutRequest,
  CheckoutResponse,
  CreateEvidenceRequest,
  CreateResumeRequest,
  TemplateView,
  CreateResumeResponse,
  CvReviewView,
  EditBulletRequest,
  EvidencePage,
  EvidenceShow,
  EvidenceView,
  ExportLinkResponse,
  ExportResponse,
  GithubConnectResponse,
  GraphView,
  JobListItem,
  JobView,
  MeView,
  NotificationView,
  Page,
  ParseJobResponse,
  Preferences,
  ResolveDuplicateRequest,
  ResumeDetailView,
  ResumeStatus,
  ResumeSummaryView,
  ResumeVersionView,
  RoleId,
  SourceProvider,
  SourceView,
  SummaryView,
  UpdateEvidenceRequest,
  UpdateMeRequest,
  UploadSourceResponse,
  VerifyPaymentResponse,
  WaitlistRequest,
} from '@tracck/shared'

export type Query = Record<string, string | number | boolean | undefined | null>

export interface CallOptions {
  body?: unknown
  query?: Query
  /** Multipart upload. Sets no Content-Type, so the browser adds the boundary. */
  form?: FormData
  idempotencyKey?: string
}

export type Transport = <T>(method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE', path: string, options?: CallOptions) => Promise<T>

export function createApi(call: Transport) {
  const get = <T>(path: string, query?: Query) => call<T>('GET', path, { query })
  const post = <T>(path: string, body?: unknown, options: CallOptions = {}) => call<T>('POST', path, { ...options, body })
  const patch = <T>(path: string, body: unknown) => call<T>('PATCH', path, { body })
  const put = <T>(path: string, body: unknown) => call<T>('PUT', path, { body })
  const del = <T>(path: string, query?: Query) => call<T>('DELETE', path, { query })

  return {
    me: {
      get: () => get<MeView>('/v1/me'),
      update: (body: UpdateMeRequest) => patch<MeView>('/v1/me', body),
      summary: () => get<SummaryView>('/v1/me/summary'),
      setPreferences: (body: Preferences) => put<Preferences>('/v1/me/preferences', body),
      setRoles: (roles: RoleId[]) => put<MeView>('/v1/me/roles', { roles }),
      acceptPolicy: () => post<{ ok: true }>('/v1/me/consents/policy'),
      requestExport: () => post<{ jobId: string }>('/v1/me/export'),
      latestExport: () => get<{ url: string; expiresAt: string; createdAt: string } | null>('/v1/me/export/latest'),
      deleteAccount: () => call<{ requestId: string; jobId: string }>('DELETE', '/v1/me', { query: { confirm: 'delete-my-account' } }),
    },

    notifications: {
      list: () => get<Page<NotificationView>>('/v1/notifications'),
      markRead: (id: string) => post<void>(`/v1/notifications/${id}/read`),
    },

    jobs: {
      list: (limit = 20) => get<JobListItem[]>('/v1/jobs', { limit }),
      get:(id: string) => get<JobView>(`/v1/jobs/${id}`),
    },

    sources: {
      list: () => get<SourceView[]>('/v1/sources'),
      githubConnect: (from: 'onboarding' | 'sources') =>
        post<GithubConnectResponse>('/v1/sources/github/connect', { from }),
      uploadCv: (file: File) => call<UploadSourceResponse>('POST', '/v1/sources/cv', { form: fileForm(file) }),
      linkedinFile: (file: File) => call<UploadSourceResponse>('POST', '/v1/sources/linkedin', { form: fileForm(file) }),
      xArchive: (file: File) => call<UploadSourceResponse>('POST', '/v1/sources/x', { form: fileForm(file) }),
      linkedinText: (text: string) => post<UploadSourceResponse>('/v1/sources/linkedin', { text }),
      portfolio: (url: string) => post<UploadSourceResponse>('/v1/sources/portfolio', { url }),
      paste: (provider: Extract<SourceProvider, 'behance' | 'portfolio' | 'linkedin'>, text: string) =>
        post<UploadSourceResponse>('/v1/sources/paste', { provider, text }),
      refresh: (id: string) => post<UploadSourceResponse>(`/v1/sources/${id}/refresh`),
      reset: (id: string) => post<void>(`/v1/sources/${id}/reset`),
      retry: (id: string) => post<UploadSourceResponse>(`/v1/sources/${id}/retry`),
      remove: (id: string, entries: 'keep' | 'delete') => del<void>(`/v1/sources/${id}`, { entries }),
    },

    evidence: {
      list: (query: { show?: EvidenceShow; source?: string; q?: string; cursor?: string } = {}) =>
        get<EvidencePage>('/v1/evidence', query),
      create: (body: CreateEvidenceRequest) => post<EvidenceView>('/v1/evidence', body),
      update: (id: string, body: UpdateEvidenceRequest) => patch<EvidenceView>(`/v1/evidence/${id}`, body),
      resolveDuplicate: (id: string, body: ResolveDuplicateRequest) =>
        post<{ ok: true }>(`/v1/evidence/duplicates/${id}/resolve`, body),
    },

    graph: () => get<GraphView>('/v1/graph'),

    cvReview: {
      latest: () => get<CvReviewView | null>('/v1/cv-reviews/latest'),
      request: () => post<{ jobId: string }>('/v1/cv-reviews'),
    },

    templates: {
      list: () => get<{ templates: TemplateView[] }>('/v1/templates'),
    },

    resumes: {
      parseJob: (description: string) => post<ParseJobResponse>('/v1/job-descriptions/parse', { description }),
      create: (body: CreateResumeRequest) => post<CreateResumeResponse>('/v1/resumes', body),
      list: (query: { q?: string; status?: ResumeStatus; cursor?: string; limit?: number } = {}) =>
        get<Page<ResumeSummaryView>>('/v1/resumes', query),
      get: (id: string) => get<ResumeDetailView>(`/v1/resumes/${id}`),
      versions: (id: string) => get<ResumeVersionView[]>(`/v1/resumes/${id}/versions`),
      editBullet: (id: string, bulletId: string, body: EditBulletRequest) =>
        patch<ResumeDetailView>(`/v1/resumes/${id}/bullets/${bulletId}`, body),
      moveBullet: (id: string, bulletId: string, version: number) =>
        post<ResumeDetailView>(`/v1/resumes/${id}/bullets/${bulletId}/move`, { direction: 'up', version }),
      removeBullet: (id: string, bulletId: string, version: number) =>
        call<ResumeDetailView>('DELETE', `/v1/resumes/${id}/bullets/${bulletId}`, { query: { version } }),
      restoreBullet: (id: string, version: number) =>
        post<ResumeDetailView>(`/v1/resumes/${id}/restore`, { version }),
      regenerate: (id: string) => post<CreateResumeResponse>(`/v1/resumes/${id}/regenerate`),
      export: (id: string, format: 'pdf' | 'docx') => post<ExportResponse>(`/v1/resumes/${id}/export`, { format }),
      exportLink: (id: string, format: 'pdf' | 'docx') => get<ExportLinkResponse>(`/v1/resumes/${id}/export/${format}`),
      remove: (id: string) => del<void>(`/v1/resumes/${id}`),
      removeAll: () => del<void>('/v1/resumes'),
    },

    billing: {
      get: () => get<BillingView>('/v1/billing'),
      checkout: (body: CheckoutRequest) => post<CheckoutResponse>('/v1/billing/checkout', body),
      verify: (reference: string) => get<VerifyPaymentResponse>('/v1/billing/verify', { reference }),
      cancel: () => post<BillingView>('/v1/billing/cancel'),
    },

    waitlist: {
      join: (body: WaitlistRequest) => post<{ ok: true }>('/v1/waitlist', body),
    },

  }
}

function fileForm(file: File) {
  const form = new FormData()
  form.append('file', file)
  return form
}

export type Api = ReturnType<typeof createApi>
