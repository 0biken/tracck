import { Job } from 'bullmq';
import { createAdminClient } from '../../src/lib/supabase-admin';

export async function processResumeBuild(job: Job) {
  const { targetRoleId, resumeId, userId: _userId } = job.data;

  const supabase = createAdminClient();
  
  // Fetch top 5 matched accomplishments for this role
  const { data: matches, error: matchError } = await supabase
    .from('accomplishment_role_matches')
    .select('*, accomplishments(*)')
    .eq('target_role_id', targetRoleId)
    .order('relevance_score', { ascending: false })
    .limit(5);

  if (matchError) {
    throw new Error(`Failed to fetch matches for role ${targetRoleId}`);
  }

  // Pure selection: we are not rephrasing for this iteration (safe/shippable version).
  // In a real implementation, we'd compile these into a PDF or DOCX format here.
  
  const mockPdfUrl = `/exports/tailored_resume_${targetRoleId}.pdf`;

  // We could also store the selected accomplishment IDs in a join table
  // if we wanted to track exactly which bullets made it into which resume.
  // For now, updating the resumes table with the mock export URL is sufficient.

  const { error: updateError } = await supabase
    .from('resumes')
    .update({
      pdf_export_url: mockPdfUrl,
      // If there's a status field, we'd set it to 'completed'
    })
    .eq('id', resumeId);

  if (updateError) {
    throw new Error(`Failed to update resume ${resumeId}: ${updateError.message}`);
  }

  return { 
    resume_id: resumeId, 
    selected_bullets: matches?.length || 0,
    pdf_url: mockPdfUrl
  };
}
