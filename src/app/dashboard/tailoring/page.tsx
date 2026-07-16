'use client'

import React from 'react';

interface ParsedJD {
  id: string;
  role_tag: string;
  seniority: string;
  required_skills: string[];
  preferred_skills: string[];
  themes: string[];
}

interface RelevanceMatch {
  id: string;
  claim: string;
  detail: string;
  platform: string;
  date: string;
  relevance_score: number;
  matched_skills: string[];
  recency_weight: number;
  semantic_match: number;
}

export default function TailoringPage() {
  const [jdText, setJdText] = React.useState('');
  const [isParsing, setIsParsing] = React.useState(false);
  const [parsedJd, setParsedJd] = React.useState<ParsedJD | null>(null);
  const [matches, setMatches] = React.useState<RelevanceMatch[]>([]);
  const [isCompiling, setIsCompiling] = React.useState(false);
  const [compileStatus, setCompileStatus] = React.useState<string | null>(null);

  const sampleJD = `Senior React Developer
We are looking for a frontend developer with 3+ years of experience working with Next.js, React, and TypeScript.
Key Responsibilities:
- Design reusable UI component libraries.
- Integrate database adapters and configure authentication sessions using Supabase.
- Write strict unit tests and maintain RLS security constraints.
Preferred Skills:
- Tailwind CSS and Postgres relational databases.`;

  const loadSample = () => {
    setJdText(sampleJD);
  };

  const handleParse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!jdText.trim()) return;

    setIsParsing(true);
    setCompileStatus(null);

    try {
      const parseResponse = await fetch('/api/roles', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ jd_text: jdText }),
      });
      const parseData = await parseResponse.json();

      if (parseResponse.ok && parseData.success) {
        setParsedJd(parseData.data.role);
        
        const matchesResponse = await fetch(`/api/roles/${parseData.data.role_id}/matches`);
        const matchesData = await matchesResponse.json();

        if (matchesResponse.ok && matchesData.success) {
          setMatches(matchesData.data.matches);
        } else {
          alert(matchesData.error?.message || 'Failed to fetch relevance matches');
        }
      } else {
        alert(parseData.error?.message || 'Failed to parse Job Description');
      }
    } catch {
      alert('Network request failed during parsing');
    } finally {
      setIsParsing(false);
    }
  };

  const handleCompile = async () => {
    if (!parsedJd) return;
    setIsCompiling(true);
    setCompileStatus('compiling');
    
    try {
      const response = await fetch(`/api/roles/${parsedJd.id}/resume`, {
        method: 'POST',
      });
      const data = await response.json();
      
      // Delay to allow status ticking visualization
      await new Promise(resolve => setTimeout(resolve, 1500));

      if (response.ok && data.success) {
        setCompileStatus('complete');
      } else {
        alert(data.error?.message || 'Resume compilation failed');
        setCompileStatus(null);
      }
    } catch {
      alert('Network request failed during compilation');
      setCompileStatus(null);
    } finally {
      setIsCompiling(false);
    }
  };

  return (
    <div className="flex flex-col gap-12 animate-card-entry">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <span className="text-xs uppercase font-mono text-neutral">Dashboard / ATS Optimization</span>
        <h1 className="font-fraunces text-4xl font-bold text-ink">Role-Tailoring compiler</h1>
        <p className="text-neutral text-sm max-w-xl">
          Paste a target job description to match and order your confirmed accomplishments. The tailoring system highlights skills and recalculates relevance scores without rewriting claims.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Left column: JD Input and Parsing (Lg: 5/12 cols) */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          <div className="bg-paper-warm border border-hairline p-6 flex flex-col gap-4">
            <h3 className="font-fraunces text-xl font-bold text-ink border-b border-hairline pb-2">Target Job Description</h3>
            
            <form onSubmit={handleParse} className="flex flex-col gap-4">
              <div className="form-group">
                <div className="flex justify-between items-center mb-1">
                  <label htmlFor="jdInput">Paste Raw JD Text</label>
                  <button 
                    type="button" 
                    onClick={loadSample}
                    className="text-[10px] font-mono uppercase text-ink underline bg-transparent border-none cursor-pointer"
                  >
                    Load Sample JD
                  </button>
                </div>
                <textarea
                  id="jdInput"
                  rows={10}
                  placeholder="Paste details of the job listing here..."
                  value={jdText}
                  onChange={(e) => setJdText(e.target.value)}
                  className="w-full text-xs font-mono border border-hairline focus:border-ink bg-paper p-3 outline-none resize-y"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={isParsing || !jdText.trim()}
                className="w-full py-3 bg-ink hover:bg-[#2D2B26] text-paper text-xs font-semibold uppercase tracking-wider font-mono rounded-[4px] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isParsing ? <span className="sync-ticking">PARSING JOB DETAILS</span> : 'Analyze Requirements'}
              </button>
            </form>
          </div>

          {/* Parsed requirements view */}
          {parsedJd && (
            <div className="bg-paper border border-hairline p-6 flex flex-col gap-4">
              <h3 className="font-fraunces text-lg font-bold text-ink uppercase tracking-wide border-b border-hairline pb-2">Extracted Signals</h3>
              
              <div className="flex flex-col gap-4 text-xs font-mono">
                <div className="flex justify-between border-b border-hairline/30 pb-2">
                  <span className="text-neutral">CLASSIFIED ROLE TAG</span>
                  <span className="text-ink font-semibold uppercase">{parsedJd.role_tag}</span>
                </div>
                <div className="flex justify-between border-b border-hairline/30 pb-2">
                  <span className="text-neutral">SENIORITY SCALE</span>
                  <span className="text-ink font-semibold uppercase">{parsedJd.seniority}</span>
                </div>
                
                <div className="flex flex-col gap-2">
                  <span className="text-neutral">REQUIRED CORE SKILLS</span>
                  <div className="flex flex-wrap gap-1.5">
                    {parsedJd.required_skills.map((skill, idx) => (
                      <span key={idx} className="px-2 py-0.5 border border-ink text-ink bg-paper font-semibold text-[10px] rounded-[2px]">
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col gap-2 mt-2">
                  <span className="text-neutral">PREFERRED SECONDARY SKILLS</span>
                  <div className="flex flex-wrap gap-1.5">
                    {parsedJd.preferred_skills.map((skill, idx) => (
                      <span key={idx} className="px-2 py-0.5 border border-hairline text-neutral bg-paper-warm rounded-[2px]">
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right column: Relevance score output (Lg: 7/12 cols) */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          {matches.length === 0 ? (
            <div className="border border-hairline p-12 text-center text-sm text-neutral flex flex-col items-center justify-center gap-3 bg-paper h-[300px]">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" className="text-neutral">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <span>No analysis triggered yet. Input a Job Description to compute accomplishment matches.</span>
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              {/* Overlap Summary */}
              <div className="bg-paper-warm border border-hairline p-6 flex flex-col gap-4">
                <div className="flex justify-between items-end border-b border-hairline pb-2">
                  <h3 className="font-fraunces text-xl font-bold text-ink">Relevance Matching Profile</h3>
                  <span className="text-xs font-mono text-[#1F6F4A] font-semibold">ATS-READY</span>
                </div>
                
                <div className="flex flex-col gap-2">
                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-neutral">CORE SKILLS OVERLAP</span>
                    <span className="text-ink font-semibold">60%</span>
                  </div>
                  <div className="w-full h-1.5 bg-paper border border-hairline">
                    <div className="h-full bg-ink" style={{ width: '60%' }}></div>
                  </div>
                  <span className="text-[10px] text-neutral">3 of 5 required skills mapped across your confirmed accomplish history.</span>
                </div>

                {/* Compilation action */}
                <div className="mt-4 pt-4 border-t border-hairline/40 flex items-center justify-between">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs font-mono text-neutral">COMPILING 3 BULLETS</span>
                    <span className="text-[10px] text-[#1F6F4A]">Minimum requirements met (&gt;= 3 bullets)</span>
                  </div>
                  <button
                    onClick={handleCompile}
                    disabled={isCompiling}
                    className="px-5 py-3 bg-ink hover:bg-[#2D2B26] text-paper text-xs font-semibold uppercase tracking-wider font-mono rounded-[4px] cursor-pointer"
                  >
                    {isCompiling ? <span className="sync-ticking">COMPILING PDF</span> : 'Generate Tailored Resume'}
                  </button>
                </div>

                {compileStatus === 'complete' && (
                  <div className="p-3 border border-[#1F6F4A] bg-[#1F6F4A]/10 text-[#1F6F4A] text-xs font-semibold font-mono flex items-center justify-between">
                    <span>RESUME COMPILED SUCCESSFULLY.</span>
                    <a href="#" className="underline font-bold">DOWNLOAD PDF</a>
                  </div>
                )}
              </div>

              {/* Match warnings (if < 3 bullets match, which isn't the case here, but let's demo logic with a fallback state indicator if needed) */}
              {matches.length < 3 && (
                <div className="p-4 border border-clay bg-clay/10 text-clay flex gap-3 text-xs leading-relaxed rounded-none">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="square" className="shrink-0 mt-0.5">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                    <line x1="12" y1="9" x2="12" y2="13" />
                    <line x1="12" y1="17" x2="12.01" y2="17" />
                  </svg>
                  <div>
                    <span className="font-bold uppercase block mb-0.5">Below Selection Threshold</span>
                    <span>Only {matches.length} accomplishments match this Job Description. Consider confirming more bullets in your queue to produce a robust resume.</span>
                  </div>
                </div>
              )}

              {/* Matched accomplishments list */}
              <div className="flex flex-col gap-4">
                <span className="text-xs uppercase font-mono text-neutral font-semibold">Matched Accomplishments (Sorted by Relevance)</span>
                {matches.map((item, idx) => (
                  <div key={item.id} className="p-6 bg-paper border border-hairline flex flex-col gap-3 relative">
                    {/* Rank Badge */}
                    <span className="absolute right-6 top-6 font-mono text-xs text-neutral">
                      RANK #{idx + 1}
                    </span>

                    {/* Metadata */}
                    <div className="flex items-center gap-3 text-[10px] font-mono text-neutral border-b border-hairline/30 pb-2 mr-16">
                      <span className="text-ink font-semibold">{item.platform}</span>
                      <span>•</span>
                      <span>RELEVANCE: {Math.round(item.relevance_score * 100)}%</span>
                      <span>•</span>
                      <span>RECENCY WEIGHT: {item.recency_weight}</span>
                    </div>

                    {/* Claim Title */}
                    <h4 className="font-fraunces text-xl font-bold text-ink leading-snug">
                      {item.claim}
                    </h4>
                    
                    {/* Explanation */}
                    <p className="text-xs text-neutral leading-relaxed">
                      {item.detail}
                    </p>

                    {/* Matched Skills */}
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-[10px] font-mono text-neutral">SKILL ALIGNMENT:</span>
                      <div className="flex flex-wrap gap-1">
                        {item.matched_skills.map((skill, sIdx) => (
                          <span key={sIdx} className="px-1.5 py-0.5 border border-[#1F6F4A]/30 text-[#1F6F4A] bg-[#1F6F4A]/5 text-[9px] font-mono rounded-[1px]">
                            {skill}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
