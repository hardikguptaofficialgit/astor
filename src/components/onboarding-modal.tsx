'use client';

import React, { useState } from 'react';
import { Sparkles, ArrowRight, Check, Brain, User, Compass } from 'lucide-react';
import { AVATAR_PRESETS, UserAvatar } from './user-avatar';
import { AstorMark } from './chat-interface';

interface OnboardingModalProps {
  isOpen: boolean;
  currentUser: {
    id: string;
    name: string;
    email: string;
    avatarUrl?: string | null;
    profession?: string;
    primaryGoals?: string[];
    customInstructions?: string;
  };
  onComplete: (updatedUser: Record<string, unknown>) => void;
}

const PROFESSIONS = [
  'Software Engineer',
  'AI / ML Researcher',
  'Product Manager',
  'Founder / Entrepreneur',
  'Student / Academic',
  'UI/UX Designer',
  'Data Scientist',
  'Other',
];

const GOALS = [
  'Coding & System Design',
  'In-depth Research & Analysis',
  'Quick Answers & Calculations',
  'Writing & Proofreading',
  'Architecture & Visual Diagrams',
];

const RESPONSE_STYLES = [
  {
    id: 'concise',
    label: 'Concise & Direct',
    desc: 'Short answers, code first, minimal fluff.',
  },
  {
    id: 'detailed',
    label: 'Detailed & Step-by-Step',
    desc: 'Thorough explanations with comprehensive context.',
  },
  {
    id: 'balanced',
    label: 'Academic & Cited',
    desc: 'Rigorous citations with comparisons and nuance.',
  },
];

export function OnboardingModal({ isOpen, currentUser, onComplete }: OnboardingModalProps) {
  const [step, setStep] = useState(1);
  const [name, setName] = useState(currentUser.name || '');
  const [avatarUrl, setAvatarUrl] = useState<string>(currentUser.avatarUrl || 'preset:obsidian');
  const [profession, setProfession] = useState(currentUser.profession || '');
  const [primaryGoals, setPrimaryGoals] = useState<string[]>(currentUser.primaryGoals || []);
  const [selectedStyle, setSelectedStyle] = useState('concise');
  const [customInstructions, setCustomInstructions] = useState(currentUser.customInstructions || '');
  const [enableSupermemory, setEnableSupermemory] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const toggleGoal = (goal: string) => {
    setPrimaryGoals((prev) =>
      prev.includes(goal) ? prev.filter((g) => g !== goal) : [...prev, goal]
    );
  };

  const handleFinish = async () => {
    setIsSubmitting(true);
    try {
      // Build final custom instructions combining style and text
      const styleDesc = RESPONSE_STYLES.find((s) => s.id === selectedStyle)?.desc || '';
      const combinedInstructions = [
        styleDesc ? `Preferred style: ${styleDesc}` : '',
        customInstructions.trim(),
      ]
        .filter(Boolean)
        .join('. ');

      const payload = {
        name: name.trim() || currentUser.name,
        avatarUrl,
        profession: profession.trim(),
        primaryGoals,
        customInstructions: combinedInstructions,
        onboardingCompleted: true,
      };

      const res = await fetch('/api/user/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const data = await res.json();
        const updated = data.user || payload;
        window.dispatchEvent(new CustomEvent('astor:user-updated', { detail: updated }));
        onComplete(updated);
      } else {
        // Fallback optimistic
        onComplete(payload);
      }
    } catch {
      onComplete({ ...currentUser, onboardingCompleted: true });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-popover">
      <div className="relative w-full max-w-[520px] rounded-[22px] border border-[var(--border)] bg-[var(--popover-bg)] p-6 md:p-8 shadow-2xl space-y-6 text-left">
        {/* Progress Bar & Header */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AstorMark size={22} />
              <span className="font-serif text-sm font-medium tracking-tight text-[var(--text)]">
                Welcome to Astor
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              {[1, 2, 3].map((s) => (
                <div
                  key={s}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    s === step
                      ? 'w-6 bg-[var(--text)]'
                      : s < step
                        ? 'w-3 bg-[var(--text)]/40'
                        : 'w-3 bg-[var(--border)]'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>

        {/* STEP 1: Profile & Avatar */}
        {step === 1 && (
          <div className="space-y-5 animate-popover">
            <div className="space-y-1">
              <h2 className="font-serif text-2xl font-normal text-[var(--text)]">
                Personalize your profile
              </h2>
              <p className="text-xs text-[var(--secondary)]">
                Choose how you want to appear in your Astor workspace.
              </p>
            </div>

            {/* Avatar Preview & Chooser */}
            <div className="flex items-center gap-4 p-3.5 rounded-2xl border border-[var(--border)] bg-[var(--hover)]/30">
              <UserAvatar avatarUrl={avatarUrl} name={name} size={48} />
              <div className="flex-1 space-y-2 min-w-0">
                <span className="text-xs font-medium text-[var(--text)] block">
                  Choose avatar preset
                </span>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(AVATAR_PRESETS).map(([key, preset]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setAvatarUrl(key)}
                      title={preset.label}
                      className={`w-6 h-6 rounded-full bg-gradient-to-br ${preset.gradient} transition-transform ${
                        avatarUrl === key
                          ? 'ring-2 ring-[var(--text)] ring-offset-2 ring-offset-[var(--bg)] scale-110'
                          : 'opacity-70 hover:opacity-100 hover:scale-105'
                      }`}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Name Input */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[var(--text)] flex items-center gap-1.5">
                <User size={13} className="text-[var(--secondary)]" />
                <span>What should Astor call you?</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name or handle"
                className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--hover)]/30 text-sm text-[var(--text)] focus:outline-none focus:border-[var(--text)] transition-colors"
              />
            </div>

            <button
              type="button"
              onClick={() => setStep(2)}
              className="w-full py-2.5 rounded-xl bg-[var(--text)] text-[var(--bg)] text-xs font-medium hover:opacity-90 active:scale-[0.99] transition-all flex items-center justify-center gap-2"
            >
              <span>Continue</span>
              <ArrowRight size={14} />
            </button>
          </div>
        )}

        {/* STEP 2: Role & Goals */}
        {step === 2 && (
          <div className="space-y-5 animate-popover">
            <div className="space-y-1">
              <h2 className="font-serif text-2xl font-normal text-[var(--text)]">
                What do you do?
              </h2>
              <p className="text-xs text-[var(--secondary)]">
                Astor adapts its responses, technical depth, and diagrams to your role.
              </p>
            </div>

            {/* Profession Pills */}
            <div className="space-y-2">
              <span className="text-xs font-medium text-[var(--text)] flex items-center gap-1.5">
                <Compass size={13} className="text-[var(--secondary)]" />
                <span>Select your role:</span>
              </span>
              <div className="flex flex-wrap gap-2">
                {PROFESSIONS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setProfession(p)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                      profession === p
                        ? 'bg-[var(--text)] text-[var(--bg)] shadow-xs'
                        : 'border border-[var(--border)] bg-[var(--hover)]/30 text-[var(--secondary)] hover:text-[var(--text)] hover:bg-[var(--hover)]'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            {/* Goals Pills */}
            <div className="space-y-2">
              <span className="text-xs font-medium text-[var(--text)] flex items-center gap-1.5">
                <Sparkles size={13} className="text-[var(--secondary)]" />
                <span>Primary goals (select all that apply):</span>
              </span>
              <div className="flex flex-wrap gap-2">
                {GOALS.map((g) => {
                  const isSelected = primaryGoals.includes(g);
                  return (
                    <button
                      key={g}
                      type="button"
                      onClick={() => toggleGoal(g)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all flex items-center gap-1.5 ${
                        isSelected
                          ? 'bg-[var(--text)] text-[var(--bg)] shadow-xs'
                          : 'border border-[var(--border)] bg-[var(--hover)]/30 text-[var(--secondary)] hover:text-[var(--text)] hover:bg-[var(--hover)]'
                      }`}
                    >
                      {isSelected && <Check size={11} />}
                      <span>{g}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="py-2.5 px-4 rounded-xl border border-[var(--border)] hover:bg-[var(--hover)] text-xs text-[var(--secondary)] font-medium transition-colors"
              >
                Back
              </button>
              <button
                type="button"
                onClick={() => setStep(3)}
                className="flex-1 py-2.5 rounded-xl bg-[var(--text)] text-[var(--bg)] text-xs font-medium hover:opacity-90 active:scale-[0.99] transition-all flex items-center justify-center gap-2"
              >
                <span>Continue</span>
                <ArrowRight size={14} />
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: Response Style & Supermemory */}
        {step === 3 && (
          <div className="space-y-5 animate-popover">
            <div className="space-y-1">
              <h2 className="font-serif text-2xl font-normal text-[var(--text)]">
                Supermemory & Response Style
              </h2>
              <p className="text-xs text-[var(--secondary)]">
                Tune how Astor communicates and remembers details across sessions.
              </p>
            </div>

            {/* Response Style Options */}
            <div className="space-y-2">
              <span className="text-xs font-medium text-[var(--text)]">Response Tone</span>
              <div className="grid grid-cols-1 gap-2">
                {RESPONSE_STYLES.map((style) => (
                  <button
                    key={style.id}
                    type="button"
                    onClick={() => setSelectedStyle(style.id)}
                    className={`p-3 rounded-xl border text-left transition-all flex items-start justify-between gap-3 ${
                      selectedStyle === style.id
                        ? 'border-[var(--text)] bg-[var(--hover)] shadow-xs'
                        : 'border-[var(--border)] hover:bg-[var(--hover)]/40'
                    }`}
                  >
                    <div>
                      <p className="text-xs font-medium text-[var(--text)]">{style.label}</p>
                      <p className="text-[11px] text-[var(--secondary)] mt-0.5">{style.desc}</p>
                    </div>
                    {selectedStyle === style.id && (
                      <Check size={14} className="text-[var(--text)] shrink-0 mt-0.5" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Supermemory Switch */}
            <div className="flex items-center justify-between p-3.5 rounded-xl border border-[var(--border)] bg-[var(--hover)]/30">
              <div className="flex items-start gap-2.5 min-w-0 pr-3">
                <Brain size={18} className="text-[var(--text)] shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-medium text-[var(--text)]">
                    Supermemory Cross-Chat Intelligence
                  </p>
                  <p className="text-[11px] text-[var(--secondary)] mt-0.5 leading-relaxed">
                    Allows Astor to remember key facts, projects, and preferences across all chats.
                  </p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={enableSupermemory}
                onChange={(e) => setEnableSupermemory(e.target.checked)}
                className="w-4 h-4 accent-[var(--text)] rounded cursor-pointer shrink-0"
              />
            </div>

            {/* Optional Additional Custom Instructions */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[var(--text)]">
                Additional Instructions (optional)
              </label>
              <input
                type="text"
                value={customInstructions}
                onChange={(e) => setCustomInstructions(e.target.value)}
                placeholder="e.g. Always write code in TypeScript. Skip pleasantries."
                className="w-full px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--hover)]/30 text-xs text-[var(--text)] focus:outline-none focus:border-[var(--text)] transition-colors"
              />
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="py-2.5 px-4 rounded-xl border border-[var(--border)] hover:bg-[var(--hover)] text-xs text-[var(--secondary)] font-medium transition-colors"
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleFinish}
                disabled={isSubmitting}
                className="flex-1 py-2.5 rounded-xl bg-[var(--text)] text-[var(--bg)] text-xs font-medium hover:opacity-90 active:scale-[0.99] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <span>Saving...</span>
                ) : (
                  <>
                    <span>Complete Setup</span>
                    <Sparkles size={14} />
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
