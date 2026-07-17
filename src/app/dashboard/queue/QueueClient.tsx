'use client'

import React from 'react';
import { createClient } from '@/utils/supabase/client';

export interface Accomplishment {
  id: string;
  platform: string;
  date: string;
  claim: string;
  detail: string;
  confidence: number;
  status: 'pending' | 'low_confidence' | 'confirmed' | 'dismissed';
  category: string;
  isEditing?: boolean;
}

interface QueueClientProps {
  initialItems: Accomplishment[];
}

export default function QueueClient({ initialItems }: QueueClientProps) {
  const supabase = createClient();
  const [activeTab, setActiveTab] = React.useState<'pending' | 'confirmed'>('pending');
  const [editingClaim, setEditingClaim] = React.useState('');
  const [editingDetail, setEditingDetail] = React.useState('');
  
  const [items, setItems] = React.useState<Accomplishment[]>(initialItems);

  // Actions
  const handleConfirm = async (id: string) => {
    const el = document.getElementById(`card-${id}`);
    if (el) {
      el.classList.add('animate-confirm');
    }
    
    // Update in Supabase
    await supabase.from('accomplishments').update({ status: 'confirmed' }).eq('id', id);
    
    setTimeout(() => {
      setItems(prev => prev.map(item => item.id === id ? { ...item, status: 'confirmed' } : item));
    }, 180);
  };

  const handleDiscard = async (id: string) => {
    const el = document.getElementById(`card-${id}`);
    if (el) {
      el.classList.add('animate-dismiss');
    }

    // Update in Supabase
    await supabase.from('accomplishments').update({ status: 'dismissed' }).eq('id', id);

    setTimeout(() => {
      setItems(prev => prev.map(item => item.id === id ? { ...item, status: 'dismissed' } : item));
    }, 140);
  };

  const startEditing = (item: Accomplishment) => {
    setEditingClaim(item.claim);
    setEditingDetail(item.detail);
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, isEditing: true } : { ...i, isEditing: false }));
  };

  const cancelEditing = (id: string) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, isEditing: false } : i));
  };

  const saveEdit = async (id: string) => {
    const currentItem = items.find(i => i.id === id);
    const newStatus = currentItem?.status === 'low_confidence' ? 'pending' : currentItem?.status;

    // Update in Supabase
    await supabase.from('accomplishments').update({ 
      bullet_text: editingClaim,
      extracted_text: editingDetail,
      status: newStatus
    }).eq('id', id);

    setItems(prev => prev.map(item => 
      item.id === id 
        ? { 
            ...item, 
            claim: editingClaim, 
            detail: editingDetail, 
            isEditing: false, 
            status: newStatus as Accomplishment['status']
          } 
        : item
    ));
  };

  // Filter items
  const pendingItems = items.filter(i => i.status === 'pending' || i.status === 'low_confidence');
  const confirmedItems = items.filter(i => i.status === 'confirmed');

  return (
    <div className="flex flex-col gap-12 animate-card-entry">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <span className="text-xs uppercase font-mono text-neutral">Dashboard / Review Ledger</span>
        <h1 className="font-fraunces text-4xl font-bold text-ink">Ledger Queue</h1>
        <p className="text-neutral text-sm max-w-xl">
          Review extracted claims. Every draft bullet is a suggestion waiting for your approval. We never insert embellished details.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-hairline gap-8">
        <button
          onClick={() => setActiveTab('pending')}
          className={`pb-4 text-sm uppercase font-semibold tracking-wider font-mono border-b-2 transition-all cursor-pointer ${
            activeTab === 'pending' ? 'border-ink text-ink' : 'border-transparent text-neutral hover:text-ink'
          }`}
        >
          Pending Review ({pendingItems.length})
        </button>
        <button
          onClick={() => setActiveTab('confirmed')}
          className={`pb-4 text-sm uppercase font-semibold tracking-wider font-mono border-b-2 transition-all cursor-pointer ${
            activeTab === 'confirmed' ? 'border-ink text-ink' : 'border-transparent text-neutral hover:text-ink'
          }`}
        >
          Confirmed Ledger ({confirmedItems.length})
        </button>
      </div>

      {/* Ledger list container */}
      <div className="flex flex-col gap-6 max-w-4xl">
        {activeTab === 'pending' ? (
          pendingItems.length === 0 ? (
            <div className="border border-hairline p-12 text-center text-sm text-neutral">
              All queue items verified. Your ledger is clean.
            </div>
          ) : (
            pendingItems.map((item) => (
              <div
                key={item.id}
                id={`card-${item.id}`}
                className="bg-paper border border-hairline p-8 flex flex-col gap-4 rounded-none transition-all duration-150 relative overflow-hidden"
              >
                {/* 3-Voice Card Header */}
                <div className="flex justify-between items-start text-xs font-mono text-neutral pb-2 border-b border-hairline/40">
                  <div className="flex items-center gap-3">
                    <span className="font-semibold text-ink">{item.platform}</span>
                    <span>•</span>
                    <span>{item.date}</span>
                    <span>•</span>
                    <span className="uppercase">{item.category?.replace('_', ' ') || 'direct achievement'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {item.status === 'low_confidence' && (
                      <span className="px-2 py-0.5 border border-clay text-clay bg-clay/5 font-semibold text-[10px] rounded-[2px] uppercase">
                        Low Confidence
                      </span>
                    )}
                    <span>CONFIDENCE: {Math.round(item.confidence * 100)}%</span>
                  </div>
                </div>

                {item.isEditing ? (
                  /* Edit Mode Forms */
                  <div className="flex flex-col gap-4 py-2">
                    <div className="form-group">
                      <label htmlFor={`edit-claim-${item.id}`}>Serif Claim Headline</label>
                      <input
                        id={`edit-claim-${item.id}`}
                        type="text"
                        value={editingClaim}
                        onChange={(e) => setEditingClaim(e.target.value)}
                        className="w-full text-base font-fraunces font-bold border border-hairline focus:border-ink bg-paper p-3 outline-none"
                      />
                    </div>
                    <div className="form-group">
                      <label htmlFor={`edit-detail-${item.id}`}>Grotesk Description Context</label>
                      <textarea
                        id={`edit-detail-${item.id}`}
                        rows={3}
                        value={editingDetail}
                        onChange={(e) => setEditingDetail(e.target.value)}
                        className="w-full text-sm font-archivo border border-hairline focus:border-ink bg-paper p-3 outline-none resize-y"
                      />
                    </div>
                    <div className="flex gap-3 justify-end mt-2">
                      <button
                        onClick={() => cancelEditing(item.id)}
                        className="px-4 py-2 border border-hairline hover:border-ink text-xs font-semibold uppercase tracking-wider font-mono rounded-[4px] text-ink cursor-pointer bg-transparent"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => saveEdit(item.id)}
                        className="px-4 py-2 bg-ink text-paper hover:bg-[#2D2B26] text-xs font-semibold uppercase tracking-wider font-mono rounded-[4px] cursor-pointer"
                      >
                        Save Overrides
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Read Mode Cards */
                  <div className="flex flex-col gap-3">
                    {/* Voice 2: Claim Headline in Fraunces Display Serif */}
                    <h3 className="font-fraunces text-2xl font-bold text-ink leading-tight">
                      {item.claim}
                    </h3>
                    
                    {/* Voice 3: Detail Explanation in Archivo Grotesk */}
                    <p className="text-sm text-neutral leading-relaxed">
                      {item.detail}
                    </p>

                    {/* Action Panel */}
                    <div className="flex justify-between items-center mt-4 pt-4 border-t border-hairline/40">
                      <div className="flex gap-3">
                        <button
                          onClick={() => handleConfirm(item.id)}
                          className="px-5 py-2.5 bg-ink text-paper hover:bg-[#2D2B26] text-xs font-semibold uppercase tracking-wider font-mono rounded-[4px] cursor-pointer flex items-center gap-2 border border-ink"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="square">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                          Confirm Entry
                        </button>
                        <button
                          onClick={() => startEditing(item)}
                          className="px-5 py-2.5 border border-hairline hover:border-ink text-xs font-semibold uppercase tracking-wider font-mono rounded-[4px] text-ink cursor-pointer bg-transparent"
                        >
                          Edit Content
                        </button>
                      </div>
                      <button
                        onClick={() => handleDiscard(item.id)}
                        className="px-4 py-2.5 border border-transparent hover:border-clay/30 text-xs font-semibold uppercase tracking-wider font-mono text-neutral hover:text-clay rounded-[4px] cursor-pointer bg-transparent"
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))
          )
        ) : (
          confirmedItems.length === 0 ? (
            <div className="border border-hairline p-12 text-center text-sm text-neutral">
              No confirmed accomplishments inside the ledger.
            </div>
          ) : (
            confirmedItems.map((item) => (
              <div
                key={item.id}
                className="bg-paper border border-[#1F6F4A]/30 p-8 flex flex-col gap-4 rounded-none relative overflow-hidden"
              >
                {/* Visual Indicator of Signal Confirmation */}
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#1F6F4A]"></div>

                {/* 3-Voice Card Header */}
                <div className="flex justify-between items-center text-xs font-mono text-neutral pb-2 border-b border-hairline/40">
                  <div className="flex items-center gap-3">
                    <span className="font-semibold text-ink">{item.platform}</span>
                    <span>•</span>
                    <span>{item.date}</span>
                  </div>
                  <span className="text-[#1F6F4A] font-semibold flex items-center gap-1">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="square">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    CONFIRMED LEDGER
                  </span>
                </div>

                <div className="flex flex-col gap-3">
                  <h3 className="font-fraunces text-2xl font-bold text-ink leading-tight">
                    {item.claim}
                  </h3>
                  <p className="text-sm text-neutral leading-relaxed">
                    {item.detail}
                  </p>
                </div>
              </div>
            ))
          )
        )}
      </div>
    </div>
  );
}
