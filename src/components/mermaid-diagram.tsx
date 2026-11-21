'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  Download,
  Copy,
  Check,
  Maximize2,
  Minimize2,
  Code2,
  Eye,
  RotateCcw,
  ZoomIn,
  ZoomOut,
  AlertCircle,
  FileImage,
  Move,
} from 'lucide-react';

interface MermaidDiagramProps {
  code: string;
}

// Global in-memory SVG cache: key -> rendered SVG string
// Prevents re-rendering or flickering when components remount or stream updates
const svgCache = new Map<string, string>();

/**
 * Deterministic hash for cache keys and DOM IDs.
 */
function getCodeHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

/**
 * Sanitizes LLM-generated Mermaid syntax to fix common parser failure modes:
 * - Unquoted parentheses in square bracket nodes: A[Client (Browser)] -> A["Client (Browser)"]
 * - Unquoted colons, curly braces, and special characters in node labels
 * - Accidental markdown fences inside code
 */
function sanitizeMermaid(raw: string): string {
  if (!raw) return '';
  let cleaned = raw.trim();

  // Strip accidental markdown fence blocks
  cleaned = cleaned.replace(/^```(?:mermaid)?\s*/i, '').replace(/\s*```$/, '');

  // Normalize line breaks
  cleaned = cleaned.replace(/\r\n/g, '\n');

  // Fix unquoted parentheses or colons in node brackets: id[text (with info)] -> id["text (with info)"]
  cleaned = cleaned.replace(/(\b[\w-]+)\s*\[([^"\n\]]+)\]/g, (match, id, label) => {
    if (
      label.includes('(') ||
      label.includes(')') ||
      label.includes(':') ||
      label.includes('{') ||
      label.includes('}') ||
      label.includes('/') ||
      label.includes('&')
    ) {
      return `${id}["${label.replace(/"/g, "'").trim()}"]`;
    }
    return match;
  });

  return cleaned.trim();
}

export const MermaidDiagram = React.memo(function MermaidDiagram({ code }: MermaidDiagramProps) {
  const sanitizedCode = sanitizeMermaid(code);
  const codeHash = getCodeHash(sanitizedCode);

  // Check if we already have a cached SVG
  const cachedSvg = typeof window !== 'undefined' ? svgCache.get(codeHash) : undefined;

  const [svgContent, setSvgContent] = useState<string>(() => cachedSvg || '');
  const [error, setError] = useState<string | null>(null);
  const [isRendered, setIsRendered] = useState<boolean>(() => Boolean(cachedSvg));
  const [viewMode, setViewMode] = useState<'visual' | 'code'>('visual');
  const [isCopied, setIsCopied] = useState(false);
  const [isCopiedImage, setIsCopiedImage] = useState(false);

  // Fullscreen Interactive Canvas State
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  const touchStartRef = useRef<{
    x: number;
    y: number;
    panX: number;
    panY: number;
    dist?: number;
    zoom?: number;
  } | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  // Render diagram using dynamically imported Mermaid
  useEffect(() => {
    let isCancelled = false;

    if (!sanitizedCode) {
      setSvgContent('');
      setIsRendered(false);
      return;
    }

    // If already in cache, use it immediately with zero lag
    const existing = svgCache.get(codeHash);
    if (existing) {
      setSvgContent(existing);
      setIsRendered(true);
      setError(null);
      return;
    }

    const timer = setTimeout(async () => {
      let renderId = '';
      try {
        const { default: mermaid } = await import('mermaid');

        if (isCancelled) return;

        const isDark = document.documentElement.classList.contains('dark');

        mermaid.initialize({
          startOnLoad: false,
          securityLevel: 'loose',
          fontFamily: 'var(--font-inter), -apple-system, sans-serif',
          theme: isDark ? 'dark' : 'neutral',
          themeVariables: {
            fontSize: '13px',
            fontFamily: 'var(--font-inter), -apple-system, sans-serif',
            primaryColor: isDark ? '#262626' : '#F5F5F5',
            primaryTextColor: isDark ? '#F5F5F5' : '#0A0A0A',
            primaryBorderColor: isDark ? '#404040' : '#E5E5E5',
            lineColor: isDark ? '#8A8A8A' : '#737373',
            secondaryColor: isDark ? '#1F1F1F' : '#EAEAEA',
            tertiaryColor: isDark ? '#141414' : '#FAFAFA',
            background: isDark ? '#141414' : '#FFFFFF',
            mainBkg: isDark ? '#1F1F1F' : '#F5F5F5',
            nodeBorder: isDark ? '#404040' : '#D4D4D4',
            clusterBkg: isDark ? '#171717' : '#FAFAFA',
            titleColor: isDark ? '#F5F5F5' : '#0A0A0A',
            edgeLabelBackground: isDark ? '#1A1A1A' : '#FFFFFF',

            // Vibrant, high-contrast pie chart slice colors
            pie1: '#3b82f6',
            pie2: '#10b981',
            pie3: '#f59e0b',
            pie4: '#ef4444',
            pie5: '#8b5cf6',
            pie6: '#ec4899',
            pie7: '#06b6d4',
            pie8: '#f97316',
            pie9: '#14b8a6',
            pie10: '#6366f1',
            pie11: '#84cc16',
            pie12: '#d946ef',
            pieTitleTextColor: isDark ? '#F5F5F5' : '#0A0A0A',
            pieTitleTextSize: '16px',
            pieSectionTextColor: '#FFFFFF',
            pieSectionTextSize: '12px',
            pieLegendTextColor: isDark ? '#E5E5E5' : '#171717',
            pieLegendTextSize: '12px',
            pieStrokeColor: isDark ? '#141414' : '#FFFFFF',
            pieStrokeWidth: '2px',
            pieOuterStrokeWidth: '2px',
            pieOuterStrokeColor: isDark ? '#262626' : '#E5E5E5',
            pieOpacity: '0.9',
          },
        });

        // Pre-validate syntax before rendering
        try {
          await mermaid.parse(sanitizedCode);
        } catch (parseErr) {
          if (!isCancelled) {
            setError(parseErr instanceof Error ? parseErr.message : 'Syntax error in diagram definition');
          }
          return;
        }

        renderId = `astor-m-${codeHash}`;
        const { svg } = await mermaid.render(renderId, sanitizedCode);

        // Remove any temporary elements created in document.body
        const strayEl = document.getElementById(renderId) || document.getElementById(`d${renderId}`);
        if (strayEl) strayEl.remove();

        if (!isCancelled) {
          const responsiveSvg = svg
            .replace(/width="100%"/g, '')
            .replace(/style="max-width:[^"]*"/g, 'style="max-width: 100%; height: auto;"');

          // Cache the rendered SVG permanently in memory
          svgCache.set(codeHash, responsiveSvg);

          setSvgContent(responsiveSvg);
          setIsRendered(true);
          setError(null);
        }
      } catch (err: unknown) {
        if (renderId) {
          const strayEl = document.getElementById(renderId) || document.getElementById(`d${renderId}`);
          if (strayEl) strayEl.remove();
        }

        if (!isCancelled) {
          setError(err instanceof Error ? err.message : 'Invalid diagram syntax');
        }
      }
    }, 100);

    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [sanitizedCode, codeHash]);

  // Copy code
  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch {}
  };

  // Convert SVG to PNG Blob
  const getPngBlob = (): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      if (!svgContent) return reject(new Error('No SVG content available'));

      const parser = new DOMParser();
      const doc = parser.parseFromString(svgContent, 'image/svg+xml');
      const svgElement = doc.querySelector('svg');
      if (!svgElement) return reject(new Error('Invalid SVG element'));

      const viewBox = svgElement.getAttribute('viewBox');
      let width = 800;
      let height = 600;

      if (viewBox) {
        const parts = viewBox.split(/\s+/).map(Number);
        if (parts.length === 4 && parts[2] > 0 && parts[3] > 0) {
          width = parts[2];
          height = parts[3];
        }
      } else {
        const wAttr = parseFloat(svgElement.getAttribute('width') || '800');
        const hAttr = parseFloat(svgElement.getAttribute('height') || '600');
        if (!isNaN(wAttr) && wAttr > 0) width = wAttr;
        if (!isNaN(hAttr) && hAttr > 0) height = hAttr;
      }

      const scale = 2;
      const canvas = document.createElement('canvas');
      canvas.width = width * scale;
      canvas.height = height * scale;
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('Canvas 2D context not available'));

      const isDark = document.documentElement.classList.contains('dark');
      ctx.fillStyle = isDark ? '#0A0A0A' : '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const svgData = new XMLSerializer().serializeToString(svgElement);
      const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
      const svgUrl = URL.createObjectURL(svgBlob);
      const img = new Image();

      img.onload = () => {
        ctx.drawImage(img, 0, 0, width * scale, height * scale);
        URL.revokeObjectURL(svgUrl);
        canvas.toBlob((b) => {
          if (b) resolve(b);
          else reject(new Error('Canvas toBlob failed'));
        }, 'image/png');
      };

      img.onerror = (e) => {
        URL.revokeObjectURL(svgUrl);
        reject(e);
      };

      img.src = svgUrl;
    });
  };

  // Download PNG
  const handleDownloadPng = async () => {
    try {
      const blob = await getPngBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `astor-diagram-${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download PNG failed:', err);
    }
  };

  // Download SVG
  const handleDownloadSvg = () => {
    try {
      const blob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `astor-diagram-${Date.now()}.svg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download SVG failed:', err);
    }
  };

  // Copy PNG image to clipboard
  const handleCopyImage = async () => {
    try {
      const blob = await getPngBlob();
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': blob }),
      ]);
      setIsCopiedImage(true);
      setTimeout(() => setIsCopiedImage(false), 2000);
    } catch (err) {
      console.error('Copy image failed:', err);
    }
  };

  // Canvas Mouse Controls (Pan & Zoom)
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return; // Only left mouse button
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      panX: pan.x,
      panY: pan.y,
    };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    setPan({
      x: dragStartRef.current.panX + dx,
      y: dragStartRef.current.panY + dy,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.15 : 0.85;
    setZoomLevel((prev) => Math.min(4, Math.max(0.25, Number((prev * zoomFactor).toFixed(2)))));
  };

  // Touch Handlers for Mobile (Single-finger Pan & Pinch-to-Zoom)
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      touchStartRef.current = {
        x: touch.clientX,
        y: touch.clientY,
        panX: pan.x,
        panY: pan.y,
      };
      setIsDragging(true);
    } else if (e.touches.length === 2) {
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const dx = t1.clientX - t2.clientX;
      const dy = t1.clientY - t2.clientY;
      const dist = Math.hypot(dx, dy);
      touchStartRef.current = {
        x: (t1.clientX + t2.clientX) / 2,
        y: (t1.clientY + t2.clientY) / 2,
        panX: pan.x,
        panY: pan.y,
        dist,
        zoom: zoomLevel,
      };
      setIsDragging(false);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStartRef.current) return;
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      const dx = touch.clientX - touchStartRef.current.x;
      const dy = touch.clientY - touchStartRef.current.y;
      setPan({
        x: touchStartRef.current.panX + dx,
        y: touchStartRef.current.panY + dy,
      });
    } else if (e.touches.length === 2 && touchStartRef.current.dist && touchStartRef.current.zoom) {
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const dx = t1.clientX - t2.clientX;
      const dy = t1.clientY - t2.clientY;
      const currentDist = Math.hypot(dx, dy);
      const ratio = currentDist / touchStartRef.current.dist;
      const newZoom = Math.min(
        4,
        Math.max(0.25, Number((touchStartRef.current.zoom * ratio).toFixed(2)))
      );
      setZoomLevel(newZoom);
    }
  };

  const handleTouchEnd = () => {
    touchStartRef.current = null;
    setIsDragging(false);
  };

  const handleResetCanvas = () => {
    setZoomLevel(1);
    setPan({ x: 0, y: 0 });
  };

  // Handle Esc key to close canvas
  useEffect(() => {
    if (!isFullscreen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsFullscreen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen]);

  return (
    <div className="my-5 rounded-2xl border border-[var(--border)] overflow-hidden bg-[var(--popover-bg)] shadow-sm transition-all">
      {/* Top Header & Toolbar */}
      <div className="flex items-center justify-between px-3.5 py-2 border-b border-[var(--border)] bg-[var(--hover)]/40 text-xs">
        {/* Left: View Mode Toggle */}
        <div className="flex items-center gap-1 p-0.5 rounded-lg bg-[var(--hover)] border border-[var(--border)]">
          <button
            type="button"
            onClick={() => setViewMode('visual')}
            className={`flex items-center gap-1.5 px-2 py-1 rounded-md transition-colors ${
              viewMode === 'visual'
                ? 'bg-[var(--popover-bg)] text-[var(--text)] shadow-2xs font-medium'
                : 'text-[var(--secondary)] hover:text-[var(--text)]'
            }`}
          >
            <Eye size={12} />
            <span>Diagram</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('code')}
            className={`flex items-center gap-1.5 px-2 py-1 rounded-md transition-colors ${
              viewMode === 'code'
                ? 'bg-[var(--popover-bg)] text-[var(--text)] shadow-2xs font-medium'
                : 'text-[var(--secondary)] hover:text-[var(--text)]'
            }`}
          >
            <Code2 size={12} />
            <span>Code</span>
          </button>
        </div>

        {/* Right: Actions (Download PNG/SVG, Copy Image, Copy Code, Fullscreen Canvas) */}
        <div className="flex items-center gap-1">
          {viewMode === 'visual' && isRendered && (
            <>
              {/* Copy Image Button */}
              <button
                type="button"
                onClick={handleCopyImage}
                title="Copy diagram image to clipboard"
                className="flex items-center gap-1 py-1 px-2 rounded-md hover:bg-[var(--hover)] text-[var(--secondary)] hover:text-[var(--text)] transition-colors"
              >
                {isCopiedImage ? (
                  <>
                    <Check size={12} className="text-emerald-500" />
                    <span className="text-[11px] font-sans text-emerald-500">Copied</span>
                  </>
                ) : (
                  <>
                    <FileImage size={12} />
                    <span className="text-[11px] font-sans hidden sm:inline">Copy image</span>
                  </>
                )}
              </button>

              {/* Download PNG Button */}
              <button
                type="button"
                onClick={handleDownloadPng}
                title="Download high-resolution PNG"
                className="flex items-center gap-1 py-1 px-2 rounded-md hover:bg-[var(--hover)] text-[var(--secondary)] hover:text-[var(--text)] transition-colors"
              >
                <Download size={12} />
                <span className="text-[11px] font-sans">Save PNG</span>
              </button>

              {/* Download SVG Button */}
              <button
                type="button"
                onClick={handleDownloadSvg}
                title="Download vector SVG"
                className="p-1 rounded-md hover:bg-[var(--hover)] text-[var(--secondary)] hover:text-[var(--text)] transition-colors hidden sm:inline-flex"
              >
                <span className="text-[10px] font-mono font-medium">SVG</span>
              </button>

              {/* Open Canvas Fullscreen */}
              <button
                type="button"
                onClick={() => {
                  handleResetCanvas();
                  setIsFullscreen(true);
                }}
                title="Open interactive Canvas view (Pan & Zoom)"
                className="flex items-center gap-1 py-1 px-2 rounded-md hover:bg-[var(--hover)] text-[var(--secondary)] hover:text-[var(--text)] transition-colors"
              >
                <Maximize2 size={12} />
                <span className="text-[11px] font-sans hidden sm:inline">Canvas</span>
              </button>
            </>
          )}

          {/* Copy Code */}
          <button
            type="button"
            onClick={handleCopyCode}
            title="Copy diagram definition"
            className="flex items-center gap-1 py-1 px-2 rounded-md hover:bg-[var(--hover)] text-[var(--secondary)] hover:text-[var(--text)] transition-colors"
          >
            {isCopied ? (
              <>
                <Check size={12} className="text-emerald-500" />
                <span className="text-[11px] font-sans text-emerald-500">Copied</span>
              </>
            ) : (
              <>
                <Copy size={12} />
                <span className="text-[11px] font-sans">Copy code</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Main Presentation Area */}
      <div className="p-4 overflow-x-auto min-h-[140px] flex items-center justify-center bg-[var(--bg)]/40">
        {viewMode === 'visual' ? (
          error && !isRendered ? (
            <div className="flex flex-col items-center justify-center py-6 px-4 text-center max-w-md space-y-2">
              <div className="p-2 rounded-full bg-[var(--hover)]">
                <AlertCircle size={18} className="text-[var(--secondary)]" />
              </div>
              <p className="text-xs text-[var(--secondary)] leading-relaxed">
                Diagram syntax is currently completing. Showing source definition:
              </p>
              <pre className="text-[11.5px] font-mono p-3 bg-[var(--hover)]/60 border border-[var(--border)] rounded-xl text-left overflow-x-auto max-w-full w-full">
                <code>{code}</code>
              </pre>
            </div>
          ) : svgContent ? (
            <div
              className="w-full flex justify-center items-center py-2 select-none [&>svg]:max-w-full [&>svg]:h-auto transition-transform"
              dangerouslySetInnerHTML={{ __html: svgContent }}
            />
          ) : (
            <div className="flex items-center gap-2 py-8 text-xs text-[var(--secondary)] font-sans">
              <div className="w-3.5 h-3.5 border-2 border-[var(--secondary)] border-t-transparent rounded-full animate-spin" />
              <span>Rendering visual diagram...</span>
            </div>
          )
        ) : (
          <pre className="w-full p-4 m-0 font-mono text-[12.5px] bg-[var(--code-bg)] text-[var(--code-text)] rounded-xl overflow-x-auto leading-relaxed border border-[var(--border)]">
            <code>{code}</code>
          </pre>
        )}
      </div>

      {/* =========================================================================
          INTERACTIVE FULLSCREEN CANVAS (Figma / Excalidraw Style with Dot Grid)
         ========================================================================= */}
      {isFullscreen && (
        <div
          className="fixed inset-0 z-[9999] bg-[var(--bg)] flex flex-col animate-popover overflow-hidden select-none touch-none"
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={handleTouchEnd}
        >
          {/* Top Bar with Title & Close */}
          <div className="absolute top-0 inset-x-0 z-20 flex items-center justify-between px-3 sm:px-5 h-14 border-b border-[var(--border)] bg-[var(--bg)]/80 backdrop-blur-md">
            <div className="flex items-center gap-2.5">
              <span className="font-serif text-[15px] font-medium text-[var(--text)]">
                Astor Canvas
              </span>
              <span className="text-[11px] font-mono text-[var(--secondary)] px-2 py-0.5 rounded-full border border-[var(--border)] bg-[var(--hover)]/40">
                {Math.round(zoomLevel * 100)}%
              </span>
            </div>

            {/* Quick Hints */}
            <div className="hidden md:flex items-center gap-4 text-xs text-[var(--secondary)] font-sans">
              <span className="flex items-center gap-1.5">
                <Move size={12} />
                <span>Drag to pan canvas</span>
              </span>
              <span>•</span>
              <span>Scroll to zoom</span>
            </div>

            {/* Close Button */}
            <button
              type="button"
              onClick={() => setIsFullscreen(false)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[var(--border)] bg-[var(--popover-bg)] hover:bg-[var(--hover)] text-xs text-[var(--text)] font-medium transition-colors"
            >
              <Minimize2 size={13} />
              <span>Close Canvas (Esc)</span>
            </button>
          </div>

          {/* Interactive Canvas Workspace (Dot Grid Blueprint) */}
          <div
            ref={canvasRef}
            onMouseDown={handleMouseDown}
            onWheel={handleWheel}
            className={`w-full h-full pt-14 flex items-center justify-center overflow-hidden bg-[radial-gradient(var(--border)_1.5px,transparent_1.5px)] [background-size:24px_24px] ${
              isDragging ? 'cursor-grabbing' : 'cursor-grab'
            }`}
          >
            <div
              style={{
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoomLevel})`,
                transformOrigin: 'center center',
              }}
              className="p-10 rounded-2xl border border-[var(--border)] bg-[var(--popover-bg)] shadow-2xl transition-transform duration-75 select-none [&>svg]:max-w-none pointer-events-none"
              dangerouslySetInnerHTML={{ __html: svgContent }}
            />
          </div>

          {/* Bottom Floating Canvas Island (Zoom, Reset, Export) */}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1 p-1.5 rounded-2xl border border-[var(--border)] bg-[var(--popover-bg)]/90 backdrop-blur-md shadow-2xl max-w-[calc(100vw-24px)] overflow-x-auto scrollbar-none">
            {/* Zoom Out */}
            <button
              type="button"
              onClick={() => setZoomLevel((z) => Math.max(0.25, Number((z - 0.25).toFixed(2))))}
              className="p-2 rounded-xl hover:bg-[var(--hover)] text-[var(--secondary)] hover:text-[var(--text)] transition-colors"
              title="Zoom Out"
            >
              <ZoomOut size={16} />
            </button>

            {/* Reset Zoom & Pan */}
            <button
              type="button"
              onClick={handleResetCanvas}
              className="px-2.5 py-1.5 rounded-xl hover:bg-[var(--hover)] text-xs font-mono text-[var(--text)] font-medium transition-colors"
              title="Reset View (100%)"
            >
              <RotateCcw size={13} className="inline mr-1 opacity-70" />
              <span>{Math.round(zoomLevel * 100)}%</span>
            </button>

            {/* Zoom In */}
            <button
              type="button"
              onClick={() => setZoomLevel((z) => Math.min(4, Number((z + 0.25).toFixed(2))))}
              className="p-2 rounded-xl hover:bg-[var(--hover)] text-[var(--secondary)] hover:text-[var(--text)] transition-colors"
              title="Zoom In"
            >
              <ZoomIn size={16} />
            </button>

            <div className="h-5 w-px bg-[var(--border)] mx-1" />

            {/* Download PNG */}
            <button
              type="button"
              onClick={handleDownloadPng}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[var(--border)] bg-[var(--hover)]/60 hover:bg-[var(--hover)] text-xs text-[var(--text)] font-medium transition-colors"
              title="Download high-resolution image"
            >
              <Download size={14} />
              <span>Save Image</span>
            </button>

            {/* Download SVG */}
            <button
              type="button"
              onClick={handleDownloadSvg}
              className="px-2.5 py-1.5 rounded-xl hover:bg-[var(--hover)] text-xs font-mono text-[var(--secondary)] hover:text-[var(--text)] transition-colors"
              title="Download vector SVG"
            >
              SVG
            </button>

            {/* Copy Image */}
            <button
              type="button"
              onClick={handleCopyImage}
              className="p-2 rounded-xl hover:bg-[var(--hover)] text-[var(--secondary)] hover:text-[var(--text)] transition-colors"
              title="Copy image to clipboard"
            >
              {isCopiedImage ? (
                <Check size={16} className="text-emerald-500" />
              ) : (
                <FileImage size={16} />
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
});
