/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import { requireAuth } from '@/lib/auth';
import { ApiError, errorResponse, successResponse } from '@/lib/errors';
import { createAdminClient } from '@/lib/supabase-admin';
import { inngest } from '../../../../../inngest/client';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user_id } = await requireAuth(request);
    const { id } = await params;

    const resumeId = crypto.randomUUID();
    const pdfUrl = `/exports/tailored_resume_${id}.pdf`;

    const resumeData = {
      id: resumeId,
      user_id,
      target_role_id: id,
      resume_name: 'Tailored Resume', // Provide a default or dynamic name
      pdf_export_url: null, // Will be set by the background worker
      created_at: new Date().toISOString(),
    };

    const supabase = createAdminClient();
    const { error: insertError } = await supabase
      .from('resumes')
      .insert(resumeData);

    if (insertError) {
      console.error('Failed to insert resume:', insertError);
      throw new ApiError(500, 'DATABASE_ERROR', 'Failed to save resume to database.');
    }

    // Enqueue for resume building
    await inngest.send({
      name: 'resume/build',
      data: {
        targetRoleId: id,
        resumeId,
        userId: user_id
      }
    });

    return successResponse({
      resume_id: resumeId,
      target_role_id: id,
      user_id,
      status: 'pending',
      message: 'Resume build enqueued successfully'
    });
  } catch (err: any) {
    if (err instanceof ApiError) return errorResponse(err);
    return errorResponse(new ApiError(500, 'INTERNAL_ERROR', err.message || 'Internal Server Error'));
  }
}
