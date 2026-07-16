import { GoogleGenAI, Type, Schema } from '@google/genai';
import { Job } from 'bullmq';
import { createAdminClient } from '../../src/lib/supabase-admin';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const model = 'gemini-2.5-flash';

const bulletSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    bullet_text: { type: Type.STRING },
    role_tag: { type: Type.STRING },
    ats_keywords: { 
      type: Type.ARRAY,
      items: { type: Type.STRING }
    }
  },
  required: ['bullet_text', 'role_tag', 'ats_keywords']
};

export async function processBulletGeneration(job: Job) {
  const { rawPostId, classification, finalConfidence } = job.data;

  const supabase = createAdminClient();
  const { data: rawPost, error } = await supabase
    .from('raw_posts')
    .select('*')
    .eq('id', rawPostId)
    .single();

  if (error || !rawPost) {
    throw new Error(`Failed to fetch raw_post ${rawPostId}`);
  }

  const prompt = `
    Based on the following text and its classification, generate a resume bullet point.
    
    Category: ${classification.category}
    Summary: ${classification.claim_summary}
    Text: ${rawPost.raw_text}
    
    CRITICAL RULES:
    1. Do not embellish. If the category is 'participation_claim' (e.g. they attended an event), do NOT make it sound like they led or organized it. Preserve the actual claimed role.
    2. Write a single, concise resume bullet point.
    3. Suggest a relevant role tag (e.g., 'developer', 'designer', 'manager').
    4. Extract relevant ATS keywords.
  `;

  const response = await ai.models.generateContent({
    model,
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema: bulletSchema,
    }
  });

  const text = response.text || '';
  const result = JSON.parse(text);

  let status = 'low_confidence';
  if (finalConfidence >= 0.75) {
    status = 'pending';
  }

  // Insert into accomplishments table
  const accomplishment = {
    user_id: rawPost.user_id,
    raw_post_id: rawPostId,
    bullet_text: result.bullet_text,
    role_tag: result.role_tag,
    ats_keywords: result.ats_keywords,
    claim_category: classification.category,
    confidence_score: finalConfidence,
    status: status,
  };

  const { error: insertError } = await supabase
    .from('accomplishments')
    .insert(accomplishment);

  if (insertError) {
    throw new Error(`Failed to insert accomplishment: ${insertError.message}`);
  }

  return accomplishment;
}
