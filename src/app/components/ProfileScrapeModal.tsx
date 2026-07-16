'use client'

import React from 'react';
import { detectPlatform, PLATFORM_META, type ScrapePlatform } from '@/lib/scrapers/platform';

// ── Types ──────────────────────────────────────────────────────────────────────

interface ProfileScrapeModalProps {
  platformId: ScrapePlatform;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (count: number, title: string, fetchedAt: string) => void;
}

type Tab = 'scrape' | 'archive';
type Step = 'idle' | 'stage1' | 'stage2' | 'stage3' | 'done' | 'error';

// ── Stage labels shown during the animated progress ───────────────────────────
const STAGE_LABELS: Record<1 | 2 | 3, string> = {
  1: 'Connecting to page',
  2: 'Rendering JavaScript',
  3: 'Extracting content',
};

// ── Platform icon map (simple SVG paths keyed by platform id) ─────────────────
function PlatformIcon({ platform, size = 16 }: { platform: ScrapePlatform; size?: number }) {
  const color = 'currentColor';
  if (platform === 'linkedin') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
        <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/>
        <rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/>
      </svg>
    );
  }
  if (platform === 'instagram') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round">
        <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
        <circle cx="12" cy="12" r="4"/>
        <circle cx="17.5" cy="6.5" r="1" fill={color} stroke="none"/>
      </svg>
    );
  }
  if (platform === 'twitter') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
      </svg>
    );
  }
  if (platform === 'behance') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
        <path d="M7.799 5.698c.589 0 1.12.051 1.606.156a3.7 3.7 0 0 1 1.24.51c.345.237.612.557.804.957.19.399.284.873.284 1.42 0 .608-.145 1.12-.436 1.53-.29.41-.72.748-1.284 1.01.772.22 1.35.602 1.735 1.14.386.543.578 1.194.578 1.957 0 .598-.12 1.12-.35 1.563a3.26 3.26 0 0 1-.957 1.12 4.264 4.264 0 0 1-1.39.67 5.868 5.868 0 0 1-1.635.228H1V5.698h6.799zm-.45 4.847c.493 0 .898-.12 1.215-.36.317-.24.474-.616.474-1.13 0-.29-.05-.534-.152-.73a1.22 1.22 0 0 0-.415-.47 1.73 1.73 0 0 0-.608-.254 3.39 3.39 0 0 0-.757-.08H3.826v3.024h3.522zm.195 5.068c.285 0 .554-.03.81-.087.256-.056.48-.148.666-.276.19-.128.34-.299.452-.514.11-.215.166-.487.166-.817 0-.65-.188-1.116-.563-1.398-.375-.282-.875-.423-1.498-.423H3.826v3.515h3.718zm9.577-6.077c-.44 0-.813.068-1.12.202a2.33 2.33 0 0 0-.783.548 2.26 2.26 0 0 0-.455.8 3.09 3.09 0 0 0-.15.957h4.866c-.056-.857-.3-1.505-.73-1.944-.43-.44-1.026-.563-1.628-.563zm.05-1.98c.664 0 1.267.11 1.81.33.543.218 1.006.528 1.388.93.383.4.675.883.878 1.443.203.558.304 1.177.304 1.855v.785H15.26c.044.95.31 1.666.797 2.147.488.48 1.163.722 2.025.722.547 0 1.025-.06 1.433-.18.41-.12.771-.267 1.084-.44v1.803a5.77 5.77 0 0 1-1.25.43 7.24 7.24 0 0 1-1.548.148c-.72 0-1.368-.112-1.946-.335a4.135 4.135 0 0 1-1.483-.975 4.31 4.31 0 0 1-.939-1.573c-.217-.622-.326-1.327-.326-2.115 0-.757.1-1.45.302-2.078.202-.63.497-1.17.886-1.62a4.02 4.02 0 0 1 1.413-.99 4.8 4.8 0 0 1 1.892-.356z"/>
      </svg>
    );
  }
  // Generic globe for other platforms
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="12" r="10"/>
      <line x1="2" y1="12" x2="22" y2="12"/>
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
    </svg>
  );
}

// ── Archive download instructions per platform ────────────────────────────────
const ZIP_INSTRUCTIONS: Record<string, { steps: string[]; filename: string }> = {
  linkedin: {
    filename: 'LinkedIn_Data_Export.zip',
    steps: [
      'Go to linkedin.com → Me → Settings & Privacy',
      'Click "Data privacy" → "Get a copy of your data"',
      'Select "Posts" (and optionally Articles)',
      'Click "Request archive" — LinkedIn emails you a link within minutes',
      'Download the ZIP and upload it here',
    ],
  },
  instagram: {
    filename: 'instagram-XXXXXXXX.zip',
    steps: [
      'Open Instagram → Profile → Menu (☰) → Your activity',
      'Tap "Download your information" → Download or transfer information',
      'Select "Some of your information" → check Posts',
      'Choose "Download to device" → JSON format → Select date range → Create files',
      'Download the ZIP when ready and upload it here',
    ],
  },
  twitter: {
    filename: 'twitter-XXXXXXXX.zip',
    steps: [
      'Go to x.com → Settings → Your Account',
      'Click "Download an archive of your data"',
      'Verify your identity when prompted',
      'X will email you when your archive is ready (can take up to 24h)',
      'Download the ZIP and upload it here',
    ],
  },
};

// ── Component ──────────────────────────────────────────────────────────────────

export default function ProfileScrapeModal({
  platformId,
  isOpen,
  onClose,
  onSuccess,
}: ProfileScrapeModalProps) {
  const meta = PLATFORM_META[platformId];

  const [tab, setTab] = React.useState<Tab>(meta.scrapable ? 'scrape' : 'archive');
  const [url, setUrl] = React.useState('');
  const [archiveFile, setArchiveFile] = React.useState<File | null>(null);
  const [attested, setAttested] = React.useState(false);
  const [step, setStep] = React.useState<Step>('idle');
  const [errorMsg, setErrorMsg] = React.useState('');
  const [tip, setTip] = React.useState('');
  const [result, setResult] = React.useState<{ count: number; title: string; fetchedAt: string } | null>(null);
  const [dots, setDots] = React.useState('');
  const [currentStage, setCurrentStage] = React.useState<1 | 2 | 3>(1);

  // Animate dots while loading
  React.useEffect(() => {
    if (!['stage1', 'stage2', 'stage3'].includes(step)) return;
    const id = setInterval(() => setDots(d => (d.length >= 3 ? '' : d + '.')), 380);
    return () => clearInterval(id);
  }, [step]);

  // Reset on close
  React.useEffect(() => {
    if (!isOpen) {
      const timeout = setTimeout(() => {
        setTab(meta.scrapable ? 'scrape' : 'archive');
        setUrl('');
        setArchiveFile(null);
        setAttested(false);
        setStep('idle');
        setErrorMsg('');
        setTip('');
        setResult(null);
        setCurrentStage(1);
      }, 0);
      return () => clearTimeout(timeout);
    }
  }, [isOpen, meta.scrapable]);

  if (!isOpen) return null;

  const isValidUrl = (raw: string) => {
    try {
      const u = new URL(raw);
      return u.protocol === 'http:' || u.protocol === 'https:';
    } catch { return false; }
  };

  // Detect platform from URL as user types and show mismatch warning
  const detectedFromUrl = url ? detectPlatform(url) : null;
  const urlMismatch = detectedFromUrl && detectedFromUrl !== 'generic' && detectedFromUrl !== platformId;

  const canScrape = isValidUrl(url) && attested && step === 'idle';
  const canImport = !!archiveFile && attested && step === 'idle';

  // ── Simulate stage progression ─────────────────────────────────────────────
  async function progressStages() {
    setCurrentStage(1); setStep('stage1');
    await delay(900);
    setCurrentStage(2); setStep('stage2');
    await delay(800);
    setCurrentStage(3); setStep('stage3');
  }

  const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

  // ── Handle profile URL scrape ──────────────────────────────────────────────
  const handleScrape = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canScrape) return;
    setErrorMsg(''); setTip('');
    await progressStages();

    try {
      const res = await fetch('/api/posts/scrape-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, ownership_attested: true }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setErrorMsg(data.error?.message ?? 'Scrape failed. Please try again.');
        setTip(data.error?.details?.tip ?? '');
        setStep('error');
        return;
      }

      setResult({ count: data.data.ingested_count, title: data.data.page_title, fetchedAt: data.data.fetched_at });
      setStep('done');
      onSuccess(data.data.ingested_count, data.data.page_title, data.data.fetched_at);
    } catch {
      setErrorMsg('Network request failed. Please check your connection.');
      setStep('error');
    }
  };

  // ── Handle archive ZIP import ──────────────────────────────────────────────
  const handleArchiveImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canImport) return;
    setErrorMsg(''); setTip('');
    await progressStages();

    try {
      const form = new FormData();
      form.append('file', archiveFile!);
      form.append('platform', platformId);
      form.append('ownership_attested', 'true');

      const res = await fetch('/api/posts/import-archive', { method: 'POST', body: form });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setErrorMsg(data.error?.message ?? 'Import failed. Please check the file and try again.');
        setStep('error');
        return;
      }

      setResult({ count: data.data.ingested_count, title: `${meta.label} Archive`, fetchedAt: data.data.fetched_at });
      setStep('done');
      onSuccess(data.data.ingested_count, `${meta.label} Archive`, data.data.fetched_at);
    } catch {
      setErrorMsg('Network request failed. Please check your connection.');
      setStep('error');
    }
  };

  const isLoading = ['stage1', 'stage2', 'stage3'].includes(step);
  const zipInstructions = ZIP_INSTRUCTIONS[platformId];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/80 backdrop-blur-[4px] p-4">
      <div className="w-full max-w-lg bg-paper-warm border border-hairline flex flex-col max-h-[92vh] animate-card-entry">

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="p-6 border-b border-hairline flex items-center justify-between shrink-0">
          <div className="flex flex-col gap-0.5">
            <span className="text-xs uppercase font-mono text-neutral">Ingestion Gateway / Profile Scraper</span>
            <div className="flex items-center gap-2">
              <span className="text-neutral"><PlatformIcon platform={platformId} size={20} /></span>
              <h3 className="font-fraunces text-2xl font-bold text-ink uppercase">{meta.label}</h3>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isLoading}
            className="text-neutral hover:text-ink cursor-pointer disabled:opacity-40"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* ── Tab bar (only show if platform supports both) ────────────────── */}
        {meta.scrapable && meta.supportsZipImport && step === 'idle' && (
          <div className="flex border-b border-hairline px-6 shrink-0">
            {[
              { id: 'scrape' as Tab, label: 'Scrape Profile URL' },
              { id: 'archive' as Tab, label: 'Import Archive ZIP' },
            ].map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`pb-3 pt-4 mr-6 text-xs uppercase font-semibold tracking-wider font-mono border-b-2 transition-all ${
                  tab === t.id ? 'border-ink text-ink' : 'border-transparent text-neutral hover:text-ink'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        )}
        {/* Reset/try again also shows tab bar */}
        {meta.scrapable && meta.supportsZipImport && step === 'error' && (
          <div className="flex border-b border-hairline px-6 shrink-0">
            {[
              { id: 'scrape' as Tab, label: 'Scrape Profile URL' },
              { id: 'archive' as Tab, label: 'Import Archive ZIP' },
            ].map(t => (
              <button
                key={t.id}
                onClick={() => { setTab(t.id); setStep('idle'); setErrorMsg(''); }}
                className={`pb-3 pt-4 mr-6 text-xs uppercase font-semibold tracking-wider font-mono border-b-2 transition-all ${
                  tab === t.id ? 'border-ink text-ink' : 'border-transparent text-neutral hover:text-ink'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        )}

        {/* ── Body ────────────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto p-6">

          {/* ── Loading ─────────────────────────────────────────────────── */}
          {isLoading && (
            <div className="flex flex-col items-center justify-center gap-8 py-10">
              <div className="relative w-16 h-16">
                <div className="absolute inset-0 border-2 border-ink/10 rounded-full"/>
                <div className="absolute inset-0 border-t-2 border-ink rounded-full animate-spin" style={{ animationDuration: '0.9s' }}/>
                <div className="absolute inset-0 flex items-center justify-center text-ink">
                  <PlatformIcon platform={platformId} size={18} />
                </div>
              </div>
              <div className="w-full flex flex-col gap-3">
                {([1, 2, 3] as const).map(s => (
                  <div key={s} className="flex items-center gap-3">
                    <div className={`w-5 h-5 flex items-center justify-center shrink-0 ${
                      currentStage > s ? 'text-[#1F6F4A]' : currentStage === s ? 'text-ink' : 'text-neutral/30'
                    }`}>
                      {currentStage > s ? (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                      ) : currentStage === s ? (
                        <div className="w-3 h-3 border-2 border-current rounded-full animate-pulse"/>
                      ) : (
                        <div className="w-3 h-3 border border-current rounded-full opacity-30"/>
                      )}
                    </div>
                    <span className={`text-xs font-mono uppercase tracking-wider ${
                      currentStage >= s ? 'text-ink' : 'text-neutral/40'
                    }`}>
                      {STAGE_LABELS[s]}{currentStage === s ? dots : ''}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Done ────────────────────────────────────────────────────── */}
          {step === 'done' && result && (
            <div className="flex flex-col items-center gap-6 py-6">
              <div className="w-14 h-14 border border-[#1F6F4A] flex items-center justify-center">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#1F6F4A" strokeWidth="2.5" strokeLinecap="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              </div>
              <div className="text-center">
                <h4 className="font-fraunces text-xl font-bold text-ink">Ingestion Complete</h4>
                <p className="text-sm text-neutral mt-1">{result.title}</p>
              </div>
              <div className="w-full grid grid-cols-2 gap-4">
                <div className="p-4 bg-paper border border-hairline">
                  <span className="text-xs font-mono text-neutral uppercase block mb-1">Segments Found</span>
                  <span className="font-fraunces text-3xl font-bold text-ink">{result.count}</span>
                </div>
                <div className="p-4 bg-paper border border-hairline">
                  <span className="text-xs font-mono text-neutral uppercase block mb-1">Source</span>
                  <span className="text-xs font-mono text-ink">{meta.label}</span>
                </div>
              </div>
              <p className="text-xs text-neutral font-mono text-center">
                Your data is now in the Ledger. Run claim extraction to transform these into verified accomplishments.
              </p>
              <button onClick={onClose} className="w-full py-3 bg-ink hover:bg-[#2D2B26] text-paper text-xs font-semibold uppercase tracking-wider font-mono cursor-pointer">
                Close
              </button>
            </div>
          )}

          {/* ── Scrape tab ──────────────────────────────────────────────── */}
          {(step === 'idle' || step === 'error') && tab === 'scrape' && (
            <form onSubmit={handleScrape} className="flex flex-col gap-5">

              {/* Twitter wall warning */}
              {!meta.scrapable && (
                <div className="p-4 bg-clay/5 border border-clay/30 text-clay text-xs leading-relaxed">
                  <strong className="block mb-1 font-mono uppercase text-[10px] tracking-wider">⚠ Scraping Not Available</strong>
                  {meta.scrapeLimit}
                </div>
              )}

              {meta.scrapable && (
                <>
                  {/* Info banner */}
                  <div className="p-4 bg-paper border border-hairline text-xs text-neutral leading-relaxed flex gap-3">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="shrink-0 mt-0.5 text-neutral"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                    <span>Paste your <strong className="text-ink">{meta.label} public profile URL</strong>. Tracck will fetch and parse the page once — no login, no stored credentials.</span>
                  </div>

                  {/* URL input */}
                  <div className="form-group">
                    <label htmlFor="scrapeUrl">{meta.label} Profile URL</label>
                    <div className="flex items-center border border-hairline focus-within:border-ink transition-colors bg-paper">
                      <span className="pl-3 text-neutral shrink-0"><PlatformIcon platform={platformId} size={14} /></span>
                      <input
                        id="scrapeUrl"
                        type="url"
                        placeholder={`https://${platformId === 'linkedin' ? 'linkedin.com/in/yourname' : platformId === 'instagram' ? 'instagram.com/yourhandle' : 'behance.net/yourname'}`}
                        value={url}
                        onChange={e => setUrl(e.target.value)}
                        required
                        className="flex-1 text-sm font-archivo bg-transparent p-3 outline-none placeholder:text-neutral/40"
                      />
                      {isValidUrl(url) && !urlMismatch && (
                        <span className="pr-3 text-[#1F6F4A]">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                        </span>
                      )}
                    </div>
                    {urlMismatch && (
                      <span className="text-xs font-mono text-clay mt-1.5 block">
                        This looks like a {PLATFORM_META[detectedFromUrl!]?.label} URL — are you on the right card?
                      </span>
                    )}
                    {url && !isValidUrl(url) && (
                      <span className="text-xs font-mono text-clay mt-1.5 block">Must start with https://</span>
                    )}
                  </div>
                </>
              )}

              {/* Error */}
              {step === 'error' && errorMsg && (
                <div className="p-4 border border-clay/40 bg-clay/5 text-clay text-xs font-mono flex gap-2 items-start">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="mt-0.5 shrink-0"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                  <div>
                    <span>{errorMsg}</span>
                    {tip && <span className="block mt-1 text-neutral">{tip}</span>}
                    {meta.supportsZipImport && (
                      <button type="button" onClick={() => { setTab('archive'); setStep('idle'); setErrorMsg(''); }}
                        className="mt-2 underline underline-offset-2 text-ink cursor-pointer">
                        Try Archive ZIP Import instead →
                      </button>
                    )}
                  </div>
                </div>
              )}

              {meta.scrapable && (
                <>
                  {/* Attestation */}
                  <div className="flex items-start gap-3 p-4 bg-paper border border-hairline">
                    <input type="checkbox" id="scrapeAttest" checked={attested} onChange={e => setAttested(e.target.checked)} className="mt-1 cursor-pointer w-4 h-4 accent-ink"/>
                    <label htmlFor="scrapeAttest" className="text-xs text-neutral leading-relaxed cursor-pointer select-none">
                      I confirm this is my own profile. I authorise Tracck to fetch and parse it once to extract my professional work data.
                    </label>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-4">
                    <button type="button" onClick={onClose} className="flex-1 py-3 border border-hairline hover:border-ink text-xs font-semibold uppercase tracking-wider font-mono text-ink bg-transparent cursor-pointer">Cancel</button>
                    <button type="submit" disabled={!canScrape} className="flex-1 py-3 bg-ink hover:bg-[#2D2B26] text-paper text-xs font-semibold uppercase tracking-wider font-mono cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed">
                      Scrape Profile
                    </button>
                  </div>
                </>
              )}

              {!meta.scrapable && (
                <button type="button" onClick={() => { setTab('archive'); setStep('idle'); }} className="w-full py-3 bg-ink hover:bg-[#2D2B26] text-paper text-xs font-semibold uppercase tracking-wider font-mono cursor-pointer">
                  Switch to Archive Import →
                </button>
              )}
            </form>
          )}

          {/* ── Archive ZIP tab ─────────────────────────────────────────── */}
          {(step === 'idle' || step === 'error') && tab === 'archive' && (
            <form onSubmit={handleArchiveImport} className="flex flex-col gap-5">

              {/* How to export instructions */}
              {zipInstructions && (
                <div className="p-4 bg-paper border border-hairline flex flex-col gap-3">
                  <span className="text-xs font-mono uppercase text-neutral tracking-wider">How to export your {meta.label} data</span>
                  <ol className="flex flex-col gap-1.5">
                    {zipInstructions.steps.map((step, i) => (
                      <li key={i} className="flex gap-2 text-xs text-neutral leading-relaxed">
                        <span className="font-mono text-ink shrink-0">{i + 1}.</span>
                        <span>{step}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              )}

              {/* File drop zone */}
              <div className="form-group">
                <label>Upload {meta.label} Data Export (.zip)</label>
                <label
                  htmlFor="archiveFile"
                  className="flex flex-col items-center justify-center gap-3 border border-dashed border-hairline hover:border-ink bg-paper p-8 cursor-pointer transition-colors"
                >
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="text-neutral">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="17 8 12 3 7 8"/>
                    <line x1="12" y1="3" x2="12" y2="15"/>
                  </svg>
                  <div className="text-center">
                    <span className="text-xs font-mono text-ink block">{archiveFile ? archiveFile.name : 'Select or drop your ZIP file'}</span>
                    <span className="text-xs text-neutral block mt-0.5">.zip format only</span>
                  </div>
                  <input id="archiveFile" type="file" accept=".zip" className="hidden" onChange={e => setArchiveFile(e.target.files?.[0] ?? null)} required/>
                </label>
              </div>

              {/* Error */}
              {step === 'error' && errorMsg && (
                <div className="p-4 border border-clay/40 bg-clay/5 text-clay text-xs font-mono flex gap-2 items-start">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="mt-0.5 shrink-0"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Attestation */}
              <div className="flex items-start gap-3 p-4 bg-paper border border-hairline">
                <input type="checkbox" id="archiveAttest" checked={attested} onChange={e => setAttested(e.target.checked)} className="mt-1 cursor-pointer w-4 h-4 accent-ink"/>
                <label htmlFor="archiveAttest" className="text-xs text-neutral leading-relaxed cursor-pointer select-none">
                  I confirm this is my own data export. I authorise Tracck to parse the archive once and extract my posts and activities.
                </label>
              </div>

              {/* Actions */}
              <div className="flex gap-4">
                <button type="button" onClick={onClose} className="flex-1 py-3 border border-hairline hover:border-ink text-xs font-semibold uppercase tracking-wider font-mono text-ink bg-transparent cursor-pointer">Cancel</button>
                <button type="submit" disabled={!canImport} className="flex-1 py-3 bg-ink hover:bg-[#2D2B26] text-paper text-xs font-semibold uppercase tracking-wider font-mono cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed">
                  Import Archive
                </button>
              </div>
            </form>
          )}

        </div>
      </div>
    </div>
  );
}
