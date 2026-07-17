import { inngest } from "./client";
import { processClaimClassification } from "../../workers/jobs/claim-classification";
import { processBulletGeneration } from "../../workers/jobs/bullet-generation";
import { processJdParsing } from "../../workers/jobs/jd-parsing";
import { processRoleScoring } from "../../workers/jobs/role-scoring";
import { processResumeBuild } from "../../workers/jobs/resume-build";

export const claimClassification = inngest.createFunction(
  { id: "claim-classification" },
  { event: "ai/claim.classify" },
  async ({ event, step }) => {
    return processClaimClassification({ data: event.data } as any);
  }
);

export const bulletGeneration = inngest.createFunction(
  { id: "bullet-generation" },
  { event: "ai/bullet.generate" },
  async ({ event, step }) => {
    return processBulletGeneration({ data: event.data } as any);
  }
);

export const jdParsing = inngest.createFunction(
  { id: "jd-parsing" },
  { event: "ai/jd.parse" },
  async ({ event, step }) => {
    return processJdParsing({ data: event.data } as any);
  }
);

export const roleScoring = inngest.createFunction(
  { id: "role-scoring" },
  { event: "ai/role.score" },
  async ({ event, step }) => {
    return processRoleScoring({ data: event.data } as any);
  }
);

export const resumeBuild = inngest.createFunction(
  { id: "resume-build" },
  { event: "resume/build" },
  async ({ event, step }) => {
    return processResumeBuild({ data: event.data } as any);
  }
);

export const socialFetch = inngest.createFunction(
  { id: "social-fetch" },
  { event: "social/fetch" },
  async ({ event, step }) => {
    console.log(`[social-fetch] Processing job ${event.data.id}`);
  }
);

// Array of all functions to export
export const functions = [
  claimClassification,
  bulletGeneration,
  jdParsing,
  roleScoring,
  resumeBuild,
  socialFetch
];
