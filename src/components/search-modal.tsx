'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Search, X, MessageSquare, ArrowRight } from 'lucide-react';
import { SearchResult, Conversation } from '@/lib/db';

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SearchModal({ isOpen, onClose }: SearchModalProps) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [recents, setRecents] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const resultsContainerRef = useRef<HTMLDivElement>(null);

  // Focus input on open and reset state, fetch recents
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setResults([]);
      setSelectedIndex(0);
      fetch('/api/conversations')
        .then((res) => (res.ok ? res.json() : []))
        .then((data) => setRecents(data))
        .catch(() => setRecents([]));
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  // Global Esc key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Debounced search
  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      setLoading(false);
      setSelectedIndex(0);
      return;
    }

    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(trimmed)}`);
        if (res.ok) {
          const data: SearchResult[] = await res.json();
          setResults(data);
          setSelectedIndex(0);
        }
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 150);

    return () => clearTimeout(timer);
  }, [query]);

  const handleSelect = useCallback(
    (id: string) => {
      onClose();
      router.push(`/c/${id}`);
    },
    [router, onClose]
  );

  const currentItems = query.trim() ? results : recents;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (currentItems.length > 0 ? (prev + 1) % currentItems.length : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (currentItems.length > 0 ? (prev - 1 + currentItems.length) % currentItems.length : 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (currentItems.length > 0 && currentItems[selectedIndex]) {
        handleSelect(currentItems[selectedIndex].id);
      }
    }
  };

  // Helper to highlight snippet match
  const renderSnippet = (snippet: string, match: string) => {
    const index = snippet.toLowerCase().indexOf(match.toLowerCase());
    if (index === -1) {
      return snippet.slice(0, 100) + (snippet.length > 100 ? '...' : '');
    }

    const start = Math.max(0, index - 30);
    const end = Math.min(snippet.length, index + match.length + 50);
    const prefix = start > 0 ? '...' : '';
    const suffix = end < snippet.length ? '...' : '';

    const before = snippet.slice(start, index);
    const matched = snippet.slice(index, index + match.length);
    const after = snippet.slice(index + match.length, end);

    return (
      <span className="text-xs text-[var(--secondary)] truncate">
        {prefix}
        {before}
        <span className="font-semibold text-[var(--text)] underline underline-offset-2">
          {matched}
        </span>
        {after}
        {suffix}
      </span>
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] px-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity duration-150"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Dialog */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Search conversations"
        className="relative w-full max-w-[560px] rounded-[16px] border border-[var(--border)] bg-[var(--popover-bg)] shadow-2xl overflow-hidden animate-popover"
      >
        {/* Search Input Bar */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-[var(--border)]">
          <Search size={18} className="text-[var(--secondary)] shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search conversations and messages..."
            className="flex-1 bg-transparent text-[14px] text-[var(--text)] placeholder-[var(--secondary)] focus:outline-none"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label="Clear query"
              className="p-1 rounded text-[var(--secondary)] hover:text-[var(--text)]"
            >
              <X size={15} />
            </button>
          )}
          <kbd className="hidden sm:inline-block px-1.5 py-0.5 rounded border border-[var(--border)] bg-[var(--hover)] text-[10px] font-mono text-[var(--secondary)]">
            ESC
          </kbd>
        </div>

        {/* Results List */}
        <div
          ref={resultsContainerRef}
          className="max-h-[380px] overflow-y-auto p-2 divide-y divide-[var(--border-subtle)]"
        >
          {loading ? (
            <div className="py-8 text-center text-xs text-[var(--secondary)]">
              Searching...
            </div>
          ) : query.trim() && results.length === 0 ? (
            <div className="py-8 text-center text-xs text-[var(--secondary)]">
              No conversations found for &ldquo;{query}&rdquo;
            </div>
          ) : !query.trim() ? (
            recents.length === 0 ? (
              <div className="py-8 text-center text-xs text-[var(--secondary)]">
                No recent conversations
              </div>
            ) : (
              <div className="space-y-1">
                <div className="px-3 py-1.5 text-[11px] font-medium text-[var(--secondary)] select-none">
                  Recent conversations
                </div>
                {recents.map((item, idx) => {
                  const isSelected = idx === selectedIndex;
                  return (
                    <div
                      key={item.id}
                      onClick={() => handleSelect(item.id)}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      className={`flex items-start justify-between gap-3 p-3 rounded-xl cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-[var(--hover)] text-[var(--text)]'
                          : 'hover:bg-[var(--hover)] text-[var(--text)]'
                      }`}
                    >
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        <MessageSquare size={16} className="text-[var(--secondary)] shrink-0 mt-0.5" />
                        <div className="min-w-0 flex-1">
                          <p className="text-[13.5px] font-medium truncate">{item.title}</p>
                        </div>
                      </div>
                      <ArrowRight
                        size={14}
                        className={`shrink-0 mt-1 transition-opacity ${
                          isSelected ? 'opacity-100 text-[var(--text)]' : 'opacity-0'
                        }`}
                      />
                    </div>
                  );
                })}
              </div>
            )
          ) : (
            results.map((item, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <div
                  key={item.id}
                  onClick={() => handleSelect(item.id)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`flex items-start justify-between gap-3 p-3 rounded-xl cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-[var(--hover)] text-[var(--text)]'
                      : 'hover:bg-[var(--hover)] text-[var(--text)]'
                  }`}
                >
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <MessageSquare size={16} className="text-[var(--secondary)] shrink-0 mt-0.5" />
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="text-[13.5px] font-medium truncate">{item.title}</p>
                      {item.snippet && (
                        <p className="text-xs text-[var(--secondary)] truncate">
                          {renderSnippet(item.snippet, query.trim())}
                        </p>
                      )}
                    </div>
                  </div>
                  <ArrowRight
                    size={14}
                    className={`shrink-0 mt-1 transition-opacity ${
                      isSelected ? 'opacity-100 text-[var(--text)]' : 'opacity-0'
                    }`}
                  />
                </div>
              );
            })
          )}
        </div>

        {/* Footer shortcuts */}
        <div className="flex items-center justify-between px-4 py-2 border-t border-[var(--border)] bg-[var(--hover)]/40 text-[11px] text-[var(--secondary)]">
          <div className="flex items-center gap-3">
            <span>
              <kbd className="px-1 py-0.5 rounded border border-[var(--border)] bg-[var(--popover-bg)] text-[10px] font-mono">
                ↑
              </kbd>{' '}
              <kbd className="px-1 py-0.5 rounded border border-[var(--border)] bg-[var(--popover-bg)] text-[10px] font-mono">
                ↓
              </kbd>{' '}
              to navigate
            </span>
            <span>
              <kbd className="px-1 py-0.5 rounded border border-[var(--border)] bg-[var(--popover-bg)] text-[10px] font-mono">
                ↵
              </kbd>{' '}
              to open
            </span>
          </div>
          <span>Astor Search</span>
        </div>
      </div>
    </div>
  );
}
