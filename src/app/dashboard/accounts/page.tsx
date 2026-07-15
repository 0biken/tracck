'use client'

import React from 'react';
import PasteModal from '@/app/components/PasteModal';
import PortfolioFetchModal from '@/app/components/PortfolioFetchModal';

interface Platform {
  id: string;
  name: string;
  type: 'oauth' | 'hybrid' | 'paste' | 'url-fetch';
  status: 'connected' | 'not_connected';
  accountName?: string;
  desc: string;
  // For url-fetch platforms only
  lastFetchedAt?: string;
  lastFetchedTitle?: string;
}

export default function AccountsPage() {
  const [platforms, setPlatforms] = React.useState<Platform[]>([
    { id: 'github', name: 'GitHub', type: 'oauth', status: 'connected', accountName: '0biken', desc: 'Syncs commit history, pull request descriptions, and public repositories.' },
    { id: 'figma', name: 'Figma', type: 'oauth', status: 'not_connected', desc: 'Ingests public project details, component edits, and Figma file activities.' },
    { id: 'twitter', name: 'Twitter / X', type: 'hybrid', status: 'not_connected', desc: 'Pulls posts and thread narratives. Uses OAuth or copy-paste backup.' },
    { id: 'linkedin', name: 'LinkedIn', type: 'hybrid', status: 'not_connected', desc: 'Extracts achievements from posts or ZIP/CSV profile archive uploads.' },
    { id: 'instagram', name: 'Instagram', type: 'hybrid', status: 'not_connected', desc: 'Analyzes post captions and shared graphics. Business/Creator accounts supported.' },
    { id: 'facebook', name: 'Facebook', type: 'paste', status: 'not_connected', desc: 'Allows pasting of personal updates and narrative text. Ingestion is paste-only.' },
    { id: 'behance', name: 'Behance', type: 'url-fetch', status: 'not_connected', desc: 'Paste your Behance profile URL and Tracck will analyse your project descriptions instantly. One-shot fetch — no account linked.' },
    { id: 'portfolio', name: 'Portfolio / Website', type: 'url-fetch', status: 'not_connected', desc: 'Point Tracck at any public portfolio site or personal website. We fetch the page once, extract your work descriptions, and discard the URL.' },
  ]);

  // Paste modal state
  const [selectedPlatform, setSelectedPlatform] = React.useState<Platform | null>(null);
  const [isModalOpen, setIsModalOpen] = React.useState(false);

  // Portfolio fetch modal state
  const [fetchTarget, setFetchTarget] = React.useState<Platform | null>(null);
  const [isFetchModalOpen, setIsFetchModalOpen] = React.useState(false);

  const [notification, setNotification] = React.useState<{ message: string } | null>(null);

  const showNotification = (message: string) => {
    setNotification({ message });
    setTimeout(() => setNotification(null), 4500);
  };

  const handlePlatformClick = (platform: Platform) => {
    if (platform.type === 'oauth') {
      if (platform.status === 'connected') {
        setPlatforms(prev =>
          prev.map(p => p.id === platform.id ? { ...p, status: 'not_connected', accountName: undefined } : p)
        );
        showNotification(`Disconnected from ${platform.name}`);
      } else {
        setPlatforms(prev =>
          prev.map(p => p.id === platform.id ? { ...p, status: 'connected', accountName: 'user_oauth_connected' } : p)
        );
        showNotification(`Successfully authenticated with ${platform.name}`);
      }
    } else if (platform.type === 'url-fetch') {
      setFetchTarget(platform);
      setIsFetchModalOpen(true);
    } else {
      // hybrid / paste
      setSelectedPlatform(platform);
      setIsModalOpen(true);
    }
  };

  const handleIngestSuccess = (count: number) => {
    if (selectedPlatform) {
      showNotification(`Successfully ingested ${count} ${count === 1 ? 'submission' : 'submissions'} from ${selectedPlatform.name}`);
    }
  };

  const handleFetchSuccess = (count: number, pageTitle: string, fetchedAt: string) => {
    if (fetchTarget) {
      setPlatforms(prev =>
        prev.map(p =>
          p.id === fetchTarget.id
            ? { ...p, lastFetchedAt: fetchedAt, lastFetchedTitle: pageTitle }
            : p
        )
      );
      showNotification(`Analysed ${pageTitle} — ${count} content segments ingested`);
    }
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
          Connect official OAuth providers where available, or paste text and screenshots directly for manual ingestion.
          Use the <strong className="text-ink">URL Fetch</strong> channel to let Tracck analyse a public portfolio page
          for you — one request, no credentials stored.
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
        {platforms.map((platform) => {
          const isConnected = platform.status === 'connected';
          const hasFetched = platform.type === 'url-fetch' && !!platform.lastFetchedAt;
          const badge = typeBadge(platform.type);

          return (
            <div
              key={platform.id}
              className="bg-paper-warm border border-hairline p-6 flex flex-col justify-between h-64 hover:border-ink transition-colors group"
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
              <div className="flex flex-col gap-3">
                {/* Status line */}
                {platform.type === 'url-fetch' ? (
                  hasFetched ? (
                    <div className="flex flex-col gap-0.5">
                      <div className="flex items-center gap-2 text-xs font-mono text-[#4A6FA5]">
                        <span className="w-1.5 h-1.5 bg-[#4A6FA5] rounded-full" />
                        <span>LAST FETCHED: {formatFetchDate(platform.lastFetchedAt!)}</span>
                      </div>
                      {platform.lastFetchedTitle && (
                        <span className="text-[10px] font-mono text-neutral pl-3.5 truncate">{platform.lastFetchedTitle}</span>
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
                    <span>CONNECTED AS: @{platform.accountName}</span>
                  </div>
                ) : (
                  <div className="text-xs font-mono text-neutral">
                    <span>DISCONNECTED</span>
                  </div>
                )}

                {/* Action button */}
                {platform.type === 'url-fetch' ? (
                  <button
                    onClick={() => handlePlatformClick(platform)}
                    className="w-full py-2.5 text-xs font-semibold uppercase tracking-wider font-mono cursor-pointer text-center transition-colors border border-[#4A6FA5]/40 text-[#4A6FA5] hover:bg-[#4A6FA5] hover:text-paper hover:border-[#4A6FA5] bg-transparent"
                  >
                    {hasFetched ? 'Re-fetch Portfolio' : 'Analyse Portfolio URL'}
                  </button>
                ) : (
                  <button
                    onClick={() => handlePlatformClick(platform)}
                    className={`w-full py-2.5 text-xs font-semibold uppercase tracking-wider font-mono cursor-pointer text-center rounded-[4px] transition-colors border ${
                      isConnected
                        ? 'border-clay/30 hover:border-clay hover:bg-clay/5 text-clay bg-transparent'
                        : 'border-hairline group-hover:border-ink text-ink bg-transparent hover:bg-ink hover:text-paper'
                    }`}
                  >
                    {isConnected
                      ? 'Disconnect Adapter'
                      : platform.type === 'oauth'
                        ? 'Authorize Account'
                        : 'Paste / Import Data'
                    }
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Paste Modal */}
      {selectedPlatform && (
        <PasteModal
          platform={selectedPlatform.name}
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setSelectedPlatform(null);
          }}
          onSuccess={handleIngestSuccess}
        />
      )}

      {/* Portfolio Fetch Modal */}
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
            handleFetchSuccess(count, pageTitle, fetchedAt);
          }}
        />
      )}
    </div>
  );
}
