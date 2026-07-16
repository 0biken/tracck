'use client'

import React from 'react';
import PasteModal from '@/app/components/PasteModal';
import PortfolioFetchModal from '@/app/components/PortfolioFetchModal';
import ProfileScrapeModal from '@/app/components/ProfileScrapeModal';
import { type ScrapePlatform } from '@/lib/scrapers/platform';

interface ConnectedAccount {
  id: string;
  platform: string;
  username: string;
  status: string;
}

interface FetchHistory {
  platform: string;
  lastFetchedAt: string;
  lastFetchedTitle?: string;
}

interface AccountsClientProps {
  initialAccounts: ConnectedAccount[];
  fetchHistory: FetchHistory[];
}

interface Platform {
  id: string;
  name: string;
  type: 'oauth' | 'hybrid' | 'paste' | 'url-fetch';
  desc: string;
}

const PLATFORMS: Platform[] = [
  { id: 'github', name: 'GitHub', type: 'oauth', desc: 'Syncs commit history, pull request descriptions, and public repositories.' },
  { id: 'figma', name: 'Figma', type: 'oauth', desc: 'Ingests public project details, component edits, and Figma file activities.' },
  { id: 'twitter', name: 'Twitter / X', type: 'hybrid', desc: 'Pulls posts and thread narratives. Uses OAuth or copy-paste backup.' },
  { id: 'linkedin', name: 'LinkedIn', type: 'hybrid', desc: 'Extracts achievements from posts or ZIP/CSV profile archive uploads.' },
  { id: 'instagram', name: 'Instagram', type: 'hybrid', desc: 'Analyzes post captions and shared graphics. Business/Creator accounts supported.' },
  { id: 'facebook', name: 'Facebook', type: 'paste', desc: 'Allows pasting of personal updates and narrative text. Ingestion is paste-only.' },
  { id: 'behance', name: 'Behance', type: 'url-fetch', desc: 'Paste your Behance profile URL and Tracck will analyse your project descriptions instantly. One-shot fetch — no account linked.' },
  { id: 'portfolio', name: 'Portfolio / Website', type: 'url-fetch', desc: 'Point Tracck at any public portfolio site or personal website. We fetch the page once, extract your work descriptions, and discard the URL.' },
];

export default function AccountsClient({ initialAccounts, fetchHistory }: AccountsClientProps) {
  const [accounts, setAccounts] = React.useState(initialAccounts);
  const [history, setHistory] = React.useState(fetchHistory);

  // Modal states
  const [pasteTarget, setPasteTarget] = React.useState<Platform | null>(null);
  const [isPasteModalOpen, setIsPasteModalOpen] = React.useState(false);

  const [scrapeTarget, setScrapeTarget] = React.useState<ScrapePlatform | null>(null);
  const [isScrapeModalOpen, setIsScrapeModalOpen] = React.useState(false);

  const [fetchTarget, setFetchTarget] = React.useState<Platform | null>(null);
  const [isFetchModalOpen, setIsFetchModalOpen] = React.useState(false);

  const [notification, setNotification] = React.useState<{ message: string } | null>(null);

  const showNotification = (message: string) => {
    setNotification({ message });
    setTimeout(() => setNotification(null), 4500);
  };

  const handleOAuthClick = (platformId: string) => {
    // Initiate OAuth flow
    window.location.href = `/api/auth/oauth/start?platform=${platformId}`;
  };

  const handleDisconnect = async (accountId: string, platformName: string) => {
    try {
      const res = await fetch(`/api/accounts/${accountId}`, { method: 'DELETE' });
      if (res.ok) {
        setAccounts(prev => prev.filter(a => a.id !== accountId));
        showNotification(`Disconnected from ${platformName}`);
      } else {
        alert('Failed to disconnect account');
      }
    } catch {
      alert('Network error disconnecting account');
    }
  };

  const handlePlatformClick = (platform: Platform) => {
    const connectedAccount = accounts.find(a => a.platform === platform.id);
    
    if (platform.type === 'oauth' || platform.type === 'hybrid') {
      if (connectedAccount) {
        handleDisconnect(connectedAccount.id, platform.name);
      } else {
        handleOAuthClick(platform.id);
      }
    } else if (platform.type === 'url-fetch') {
      if (platform.id === 'behance') {
        setScrapeTarget('behance');
        setIsScrapeModalOpen(true);
      } else {
        setFetchTarget(platform);
        setIsFetchModalOpen(true);
      }
    } else {
      // paste only
      setPasteTarget(platform);
      setIsPasteModalOpen(true);
    }
  };

  const handleScrapeClick = (platformId: string) => {
    setScrapeTarget(platformId as ScrapePlatform);
    setIsScrapeModalOpen(true);
  };

  const handleIngestSuccess = (count: number) => {
    showNotification(`Successfully ingested ${count} ${count === 1 ? 'submission' : 'submissions'}`);
  };

  const handleFetchSuccess = (platformId: string, count: number, pageTitle: string, fetchedAt: string) => {
    setHistory(prev => {
      const existing = prev.filter(h => h.platform !== platformId);
      return [...existing, { platform: platformId, lastFetchedAt: fetchedAt, lastFetchedTitle: pageTitle }];
    });
    showNotification(`Analysed ${pageTitle} — ${count} content segments ingested`);
  };

  const formatFetchDate = (iso: string) => {
    try {
      return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));
    } catch {
      return iso;
    }
  };

  const typeBadge = (type: Platform['type']) => {
    if (type === 'oauth') return { label: 'OAuth Only', classes: 'border-[#1F6F4A] text-[#1F6F4A] bg-[#1F6F4A]/5' };
    if (type === 'hybrid') return { label: 'OAuth / Paste', classes: 'border-neutral text-neutral bg-paper' };
    if (type === 'url-fetch') return { label: 'URL Fetch', classes: 'border-[#4A6FA5] text-[#4A6FA5] bg-[#4A6FA5]/5' };
    return { label: 'Paste Only', classes: 'border-hairline text-neutral bg-paper' };
  };

  return (
    <div className="flex flex-col gap-12 animate-card-entry">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <span className="text-xs uppercase font-mono text-neutral">Dashboard / Ingestion Matrix</span>
        <h1 className="font-fraunces text-4xl font-bold text-ink">Inbound Data Channels</h1>
        <p className="text-neutral text-sm max-w-xl">
          Connect official OAuth providers where available, or paste text and scrape URLs directly for manual ingestion.
          Use the <strong className="text-ink">URL Fetch</strong> channel to let Tracck analyse a public portfolio page.
        </p>
      </div>

      {/* Success Notification */}
      {notification && (
        <div className="p-4 border border-[#1F6F4A] bg-[#1F6F4A]/10 text-[#1F6F4A] flex items-center justify-between transition-all duration-200">
          <div className="flex items-center gap-3 text-sm font-semibold">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="square" strokeLinejoin="miter">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            <span>{notification.message}</span>
          </div>
          <span className="text-xs font-mono">LEDGER UPDATED</span>
        </div>
      )}

      {/* Platforms Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {PLATFORMS.map((platform) => {
          const connectedAccount = accounts.find(a => a.platform === platform.id);
          const historyItem = history.find(h => h.platform === platform.id);
          const isConnected = !!connectedAccount;
          const hasFetched = !!historyItem;
          const badge = typeBadge(platform.type);

          return (
            <div
              key={platform.id}
              className="bg-paper-warm border border-hairline p-6 flex flex-col justify-between min-h-[16rem] hover:border-ink transition-colors group"
            >
              <div className="flex flex-col gap-3">
                {/* Header */}
                <div className="flex justify-between items-start">
                  <h3 className="font-fraunces text-xl font-bold text-ink">{platform.name}</h3>
                  <span className={`text-[10px] font-mono font-semibold uppercase px-2 py-0.5 border rounded-[2px] ${badge.classes}`}>
                    {badge.label}
                  </span>
                </div>
                <p className="text-xs text-neutral leading-relaxed">{platform.desc}</p>
              </div>

              {/* Status + Action */}
              <div className="flex flex-col gap-3 mt-4">
                {/* Status line */}
                {platform.type === 'url-fetch' ? (
                  hasFetched ? (
                    <div className="flex flex-col gap-0.5">
                      <div className="flex items-center gap-2 text-xs font-mono text-[#4A6FA5]">
                        <span className="w-1.5 h-1.5 bg-[#4A6FA5] rounded-full" />
                        <span>LAST FETCHED: {formatFetchDate(historyItem.lastFetchedAt)}</span>
                      </div>
                      {historyItem.lastFetchedTitle && (
                        <span className="text-[10px] font-mono text-neutral pl-3.5 truncate">{historyItem.lastFetchedTitle}</span>
                      )}
                    </div>
                  ) : (
                    <div className="text-xs font-mono text-neutral">
                      <span>NEVER FETCHED</span>
                    </div>
                  )
                ) : isConnected ? (
                  <div className="flex items-center gap-2 text-xs font-mono text-[#1F6F4A]">
                    <span className="w-1.5 h-1.5 bg-[#1F6F4A] rounded-full" />
                    <span>CONNECTED AS: @{connectedAccount.username}</span>
                  </div>
                ) : (
                  <div className="text-xs font-mono text-neutral">
                    <span>DISCONNECTED</span>
                  </div>
                )}

                {/* Action buttons */}
                <div className="flex gap-2">
                  <button
                    onClick={() => handlePlatformClick(platform)}
                    className={`flex-1 py-2.5 text-[10px] font-semibold uppercase tracking-wider font-mono cursor-pointer text-center rounded-[4px] transition-colors border ${
                      isConnected
                        ? 'border-clay/30 hover:border-clay hover:bg-clay/5 text-clay bg-transparent'
                        : platform.type === 'url-fetch' 
                          ? 'border-[#4A6FA5]/40 text-[#4A6FA5] hover:bg-[#4A6FA5] hover:text-paper hover:border-[#4A6FA5] bg-transparent'
                          : 'border-hairline group-hover:border-ink text-ink bg-transparent hover:bg-ink hover:text-paper'
                    }`}
                  >
                    {isConnected
                      ? 'Disconnect'
                      : platform.type === 'oauth' || platform.type === 'hybrid'
                        ? 'Authorize'
                        : platform.type === 'url-fetch'
                          ? 'Fetch URL'
                          : 'Paste Text'
                    }
                  </button>
                  
                  {/* Additional actions for hybrid platforms */}
                  {platform.type === 'hybrid' && (
                    <>
                      <button
                        onClick={() => handleScrapeClick(platform.id)}
                        className="flex-1 py-2.5 text-[10px] font-semibold uppercase tracking-wider font-mono cursor-pointer text-center rounded-[4px] transition-colors border border-hairline text-ink bg-transparent hover:border-ink"
                      >
                        Scrape URL
                      </button>
                      <button
                        onClick={() => { setPasteTarget(platform); setIsPasteModalOpen(true); }}
                        className="flex-1 py-2.5 text-[10px] font-semibold uppercase tracking-wider font-mono cursor-pointer text-center rounded-[4px] transition-colors border border-hairline text-ink bg-transparent hover:border-ink"
                      >
                        Paste Text
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modals */}
      {pasteTarget && (
        <PasteModal
          platform={pasteTarget.id}
          isOpen={isPasteModalOpen}
          onClose={() => {
            setIsPasteModalOpen(false);
            setPasteTarget(null);
          }}
          onSuccess={handleIngestSuccess}
        />
      )}

      {scrapeTarget && (
        <ProfileScrapeModal
          platformId={scrapeTarget}
          isOpen={isScrapeModalOpen}
          onClose={() => {
            setIsScrapeModalOpen(false);
            setScrapeTarget(null);
          }}
          onSuccess={(count, title, fetchedAt) => {
            handleIngestSuccess(count);
            handleFetchSuccess(scrapeTarget, count, title, fetchedAt);
          }}
        />
      )}

      {fetchTarget && (
        <PortfolioFetchModal
          isOpen={isFetchModalOpen}
          onClose={() => {
            setIsFetchModalOpen(false);
            setFetchTarget(null);
          }}
          onSuccess={(count, pageTitle, fetchedAt) => {
            setIsFetchModalOpen(false);
            setFetchTarget(null);
            handleFetchSuccess(fetchTarget.id, count, pageTitle, fetchedAt);
          }}
        />
      )}
    </div>
  );
}
