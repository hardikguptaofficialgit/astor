'use client';

import React from 'react';

export const AVATAR_PRESETS: Record<string, { label: string; gradient: string }> = {
  'preset:obsidian': {
    label: 'Obsidian',
    gradient: 'from-zinc-700 via-neutral-800 to-zinc-950 text-white',
  },
  'preset:aurora': {
    label: 'Aurora',
    gradient: 'from-emerald-500 via-teal-600 to-cyan-800 text-white',
  },
  'preset:sunset': {
    label: 'Sunset',
    gradient: 'from-amber-500 via-orange-600 to-rose-700 text-white',
  },
  'preset:ocean': {
    label: 'Ocean',
    gradient: 'from-blue-500 via-indigo-600 to-slate-900 text-white',
  },
  'preset:amethyst': {
    label: 'Amethyst',
    gradient: 'from-purple-500 via-violet-600 to-indigo-950 text-white',
  },
  'preset:rose': {
    label: 'Rose',
    gradient: 'from-rose-500 via-pink-600 to-purple-900 text-white',
  },
  'preset:minimal': {
    label: 'Monochrome',
    gradient: 'from-neutral-900 to-black text-white border border-white/20',
  },
};

interface UserAvatarProps {
  avatarUrl?: string | null;
  name?: string | null;
  size?: number;
  className?: string;
}

export function UserAvatar({
  avatarUrl,
  name,
  size = 28,
  className = '',
}: UserAvatarProps) {
  const initial = (name || 'A')[0].toUpperCase();

  // If avatarUrl is a preset key
  if (avatarUrl && AVATAR_PRESETS[avatarUrl]) {
    const preset = AVATAR_PRESETS[avatarUrl];
    return (
      <div
        style={{ width: `${size}px`, height: `${size}px` }}
        className={`rounded-full bg-gradient-to-br ${preset.gradient} font-sans font-medium flex items-center justify-center shrink-0 shadow-xs select-none ${className}`}
        title={name || 'User'}
      >
        <span style={{ fontSize: `${Math.max(10, Math.round(size * 0.42))}px` }}>
          {initial}
        </span>
      </div>
    );
  }

  // If avatarUrl is an external image URL
  if (avatarUrl && (avatarUrl.startsWith('http://') || avatarUrl.startsWith('https://') || avatarUrl.startsWith('data:'))) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatarUrl}
        alt={name || 'User avatar'}
        style={{ width: `${size}px`, height: `${size}px` }}
        className={`rounded-full object-cover shrink-0 border border-[var(--border)] shadow-xs select-none ${className}`}
        onError={(e) => {
          // Fallback to initial on broken image
          (e.target as HTMLElement).style.display = 'none';
        }}
      />
    );
  }

  // Default fallback initial
  return (
    <div
      style={{ width: `${size}px`, height: `${size}px` }}
      className={`rounded-full bg-[var(--text)] text-[var(--bg)] font-sans font-medium flex items-center justify-center shrink-0 shadow-xs select-none ${className}`}
      title={name || 'User'}
    >
      <span style={{ fontSize: `${Math.max(10, Math.round(size * 0.42))}px` }}>
        {initial}
      </span>
    </div>
  );
}
