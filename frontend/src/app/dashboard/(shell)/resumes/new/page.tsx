import { Eyebrow } from '@/components/page-header'
import { serverApi } from '@/lib/api/server'
import { NewResumeForm } from './new-resume-form'

export const metadata = { title: 'New resume' }

export default async function NewResumePage() {
  const api = serverApi()
  const [me, summary, sources, { templates }] = await Promise.all([api.me.get(), api.me.summary(), api.sources.list(), api.templates.list()])
  const limit = summary.resumesLimit

  return (
    <>
      <div className="flex flex-col gap-2 border-b-2 border-ink pb-5">
        <Eyebrow>
          New resume · Uses {summary.resumesThisMonth}
          {limit !== null ? ` of ${limit}` : ''} this month
        </Eyebrow>
        <h1 className="t-h2 m-0 text-balance">Paste the job. Tracck finds your evidence.</h1>
      </div>
      <NewResumeForm
        plan={me.plan}
        defaultRole={me.primaryRole}
        sources={sources}
        entries={summary.bySource}
        templates={templates}
        atLimit={limit !== null && summary.resumesThisMonth >= limit}
        resetsOn={summary.periodResetsOn}
      />
    </>
  )
}
