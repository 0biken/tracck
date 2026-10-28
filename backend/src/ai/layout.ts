// Layout helpers shared by the engines. The formatter only chooses from what the resume
// already has: group ids, skills and strengths the evidence supports. Skill levels come
// from counting evidence, never from a model, so a rating can always be explained.

import {
  PERSONAL_DETAIL_LABELS,
  type HeaderDetail,
  type PersonalDetail,
  type PersonDetails,
  type ResumeSection,
  type SkillRating,
  type TemplateLayout,
} from '@tracck/shared';
import type { LayoutChoice } from './schemas';

export const MAX_SKILLS = 10;
export const MAX_STRENGTHS = 6;

export interface SkillUse {
  name: string;
  uses: number;
}

/** One dot per evidence entry that uses the skill, from one to five. */
export const skillLevel = (uses: number) => Math.min(5, Math.max(1, uses));

/** How many entries use each skill, keyed by its lower-case form. */
export function skillUses(entries: { skills: string[] }[]): Map<string, SkillUse> {
  const uses = new Map<string, SkillUse>();
  for (const entry of entries) {
    for (const raw of new Set(entry.skills.map((skill) => skill.trim()).filter(Boolean))) {
      const key = raw.toLowerCase();
      const current = uses.get(key);
      uses.set(key, { name: current?.name ?? raw, uses: (current?.uses ?? 0) + 1 });
    }
  }
  return uses;
}

const ratingOf = ({ name, uses }: SkillUse): SkillRating => ({ name, level: skillLevel(uses) });

/** Strengths the evidence shows: its topics, keyed by lower case and shown capitalised. */
export function traitsOf(entries: { topics: string[] }[]): Map<string, string> {
  const traits = new Map<string, string>();
  for (const entry of entries) {
    for (const topic of entry.topics) {
      const key = topic.trim().toLowerCase();
      if (key && !traits.has(key)) traits.set(key, key.charAt(0).toUpperCase() + key.slice(1));
    }
  }
  return traits;
}

/** The personal details a template shows, labelled, leaving out any the person did not fill in. */
export function headerDetails(person: PersonDetails, shown: PersonalDetail[]): HeaderDetail[] {
  return shown.flatMap((key) => {
    const value = person[key];
    return value ? [{ label: PERSONAL_DETAIL_LABELS[key], value }] : [];
  });
}

/** Groups in a Education section are education; every other group is experience. */
const isEducation = (heading: string) => /education/i.test(heading);

/** The layout used when the formatter is unavailable or returns nothing usable. */
export function defaultLayout(sections: ResumeSection[], uses: Map<string, SkillUse>): TemplateLayout {
  const groups = sections.flatMap((section) =>
    section.kind === 'groups' ? section.groups.map((group) => ({ id: group.id, education: isEducation(section.heading) })) : [],
  );
  return {
    experienceGroupIds: groups.filter((group) => !group.education).map((group) => group.id),
    educationGroupIds: groups.filter((group) => group.education).map((group) => group.id),
    skills: [...uses.values()]
      .sort((a, b) => b.uses - a.uses || a.name.localeCompare(b.name))
      .slice(0, MAX_SKILLS)
      .map(ratingOf),
    strengths: [],
  };
}

/**
 * Keeps only what the resume really has. Unknown ids, skills and strengths are dropped, and
 * a group is never listed twice.
 */
export function layoutFrom(
  choice: LayoutChoice,
  sections: ResumeSection[],
  uses: Map<string, SkillUse>,
  traits: Map<string, string>,
): TemplateLayout {
  const known = new Set(sections.flatMap((section) => (section.kind === 'groups' ? section.groups.map((group) => group.id) : [])));
  const experienceGroupIds = unique(choice.experienceGroupIds.filter((id) => known.has(id)));
  const educationGroupIds = unique(choice.educationGroupIds.filter((id) => known.has(id) && !experienceGroupIds.includes(id)));
  const skills = unique(choice.skills.map((name) => uses.get(name.trim().toLowerCase())))
    .filter((use): use is SkillUse => use !== undefined)
    .slice(0, MAX_SKILLS)
    .map(ratingOf);
  const strengths = unique(choice.strengths.map((name) => traits.get(name.trim().toLowerCase())))
    .filter((trait): trait is string => trait !== undefined)
    .slice(0, MAX_STRENGTHS);
  return { experienceGroupIds, educationGroupIds, skills, strengths };
}

const unique = <T>(values: T[]): T[] => [...new Set(values)];
