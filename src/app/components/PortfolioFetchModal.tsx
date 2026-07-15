'use client'

import React from 'react';

interface PortfolioFetchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (count: number, pageTitle: string, fetchedAt: string) => void;
}

// ── Step state ─────────────────────────────────────────────────────────────────
type Step = 'input' | 'fetching' | 'done' | 'error';

export default function PortfolioFetchModal({ isOpen, onClose, onSuccess }: PortfolioFetchModalProps) {
  const [url, setUrl] = React.useState('');
  const [attested, setAttested] = React.useState(false);
  const [step, setStep] = React.useState<Step>('input');
  const [errorMsg, setErrorMsg] = React.useState('');
  const [result, setResult] = React.useState<{ count: number; pageTitle: string; fetchedAt: string } | null>(null);

  // Progress ticker – cycles through dots while fetching
  const [dots, setDots] = React.useState('');
  React.useEffect(() => {
    if (step !== 'fetching') return;
    const id = setInterval(() => setDots(d => (d.length >= 3 ? '' : d + '.')), 400);
    return () => clearInterval(id);
  }, [step]);

  // Reset when modal is closed
  React.useEffect(() => {
    if (!isOpen) {
      setUrl('');
      setAttested(false);
      setStep('input');
      setErrorMsg('');
      setResult(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const isValidUrl = (raw: string) => {
    try {
      const u = new URL(raw);
      return u.protocol === 'http:' || u.protocol === 'https:';
    } catch {
      return false;
    }
  };

  const canSubmit = isValidUrl(url) && attested && step === 'input';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    setStep('fetching');
    setErrorMsg('');

    try {
      const res = await fetch('/api/posts/fetch-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, ownership_attested: attested }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setErrorMsg(data.error || 'Fetch failed. Please check the URL and try again.');
        setStep('error');
        return;
      }

      setResult({ count: data.ingested_count, pageTitle: data.page_title, fetchedAt: data.fetched_at });
      setStep('done');
      onSuccess(data.ingested_count, data.page_title, data.fetched_at);
    } catch {
      setErrorMsg('Network request failed. Please check your connection.');
      setStep('error');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/75 backdrop-blur-[4px] p-6">
      <div className="w-full max-w-lg bg-paper-warm border border-hairline flex flex-col max-h-[90vh] animate-card-entry">

        {/* Header */}
        <div className="p-6 border-b border-hairline flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-xs uppercase font-mono text-neutral">INGESTION GATEWAY / URL FETCH</span>
            <h3 className="font-fraunces text-2xl font-bold text-ink uppercase">Portfolio Analyser</h3>
          </div>
          <button
            onClick={onClose}
            className="text-neutral hover:text-ink cursor-pointer"
            disabled={step === 'fetching'}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" strokeLinejoin="miter">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">

          {/* ── Input step ─────────────────────────────────────────────────── */}
          {(step === 'input' || step === 'error') && (
            <form onSubmit={handleSubmit} className="flex flex-col gap-6">

              {/* Explainer banner */}
              <div className="p-4 bg-paper border border-hairline flex gap-3">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" strokeLinejoin="miter" className="text-neutral mt-0.5 shrink-0">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                <p className="text-xs text-neutral leading-relaxed">
                  Paste the public URL of your portfolio, personal website, or Behance/Dribbble profile.
                  Tracck will fetch the page <strong className="text-ink">once, right now</strong>, extract
                  your project descriptions and bio text, and store them as raw posts — nothing else is saved.
                  No account connection, no recurring sync.
                </p>
              </div>

              {/* URL input */}
              <div className="form-group">
                <label htmlFor="portfolioUrl">Portfolio / Website URL</label>
                <div className="flex items-center border border-hairline focus-within:border-ink transition-colors bg-paper">
                  <span className="pl-3 text-neutral">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" strokeLinejoin="miter">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="2" y1="12" x2="22" y2="12" />
                      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                    </svg>
                  </span>
                  <input
                    id="portfolioUrl"
                    type="url"
                    placeholder="https://yourportfolio.com"
                    value={url}
                    onChange={e => setUrl(e.target.value)}
                    required
                    className="flex-1 text-sm font-archivo bg-transparent p-3 outline-none placeholder:text-neutral/50"
                  />
                  {isValidUrl(url) && (
                    <span className="pr-3 text-[#1F6F4A]">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="square" strokeLinejoin="miter">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </span>
                  )}
                </div>
                {url && !isValidUrl(url) && (
                  <span className="text-xs font-mono text-clay mt-1.5 block">
                    Must be a full URL starting with https://
                  </span>
                )}
              </div>

              {/* Error message */}
              {step === 'error' && (
                <div className="p-4 border border-clay/40 bg-clay/5 text-clay text-xs font-mono flex gap-2 items-start">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" strokeLinejoin="miter" className="mt-0.5 shrink-0">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Attestation */}
              <div className="flex items-start gap-3 p-4 bg-paper border border-hairline">
                <input
                  type="checkbox"
                  id="portfolioAttest"
                  checked={attested}
                  onChange={e => setAttested(e.target.checked)}
                  className="mt-1 cursor-pointer w-4 h-4 border border-hairline accent-ink"
                />
                <label htmlFor="portfolioAttest" className="text-xs text-neutral leading-relaxed cursor-pointer select-none">
                  I confirm this is my own portfolio or website. I authorise Tracck to fetch the page once
                  to extract my professional work descriptions. No credentials are stored.
                </label>
              </div>

              {/* Actions */}
              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-3 border border-hairline hover:border-ink text-xs font-semibold uppercase tracking-wider font-mono text-ink bg-transparent cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!canSubmit}
                  className="flex-1 py-3 bg-ink hover:bg-[#2D2B26] text-paper text-xs font-semibold uppercase tracking-wider font-mono cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  Analyse Portfolio
                </button>
              </div>
            </form>
          )}

          {/* ── Fetching step ───────────────────────────────────────────────── */}
          {step === 'fetching' && (
            <div className="flex flex-col items-center justify-center gap-6 py-12">
              {/* Animated scanner */}
              <div className="relative w-16 h-16 flex items-center justify-center">
                <div className="absolute inset-0 border-2 border-ink/10 rounded-full" />
                <div className="absolute inset-0 border-t-2 border-ink rounded-full animate-spin" style={{ animationDuration: '1s' }} />
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" strokeLinejoin="miter" className="text-ink">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="2" y1="12" x2="22" y2="12" />
                  <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                </svg>
              </div>
              <div className="text-center flex flex-col gap-2">
                <span className="font-mono text-xs uppercase text-neutral tracking-wider">
                  ANALYSING PORTFOLIO{dots}
                </span>
                <p className="text-sm text-ink font-archivo font-medium truncate max-w-xs">{url}</p>
                <p className="text-xs text-neutral">Fetching page · Stripping markup · Extracting segments</p>
              </div>
            </div>
          )}

          {/* ── Done step ───────────────────────────────────────────────────── */}
          {step === 'done' && result && (
            <div className="flex flex-col items-center gap-6 py-8">
              <div className="w-14 h-14 border border-[#1F6F4A] flex items-center justify-center">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#1F6F4A" strokeWidth="2.5" strokeLinecap="square" strokeLinejoin="miter">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <div className="text-center flex flex-col gap-1">
                <h4 className="font-fraunces text-xl font-bold text-ink">Ingestion Complete</h4>
                <p className="text-sm text-neutral font-archivo">{result.pageTitle}</p>
              </div>
              <div className="w-full grid grid-cols-2 gap-4">
                <div className="p-4 bg-paper border border-hairline flex flex-col gap-1">
                  <span className="text-xs font-mono text-neutral uppercase">Segments Found</span>
                  <span className="font-fraunces text-3xl font-bold text-ink">{result.count}</span>
                </div>
                <div className="p-4 bg-paper border border-hairline flex flex-col gap-1">
                  <span className="text-xs font-mono text-neutral uppercase">Source</span>
                  <span className="text-xs font-mono text-ink truncate">{new URL(url).hostname}</span>
                </div>
              </div>
              <p className="text-xs text-neutral font-mono text-center">
                Content is now available in your Ledger. Run claim extraction to transform segments into verified accomplishments.
              </p>
              <button
                onClick={onClose}
                className="w-full py-3 bg-ink hover:bg-[#2D2B26] text-paper text-xs font-semibold uppercase tracking-wider font-mono cursor-pointer"
              >
                Close
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
