import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { jd_text, role_tag } = body;

    const roleId = crypto.randomUUID();

    // Mock parsed requirements from the Job Description
    const parsedRole = {
      id: roleId,
      jd_text: jd_text || null,
      role_tag: role_tag || 'developer',
      seniority: jd_text ? 'senior' : 'entry_level',
      required_skills: jd_text 
        ? ['React', 'Next.js', 'TypeScript', 'Supabase', 'Authentication']
        : ['React', 'TypeScript', 'CSS'],
      preferred_skills: jd_text 
        ? ['Tailwind CSS', 'PostgreSQL', 'RLS policies']
        : ['Git', 'REST APIs'],
      responsibility_themes: jd_text 
        ? ['frontend component design', 'session storage integration', 'relational schema migration']
        : ['frontend layout design'],
      ats_keywords: jd_text
        ? ['React', 'TypeScript', 'Next.js', 'Supabase', 'SQL']
        : ['React', 'CSS'],
      parsed_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    };

    return NextResponse.json({
      success: true,
      role_id: roleId,
      role: parsedRole,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
