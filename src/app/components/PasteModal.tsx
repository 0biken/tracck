'use client'

import React from 'react';

interface PasteModalProps {
  platform: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (count: number) => void;
}

export default function PasteModal({ platform, isOpen, onClose, onSuccess }: PasteModalProps) {
  const [inputMode, setInputMode] = React.useState<'text' | 'screenshot'>('text');
  const [textValue, setTextValue] = React.useState('');
  const [screenshotFile, setScreenshotFile] = React.useState<File | null>(null);
  const [attested, setAttested] = React.useState(false);
  const [month, setMonth] = React.useState('07');
  const [year, setYear] = React.useState('2026');
  
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [postCount, setPostCount] = React.useState(0);

  React.useEffect(() => {
    if (!isOpen) {
      setTextValue('');
      setScreenshotFile(null);
      setAttested(false);
      setIsSubmitting(false);
    }
  }, [isOpen]);

  React.useEffect(() => {
    if (inputMode === 'text' && textValue.trim()) {
      // Split by double blank lines (one or more empty lines with spacing)
      const segments = textValue.split(/\n\s*\n/).filter(segment => segment.trim().length > 0);
      setPostCount(segments.length);
    } else {
      setPostCount(textValue.trim() ? 1 : 0);
    }
  }, [textValue, inputMode]);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setScreenshotFile(e.target.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!attested) return;

    setIsSubmitting(true);
    
    try {
      const response = await fetch('/api/posts/paste', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          platform,
          source_method: inputMode === 'screenshot' ? 'file_upload' : 'manual_paste',
          text: textValue,
          ownership_attested: attested,
          posted_at_is_approximate: true,
          date: `${year}-${month}-01`,
        }),
      });

      const data = await response.json();
      
      // Artificial delay to show sync ticking
      await new Promise((resolve) => setTimeout(resolve, 1500));
      
      if (response.ok && data.success) {
        onSuccess(data.ingested_count);
      } else {
        alert(data.error || 'Ingestion failed');
      }
    } catch (err) {
      alert('Network request failed');
    } finally {
      setIsSubmitting(false);
      onClose();
    }
  };

  const months = [
    { label: 'January', value: '01' },
    { label: 'February', value: '02' },
    { label: 'March', value: '03' },
    { label: 'April', value: '04' },
    { label: 'May', value: '05' },
    { label: 'June', value: '06' },
    { label: 'July', value: '07' },
    { label: 'August', value: '08' },
    { label: 'September', value: '09' },
    { label: 'October', value: '10' },
    { label: 'November', value: '11' },
    { label: 'December', value: '12' },
  ];

  const years = Array.from({ length: 7 }, (_, i) => (2020 + i).toString());

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/75 backdrop-blur-[4px] p-6">
      <div className="w-full max-w-lg bg-paper-warm border border-hairline rounded-none flex flex-col max-h-[90vh] animate-card-entry">
        {/* Header */}
        <div className="p-6 border-b border-hairline flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-xs uppercase font-mono text-neutral">INGESTION GATEWAY</span>
            <h3 className="font-fraunces text-2xl font-bold text-ink uppercase">ADD FROM {platform}</h3>
          </div>
          <button 
            onClick={onClose}
            className="text-neutral hover:text-ink cursor-pointer"
            disabled={isSubmitting}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" strokeLinejoin="square">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
          {/* Ingestion Mode Select */}
          <div className="flex border-b border-hairline gap-4">
            <button
              type="button"
              onClick={() => setInputMode('text')}
              className={`pb-3 text-xs uppercase font-semibold tracking-wider font-mono border-b-2 transition-all ${
                inputMode === 'text' ? 'border-ink text-ink' : 'border-transparent text-neutral hover:text-ink'
              }`}
            >
              Text / Bulk Paste
            </button>
            <button
              type="button"
              onClick={() => setInputMode('screenshot')}
              className={`pb-3 text-xs uppercase font-semibold tracking-wider font-mono border-b-2 transition-all ${
                inputMode === 'screenshot' ? 'border-ink text-ink' : 'border-transparent text-neutral hover:text-ink'
              }`}
            >
              Screenshot Upload (OCR)
            </button>
          </div>

          {inputMode === 'text' ? (
            <div className="form-group">
              <label htmlFor="pastedText">Paste Post / Caption Content</label>
              <textarea
                id="pastedText"
                rows={8}
                placeholder="Paste accomplishments text here. Use double blank lines to separate multiple entries for bulk ingestion."
                value={textValue}
                onChange={(e) => setTextValue(e.target.value)}
                required
                className="w-full text-sm font-archivo border border-hairline focus:border-ink bg-paper p-3 outline-none resize-y min-h-[120px]"
              />
              {postCount > 0 && (
                <span className="text-xs font-mono text-[#1F6F4A] mt-2 block">
                  {postCount} {postCount === 1 ? 'post' : 'posts'} detected (split via double blank line)
                </span>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="form-group">
                <label>Screenshot Attachment</label>
                <div className="border border-dashed border-hairline bg-paper p-8 text-center flex flex-col items-center justify-center gap-3">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" strokeLinejoin="square" className="text-neutral">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                    <circle cx="8.5" cy="8.5" r="1.5" />
                    <polyline points="21 15 16 10 5 21" />
                  </svg>
                  <div className="flex flex-col gap-1 text-xs text-neutral">
                    <span>{screenshotFile ? screenshotFile.name : 'Select or drop image file (png, jpg)'}</span>
                    <span>JPEG, PNG up to 10MB</span>
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="hidden"
                    id="screenshotFile"
                    required={inputMode === 'screenshot'}
                  />
                  <label 
                    htmlFor="screenshotFile"
                    className="px-4 py-2 border border-hairline hover:border-ink text-xs font-semibold uppercase tracking-wider font-mono cursor-pointer rounded-[4px] mt-2"
                  >
                    Browse Local File
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* Date Picker row */}
          <div className="grid grid-cols-2 gap-4">
            <div className="form-group">
              <label htmlFor="approxMonth">Approximate Month</label>
              <select
                id="approxMonth"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                className="bg-paper border border-hairline rounded-[2px] p-3 text-sm focus:border-ink outline-none"
              >
                {months.map(m => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="approxYear">Approximate Year</label>
              <select
                id="approxYear"
                value={year}
                onChange={(e) => setYear(e.target.value)}
                className="bg-paper border border-hairline rounded-[2px] p-3 text-sm focus:border-ink outline-none"
              >
                {years.map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Attestation Checkbox */}
          <div className="flex items-start gap-3 p-4 bg-paper border border-hairline">
            <input
              type="checkbox"
              id="attest"
              checked={attested}
              onChange={(e) => setAttested(e.target.checked)}
              required
              className="mt-1 cursor-pointer w-4 h-4 rounded-[2px] border border-hairline accent-ink"
            />
            <label htmlFor="attest" className="text-xs text-neutral leading-relaxed cursor-pointer select-none">
              I attest that the pasted content or uploaded screenshot represents my own professional accomplishments and activities. I verify that this data is factually accurate.
            </label>
          </div>

          {/* Submit Action footer */}
          <div className="flex gap-4 mt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 py-3 border border-hairline hover:border-ink rounded-[4px] text-xs font-semibold uppercase tracking-wider font-mono text-ink bg-transparent cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!attested || isSubmitting}
              className="flex-1 py-3 bg-ink hover:bg-[#2D2B26] text-paper rounded-[4px] text-xs font-semibold uppercase tracking-wider font-mono cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed text-center"
            >
              {isSubmitting ? (
                <span className="sync-ticking">SYNC IN PROGRESS</span>
              ) : (
                'INGEST SUBMISSION'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
