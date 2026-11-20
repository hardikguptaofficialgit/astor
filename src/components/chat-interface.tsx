'use client';

import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport, UIMessage } from 'ai';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  ArrowUp,
  Square,
  Copy,
  Check,
  RotateCw,
  ThumbsUp,
  ThumbsDown,
  ChevronDown,
  AlertCircle,
  PanelLeft,
  Plus,
  Globe,
  Brain,
  Sparkles,
  Code2,
  Compass,
  Clock,
  Pencil,
  Trash2,
} from 'lucide-react';
import { AstorMark } from './astor-mark';
import { CodeBlock } from './code-block';
import { Sidebar, ConversationItem } from './sidebar';

interface ChatInterfaceProps {
  initialId?: string;
  initialMessages?: UIMessage[];
  isNewChat?: boolean;
}

export function ChatInterface({
  initialId,
  initialMessages = [],
  isNewChat = false,
}: ChatInterfaceProps) {
  const router = useRouter();

  // Stable conversation ID
  const [conversationId] = useState(() => initialId || crypto.randomUUID());
  const [input, setInput] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [userScrolledUp, setUserScrolledUp] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // Optimistic conversation for immediate sidebar display
  const [optimisticConv, setOptimisticConv] = useState<ConversationItem | null>(null);
  const [conversationTitle, setConversationTitle] = useState<string>('New chat');

  // Thumbs feedback state
  const [thumbsState, setThumbsState] = useState<Record<string, 'up' | 'down' | null>>({});

  // Plus menu popover state
  const [plusMenuOpen, setPlusMenuOpen] = useState(false);
  const [webSearchEnabled, setWebSearchEnabled] = useState(true);
  const [memoryEnabled, setMemoryEnabled] = useState(true);

  // Conversation title dropdown state (in top bar)
  const [titleMenuOpen, setTitleMenuOpen] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const plusMenuRef = useRef<HTMLDivElement>(null);
  const titleMenuRef = useRef<HTMLDivElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

  // Fetch initial title if existing conversation
  useEffect(() => {
    if (initialId) {
      fetch(`/api/conversations/${initialId}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data?.title) {
            setConversationTitle(data.title);
          }
        })
        .catch(() => {});
    }
  }, [initialId]);

  // Transport configuration passing optional flags
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: '/api/chat',
        body: {
          id: conversationId,
          webSearch: webSearchEnabled,
          memory: memoryEnabled,
        },
      }),
    [conversationId, webSearchEnabled, memoryEnabled]
  );

  // useChat integration
  const {
    messages,
    sendMessage,
    regenerate,
    stop,
    status,
    error,
  } = useChat({
    id: conversationId,
    transport,
    messages: initialMessages,
  });

  const isStreaming = status === 'streaming' || status === 'submitted';
  const hasMessages = messages.length > 0;

  // Refetch conversations when streaming finishes to keep sidebar strictly synced with DB
  const prevStreamingRef = useRef(isStreaming);
  useEffect(() => {
    if (prevStreamingRef.current && !isStreaming) {
      setRefreshKey((k) => k + 1);
      window.dispatchEvent(new CustomEvent('astor:conversation-updated'));
    }
    prevStreamingRef.current = isStreaming;
  }, [isStreaming]);

  // Helper to extract text from a UIMessage
  const getMessageText = useCallback((msg: UIMessage): string => {
    if (msg.parts && Array.isArray(msg.parts)) {
      return msg.parts
        .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
        .map((p) => p.text)
        .join('');
    }
    if (typeof (msg as unknown as { content?: string }).content === 'string') {
      return (msg as unknown as { content: string }).content;
    }
    return '';
  }, []);

  // Time greeting based on current local hour
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    // Occasionally "What's on your mind?" if late night or randomly
    if (hour >= 22 || hour < 5) return "What's on your mind?";
    if (hour >= 5 && hour < 12) return 'Good morning, Hardik';
    if (hour >= 12 && hour < 17) return 'Good afternoon, Hardik';
    return 'Evening, Hardik';
  }, []);

  // Auto-scroll handler
  const handleScroll = () => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const distanceToBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    setUserScrolledUp(distanceToBottom > 80);
  };

  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
    setUserScrolledUp(false);
  };

  useEffect(() => {
    if (!userScrolledUp) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, status, userScrolledUp]);

  // Adjust textarea height on input change
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    }
  }, [input]);

  // Close menus on outside click or Esc
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (plusMenuRef.current && !plusMenuRef.current.contains(e.target as Node)) {
        setPlusMenuOpen(false);
      }
      if (titleMenuRef.current && !titleMenuRef.current.contains(e.target as Node)) {
        setTitleMenuOpen(false);
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPlusMenuOpen(false);
        setTitleMenuOpen(false);
        setIsRenaming(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEsc);
    };
  }, []);

  // Send message with instant optimistic insert
  const handleSend = async (overridePrompt?: string) => {
    const textToSend = (overridePrompt ?? input).trim();
    if (!textToSend || isStreaming) return;

    setInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    // Generate optimistic title if first message
    if (!hasMessages) {
      const clean = textToSend.replace(/\s+/g, ' ').trim();
      const generatedTitle = clean.length <= 40 ? clean || 'New Chat' : clean.slice(0, 40).trim() + '...';
      setConversationTitle(generatedTitle);

      const optimisticItem: ConversationItem = {
        id: conversationId,
        title: generatedTitle,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      setOptimisticConv(optimisticItem);

      // Dispatch event so any listener updates immediately
      window.dispatchEvent(
        new CustomEvent('astor:conversation-updated', { detail: optimisticItem })
      );

      // Update URL to /c/[id] without full page refresh
      if (isNewChat && window.location.pathname === '/') {
        window.history.replaceState(null, '', `/c/${conversationId}`);
      }
    }

    try {
      await sendMessage({ text: textToSend });
    } catch {
      // Error handled via useChat error state
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleCopyMessage = async (msgId: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedMessageId(msgId);
      setTimeout(() => setCopiedMessageId(null), 2000);
    } catch {}
  };

  const handleToggleThumbs = (msgId: string, type: 'up' | 'down') => {
    setThumbsState((prev) => ({
      ...prev,
      [msgId]: prev[msgId] === type ? null : type,
    }));
  };

  // Rename conversation from top bar
  const handleStartRename = () => {
    setTitleMenuOpen(false);
    setIsRenaming(true);
    setRenameValue(conversationTitle);
    setTimeout(() => {
      renameInputRef.current?.focus();
      renameInputRef.current?.select();
    }, 50);
  };

  const handleSaveRename = async () => {
    const trimmed = renameValue.trim();
    if (!trimmed) {
      setIsRenaming(false);
      return;
    }
    setConversationTitle(trimmed);
    setIsRenaming(false);

    try {
      await fetch(`/api/conversations/${conversationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: trimmed }),
      });
      window.dispatchEvent(new CustomEvent('astor:conversation-updated'));
    } catch {}
  };

  // Delete conversation from top bar
  const handleDeleteConversation = async () => {
    setTitleMenuOpen(false);
    try {
      await fetch(`/api/conversations/${conversationId}`, { method: 'DELETE' });
      window.dispatchEvent(new CustomEvent('astor:conversation-updated'));
      router.push('/');
    } catch {}
  };

  // Helper for relative time formatting
  const formatRelativeTime = (timestamp?: string) => {
    if (!timestamp) return 'Just now';
    const date = new Date(timestamp);
    const now = new Date();
    const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);
    if (diffSec < 60) return 'Just now';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const suggestionChips = [
    { label: "What's new in AI this week?", icon: Sparkles },
    { label: 'Compare Postgres hosting prices', icon: Code2 },
    { label: "Summarise today's tech news", icon: Compass },
    { label: 'What did I ask you yesterday?', icon: Clock },
  ];

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[var(--bg)] text-[var(--text)]">
      {/* Sidebar: ~288px, slide ease 200ms */}
      <Sidebar
        currentId={hasMessages ? conversationId : undefined}
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen((v) => !v)}
        refreshKey={refreshKey}
        optimisticConversation={optimisticConv}
      />

      {/* Main Column */}
      <main className="flex-1 flex flex-col h-full relative overflow-hidden bg-[var(--bg)]">
        {/* Top Bar (Active chat only) or Floating toggle on Home */}
        {hasMessages ? (
          <div className="h-[48px] flex items-center justify-between px-4 border-b border-[var(--border)] shrink-0 z-20 bg-[var(--bg)]">
            <div className="flex items-center gap-2 min-w-0">
              {/* Sidebar toggle button (visible when sidebar is closed) */}
              {!sidebarOpen && (
                <button
                  type="button"
                  onClick={() => setSidebarOpen(true)}
                  aria-label="Expand sidebar"
                  className="p-1.5 rounded-lg text-[var(--secondary)] hover:text-[var(--text)] hover:bg-[var(--hover)] transition-colors shrink-0"
                >
                  <PanelLeft size={18} />
                </button>
              )}

              {/* Title with chevron menu */}
              {isRenaming ? (
                <div className="flex items-center gap-1">
                  <input
                    ref={renameInputRef}
                    type="text"
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveRename();
                      if (e.key === 'Escape') setIsRenaming(false);
                    }}
                    onBlur={handleSaveRename}
                    className="text-[14px] font-medium bg-[var(--hover)] text-[var(--text)] px-2 py-0.5 rounded-md focus:outline-none border border-[var(--border)]"
                  />
                </div>
              ) : (
                <div className="relative" ref={titleMenuRef}>
                  <button
                    type="button"
                    onClick={() => setTitleMenuOpen((v) => !v)}
                    className="flex items-center gap-1.5 text-[14px] font-medium text-[var(--text)] hover:bg-[var(--hover)] px-2 py-1 rounded-lg transition-colors truncate max-w-[400px]"
                    aria-label="Conversation options"
                  >
                    <span className="truncate">{conversationTitle}</span>
                    <ChevronDown size={14} className="text-[var(--secondary)] shrink-0" />
                  </button>

                  {/* Title Dropdown Menu */}
                  {titleMenuOpen && (
                    <div className="absolute left-0 top-full mt-1.5 z-50 w-36 py-1 rounded-[12px] border border-[var(--border)] bg-[var(--popover-bg)] shadow-xl text-xs animate-popover">
                      <button
                        type="button"
                        onClick={handleStartRename}
                        className="flex items-center gap-2 w-full px-3 py-1.5 text-left text-[var(--text)] hover:bg-[var(--hover)] transition-colors"
                      >
                        <Pencil size={13} />
                        <span>Rename</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleDeleteConversation}
                        className="flex items-center gap-2 w-full px-3 py-1.5 text-left text-red-600 dark:text-red-400 hover:bg-[var(--hover)] transition-colors"
                      >
                        <Trash2 size={13} />
                        <span>Delete</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => router.push('/')}
                title="New chat"
                aria-label="New chat"
                className="p-1.5 rounded-lg text-[var(--secondary)] hover:text-[var(--text)] hover:bg-[var(--hover)] transition-colors"
              >
                <Plus size={18} />
              </button>
            </div>
          </div>
        ) : (
          /* Floating toggle on Home when sidebar collapsed */
          !sidebarOpen && (
            <div className="absolute top-3 left-3 z-30">
              <button
                type="button"
                onClick={() => setSidebarOpen(true)}
                aria-label="Expand sidebar"
                className="p-1.5 rounded-lg text-[var(--secondary)] hover:text-[var(--text)] hover:bg-[var(--hover)] transition-colors"
              >
                <PanelLeft size={18} />
              </button>
            </div>
          )
        )}

        {/* Content Area */}
        {!hasMessages ? (
          /* ==================== HOME / NEW CHAT VIEW ==================== */
          <div className="flex-1 flex flex-col items-center justify-center p-4 max-w-[660px] w-full mx-auto my-auto space-y-7 -mt-10">
            {/* Centered Logo & Greeting */}
            <div className="flex flex-col items-center text-center space-y-3.5">
              <div className="text-[var(--text)]">
                <AstorMark size={28} />
              </div>
              <h1 className="font-serif text-3xl md:text-[36px] font-normal tracking-tight text-[var(--text)] select-none">
                {greeting}
              </h1>
            </div>

            {/* Big Composer Card (~105px tall, radius 20px, 1px border + soft shadow) */}
            <div className="w-full relative">
              <div className="relative min-h-[105px] rounded-[20px] border border-[var(--border)] bg-[var(--composer-bg)] shadow-md transition-all focus-within:border-[var(--text)] focus-within:ring-1 focus-within:ring-[var(--text)]/20 p-3.5 flex flex-col justify-between">
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="How can I help you today?"
                  rows={2}
                  aria-label="Message Astor"
                  className="w-full resize-none bg-transparent text-[15px] font-sans text-[var(--text)] placeholder-[var(--secondary)] focus:outline-none leading-relaxed p-0.5"
                />

                {/* Bottom row inside composer */}
                <div className="flex items-center justify-between pt-2">
                  {/* Left: Plus button with popover */}
                  <div className="relative" ref={plusMenuRef}>
                    <button
                      type="button"
                      onClick={() => setPlusMenuOpen((v) => !v)}
                      aria-label="Composer options"
                      className="w-7 h-7 rounded-full flex items-center justify-center text-[var(--secondary)] hover:text-[var(--text)] hover:bg-[var(--hover)] transition-colors"
                    >
                      <Plus size={18} />
                    </button>

                    {/* Plus Menu Popover */}
                    {plusMenuOpen && (
                      <div className="absolute left-0 bottom-full mb-2 w-48 rounded-[12px] border border-[var(--border)] bg-[var(--popover-bg)] shadow-xl p-1 text-xs animate-popover z-50">
                        <button
                          type="button"
                          onClick={() => setWebSearchEnabled((v) => !v)}
                          className="flex items-center justify-between w-full px-2.5 py-1.5 rounded-lg text-left text-[var(--text)] hover:bg-[var(--hover)] transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <Globe size={13} className="text-[var(--secondary)]" />
                            <span>Web search</span>
                          </div>
                          {webSearchEnabled && <Check size={13} className="text-[var(--text)]" />}
                        </button>
                        <button
                          type="button"
                          onClick={() => setMemoryEnabled((v) => !v)}
                          className="flex items-center justify-between w-full px-2.5 py-1.5 rounded-lg text-left text-[var(--text)] hover:bg-[var(--hover)] transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <Brain size={13} className="text-[var(--secondary)]" />
                            <span>Memory</span>
                          </div>
                          {memoryEnabled && <Check size={13} className="text-[var(--text)]" />}
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Right: Model label & Round send button */}
                  <div className="flex items-center gap-3">
                    <span className="text-[12px] text-[var(--secondary)] select-none">
                      Muse Spark
                    </span>
                    <button
                      type="button"
                      onClick={() => handleSend()}
                      disabled={!input.trim()}
                      aria-label="Send message"
                      className="w-8 h-8 rounded-full bg-[var(--text)] text-[var(--bg)] flex items-center justify-center transition-all disabled:opacity-30 disabled:cursor-not-allowed hover:opacity-90 active:scale-95"
                    >
                      <ArrowUp size={16} />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* 4 Suggestion Chips with icons */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full pt-1">
              {suggestionChips.map((chip) => {
                const ChipIcon = chip.icon;
                return (
                  <button
                    key={chip.label}
                    type="button"
                    onClick={() => handleSend(chip.label)}
                    className="flex items-center gap-2.5 p-3 rounded-xl border border-[var(--border)] bg-[var(--bg)] text-left hover:bg-[var(--hover)] transition-all shadow-2xs group"
                  >
                    <ChipIcon
                      size={15}
                      className="text-[var(--secondary)] group-hover:text-[var(--text)] transition-colors shrink-0"
                    />
                    <span className="text-[13px] text-[var(--text)] truncate font-sans">
                      {chip.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          /* ==================== ACTIVE CONVERSATION VIEW ==================== */
          <div
            ref={scrollContainerRef}
            onScroll={handleScroll}
            className="flex-1 overflow-y-auto px-4 md:px-6 py-8"
          >
            <div className="max-w-[770px] mx-auto space-y-7 pb-36">
              {messages.map((message, idx) => {
                const isUser = message.role === 'user';
                const text = getMessageText(message);
                const isLast = idx === messages.length - 1;

                if (isUser) {
                  return (
                    <div key={message.id} className="flex justify-end">
                      <div className="max-w-[75%] rounded-[14px] px-4 py-2.5 bg-[var(--user-bubble)] text-[var(--text)] text-[15px] font-sans leading-relaxed shadow-2xs whitespace-pre-wrap selection:bg-[var(--hover)]">
                        {text}
                      </div>
                    </div>
                  );
                }

                // Assistant Message (no bubble, serif, no avatar)
                const currentThumbs = thumbsState[message.id];

                return (
                  <div key={message.id} className="group/msg w-full space-y-2 pt-1">
                    {/* Message Body (Serif 16.5px / 1.65, full markdown) */}
                    <div className="assistant-prose">
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                          code({
                            className,
                            children,
                            ...props
                          }: React.ComponentProps<'code'> & { inline?: boolean }) {
                            const match = /language-(\w+)/.exec(className || '');
                            const codeString = String(children).replace(/\n$/, '');
                            const isMultiLine = codeString.includes('\n');
                            if (match || isMultiLine) {
                              return (
                                <CodeBlock
                                  language={match ? match[1] : 'text'}
                                  code={codeString}
                                />
                              );
                            }
                            return (
                              <code
                                className="px-1.5 py-0.5 rounded font-mono text-[13px] bg-[var(--hover)] text-[var(--text)] border border-[var(--border)]"
                                {...props}
                              >
                                {children}
                              </code>
                            );
                          },
                          table({ children }) {
                            return (
                              <div className="overflow-x-auto my-4 border border-[var(--border)] rounded-lg">
                                <table className="w-full text-left text-sm font-sans border-collapse">
                                  {children}
                                </table>
                              </div>
                            );
                          },
                          thead({ children }) {
                            return (
                              <thead className="bg-[var(--hover)]/60 border-b border-[var(--border)]">
                                {children}
                              </thead>
                            );
                          },
                          th({ children }) {
                            return (
                              <th className="px-3.5 py-2.5 text-xs font-semibold text-[var(--secondary)]">
                                {children}
                              </th>
                            );
                          },
                          td({ children }) {
                            return (
                              <td className="px-3.5 py-2.5 border-t border-[var(--border)] text-sm font-sans">
                                {children}
                              </td>
                            );
                          },
                          a({ href, children }) {
                            return (
                              <a
                                href={href}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="underline underline-offset-4 hover:opacity-80 transition-opacity"
                              >
                                {children}
                              </a>
                            );
                          },
                          ul({ children }) {
                            return <ul className="list-disc pl-5 my-2 space-y-1">{children}</ul>;
                          },
                          ol({ children }) {
                            return <ol className="list-decimal pl-5 my-2 space-y-1">{children}</ol>;
                          },
                          li({ children }) {
                            return <li className="pl-1">{children}</li>;
                          },
                          blockquote({ children }) {
                            return (
                              <blockquote className="border-l-2 border-[var(--secondary)] pl-4 italic my-3 text-[var(--secondary)]">
                                {children}
                              </blockquote>
                            );
                          },
                        }}
                      >
                        {text}
                      </ReactMarkdown>
                    </div>

                    {/* Action Bar Under Assistant Reply: Copy, Thumbs up, Thumbs down, Retry, relative time */}
                    <div
                      className={`flex items-center gap-2 pt-1 text-xs text-[var(--secondary)] font-sans transition-opacity ${
                        isLast ? 'opacity-100' : 'opacity-0 group-hover/msg:opacity-100'
                      }`}
                    >
                      {/* Copy */}
                      <button
                        type="button"
                        onClick={() => handleCopyMessage(message.id, text)}
                        aria-label="Copy message"
                        className="p-1 rounded-md hover:text-[var(--text)] hover:bg-[var(--hover)] transition-colors"
                        title="Copy text"
                      >
                        {copiedMessageId === message.id ? (
                          <Check size={14} className="text-[var(--text)]" />
                        ) : (
                          <Copy size={14} />
                        )}
                      </button>

                      {/* Thumbs up */}
                      <button
                        type="button"
                        onClick={() => handleToggleThumbs(message.id, 'up')}
                        aria-label="Good response"
                        className={`p-1 rounded-md hover:text-[var(--text)] hover:bg-[var(--hover)] transition-colors ${
                          currentThumbs === 'up' ? 'text-[var(--text)] bg-[var(--hover)]' : ''
                        }`}
                        title="Good response"
                      >
                        <ThumbsUp size={14} />
                      </button>

                      {/* Thumbs down */}
                      <button
                        type="button"
                        onClick={() => handleToggleThumbs(message.id, 'down')}
                        aria-label="Bad response"
                        className={`p-1 rounded-md hover:text-[var(--text)] hover:bg-[var(--hover)] transition-colors ${
                          currentThumbs === 'down' ? 'text-[var(--text)] bg-[var(--hover)]' : ''
                        }`}
                        title="Bad response"
                      >
                        <ThumbsDown size={14} />
                      </button>

                      {/* Retry */}
                      <button
                        type="button"
                        onClick={() => regenerate({ messageId: message.id })}
                        aria-label="Retry response"
                        className="p-1 rounded-md hover:text-[var(--text)] hover:bg-[var(--hover)] transition-colors"
                        title="Retry response"
                      >
                        <RotateCw size={14} />
                      </button>

                      {/* Timestamp with exact tooltip */}
                      <span
                        className="text-[11px] opacity-75 pl-1 cursor-default"
                        title={new Date().toLocaleString()}
                      >
                        {formatRelativeTime()}
                      </span>
                    </div>
                  </div>
                );
              })}

              {/* Waiting for first token: pulsing AstorMark */}
              {status === 'submitted' && (
                <div className="flex items-center gap-3 py-3">
                  <div className="animate-pulse-subtle text-[var(--text)]">
                    <AstorMark size={18} />
                  </div>
                  <span className="text-xs text-[var(--secondary)] font-sans">
                    Astor is thinking...
                  </span>
                </div>
              )}

              {/* One tidy inline error card in chat only */}
              {error && (
                <div className="flex items-start gap-3 p-3.5 rounded-xl border border-[var(--border)] bg-[var(--user-bubble)] text-xs text-[var(--text)] shadow-xs animate-popover">
                  <AlertCircle size={16} className="text-[var(--secondary)] shrink-0 mt-0.5" />
                  <div className="flex-1 space-y-1 font-sans">
                    <p className="font-medium">Error communicating with Astor</p>
                    <p className="text-[var(--secondary)] leading-relaxed">
                      {error.message || 'An error occurred during response generation. Check META_API_KEY in .env.'}
                    </p>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          </div>
        )}

        {/* Floating Scroll to Bottom Button */}
        {hasMessages && userScrolledUp && (
          <button
            type="button"
            onClick={() => scrollToBottom('smooth')}
            aria-label="Scroll to bottom"
            className="absolute bottom-28 right-8 z-30 p-2 rounded-full border border-[var(--border)] bg-[var(--popover-bg)] text-[var(--text)] shadow-lg hover:bg-[var(--hover)] active:scale-95 transition-all"
          >
            <ChevronDown size={18} />
          </button>
        )}

        {/* ==================== COMPOSER IN CHAT ==================== */}
        {hasMessages && (
          <div className="absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-[var(--bg)] via-[var(--bg)] to-transparent pt-6 pb-3 px-4">
            <div className="max-w-[770px] mx-auto w-full">
              <div className="relative rounded-[20px] border border-[var(--border)] bg-[var(--composer-bg)] shadow-md transition-all focus-within:border-[var(--text)] focus-within:ring-1 focus-within:ring-[var(--text)]/20 p-2.5 flex flex-col justify-between">
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Reply to Astor..."
                  rows={1}
                  aria-label="Message Astor"
                  className="w-full resize-none bg-transparent text-[15px] font-sans text-[var(--text)] placeholder-[var(--secondary)] focus:outline-none leading-relaxed p-1 max-h-[200px]"
                />

                {/* Bottom row inside chat composer */}
                <div className="flex items-center justify-between pt-1">
                  {/* Left: Plus button with popover */}
                  <div className="relative" ref={plusMenuRef}>
                    <button
                      type="button"
                      onClick={() => setPlusMenuOpen((v) => !v)}
                      aria-label="Composer options"
                      className="w-7 h-7 rounded-full flex items-center justify-center text-[var(--secondary)] hover:text-[var(--text)] hover:bg-[var(--hover)] transition-colors"
                    >
                      <Plus size={18} />
                    </button>

                    {/* Plus Menu Popover */}
                    {plusMenuOpen && (
                      <div className="absolute left-0 bottom-full mb-2 w-48 rounded-[12px] border border-[var(--border)] bg-[var(--popover-bg)] shadow-xl p-1 text-xs animate-popover z-50">
                        <button
                          type="button"
                          onClick={() => setWebSearchEnabled((v) => !v)}
                          className="flex items-center justify-between w-full px-2.5 py-1.5 rounded-lg text-left text-[var(--text)] hover:bg-[var(--hover)] transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <Globe size={13} className="text-[var(--secondary)]" />
                            <span>Web search</span>
                          </div>
                          {webSearchEnabled && <Check size={13} className="text-[var(--text)]" />}
                        </button>
                        <button
                          type="button"
                          onClick={() => setMemoryEnabled((v) => !v)}
                          className="flex items-center justify-between w-full px-2.5 py-1.5 rounded-lg text-left text-[var(--text)] hover:bg-[var(--hover)] transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <Brain size={13} className="text-[var(--secondary)]" />
                            <span>Memory</span>
                          </div>
                          {memoryEnabled && <Check size={13} className="text-[var(--text)]" />}
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Right: Send arrow or stop square */}
                  <div className="flex items-center gap-2">
                    {isStreaming ? (
                      <button
                        type="button"
                        onClick={() => stop()}
                        aria-label="Stop generation"
                        className="w-8 h-8 rounded-full bg-[var(--text)] text-[var(--bg)] flex items-center justify-center transition-all hover:opacity-90 active:scale-95"
                      >
                        <Square size={13} fill="currentColor" />
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleSend()}
                        disabled={!input.trim()}
                        aria-label="Send message"
                        className="w-8 h-8 rounded-full bg-[var(--text)] text-[var(--bg)] flex items-center justify-center transition-all disabled:opacity-30 disabled:cursor-not-allowed hover:opacity-90 active:scale-95"
                      >
                        <ArrowUp size={16} />
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Disclaimer */}
              <p className="text-center text-[11px] text-[var(--secondary)] mt-2">
                Astor can make mistakes. Check important info.
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
