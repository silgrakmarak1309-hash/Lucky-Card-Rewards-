'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import {
  ADMIN_EMAIL,
  AD_MIN_ELAPSED_MS,
  CARD_COOLDOWN_MS,
  DAILY_BONUS_COINS,
  WITHDRAWAL_COOLDOWN_MS,
  addWithdrawal,
  canSignIn,
  coinsToInr,
  evaluateAward,
  getSessionEmail,
  getUser,
  isSameDay,
  isValidUpiId,
  registerAccountOnDevice,
  saveUser,
  setSessionEmail,
  upsertUser,
  type UserProfile,
  type Withdrawal,
} from '@/lib/storage'

type Result = { ok: boolean; reason?: string }
type FlipResult = Result & { reward?: number }
type WithdrawResult = Result & { withdrawal?: Withdrawal }

type AppContextValue = {
  ready: boolean
  user: UserProfile | null
  cooldownUntil: number
  login: (email: string, name?: string) => Result
  logout: () => void
  /** Marks the moment a rewarded ad started — the state-side timer authority. */
  beginAd: () => void
  /** Grants a card-flip reward. Verifies ad watch time + cooldown state-side. */
  awardCardFlip: () => FlipResult
  /** Grants the daily bonus. Verifies ad watch time + once-per-day state-side. */
  awardDailyBonus: () => Result
  canClaimDailyBonus: () => boolean
  createWithdrawal: (upiId: string, coins: number) => WithdrawResult
}

const AppContext = createContext<AppContextValue | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false)
  const [user, setUser] = useState<UserProfile | null>(null)
  const [cooldownUntil, setCooldownUntil] = useState(0)

  // The ad-start timestamp lives outside React render state so it cannot be
  // trivially rewritten from the console mid-render. Coins are only granted
  // if enough REAL time has elapsed since beginAd().
  const adStartRef = useRef<number | null>(null)

  // Boot: hydrate the session from localStorage exactly once.
  useEffect(() => {
    const email = getSessionEmail()
    if (email) {
      const existing = getUser(email)
      if (existing) {
        setUser(existing)
        if (existing.lastFlipAt) {
          setCooldownUntil(existing.lastFlipAt + CARD_COOLDOWN_MS)
        }
      } else {
        setSessionEmail(null)
      }
    }
    setReady(true)
  }, [])

  const persist = useCallback((next: UserProfile) => {
    saveUser(next)
    setUser({ ...next })
  }, [])

  const login = useCallback((email: string, name?: string): Result => {
    const normalized = email.trim().toLowerCase()
    if (!normalized) return { ok: false, reason: 'Enter a valid email.' }

    // Anti-fraud: 1 account per device + block rapid re-signups.
    const check = canSignIn(normalized)
    if (!check.ok) return check

    const isNew = !getUser(normalized)
    const profile = upsertUser(normalized, name)
    if (isNew) registerAccountOnDevice(normalized)
    setSessionEmail(profile.email)
    setUser(profile)
    if (profile.lastFlipAt) setCooldownUntil(profile.lastFlipAt + CARD_COOLDOWN_MS)
    return { ok: true }
  }, [])

  const logout = useCallback(() => {
    setSessionEmail(null)
    setUser(null)
    setCooldownUntil(0)
    adStartRef.current = null
  }, [])

  const beginAd = useCallback(() => {
    adStartRef.current = Date.now()
  }, [])

  // Verifies the full ad duration elapsed, then clears the ticket so a single
  // ad can never be replayed for multiple rewards.
  const consumeAd = useCallback((): boolean => {
    const start = adStartRef.current
    adStartRef.current = null
    if (start == null) return false
    return Date.now() - start >= AD_MIN_ELAPSED_MS
  }, [])

  const awardCardFlip = useCallback((): FlipResult => {
    if (!user) return { ok: false, reason: 'Not signed in.' }

    // 1) Timer security — the ad must have actually played to completion.
    if (!consumeAd()) {
      return { ok: false, reason: 'Ad was not watched fully. No coins awarded.' }
    }

    // 2) Cooldown security — enforced from persisted state, not the UI.
    const now = Date.now()
    if (user.lastFlipAt && now - user.lastFlipAt < CARD_COOLDOWN_MS) {
      return { ok: false, reason: 'Cooldown still active.' }
    }

    // 3) Grant reward + run fraud velocity check.
    const reward = Math.floor(Math.random() * 3) + 1 // 1..3
    const fraud = evaluateAward(user, reward, now)
    const next: UserProfile = {
      ...user,
      coins: user.coins + reward,
      totalFlips: user.totalFlips + 1,
      totalAdsWatched: user.totalAdsWatched + 1,
      lastFlipAt: now,
      recentAwards: fraud.recentAwards,
      flagged: fraud.flagged,
      flagReason: fraud.flagReason,
    }
    persist(next)
    setCooldownUntil(now + CARD_COOLDOWN_MS)
    return { ok: true, reward }
  }, [user, consumeAd, persist])

  const canClaimDailyBonus = useCallback(() => {
    if (!user) return false
    if (!user.lastDailyBonus) return true
    return !isSameDay(user.lastDailyBonus, Date.now())
  }, [user])

  const awardDailyBonus = useCallback((): Result => {
    if (!user) return { ok: false, reason: 'Not signed in.' }
    if (!consumeAd()) {
      return { ok: false, reason: 'Ad was not watched fully. No bonus awarded.' }
    }
    if (user.lastDailyBonus && isSameDay(user.lastDailyBonus, Date.now())) {
      return { ok: false, reason: 'Daily bonus already claimed today.' }
    }
    const now = Date.now()
    const fraud = evaluateAward(user, DAILY_BONUS_COINS, now)
    const next: UserProfile = {
      ...user,
      coins: user.coins + DAILY_BONUS_COINS,
      lastDailyBonus: now,
      totalAdsWatched: user.totalAdsWatched + 1,
      recentAwards: fraud.recentAwards,
      flagged: fraud.flagged,
      flagReason: fraud.flagReason,
    }
    persist(next)
    return { ok: true }
  }, [user, consumeAd, persist])

  const createWithdrawal = useCallback(
    (upiId: string, coins: number): WithdrawResult => {
      if (!user) return { ok: false, reason: 'Not signed in.' }

      // Block flagged accounts from any automated payout.
      if (user.flagged) {
        return {
          ok: false,
          reason: 'Your account is under review for unusual activity.',
        }
      }

      // Mandatory ad verification (state-side timer).
      if (!consumeAd()) {
        return { ok: false, reason: 'Ad was not watched fully. Request cancelled.' }
      }

      // UPI format.
      if (!isValidUpiId(upiId)) {
        return { ok: false, reason: 'Enter a valid UPI ID (must contain @).' }
      }

      // 1 request / 24h.
      const now = Date.now()
      if (user.lastWithdrawalAt && now - user.lastWithdrawalAt < WITHDRAWAL_COOLDOWN_MS) {
        const hrs = Math.ceil(
          (WITHDRAWAL_COOLDOWN_MS - (now - user.lastWithdrawalAt)) / 3_600_000,
        )
        return {
          ok: false,
          reason: `Only 1 withdrawal per 24h. Try again in ~${hrs}h.`,
        }
      }

      if (coins > user.coins) return { ok: false, reason: 'Insufficient coins.' }

      const w: Withdrawal = {
        id: `wd_${now}_${Math.random().toString(36).slice(2, 8)}`,
        email: user.email,
        upiId: upiId.trim(),
        coins,
        amountInr: coinsToInr(coins),
        status: 'pending',
        createdAt: now,
      }
      addWithdrawal(w)
      persist({ ...user, coins: user.coins - coins, lastWithdrawalAt: now })
      return { ok: true, withdrawal: w }
    },
    [user, consumeAd, persist],
  )

  const value = useMemo<AppContextValue>(
    () => ({
      ready,
      user,
      cooldownUntil,
      login,
      logout,
      beginAd,
      awardCardFlip,
      awardDailyBonus,
      canClaimDailyBonus,
      createWithdrawal,
    }),
    [
      ready,
      user,
      cooldownUntil,
      login,
      logout,
      beginAd,
      awardCardFlip,
      awardDailyBonus,
      canClaimDailyBonus,
      createWithdrawal,
    ],
  )

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}

export { ADMIN_EMAIL }
