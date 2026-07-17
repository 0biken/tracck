import { GoogleGenAI } from '@google/genai';
import { createAdminClient } from '../../src/lib/supabase-admin';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const embedModel = 'text-embedding-004';

// Helper to compute cosine similarity between two vectors
function cosineSimilarity(vecA: number[], vecB: number[]): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// Helper to get embeddings from Gemini
async function getEmbedding(text: string): Promise<number[]> {
  const response = await ai.models.embedContent({
    model: embedModel,
    contents: text,
  });
  return response.embeddings?.[0]?.values || [];
}

export async function processRoleScoring(job: { data: Record<string, any> }) {
  const { targetRoleId } = job.data;

  const supabase = createAdminClient();
  const { data: targetRole, error: roleError } = await supabase
    .from('target_roles')
    .select('*')
    .eq('id', targetRoleId)
    .single();

  if (roleError || !targetRole) {
    throw new Error(`Failed to fetch target_roles ${targetRoleId}`);
  }

  const { data: accomplishments, error: accError } = await supabase
    .from('accomplishments')
    .select('*')
    .eq('user_id', targetRole.user_id)
    .eq('status', 'confirmed');

  if (accError) {
    throw new Error(`Failed to fetch accomplishments for user ${targetRole.user_id}`);
  }

  if (!accomplishments || accomplishments.length === 0) {
    return { skipped: true, reason: 'No confirmed accomplishments to score against.' };
  }

  // Get embedding for JD themes
  const jdThemesText = (targetRole.responsibility_themes || []).join(' ');
  let jdEmbedding: number[] = [];
  if (jdThemesText) {
    jdEmbedding = await getEmbedding(jdThemesText);
  }

  const reqSkills = new Set((targetRole.required_skills || []).map((s: string) => s.toLowerCase()));
  const prefSkills = new Set((targetRole.preferred_skills || []).map((s: string) => s.toLowerCase()));

  const matchesToInsert = [];

  for (const acc of accomplishments) {
    let reqOverlap = 0;
    let prefOverlap = 0;
    
    const accSkills = (acc.ats_keywords || []).map((s: string) => s.toLowerCase());
    for (const skill of accSkills) {
      if (reqSkills.has(skill)) reqOverlap++;
      if (prefSkills.has(skill)) prefOverlap++;
    }

    // Normalize overlap logic - just a simple ratio based on how many required skills exist
    const reqScore = reqSkills.size > 0 ? Math.min(1, reqOverlap / reqSkills.size) : 0;
    const prefScore = prefSkills.size > 0 ? Math.min(1, prefOverlap / prefSkills.size) : 0;

    let themeSimilarity = 0;
    if (jdEmbedding.length > 0 && acc.bullet_text) {
      const accEmbedding = await getEmbedding(acc.bullet_text);
      themeSimilarity = cosineSimilarity(jdEmbedding, accEmbedding);
    }

    // Recency weight: 1.0 for now, decays to 0.5 for 18 months old
    let recencyWeight = 1.0;
    if (acc.created_at) {
      const msDiff = Date.now() - new Date(acc.created_at).getTime();
      const monthsOld = msDiff / (1000 * 60 * 60 * 24 * 30);
      recencyWeight = Math.max(0.5, 1.0 - (monthsOld / 36)); // decays slowly over 3 years
    }

    const relevanceScore = 
      (0.5 * reqScore) + 
      (0.25 * prefScore) + 
      (0.15 * themeSimilarity) + 
      (0.10 * recencyWeight);

    matchesToInsert.push({
      accomplishment_id: acc.id,
      target_role_id: targetRoleId,
      relevance_score: relevanceScore,
      responsibility_theme_similarity: themeSimilarity,
      recency_weight: recencyWeight,
      computed_at: new Date().toISOString()
    });
  }

  // Insert matches (ignoring conflicts if they already exist, though we could upsert)
  const { error: insertError } = await supabase
    .from('accomplishment_role_matches')
    .upsert(matchesToInsert, { onConflict: 'accomplishment_id, target_role_id' });

  if (insertError) {
    throw new Error(`Failed to save role matches: ${insertError.message}`);
  }

  return { matched_count: matchesToInsert.length };
}
