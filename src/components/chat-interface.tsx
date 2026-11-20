'use client';

import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
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
  ChevronDown,
  AlertCircle,
  Menu,
} from 'lucide-react';
import { AstorIcon } from './astor-icon';
import { CodeBlock } from './code-block';
import { Sidebar } from './sidebar';

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
  // Stable conversation ID
  const [conversationId] = useState(() => initialId || crypto.randomUUID());
  const [input, setInput] = useState('');
  const [hasApiKey, setHasApiKey] = useState<boolean | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [userScrolledUp, setUserScrolledUp] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Check if API key is configured
  useEffect(() => {
    fetch('/api/config')
      .then((res) => res.json())
      .then((data) => {
        setHasApiKey(data.hasApiKey);
      })
      .catch(() => {
        setHasApiKey(true);
      });
  }, []);

  // Transport configuration
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: '/api/chat',
        body: { id: conversationId },
      }),
    [conversationId]
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
    if (hour >= 5 && hour < 12) return 'Good morning';
    if (hour >= 12 && hour < 17) return 'Good afternoon';
    if (hour >= 17 && hour < 22) return 'Good evening';
    return 'Good night';
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

  // Scroll to bottom when new streaming tokens arrive unless user scrolled up
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

  // Send message
  const handleSend = async (overridePrompt?: string) => {
    const textToSend = (overridePrompt ?? input).trim();
    if (!textToSend || isStreaming) return;

    setInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    if (isNewChat && window.location.pathname === '/') {
      window.history.replaceState(null, '', `/c/${conversationId}`);
    }

    try {
      await sendMessage({ text: textToSend });
      setRefreshKey((k) => k + 1);
    } catch {
      // Handled via useChat error
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

  const suggestionChips = [
    "What's new in AI this week?",
    "Compare Postgres hosting prices",
    "Summarise today's tech news",
    "What did I ask you yesterday?",
  ];

  const hasMessages = messages.length > 0;

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[var(--bg)] text-[var(--text)]">
      {/* Sidebar */}
      <Sidebar
        currentId={hasMessages ? conversationId : undefined}
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen((v) => !v)}
        refreshKey={refreshKey}
      />

      {/* Main Chat Area */}
      <main className="flex-1 flex flex-col h-full relative overflow-hidden">
        {/* Mobile Header Bar */}
        <div className="md:hidden flex items-center justify-between p-3 border-b border-[var(--border-subtle)] bg-[var(--bg)]">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open sidebar"
            className="p-1.5 rounded-md text-[var(--muted)] hover:text-[var(--text)] transition-colors"
          >
            <Menu size={20} />
          </button>
          <div className="flex items-center gap-2">
            <AstorIcon size={16} />
            <span className="font-serif font-semibold text-sm">Astor</span>
          </div>
          <div className="w-8" />
        </div>

        {/* Missing API Key Inline Alert */}
        {hasApiKey === false && (
          <div className="mx-auto mt-4 max-w-[720px] w-full px-4">
            <div className="flex items-start gap-3 p-3.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-xs text-[var(--text)] shadow-xs">
              <AlertCircle size={16} className="text-[var(--muted)] shrink-0 mt-0.5" />
              <div className="flex-1 space-y-1">
                <p className="font-medium">META_API_KEY is not configured</p>
                <p className="text-[var(--muted)] leading-relaxed">
                  To enable streaming chat replies, copy <code className="px-1 py-0.5 rounded bg-[var(--surface-active)] font-mono">.env.example</code> to <code className="px-1 py-0.5 rounded bg-[var(--surface-active)] font-mono">.env</code> and set your <code className="px-1 py-0.5 rounded bg-[var(--surface-active)] font-mono">META_API_KEY</code>.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Content Area */}
        {!hasMessages ? (
          /* Empty State (New Chat) */
          <div className="flex-1 flex flex-col items-center justify-center p-4 max-w-[720px] w-full mx-auto my-auto space-y-8">
            {/* Centered Greeting & Mark */}
            <div className="flex flex-col items-center text-center space-y-3">
              <div className="w-10 h-10 rounded-2xl bg-[var(--text)] text-[var(--bg)] flex items-center justify-center shadow-xs">
                <AstorIcon size={22} />
              </div>
              <h1 className="font-serif text-3xl md:text-4xl font-normal tracking-tight text-[var(--text)]">
                {greeting}
              </h1>
            </div>

            {/* Centered Composer Card */}
            <div className="w-full">
              <div className="relative rounded-[20px] border border-[var(--border)] bg-[var(--card-bg)] shadow-md transition-all focus-within:border-[var(--text)] focus-within:ring-1 focus-within:ring-[var(--text)]/20 p-3">
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="How can Astor help you today?"
                  rows={2}
                  aria-label="Message Astor"
                  className="w-full resize-none bg-transparent text-[15px] text-[var(--text)] placeholder-[var(--muted)] focus:outline-none leading-relaxed p-1"
                />

                <div className="flex items-center justify-between pt-2 border-t border-[var(--border-subtle)]/60">
                  <div className="text-[11px] text-[var(--muted)] font-sans">
                    Astor muse-spark-1.3
                  </div>

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
              <p className="text-center text-[11px] text-[var(--muted)] mt-2">
                Astor may make mistakes. Verify important information.
              </p>
            </div>

            {/* 4 Suggestion Chips */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full pt-2">
              {suggestionChips.map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => handleSend(chip)}
                  className="flex items-center text-left p-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[13px] text-[var(--text)] font-sans hover:bg-[var(--surface-hover)] active:scale-[0.99] transition-all shadow-2xs"
                >
                  <span className="truncate">{chip}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          /* Active Conversation View */
          <div
            ref={scrollContainerRef}
            onScroll={handleScroll}
            className="flex-1 overflow-y-auto px-4 md:px-6 py-6"
          >
            <div className="max-w-[720px] mx-auto space-y-6 pb-36">
              {messages.map((message) => {
                const isUser = message.role === 'user';
                const text = getMessageText(message);

                if (isUser) {
                  return (
                    <div key={message.id} className="flex justify-end">
                      <div className="max-w-[85%] rounded-2xl px-4 py-2.5 bg-[var(--user-bubble)] border border-[var(--user-bubble-border)] text-[var(--user-bubble-text)] text-[15px] font-sans leading-relaxed shadow-2xs whitespace-pre-wrap">
                        {text}
                      </div>
                    </div>
                  );
                }

                // Assistant Message
                return (
                  <div key={message.id} className="group/msg w-full space-y-2">
                    {/* Message Body (Serif & Markdown) */}
                    <div className="font-serif text-[16px] leading-[1.8] text-[var(--text)] selection:bg-[var(--surface-active)]">
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
                                className="px-1.5 py-0.5 rounded font-mono text-[13px] bg-[var(--surface-active)] text-[var(--text)] border border-[var(--border-subtle)]"
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
                              <thead className="bg-[var(--surface)] border-b border-[var(--border)]">
                                {children}
                              </thead>
                            );
                          },
                          th({ children }) {
                            return (
                              <th className="px-3 py-2 text-xs font-semibold text-[var(--muted)]">
                                {children}
                              </th>
                            );
                          },
                          td({ children }) {
                            return (
                              <td className="px-3 py-2 border-t border-[var(--border)] text-sm">
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
                              <blockquote className="border-l-2 border-[var(--muted)] pl-4 italic my-3 text-[var(--muted)]">
                                {children}
                              </blockquote>
                            );
                          },
                        }}
                      >
                        {text}
                      </ReactMarkdown>
                    </div>

                    {/* Action Bar Under Message */}
                    <div className="flex items-center gap-3 pt-1 text-xs text-[var(--muted)] font-sans">
                      <button
                        type="button"
                        onClick={() => handleCopyMessage(message.id, text)}
                        aria-label="Copy message text"
                        className="flex items-center gap-1 hover:text-[var(--text)] transition-colors active:scale-95"
                      >
                        {copiedMessageId === message.id ? (
                          <>
                            <Check size={13} className="text-[var(--text)]" />
                            <span className="text-[11px]">Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy size={13} />
                            <span className="text-[11px]">Copy</span>
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => regenerate({ messageId: message.id })}
                        aria-label="Regenerate reply"
                        className="flex items-center gap-1 hover:text-[var(--text)] transition-colors active:scale-95"
                      >
                        <RotateCw size={13} />
                        <span className="text-[11px]">Retry</span>
                      </button>

                      <span className="text-[11px] opacity-70">
                        {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                );
              })}

              {/* Waiting for first token shimmer */}
              {status === 'submitted' && (
                <div className="flex items-center gap-2 py-2 text-[var(--muted)]">
                  <div className="animate-pulse-subtle">
                    <AstorIcon size={16} />
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--muted)] animate-bounce" />
                    <span
                      className="w-1.5 h-1.5 rounded-full bg-[var(--muted)] animate-bounce"
                      style={{ animationDelay: '0.15s' }}
                    />
                    <span
                      className="w-1.5 h-1.5 rounded-full bg-[var(--muted)] animate-bounce"
                      style={{ animationDelay: '0.3s' }}
                    />
                  </div>
                </div>
              )}

              {/* Inline Error Message */}
              {error && (
                <div className="flex items-start gap-3 p-3.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-xs text-[var(--text)] shadow-xs">
                  <AlertCircle size={16} className="text-[var(--muted)] shrink-0 mt-0.5" />
                  <div className="flex-1 space-y-1 font-sans">
                    <p className="font-medium">Error communicating with Astor</p>
                    <p className="text-[var(--muted)] leading-relaxed">
                      {error.message || 'An error occurred during generation.'}
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
            className="absolute bottom-28 right-8 z-30 p-2 rounded-full border border-[var(--border)] bg-[var(--card-bg)] text-[var(--text)] shadow-md hover:bg-[var(--surface-hover)] active:scale-95 transition-all"
          >
            <ChevronDown size={18} />
          </button>
        )}

        {/* Pinned Composer at Bottom (in active conversation view) */}
        {hasMessages && (
          <div className="absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-[var(--bg)] via-[var(--bg)] to-transparent pt-6 pb-4 px-4">
            <div className="max-w-[720px] mx-auto w-full">
              <div className="relative rounded-[20px] border border-[var(--border)] bg-[var(--card-bg)] shadow-md transition-all focus-within:border-[var(--text)] focus-within:ring-1 focus-within:ring-[var(--text)]/20 p-3">
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Reply to Astor..."
                  rows={1}
                  aria-label="Message Astor"
                  className="w-full resize-none bg-transparent text-[15px] text-[var(--text)] placeholder-[var(--muted)] focus:outline-none leading-relaxed p-1 max-h-[200px]"
                />

                <div className="flex items-center justify-between pt-2 border-t border-[var(--border-subtle)]/60">
                  <div className="text-[11px] text-[var(--muted)] font-sans">
                    Astor muse-spark-1.3
                  </div>

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

              <p className="text-center text-[11px] text-[var(--muted)] mt-2">
                Astor may make mistakes. Verify important information.
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
