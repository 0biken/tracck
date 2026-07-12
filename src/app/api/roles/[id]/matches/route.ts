import { NextResponse } from 'next/server';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Mock confirmed items mapped against this role's relevance scoring
    const mockMatches = [
      {
        id: 'm1',
        platform: 'GITHUB — 2026.03.11',
        date: '2026.03.11',
        claim: 'Shipped Next.js routing and supabase SSR integration',
        detail: 'Implemented Supabase SSR authentication across sign-up, login, and session middleware for the Tracck platform.',
        relevance_score: 0.92,
        matched_skills: ['Next.js', 'Supabase', 'Authentication'],
        recency_weight: 0.98,
        semantic_match: 0.89,
      },
      {
        id: 'm2',
        platform: 'GITHUB — 2026.02.10',
        date: '2026.02.10',
        claim: 'Refactored database schema constraints and RLS policies',
        detail: 'Wrote database migrations 001 through 009 covering users, raw_posts, accomplishments, and RLS tables.',
        relevance_score: 0.84,
        matched_skills: ['PostgreSQL', 'RLS policies'],
        recency_weight: 0.91,
        semantic_match: 0.81,
      },
      {
        id: 'm3',
        platform: 'LINKEDIN — 2026.02.28',
        date: '2026.02.28',
        claim: 'Designed complete custom components library',
        detail: 'Created 32 components, layout grids, spacing units, and design token configurations matching corporate guidelines.',
        relevance_score: 0.79,
        matched_skills: ['React', 'Tailwind CSS'],
        recency_weight: 0.94,
        semantic_match: 0.75,
      },
    ];

    return NextResponse.json({
      success: true,
      role_id: id,
      matches: mockMatches,
      insufficient_content: false, // Check threshold constraint (matches.length < 3)
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
