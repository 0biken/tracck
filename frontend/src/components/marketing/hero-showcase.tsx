'use client';

import { Check, ExternalLink, GitCommit, GitPullRequest, Heart, MessageCircle, Repeat2, Sparkles } from 'lucide-react';
import { GridScan } from '@/components/ui/grid-scan';

export function HeroShowcase() {
  return (
    <div
      className="relative w-full h-[620px] sm:h-[660px] overflow-hidden rounded-lg border border-line-strong bg-[#0c0c09] shadow-2xl select-none"
      style={{ width: '100%' }}
    >
      {/* 3D WebGL GridScan Background */}
      <GridScan
        linesColor="#38342a"
        scanColor="#3FA872"
        cells={3}
        depth={3}
        scanDuration={3.3}
        scanDelay={1.6}
        clickEffect="ping"
        lineThickness={2.1}
        lineStyle="solid"
        depthFade={0.65}
        shading={0.75}
        reflection={0.35}
        points
        scanDirection="forward"
        scanWidth={1}
        trail={0.55}
        glow={0.7}
        parallax={1.4}
        autoScan
        interactive
        enableWebcam={false}
        showPreview={false}
        intro
        lightMode={false}
        className="absolute inset-0 z-0 pointer-events-auto"
      />

      {/* Ambient gradient vignettes */}
      <div className="pointer-events-none absolute inset-0 z-1 bg-[radial-gradient(ellipse_at_center,transparent_35%,rgba(12,12,9,0.75)_95%)]" />

      {/* Floating 3-Cell Stage Overlay */}
      <div className="pointer-events-none relative z-10 grid h-full w-full grid-cols-1 md:grid-cols-12 items-center gap-3 px-3 sm:px-6 py-4">
        
        {/* ================= LEFT CELL: BUILDER POSTS & GITHUB PROOF ================= */}
        <div className="hidden md:flex md:col-span-3 flex-col gap-3.5 pointer-events-auto perspective-[1000px]">
          {/* Badge */}
          <div className="flex items-center gap-2 self-start rounded-full border border-[#3A372F] bg-[#141310]/85 px-3 py-1 text-[11px] font-mono font-medium tracking-wide text-[#B3AB98] backdrop-blur-md">
            <span className="size-1.5 rounded-full bg-signal animate-pulse" />
            INPUT: RAW SOURCES
          </div>

          {/* Card 1: X / Twitter Post */}
          <div className="group rounded-md border border-[#3A372F] bg-[#141310]/80 p-3.5 backdrop-blur-md shadow-lg transition-all duration-300 hover:border-signal hover:translate-x-1">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="size-7 rounded-full bg-signal/20 border border-signal/40 flex items-center justify-center font-mono text-xs font-bold text-signal">
                  FA
                </div>
                <div className="leading-tight">
                  <div className="text-xs font-bold text-[#F7F5F0]">Femi Adesina</div>
                  <div className="text-[10px] font-mono text-[#8A8371]">@femi_codes · 2h</div>
                </div>
              </div>
              <span className="rounded bg-[#1E1C18] px-1.5 py-0.5 text-[9px] font-mono font-semibold text-[#B3AB98]">
                X POST
              </span>
            </div>
            <p className="text-[12px] leading-[17px] text-[#D6D0C4] m-0">
              Shipped v1.2 of our Redis caching layer on @railway. Latency dropped from 185ms to 24ms under peak load 🚀 Benchmarks in thread 👇
            </p>
            <div className="mt-2.5 flex items-center gap-4 text-[10px] font-mono text-[#8A8371]">
              <span className="flex items-center gap-1 hover:text-signal transition-colors"><Repeat2 className="size-3" /> 18</span>
              <span className="flex items-center gap-1 hover:text-red-400 transition-colors"><Heart className="size-3" /> 94</span>
              <span className="flex items-center gap-1"><MessageCircle className="size-3" /> 12</span>
            </div>
          </div>

          {/* Card 2: GitHub Merged PR */}
          <div className="group rounded-md border border-[#3A372F] bg-[#141310]/80 p-3.5 backdrop-blur-md shadow-lg transition-all duration-300 hover:border-signal hover:translate-x-1">
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-1.5 text-[11px] font-mono text-signal">
                <GitPullRequest className="size-3.5" />
                <span className="font-semibold">PR #42 MERGED</span>
              </div>
              <span className="text-[10px] font-mono text-[#8A8371]">lemni-billing</span>
            </div>
            <div className="text-xs font-semibold text-[#F7F5F0] leading-snug">
              feat(queue): Add BullMQ retry worker with exponential backoff
            </div>
            <div className="mt-2 flex items-center justify-between text-[10px] font-mono text-[#B3AB98]">
              <span className="text-[#3FA872]">+342 / -45 lines</span>
              <span className="text-[#8A8371]">Aug 18, 2026</span>
            </div>
          </div>

          {/* Card 3: Portfolio Project Snippet */}
          <div className="group rounded-md border border-[#3A372F] bg-[#141310]/80 p-3 backdrop-blur-md shadow-lg transition-all duration-300 hover:border-signal hover:translate-x-1">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-mono text-[10px] text-signal font-semibold">PORTFOLIO / CASE STUDY</span>
              <ExternalLink className="size-3 text-[#8A8371]" />
            </div>
            <div className="text-[11px] font-medium text-[#F7F5F0] mt-1">
              Distributed Payment Gateway with Go & Docker
            </div>
          </div>
        </div>

        {/* ================= CENTER CELL: CLEAN ATS RESUME TEMPLATE ================= */}
        <div className="col-span-1 md:col-span-6 flex flex-col items-center justify-center pointer-events-auto">
          {/* Top Pill */}
          <div className="mb-2 flex items-center gap-2 rounded-full border border-signal/60 bg-[#141310]/90 px-3.5 py-1 text-[11px] font-mono font-semibold text-signal shadow-lg backdrop-blur-md">
            <Sparkles className="size-3 text-signal" />
            OUTPUT: 1-PAGE TAILORED ATS RESUME
          </div>

          {/* The Resume Sheet */}
          <div className="w-full max-w-[490px] rounded-md border border-line bg-canvas p-5 sm:p-6 text-ink shadow-[0_25px_60px_-15px_rgba(0,0,0,0.7)] transition-all duration-300">
            {/* Header */}
            <div className="border-b border-ink/15 pb-3">
              <div className="flex items-baseline justify-between">
                <h2 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-ink m-0">
                  TOLU ADEBAYO
                </h2>
                <span className="font-mono text-[10px] font-bold text-signal bg-signal-tint px-2 py-0.5 rounded">
                  VERIFIED BUILDER
                </span>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 font-mono text-[11px] text-ink-muted">
                <span>Backend Engineer</span>
                <span>·</span>
                <span>Lagos, Nigeria</span>
                <span>·</span>
                <span>github.com/toluadebayo</span>
              </div>
            </div>

            {/* Experience Section */}
            <div className="mt-3.5">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] font-bold tracking-[0.1em] text-ink-muted uppercase">
                  Work Experience
                </span>
                <span className="font-mono text-[10px] text-ink-muted">2024 - Present</span>
              </div>
              <div className="text-xs font-bold text-ink">
                Backend Engineer <span className="font-normal text-ink-muted">· Kora Payments</span>
              </div>
              
              <ul className="mt-2 space-y-2 list-none p-0 m-0">
                <li className="relative pl-5 text-[11px] leading-[16px] text-ink">
                  <Check className="absolute left-0 top-0.5 size-3.5 text-signal font-bold" strokeWidth={3} />
                  <span>
                    Architected NestJS subscription retry pipeline handling 45k daily transactions with BullMQ & Redis, reducing failed settlements by 38%.
                  </span>
                  <div className="mt-0.5 font-mono text-[9px] text-signal font-medium">
                    TRACED: GitHub PR #42 · lemni-billing
                  </div>
                </li>

                <li className="relative pl-5 text-[11px] leading-[16px] text-ink">
                  <Check className="absolute left-0 top-0.5 size-3.5 text-signal font-bold" strokeWidth={3} />
                  <span>
                    Refactored Postgres query indexes across 6 microservices, slashing p99 API latency from 185ms to 24ms under peak load.
                  </span>
                  <div className="mt-0.5 font-mono text-[9px] text-signal font-medium">
                    TRACED: X benchmark release · verified
                  </div>
                </li>
              </ul>
            </div>

            {/* Projects Section */}
            <div className="mt-3.5 border-t border-line/60 pt-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-bold tracking-[0.1em] text-ink-muted uppercase">
                  Selected Technical Projects
                </span>
                <span className="font-mono text-[10px] text-ink-muted">Go · Redis · Docker</span>
              </div>
              <div className="relative pl-5 text-[11px] leading-[16px] text-ink">
                <Check className="absolute left-0 top-0.5 size-3.5 text-signal font-bold" strokeWidth={3} />
                <span>
                  Designed consistent hashing ring in Go for distributed cache sharding across 12 worker nodes.
                </span>
                <div className="mt-0.5 font-mono text-[9px] text-signal font-medium">
                  TRACED: Live Portfolio Repository
                </div>
              </div>
            </div>

            {/* Footer verification stamp */}
            <div className="mt-3.5 flex items-center justify-between border-t border-line/60 pt-2 text-[10px] font-mono text-ink-muted">
              <span className="flex items-center gap-1 text-signal font-semibold">
                <Check className="size-3" strokeWidth={3} /> 100% ATS Passed
              </span>
              <span>1 Page Strict · PDF & DOCX</span>
            </div>
          </div>
        </div>

        {/* ================= RIGHT CELL: COMMUNITY, DEVREL & TALKS ================= */}
        <div className="hidden md:flex md:col-span-3 flex-col gap-3.5 pointer-events-auto perspective-[1000px]">
          {/* Badge */}
          <div className="flex items-center gap-2 self-end rounded-full border border-[#3A372F] bg-[#141310]/85 px-3 py-1 text-[11px] font-mono font-medium tracking-wide text-[#B3AB98] backdrop-blur-md">
            <span>REAL-TIME ENGINE</span>
            <span className="size-1.5 rounded-full bg-signal" />
          </div>

          {/* Card 1: X Community Post */}
          <div className="group rounded-md border border-[#3A372F] bg-[#141310]/80 p-3.5 backdrop-blur-md shadow-lg transition-all duration-300 hover:border-signal hover:-translate-x-1">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="size-7 rounded-full bg-signal/20 border border-signal/40 flex items-center justify-center font-mono text-xs font-bold text-signal">
                  TA
                </div>
                <div className="leading-tight">
                  <div className="text-xs font-bold text-[#F7F5F0]">Tolu Adebayo</div>
                  <div className="text-[10px] font-mono text-[#8A8371]">@toluadebayo · 3d</div>
                </div>
              </div>
              <span className="rounded bg-[#1E1C18] px-1.5 py-0.5 text-[9px] font-mono font-semibold text-[#B3AB98]">
                X POST
              </span>
            </div>
            <p className="text-[12px] leading-[17px] text-[#D6D0C4] m-0">
              Honored to lead 120+ student devs at NACOS UI on system design and distributed queue patterns with BullMQ! Slides linked below 👇
            </p>
            <div className="mt-2.5 flex items-center gap-4 text-[10px] font-mono text-[#8A8371]">
              <span className="flex items-center gap-1 hover:text-signal transition-colors"><Repeat2 className="size-3" /> 42</span>
              <span className="flex items-center gap-1 hover:text-red-400 transition-colors"><Heart className="size-3" /> 186</span>
            </div>
          </div>

          {/* Card 2: Git Commit Activity */}
          <div className="group rounded-md border border-[#3A372F] bg-[#141310]/80 p-3.5 backdrop-blur-md shadow-lg transition-all duration-300 hover:border-signal hover:-translate-x-1">
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-1.5 text-[11px] font-mono text-signal">
                <GitCommit className="size-3.5" />
                <span className="font-semibold">COMMIT VERIFIED</span>
              </div>
              <span className="text-[10px] font-mono text-[#8A8371]">7b4e9f2</span>
            </div>
            <div className="text-xs font-semibold text-[#F7F5F0] leading-snug">
              perf(db): Composite indexing for settlement batch query
            </div>
            <div className="mt-2 flex items-center justify-between text-[10px] font-mono text-[#B3AB98]">
              <span>PostgreSQL · NestJS</span>
              <span className="text-signal font-semibold">Verified Source</span>
            </div>
          </div>

          {/* Card 3: SIWES / Internship Milestone */}
          <div className="group rounded-md border border-[#3A372F] bg-[#141310]/80 p-3 backdrop-blur-md shadow-lg transition-all duration-300 hover:border-signal hover:-translate-x-1">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-mono text-[10px] text-signal font-semibold">SIWES / INTERNSHIP RECORD</span>
              <span className="text-[10px] font-mono text-[#8A8371]">2024</span>
            </div>
            <div className="text-[11px] font-medium text-[#F7F5F0] mt-1">
              Automated ₦120M batch settlement reconciliation
            </div>
          </div>
        </div>

      </div>

      {/* Bottom subtle prompt */}
      <div className="pointer-events-none absolute bottom-2.5 left-1/2 -translate-x-1/2 z-20 font-mono text-[11px] text-[#8A8371]/80 backdrop-blur-sm px-3 py-0.5 rounded-full bg-[#141310]/60 border border-[#3A372F]/50 hidden sm:block">
        Hover to tilt 3D perspective · Click anywhere to send a scan pulse
      </div>
    </div>
  );
}

export default HeroShowcase;
