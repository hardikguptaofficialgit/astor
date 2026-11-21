'use client';

import React, { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { MermaidDiagram } from './mermaid-diagram';

interface CodeBlockProps {
  language: string;
  code: string;
}

export function CodeBlock({ language, code }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const normLang = (language || '').toLowerCase().trim();
  const trimmedCode = code.trim();

  // If the language is mermaid/diagram, or code starts with a diagram declaration, render visually
  const isDiagram =
    normLang === 'mermaid' ||
    normLang === 'diagram' ||
    normLang === 'flowchart' ||
    /^(?:graph\s+[A-Z]{2}|flowchart\s+[A-Z]{2}|sequenceDiagram|classDiagram|stateDiagram(?:-v2)?|erDiagram|gantt|pie|gitGraph)\b/m.test(
      trimmedCode
    );

  if (isDiagram) {
    return <MermaidDiagram code={trimmedCode} />;
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  return (
    <div className="my-4 rounded-xl border border-[var(--border)] overflow-hidden bg-[var(--code-bg)] text-[var(--code-text)] text-sm font-mono shadow-xs">
      <div className="flex items-center justify-between px-3.5 py-1.5 border-b border-[var(--border-subtle)] bg-[var(--code-header)] text-xs text-[var(--muted)]">
        <span className="font-sans lowercase font-medium">{language || 'text'}</span>
        <button
          onClick={handleCopy}
          type="button"
          aria-label={copied ? 'Code copied' : 'Copy code to clipboard'}
          className="flex items-center gap-1.5 py-1 px-2 rounded-md hover:bg-[var(--surface-hover)] hover:text-[var(--text)] transition-colors active:scale-95"
        >
          {copied ? (
            <>
              <Check size={13} className="text-[var(--text)]" />
              <span className="text-[11px] font-sans">Copied</span>
            </>
          ) : (
            <>
              <Copy size={13} />
              <span className="text-[11px] font-sans">Copy</span>
            </>
          )}
        </button>
      </div>
      <div className="p-4 overflow-x-auto text-[13px] leading-relaxed">
        <pre className="m-0 font-mono">
          <code>{code}</code>
        </pre>
      </div>
    </div>
  );
}
