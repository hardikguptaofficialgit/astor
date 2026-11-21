'use client';

import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
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
  ExternalLink,
  X,
  FileText,
  Image as ImageIcon,
  Volume2,
} from 'lucide-react';
import { AstorMark } from './astor-mark';
import { CodeBlock } from './code-block';
import { Sidebar, ConversationItem } from './sidebar';
import { OnboardingModal } from './onboarding-modal';
import { UserAvatar } from './user-avatar';
import { NumberedSource } from '@/lib/db';
import { formatISTDateTime, formatISTDate } from '@/lib/utils/date';
import type { RecalledTurn } from '@/lib/memory/recall';

interface WebSearchToolState {
  isSearching: boolean;
  queries: string[];
  sources: NumberedSource[];
}

function getWebSearchState(message: UIMessage): WebSearchToolState {
  let isSearching = false;
  let queries: string[] = [];
  let sources: NumberedSource[] = [];

  if (!message.parts || !Array.isArray(message.parts)) {
    return { isSearching, queries, sources };
  }

  for (const part of message.parts) {
    const p = part as Record<string, unknown>;
    const isWebSearch =
      p.type === 'tool-web_search' ||
      p.toolName === 'web_search' ||
      (p.type === 'dynamic-tool' && p.toolName === 'web_search');

    if (isWebSearch) {
      if (p.state === 'input-streaming' || p.state === 'input-available') {
        isSearching = true;
        const inputObj = p.input as { queries?: string[] } | undefined;
        if (inputObj?.queries && Array.isArray(inputObj.queries)) {
          queries = inputObj.queries;
        }
      } else if (p.state === 'output-available') {
        const outputObj = p.output as
          | { state?: string; queries?: string[]; results?: NumberedSource[] }
          | undefined;
        if (outputObj?.state === 'searching') {
          isSearching = true;
          if (outputObj.queries && Array.isArray(outputObj.queries)) {
            queries = outputObj.queries;
          }
        } else if (outputObj?.state === 'done') {
          isSearching = false;
          if (outputObj.results && Array.isArray(outputObj.results)) {
            sources = outputObj.results;
          }
          if (outputObj.queries && Array.isArray(outputObj.queries)) {
            queries = outputObj.queries;
          }
        }
      }
    }
  }

  return { isSearching, queries, sources };
}

function getRecalledTurns(message: UIMessage): RecalledTurn[] {
  if (!message.parts || !Array.isArray(message.parts)) return [];
  for (const part of message.parts) {
    const p = part as Record<string, unknown>;
    if (p.type === 'data-recall' && p.data && typeof p.data === 'object') {
      const dataObj = p.data as { turns?: RecalledTurn[] };
      if (dataObj.turns && Array.isArray(dataObj.turns)) {
        return dataObj.turns;
      }
    }
  }
  return [];
}

function formatDisplayDate(dateStr?: string | null): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

function linkifyCitations(text: string, sourcesMap: Map<number, NumberedSource>): string {
  if (!text || sourcesMap.size === 0) return text;
  const segments = text.split(/(```[\s\S]*?```|`[^`\n]*`)/g);
  return segments
    .map((segment, i) => {
      if (i % 2 === 1) return segment; // Inside code
      return segment.replace(/\[(\d+)\]/g, (match, numStr) => {
        const num = parseInt(numStr, 10);
        if (sourcesMap.has(num)) {
          return `[${num}](#source-${num})`;
        }
        return match;
      });
    })
    .join('');
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Hook to reveal text word-by-word while streaming, creating a smooth typing animation.
 */
function useTypewriter(fullText: string, isStreaming: boolean) {
  const [displayedLength, setDisplayedLength] = useState(isStreaming ? 0 : fullText.length);
  const targetLengthRef = useRef(fullText.length);
  targetLengthRef.current = fullText.length;

  useEffect(() => {
    if (!isStreaming) {
      setDisplayedLength(fullText.length);
      return;
    }

    // Adaptive typing speed: smooth word-by-word with instant catch-up when buffer builds
    const timer = setInterval(() => {
      setDisplayedLength((current) => {
        if (current >= targetLengthRef.current) return current;
        const diff = targetLengthRef.current - current;
        if (diff > 60) {
          return Math.min(targetLengthRef.current, current + 24);
        }
        if (diff > 30) {
          return Math.min(targetLengthRef.current, current + 12);
        }
        const remaining = fullText.slice(current);
        const nextSpace = remaining.search(/\s+/);
        if (nextSpace === -1) {
          return targetLengthRef.current;
        }
        const whitespaceLength = remaining.slice(nextSpace).match(/^\s+/)?.[0].length || 1;
        return Math.min(targetLengthRef.current, current + nextSpace + whitespaceLength);
      });
    }, 10);

    return () => clearInterval(timer);
  }, [isStreaming, fullText]);

  return isStreaming ? fullText.slice(0, displayedLength) : fullText;
}

function CitationSuperscript({ source, n }: { source: NumberedSource; n: number }) {
  const [isOpen, setIsOpen] = useState(false);
  const [coords, setCoords] = useState<{ top?: number; bottom?: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const closeTimerRef = useRef<NodeJS.Timeout | null>(null);

  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const fitsAbove = rect.top >= 220;
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;
    const left = isMobile
      ? 12
      : Math.max(12, Math.min(window.innerWidth - 332, rect.left + rect.width / 2 - 160));
    setCoords({
      top: fitsAbove ? undefined : rect.bottom + 8,
      bottom: fitsAbove ? window.innerHeight - rect.top + 8 : undefined,
      left,
    });
  }, []);

  const handleOpen = () => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    updatePosition();
    setIsOpen(true);
  };

  const handleCloseDelayed = () => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    closeTimerRef.current = setTimeout(() => {
      setIsOpen(false);
    }, 220);
  };

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    if (!isOpen) {
      updatePosition();
      setIsOpen(true);
    } else {
      setIsOpen(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    const handleScrollOrResize = () => updatePosition();
    const handleClickOutside = (e: MouseEvent) => {
      if (
        triggerRef.current?.contains(e.target as Node) ||
        popoverRef.current?.contains(e.target as Node)
      ) {
        return;
      }
      setIsOpen(false);
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };

    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, updatePosition]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={handleClick}
        onMouseEnter={handleOpen}
        onMouseLeave={handleCloseDelayed}
        aria-label={`Source [${n}]: ${source.title}`}
        className="inline-flex items-center justify-center min-w-[15px] h-[15px] px-1 text-[10px] font-mono font-medium rounded bg-[var(--hover)] hover:bg-[var(--text)] hover:text-[var(--bg)] text-[var(--secondary)] transition-colors no-underline cursor-pointer align-super leading-none ml-0.5 select-none"
      >
        {n}
      </button>

      {isOpen &&
        coords &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={popoverRef}
            role="tooltip"
            onMouseEnter={handleOpen}
            onMouseLeave={handleCloseDelayed}
            style={{
              top: coords.top !== undefined ? `${coords.top}px` : undefined,
              bottom: coords.bottom !== undefined ? `${coords.bottom}px` : undefined,
              left: `${coords.left}px`,
            }}
            className="fixed w-[320px] max-w-[calc(100vw-24px)] p-3.5 rounded-[14px] border border-[var(--border)] bg-[var(--popover-bg)] text-[var(--text)] shadow-2xl z-[9999] text-left font-sans block animate-popover pointer-events-auto"
          >
            <div className="flex items-center justify-between text-[11px] font-mono text-[var(--secondary)] mb-1.5">
              <span className="flex items-center gap-1.5 truncate">
                {source.favicon ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={source.favicon}
                    alt=""
                    className="w-3.5 h-3.5 rounded-xs shrink-0"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                ) : (
                  <Globe size={11} className="shrink-0" />
                )}
                <span className="truncate font-medium text-[var(--text)]">{source.domain}</span>
                {source.published_date && (
                  <>
                    <span className="opacity-50">•</span>
                    <span className="shrink-0 text-[10px]">
                      {formatDisplayDate(source.published_date)}
                    </span>
                  </>
                )}
              </span>
              <span className="font-mono text-[10px] text-[var(--secondary)] px-1.5 py-0.5 rounded bg-[var(--hover)] shrink-0 ml-1">
                [{n}]
              </span>
            </div>

            <a
              href={source.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block text-xs font-semibold text-[var(--text)] leading-snug line-clamp-2 hover:underline mb-1"
            >
              {source.title}
            </a>

            {source.snippet && (
              <p className="text-[11.5px] text-[var(--secondary)] leading-relaxed line-clamp-3 font-sans m-0">
                {source.snippet}
              </p>
            )}

            <div className="flex items-center justify-between pt-2 mt-2 border-t border-[var(--border)]/50">
              <span className="text-[10px] text-[var(--secondary)] font-mono">Verified source</span>
              <a
                href={source.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[11px] text-[var(--text)] hover:underline font-medium"
              >
                <span>Visit source</span>
                <ExternalLink size={10} />
              </a>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}

function AssistantMessageBody({
  text,
  isStreaming,
  sourcesMap,
}: {
  text: string;
  isStreaming: boolean;
  sourcesMap: Map<number, NumberedSource>;
}) {
  const animatedText = useTypewriter(text, isStreaming);

  if (!animatedText) return null;

  return (
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
          a({ href, children, ...props }) {
            if (href && href.startsWith('#source-')) {
              const num = parseInt(href.replace('#source-', ''), 10);
              const source = sourcesMap.get(num);
              if (source) {
                return <CitationSuperscript source={source} n={num} />;
              }
            }
            return (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-4 hover:opacity-80 transition-opacity"
                {...props}
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
            if (!children) return null;
            return (
              <blockquote className="border-l-2 border-[var(--secondary)] pl-4 italic my-3 text-[var(--secondary)]">
                {children}
              </blockquote>
            );
          },
        }}
      >
        {animatedText}
      </ReactMarkdown>
    </div>
  );
}

interface ChatInterfaceProps {
  initialId?: string;
  initialTitle?: string;
  initialMessages?: UIMessage[];
  isNewChat?: boolean;
  isGuest?: boolean;
}

export function ChatInterface({
  initialId,
  initialTitle,
  initialMessages = [],
  isNewChat = false,
  isGuest = false,
}: ChatInterfaceProps) {
  const router = useRouter();

  // Stable conversation ID
  const [conversationId] = useState(() => initialId || crypto.randomUUID());
  const [input, setInput] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Default sidebar open only on desktop screens
  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth >= 768) {
      setSidebarOpen(true);
    }
  }, []);

  const [currentUser, setCurrentUser] = useState<{
    id: string;
    email: string;
    name: string;
    avatarUrl?: string | null;
    profession?: string;
    primaryGoals?: string[];
    customInstructions?: string;
    onboardingCompleted?: boolean;
  } | null>(null);
  const [onboardingOpen, setOnboardingOpen] = useState(false);

  // Fetch current user and detect if onboarding is required
  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.user) {
          setCurrentUser(data.user);
          if (data.user.onboardingCompleted === false) {
            setOnboardingOpen(true);
          }
        }
      })
      .catch(() => {});
  }, []);

  // Listen for user updates across components
  useEffect(() => {
    const handleUserUpdate = (e: Event) => {
      const customEvent = e as CustomEvent<Record<string, unknown>>;
      if (customEvent.detail) {
        setCurrentUser((prev) =>
          prev
            ? { ...prev, ...customEvent.detail }
            : (customEvent.detail as unknown as {
                id: string;
                email: string;
                name: string;
                avatarUrl?: string | null;
              })
        );
      }
    };
    window.addEventListener('astor:user-updated', handleUserUpdate);
    return () => window.removeEventListener('astor:user-updated', handleUserUpdate);
  }, []);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [userScrolledUp, setUserScrolledUp] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // Optimistic conversation for immediate sidebar display
  const [optimisticConv, setOptimisticConv] = useState<ConversationItem | null>(null);
  const [conversationTitle, setConversationTitle] = useState<string>(() => initialTitle || 'New chat');

  // Thumbs feedback state
  const [thumbsState, setThumbsState] = useState<Record<string, 'up' | 'down' | null>>({});

  // Plus menu popover state
  const [plusMenuOpen, setPlusMenuOpen] = useState(false);
  const [webSearchEnabled, setWebSearchEnabled] = useState(true);
  const [memoryEnabled, setMemoryEnabled] = useState(true);

  // Attachment state
  const [attachments, setAttachments] = useState<
    Array<{ id: string; name: string; type: string; url: string; size: number }>
  >([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);

  const processFiles = useCallback((files: File[]) => {
    files.forEach((file) => {
      if (file.size > 10 * 1024 * 1024) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        if (!dataUrl) return;
        setAttachments((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            name: file.name,
            type: file.type || 'application/octet-stream',
            url: dataUrl,
            size: file.size,
          },
        ]);
      };
      reader.readAsDataURL(file);
    });
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    processFiles(Array.from(files));
    e.target.value = '';
  };

  const removeAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    const files: File[] = [];
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        const file = items[i].getAsFile();
        if (file) files.push(file);
      }
    }
    if (files.length > 0) {
      e.preventDefault();
      processFiles(files);
    }
  };

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

  // Fetch initial title if existing conversation and initialTitle wasn't provided
  useEffect(() => {
    if (initialTitle) {
      setConversationTitle(initialTitle);
      return;
    }
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
  }, [initialId, initialTitle]);

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
    if ((!textToSend && attachments.length === 0) || isStreaming) return;

    const currentAttachments = [...attachments];
    setInput('');
    setAttachments([]);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    // Generate optimistic title if first message
    if (!hasMessages) {
      const clean = (textToSend || currentAttachments[0]?.name || 'New conversation')
        .replace(/\s+/g, ' ')
        .trim();
      const generatedTitle = clean.length <= 60 ? clean : clean.slice(0, 60).trim();
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
      if (currentAttachments.length > 0) {
        const parts: UIMessage['parts'] = [
          { type: 'text', text: textToSend || 'Please analyze this attachment.' },
          ...currentAttachments.map((a) =>
            a.type.startsWith('image/')
              ? ({ type: 'image', image: a.url } as unknown as UIMessage['parts'][number])
              : ({
                  type: 'file',
                  mediaType: a.type,
                  url: a.url,
                  name: a.name,
                } as unknown as UIMessage['parts'][number])
          ),
        ];
        await sendMessage({ parts });
      } else {
        await sendMessage({ text: textToSend });
      }
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
    <div className="flex h-[100dvh] w-full overflow-hidden bg-[var(--bg)] text-[var(--text)]">
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
                    className="flex items-center gap-1.5 text-[14px] font-medium text-[var(--text)] hover:bg-[var(--hover)] px-2 py-1 rounded-lg transition-colors truncate max-w-[160px] xs:max-w-[220px] sm:max-w-[320px] md:max-w-[420px]"
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
              {isGuest && (
                <div className="flex items-center gap-2 mr-1">
                  <Link
                    href="/"
                    className="text-xs text-[var(--secondary)] hover:text-[var(--text)] px-2 py-1 rounded-md hover:bg-[var(--hover)] transition-colors"
                  >
                    Overview
                  </Link>
                  <Link
                    href="/login"
                    className="text-xs font-medium text-[var(--text)] border border-[var(--border)] px-2.5 py-1 rounded-lg hover:bg-[var(--hover)] transition-colors"
                  >
                    Sign in
                  </Link>
                </div>
              )}
              <button
                type="button"
                onClick={() => router.push(isGuest ? '/?guest=1' : '/')}
                title="New chat"
                aria-label="New chat"
                className="p-1.5 rounded-lg text-[var(--secondary)] hover:text-[var(--text)] hover:bg-[var(--hover)] transition-colors"
              >
                <Plus size={18} />
              </button>
              {currentUser && (
                <UserAvatar avatarUrl={currentUser.avatarUrl} name={currentUser.name} size={26} />
              )}
            </div>
          </div>
        ) : (
          <>
            {/* Floating toggle on Home when sidebar collapsed */}
            {!sidebarOpen && (
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
            )}
            {/* Top-right guest nav pills */}
            {isGuest && (
              <div className="absolute top-3 right-3 z-30 flex items-center gap-2">
                <Link
                  href="/"
                  className="text-xs text-[var(--secondary)] hover:text-[var(--text)] px-2.5 py-1 rounded-md hover:bg-[var(--hover)] transition-colors"
                >
                  Overview
                </Link>
                <Link
                  href="/login"
                  className="text-xs font-medium text-[var(--text)] border border-[var(--border)] bg-[var(--bg)] px-2.5 py-1 rounded-lg hover:bg-[var(--hover)] transition-colors shadow-2xs"
                >
                  Sign in
                </Link>
              </div>
            )}
            {!isGuest && currentUser && (
              <div className="absolute top-3.5 right-4 z-30 flex items-center gap-2">
                <UserAvatar avatarUrl={currentUser.avatarUrl} name={currentUser.name} size={28} />
              </div>
            )}
          </>
        )}

        {/* Content Area */}
        {!hasMessages ? (
          /* ==================== HOME / NEW CHAT VIEW ==================== */
          <div className="flex-1 flex flex-col items-center justify-center p-4 max-w-[660px] w-full mx-auto my-auto space-y-5 sm:space-y-7 md:-mt-10">
            {/* Centered Logo & Greeting */}
            <div className="flex flex-col items-center text-center space-y-3.5">
              <div className="text-[var(--text)]">
                <AstorMark size={28} />
              </div>
              <h1 className="font-serif text-3xl md:text-[36px] font-normal tracking-tight text-[var(--text)] select-none">
                {greeting}
              </h1>
            </div>

            {/* Big Composer Card with Moving Gradient Border */}
            <div className="w-full relative">
              <div className="composer-gradient-box w-full">
                <div className="composer-gradient-inner min-h-[105px] p-3.5 flex flex-col justify-between">
                  {/* Hidden File / Image / Audio Inputs */}
                  <input
                    type="file"
                    ref={fileInputRef}
                    multiple
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  <input
                    type="file"
                    ref={imageInputRef}
                    accept="image/*"
                    multiple
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  <input
                    type="file"
                    ref={audioInputRef}
                    accept="audio/*"
                    multiple
                    onChange={handleFileSelect}
                    className="hidden"
                  />

                  {/* Attachments preview row */}
                  {attachments.length > 0 && (
                    <div className="flex flex-wrap gap-2 pb-2 border-b border-[var(--border)]/40 mb-1">
                      {attachments.map((att) => (
                        <div
                          key={att.id}
                          className="relative flex items-center gap-2 p-1.5 pr-2.5 rounded-xl border border-[var(--border)] bg-[var(--hover)]/40 text-xs text-[var(--text)]"
                        >
                          {att.type.startsWith('image/') ? (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img
                              src={att.url}
                              alt={att.name}
                              className="w-8 h-8 rounded-lg object-cover border border-[var(--border)] shrink-0"
                            />
                          ) : att.type.startsWith('audio/') ? (
                            <div className="w-8 h-8 rounded-lg bg-[var(--hover)] flex items-center justify-center shrink-0">
                              <Volume2 size={16} className="text-[var(--secondary)]" />
                            </div>
                          ) : (
                            <div className="w-8 h-8 rounded-lg bg-[var(--hover)] flex items-center justify-center shrink-0">
                              <FileText size={16} className="text-[var(--secondary)]" />
                            </div>
                          )}
                          <div className="flex flex-col min-w-0 pr-1">
                            <span className="truncate text-[12px] font-medium max-w-[130px]">
                              {att.name}
                            </span>
                            <span className="text-[10px] text-[var(--secondary)] font-mono">
                              {formatFileSize(att.size)}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeAttachment(att.id)}
                            className="p-1 rounded-full hover:bg-[var(--border)] text-[var(--secondary)] hover:text-[var(--text)] transition-colors"
                            aria-label="Remove attachment"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <textarea
                    ref={textareaRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onPaste={handlePaste}
                    placeholder="How can I help you today?"
                    rows={2}
                    aria-label="Message Astor"
                    className="w-full resize-none bg-transparent text-[15px] font-sans text-[var(--text)] placeholder-[var(--secondary)] focus:outline-none leading-relaxed p-0.5"
                  />

                  {/* Bottom row inside composer */}
                  <div className="flex items-center justify-between pt-2">
                    {/* Left: Plus button with unified popover */}
                    <div ref={plusMenuRef} className="relative">
                      <button
                        type="button"
                        onClick={() => setPlusMenuOpen((v) => !v)}
                        aria-label="Add content or tools"
                        title="Add content or tools"
                        className="w-7 h-7 rounded-full flex items-center justify-center text-[var(--secondary)] hover:text-[var(--text)] hover:bg-[var(--hover)] transition-colors"
                      >
                        <Plus size={18} />
                      </button>

                      {/* Plus Menu Popover */}
                      {plusMenuOpen && (
                        <div className="absolute left-0 bottom-[calc(100%+8px)] w-56 rounded-[14px] border border-[var(--border)] bg-[var(--popover-bg)] shadow-xl p-1.5 text-xs animate-popover z-50 space-y-0.5">
                          {/* Upload Files & Docs */}
                          <button
                            type="button"
                            onClick={() => {
                              setPlusMenuOpen(false);
                              fileInputRef.current?.click();
                            }}
                            className="flex items-center gap-2.5 w-full px-2.5 py-2 rounded-lg text-left text-[var(--text)] hover:bg-[var(--hover)] transition-colors"
                          >
                            <FileText size={15} className="text-[var(--secondary)]" />
                            <span>Upload files & documents</span>
                          </button>

                          {/* Upload Photos & Images */}
                          <button
                            type="button"
                            onClick={() => {
                              setPlusMenuOpen(false);
                              imageInputRef.current?.click();
                            }}
                            className="flex items-center gap-2.5 w-full px-2.5 py-2 rounded-lg text-left text-[var(--text)] hover:bg-[var(--hover)] transition-colors"
                          >
                            <ImageIcon size={15} className="text-[var(--secondary)]" />
                            <span>Upload photos & images</span>
                          </button>

                          {/* Upload Audio & Media */}
                          <button
                            type="button"
                            onClick={() => {
                              setPlusMenuOpen(false);
                              audioInputRef.current?.click();
                            }}
                            className="flex items-center gap-2.5 w-full px-2.5 py-2 rounded-lg text-left text-[var(--text)] hover:bg-[var(--hover)] transition-colors"
                          >
                            <Volume2 size={15} className="text-[var(--secondary)]" />
                            <span>Upload audio & media</span>
                          </button>

                          <div className="h-px bg-[var(--border)] my-1" />

                          {/* Web search toggle */}
                          <button
                            type="button"
                            onClick={() => setWebSearchEnabled((v) => !v)}
                            className="flex items-center justify-between w-full px-2.5 py-2 rounded-lg text-left text-[var(--text)] hover:bg-[var(--hover)] transition-colors"
                          >
                            <div className="flex items-center gap-2.5">
                              <Globe size={15} className="text-[var(--secondary)]" />
                              <span>Web search</span>
                            </div>
                            {webSearchEnabled && <Check size={14} className="text-[var(--text)]" />}
                          </button>

                          {/* Memory toggle */}
                          <button
                            type="button"
                            onClick={() => setMemoryEnabled((v) => !v)}
                            className="flex items-center justify-between w-full px-2.5 py-2 rounded-lg text-left text-[var(--text)] hover:bg-[var(--hover)] transition-colors"
                          >
                            <div className="flex items-center gap-2.5">
                              <Brain size={15} className="text-[var(--secondary)]" />
                              <span>Memory</span>
                            </div>
                            {memoryEnabled && <Check size={14} className="text-[var(--text)]" />}
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
                        disabled={(!input.trim() && attachments.length === 0) || isStreaming}
                        aria-label="Send message"
                        className="w-8 h-8 rounded-full bg-[var(--text)] text-[var(--bg)] flex items-center justify-center transition-all disabled:opacity-30 disabled:cursor-not-allowed hover:opacity-90 active:scale-95"
                      >
                        <ArrowUp size={16} />
                      </button>
                    </div>
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

            {/* Disclaimer */}
            <p className="text-center text-[11px] text-[var(--secondary)] select-none pt-1">
              Astor can make mistakes. Please double-check responses.
            </p>
          </div>
        ) : (
          /* ==================== ACTIVE CONVERSATION VIEW ==================== */
          <div
            ref={scrollContainerRef}
            onScroll={handleScroll}
            className="flex-1 overflow-y-auto px-3 sm:px-4 md:px-6 py-4 sm:py-8"
          >
            <div className="max-w-[770px] mx-auto space-y-7 pb-36 sm:pb-40">
              {messages.map((message, idx) => {
                const isUser = message.role === 'user';
                const isLast = idx === messages.length - 1;
                const text = getMessageText(message);

                if (isUser) {
                  const msgCreatedAt = (message as unknown as { createdAt?: Date | string })?.createdAt;
                  const userDateFormatted = msgCreatedAt
                    ? formatISTDateTime(msgCreatedAt)
                    : (message as unknown as { metadata?: { local_date?: string } })?.metadata?.local_date
                      ? formatISTDate((message as unknown as { metadata: { local_date: string } }).metadata.local_date)
                      : null;

                  // Extract any attached images or files from parts
                  const parts = (message.parts || []) as Array<Record<string, unknown>>;
                  const attachedImages = parts.filter(
                    (p) => p.type === 'image' && (p.image || p.url)
                  );
                  const attachedFiles = parts.filter(
                    (p) => p.type === 'file' && (p.url || p.name)
                  );

                  return (
                    <div key={message.id} className="flex flex-col items-end group/user space-y-2">
                      {/* Attached images preview */}
                      {attachedImages.length > 0 && (
                        <div className="flex flex-wrap justify-end gap-2 max-w-[75%]">
                          {attachedImages.map((img, i) => (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img
                              key={i}
                              src={(img.image || img.url) as string}
                              alt="Attachment"
                              className="max-h-60 max-w-[280px] rounded-xl object-cover border border-[var(--border)] shadow-xs"
                            />
                          ))}
                        </div>
                      )}

                      {/* Attached files chips */}
                      {attachedFiles.length > 0 && (
                        <div className="flex flex-wrap justify-end gap-1.5 max-w-[88%] sm:max-w-[75%]">
                          {attachedFiles.map((file, i) => (
                            <div
                              key={i}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--user-bubble)] border border-[var(--border)] text-xs text-[var(--text)] font-sans"
                            >
                              <FileText size={13} className="text-[var(--secondary)]" />
                              <span className="truncate max-w-[160px] font-medium">
                                {(file.name as string) || 'Document'}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Text Bubble */}
                      {text && (
                        <div
                          className="max-w-[88%] sm:max-w-[75%] rounded-[14px] px-4 py-2.5 bg-[var(--user-bubble)] text-[var(--text)] text-[15px] font-sans leading-relaxed shadow-2xs whitespace-pre-wrap selection:bg-[var(--hover)] cursor-default transition-all"
                          title={userDateFormatted ? `Sent on ${userDateFormatted}` : undefined}
                        >
                          {text}
                        </div>
                      )}

                      {userDateFormatted && (
                        <span className="text-[10px] text-[var(--secondary)] font-mono opacity-0 group-hover/user:opacity-80 transition-opacity pr-1 select-none pointer-events-none">
                          {userDateFormatted}
                        </span>
                      )}
                    </div>
                  );
                }

                // Assistant Message (no bubble, serif, no avatar)
                const currentThumbs = thumbsState[message.id];
                const { isSearching, queries, sources } = getWebSearchState(message);
                const recalledTurns = getRecalledTurns(message);
                const sourcesMap = new Map(sources.map((s) => [s.n, s]));
                const processedText = linkifyCitations(text, sourcesMap);

                return (
                  <div key={message.id} className="group/msg w-full space-y-2 pt-1">
                    {/* Small Searching Status Indicator */}
                    {isSearching && (
                      <div className="flex items-center gap-2 text-xs text-[var(--secondary)] py-1 font-sans select-none">
                        <Globe size={13} className="text-[var(--secondary)] animate-spin shrink-0" />
                        <span>
                          Searching the web{queries.length > 0 ? `: ${queries.map((q) => `"${q}"`).join(', ')}` : '...'}
                        </span>
                      </div>
                    )}

                    {/* From your history Card above answer */}
                    {recalledTurns.length > 0 && (
                      <div className="rounded-xl border border-[var(--border)] bg-[var(--hover)]/30 p-3 mb-3 text-xs font-sans text-[var(--text)] animate-popover">
                        <div className="flex items-center gap-1.5 font-medium text-[var(--secondary)] mb-2 uppercase tracking-wider text-[11px] select-none">
                          <Clock size={12} />
                          <span>From your history ({recalledTurns.length})</span>
                        </div>
                        <div className="space-y-2">
                          {recalledTurns.map((turn, tIdx) => (
                            <div
                              key={turn.id || tIdx}
                              className="flex items-start justify-between gap-3 pt-2 border-t border-[var(--border)]/40 first:border-t-0 first:pt-0"
                            >
                              <div className="min-w-0 space-y-0.5">
                                <div className="text-[11px] font-mono text-[var(--secondary)]">
                                  {turn.dateFormatted}
                                </div>
                                <div className="text-[13px] text-[var(--text)] font-sans line-clamp-2">
                                  {turn.question}
                                </div>
                              </div>
                              {turn.conversationId && (
                                <a
                                  href={`/c/${turn.conversationId}`}
                                  className="shrink-0 flex items-center gap-1 text-[11px] font-mono text-[var(--secondary)] hover:text-[var(--text)] transition-colors px-2 py-0.5 rounded border border-[var(--border)] bg-[var(--bg)] hover:bg-[var(--hover)]"
                                  title={`Open "${turn.conversationTitle || 'conversation'}"`}
                                >
                                  <span>View</span>
                                  <ExternalLink size={10} />
                                </a>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Message Body with word-by-word typewriter animation */}
                    <AssistantMessageBody
                      text={processedText}
                      isStreaming={isStreaming && isLast}
                      sourcesMap={sourcesMap}
                    />

                    {/* Source Chips Under Answer (only after response completes) */}
                    {sources.length > 0 && !(isStreaming && isLast) && (
                      <div className="pt-3 pb-1 border-t border-[var(--border)]/40 mt-3 animate-popover">
                        <div className="text-[11px] font-medium text-[var(--secondary)] mb-2 uppercase tracking-wider font-sans select-none flex items-center gap-1.5">
                          <Globe size={12} />
                          <span>Sources ({sources.length})</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {sources.map((s) => (
                            <a
                              key={s.n}
                              href={s.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1.5 max-w-[240px] px-2.5 py-1 rounded-lg border border-[var(--border)] bg-[var(--hover)]/30 hover:bg-[var(--hover)] text-xs text-[var(--text)] transition-colors group/chip"
                              title={`${s.title} — ${s.domain}`}
                            >
                              <span className="text-[10px] font-mono text-[var(--secondary)] font-semibold shrink-0">
                                [{s.n}]
                              </span>
                              {s.favicon ? (
                                /* eslint-disable-next-line @next/next/no-img-element */
                                <img
                                  src={s.favicon}
                                  alt=""
                                  className="w-3.5 h-3.5 rounded-xs shrink-0"
                                  onError={(e) => {
                                    (e.target as HTMLElement).style.display = 'none';
                                  }}
                                />
                              ) : (
                                <Globe size={11} className="text-[var(--secondary)] shrink-0" />
                              )}
                              <span className="truncate font-sans font-medium text-[12px]">
                                {s.title || s.domain}
                              </span>
                              {s.published_date && (
                                <span className="text-[10px] text-[var(--secondary)] opacity-75 shrink-0 font-mono hidden sm:inline">
                                  {formatDisplayDate(s.published_date)}
                                </span>
                              )}
                            </a>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Action Bar Under Assistant Reply: Copy, Thumbs up, Thumbs down, Retry, relative time */}
                    {text.trim().length > 0 && !isStreaming && !error && (
                      <div
                        className="flex items-center gap-2 pt-1 text-xs text-[var(--secondary)] font-sans opacity-0 group-hover/msg:opacity-100 transition-opacity duration-150"
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
                  )}
                </div>
                );
              })}

              {/* Thinking / Searching animation when waiting for or generating response */}
              {(status === 'submitted' || status === 'streaming') && !error && messages.length > 0 && (() => {
                const lastMsg = messages[messages.length - 1];
                const lastMsgText = getMessageText(lastMsg);
                if (lastMsg.role === 'assistant' && lastMsgText && status !== 'submitted') {
                  return null;
                }
                const { isSearching, queries } = getWebSearchState(lastMsg);
                return (
                  <div className="flex items-center gap-2.5 py-3 animate-popover">
                    <div className="text-[var(--text)]">
                      <AstorMark size={16} />
                    </div>
                    <div className="flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-[var(--hover)]">
                      <span className="w-1.5 h-1.5 rounded-full bg-[var(--text)] animate-typing-dot-1" />
                      <span className="w-1.5 h-1.5 rounded-full bg-[var(--text)] animate-typing-dot-2" />
                      <span className="w-1.5 h-1.5 rounded-full bg-[var(--text)] animate-typing-dot-3" />
                    </div>
                    <span className="text-xs text-[var(--secondary)] font-sans">
                      {isSearching
                        ? `Searching the web${queries.length > 0 ? `: ${queries.map((q) => `"${q}"`).join(', ')}` : '...'}`
                        : 'Thinking...'}
                    </span>
                  </div>
                );
              })()}

              {/* One tidy inline error card in chat only */}
              {error && (
                <div className="flex items-start justify-between gap-3 p-3.5 rounded-xl border border-[var(--border)] bg-[var(--user-bubble)] text-xs text-[var(--text)] shadow-xs animate-popover">
                  <div className="flex items-start gap-3 min-w-0">
                    <AlertCircle size={16} className="text-[var(--secondary)] shrink-0 mt-0.5" />
                    <div className="space-y-1 font-sans">
                      <p className="font-medium">Error communicating with Astor</p>
                      <p className="text-[var(--secondary)] leading-relaxed">
                        {error.message || 'An error occurred during response generation. Check META_API_KEY in .env.'}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => regenerate()}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-[var(--border)] bg-[var(--popover-bg)] hover:bg-[var(--hover)] text-xs font-medium text-[var(--text)] shrink-0 transition-colors"
                  >
                    <RotateCw size={13} />
                    <span>Retry</span>
                  </button>
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
          <div className="absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-[var(--bg)] via-[var(--bg)] to-transparent pt-4 sm:pt-6 pb-[max(0.75rem,env(safe-area-inset-bottom))] px-3 sm:px-4">
            <div className="max-w-[770px] mx-auto w-full">
              <div className="composer-gradient-box w-full">
                <div className="composer-gradient-inner p-2.5 flex flex-col justify-between">
                  {/* File Attachment Previews */}
                  {attachments.length > 0 && (
                    <div className="flex flex-wrap gap-2 px-2 pt-1 pb-2">
                      {attachments.map((att) => (
                        <div
                          key={att.id}
                          className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-[var(--hover)] border border-[var(--border)] text-xs text-[var(--text)] group"
                        >
                          {att.type.startsWith('image/') ? (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img
                              src={att.url}
                              alt={att.name}
                              className="w-5 h-5 rounded object-cover"
                            />
                          ) : att.type.startsWith('audio/') ? (
                            <Volume2 size={14} className="text-[var(--secondary)]" />
                          ) : (
                            <FileText size={14} className="text-[var(--secondary)]" />
                          )}
                          <span className="truncate max-w-[120px]" title={att.name}>
                            {att.name}
                          </span>
                          <span className="text-[10px] text-[var(--secondary)]">
                            {formatFileSize(att.size)}
                          </span>
                          <button
                            type="button"
                            onClick={() => removeAttachment(att.id)}
                            aria-label={`Remove ${att.name}`}
                            className="text-[var(--secondary)] hover:text-[var(--text)] p-0.5 transition-colors"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <textarea
                    ref={textareaRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onPaste={handlePaste}
                    placeholder="Reply to Astor..."
                    rows={1}
                    aria-label="Message Astor"
                    className="w-full resize-none bg-transparent text-[15px] font-sans text-[var(--text)] placeholder-[var(--secondary)] focus:outline-none leading-relaxed p-1 max-h-[200px]"
                  />

                  {/* Bottom row inside chat composer */}
                  <div className="flex items-center justify-between pt-1">
                    {/* Left: Plus button with unified popover */}
                    <div ref={plusMenuRef} className="relative">
                      <button
                        type="button"
                        onClick={() => setPlusMenuOpen((v) => !v)}
                        aria-label="Add content or tools"
                        title="Add content or tools"
                        className="w-7 h-7 rounded-full flex items-center justify-center text-[var(--secondary)] hover:text-[var(--text)] hover:bg-[var(--hover)] transition-colors"
                      >
                        <Plus size={18} />
                      </button>

                      {/* Plus Menu Popover */}
                      {plusMenuOpen && (
                        <div className="absolute left-0 bottom-[calc(100%+8px)] w-56 rounded-[14px] border border-[var(--border)] bg-[var(--popover-bg)] shadow-xl p-1.5 text-xs animate-popover z-50 space-y-0.5">
                          {/* Upload Files & Docs */}
                          <button
                            type="button"
                            onClick={() => {
                              setPlusMenuOpen(false);
                              fileInputRef.current?.click();
                            }}
                            className="flex items-center gap-2.5 w-full px-2.5 py-2 rounded-lg text-left text-[var(--text)] hover:bg-[var(--hover)] transition-colors"
                          >
                            <FileText size={15} className="text-[var(--secondary)]" />
                            <span>Upload files & documents</span>
                          </button>

                          {/* Upload Photos & Images */}
                          <button
                            type="button"
                            onClick={() => {
                              setPlusMenuOpen(false);
                              imageInputRef.current?.click();
                            }}
                            className="flex items-center gap-2.5 w-full px-2.5 py-2 rounded-lg text-left text-[var(--text)] hover:bg-[var(--hover)] transition-colors"
                          >
                            <ImageIcon size={15} className="text-[var(--secondary)]" />
                            <span>Upload photos & images</span>
                          </button>

                          {/* Upload Audio & Media */}
                          <button
                            type="button"
                            onClick={() => {
                              setPlusMenuOpen(false);
                              audioInputRef.current?.click();
                            }}
                            className="flex items-center gap-2.5 w-full px-2.5 py-2 rounded-lg text-left text-[var(--text)] hover:bg-[var(--hover)] transition-colors"
                          >
                            <Volume2 size={15} className="text-[var(--secondary)]" />
                            <span>Upload audio & media</span>
                          </button>

                          <div className="h-px bg-[var(--border)] my-1" />

                          {/* Web search toggle */}
                          <button
                            type="button"
                            onClick={() => setWebSearchEnabled((v) => !v)}
                            className="flex items-center justify-between w-full px-2.5 py-2 rounded-lg text-left text-[var(--text)] hover:bg-[var(--hover)] transition-colors"
                          >
                            <div className="flex items-center gap-2.5">
                              <Globe size={15} className="text-[var(--secondary)]" />
                              <span>Web search</span>
                            </div>
                            {webSearchEnabled && <Check size={14} className="text-[var(--text)]" />}
                          </button>

                          {/* Memory toggle */}
                          <button
                            type="button"
                            onClick={() => setMemoryEnabled((v) => !v)}
                            className="flex items-center justify-between w-full px-2.5 py-2 rounded-lg text-left text-[var(--text)] hover:bg-[var(--hover)] transition-colors"
                          >
                            <div className="flex items-center gap-2.5">
                              <Brain size={15} className="text-[var(--secondary)]" />
                              <span>Memory</span>
                            </div>
                            {memoryEnabled && <Check size={14} className="text-[var(--text)]" />}
                          </button>
                        </div>
                      )}
                    </div>

                  {/* Right: Model label & Send arrow or stop square */}
                  <div className="flex items-center gap-3">
                    <span className="text-[12px] text-[var(--secondary)] select-none">
                      Muse Spark
                    </span>
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
                        disabled={!input.trim() && attachments.length === 0}
                        aria-label="Send message"
                        className="w-8 h-8 rounded-full bg-[var(--text)] text-[var(--bg)] flex items-center justify-center transition-all disabled:opacity-30 disabled:cursor-not-allowed hover:opacity-90 active:scale-95"
                      >
                        <ArrowUp size={16} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

              {/* Disclaimer */}
              <p className="text-center text-[11px] text-[var(--secondary)] mt-2 select-none">
                Astor can make mistakes. Please double-check responses.
              </p>
            </div>
          </div>
        )}
      </main>

      {/* First-time Onboarding Modal */}
      {currentUser && (
        <OnboardingModal
          isOpen={onboardingOpen}
          currentUser={currentUser}
          onComplete={(updated) => {
            setCurrentUser((prev) => (prev ? { ...prev, ...updated } : (updated as never)));
            setOnboardingOpen(false);
          }}
        />
      )}
    </div>
  );
}
