/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import { requireAuth } from '@/lib/auth';
import { ApiError, errorResponse, successResponse } from '@/lib/errors';
import { createAdminClient } from '@/lib/supabase-admin';
import { inngest } from '@/inngest/client';

export async function POST(request: Request) {
  try {
    const { user_id } = await requireAuth(request);
    const body = await request.json();
    const { jd_text, role_tag } = body;

    const roleId = crypto.randomUUID();

    const rawRole = {
      id: roleId,
      user_id,
      jd_text: jd_text || null,
      role_tag: role_tag || 'developer',
      created_at: new Date().toISOString(),
    };

    const supabase = createAdminClient();
    const { error: insertError } = await supabase
      .from('target_roles')
      .insert(rawRole);

    if (insertError) {
      console.error('Failed to insert target role:', insertError);
      throw new ApiError(500, 'DATABASE_ERROR', 'Failed to save role to database.');
    }

    // Enqueue for JD parsing
    await inngest.send({
      name: 'ai/jd.parse',
      data: { targetRoleId: roleId }
    });

    return successResponse({
      role_id: roleId,
      user_id,
      role: rawRole,
    });
  } catch (err: any) {
    if (err instanceof ApiError) return errorResponse(err);
    return errorResponse(new ApiError(500, 'INTERNAL_ERROR', err.message || 'Internal Server Error'));
  }
}
