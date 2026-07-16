import { GoogleGenAI, Type, Schema } from '@google/genai';
import { Job } from 'bullmq';
import { createAdminClient } from '../../src/lib/supabase-admin';
import { queues } from '../queues';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const model = 'gemini-2.5-flash';

const jdParsingSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    role_tag: {
      type: Type.STRING,
      enum: ['developer', 'devrel', 'smm', 'virtual_assistant', 'ui_designer', 'data_analyst']
    },
    seniority: { type: Type.STRING },
    required_skills: {
      type: Type.ARRAY,
      items: { type: Type.STRING }
    },
    preferred_skills: {
      type: Type.ARRAY,
      items: { type: Type.STRING }
    },
    responsibility_themes: {
      type: Type.ARRAY,
      items: { type: Type.STRING }
    },
    keywords_for_ats: {
      type: Type.ARRAY,
      items: { type: Type.STRING }
    }
  },
  required: ['role_tag', 'seniority', 'required_skills', 'preferred_skills', 'responsibility_themes', 'keywords_for_ats']
};

export async function processJdParsing(job: Job) {
  const { targetRoleId } = job.data;

  const supabase = createAdminClient();
  const { data: targetRole, error } = await supabase
    .from('target_roles')
    .select('*')
    .eq('id', targetRoleId)
    .single();

  if (error || !targetRole) {
    throw new Error(`Failed to fetch target_roles ${targetRoleId}`);
  }

  // If no JD text is provided, it's just a generic role_tag selection
  if (!targetRole.jd_text) {
    // We can enqueue role-scoring immediately since there's nothing to parse
    await queues.atsScore.add('role-scoring', {
      targetRoleId
    });
    return { skipped: true, reason: 'no jd_text' };
  }

  const prompt = `
    Analyze the following job description and extract key structured information.
    
    Job Description:
    ${targetRole.jd_text}
  `;

  const response = await ai.models.generateContent({
    model,
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema: jdParsingSchema,
    }
  });

  const text = response.text || '';
  const result = JSON.parse(text);

  // Update target_roles in database
  const { error: updateError } = await supabase
    .from('target_roles')
    .update({
      role_tag: result.role_tag,
      seniority: result.seniority,
      required_skills: result.required_skills,
      preferred_skills: result.preferred_skills,
      responsibility_themes: result.responsibility_themes,
      ats_keywords: result.keywords_for_ats,
      parsed_at: new Date().toISOString()
    })
    .eq('id', targetRoleId);

  if (updateError) {
    throw new Error(`Failed to update target role ${targetRoleId}: ${updateError.message}`);
  }

  // Enqueue role-scoring job
  await queues.atsScore.add('role-scoring', {
    targetRoleId
  });

  return result;
}
