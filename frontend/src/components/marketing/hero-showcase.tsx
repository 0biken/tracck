'use client';

import Image from 'next/image';
import { Check, Sparkles } from 'lucide-react';
import { GridScan } from '@/components/ui/grid-scan';

export function HeroShowcase() {
  return (
    <div
      style={{ width: '100%', height: '720px', position: 'relative' }}
      className="overflow-hidden rounded-2xl border border-[#3A372F] bg-[#090907] shadow-[0_35px_100px_rgba(0,0,0,0.95)] select-none"
    >
      {/* 1. 3D WebGL GridScan Canvas looking from the front within */}
      <GridScan
        linesColor="#38352b"
        scanColor="#3FA872"
        cells={3}
        depth={3}
        scanDuration={3.2}
        scanDelay={1.4}
        clickEffect="ping"
        lineThickness={1.8}
        lineStyle="solid"
        depthFade={0.5}
        shading={0.7}
        reflection={0.35}
        points
        scanDirection="forward"
        scanWidth={1}
        trail={0.5}
        glow={0.8}
        parallax={1.4}
        autoScan
        interactive
        enableWebcam={false}
        showPreview={false}
        intro
        lightMode={false}
        className="absolute inset-0 z-0 pointer-events-auto"
      />

      {/* 2. Vignette to blend outer edges with the dark canvas */}
      <div className="pointer-events-none absolute inset-0 z-1 bg-[radial-gradient(ellipse_at_center,transparent_38%,rgba(9,9,7,0.85)_95%)]" />

      {/* 3. 3D Spatial Wall & Center Stage Overlay */}
      <div
        style={{ perspective: '1200px', transformStyle: 'preserve-3d' }}
        className="pointer-events-none absolute inset-0 z-10 flex items-center justify-between px-3 sm:px-6 lg:px-8 py-4"
      >
        {/* ================= LEFT WALL (Angled into 3D Depth) ================= */}
        <div
          style={{
            transform: 'perspective(1100px) rotateY(32deg) translateZ(-15px)',
            transformOrigin: 'left center',
          }}
          className="hidden md:grid grid-cols-2 gap-3 w-[360px] lg:w-[410px] h-[640px] pointer-events-auto items-center"
        >
          {/* Left Column 1 (Front Cell Wall: Real X Posts) */}
          <div className="flex flex-col gap-3 justify-center">
            {/* Cell 1: X Post by Femi (Redis Latency Drop) */}
            <div className="group relative overflow-hidden rounded-lg border border-[#3A372F]/90 bg-[#141310]/85 shadow-[0_12px_28px_rgba(0,0,0,0.6)] backdrop-blur-md transition-all duration-300 hover:border-signal hover:shadow-signal/25">
              <div className="flex items-center justify-between border-b border-[#2A2720] bg-[#171612] px-2.5 py-1">
                <span className="font-mono text-[9px] font-semibold text-signal flex items-center gap-1">
                  <span className="size-1.5 rounded-full bg-signal animate-pulse" />
                  X POST · PROOF
                </span>
                <span className="font-mono text-[8px] text-[#8A8371]">@femi_codes</span>
              </div>
              <div className="relative aspect-[16/9] w-full overflow-hidden bg-black/60">
                <Image
                  src="/hero/x-post-1.jpg"
                  alt="X post showing Redis caching benchmark on Railway"
                  fill
                  sizes="200px"
                  className="object-cover transition-transform duration-300 group-hover:scale-105"
                  priority
                />
              </div>
              <div className="border-t border-[#2A2720] bg-[#141310]/95 px-2.5 py-1 flex items-center justify-between text-[8px] font-mono text-[#B3AB98]">
                <span>180ms to 24ms</span>
                <span className="text-signal font-semibold">Traced Bullet</span>
              </div>
            </div>

            {/* Cell 2: X Post by Chidi (BullMQ & Redis Deployment) */}
            <div className="group relative overflow-hidden rounded-lg border border-[#3A372F]/90 bg-[#141310]/85 shadow-[0_12px_28px_rgba(0,0,0,0.6)] backdrop-blur-md transition-all duration-300 hover:border-signal hover:shadow-signal/25">
              <div className="flex items-center justify-between border-b border-[#2A2720] bg-[#171612] px-2.5 py-1">
                <span className="font-mono text-[9px] font-semibold text-signal flex items-center gap-1">
                  <span className="size-1.5 rounded-full bg-signal" />
                  X POST · QUEUES
                </span>
                <span className="font-mono text-[8px] text-[#8A8371]">@chidi_codes</span>
              </div>
              <div className="relative aspect-[16/9] w-full overflow-hidden bg-black/60">
                <Image
                  src="/hero/x-post-chidi.jpg"
                  alt="X post by Chidi Nwosu deploying BullMQ retry worker"
                  fill
                  sizes="200px"
                  className="object-cover transition-transform duration-300 group-hover:scale-105"
                  priority
                />
              </div>
              <div className="border-t border-[#2A2720] bg-[#141310]/95 px-2.5 py-1 flex items-center justify-between text-[8px] font-mono text-[#B3AB98]">
                <span>45k Webhook Events</span>
                <span className="text-signal font-semibold">Traced Bullet</span>
              </div>
            </div>
          </div>

          {/* Left Column 2 (Depth Cell Wall: Real X Posts) */}
          <div className="flex flex-col gap-3 justify-center opacity-85 hover:opacity-100 transition-opacity">
            {/* Cell 3: X Post by Emmanuel (Consistent Hashing in Go) */}
            <div className="group relative overflow-hidden rounded-lg border border-[#3A372F]/80 bg-[#141310]/80 shadow-[0_12px_28px_rgba(0,0,0,0.6)] backdrop-blur-md transition-all duration-300 hover:border-signal">
              <div className="flex items-center justify-between border-b border-[#2A2720] bg-[#171612] px-2.5 py-1">
                <span className="font-mono text-[9px] font-semibold text-signal">X POST · GO HASH</span>
                <span className="font-mono text-[8px] text-[#8A8371]">@emmanuel_dev</span>
              </div>
              <div className="relative aspect-[16/9] w-full overflow-hidden bg-black/60">
                <Image
                  src="/hero/x-post-hashing.jpg"
                  alt="X post on Go consistent hashing virtual ring across 12 nodes"
                  fill
                  sizes="200px"
                  className="object-cover transition-transform duration-300 group-hover:scale-105"
                />
              </div>
              <div className="border-t border-[#2A2720] bg-[#141310]/95 px-2.5 py-1 flex items-center justify-between text-[8px] font-mono text-[#B3AB98]">
                <span>-42% Memory Overhead</span>
                <span className="text-signal font-semibold">Verified Spec</span>
              </div>
            </div>

            {/* Cell 4: X Post by Tolu (SIWES 120M Reconciliation) */}
            <div className="group relative overflow-hidden rounded-lg border border-[#3A372F]/80 bg-[#141310]/80 shadow-[0_12px_28px_rgba(0,0,0,0.6)] backdrop-blur-md transition-all duration-300 hover:border-signal">
              <div className="flex items-center justify-between border-b border-[#2A2720] bg-[#171612] px-2.5 py-1">
                <span className="font-mono text-[9px] font-semibold text-signal">X POST · SIWES</span>
                <span className="font-mono text-[8px] text-[#8A8371]">@toluadebayo</span>
              </div>
              <div className="relative aspect-[16/9] w-full overflow-hidden bg-black/60">
                <Image
                  src="/hero/x-post-siwes.jpg"
                  alt="X post on 120M monthly batch settlement reconciliation"
                  fill
                  sizes="200px"
                  className="object-cover transition-transform duration-300 group-hover:scale-105"
                />
              </div>
              <div className="border-t border-[#2A2720] bg-[#141310]/95 px-2.5 py-1 flex items-center justify-between text-[8px] font-mono text-[#B3AB98]">
                <span>0 Reconciliation Errors</span>
                <span className="text-signal font-semibold">Published Proof</span>
              </div>
            </div>
          </div>
        </div>

        {/* ================= CENTER CELL: CLEAN MINIMALIST RESUME ================= */}
        <div
          style={{ transform: 'translateZ(40px)' }}
          className="mx-auto flex flex-col items-center justify-center pointer-events-auto z-20 w-full max-w-[340px] sm:max-w-[370px] lg:max-w-[400px]"
        >
          {/* Top Verification Pill */}
          <div className="mb-2.5 flex items-center gap-1.5 rounded-full border border-signal/50 bg-[#141310]/95 px-3.5 py-1 text-[10px] font-mono font-semibold text-signal shadow-lg backdrop-blur-md">
            <Sparkles className="size-2.5 text-signal" />
            <span>VERIFIED ATS RESUME · 1-PAGE CLEAN</span>
          </div>

          {/* Clean High-Resolution Generated Resume Card */}
          <div className="group relative w-full aspect-[4/5] rounded-lg border border-[#D6D0C4] bg-[#FCFBF9] shadow-[0_25px_70px_rgba(0,0,0,0.95),0_0_45px_rgba(63,168,114,0.22)] overflow-hidden transition-all duration-300 hover:scale-[1.01] hover:border-signal">
            <Image
              src="/hero/resume-clean.jpg"
              alt="Ultra-clean verified 1-page ATS resume for Tolu Adebayo"
              fill
              sizes="(max-width: 768px) 90vw, 400px"
              className="object-cover object-top"
              priority
            />
            {/* Subtle gloss overlay */}
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/10 via-transparent to-black/5" />
          </div>

          {/* Bottom Live Tracing Status */}
          <div className="mt-2.5 flex items-center gap-2 font-mono text-[9px] text-[#B3AB98] bg-[#141310]/90 px-3.5 py-1 rounded-full border border-[#2A2720] shadow-md">
            <Check className="size-2.5 text-signal" strokeWidth={3} />
            <span>Every bullet traces to public work on left & right walls</span>
          </div>
        </div>

        {/* ================= RIGHT WALL (Angled into 3D Depth) ================= */}
        <div
          style={{
            transform: 'perspective(1100px) rotateY(-32deg) translateZ(-15px)',
            transformOrigin: 'right center',
          }}
          className="hidden md:grid grid-cols-2 gap-3 w-[360px] lg:w-[410px] h-[640px] pointer-events-auto items-center"
        >
          {/* Right Column 1 (Depth Cell Wall: Real X Posts & GitHub) */}
          <div className="flex flex-col gap-3 justify-center opacity-85 hover:opacity-100 transition-opacity">
            {/* Cell 5: Recruiter/Lead Praise X Post */}
            <div className="group relative overflow-hidden rounded-lg border border-[#3A372F]/80 bg-[#141310]/80 shadow-[0_12px_28px_rgba(0,0,0,0.6)] backdrop-blur-md transition-all duration-300 hover:border-signal">
              <div className="flex items-center justify-between border-b border-[#2A2720] bg-[#171612] px-2.5 py-1">
                <span className="font-mono text-[9px] font-semibold text-signal">X POST · REVIEW</span>
                <span className="font-mono text-[8px] text-[#8A8371]">@david_tech</span>
              </div>
              <div className="relative aspect-[16/9] w-full overflow-hidden bg-black/60">
                <Image
                  src="/hero/x-post-3.jpg"
                  alt="Recruiter and Tech Lead praise X post for Tolu Adebayo"
                  fill
                  sizes="200px"
                  className="object-cover transition-transform duration-300 group-hover:scale-105"
                />
              </div>
              <div className="border-t border-[#2A2720] bg-[#141310]/95 px-2.5 py-1 flex items-center justify-between text-[8px] font-mono text-[#B3AB98]">
                <span>PR Code Review</span>
                <span className="text-signal font-semibold">Endorsement</span>
              </div>
            </div>

            {/* Cell 6: GitHub Commit Heatmap */}
            <div className="group relative overflow-hidden rounded-lg border border-[#3A372F]/80 bg-[#141310]/80 shadow-[0_12px_28px_rgba(0,0,0,0.6)] backdrop-blur-md transition-all duration-300 hover:border-signal">
              <div className="flex items-center justify-between border-b border-[#2A2720] bg-[#171612] px-2.5 py-1">
                <span className="font-mono text-[9px] font-semibold text-signal">COMMIT GRAPH</span>
                <span className="font-mono text-[8px] text-[#8A8371]">1,248 Commits</span>
              </div>
              <div className="relative aspect-[16/9] w-full overflow-hidden bg-black/60">
                <Image
                  src="/hero/github-heatmap.jpg"
                  alt="GitHub 2026 commit activity heatmap"
                  fill
                  sizes="200px"
                  className="object-cover transition-transform duration-300 group-hover:scale-105"
                />
              </div>
              <div className="border-t border-[#2A2720] bg-[#141310]/95 px-2.5 py-1 flex items-center justify-between text-[8px] font-mono text-[#B3AB98]">
                <span>84-Day Streak</span>
                <span className="text-signal font-semibold">Active Builder</span>
              </div>
            </div>
          </div>

          {/* Right Column 2 (Front Cell Wall: Real X Posts & GitHub PR) */}
          <div className="flex flex-col gap-3 justify-center">
            {/* Cell 7: X Post by Tolu (NACOS Talk) */}
            <div className="group relative overflow-hidden rounded-lg border border-[#3A372F]/90 bg-[#141310]/85 shadow-[0_12px_28px_rgba(0,0,0,0.6)] backdrop-blur-md transition-all duration-300 hover:border-signal hover:shadow-signal/25">
              <div className="flex items-center justify-between border-b border-[#2A2720] bg-[#171612] px-2.5 py-1">
                <span className="font-mono text-[9px] font-semibold text-signal flex items-center gap-1">
                  <span className="size-1.5 rounded-full bg-signal" />
                  X POST · TALK
                </span>
                <span className="font-mono text-[8px] text-[#8A8371]">@toluadebayo</span>
              </div>
              <div className="relative aspect-[16/9] w-full overflow-hidden bg-black/60">
                <Image
                  src="/hero/x-post-2.jpg"
                  alt="X post of NACOS UI system design masterclass"
                  fill
                  sizes="200px"
                  className="object-cover transition-transform duration-300 group-hover:scale-105"
                  priority
                />
              </div>
              <div className="border-t border-[#2A2720] bg-[#141310]/95 px-2.5 py-1 flex items-center justify-between text-[8px] font-mono text-[#B3AB98]">
                <span>NACOS UI Masterclass</span>
                <span className="text-signal font-semibold">Leadership Proof</span>
              </div>
            </div>

            {/* Cell 8: GitHub PR #42 Card */}
            <div className="group relative overflow-hidden rounded-lg border border-[#3A372F]/90 bg-[#141310]/85 shadow-[0_12px_28px_rgba(0,0,0,0.6)] backdrop-blur-md transition-all duration-300 hover:border-signal hover:shadow-signal/25">
              <div className="flex items-center justify-between border-b border-[#2A2720] bg-[#171612] px-2.5 py-1">
                <span className="font-mono text-[9px] font-semibold text-signal flex items-center gap-1">
                  <span className="size-1.5 rounded-full bg-signal" />
                  GITHUB PR #42
                </span>
                <span className="font-mono text-[8px] text-[#8A8371]">Merged Code</span>
              </div>
              <div className="relative aspect-[16/9] w-full overflow-hidden bg-black/60">
                <Image
                  src="/hero/github-pr.jpg"
                  alt="GitHub PR card with BullMQ retry worker diff"
                  fill
                  sizes="200px"
                  className="object-cover transition-transform duration-300 group-hover:scale-105"
                  priority
                />
              </div>
              <div className="border-t border-[#2A2720] bg-[#141310]/95 px-2.5 py-1 flex items-center justify-between text-[8px] font-mono text-[#B3AB98]">
                <span>+342 / -45 lines · 3 commits</span>
                <span className="text-signal font-semibold">Traced Bullet</span>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* Subtle bottom guidance */}
      <div className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 z-20 font-mono text-[10px] text-[#8A8371]/80 backdrop-blur-md px-3.5 py-0.5 rounded-full bg-[#141310]/70 border border-[#3A372F]/50 hidden sm:block">
        3D Grid Scan · Move cursor to tilt perspective · Click to pulse
      </div>
    </div>
  );
}

export default HeroShowcase;
