'use client'

import { useEffect, useRef, useState } from 'react'
import { Volume2, X, Zap } from 'lucide-react'
import { AD_DURATION_SEC } from '@/lib/storage'
import { isNativeAdMobAvailable, showRewardedAd } from '@/lib/admob'

type AdModalProps = {
  open: boolean
  title?: string
  /** Fired the instant the ad starts — used to arm the state-side timer. */
  onStart?: () => void
  /** Called once the ad has fully played and the reward is unlocked. */
  onComplete: () => void
  /** Called if the user closes before completing (no reward). */
  onCancel: () => void
}

export function AdModal({
  open,
  title = 'Rewarded Ad',
  onStart,
  onComplete,
  onCancel,
}: AdModalProps) {
  const [remaining, setRemaining] = useState(AD_DURATION_SEC)
  const [finished, setFinished] = useState(false)
  const [nativeMode, setNativeMode] = useState(false)
  const completedRef = useRef(false)

  // Keep the latest callbacks in refs so the timer effect only depends on
  // `open` — otherwise a parent re-render would restart the countdown.
  const onCompleteRef = useRef(onComplete)
  const onCancelRef = useRef(onCancel)
  const onStartRef = useRef(onStart)
  onCompleteRef.current = onComplete
  onCancelRef.current = onCancel
  onStartRef.current = onStart

  useEffect(() => {
    if (!open) return

    completedRef.current = false
    setRemaining(AD_DURATION_SEC)
    setFinished(false)
    // Arm the state-side timer authority the moment the ad appears.
    onStartRef.current?.()

    // Try a REAL AdMob rewarded ad first (only works inside the native APK).
    if (isNativeAdMobAvailable()) {
      setNativeMode(true)
      let cancelled = false
      showRewardedAd().then((result) => {
        if (cancelled) return
        if (result.rewarded) {
          completedRef.current = true
          onCompleteRef.current()
        } else {
          onCancelRef.current()
        }
      })
      return () => {
        cancelled = true
      }
    }

    // Web fallback: simulated video ad with a real countdown.
    setNativeMode(false)
    const startedAt = Date.now()
    const interval = setInterval(() => {
      const elapsed = (Date.now() - startedAt) / 1000
      const left = Math.max(0, AD_DURATION_SEC - elapsed)
      setRemaining(left)
      if (left <= 0) {
        clearInterval(interval)
        setFinished(true)
      }
    }, 100)

    return () => clearInterval(interval)
  }, [open])

  if (!open) return null

  const progress = ((AD_DURATION_SEC - remaining) / AD_DURATION_SEC) * 100

  const handleClaim = () => {
    if (completedRef.current) return
    completedRef.current = true
    onComplete()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/85 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Video advertisement"
    >
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
        {/* Ad top bar */}
        <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
          <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <span className="rounded bg-primary px-1.5 py-0.5 text-[10px] font-bold uppercase text-primary-foreground">
              Ad
            </span>
            {title}
          </span>
          {finished ? (
            <button
              onClick={onCancel}
              className="rounded-full p-1 text-muted-foreground transition hover:bg-secondary hover:text-foreground"
              aria-label="Close ad"
            >
              <X className="size-4" />
            </button>
          ) : (
            <span className="text-xs font-semibold tabular-nums text-primary">
              {nativeMode ? 'Loading…' : `Reward in ${Math.ceil(remaining)}s`}
            </span>
          )}
        </div>

        {/* Simulated video surface */}
        <div className="relative aspect-video overflow-hidden bg-gradient-to-br from-secondary to-background">
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
            <div
              className={`flex size-16 items-center justify-center rounded-2xl bg-primary/15 text-primary ${
                finished ? '' : 'animate-pulse'
              }`}
            >
              <Zap className="size-8" fill="currentColor" />
            </div>
            <p className="text-sm font-semibold text-foreground">
              {nativeMode
                ? 'Showing AdMob Rewarded Ad…'
                : finished
                  ? 'Ad finished — reward unlocked!'
                  : 'Your reward is playing…'}
            </p>
            <p className="max-w-[80%] text-center text-xs text-muted-foreground text-pretty">
              {nativeMode
                ? 'A real rewarded ad is playing on your device.'
                : 'Watch the full ad to earn your coins. Please don\u2019t close this window.'}
            </p>
          </div>

          {/* Fake player controls */}
          <div className="absolute bottom-2 left-2 flex items-center gap-2 rounded-md bg-background/50 px-2 py-1 text-[10px] text-muted-foreground backdrop-blur">
            <Volume2 className="size-3" />
            <span className="tabular-nums">
              {(AD_DURATION_SEC - remaining).toFixed(0)}s / {AD_DURATION_SEC}s
            </span>
          </div>
        </div>

        {/* Progress + action */}
        <div className="space-y-3 p-4">
          <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-100 ease-linear"
              style={{ width: `${nativeMode ? 100 : progress}%` }}
            />
          </div>

          <button
            onClick={handleClaim}
            disabled={!finished}
            className="w-full rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground transition enabled:hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {finished ? 'Claim Reward' : `Please wait ${Math.ceil(remaining)}s…`}
          </button>
        </div>
      </div>
    </div>
  )
}
