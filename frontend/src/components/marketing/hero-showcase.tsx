'use client';

import Image from 'next/image';
import { Check, Sparkles } from 'lucide-react';
import { GridScan } from '@/components/ui/grid-scan';

export function HeroShowcase() {
  return (
    <div
      style={{ width: '100%', height: '600px', position: 'relative' }}
      className="overflow-hidden rounded-xl border border-[#3A372F] bg-[#0c0c09] shadow-2xl select-none"
    >
      {/* 1. 3D WebGL GridScan Canvas looking into the room from the front */}
      <GridScan
        linesColor="#4d4757"
        scanColor="#3FA872"
        cells={3}
        depth={3}
        scanDuration={3.3}
        scanDelay={1.6}
        clickEffect="ping"
        lineThickness={2.1}
        lineStyle="solid"
        depthFade={0.6}
        shading={0.7}
        reflection={0.35}
        points
        scanDirection="forward"
        scanWidth={1}
        trail={0.5}
        glow={0.6}
        parallax={1.3}
        autoScan
        interactive
        enableWebcam={false}
        showPreview={false}
        intro
        lightMode={false}
        className="absolute inset-0 z-0 pointer-events-auto"
      />

      {/* 2. Ambient depth lighting */}
      <div className="pointer-events-none absolute inset-0 z-1 bg-[radial-gradient(ellipse_at_center,transparent_35%,rgba(10,10,8,0.75)_95%)]" />

      {/* 3. The 3-Cell Stage Overlay (ABSOLUTE INSET-0 to sit directly over the 3D room) */}
      <div className="pointer-events-none absolute inset-0 z-10 grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 p-4 md:p-6 items-center">
        
        {/* ================= LEFT CELL: POSTS & PORTFOLIO IMAGES ================= */}
        <div
          style={{ transform: 'perspective(1000px) rotateY(12deg)', transformOrigin: 'right center' }}
          className="hidden md:flex flex-col justify-between gap-3 h-full max-h-[550px] pointer-events-auto"
        >
          {/* Top Cell: Real X Post Image */}
          <div className="group relative overflow-hidden rounded-lg border border-[#3A372F] bg-[#141310]/90 shadow-xl transition-all duration-300 hover:border-signal hover:shadow-signal/20">
            <div className="flex items-center justify-between border-b border-[#2A2720] bg-[#1a1814] px-3 py-1.5">
              <span className="font-mono text-[10px] font-semibold text-signal flex items-center gap-1.5">
                <span className="size-1.5 rounded-full bg-signal animate-pulse" />
                VERIFIED SOURCE · X POST
              </span>
              <span className="font-mono text-[9px] text-[#8A8371]">@femi_codes</span>
            </div>
            <div className="relative aspect-[16/9] w-full overflow-hidden bg-black/60">
              <Image
                src="/hero/x-post-1.jpg"
                alt="X post showing Redis caching benchmark on Railway"
                fill
                sizes="(max-width: 768px) 100vw, 33vw"
                className="object-cover transition-transform duration-300 group-hover:scale-105"
                priority
              />
            </div>
            <div className="border-t border-[#2A2720] bg-[#141310]/95 px-3 py-1.5 flex items-center justify-between text-[10px] font-mono text-[#B3AB98]">
              <span>Latency: 180ms - 24ms</span>
              <span className="text-signal font-semibold">Traced to Resume Bullet #2</span>
            </div>
          </div>

          {/* Bottom Cell: Real Portfolio Engine Card */}
          <div className="group relative overflow-hidden rounded-lg border border-[#3A372F] bg-[#141310]/90 shadow-xl transition-all duration-300 hover:border-signal hover:shadow-signal/20">
            <div className="flex items-center justify-between border-b border-[#2A2720] bg-[#1a1814] px-3 py-1.5">
              <span className="font-mono text-[10px] font-semibold text-signal flex items-center gap-1.5">
                <span className="size-1.5 rounded-full bg-signal" />
                PORTFOLIO · REPO PROOF
              </span>
              <span className="font-mono text-[9px] text-[#8A8371]">NestJS / BullMQ</span>
            </div>
            <div className="relative aspect-[16/9] w-full overflow-hidden bg-black/60">
              <Image
                src="/hero/portfolio-1.jpg"
                alt="Lemni Billing Engine portfolio card"
                fill
                sizes="(max-width: 768px) 100vw, 33vw"
                className="object-cover transition-transform duration-300 group-hover:scale-105"
                priority
              />
            </div>
            <div className="border-t border-[#2A2720] bg-[#141310]/95 px-3 py-1.5 flex items-center justify-between text-[10px] font-mono text-[#B3AB98]">
              <span>45k Daily Transactions</span>
              <span className="text-signal font-semibold">Traced to Projects</span>
            </div>
          </div>
        </div>

        {/* ================= CENTER CELL: CLEAN MODERN RESUME TEMPLATE ================= */}
        <div className="flex flex-col items-center justify-center h-full max-h-[560px] pointer-events-auto z-20">
          <div className="w-full h-full rounded-md border border-[#D6D0C4] bg-[#FAF8F5] text-[#141310] p-4 sm:p-5 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.8)] flex flex-col justify-between overflow-hidden">
            
            {/* Resume Header */}
            <div>
              <div className="flex items-baseline justify-between border-b border-[#141310]/15 pb-2">
                <div>
                  <h2 className="font-display text-lg sm:text-xl font-bold tracking-tight text-[#141310] m-0">
                    TOLU ADEBAYO
                  </h2>
                  <div className="text-[11px] font-medium text-[#5C5647]">
                    Backend Software Engineer · Lagos, Nigeria
                  </div>
                </div>
                <div className="flex items-center gap-1 rounded bg-[#E3EFE8] px-2 py-0.5 font-mono text-[9px] font-bold text-[#1F6F4A] border border-[#1F6F4A]/20">
                  <Sparkles className="size-2.5 text-[#1F6F4A]" />
                  <span>ATS VERIFIED</span>
                </div>
              </div>
              <div className="mt-1 flex flex-wrap gap-x-2 font-mono text-[10px] text-[#5C5647]">
                <span>github.com/toluadebayo</span>
                <span>·</span>
                <span>tolu@dev.ng</span>
                <span>·</span>
                <span>linkedin.com/in/toluadebayo</span>
              </div>
            </div>

            {/* Experience Section */}
            <div className="mt-2 flex-1 flex flex-col justify-center">
              <div className="flex items-center justify-between mb-1 text-[9px] font-bold tracking-[0.08em] text-[#5C5647] uppercase">
                <span>Work Experience</span>
                <span className="font-mono font-normal">2024 - Present</span>
              </div>
              <div className="text-[11px] font-bold text-[#141310]">
                Backend Engineer <span className="font-normal text-[#5C5647]">· Kora Payments</span>
              </div>
              
              <div className="mt-1.5 space-y-2">
                <div className="relative pl-4 text-[10px] leading-[15px] text-[#141310]">
                  <Check className="absolute left-0 top-0.5 size-3 text-[#1F6F4A] font-bold" strokeWidth={3} />
                  <span>
                    Architected NestJS subscription retry pipeline handling 45k daily transactions with BullMQ & Redis, reducing failed settlements by 38%.
                  </span>
                  <div className="mt-0.5 font-mono text-[8px] text-[#1F6F4A] font-semibold">
                    ✓ VERIFIED · Traced to GitHub PR #42 & Portfolio Engine
                  </div>
                </div>

                <div className="relative pl-4 text-[10px] leading-[15px] text-[#141310]">
                  <Check className="absolute left-0 top-0.5 size-3 text-[#1F6F4A] font-bold" strokeWidth={3} />
                  <span>
                    Optimized Postgres query indexes across 6 microservices, slashing p99 API latency from 180ms to 24ms under peak load.
                  </span>
                  <div className="mt-0.5 font-mono text-[8px] text-[#1F6F4A] font-semibold">
                    ✓ VERIFIED · Traced to X Benchmark Release
                  </div>
                </div>
              </div>

              {/* Projects Section */}
              <div className="mt-2 pt-2 border-t border-[#D6D0C4]/70">
                <div className="flex items-center justify-between mb-1 text-[9px] font-bold tracking-[0.08em] text-[#5C5647] uppercase">
                  <span>Selected Projects</span>
                  <span className="font-mono font-normal">Go · Redis · Docker</span>
                </div>
                <div className="relative pl-4 text-[10px] leading-[15px] text-[#141310]">
                  <Check className="absolute left-0 top-0.5 size-3 text-[#1F6F4A] font-bold" strokeWidth={3} />
                  <span>
                    Designed consistent hashing ring in Go for distributed cache sharding across 12 worker nodes.
                  </span>
                  <div className="mt-0.5 font-mono text-[8px] text-[#1F6F4A] font-semibold">
                    ✓ VERIFIED · Traced to Live GitHub Repo
                  </div>
                </div>
              </div>

              {/* Skills */}
              <div className="mt-2 pt-2 border-t border-[#D6D0C4]/70">
                <div className="text-[9px] font-bold tracking-[0.08em] text-[#5C5647] uppercase mb-0.5">
                  Technical Stack
                </div>
                <div className="font-mono text-[9px] text-[#141310] leading-tight">
                  TypeScript, Node.js, NestJS, Go, PostgreSQL, Redis, BullMQ, Docker, Git
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="border-t border-[#D6D0C4] pt-2 flex items-center justify-between font-mono text-[9px] text-[#5C5647]">
              <span className="flex items-center gap-1 text-[#1F6F4A] font-semibold">
                <Check className="size-2.5" strokeWidth={3} /> 100% ATS Passed
              </span>
              <span>1 Page Strict · PDF Export Ready</span>
            </div>

          </div>
        </div>

        {/* ================= RIGHT CELL: COMMUNITY X POST & GITHUB PR ================= */}
        <div
          style={{ transform: 'perspective(1000px) rotateY(-12deg)', transformOrigin: 'left center' }}
          className="hidden md:flex flex-col justify-between gap-3 h-full max-h-[550px] pointer-events-auto"
        >
          {/* Top Cell: Real X Community Talk Post */}
          <div className="group relative overflow-hidden rounded-lg border border-[#3A372F] bg-[#141310]/90 shadow-xl transition-all duration-300 hover:border-signal hover:shadow-signal/20">
            <div className="flex items-center justify-between border-b border-[#2A2720] bg-[#1a1814] px-3 py-1.5">
              <span className="font-mono text-[10px] font-semibold text-signal flex items-center gap-1.5">
                <span className="size-1.5 rounded-full bg-signal" />
                COMMUNITY PROOF · X POST
              </span>
              <span className="font-mono text-[9px] text-[#8A8371]">@toluadebayo</span>
            </div>
            <div className="relative aspect-[16/9] w-full overflow-hidden bg-black/60">
              <Image
                src="/hero/x-post-2.jpg"
                alt="X post of NACOS UI system design session"
                fill
                sizes="(max-width: 768px) 100vw, 33vw"
                className="object-cover transition-transform duration-300 group-hover:scale-105"
                priority
              />
            </div>
            <div className="border-t border-[#2A2720] bg-[#141310]/95 px-3 py-1.5 flex items-center justify-between text-[10px] font-mono text-[#B3AB98]">
              <span>NACOS UI Masterclass</span>
              <span className="text-signal font-semibold">Leadership Verified</span>
            </div>
          </div>

          {/* Bottom Cell: Real GitHub PR Card */}
          <div className="group relative overflow-hidden rounded-lg border border-[#3A372F] bg-[#141310]/90 shadow-xl transition-all duration-300 hover:border-signal hover:shadow-signal/20">
            <div className="flex items-center justify-between border-b border-[#2A2720] bg-[#1a1814] px-3 py-1.5">
              <span className="font-mono text-[10px] font-semibold text-signal flex items-center gap-1.5">
                <span className="size-1.5 rounded-full bg-signal" />
                GITHUB PR · CODE REVIEW
              </span>
              <span className="font-mono text-[9px] text-[#8A8371]">PR #42 Merged</span>
            </div>
            <div className="relative aspect-[16/9] w-full overflow-hidden bg-black/60">
              <Image
                src="/hero/github-pr.jpg"
                alt="GitHub PR card with BullMQ retry worker diff"
                fill
                sizes="(max-width: 768px) 100vw, 33vw"
                className="object-cover transition-transform duration-300 group-hover:scale-105"
                priority
              />
            </div>
            <div className="border-t border-[#2A2720] bg-[#141310]/95 px-3 py-1.5 flex items-center justify-between text-[10px] font-mono text-[#B3AB98]">
              <span>+342 / -45 lines · 3 commits</span>
              <span className="text-signal font-semibold">Traced to Bullet #1</span>
            </div>
          </div>
        </div>

      </div>

      {/* Floating interactive hint */}
      <div className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 z-20 font-mono text-[10px] text-[#8A8371]/90 backdrop-blur-md px-3 py-0.5 rounded-full bg-[#141310]/80 border border-[#3A372F]/60 hidden sm:block">
        3D Grid Scan · Move cursor to tilt perspective · Click to pulse
      </div>
    </div>
  );
}

export default HeroShowcase;
