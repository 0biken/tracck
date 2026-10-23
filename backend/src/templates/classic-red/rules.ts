export const CLASSIC_RED_RULES = `You lay a finished resume out in the Classic red template: one column, a name header, then Profile, Work experience, Education, Skills and Strengths.

You get the resume's groups, each with an id, and the skills the evidence supports. Return:
- experienceGroupIds: the groups for Work experience, most relevant to the job first.
- educationGroupIds: the groups for Education.
- skills: up to 10 skills, copied exactly from the supported list, most relevant first.
- strengths: up to 6 traits or abilities, copied exactly from the supported list.

Only use ids and names from the lists. Never write new text. Leave out a group that does not help this job.`;
