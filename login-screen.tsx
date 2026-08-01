'use client'

import { useState, type FormEvent } from 'react'
import Image from 'next/image'
import { Mail, ShieldCheck, Sparkles } from 'lucide-react'
import { ADMIN_EMAIL, useApp } from '@/components/app-provider'

export function LoginScreen() {
  const { login } = useApp()
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const value = email.trim().toLowerCase()
    if (!value || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      setError('Please enter a valid email address.')
      return
    }
    setError('')
    login(value)
  }

  const isAdmin = email.trim().toLowerCase() === ADMIN_EMAIL

  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden px-6 py-10">
      {/* soft ambient glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-24 size-72 -translate-x-1/2 rounded-full bg-primary/20 blur-3xl"
      />

      <div className="relative z-10 flex w-full max-w-sm flex-col items-center">
        {/* Logo */}
        <div className="mb-5 overflow-hidden rounded-3xl border border-border shadow-2xl">
          <Image
            src="/lucky-cards-logo.png"
            alt="Lucky Cards logo"
            width={96}
            height={96}
            className="size-24 object-cover"
            priority
          />
        </div>

        <h1 className="font-heading text-3xl font-extrabold tracking-tight text-foreground">
          Lucky Cards
        </h1>
        <p className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground">
          <Sparkles className="size-4 text-primary" />
          Flip cards, watch ads, win real rewards
        </p>

        {/* Auth card */}
        <form
          onSubmit={submit}
          className="mt-8 w-full space-y-4 rounded-2xl border border-border bg-card p-6 shadow-xl"
        >
          <div className="space-y-2">
            <label htmlFor="email" className="text-sm font-medium text-foreground">
              Email address
            </label>
            <div className="flex items-center gap-2 rounded-xl border border-input bg-background px-3 focus-within:ring-2 focus-within:ring-ring">
              <Mail className="size-4 shrink-0 text-muted-foreground" />
              <input
                id="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full bg-transparent py-3 text-sm text-foreground outline-none placeholder:text-muted-foreground"
              />
            </div>
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>

          <button
            type="submit"
            className="w-full rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground transition hover:brightness-95"
          >
            Sign in with Email
          </button>

          <div className="flex items-center gap-3">
            <span className="h-px flex-1 bg-border" />
            <span className="text-xs text-muted-foreground">or</span>
            <span className="h-px flex-1 bg-border" />
          </div>

          <button
            type="button"
            onClick={() => {
              if (!email.trim()) {
                setError('Enter your Google email above, then continue.')
                return
              }
              submit(new Event('submit') as unknown as FormEvent)
            }}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-input bg-background py-3 text-sm font-semibold text-foreground transition hover:bg-secondary"
          >
            <GoogleGlyph />
            Continue with Google
          </button>

          {isAdmin ? (
            <div className="flex items-center justify-center gap-1.5 rounded-lg bg-primary/10 py-2 text-xs font-semibold text-primary">
              <ShieldCheck className="size-4" />
              Admin account detected — full access
            </div>
          ) : (
            <p className="text-center text-[11px] leading-relaxed text-muted-foreground">
              Admin? Sign in with{' '}
              <span className="font-medium text-foreground">{ADMIN_EMAIL}</span> for the
              admin dashboard.
            </p>
          )}
        </form>

        <p className="mt-6 max-w-xs text-center text-[11px] leading-relaxed text-muted-foreground">
          By continuing you agree to watch rewarded ads to earn coins. Coins can be
          withdrawn to UPI once you reach the minimum threshold.
        </p>
      </div>
    </main>
  )
}

function GoogleGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38Z"
      />
    </svg>
  )
}
