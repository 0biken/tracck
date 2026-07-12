'use client'

import React from 'react';
import PasteModal from '@/app/components/PasteModal';

interface Platform {
  id: string;
  name: string;
  type: 'oauth' | 'hybrid' | 'paste';
  status: 'connected' | 'not_connected';
  accountName?: string;
  desc: string;
}

export default function AccountsPage() {
  const [platforms, setPlatforms] = React.useState<Platform[]>([
    { id: 'github', name: 'GitHub', type: 'oauth', status: 'connected', accountName: '0biken', desc: 'Syncs commit history, pull request descriptions, and public repositories.' },
    { id: 'figma', name: 'Figma', type: 'oauth', status: 'not_connected', desc: 'Ingests public project details, component edits, and Figma file activities.' },
    { id: 'twitter', name: 'Twitter / X', type: 'hybrid', status: 'not_connected', desc: 'Pulls posts and thread narratives. Uses OAuth or copy-paste backup.' },
    { id: 'linkedin', name: 'LinkedIn', type: 'hybrid', status: 'not_connected', desc: 'Extracts achievements from posts or ZIP/CSV profile archive uploads.' },
    { id: 'instagram', name: 'Instagram', type: 'hybrid', status: 'not_connected', desc: 'Analyzes post captions and shared graphics. Business/Creator accounts supported.' },
    { id: 'facebook', name: 'Facebook', type: 'paste', status: 'not_connected', desc: 'Allows pasting of personal updates and narrative text. Ingestion is paste-only.' },
    { id: 'behance', name: 'Behance', type: 'paste', status: 'not_connected', desc: 'Imports portfolio descriptions and project writeups. Paste-only pathway.' },
  ]);

  const [selectedPlatform, setSelectedPlatform] = React.useState<Platform | null>(null);
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [notification, setNotification] = React.useState<{ message: string; count: number } | null>(null);

  const handlePlatformClick = (platform: Platform) => {
    if (platform.type === 'oauth') {
      // Simulate OAuth adapter trigger
      if (platform.status === 'connected') {
        // Disconnect
        setPlatforms(prev => prev.map(p => p.id === platform.id ? { ...p, status: 'not_connected', accountName: undefined } : p));
        showNotification(`Disconnected from ${platform.name}`, 0);
      } else {
        // Connect
        setPlatforms(prev => prev.map(p => p.id === platform.id ? { ...p, status: 'connected', accountName: 'user_oauth_connected' } : p));
        showNotification(`Successfully authenticated with ${platform.name}`, 1);
      }
    } else {
      setSelectedPlatform(platform);
      setIsModalOpen(true);
    }
  };

  const showNotification = (message: string, count: number) => {
    setNotification({ message, count });
    setTimeout(() => {
      setNotification(null);
    }, 4000);
  };

  const handleIngestSuccess = (count: number) => {
    if (selectedPlatform) {
      showNotification(`Successfully ingested ${count} ${count === 1 ? 'submission' : 'submissions'} from ${selectedPlatform.name}`, count);
    }
  };

  return (
    <div className="flex flex-col gap-12 animate-card-entry">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <span className="text-xs uppercase font-mono text-neutral">Dashboard / Ingestion Matrix</span>
        <h1 className="font-fraunces text-4xl font-bold text-ink">Inbound Data Channels</h1>
        <p className="text-neutral text-sm max-w-xl">
          Connect official OAuth providers where available, or paste text and screenshots directly for manual ingestion. We do not scrape platforms.
        </p>
      </div>

      {/* Success Notification Alert (uses Signal color #1F6F4A) */}
      {notification && (
        <div className="p-4 border border-[#1F6F4A] bg-[#1F6F4A]/10 text-[#1F6F4A] flex items-center justify-between transition-all duration-200">
          <div className="flex items-center gap-3 text-sm font-semibold">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="square" strokeLinejoin="square">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            <span>{notification.message}</span>
          </div>
          <span className="text-xs font-mono">LEDGER UPDATED</span>
        </div>
      )}

      {/* Platforms Matrix Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {platforms.map((platform) => {
          const isConnected = platform.status === 'connected';
          return (
            <div 
              key={platform.id} 
              className="bg-paper-warm border border-hairline p-6 flex flex-col justify-between h-64 hover:border-ink transition-colors group"
            >
              <div className="flex flex-col gap-3">
                {/* Header info */}
                <div className="flex justify-between items-start">
                  <h3 className="font-fraunces text-xl font-bold text-ink">{platform.name}</h3>
                  <span className={`text-[10px] font-mono font-semibold uppercase px-2 py-0.5 border rounded-[2px] ${
                    platform.type === 'oauth' 
                      ? 'border-[#1F6F4A] text-[#1F6F4A] bg-[#1F6F4A]/5' 
                      : platform.type === 'hybrid' 
                        ? 'border-neutral text-neutral bg-paper' 
                        : 'border-hairline text-neutral bg-paper'
                  }`}>
                    {platform.type === 'oauth' ? 'OAuth Only' : platform.type === 'hybrid' ? 'OAuth / Paste' : 'Paste Only'}
                  </span>
                </div>
                <p className="text-xs text-neutral leading-relaxed">{platform.desc}</p>
              </div>

              {/* Status and Action button */}
              <div className="flex flex-col gap-3">
                {isConnected ? (
                  <div className="flex items-center gap-2 text-xs font-mono text-[#1F6F4A]">
                    <span className="w-1.5 h-1.5 bg-[#1F6F4A] rounded-full"></span>
                    <span>CONNECTED AS: @{platform.accountName}</span>
                  </div>
                ) : (
                  <div className="text-xs font-mono text-neutral">
                    <span>DISCONNECTED</span>
                  </div>
                )}
                
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
    </div>
  );
}
