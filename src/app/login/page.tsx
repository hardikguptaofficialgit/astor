'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { AstorMark } from '@/components/astor-mark';
import { useTheme } from '@/components/theme-provider';
import { Sun, Moon, Laptop, Eye, EyeOff, Loader2, ArrowLeft } from 'lucide-react';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { theme, setTheme } = useTheme();

  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [googleEnabled, setGoogleEnabled] = useState(true);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => res.json())
      .then((data) => {
        if (typeof data.googleEnabled === 'boolean') {
          setGoogleEnabled(data.googleEnabled);
        }
      })
      .catch(() => {
        // fail gracefully
      });
  }, []);

  useEffect(() => {
    const err = searchParams.get('error');
    if (err === 'oauth_failed') {
      setError('Google sign-in was cancelled or failed. Please try again.');
    } else if (err === 'google_not_configured') {
      setError('Google authentication is not configured on this server.');
    } else if (err === 'invalid_state') {
      setError('Session expired or invalid state. Please try signing in again.');
    }
    const tab = searchParams.get('tab');
    if (tab === 'signup') {
      setMode('signup');
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const endpoint = mode === 'signup' ? '/api/auth/signup' : '/api/auth/login';
      const body =
        mode === 'signup'
          ? { name: name.trim(), email: email.trim(), password }
          : { email: email.trim(), password };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Authentication failed. Please check your credentials.');
      }

      // Success - redirect to main chat
      router.push('/');
      router.refresh();
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('An unexpected error occurred. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-between p-6 bg-[var(--bg)] text-[var(--text)] transition-colors duration-200">
      {/* Top Header */}
      <header className="w-full max-w-5xl mx-auto flex items-center justify-between">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-xs text-[var(--secondary)] hover:text-[var(--text)] transition-colors py-1.5 px-2.5 rounded-lg hover:bg-[var(--hover)]"
        >
          <ArrowLeft size={14} />
          <span>Back to chat</span>
        </Link>

        {/* Theme Pill */}
        <div className="flex items-center gap-1 p-0.5 rounded-lg border border-[var(--border)] bg-[var(--sidebar-bg)] text-xs">
          <button
            type="button"
            onClick={() => setTheme('light')}
            className={`p-1.5 rounded-md transition-colors ${
              theme === 'light'
                ? 'bg-[var(--popover-bg)] text-[var(--text)] shadow-xs'
                : 'text-[var(--secondary)] hover:text-[var(--text)]'
            }`}
            title="Light mode"
            aria-label="Light mode"
          >
            <Sun size={13} />
          </button>
          <button
            type="button"
            onClick={() => setTheme('dark')}
            className={`p-1.5 rounded-md transition-colors ${
              theme === 'dark'
                ? 'bg-[var(--popover-bg)] text-[var(--text)] shadow-xs'
                : 'text-[var(--secondary)] hover:text-[var(--text)]'
            }`}
            title="Dark mode"
            aria-label="Dark mode"
          >
            <Moon size={13} />
          </button>
          <button
            type="button"
            onClick={() => setTheme('system')}
            className={`p-1.5 rounded-md transition-colors ${
              theme === 'system'
                ? 'bg-[var(--popover-bg)] text-[var(--text)] shadow-xs'
                : 'text-[var(--secondary)] hover:text-[var(--text)]'
            }`}
            title="System theme"
            aria-label="System theme"
          >
            <Laptop size={13} />
          </button>
        </div>
      </header>

      {/* Main Card */}
      <main className="w-full max-w-[390px] mx-auto py-8">
        <div className="flex flex-col items-center text-center mb-6">
          <Link href="/" className="inline-block mb-3 hover:opacity-85 transition-opacity">
            <AstorMark size={36} className="text-[var(--text)]" />
          </Link>
          <h1 className="font-serif text-2xl font-medium tracking-tight">
            {mode === 'signin' ? 'Welcome back to Astor' : 'Create your Astor account'}
          </h1>
          <p className="text-xs text-[var(--secondary)] mt-1.5 leading-relaxed">
            {mode === 'signin'
              ? 'Sign in to access your synchronized conversations and memories.'
              : 'Start conversing with persistent memory and web search intelligence.'}
          </p>
        </div>

        {/* Mode Selector Tab */}
        <div className="grid grid-cols-2 gap-1 p-1 mb-5 rounded-xl border border-[var(--border)] bg-[var(--sidebar-bg)]">
          <button
            type="button"
            onClick={() => {
              setMode('signin');
              setError(null);
            }}
            className={`py-1.5 text-xs font-medium rounded-lg transition-all ${
              mode === 'signin'
                ? 'bg-[var(--popover-bg)] text-[var(--text)] shadow-xs'
                : 'text-[var(--secondary)] hover:text-[var(--text)]'
            }`}
          >
            Sign in
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('signup');
              setError(null);
            }}
            className={`py-1.5 text-xs font-medium rounded-lg transition-all ${
              mode === 'signup'
                ? 'bg-[var(--popover-bg)] text-[var(--text)] shadow-xs'
                : 'text-[var(--secondary)] hover:text-[var(--text)]'
            }`}
          >
            Create account
          </button>
        </div>

        {/* Google OAuth Button */}
        {googleEnabled ? (
          <a
            href="/api/auth/oauth/google"
            className="flex items-center justify-center gap-2.5 w-full py-2.5 px-4 rounded-xl border border-[var(--border)] bg-[var(--popover-bg)] hover:bg-[var(--hover)] text-xs font-medium text-[var(--text)] shadow-xs transition-colors"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            <span>Continue with Google</span>
          </a>
        ) : (
          <div
            title="Google OAuth is not configured on this server"
            className="flex items-center justify-center gap-2.5 w-full py-2.5 px-4 rounded-xl border border-[var(--border)] bg-[var(--hover)] opacity-50 cursor-not-allowed text-xs font-medium text-[var(--secondary)] shadow-xs select-none"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true" className="grayscale">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            <span>Continue with Google (not configured)</span>
          </div>
        )}

        {/* Divider */}
        <div className="relative my-5 flex items-center justify-center">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-[var(--border)]" />
          </div>
          <span className="relative bg-[var(--bg)] px-3 text-[11px] text-[var(--secondary)] uppercase tracking-wider font-mono">
            or
          </span>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="mb-4 p-3 rounded-xl border border-red-500/20 bg-red-500/10 text-red-500 text-xs leading-relaxed">
            {error}
          </div>
        )}

        {/* Credentials Form */}
        <form onSubmit={handleSubmit} className="space-y-3.5">
          {mode === 'signup' && (
            <div>
              <label
                htmlFor="name"
                className="block text-[11px] font-medium text-[var(--secondary)] mb-1"
              >
                Full Name
              </label>
              <input
                id="name"
                type="text"
                autoComplete="name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Hardik"
                className="w-full px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--popover-bg)] text-xs text-[var(--text)] placeholder-[var(--secondary)]/60 focus:outline-none focus:ring-1 focus:ring-[var(--text)] transition-colors"
              />
            </div>
          )}

          <div>
            <label
              htmlFor="email"
              className="block text-[11px] font-medium text-[var(--secondary)] mb-1"
            >
              Email address
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              className="w-full px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--popover-bg)] text-xs text-[var(--text)] placeholder-[var(--secondary)]/60 focus:outline-none focus:ring-1 focus:ring-[var(--text)] transition-colors"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label
                htmlFor="password"
                className="block text-[11px] font-medium text-[var(--secondary)]"
              >
                Password
              </label>
              {mode === 'signup' && (
                <span className="text-[10px] text-[var(--secondary)] font-mono">
                  Min. 8 characters
                </span>
              )}
            </div>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                required
                minLength={mode === 'signup' ? 8 : undefined}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3 py-2 pr-9 rounded-xl border border-[var(--border)] bg-[var(--popover-bg)] text-xs text-[var(--text)] placeholder-[var(--secondary)]/60 focus:outline-none focus:ring-1 focus:ring-[var(--text)] transition-colors font-mono"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--secondary)] hover:text-[var(--text)] transition-colors p-0.5"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={13} /> : <Eye size={13} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-2.5 px-4 rounded-xl bg-[var(--text)] text-[var(--bg)] text-xs font-medium hover:opacity-90 active:scale-[0.99] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-xs"
          >
            {loading && <Loader2 size={13} className="animate-spin" />}
            <span>
              {loading
                ? mode === 'signup'
                  ? 'Creating account...'
                  : 'Signing in...'
                : mode === 'signup'
                ? 'Create account'
                : 'Sign in'}
            </span>
          </button>
        </form>

        {/* Guest fallback link */}
        <div className="mt-6 text-center">
          <Link
            href="/"
            className="text-xs text-[var(--secondary)] hover:text-[var(--text)] transition-colors inline-flex items-center gap-1"
          >
            <span>Continue as guest</span>
            <span aria-hidden="true">→</span>
          </Link>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full max-w-5xl mx-auto py-3 text-center text-[11px] text-[var(--secondary)] font-mono">
        Astor · Thoughtful AI with persistent memory
      </footer>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[var(--bg)] text-[var(--secondary)]">
          <Loader2 size={20} className="animate-spin" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
