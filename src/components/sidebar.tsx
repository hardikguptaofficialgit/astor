'use client';

import React, { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import {
  PanelLeftClose,
  PanelLeft,
  Plus,
  MoreHorizontal,
  Pencil,
  Trash2,
  Sun,
  Moon,
  Laptop,
  Check,
  X,
} from 'lucide-react';
import { AstorIcon } from './astor-icon';
import { useTheme } from './theme-provider';

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
  onRefreshConversations?: () => void;
  refreshKey?: number;
}

export function Sidebar({
  currentId,
  isOpen,
  onToggle,
  refreshKey = 0,
}: SidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { theme, setTheme, resolvedTheme } = useTheme();

  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const menuRef = useRef<HTMLDivElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);

  // Fetch conversations
  const fetchConversations = async () => {
    try {
      const res = await fetch('/api/conversations');
      if (res.ok) {
        const data = await res.json();
        setConversations(data);
      }
    } catch {}
  };

  useEffect(() => {
    fetchConversations();
  }, [refreshKey, pathname]);

  // Close context menu on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setActiveMenuId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
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
    if (!editingTitle.trim()) {
      setEditingId(null);
      return;
    }
    try {
      const res = await fetch(`/api/conversations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: editingTitle.trim() }),
      });
      if (res.ok) {
        setConversations((prev) =>
          prev.map((c) => (c.id === id ? { ...c, title: editingTitle.trim() } : c))
        );
      }
    } catch {}
    setEditingId(null);
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setActiveMenuId(null);
    try {
      const res = await fetch(`/api/conversations/${id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setConversations((prev) => prev.filter((c) => c.id !== id));
        if (currentId === id) {
          router.push('/');
        }
      }
    } catch {}
  };

  // Grouping helper
  const groupConversations = () => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startOfYesterday = startOfToday - 24 * 60 * 60 * 1000;
    const sevenDaysAgo = startOfToday - 6 * 24 * 60 * 60 * 1000;

    const today: ConversationItem[] = [];
    const yesterday: ConversationItem[] = [];
    const last7Days: ConversationItem[] = [];
    const older: ConversationItem[] = [];

    for (const conv of conversations) {
      const time = new Date(conv.updated_at || conv.created_at).getTime();
      if (time >= startOfToday) {
        today.push(conv);
      } else if (time >= startOfYesterday) {
        yesterday.push(conv);
      } else if (time >= sevenDaysAgo) {
        last7Days.push(conv);
      } else {
        older.push(conv);
      }
    }

    return [
      { label: 'Today', items: today },
      { label: 'Yesterday', items: yesterday },
      { label: 'Previous 7 days', items: last7Days },
      { label: 'Older', items: older },
    ].filter((group) => group.items.length > 0);
  };

  const grouped = groupConversations();

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          onClick={onToggle}
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-xs md:hidden"
          aria-hidden="true"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed md:static inset-y-0 left-0 z-50 flex flex-col h-full bg-[var(--surface)] border-r border-[var(--border)] transition-[width,transform] duration-200 ease-in-out ${
          isOpen
            ? 'w-[260px] translate-x-0'
            : '-translate-x-full md:translate-x-0 md:w-[60px]'
        }`}
      >
        {/* Top Header */}
        <div className="flex items-center justify-between p-3.5 h-[56px] border-b border-[var(--border-subtle)]">
          {isOpen ? (
            <Link
              href="/"
              className="flex items-center gap-2.5 group overflow-hidden"
              aria-label="Astor Home"
            >
              <div className="w-7 h-7 rounded-lg bg-[var(--text)] text-[var(--bg)] flex items-center justify-center shrink-0 transition-transform group-hover:scale-105">
                <AstorIcon size={16} />
              </div>
              <span className="font-serif text-[19px] font-semibold tracking-tight text-[var(--text)]">
                Astor
              </span>
            </Link>
          ) : (
            <Link
              href="/"
              className="mx-auto w-7 h-7 rounded-lg bg-[var(--text)] text-[var(--bg)] flex items-center justify-center shrink-0 hover:scale-105 transition-transform"
              aria-label="Astor Home"
            >
              <AstorIcon size={16} />
            </Link>
          )}

          <button
            onClick={onToggle}
            type="button"
            aria-label={isOpen ? 'Collapse sidebar' : 'Expand sidebar'}
            className="p-1.5 rounded-md text-[var(--muted)] hover:text-[var(--text)] hover:bg-[var(--surface-hover)] transition-colors"
          >
            {isOpen ? <PanelLeftClose size={18} /> : <PanelLeft size={18} />}
          </button>
        </div>

        {/* New Chat Button */}
        <div className="p-3">
          <Link
            href="/"
            className={`flex items-center justify-center gap-2 w-full py-2 px-3 rounded-xl border border-[var(--border)] bg-[var(--bg)] text-[var(--text)] font-sans text-sm font-medium hover:bg-[var(--surface-hover)] active:scale-[0.98] transition-all shadow-2xs ${
              !isOpen ? 'px-0 justify-center' : ''
            }`}
            aria-label="Start a new chat"
          >
            <Plus size={16} />
            {isOpen && <span>New chat</span>}
          </Link>
        </div>

        {/* Recents Conversations List */}
        <div className="flex-1 overflow-y-auto px-2 py-1 space-y-4">
          {isOpen ? (
            grouped.length === 0 ? (
              <div className="px-3 py-6 text-center text-xs text-[var(--muted)]">
                No recent conversations
              </div>
            ) : (
              grouped.map((group) => (
                <div key={group.label} className="space-y-1">
                  <div className="px-2.5 py-1 text-[11px] font-medium uppercase tracking-wider text-[var(--muted)]">
                    {group.label}
                  </div>
                  {group.items.map((conv) => {
                    const isActive = currentId === conv.id;
                    const isEditing = editingId === conv.id;

                    return (
                      <div
                        key={conv.id}
                        className="relative group rounded-lg"
                      >
                        {isEditing ? (
                          <div className="flex items-center gap-1 px-2 py-1 bg-[var(--surface-active)] rounded-lg">
                            <input
                              ref={editInputRef}
                              type="text"
                              value={editingTitle}
                              onChange={(e) => setEditingTitle(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveRename(conv.id);
                                if (e.key === 'Escape') setEditingId(null);
                              }}
                              className="w-full text-xs bg-transparent text-[var(--text)] focus:outline-none"
                            />
                            <button
                              onClick={() => handleSaveRename(conv.id)}
                              className="p-1 text-[var(--text)] hover:opacity-70"
                              aria-label="Confirm rename"
                            >
                              <Check size={13} />
                            </button>
                            <button
                              onClick={() => setEditingId(null)}
                              className="p-1 text-[var(--muted)] hover:opacity-70"
                              aria-label="Cancel rename"
                            >
                              <X size={13} />
                            </button>
                          </div>
                        ) : (
                          <div
                            className={`flex items-center justify-between w-full px-2.5 py-1.5 rounded-lg text-xs font-sans transition-colors ${
                              isActive
                                ? 'bg-[var(--surface-active)] text-[var(--text)] font-medium'
                                : 'text-[var(--text)] hover:bg-[var(--surface-hover)]'
                            }`}
                          >
                            <Link
                              href={`/c/${conv.id}`}
                              className="truncate flex-1 pr-2 text-left"
                              title={conv.title}
                            >
                              {conv.title}
                            </Link>

                            {/* Menu Trigger */}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                e.preventDefault();
                                setActiveMenuId(activeMenuId === conv.id ? null : conv.id);
                              }}
                              aria-label="Conversation options"
                              className={`p-1 rounded text-[var(--muted)] hover:text-[var(--text)] transition-opacity ${
                                activeMenuId === conv.id
                                  ? 'opacity-100 bg-[var(--surface-hover)]'
                                  : 'opacity-0 group-hover:opacity-100'
                              }`}
                            >
                              <MoreHorizontal size={14} />
                            </button>
                          </div>
                        )}

                        {/* Menu Dropdown */}
                        {activeMenuId === conv.id && (
                          <div
                            ref={menuRef}
                            className="absolute right-1 top-8 z-50 w-32 py-1 rounded-lg border border-[var(--border)] bg-[var(--card-bg)] shadow-lg text-xs"
                          >
                            <button
                              type="button"
                              onClick={(e) => handleStartRename(conv, e)}
                              className="flex items-center gap-2 w-full px-3 py-1.5 text-left text-[var(--text)] hover:bg-[var(--surface-hover)] transition-colors"
                            >
                              <Pencil size={12} />
                              <span>Rename</span>
                            </button>
                            <button
                              type="button"
                              onClick={(e) => handleDelete(conv.id, e)}
                              className="flex items-center gap-2 w-full px-3 py-1.5 text-left text-[var(--text)] hover:bg-[var(--surface-hover)] transition-colors"
                            >
                              <Trash2 size={12} />
                              <span>Delete</span>
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))
            )
          ) : (
            /* Icon Rail View */
            <div className="flex flex-col items-center py-2 space-y-2">
              {conversations.slice(0, 8).map((conv) => (
                <Link
                  key={conv.id}
                  href={`/c/${conv.id}`}
                  title={conv.title}
                  className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-serif transition-colors ${
                    currentId === conv.id
                      ? 'bg-[var(--surface-active)] text-[var(--text)] font-semibold'
                      : 'text-[var(--muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--text)]'
                  }`}
                >
                  {conv.title.charAt(0).toUpperCase()}
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Sidebar Footer with Theme Toggle */}
        <div className="p-3 border-t border-[var(--border-subtle)]">
          {isOpen ? (
            <div className="flex items-center justify-between">
              <span className="text-xs text-[var(--muted)]">Theme</span>
              <div className="flex items-center p-0.5 rounded-lg border border-[var(--border)] bg-[var(--bg)]">
                <button
                  type="button"
                  onClick={() => setTheme('light')}
                  aria-label="Light mode"
                  className={`p-1.5 rounded-md transition-colors ${
                    theme === 'light'
                      ? 'bg-[var(--surface-active)] text-[var(--text)]'
                      : 'text-[var(--muted)] hover:text-[var(--text)]'
                  }`}
                >
                  <Sun size={13} />
                </button>
                <button
                  type="button"
                  onClick={() => setTheme('dark')}
                  aria-label="Dark mode"
                  className={`p-1.5 rounded-md transition-colors ${
                    theme === 'dark'
                      ? 'bg-[var(--surface-active)] text-[var(--text)]'
                      : 'text-[var(--muted)] hover:text-[var(--text)]'
                  }`}
                >
                  <Moon size={13} />
                </button>
                <button
                  type="button"
                  onClick={() => setTheme('system')}
                  aria-label="System mode"
                  className={`p-1.5 rounded-md transition-colors ${
                    theme === 'system'
                      ? 'bg-[var(--surface-active)] text-[var(--text)]'
                      : 'text-[var(--muted)] hover:text-[var(--text)]'
                  }`}
                >
                  <Laptop size={13} />
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
              aria-label="Toggle theme"
              className="w-full flex items-center justify-center py-2 text-[var(--muted)] hover:text-[var(--text)] transition-colors"
            >
              {resolvedTheme === 'dark' ? <Moon size={16} /> : <Sun size={16} />}
            </button>
          )}
        </div>
      </aside>
    </>
  );
}
