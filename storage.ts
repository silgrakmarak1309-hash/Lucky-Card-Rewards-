/**
 * lib/storage.ts
 * ------------------------------------------------------------------
 * Fully offline persistence layer built on localStorage.
 *
 * Every read is wrapped in try/catch and returns a safe default so the
 * app can never hang or crash on boot — even if localStorage is
 * unavailable (private mode), empty, or contains corrupted JSON.
 * ------------------------------------------------------------------
 */

export const ADMIN_EMAIL = 'grejamarak@gmail.com'

// Economy constants
export const COINS_PER_RUPEE_BLOCK = 2000 // 2,000 coins
export const RUPEES_PER_BLOCK = 10 // = ₹10
export const MIN_WITHDRAW_COINS = 2000
export const DAILY_BONUS_COINS = 10
export const CARD_COOLDOWN_MS = 15_000 // 15s cooldown after a flip
export const AD_DURATION_SEC = 10 // 10s simulated ad
export const AD_DURATION_MS = AD_DURATION_SEC * 1000

// ---- Anti-fraud / security constants -----------------------------
// The ad reward is only granted if AT LEAST this much real time has
// elapsed since the ad started. Small tolerance for timer jitter.
export const AD_MIN_ELAPSED_MS = AD_DURATION_MS - 300
// Block rapid multiple account sign-ups from the same device.
export const SIGNUP_COOLDOWN_MS = 30_000
// Max one withdrawal request per user per 24 hours.
export const WITHDRAWAL_COOLDOWN_MS = 24 * 60 * 60 * 1000
// Fraud velocity: flag accounts that earn too many coins too quickly.
export const FRAUD_WINDOW_MS = 60_000
export const FRAUD_MAX_COINS_PER_WINDOW = 60

export type CoinAward = { t: number; amount: number }

export type UserProfile = {
  email: string
  name: string
  isAdmin: boolean
  coins: number
  createdAt: number
  lastDailyBonus: number | null // timestamp of last claimed daily bonus
  totalFlips: number
  totalAdsWatched: number
  // Security / anti-fraud fields
  lastFlipAt: number | null // state-side cooldown authority
  lastWithdrawalAt: number | null // 24h withdrawal rate limit
  flagged: boolean // fraud-flagged account
  flagReason: string | null
  recentAwards: CoinAward[] // rolling window for velocity checks
}

export type DeviceRegistry = {
  deviceId: string
  accounts: string[] // emails created on this device
  lastSignupAt: number | null
}

export type Withdrawal = {
  id: string
  email: string
  upiId: string
  coins: number
  amountInr: number
  status: 'pending' | 'approved' | 'rejected'
  createdAt: number
}

const KEYS = {
  session: 'lucky_cards_session', // current logged-in email
  users: 'lucky_cards_users', // Record<email, UserProfile>
  withdrawals: 'lucky_cards_withdrawals', // Withdrawal[]
  device: 'lucky_cards_device', // DeviceRegistry — 1 account per device
} as const

function genId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
}

function safeGet<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw) as T
  } catch (err) {
    console.log('[v0] storage read failed for', key, err)
    return fallback
  }
}

function safeSet(key: string, value: unknown): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch (err) {
    console.log('[v0] storage write failed for', key, err)
  }
}

// ---- Users -------------------------------------------------------

/** Backfill any missing fields so profiles saved by older builds never crash. */
function normalizeUser(u: Partial<UserProfile> & { email: string }): UserProfile {
  return {
    email: u.email,
    name: u.name ?? u.email.split('@')[0],
    isAdmin: u.isAdmin ?? u.email === ADMIN_EMAIL,
    coins: typeof u.coins === 'number' ? u.coins : 0,
    createdAt: u.createdAt ?? Date.now(),
    lastDailyBonus: u.lastDailyBonus ?? null,
    totalFlips: u.totalFlips ?? 0,
    totalAdsWatched: u.totalAdsWatched ?? 0,
    lastFlipAt: u.lastFlipAt ?? null,
    lastWithdrawalAt: u.lastWithdrawalAt ?? null,
    flagged: u.flagged ?? false,
    flagReason: u.flagReason ?? null,
    recentAwards: Array.isArray(u.recentAwards) ? u.recentAwards : [],
  }
}

export function getAllUsers(): Record<string, UserProfile> {
  const raw = safeGet<Record<string, Partial<UserProfile> & { email: string }>>(
    KEYS.users,
    {},
  )
  const out: Record<string, UserProfile> = {}
  for (const [key, value] of Object.entries(raw)) {
    if (value && typeof value === 'object' && value.email) {
      out[key] = normalizeUser(value)
    }
  }
  return out
}

export function getUser(email: string): UserProfile | null {
  const users = getAllUsers()
  return users[email.toLowerCase()] ?? null
}

export function saveUser(user: UserProfile): void {
  const users = getAllUsers()
  users[user.email.toLowerCase()] = user
  safeSet(KEYS.users, users)
}

export function upsertUser(email: string, name?: string): UserProfile {
  const normalized = email.trim().toLowerCase()
  const existing = getUser(normalized)
  if (existing) return existing
  const profile: UserProfile = {
    email: normalized,
    name: name?.trim() || normalized.split('@')[0],
    isAdmin: normalized === ADMIN_EMAIL,
    coins: 0,
    createdAt: Date.now(),
    lastDailyBonus: null,
    totalFlips: 0,
    totalAdsWatched: 0,
    lastFlipAt: null,
    lastWithdrawalAt: null,
    flagged: false,
    flagReason: null,
    recentAwards: [],
  }
  saveUser(profile)
  return profile
}

// ---- Device registry (1 account per device) ---------------------

export function getDeviceRegistry(): DeviceRegistry {
  const existing = safeGet<DeviceRegistry | null>(KEYS.device, null)
  if (existing && existing.deviceId) {
    return {
      deviceId: existing.deviceId,
      accounts: Array.isArray(existing.accounts) ? existing.accounts : [],
      lastSignupAt: existing.lastSignupAt ?? null,
    }
  }
  const fresh: DeviceRegistry = {
    deviceId: genId('dev'),
    accounts: [],
    lastSignupAt: null,
  }
  safeSet(KEYS.device, fresh)
  return fresh
}

function saveDeviceRegistry(reg: DeviceRegistry): void {
  safeSet(KEYS.device, reg)
}

export type SignupCheck = { ok: boolean; reason?: string }

/**
 * Enforces "1 account per device" and blocks rapid multiple sign-ups.
 * The admin account can always sign in. Existing accounts on this device
 * can always sign back in (this is a login, not a new account).
 */
export function canSignIn(email: string): SignupCheck {
  const normalized = email.trim().toLowerCase()
  if (normalized === ADMIN_EMAIL) return { ok: true }

  const reg = getDeviceRegistry()

  // Returning user on the same device — always allowed.
  if (reg.accounts.includes(normalized)) return { ok: true }
  if (getUser(normalized)) return { ok: true }

  // A different account already exists on this device.
  if (reg.accounts.length >= 1) {
    return {
      ok: false,
      reason:
        'Only one account is allowed per device. Log in with your existing account.',
    }
  }

  // Block rapid multiple sign-ups from the same device.
  if (reg.lastSignupAt && Date.now() - reg.lastSignupAt < SIGNUP_COOLDOWN_MS) {
    const wait = Math.ceil((SIGNUP_COOLDOWN_MS - (Date.now() - reg.lastSignupAt)) / 1000)
    return { ok: false, reason: `Too many sign-up attempts. Try again in ${wait}s.` }
  }

  return { ok: true }
}

/** Records a newly created account against this device. */
export function registerAccountOnDevice(email: string): void {
  const normalized = email.trim().toLowerCase()
  if (normalized === ADMIN_EMAIL) return
  const reg = getDeviceRegistry()
  if (!reg.accounts.includes(normalized)) reg.accounts.push(normalized)
  reg.lastSignupAt = Date.now()
  saveDeviceRegistry(reg)
}

// ---- Session -----------------------------------------------------

export function getSessionEmail(): string | null {
  return safeGet<string | null>(KEYS.session, null)
}

export function setSessionEmail(email: string | null): void {
  safeSet(KEYS.session, email)
}

// ---- Withdrawals -------------------------------------------------

export function getWithdrawals(): Withdrawal[] {
  return safeGet<Withdrawal[]>(KEYS.withdrawals, [])
}

export function addWithdrawal(w: Withdrawal): void {
  const list = getWithdrawals()
  list.unshift(w)
  safeSet(KEYS.withdrawals, list)
}

// ---- Helpers -----------------------------------------------------

export function coinsToInr(coins: number): number {
  return Math.floor(coins / COINS_PER_RUPEE_BLOCK) * RUPEES_PER_BLOCK
}

/** UPI IDs must contain '@' and follow a basic handle@provider shape. */
export function isValidUpiId(value: string): boolean {
  const upi = value.trim()
  if (!upi.includes('@')) return false
  return /^[\w.\-]{2,}@[a-zA-Z]{2,}$/.test(upi)
}

/**
 * Appends a coin award to the rolling window and decides whether the
 * account should be fraud-flagged for earning coins abnormally fast.
 */
export function evaluateAward(
  profile: UserProfile,
  amount: number,
  now = Date.now(),
): { recentAwards: CoinAward[]; flagged: boolean; flagReason: string | null } {
  const recentAwards = [...profile.recentAwards, { t: now, amount }].filter(
    (a) => now - a.t <= FRAUD_WINDOW_MS,
  )
  const sum = recentAwards.reduce((s, a) => s + a.amount, 0)
  if (!profile.flagged && sum > FRAUD_MAX_COINS_PER_WINDOW) {
    return {
      recentAwards,
      flagged: true,
      flagReason: `Earned ${sum} coins in under ${FRAUD_WINDOW_MS / 1000}s`,
    }
  }
  return { recentAwards, flagged: profile.flagged, flagReason: profile.flagReason }
}

export function isSameDay(a: number, b: number): boolean {
  const da = new Date(a)
  const db = new Date(b)
  return (
    da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() &&
    da.getDate() === db.getDate()
  )
}
