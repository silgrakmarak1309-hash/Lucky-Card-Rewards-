'use client'

import { useEffect, useState } from 'react'
import { Clock, Coins, Gift, Sparkles, Timer } from 'lucide-react'
import { AdModal } from '@/components/ad-modal'
import { useApp } from '@/components/app-provider'
import { DAILY_BONUS_COINS } from '@/lib/storage'

const CARD_COUNT = 6

type CardState = {
  id: number
  revealed: boolean
  reward: number | null
}

function freshBoard(): CardState[] {
  return Array.from({ length: CARD_COUNT }, (_, i) => ({
    id: i,
    revealed: false,
    reward: null,
  }))
}

type PendingAd =
  | { kind: 'card'; cardId: number }
  | { kind: 'daily' }
  | null

export function GameLobby() {
  const {
    user,
    cooldownUntil,
    beginAd,
    awardCardFlip,
    awardDailyBonus,
    canClaimDailyBonus,
  } = useApp()

  const [cards, setCards] = useState<CardState[]>(freshBoard)
  const [pendingAd, setPendingAd] = useState<PendingAd>(null)
  const [now, setNow] = useState(Date.now())
  const [lastWin, setLastWin] = useState<number | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  // tick for cooldown display
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(t)
  }, [])

  const cooldownRemaining = Math.max(0, cooldownUntil - now)
  const onCooldown = cooldownRemaining > 0

  // When cooldown finishes, reset the board for the next round.
  useEffect(() => {
    if (!onCooldown && cards.some((c) => c.revealed)) {
      const t = setTimeout(() => setCards(freshBoard()), 400)
      return () => clearTimeout(t)
    }
  }, [onCooldown, cards])

  const dailyAvailable = canClaimDailyBonus()

  const handleCardClick = (cardId: number) => {
    if (onCooldown) return
    if (pendingAd) return
    const card = cards.find((c) => c.id === cardId)
    if (!card || card.revealed) return
    // No coins are awarded here — the ad must play first.
    setNotice(null)
    setPendingAd({ kind: 'card', cardId })
  }

  const handleAdComplete = () => {
    const ad = pendingAd
    setPendingAd(null)
    if (!ad) return

    if (ad.kind === 'card') {
      // The provider verifies ad watch time + cooldown state-side before
      // granting any coins. A rejected result awards nothing.
      const res = awardCardFlip()
      if (!res.ok) {
        setNotice(res.reason ?? 'No coins awarded.')
        return
      }
      setLastWin(res.reward ?? 0)
      setCards((prev) =>
        prev.map((c) =>
          c.id === ad.cardId ? { ...c, revealed: true, reward: res.reward ?? 0 } : c,
        ),
      )
    } else if (ad.kind === 'daily') {
      const res = awardDailyBonus()
      if (!res.ok) {
        setNotice(res.reason ?? 'Bonus not awarded.')
        return
      }
      setLastWin(DAILY_BONUS_COINS)
    }
  }

  if (!user) return null

  return (
    <div className="mx-auto max-w-md px-4 pb-6 pt-4">
      {/* Greeting */}
      <div className="mb-4">
        <p className="text-sm text-muted-foreground">Welcome back,</p>
        <h2 className="font-heading text-xl font-bold text-foreground">{user.name}</h2>
      </div>

      {/* Daily bonus */}
      <section className="mb-5 flex items-center justify-between gap-3 rounded-2xl border border-border bg-gradient-to-r from-primary/15 to-transparent p-4">
        <div className="flex items-center gap-3">
          <span className="flex size-11 items-center justify-center rounded-xl bg-primary/20 text-primary">
            <Gift className="size-5" />
          </span>
          <div>
            <p className="text-sm font-semibold text-foreground">Daily Login Bonus</p>
            <p className="text-xs text-muted-foreground">
              Watch an ad, get {DAILY_BONUS_COINS} coins
            </p>
          </div>
        </div>
        <button
          onClick={() => {
            if (!dailyAvailable) return
            setNotice(null)
            setPendingAd({ kind: 'daily' })
          }}
          disabled={!dailyAvailable || !!pendingAd}
          className="shrink-0 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground transition enabled:hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {dailyAvailable ? 'Claim' : 'Claimed'}
        </button>
      </section>

      {/* Game header */}
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-1.5 font-heading text-base font-bold text-foreground">
          <Sparkles className="size-4 text-primary" />
          Pick a Lucky Card
        </h3>
        {onCooldown ? (
          <span className="flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-xs font-semibold text-muted-foreground">
            <Timer className="size-3.5" />
            {(cooldownRemaining / 1000).toFixed(0)}s
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">Win 1–3 coins</span>
        )}
      </div>

      {/* Cooldown banner */}
      {onCooldown && (
        <div className="mb-3 flex items-center gap-2 rounded-xl border border-border bg-card p-3 text-xs text-muted-foreground">
          <Clock className="size-4 text-primary" />
          Cooldown active — pick again in{' '}
          <span className="font-semibold text-foreground">
            {(cooldownRemaining / 1000).toFixed(0)}s
          </span>
          {lastWin != null && (
            <span className="ml-auto flex items-center gap-1 font-semibold text-primary">
              <Coins className="size-3.5" />+{lastWin}
            </span>
          )}
        </div>
      )}

      {/* Card grid */}
      <div className="grid grid-cols-3 gap-3">
        {cards.map((card) => (
          <button
            key={card.id}
            onClick={() => handleCardClick(card.id)}
            disabled={onCooldown || card.revealed || !!pendingAd}
            className={`group relative aspect-[3/4] overflow-hidden rounded-2xl border transition-all ${
              card.revealed
                ? 'border-primary bg-primary/10'
                : 'border-border bg-card enabled:hover:-translate-y-1 enabled:hover:border-primary/60'
            } disabled:cursor-not-allowed`}
            aria-label={card.revealed ? `Card won ${card.reward} coins` : 'Flip lucky card'}
          >
            {card.revealed ? (
              <div className="flex h-full flex-col items-center justify-center gap-1">
                <Coins className="size-7 text-primary" />
                <span className="text-lg font-extrabold tabular-nums text-foreground">
                  +{card.reward}
                </span>
              </div>
            ) : (
              <div className="flex h-full items-center justify-center">
                <div className="flex size-10 items-center justify-center rounded-xl bg-primary/15 text-primary transition group-enabled:group-hover:scale-110">
                  <Sparkles className="size-5" />
                </div>
              </div>
            )}
          </button>
        ))}
      </div>

      <p className="mt-4 text-center text-[11px] leading-relaxed text-muted-foreground">
        A 10-second rewarded ad plays before every flip. Coins are credited only after the
        ad finishes.
      </p>

      <AdModal
        open={!!pendingAd}
        title={pendingAd?.kind === 'daily' ? 'Daily Bonus Ad' : 'Lucky Card Ad'}
        onStart={beginAd}
        onComplete={handleAdComplete}
        onCancel={() => setPendingAd(null)}
      />
    </div>
  )
}
