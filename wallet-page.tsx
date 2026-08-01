'use client'

import { useMemo, useState } from 'react'
import { ArrowDownToLine, CheckCircle2, Coins, IndianRupee, Wallet } from 'lucide-react'
import { AdModal } from '@/components/ad-modal'
import { useApp } from '@/components/app-provider'
import {
  COINS_PER_RUPEE_BLOCK,
  MIN_WITHDRAW_COINS,
  RUPEES_PER_BLOCK,
  coinsToInr,
  getWithdrawals,
  type Withdrawal,
} from '@/lib/storage'

export function WalletPage() {
  const { user, createWithdrawal } = useApp()
  const [upiId, setUpiId] = useState('')
  const [amountCoins, setAmountCoins] = useState('')
  const [error, setError] = useState('')
  const [adOpen, setAdOpen] = useState(false)
  const [success, setSuccess] = useState<Withdrawal | null>(null)
  const [refresh, setRefresh] = useState(0)

  const history = useMemo(() => {
    if (!user) return []
    // refresh dependency intentionally re-reads after a new withdrawal
    void refresh
    return getWithdrawals().filter((w) => w.email === user.email)
  }, [user, refresh])

  if (!user) return null

  const coins = user.coins
  const inrValue = coinsToInr(coins)
  const canWithdraw = coins >= MIN_WITHDRAW_COINS

  const validate = (): number | null => {
    setError('')
    const upi = upiId.trim()
    if (!/^[\w.\-]{2,}@[a-zA-Z]{2,}$/.test(upi)) {
      setError('Enter a valid UPI ID (e.g. name@bank).')
      return null
    }
    const value = Number.parseInt(amountCoins, 10)
    if (!Number.isFinite(value) || value <= 0) {
      setError('Enter the number of coins to withdraw.')
      return null
    }
    if (value < MIN_WITHDRAW_COINS) {
      setError(`Minimum withdrawal is ${MIN_WITHDRAW_COINS.toLocaleString()} coins.`)
      return null
    }
    if (value > coins) {
      setError('You don\u2019t have enough coins.')
      return null
    }
    if (value % COINS_PER_RUPEE_BLOCK !== 0) {
      setError(
        `Withdraw in multiples of ${COINS_PER_RUPEE_BLOCK.toLocaleString()} coins.`,
      )
      return null
    }
    return value
  }

  const handleSubmit = () => {
    const value = validate()
    if (value == null) return
    // Mandatory ad before the withdrawal request is submitted.
    setAdOpen(true)
  }

  const handleAdComplete = () => {
    setAdOpen(false)
    const value = Number.parseInt(amountCoins, 10)
    const created = createWithdrawal(upiId, value)
    if (created) {
      setSuccess(created)
      setUpiId('')
      setAmountCoins('')
      setRefresh((r) => r + 1)
    } else {
      setError('Could not process withdrawal. Please try again.')
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 pb-6 pt-4">
      <h2 className="mb-4 flex items-center gap-2 font-heading text-xl font-bold text-foreground">
        <Wallet className="size-5 text-primary" />
        Wallet
      </h2>

      {/* Balance card */}
      <section className="mb-5 rounded-2xl border border-border bg-gradient-to-br from-primary/20 to-card p-5">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Coin Balance
        </p>
        <div className="mt-1 flex items-center gap-2">
          <Coins className="size-7 text-primary" />
          <span className="text-3xl font-extrabold tabular-nums text-foreground">
            {coins.toLocaleString()}
          </span>
        </div>
        <div className="mt-3 flex items-center gap-1 text-sm text-muted-foreground">
          <span>Redeemable value:</span>
          <span className="flex items-center font-semibold text-foreground">
            <IndianRupee className="size-3.5" />
            {inrValue}
          </span>
        </div>
        <p className="mt-3 rounded-lg bg-background/40 px-3 py-2 text-[11px] text-muted-foreground">
          Conversion rate: {COINS_PER_RUPEE_BLOCK.toLocaleString()} coins = ₹
          {RUPEES_PER_BLOCK} · Minimum withdrawal {MIN_WITHDRAW_COINS.toLocaleString()}{' '}
          coins
        </p>
      </section>

      {/* Success banner */}
      {success && (
        <div className="mb-5 flex items-start gap-3 rounded-2xl border border-primary/40 bg-primary/10 p-4">
          <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-primary" />
          <div className="text-sm">
            <p className="font-semibold text-foreground">Withdrawal requested!</p>
            <p className="text-muted-foreground">
              ₹{success.amountInr} to{' '}
              <span className="font-medium text-foreground">{success.upiId}</span> is now
              pending.
            </p>
          </div>
        </div>
      )}

      {/* Withdraw form */}
      <section className="mb-6 space-y-4 rounded-2xl border border-border bg-card p-5">
        <h3 className="flex items-center gap-2 text-sm font-bold text-foreground">
          <ArrowDownToLine className="size-4 text-primary" />
          Withdraw to UPI
        </h3>

        <div className="space-y-2">
          <label htmlFor="upi" className="text-xs font-medium text-muted-foreground">
            UPI ID
          </label>
          <input
            id="upi"
            value={upiId}
            onChange={(e) => setUpiId(e.target.value)}
            placeholder="yourname@bank"
            className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="amount" className="text-xs font-medium text-muted-foreground">
            Coins to withdraw
          </label>
          <input
            id="amount"
            type="number"
            inputMode="numeric"
            value={amountCoins}
            onChange={(e) => setAmountCoins(e.target.value)}
            placeholder={`Min ${MIN_WITHDRAW_COINS}`}
            className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring"
          />
          {amountCoins && Number.parseInt(amountCoins, 10) > 0 && (
            <p className="text-[11px] text-muted-foreground">
              ≈ ₹{coinsToInr(Number.parseInt(amountCoins, 10) || 0)}
            </p>
          )}
        </div>

        {error && <p className="text-xs text-destructive">{error}</p>}

        <button
          onClick={handleSubmit}
          disabled={!canWithdraw}
          className="w-full rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground transition enabled:hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {canWithdraw
            ? 'Watch Ad & Withdraw'
            : `Reach ${MIN_WITHDRAW_COINS.toLocaleString()} coins to withdraw`}
        </button>
        <p className="text-center text-[11px] text-muted-foreground">
          A rewarded ad must play before your withdrawal is submitted.
        </p>
      </section>

      {/* History */}
      <section>
        <h3 className="mb-3 text-sm font-bold text-foreground">Withdrawal History</h3>
        {history.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
            No withdrawals yet. Your requests will appear here.
          </p>
        ) : (
          <ul className="space-y-2">
            {history.map((w) => (
              <li
                key={w.id}
                className="flex items-center justify-between rounded-xl border border-border bg-card p-3"
              >
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    ₹{w.amountInr}{' '}
                    <span className="text-xs font-normal text-muted-foreground">
                      · {w.coins.toLocaleString()} coins
                    </span>
                  </p>
                  <p className="text-[11px] text-muted-foreground">{w.upiId}</p>
                </div>
                <span
                  className={`rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize ${
                    w.status === 'approved'
                      ? 'bg-accent/20 text-accent'
                      : w.status === 'rejected'
                        ? 'bg-destructive/15 text-destructive'
                        : 'bg-primary/15 text-primary'
                  }`}
                >
                  {w.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <AdModal
        open={adOpen}
        title="Withdrawal Ad"
        onComplete={handleAdComplete}
        onCancel={() => setAdOpen(false)}
      />
    </div>
  )
}
