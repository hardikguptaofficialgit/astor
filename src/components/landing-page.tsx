'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { AstorMark } from './astor-mark';
import { useTheme } from './theme-provider';
import {
  Sun,
  Moon,
  Laptop,
  ArrowRight,
  Check,
  Globe,
  Brain,
  Sparkles,
  Compass,
  Clock,
  ExternalLink,
  Copy,
  RotateCw,
  ThumbsUp,
  ThumbsDown,
  ArrowUp,
  PanelLeft,
  Plus,
} from 'lucide-react';

export function LandingPage() {
  const { theme, setTheme } = useTheme();
  const [activeCitation, setActiveCitation] = useState<number | null>(1);
  const [copiedCode, setCopiedCode] = useState(false);

  const handleCopyCode = () => {
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] transition-colors duration-200 selection:bg-[var(--hover)] font-sans antialiased overflow-x-hidden">
      {/* Editorial Top Border Accent */}
      <div className="h-[2px] w-full bg-[var(--text)]" />

      {/* ==================== NAVBAR ==================== */}
      <header className="w-full border-b border-[var(--border)] bg-[var(--bg)]/90 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          {/* Left: Brand */}
          <Link href="/" className="flex items-center gap-2.5 group">
            <AstorMark size={24} className="text-[var(--text)] group-hover:opacity-80 transition-opacity" />
            <span className="font-serif text-xl font-medium tracking-tight">Astor</span>
          </Link>

          {/* Right: Theme Switch & Actions */}
          <div className="flex items-center gap-2.5">
            {/* Theme Toggle */}
            <div className="flex items-center p-0.5 rounded-lg border border-[var(--border)] bg-[var(--sidebar-bg)] text-xs">
              <button
                type="button"
                onClick={() => setTheme('light')}
                className={`p-1 rounded-md transition-colors ${
                  theme === 'light'
                    ? 'bg-[var(--popover-bg)] text-[var(--text)] shadow-xs'
                    : 'text-[var(--secondary)] hover:text-[var(--text)]'
                }`}
                title="Light mode"
                aria-label="Light mode"
              >
                <Sun size={12} />
              </button>
              <button
                type="button"
                onClick={() => setTheme('dark')}
                className={`p-1 rounded-md transition-colors ${
                  theme === 'dark'
                    ? 'bg-[var(--popover-bg)] text-[var(--text)] shadow-xs'
                    : 'text-[var(--secondary)] hover:text-[var(--text)]'
                }`}
                title="Dark mode"
                aria-label="Dark mode"
              >
                <Moon size={12} />
              </button>
              <button
                type="button"
                onClick={() => setTheme('system')}
                className={`p-1 rounded-md transition-colors ${
                  theme === 'system'
                    ? 'bg-[var(--popover-bg)] text-[var(--text)] shadow-xs'
                    : 'text-[var(--secondary)] hover:text-[var(--text)]'
                }`}
                title="System theme"
                aria-label="System theme"
              >
                <Laptop size={12} />
              </button>
            </div>

            <Link
              href="/login"
              className="text-xs font-medium text-[var(--secondary)] hover:text-[var(--text)] px-2.5 py-1.5 rounded-lg hover:bg-[var(--hover)] transition-colors"
            >
              Sign in
            </Link>

            <Link
              href="/?guest=1"
              className="text-xs font-medium bg-[var(--text)] text-[var(--bg)] hover:opacity-90 px-3.5 py-1.5 rounded-lg transition-all shadow-xs"
            >
              Start chatting
            </Link>
          </div>
        </div>
      </header>

      {/* ==================== HERO SECTION WITH PIXEL RGB RAINBOW GRADIENT ==================== */}
      <section className="relative pt-16 sm:pt-24 pb-14 sm:pb-20 px-4 sm:px-6 max-w-5xl mx-auto text-center border-b border-[var(--border)] overflow-hidden">
        {/* Pixel RGB Rainbow Gradient Ambient Glow Background */}
        <div
          className="absolute inset-0 pointer-events-none select-none z-0"
          aria-hidden="true"
        >
          {/* Radiant RGB Rainbow Mesh Glow */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[340px] rgb-rainbow-glow opacity-80 dark:opacity-60" />

          {/* Crisp Pixel Grid Overlay */}
          <div className="absolute inset-0 pixel-grid-overlay [mask-image:radial-gradient(ellipse_at_center_top,black_40%,transparent_80%)]" />

          {/* Retro Pixel Rainbow Matrix Accents */}
          <div className="absolute top-6 left-1/2 -translate-x-1/2 flex items-center gap-1.5 opacity-60">
            <span className="w-1.5 h-1.5 rounded-xs bg-[#FF3B30]" />
            <span className="w-1.5 h-1.5 rounded-xs bg-[#FF9500]" />
            <span className="w-1.5 h-1.5 rounded-xs bg-[#FFCC00]" />
            <span className="w-1.5 h-1.5 rounded-xs bg-[#34C759]" />
            <span className="w-1.5 h-1.5 rounded-xs bg-[#00C7BE]" />
            <span className="w-1.5 h-1.5 rounded-xs bg-[#007AFF]" />
            <span className="w-1.5 h-1.5 rounded-xs bg-[#AF52DE]" />
          </div>
        </div>

        {/* Foreground Hero Content */}
        <div className="relative z-10 space-y-5 max-w-3xl mx-auto">
          {/* Eyebrow */}
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[var(--border)] bg-[var(--popover-bg)]/80 backdrop-blur-xs text-xs text-[var(--secondary)] shadow-2xs">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--text)]" />
            <span>A calmer, more thoughtful AI assistant</span>
          </div>

          {/* Minimalist Headline */}
          <h1 className="font-serif text-4xl sm:text-5xl md:text-6xl font-normal tracking-tight text-[var(--text)] leading-[1.14]">
            An AI assistant that actually remembers and gives you real answers.
          </h1>

          {/* Value Proposition */}
          <p className="text-base sm:text-lg text-[var(--secondary)] max-w-2xl mx-auto leading-relaxed">
            Astor searches the live web for verified facts, cites its sources so you can check them yourself,
            and remembers past discussions so you never have to repeat yourself.
          </p>

          {/* CTA Buttons */}
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/?guest=1"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-[var(--text)] text-[var(--bg)] hover:opacity-90 text-sm font-medium transition-opacity shadow-sm"
            >
              <span>Start chatting — it&apos;s free</span>
              <ArrowRight size={14} />
            </Link>

            <a
              href="/api/auth/oauth/google"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--popover-bg)] hover:bg-[var(--hover)] text-sm font-medium text-[var(--text)] transition-colors shadow-2xs"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="currentColor"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="currentColor"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="currentColor"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>Continue with Google</span>
            </a>
          </div>
        </div>

        {/* ==================== REAL ASTOR CHAT PREVIEW ==================== */}
        <div className="relative z-10 mt-12 sm:mt-14 rounded-2xl border border-[var(--border)] bg-[var(--bg)] shadow-xl overflow-hidden text-left max-w-4xl mx-auto">
          {/* Top Bar (Exact Astor Chat Window Header) */}
          <div className="h-10 px-4 border-b border-[var(--border)] bg-[var(--sidebar-bg)] flex items-center justify-between text-xs">
            <div className="flex items-center gap-2.5">
              <div className="text-[var(--secondary)]">
                <PanelLeft size={15} />
              </div>
              <span className="font-medium text-[var(--text)]">Architecture &amp; Reading List</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-[var(--secondary)] font-mono">Muse Spark</span>
              <div className="w-5 h-5 rounded border border-[var(--border)] flex items-center justify-center text-[var(--secondary)]">
                <Plus size={12} />
              </div>
            </div>
          </div>

          {/* Chat Messages Body */}
          <div className="p-5 sm:p-7 space-y-5 bg-[var(--bg)]">
            {/* User Message Bubble */}
            <div className="flex justify-end">
              <div className="max-w-[85%] sm:max-w-[75%] rounded-[14px] px-4 py-2.5 bg-[var(--user-bubble)] text-[var(--text)] text-[14px] sm:text-[15px] font-sans leading-relaxed shadow-2xs">
                Can you recommend 3 timeless books on architecture, and remind me which one we talked about last week?
              </div>
            </div>

            {/* Assistant Response Container */}
            <div className="space-y-3">
              {/* Searching Indicator */}
              <div className="flex items-center gap-2 text-xs text-[var(--secondary)] font-sans py-0.5">
                <Globe size={13} className="text-[var(--secondary)] animate-spin" />
                <span>Searching the web: &quot;classic architecture books fundamentals&quot;</span>
              </div>

              {/* Memory Card (Real Astor History Component) */}
              <div className="rounded-xl border border-[var(--border)] bg-[var(--hover)]/30 p-3 text-xs font-sans text-[var(--text)]">
                <div className="flex items-center gap-1.5 font-medium text-[var(--secondary)] mb-1.5 uppercase tracking-wider text-[11px]">
                  <Clock size={12} />
                  <span>From your history (1)</span>
                </div>
                <div className="flex items-start justify-between gap-3 pt-1 border-t border-[var(--border)]/40">
                  <div className="space-y-0.5 min-w-0">
                    <div className="text-[11px] font-mono text-[var(--secondary)]">14 Nov 2026</div>
                    <div className="text-[13px] text-[var(--text)]">
                      You were reading &quot;The Design of Everyday Things&quot; by Don Norman.
                    </div>
                  </div>
                  <span className="shrink-0 flex items-center gap-1 text-[11px] font-mono text-[var(--secondary)] px-2 py-0.5 rounded border border-[var(--border)] bg-[var(--bg)]">
                    <span>View</span>
                    <ExternalLink size={10} />
                  </span>
                </div>
              </div>

              {/* Assistant Message Prose */}
              <div className="font-serif text-[15px] sm:text-[16.5px] leading-relaxed text-[var(--text)] space-y-3">
                <p>
                  Building on your reading of Don Norman&apos;s work last week, here are three foundational
                  books that explore how spaces shape human thought:
                </p>
                <p>
                  <strong>1. A Pattern Language by Christopher Alexander</strong> — A catalogue of 253 patterns
                  for designing homes, neighborhoods, and towns{' '}
                  <button
                    type="button"
                    onClick={() => setActiveCitation(activeCitation === 1 ? null : 1)}
                    className="inline-flex items-center justify-center font-mono text-[11px] font-semibold text-[var(--text)] bg-[var(--hover)] px-1.5 py-0.5 rounded border border-[var(--border)] hover:bg-[var(--text)] hover:text-[var(--bg)] transition-colors align-baseline mx-0.5"
                    title="Click to view source"
                  >
                    [1]
                  </button>
                  .
                </p>
                <p>
                  <strong>2. The Eyes of the Skin by Juhani Pallasmaa</strong> — A sensory exploration
                  arguing that true architecture engages touch, sound, and memory, not just the eyes{' '}
                  <button
                    type="button"
                    onClick={() => setActiveCitation(activeCitation === 2 ? null : 2)}
                    className="inline-flex items-center justify-center font-mono text-[11px] font-semibold text-[var(--text)] bg-[var(--hover)] px-1.5 py-0.5 rounded border border-[var(--border)] hover:bg-[var(--text)] hover:text-[var(--bg)] transition-colors align-baseline mx-0.5"
                    title="Click to view source"
                  >
                    [2]
                  </button>
                  .
                </p>
              </div>

              {/* Active Citation Popover Card */}
              {activeCitation && (
                <div className="p-3 rounded-xl border border-[var(--border)] bg-[var(--popover-bg)] shadow-md space-y-1.5 text-xs animate-popover">
                  <div className="flex items-center justify-between text-[11px] font-mono text-[var(--secondary)]">
                    <span className="font-medium text-[var(--text)]">
                      {activeCitation === 1 ? 'Source [1] · architecturalreview.com' : 'Source [2] · wiley.com'}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[var(--text)] underline">
                      <span>Visit source</span>
                      <ExternalLink size={10} />
                    </span>
                  </div>
                  <div className="text-xs font-semibold text-[var(--text)]">
                    {activeCitation === 1
                      ? 'Why Christopher Alexander’s Pattern Language Still Matters'
                      : 'The Eyes of the Skin: Architecture and the Senses'}
                  </div>
                  <div className="text-[11.5px] text-[var(--secondary)] leading-relaxed font-sans">
                    {activeCitation === 1
                      ? 'Alexander provides a shared vocabulary of patterns that connect architectural form to human well-being.'
                      : 'Pallasmaa challenges visual hegemony in architecture, exploring haptic perception and emotional resonance.'}
                  </div>
                </div>
              )}

              {/* Action Toolbar */}
              <div className="flex items-center gap-2 pt-1 text-[var(--secondary)] text-xs">
                <button
                  type="button"
                  className="p-1 rounded-md hover:text-[var(--text)] hover:bg-[var(--hover)] transition-colors"
                  title="Copy"
                >
                  <Copy size={13} />
                </button>
                <button
                  type="button"
                  className="p-1 rounded-md hover:text-[var(--text)] hover:bg-[var(--hover)] transition-colors"
                  title="Helpful"
                >
                  <ThumbsUp size={13} />
                </button>
                <button
                  type="button"
                  className="p-1 rounded-md hover:text-[var(--text)] hover:bg-[var(--hover)] transition-colors"
                  title="Not helpful"
                >
                  <ThumbsDown size={13} />
                </button>
                <button
                  type="button"
                  className="p-1 rounded-md hover:text-[var(--text)] hover:bg-[var(--hover)] transition-colors"
                  title="Retry"
                >
                  <RotateCw size={13} />
                </button>
                <span className="text-[10px] font-mono pl-1">Just now</span>
              </div>
            </div>

            {/* Bottom Real Astor Composer */}
            <div className="pt-2">
              <div className="rounded-[18px] border border-[var(--border)] bg-[var(--composer-bg)] p-3 shadow-sm flex flex-col justify-between">
                <div className="text-xs text-[var(--secondary)] py-1 font-sans">
                  Ask a follow-up question or start a new topic...
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-[var(--border)]/60">
                  <div className="flex items-center gap-1.5 text-xs text-[var(--secondary)]">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[var(--hover)] text-[var(--text)] text-[11px]">
                      <Globe size={11} />
                      <span>Web search on</span>
                    </span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[var(--hover)] text-[var(--text)] text-[11px]">
                      <Brain size={11} />
                      <span>Memory on</span>
                    </span>
                  </div>
                  <div className="w-7 h-7 rounded-full bg-[var(--text)] text-[var(--bg)] flex items-center justify-center">
                    <ArrowUp size={14} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ==================== 3 HIGH-IMPACT BENTO CARDS ==================== */}
      <section className="py-16 sm:py-20 px-4 sm:px-6 max-w-5xl mx-auto border-b border-[var(--border)]">
        <div className="text-center max-w-2xl mx-auto mb-12 space-y-2.5">
          <h2 className="font-serif text-3xl sm:text-4xl font-normal tracking-tight text-[var(--text)]">
            Everything you need. Nothing you don&apos;t.
          </h2>
          <p className="text-sm text-[var(--secondary)]">
            Three simple features that make Astor feel completely different from other AI chats.
          </p>
        </div>

        {/* 3 Focused Bento Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Card 1: Live Web Search with Real Citation Drawer */}
          <div className="p-6 rounded-2xl border border-[var(--border)] bg-[var(--popover-bg)] flex flex-col justify-between space-y-5">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--text)] bg-[var(--hover)] px-2.5 py-1 rounded-md">
                <Globe size={13} />
                <span>Live Web Search</span>
              </div>
              <h3 className="font-serif text-lg font-medium text-[var(--text)]">
                Real answers backed by sources.
              </h3>
              <p className="text-xs text-[var(--secondary)] leading-relaxed">
                Astor searches the web and attaches numbered source chips. Click any citation to inspect the article snippet and link.
              </p>
            </div>

            {/* Exact Chat Component Snippet */}
            <div className="p-3.5 rounded-xl border border-[var(--border)] bg-[var(--bg)] space-y-2 text-xs">
              <div className="flex items-center gap-1.5 text-[var(--secondary)] text-[11px]">
                <Globe size={11} />
                <span className="truncate">&quot;james webb telescope exoplanet findings&quot;</span>
              </div>
              <div className="font-serif text-[13px] leading-relaxed text-[var(--text)]">
                Astronomers confirmed atmospheric carbon dioxide on WASP-39b{' '}
                <span className="font-mono text-[10px] font-semibold text-[var(--text)] bg-[var(--hover)] px-1 py-0.5 rounded border border-[var(--border)]">
                  [1]
                </span>
                .
              </div>
              <div className="p-2 rounded-lg border border-[var(--border)] bg-[var(--sidebar-bg)] flex items-center justify-between text-[11px]">
                <span className="truncate font-medium">[1] nasa.gov</span>
                <span className="text-[var(--secondary)] shrink-0 flex items-center gap-1 text-[10px]">
                  <span>Visit</span>
                  <ExternalLink size={9} />
                </span>
              </div>
            </div>
          </div>

          {/* Card 2: Memory Across Conversations */}
          <div className="p-6 rounded-2xl border border-[var(--border)] bg-[var(--popover-bg)] flex flex-col justify-between space-y-5">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--text)] bg-[var(--hover)] px-2.5 py-1 rounded-md">
                <Brain size={13} />
                <span>Persistent Memory</span>
              </div>
              <h3 className="font-serif text-lg font-medium text-[var(--text)]">
                Picks up where you left off.
              </h3>
              <p className="text-xs text-[var(--secondary)] leading-relaxed">
                Refer to something you discussed days or weeks ago. Astor remembers context without asking you to re-explain.
              </p>
            </div>

            {/* Exact Chat Component Snippet */}
            <div className="p-3 rounded-xl border border-[var(--border)] bg-[var(--hover)]/30 space-y-1.5">
              <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-[var(--secondary)]">
                <Clock size={11} />
                <span>From your history (1)</span>
              </div>
              <div className="flex items-start justify-between gap-2 pt-1 border-t border-[var(--border)]/50">
                <div className="space-y-0.5 text-xs min-w-0">
                  <div className="font-mono text-[10px] text-[var(--secondary)]">Monday, 17 Nov</div>
                  <div className="text-[12px] text-[var(--text)] font-sans line-clamp-2">
                    &quot;We shortlisted 3 minimal laptops for writing and battery life.&quot;
                  </div>
                </div>
                <span className="shrink-0 text-[10px] font-mono px-1.5 py-0.5 rounded border border-[var(--border)] bg-[var(--bg)] text-[var(--secondary)]">
                  View
                </span>
              </div>
            </div>
          </div>

          {/* Card 3: Instant Guest Access & Clean Code */}
          <div className="p-6 rounded-2xl border border-[var(--border)] bg-[var(--popover-bg)] flex flex-col justify-between space-y-5">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--text)] bg-[var(--hover)] px-2.5 py-1 rounded-md">
                <Compass size={13} />
                <span>Instant Guest Mode</span>
              </div>
              <h3 className="font-serif text-lg font-medium text-[var(--text)]">
                No signup required to start.
              </h3>
              <p className="text-xs text-[var(--secondary)] leading-relaxed">
                Jump right into the chat workspace. Code blocks come with one-click copy, and your thoughts stay private.
              </p>
            </div>

            {/* Exact Chat Component Snippet: CodeBlock + Suggestion */}
            <div className="space-y-2">
              <div className="rounded-xl border border-[var(--border)] overflow-hidden bg-[var(--code-bg)] text-[var(--code-text)] text-xs font-mono">
                <div className="flex items-center justify-between px-3 py-1 bg-[var(--code-header)] border-b border-[var(--border)]/30 text-[10.5px] text-[var(--secondary)]">
                  <span>python</span>
                  <button
                    type="button"
                    onClick={handleCopyCode}
                    className="flex items-center gap-1 hover:text-[var(--code-text)] transition-colors"
                  >
                    {copiedCode ? (
                      <>
                        <Check size={10} className="text-emerald-400" />
                        <span>Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy size={10} />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>
                <div className="p-2.5 text-[11px]">
                  <span className="text-blue-400">def</span> answer(sources):
                  <br />
                  &nbsp;&nbsp;<span className="text-purple-400">return</span> sources[0].title
                </div>
              </div>

              <Link
                href="/?guest=1"
                className="flex items-center justify-between p-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] hover:bg-[var(--hover)] text-xs font-medium text-[var(--text)] transition-colors"
              >
                <div className="flex items-center gap-1.5 truncate">
                  <Sparkles size={12} className="text-[var(--secondary)]" />
                  <span className="truncate">Try in guest mode</span>
                </div>
                <ArrowRight size={12} className="text-[var(--secondary)] shrink-0" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ==================== MINIMAL FOOTER ==================== */}
      <footer className="py-8 px-4 sm:px-6 max-w-5xl mx-auto">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[var(--secondary)]">
          <div className="flex items-center gap-2">
            <AstorMark size={20} className="text-[var(--text)]" />
            <span className="font-serif text-sm font-medium text-[var(--text)]">Astor</span>
            <span>· A calmer AI assistant with memory &amp; web search</span>
          </div>

          <div className="flex items-center gap-4 text-xs font-mono">
            <Link href="/?guest=1" className="hover:text-[var(--text)] transition-colors">
              Guest Workspace
            </Link>
            <Link href="/login" className="hover:text-[var(--text)] transition-colors">
              Sign In
            </Link>
            <Link href="/login?tab=signup" className="hover:text-[var(--text)] transition-colors">
              Create Account
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
