import type { Bullet, ResumeContent, ResumeGroup, ResumeSection, SkillRating } from '@tracck/shared'
import type { ReactNode } from 'react'

const RED = '#B3262E'
const DOTS = 5

/** What every template receives: the resume, and how the editor wants a bullet drawn so it stays selectable. */
export interface TemplateProps {
  content: ResumeContent
  renderBullet: (bullet: Bullet) => ReactNode
}

function Heading({ children }: { children: ReactNode }) {
  return (
    <h2 className="mb-2 mt-5 flex items-center gap-3 text-[15px] font-bold" style={{ color: RED }}>
      <span>{children}</span>
      <span aria-hidden className="h-px flex-1 bg-[#141310]" />
    </h2>
  )
}

function Dots({ level }: { level: number }) {
  return (
    <span aria-label={`${level} of ${DOTS}`} className="flex gap-1">
      {Array.from({ length: DOTS }, (_, index) => (
        <span key={index} className="size-2 rounded-full" style={{ background: index < level ? RED : '#D8D4CB' }} />
      ))}
    </span>
  )
}

function Entries({ groups, renderBullet }: { groups: ResumeGroup[]; renderBullet: (bullet: Bullet) => ReactNode }) {
  return (
    <>
      {groups.map((group) => (
        <div key={group.id} className="mb-3">
          <div className="flex justify-between gap-4 text-[13px] font-bold">
            <span>{group.title}</span>
            {group.year && <span style={{ color: RED }}>{group.year}</span>}
          </div>
          <ul className="mb-1 mt-1 list-disc pl-[18px]">
            {group.bullets.map((bullet) => (
              <li key={bullet.id} className="text-[12.5px] leading-[17px]">
                {renderBullet(bullet)}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </>
  )
}

/** Classic red: a name header with the person's details, then profile, experience, education, skills and strengths. */
export function ClassicRed({ content, renderBullet }: TemplateProps) {
  const groups = new Map(content.sections.flatMap((section) => (section.kind === 'groups' ? section.groups.map((group) => [group.id, group] as const) : [])))
  const summary = content.sections.find((section): section is Extract<ResumeSection, { kind: 'text' }> => section.kind === 'text' && section.id === 's-summary')
  const { layout } = content

  const pick = (ids: string[]) => ids.flatMap((id) => groups.get(id) ?? [])
  const experience = layout ? pick(layout.experienceGroupIds) : [...groups.values()]
  const education = layout ? pick(layout.educationGroupIds) : []
  const skills: SkillRating[] = layout ? layout.skills : []
  const strengths = layout ? layout.strengths : []

  const words = content.header.name.trim().split(/\s+/)
  const surname = words.pop()
  // Older saved versions have no details; they show none.
  const details = content.header.details ?? []

  return (
    <div className="font-[Arial,Helvetica,sans-serif] text-[#141310]">
      <header className="text-center">
        <h1 className="m-0 text-[34px] font-bold leading-none">
          {words.join(' ')} <span style={{ color: RED }}>{surname}</span>
        </h1>
        <dl className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-1 text-[11.5px]">
          {details.map((detail) => (
            <div key={detail.label} className="flex gap-1">
              <dt className="font-bold" style={{ color: RED }}>
                {detail.label}:
              </dt>
              <dd className="m-0">{detail.value}</dd>
            </div>
          ))}
        </dl>
      </header>

      {summary && (
        <section aria-label="profile">
          <Heading>Profile</Heading>
          <p className="m-0 text-[12.5px] leading-[17px]">{summary.text}</p>
        </section>
      )}

      {experience.length > 0 && (
        <section aria-label="work experience">
          <Heading>Work experience</Heading>
          <Entries groups={experience} renderBullet={renderBullet} />
        </section>
      )}

      {education.length > 0 && (
        <section aria-label="education">
          <Heading>Education</Heading>
          <Entries groups={education} renderBullet={renderBullet} />
        </section>
      )}

      {skills.length > 0 && (
        <section aria-label="skills">
          <Heading>Skills</Heading>
          <ul className="m-0 grid list-none grid-cols-2 gap-x-6 gap-y-2 p-0 text-[12.5px] sm:grid-cols-4">
            {skills.map((skill) => (
              <li key={skill.name} className="flex flex-col gap-1">
                <span>{skill.name}</span>
                <Dots level={skill.level} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {strengths.length > 0 && (
        <section aria-label="strengths">
          <Heading>Strengths</Heading>
          <p className="m-0 text-[12.5px] leading-[19px]">{strengths.join(' | ')}</p>
        </section>
      )}
    </div>
  )
}
