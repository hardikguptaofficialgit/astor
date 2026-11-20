'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import {
  PanelLeft,
  Plus,
  Search,
  MoreHorizontal,
  Pencil,
  Trash2,
  Sun,
  Moon,
  Laptop,
  Check,
  X,
  Keyboard,
  Info,
  ChevronDown,
} from 'lucide-react';
import { AstorMark } from './astor-mark';
import { useTheme } from './theme-provider';
import { SearchModal } from './search-modal';

export interface ConversationItem {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

interface SidebarProps {
  currentId?: string;
  isOpen: boolean;
  onToggle: () => void;
  refreshKey?: number;
  optimisticConversation?: ConversationItem | null;
}

export function Sidebar({
  currentId,
  isOpen,
  onToggle,
  refreshKey = 0,
  optimisticConversation,
}: SidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();

  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [shortcutsModalOpen, setShortcutsModalOpen] = useState(false);
  const [aboutModalOpen, setAboutModalOpen] = useState(false);

  const menuRef = useRef<HTMLDivElement>(null);
  const accountMenuRef = useRef<HTMLDivElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);

  // Fetch conversations from server
  const fetchConversations = useCallback(async () => {
    try {
      const res = await fetch('/api/conversations');
      if (res.ok) {
        const data: ConversationItem[] = await res.json();
        setConversations(data);
      }
    } catch {}
  }, []);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations, refreshKey, pathname]);

  // Handle optimistic conversation insertion immediately
  useEffect(() => {
    if (optimisticConversation) {
      setConversations((prev) => {
        const exists = prev.some((c) => c.id === optimisticConversation.id);
        if (exists) {
          return prev.map((c) =>
            c.id === optimisticConversation.id
              ? { ...c, title: optimisticConversation.title, updated_at: optimisticConversation.updated_at }
              : c
          );
        }
        return [optimisticConversation, ...prev];
      });
    }
  }, [optimisticConversation]);

  // Listen to custom window events for live synchronization
  useEffect(() => {
    const handleCustomUpdate = (e: Event) => {
      const customEvent = e as CustomEvent<ConversationItem>;
      if (customEvent.detail) {
        setConversations((prev) => {
          const exists = prev.some((c) => c.id === customEvent.detail.id);
          if (exists) {
            return prev.map((c) =>
              c.id === customEvent.detail.id
                ? { ...c, title: customEvent.detail.title, updated_at: customEvent.detail.updated_at }
                : c
            );
          }
          return [customEvent.detail, ...prev];
        });
      } else {
        fetchConversations();
      }
    };

    window.addEventListener('astor:conversation-updated', handleCustomUpdate);
    return () => window.removeEventListener('astor:conversation-updated', handleCustomUpdate);
  }, [fetchConversations]);

  // Global keyboard shortcuts: Ctrl+K, Ctrl+Shift+O, Ctrl+B
  useEffect(() => {
    const handleGlobalShortcuts = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const cmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;

      // Ctrl+K -> Search
      if (cmdOrCtrl && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      }
      // Ctrl+Shift+O -> New chat
      if (cmdOrCtrl && e.shiftKey && e.key.toLowerCase() === 'o') {
        e.preventDefault();
        router.push('/');
      }
      // Ctrl+B -> Toggle sidebar
      if (cmdOrCtrl && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        onToggle();
      }
    };

    window.addEventListener('keydown', handleGlobalShortcuts);
    return () => window.removeEventListener('keydown', handleGlobalShortcuts);
  }, [onToggle, router]);

  // Close menus on outside click or Esc
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setActiveMenuId(null);
      }
      if (accountMenuRef.current && !accountMenuRef.current.contains(e.target as Node)) {
        setAccountMenuOpen(false);
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setActiveMenuId(null);
        setAccountMenuOpen(false);
        setEditingId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEsc);
    };
  }, []);

  // Focus rename input when activated
  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingId]);

  const handleStartRename = (conv: ConversationItem, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setEditingId(conv.id);
    setEditingTitle(conv.title);
    setActiveMenuId(null);
  };

  const handleSaveRename = async (id: string) => {
    const trimmed = editingTitle.trim();
    if (!trimmed) {
      setEditingId(null);
      return;
    }
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, title: trimmed } : c))
    );
    try {
      await fetch(`/api/conversations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: trimmed }),
      });
    } catch {}
    setEditingId(null);
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setActiveMenuId(null);
    setConversations((prev) => prev.filter((c) => c.id !== id));
    try {
      const res = await fetch(`/api/conversations/${id}`, { method: 'DELETE' });
      if (res.ok && currentId === id) {
        router.push('/');
      }
    } catch {}
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          onClick={onToggle}
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-xs md:hidden transition-opacity"
          aria-hidden="true"
        />
      )}

      {/* Sidebar Container: ~288px width, 200ms ease */}
      <aside
        className={`fixed md:relative inset-y-0 left-0 z-50 flex flex-col h-full bg-[var(--sidebar-bg)] border-r border-[var(--border)] transition-all duration-200 ease-in-out shrink-0 select-none ${
          isOpen
            ? 'w-[288px] translate-x-0'
            : '-translate-x-full md:w-0 md:opacity-0 md:pointer-events-none md:border-r-0'
        }`}
      >
        <div className="flex flex-col h-full w-[288px] overflow-hidden">
          {/* Top Header: Toggle + Logo + Astor */}
          <div className="flex items-center justify-between px-3 h-[52px] border-b border-[var(--border)] shrink-0">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onToggle}
                aria-label="Collapse sidebar"
                className="p-1.5 rounded-lg text-[var(--secondary)] hover:text-[var(--text)] hover:bg-[var(--hover)] transition-colors"
              >
                <PanelLeft size={18} />
              </button>
              <Link
                href="/"
                className="flex items-center gap-2 group pl-0.5"
                aria-label="Astor Home"
              >
                <div className="text-[var(--text)] transition-transform group-hover:scale-105">
                  <AstorMark size={22} />
                </div>
                <span className="font-serif text-[18px] font-medium tracking-tight text-[var(--text)]">
                  Astor
                </span>
              </Link>
            </div>
          </div>

          {/* Top Action Rows: New chat & Search */}
          <div className="px-3 pt-3 pb-1 space-y-1 shrink-0">
            {/* New chat pill highlight */}
            <Link
              href="/"
              className="group/new flex items-center justify-between w-full h-9 px-2.5 rounded-lg bg-[var(--hover)] hover:opacity-90 text-[var(--text)] text-[13.5px] font-medium transition-all"
              aria-label="New chat"
            >
              <div className="flex items-center gap-2.5">
                <Plus size={16} />
                <span>New chat</span>
              </div>
              <span className="opacity-0 group-hover/new:opacity-100 text-[10.5px] font-mono text-[var(--secondary)] transition-opacity">
                Ctrl+Shift+O
              </span>
            </Link>

            {/* Search row */}
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="group/search flex items-center justify-between w-full h-8 px-2.5 rounded-lg text-[var(--text)] hover:bg-[var(--hover)] text-[13.5px] transition-colors"
              aria-label="Search conversations"
            >
              <div className="flex items-center gap-2.5 text-[var(--secondary)] group-hover/search:text-[var(--text)]">
                <Search size={15} />
                <span className="text-[var(--text)]">Search</span>
              </div>
              <span className="text-[10.5px] font-mono text-[var(--secondary)]">
                Ctrl+K
              </span>
            </button>
          </div>

          {/* Recents Section Header */}
          <div className="px-4 pt-4 pb-1.5 flex items-center justify-between shrink-0">
            <span className="text-[12px] font-medium text-[var(--secondary)]">
              Recents
            </span>
          </div>

          {/* Conversations List */}
          <div className="flex-1 overflow-y-auto px-2 py-0.5 space-y-0.5">
            {conversations.length === 0 ? (
              <div className="px-3 py-6 text-center text-[12px] text-[var(--secondary)]">
                No recent conversations
              </div>
            ) : (
              conversations.map((conv) => {
                const isActive = currentId === conv.id;
                const isEditing = editingId === conv.id;

                if (isEditing) {
                  return (
                    <div
                      key={conv.id}
                      className="flex items-center gap-1 px-2.5 h-8 bg-[var(--hover)] rounded-lg"
                    >
                      <input
                        ref={editInputRef}
                        type="text"
                        value={editingTitle}
                        onChange={(e) => setEditingTitle(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveRename(conv.id);
                          if (e.key === 'Escape') setEditingId(null);
                        }}
                        className="w-full text-[13px] bg-transparent text-[var(--text)] focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => handleSaveRename(conv.id)}
                        className="p-1 text-[var(--text)] hover:opacity-70"
                        aria-label="Save title"
                      >
                        <Check size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="p-1 text-[var(--secondary)] hover:opacity-70"
                        aria-label="Cancel rename"
                      >
                        <X size={13} />
                      </button>
                    </div>
                  );
                }

                return (
                  <div
                    key={conv.id}
                    className={`group/row relative flex items-center justify-between h-8 px-2.5 rounded-lg text-[13.5px] transition-colors ${
                      isActive
                        ? 'bg-[var(--hover)] font-medium text-[var(--text)]'
                        : 'text-[var(--text)] hover:bg-[var(--hover)]'
                    }`}
                  >
                    <Link
                      href={`/c/${conv.id}`}
                      className="truncate flex-1 pr-2 text-left"
                      title={conv.title}
                    >
                      {conv.title}
                    </Link>

                    {/* Options Button "..." on hover */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        setActiveMenuId(activeMenuId === conv.id ? null : conv.id);
                      }}
                      aria-label="Conversation options"
                      className={`p-1 rounded-md text-[var(--secondary)] hover:text-[var(--text)] transition-opacity ${
                        activeMenuId === conv.id
                          ? 'opacity-100 bg-[var(--border)]'
                          : 'opacity-0 group-hover/row:opacity-100'
                      }`}
                    >
                      <MoreHorizontal size={14} />
                    </button>

                    {/* Options Popover Menu */}
                    {activeMenuId === conv.id && (
                      <div
                        ref={menuRef}
                        className="absolute right-2 top-8 z-50 w-36 py-1 rounded-[12px] border border-[var(--border)] bg-[var(--popover-bg)] shadow-xl text-xs animate-popover"
                      >
                        <button
                          type="button"
                          onClick={(e) => handleStartRename(conv, e)}
                          className="flex items-center justify-between w-full px-3 py-1.5 text-left text-[var(--text)] hover:bg-[var(--hover)] transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <Pencil size={13} />
                            <span>Rename</span>
                          </div>
                          <span className="text-[10px] text-[var(--secondary)] font-mono">R</span>
                        </button>
                        <button
                          type="button"
                          onClick={(e) => handleDelete(conv.id, e)}
                          className="flex items-center justify-between w-full px-3 py-1.5 text-left text-red-600 dark:text-red-400 hover:bg-[var(--hover)] transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <Trash2 size={13} />
                            <span>Delete</span>
                          </div>
                          <span className="text-[10px] text-red-500/80 font-mono">D</span>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Bottom Account Row & Upward Menu */}
          <div className="p-2 border-t border-[var(--border)] relative shrink-0">
            {/* Upward Account Menu */}
            {accountMenuOpen && (
              <div
                ref={accountMenuRef}
                className="absolute left-2 right-2 bottom-full mb-2 p-1.5 rounded-[12px] border border-[var(--border)] bg-[var(--popover-bg)] shadow-xl text-xs space-y-1 animate-popover z-50"
              >
                <div className="px-2.5 py-1 text-[11px] font-medium text-[var(--secondary)]">
                  hardik
                </div>
                <div className="h-px bg-[var(--border)] my-1" />

                {/* Theme Selector */}
                <div className="px-2 py-1 text-[11px] font-medium text-[var(--secondary)]">
                  Theme
                </div>
                <div className="grid grid-cols-3 gap-1 p-0.5 rounded-lg bg-[var(--hover)]">
                  <button
                    type="button"
                    onClick={() => setTheme('light')}
                    className={`flex items-center justify-center gap-1.5 py-1 px-1.5 rounded-md text-[11px] transition-colors ${
                      theme === 'light'
                        ? 'bg-[var(--popover-bg)] text-[var(--text)] shadow-xs font-medium'
                        : 'text-[var(--secondary)] hover:text-[var(--text)]'
                    }`}
                  >
                    <Sun size={12} />
                    <span>Light</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setTheme('dark')}
                    className={`flex items-center justify-center gap-1.5 py-1 px-1.5 rounded-md text-[11px] transition-colors ${
                      theme === 'dark'
                        ? 'bg-[var(--popover-bg)] text-[var(--text)] shadow-xs font-medium'
                        : 'text-[var(--secondary)] hover:text-[var(--text)]'
                    }`}
                  >
                    <Moon size={12} />
                    <span>Dark</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setTheme('system')}
                    className={`flex items-center justify-center gap-1.5 py-1 px-1.5 rounded-md text-[11px] transition-colors ${
                      theme === 'system'
                        ? 'bg-[var(--popover-bg)] text-[var(--text)] shadow-xs font-medium'
                        : 'text-[var(--secondary)] hover:text-[var(--text)]'
                    }`}
                  >
                    <Laptop size={12} />
                    <span>Auto</span>
                  </button>
                </div>

                <div className="h-px bg-[var(--border)] my-1" />

                {/* Keyboard Shortcuts Trigger */}
                <button
                  type="button"
                  onClick={() => {
                    setAccountMenuOpen(false);
                    setShortcutsModalOpen(true);
                  }}
                  className="flex items-center gap-2 w-full px-2.5 py-1.5 rounded-lg text-left text-[var(--text)] hover:bg-[var(--hover)] transition-colors"
                >
                  <Keyboard size={13} className="text-[var(--secondary)]" />
                  <span>Keyboard shortcuts</span>
                </button>

                {/* About Astor Trigger */}
                <button
                  type="button"
                  onClick={() => {
                    setAccountMenuOpen(false);
                    setAboutModalOpen(true);
                  }}
                  className="flex items-center gap-2 w-full px-2.5 py-1.5 rounded-lg text-left text-[var(--text)] hover:bg-[var(--hover)] transition-colors"
                >
                  <Info size={13} className="text-[var(--secondary)]" />
                  <span>About Astor</span>
                </button>
              </div>
            )}

            {/* Account Row */}
            <button
              type="button"
              onClick={() => setAccountMenuOpen((v) => !v)}
              className="flex items-center justify-between w-full p-2 rounded-lg hover:bg-[var(--hover)] transition-colors text-left"
              aria-label="Account menu"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-6 h-6 rounded-full bg-[var(--text)] text-[var(--bg)] font-sans text-xs font-medium flex items-center justify-center">
                  H
                </div>
                <span className="text-[13px] font-medium text-[var(--text)]">
                  Hardik
                </span>
              </div>
              <ChevronDown size={14} className="text-[var(--secondary)]" />
            </button>
          </div>
        </div>
      </aside>

      {/* Search Modal */}
      <SearchModal isOpen={searchOpen} onClose={() => setSearchOpen(false)} />

      {/* Keyboard Shortcuts Modal */}
      {shortcutsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-xs"
            onClick={() => setShortcutsModalOpen(false)}
          />
          <div className="relative w-full max-w-[440px] rounded-[16px] border border-[var(--border)] bg-[var(--popover-bg)] p-5 shadow-2xl space-y-4 animate-popover z-10">
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
              <h3 className="font-serif text-lg font-medium">Keyboard Shortcuts</h3>
              <button
                type="button"
                onClick={() => setShortcutsModalOpen(false)}
                className="p-1 rounded text-[var(--secondary)] hover:text-[var(--text)]"
              >
                <X size={16} />
              </button>
            </div>
            <div className="space-y-2.5 text-xs">
              <div className="flex items-center justify-between py-1 border-b border-[var(--border-subtle)]">
                <span className="text-[var(--secondary)]">Search conversations</span>
                <kbd className="px-2 py-0.5 rounded border border-[var(--border)] bg-[var(--hover)] font-mono">
                  Ctrl + K
                </kbd>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-[var(--border-subtle)]">
                <span className="text-[var(--secondary)]">Start new chat</span>
                <kbd className="px-2 py-0.5 rounded border border-[var(--border)] bg-[var(--hover)] font-mono">
                  Ctrl + Shift + O
                </kbd>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-[var(--border-subtle)]">
                <span className="text-[var(--secondary)]">Toggle sidebar</span>
                <kbd className="px-2 py-0.5 rounded border border-[var(--border)] bg-[var(--hover)] font-mono">
                  Ctrl + B
                </kbd>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-[var(--border-subtle)]">
                <span className="text-[var(--secondary)]">Send message</span>
                <kbd className="px-2 py-0.5 rounded border border-[var(--border)] bg-[var(--hover)] font-mono">
                  Enter
                </kbd>
              </div>
              <div className="flex items-center justify-between py-1">
                <span className="text-[var(--secondary)]">New line in composer</span>
                <kbd className="px-2 py-0.5 rounded border border-[var(--border)] bg-[var(--hover)] font-mono">
                  Shift + Enter
                </kbd>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* About Astor Modal */}
      {aboutModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-xs"
            onClick={() => setAboutModalOpen(false)}
          />
          <div className="relative w-full max-w-[420px] rounded-[16px] border border-[var(--border)] bg-[var(--popover-bg)] p-6 shadow-2xl space-y-4 animate-popover z-10 text-center">
            <div className="flex flex-col items-center space-y-2">
              <AstorMark size={32} />
              <h3 className="font-serif text-2xl font-medium tracking-tight">Astor</h3>
              <p className="text-xs text-[var(--secondary)]">Milestone 1b · Claude Monochrome Edition</p>
            </div>
            <div className="text-xs leading-relaxed text-[var(--secondary)] py-2 border-y border-[var(--border)] space-y-2 text-left">
              <p>
                Astor is an elegant, thoughtful AI chat assistant crafted with a strict black-and-white aesthetic inspired by Claude.ai.
              </p>
              <div className="flex justify-between py-1 font-mono text-[11px]">
                <span>Default Model</span>
                <span className="text-[var(--text)]">Muse Spark (muse-spark-1.3)</span>
              </div>
              <div className="flex justify-between py-1 font-mono text-[11px]">
                <span>Persistence</span>
                <span className="text-[var(--text)]">SQLite WAL (node:sqlite)</span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setAboutModalOpen(false)}
              className="w-full py-2 rounded-lg bg-[var(--text)] text-[var(--bg)] text-xs font-medium hover:opacity-90 transition-opacity"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}
