import { GoogleGenAI, Type, Schema } from '@google/genai';
import { Job } from 'bullmq';
import { createAdminClient } from '../../src/lib/supabase-admin';
import { queues } from '../queues';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const model = 'gemini-2.5-flash';

const classificationSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    category: {
      type: Type.STRING,
      enum: [
        'direct_achievement',
        'participation_claim',
        'future_or_aspirational',
        'third_party_share',
        'sentiment_only',
        'ambiguous'
      ]
    },
    confidence: { type: Type.NUMBER },
    claim_summary: { type: Type.STRING },
    specificity_signals: { 
      type: Type.ARRAY,
      items: { type: Type.STRING }
    },
    reasoning_brief: { type: Type.STRING }
  },
  required: ['category', 'confidence', 'claim_summary', 'specificity_signals', 'reasoning_brief']
};

export async function processClaimClassification(job: Job) {
  const { rawPostId } = job.data;
  
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
    Analyze the following text and determine if it contains an achievement claim.
    
    Category definitions:
    - direct_achievement: First-person, past-tense, specific, falsifiable
    - participation_claim: First-person, past-tense, but passive/attendee framing
    - future_or_aspirational: Claim is about something not yet happened
    - third_party_share: Author is sharing/promoting someone else's achievement or event
    - sentiment_only: Achievement-adjacent vocabulary, no concrete claim
    - ambiguous: Genuinely unclear from text alone
    
    Source method: ${rawPost.source_method}
    Platform: ${rawPost.source_platform}
    
    Text:
    ${rawPost.raw_text}
  `;

  const response = await ai.models.generateContent({
    model,
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema: classificationSchema,
    }
  });

  const text = response.text || '';
  const result = JSON.parse(text);

  let sourceTrustMultiplier = 1.0;
  if (rawPost.source_method === 'manual_paste') sourceTrustMultiplier = 0.85;
  if (rawPost.source_method === 'file_upload') sourceTrustMultiplier = 0.90;

  const finalConfidence = result.confidence * sourceTrustMultiplier;

  if (result.category === 'direct_achievement' || result.category === 'participation_claim') {
    if (finalConfidence >= 0.5) {
      // It passes the bar. Enqueue to Stage 2: Bullet Generation
      await queues.aiExtraction.add('bullet-generation', {
        rawPostId,
        classification: result,
        finalConfidence
      });
      
      // Update raw_post status
      await supabase.from('raw_posts').update({ 
        processed: true, 
        has_signal: true 
      }).eq('id', rawPostId);
      
      return result;
    }
  }

  // If we get here, it's either discarded category or confidence too low.
  await supabase.from('raw_posts').update({ 
    processed: true, 
    has_signal: false 
  }).eq('id', rawPostId);

  return result;
}
