/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import { requireAuth } from '@/lib/auth';
import { ApiError, errorResponse, successResponse } from '@/lib/errors';
import { createAdminClient } from '@/lib/supabase-admin';
import { inngest } from '@/inngest/client';

export async function POST(request: Request) {
  try {
    const { user_id } = await requireAuth(request);
    const body = await request.json();
    const { platform, text, source_method, ownership_attested, posted_at_is_approximate } = body;

    if (!ownership_attested) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'Ownership attestation is required');
    }

    let count = 0;
    const postsToInsert = [];
    const timestamp = new Date().toISOString();

    if (source_method === 'manual_paste' && text) {
      // Split by double blank lines
      const segments = text.split(/\n\s*\n/).filter((segment: string) => segment.trim().length > 0);
      count = segments.length;
      
      for (let i = 0; i < segments.length; i++) {
        postsToInsert.push({
          user_id,
          source_platform: platform,
          source_method,
          raw_text: segments[i],
          ownership_attested,
          posted_at_is_approximate: posted_at_is_approximate ?? true,
          fetched_at: timestamp,
          segment_index: i,
        });
      }
    } else {
      count = 1; // screenshot or single post file
      postsToInsert.push({
        user_id,
        source_platform: platform,
        source_method,
        raw_text: text || '',
        ownership_attested,
        posted_at_is_approximate: posted_at_is_approximate ?? true,
        fetched_at: timestamp,
        segment_index: 0,
      });
    }

    const supabase = createAdminClient();
    const { data: insertedPosts, error: insertError } = await supabase
      .from('raw_posts')
      .insert(postsToInsert)
      .select('id');

    if (insertError) {
      console.error('Failed to insert pasted posts:', insertError);
      throw new ApiError(500, 'DATABASE_ERROR', 'Failed to save posts to database.');
    }

    if (insertedPosts) {
      for (const post of insertedPosts) {
        await inngest.send({
          name: 'ai/claim.classify',
          data: { rawPostId: post.id }
        });
      }
    }

    // Return success payload matching database updates
    return successResponse({
      ingested_count: count,
      source_method,
      platform,
      user_id,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    if (err instanceof ApiError) return errorResponse(err);
    return errorResponse(new ApiError(500, 'INTERNAL_ERROR', err.message || 'Internal Server Error'));
  }
}
