/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import { requireAuth } from '@/lib/auth';
import { ApiError, errorResponse, successResponse } from '@/lib/errors';
import { createAdminClient } from '@/lib/supabase-admin';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user_id } = await requireAuth(request);
    const { id } = await params;

    const supabase = createAdminClient();
    
    // We join accomplishment_role_matches with accomplishments to get the full detail
    const { data: dbMatches, error } = await supabase
      .from('accomplishment_role_matches')
      .select(`
        *,
        accomplishments (
          id,
          user_id,
          bullet_text,
          ats_keywords,
          claim_category
        )
      `)
      .eq('target_role_id', id)
      .order('relevance_score', { ascending: false });

    if (error) {
      console.error('Failed to fetch matches:', error);
      throw new ApiError(500, 'DATABASE_ERROR', 'Failed to fetch relevance matches.');
    }

    // Filter to only include the user's own accomplishments (since admin bypasses RLS)
    const validMatches = dbMatches?.filter((m: any) => m.accomplishments?.user_id === user_id) || [];

    // Map to the shape expected by the frontend
    const mappedMatches = validMatches.map((m: any) => ({
      id: m.id,
      platform: 'SYSTEM — ' + new Date(m.computed_at).toISOString().split('T')[0].replace(/-/g, '.'),
      date: new Date(m.computed_at).toISOString().split('T')[0].replace(/-/g, '.'),
      claim: m.accomplishments?.bullet_text || 'Unknown Claim',
      detail: m.accomplishments?.bullet_text || '',
      relevance_score: m.relevance_score,
      matched_skills: m.accomplishments?.ats_keywords || [],
      recency_weight: m.recency_weight || 0.5,
      semantic_match: m.responsibility_theme_similarity || 0.5,
    }));

    return successResponse({
      role_id: id,
      user_id,
      matches: mappedMatches,
      insufficient_content: mappedMatches.length < 3,
    });
  } catch (err: any) {
    if (err instanceof ApiError) return errorResponse(err);
    return errorResponse(new ApiError(500, 'INTERNAL_ERROR', err.message || 'Internal Server Error'));
  }
}
