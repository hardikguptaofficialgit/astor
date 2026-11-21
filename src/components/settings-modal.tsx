'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  X,
  User,
  Brain,
  Sliders,
  Shield,
  Trash2,
  Plus,
  Check,
  Sun,
  Moon,
  Laptop,
  LogOut,
  Sparkles,
} from 'lucide-react';
import { AVATAR_PRESETS, UserAvatar } from './user-avatar';

interface MemoryItem {
  id: string;
  fact: string;
  category?: string;
  created_at: number;
}

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: {
    id: string;
    name: string;
    email: string;
    avatarUrl?: string | null;
    profession?: string;
    primaryGoals?: string[];
    customInstructions?: string;
  } | null;
  onUserUpdate: (updated: Record<string, unknown>) => void;
}

export function SettingsModal({
  isOpen,
  onClose,
  currentUser,
  onUserUpdate,
}: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<'profile' | 'memory' | 'instructions' | 'account'>('profile');

  // Profile State
  const [name, setName] = useState(currentUser?.name || '');
  const [avatarUrl, setAvatarUrl] = useState(currentUser?.avatarUrl || 'preset:obsidian');
  const [customAvatarInput, setCustomAvatarInput] = useState('');
  const [profession, setProfession] = useState(currentUser?.profession || '');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);

  // Theme State
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>('system');

  // Memories State
  const [memories, setMemories] = useState<MemoryItem[]>([]);
  const [isLoadingMemories, setIsLoadingMemories] = useState(false);
  const [newMemoryText, setNewMemoryText] = useState('');
  const [isAddingMemory, setIsAddingMemory] = useState(false);

  // Custom Instructions State
  const [customInstructions, setCustomInstructions] = useState(currentUser?.customInstructions || '');
  const [isSavingInstructions, setIsSavingInstructions] = useState(false);
  const [instructionsSaved, setInstructionsSaved] = useState(false);

  // Sync user state on open
  useEffect(() => {
    if (currentUser) {
      setName(currentUser.name || '');
      setAvatarUrl(currentUser.avatarUrl || 'preset:obsidian');
      setProfession(currentUser.profession || '');
      setCustomInstructions(currentUser.customInstructions || '');
    }
  }, [currentUser]);

  // Load theme from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('astor_theme') as 'light' | 'dark' | 'system' | null;
    if (saved) setTheme(saved);
  }, []);

  const handleThemeChange = (newTheme: 'light' | 'dark' | 'system') => {
    setTheme(newTheme);
    localStorage.setItem('astor_theme', newTheme);
    const root = document.documentElement;
    if (newTheme === 'dark') {
      root.classList.add('dark');
    } else if (newTheme === 'light') {
      root.classList.remove('dark');
    } else {
      if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
    }
  };

  // Fetch memories
  const loadMemories = useCallback(async () => {
    setIsLoadingMemories(true);
    try {
      const res = await fetch('/api/user/memories');
      if (res.ok) {
        const data = await res.json();
        setMemories(data.memories || []);
      }
    } catch {
      // ignore
    } finally {
      setIsLoadingMemories(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen && activeTab === 'memory') {
      loadMemories();
    }
  }, [isOpen, activeTab, loadMemories]);

  // Add memory
  const handleAddMemory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemoryText.trim() || isAddingMemory) return;

    setIsAddingMemory(true);
    try {
      const res = await fetch('/api/user/memories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fact: newMemoryText.trim(), category: 'user_defined' }),
      });
      if (res.ok) {
        const data = await res.json();
        setMemories((prev) => [data.memory, ...prev]);
        setNewMemoryText('');
      }
    } catch {} finally {
      setIsAddingMemory(false);
    }
  };

  // Delete single memory
  const handleDeleteMemory = async (id: string) => {
    setMemories((prev) => prev.filter((m) => m.id !== id));
    try {
      await fetch('/api/user/memories', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
    } catch {
      loadMemories();
    }
  };

  // Clear all memories
  const handleClearAllMemories = async () => {
    if (!confirm('Are you sure you want Astor to forget all remembered facts? This cannot be undone.')) {
      return;
    }
    setMemories([]);
    try {
      await fetch('/api/user/memories', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clearAll: true }),
      });
    } catch {
      loadMemories();
    }
  };

  // Save profile changes
  const handleSaveProfile = async () => {
    setIsSavingProfile(true);
    try {
      const effectiveAvatar = customAvatarInput.trim() || avatarUrl;
      const payload = {
        name: name.trim(),
        avatarUrl: effectiveAvatar,
        profession: profession.trim(),
      };
      const res = await fetch('/api/user/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const data = await res.json();
        onUserUpdate(data.user);
        setProfileSaved(true);
        setTimeout(() => setProfileSaved(false), 2000);
      }
    } catch {} finally {
      setIsSavingProfile(false);
    }
  };

  // Save custom instructions
  const handleSaveInstructions = async () => {
    setIsSavingInstructions(true);
    try {
      const res = await fetch('/api/user/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customInstructions: customInstructions.trim() }),
      });
      if (res.ok) {
        const data = await res.json();
        onUserUpdate(data.user);
        setInstructionsSaved(true);
        setTimeout(() => setInstructionsSaved(false), 2000);
      }
    } catch {} finally {
      setIsSavingInstructions(false);
    }
  };

  // Logout
  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      window.location.href = '/login';
    } catch {}
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-popover">
      <div className="relative w-full max-w-[680px] h-[580px] max-h-[90vh] rounded-[22px] border border-[var(--border)] bg-[var(--popover-bg)] shadow-2xl flex flex-col overflow-hidden text-left">
        {/* Top Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)] shrink-0">
          <div className="flex items-center gap-2">
            <Sliders size={18} className="text-[var(--text)]" />
            <h2 className="font-serif text-lg font-medium text-[var(--text)]">Settings</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-[var(--secondary)] hover:text-[var(--text)] hover:bg-[var(--hover)] transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body with Sidebar Tabs */}
        <div className="flex-1 flex overflow-hidden">
          {/* Navigation Sidebar */}
          <div className="w-48 border-r border-[var(--border)] p-3 space-y-1 shrink-0 bg-[var(--hover)]/20">
            <button
              type="button"
              onClick={() => setActiveTab('profile')}
              className={`flex items-center gap-2.5 w-full px-3 py-2 rounded-xl text-xs font-medium text-left transition-colors ${
                activeTab === 'profile'
                  ? 'bg-[var(--hover)] text-[var(--text)] shadow-xs'
                  : 'text-[var(--secondary)] hover:text-[var(--text)] hover:bg-[var(--hover)]/50'
              }`}
            >
              <User size={14} />
              <span>Profile & Style</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('memory')}
              className={`flex items-center gap-2.5 w-full px-3 py-2 rounded-xl text-xs font-medium text-left transition-colors ${
                activeTab === 'memory'
                  ? 'bg-[var(--hover)] text-[var(--text)] shadow-xs'
                  : 'text-[var(--secondary)] hover:text-[var(--text)] hover:bg-[var(--hover)]/50'
              }`}
            >
              <Brain size={14} />
              <div className="flex items-center justify-between flex-1">
                <span>Memory</span>
                {memories.length > 0 && (
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-[var(--hover)] border border-[var(--border)] text-[var(--secondary)]">
                    {memories.length}
                  </span>
                )}
              </div>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('instructions')}
              className={`flex items-center gap-2.5 w-full px-3 py-2 rounded-xl text-xs font-medium text-left transition-colors ${
                activeTab === 'instructions'
                  ? 'bg-[var(--hover)] text-[var(--text)] shadow-xs'
                  : 'text-[var(--secondary)] hover:text-[var(--text)] hover:bg-[var(--hover)]/50'
              }`}
            >
              <Sparkles size={14} />
              <span>Custom Prompt</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('account')}
              className={`flex items-center gap-2.5 w-full px-3 py-2 rounded-xl text-xs font-medium text-left transition-colors ${
                activeTab === 'account'
                  ? 'bg-[var(--hover)] text-[var(--text)] shadow-xs'
                  : 'text-[var(--secondary)] hover:text-[var(--text)] hover:bg-[var(--hover)]/50'
              }`}
            >
              <Shield size={14} />
              <span>Account</span>
            </button>
          </div>

          {/* Tab Content Panel */}
          <div className="flex-1 p-6 overflow-y-auto">
            {/* TAB 1: Profile & Style */}
            {activeTab === 'profile' && (
              <div className="space-y-6 animate-popover">
                <div className="space-y-1">
                  <h3 className="text-sm font-medium text-[var(--text)]">Profile Appearance</h3>
                  <p className="text-xs text-[var(--secondary)]">
                    Manage your avatar and workspace appearance.
                  </p>
                </div>

                {/* Avatar Presets */}
                <div className="space-y-3 p-4 rounded-2xl border border-[var(--border)] bg-[var(--hover)]/20">
                  <div className="flex items-center gap-3">
                    <UserAvatar avatarUrl={customAvatarInput.trim() || avatarUrl} name={name} size={44} />
                    <div>
                      <span className="text-xs font-medium text-[var(--text)] block">
                        Select Avatar Style
                      </span>
                      <span className="text-[11px] text-[var(--secondary)]">
                        Choose a gradient preset or paste a custom image URL.
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 pt-1">
                    {Object.entries(AVATAR_PRESETS).map(([key, preset]) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => {
                          setAvatarUrl(key);
                          setCustomAvatarInput('');
                        }}
                        title={preset.label}
                        className={`w-7 h-7 rounded-full bg-gradient-to-br ${preset.gradient} transition-transform ${
                          avatarUrl === key && !customAvatarInput.trim()
                            ? 'ring-2 ring-[var(--text)] ring-offset-2 ring-offset-[var(--bg)] scale-110'
                            : 'opacity-70 hover:opacity-100 hover:scale-105'
                        }`}
                      />
                    ))}
                  </div>

                  <div className="pt-2">
                    <input
                      type="url"
                      value={customAvatarInput}
                      onChange={(e) => setCustomAvatarInput(e.target.value)}
                      placeholder="Or enter custom image URL (https://...)"
                      className="w-full px-3 py-1.5 rounded-xl border border-[var(--border)] bg-[var(--popover-bg)] text-xs text-[var(--text)] focus:outline-none focus:border-[var(--text)]"
                    />
                  </div>
                </div>

                {/* Name & Profession */}
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-[var(--text)]">Display Name</label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--popover-bg)] text-xs text-[var(--text)] focus:outline-none focus:border-[var(--text)]"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-[var(--text)]">Role / Profession</label>
                    <input
                      type="text"
                      value={profession}
                      onChange={(e) => setProfession(e.target.value)}
                      placeholder="e.g. Software Engineer, Researcher, Designer"
                      className="w-full px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--popover-bg)] text-xs text-[var(--text)] focus:outline-none focus:border-[var(--text)]"
                    />
                  </div>
                </div>

                {/* Theme Selector */}
                <div className="space-y-2 pt-2 border-t border-[var(--border)]">
                  <label className="text-xs font-medium text-[var(--text)]">Interface Theme</label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => handleThemeChange('light')}
                      className={`flex items-center justify-center gap-2 py-2 rounded-xl border text-xs transition-colors ${
                        theme === 'light'
                          ? 'border-[var(--text)] bg-[var(--hover)] font-medium text-[var(--text)]'
                          : 'border-[var(--border)] text-[var(--secondary)] hover:text-[var(--text)]'
                      }`}
                    >
                      <Sun size={13} />
                      <span>Light</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleThemeChange('dark')}
                      className={`flex items-center justify-center gap-2 py-2 rounded-xl border text-xs transition-colors ${
                        theme === 'dark'
                          ? 'border-[var(--text)] bg-[var(--hover)] font-medium text-[var(--text)]'
                          : 'border-[var(--border)] text-[var(--secondary)] hover:text-[var(--text)]'
                      }`}
                    >
                      <Moon size={13} />
                      <span>Dark</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleThemeChange('system')}
                      className={`flex items-center justify-center gap-2 py-2 rounded-xl border text-xs transition-colors ${
                        theme === 'system'
                          ? 'border-[var(--text)] bg-[var(--hover)] font-medium text-[var(--text)]'
                          : 'border-[var(--border)] text-[var(--secondary)] hover:text-[var(--text)]'
                      }`}
                    >
                      <Laptop size={13} />
                      <span>System</span>
                    </button>
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="button"
                    onClick={handleSaveProfile}
                    disabled={isSavingProfile}
                    className="py-2 px-4 rounded-xl bg-[var(--text)] text-[var(--bg)] text-xs font-medium hover:opacity-90 transition-all flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {profileSaved ? (
                      <>
                        <Check size={13} />
                        <span>Saved</span>
                      </>
                    ) : (
                      <span>Save Changes</span>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* TAB 2: Memory & Facts (ChatGPT Style) */}
            {activeTab === 'memory' && (
              <div className="space-y-5 animate-popover">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <h3 className="text-sm font-medium text-[var(--text)] flex items-center gap-2">
                      <span>Memory & Stored Facts</span>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        <span>Supermemory Active</span>
                      </span>
                    </h3>
                    <p className="text-xs text-[var(--secondary)]">
                      Astor remembers details from your chats and uses them to personalize answers.
                    </p>
                  </div>
                  {memories.length > 0 && (
                    <button
                      type="button"
                      onClick={handleClearAllMemories}
                      className="text-xs text-red-500 hover:underline flex items-center gap-1"
                    >
                      <Trash2 size={12} />
                      <span>Clear all</span>
                    </button>
                  )}
                </div>

                {/* Add New Memory Manually */}
                <form onSubmit={handleAddMemory} className="flex gap-2">
                  <input
                    type="text"
                    value={newMemoryText}
                    onChange={(e) => setNewMemoryText(e.target.value)}
                    placeholder="Teach Astor a fact (e.g. 'I work primarily in TypeScript and Next.js')..."
                    className="flex-1 px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--popover-bg)] text-xs text-[var(--text)] focus:outline-none focus:border-[var(--text)]"
                  />
                  <button
                    type="submit"
                    disabled={!newMemoryText.trim() || isAddingMemory}
                    className="px-3.5 py-2 rounded-xl bg-[var(--text)] text-[var(--bg)] text-xs font-medium hover:opacity-90 transition-all flex items-center gap-1.5 disabled:opacity-40"
                  >
                    <Plus size={13} />
                    <span>Remember</span>
                  </button>
                </form>

                {/* Memories List */}
                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                  {isLoadingMemories ? (
                    <div className="py-8 text-center text-xs text-[var(--secondary)]">
                      Loading memories...
                    </div>
                  ) : memories.length === 0 ? (
                    <div className="p-6 rounded-2xl border border-[var(--border)] bg-[var(--hover)]/20 text-center space-y-2">
                      <Brain size={24} className="mx-auto text-[var(--secondary)]" />
                      <p className="text-xs font-medium text-[var(--text)]">No memories stored yet</p>
                      <p className="text-[11px] text-[var(--secondary)] leading-relaxed max-w-sm mx-auto">
                        As you chat, Astor automatically remembers important facts about your workflow and preferences. You can also add memories manually above.
                      </p>
                    </div>
                  ) : (
                    memories.map((mem) => (
                      <div
                        key={mem.id}
                        className="flex items-center justify-between gap-3 p-3 rounded-xl border border-[var(--border)] bg-[var(--hover)]/20 hover:bg-[var(--hover)]/40 transition-colors group"
                      >
                        <div className="flex items-start gap-2.5 min-w-0">
                          <span className="w-1.5 h-1.5 rounded-full bg-[var(--text)] mt-1.5 shrink-0 opacity-40 group-hover:opacity-100 transition-opacity" />
                          <div className="space-y-0.5 min-w-0">
                            <p className="text-xs text-[var(--text)] font-sans leading-relaxed break-words">
                              {mem.fact}
                            </p>
                            {mem.category && (
                              <span className="text-[10px] font-mono text-[var(--secondary)]">
                                {mem.category}
                              </span>
                            )}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeleteMemory(mem.id)}
                          title="Forget this memory"
                          className="p-1 rounded text-[var(--secondary)] hover:text-red-500 hover:bg-red-500/10 transition-colors shrink-0"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* TAB 3: Custom Instructions */}
            {activeTab === 'instructions' && (
              <div className="space-y-5 animate-popover">
                <div className="space-y-1">
                  <h3 className="text-sm font-medium text-[var(--text)]">Custom Instructions</h3>
                  <p className="text-xs text-[var(--secondary)]">
                    Provide instructions Astor will keep in mind across every conversation.
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium text-[var(--text)]">
                    How would you like Astor to respond?
                  </label>
                  <textarea
                    rows={6}
                    value={customInstructions}
                    onChange={(e) => setCustomInstructions(e.target.value)}
                    placeholder="e.g. Always write code in TypeScript. Be concise and skip pleasantries. Format tabular data in Markdown tables. Include Mermaid diagrams for architecture questions."
                    className="w-full p-3 rounded-xl border border-[var(--border)] bg-[var(--popover-bg)] text-xs text-[var(--text)] focus:outline-none focus:border-[var(--text)] resize-none leading-relaxed"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleSaveInstructions}
                  disabled={isSavingInstructions}
                  className="py-2 px-4 rounded-xl bg-[var(--text)] text-[var(--bg)] text-xs font-medium hover:opacity-90 transition-all flex items-center gap-1.5 disabled:opacity-50"
                >
                  {instructionsSaved ? (
                    <>
                      <Check size={13} />
                      <span>Saved</span>
                    </>
                  ) : (
                    <span>Save Instructions</span>
                  )}
                </button>
              </div>
            )}

            {/* TAB 4: Account */}
            {activeTab === 'account' && (
              <div className="space-y-6 animate-popover">
                <div className="space-y-1">
                  <h3 className="text-sm font-medium text-[var(--text)]">Account & Session</h3>
                  <p className="text-xs text-[var(--secondary)]">
                    Information regarding your current Astor credentials.
                  </p>
                </div>

                <div className="space-y-3 p-4 rounded-2xl border border-[var(--border)] bg-[var(--hover)]/20 text-xs">
                  <div className="flex justify-between py-1 border-b border-[var(--border-subtle)]">
                    <span className="text-[var(--secondary)]">Email</span>
                    <span className="font-medium text-[var(--text)]">{currentUser?.email || 'Guest User'}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-[var(--border-subtle)]">
                    <span className="text-[var(--secondary)]">Status</span>
                    <span className="font-mono text-emerald-500">Active</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-[var(--secondary)]">Deployment</span>
                    <span className="font-mono text-[var(--text)]">Cloud Run (asia-southeast1)</span>
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="py-2 px-4 rounded-xl border border-red-500/30 text-red-500 hover:bg-red-500/10 text-xs font-medium transition-colors flex items-center gap-2"
                  >
                    <LogOut size={13} />
                    <span>Sign Out</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
