import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { platform, text, source_method, ownership_attested, posted_at_is_approximate } = body;

    if (!ownership_attested) {
      return NextResponse.json({ error: 'Ownership attestation is required' }, { status: 400 });
    }

    let count = 0;
    if (source_method === 'manual_paste' && text) {
      // Split by double blank lines
      const segments = text.split(/\n\s*\n/).filter((segment: string) => segment.trim().length > 0);
      count = segments.length;
    } else {
      count = 1; // screenshot or single post file
    }

    // Return mock success payload matching database updates
    return NextResponse.json({
      success: true,
      ingested_count: count,
      source_method,
      platform,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
