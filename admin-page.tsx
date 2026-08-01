'use client'

import { useMemo } from 'react'
import { Coins, ShieldCheck, Users, Wallet } from 'lucide-react'
import { useApp } from '@/components/app-provider'
import { getAllUsers, getWithdrawals } from '@/lib/storage'

export function AdminPage() {
  const { user } = useApp()

  const { users, withdrawals, totalCoins, pending } = useMemo(() => {
    const usersRec = getAllUsers()
    const usersArr = Object.values(usersRec)
    const wd = getWithdrawals()
    return {
      users: usersArr,
      withdrawals: wd,
      totalCoins: usersArr.reduce((sum, u) => sum + u.coins, 0),
      pending: wd.filter((w) => w.status === 'pending').length,
    }
  }, [])

  if (!user?.isAdmin) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center text-sm text-muted-foreground">
        Admin access only.
      </div>
    )
  }

  const stats = [
    { label: 'Users', value: users.length, icon: Users },
    { label: 'Coins in circulation', value: totalCoins.toLocaleString(), icon: Coins },
    { label: 'Pending payouts', value: pending, icon: Wallet },
  ]

  return (
    <div className="mx-auto max-w-md px-4 pb-6 pt-4">
      <h2 className="mb-4 flex items-center gap-2 font-heading text-xl font-bold text-foreground">
        <ShieldCheck className="size-5 text-primary" />
        Admin Dashboard
      </h2>

      <div className="mb-6 grid grid-cols-3 gap-3">
        {stats.map(({ label, value, icon: Icon }) => (
          <div key={label} className="rounded-2xl border border-border bg-card p-3">
            <Icon className="mb-2 size-4 text-primary" />
            <p className="text-lg font-bold tabular-nums text-foreground">{value}</p>
            <p className="text-[11px] leading-tight text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>

      <section className="mb-6">
        <h3 className="mb-3 text-sm font-bold text-foreground">All Users</h3>
        <ul className="space-y-2">
          {users.map((u) => (
            <li
              key={u.email}
              className="flex items-center justify-between rounded-xl border border-border bg-card p-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">{u.email}</p>
                <p className="text-[11px] text-muted-foreground">
                  {u.totalFlips} flips · {u.totalAdsWatched} ads
                </p>
              </div>
              <span className="flex shrink-0 items-center gap-1 text-sm font-bold tabular-nums text-primary">
                <Coins className="size-3.5" />
                {u.coins.toLocaleString()}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h3 className="mb-3 text-sm font-bold text-foreground">Withdrawal Requests</h3>
        {withdrawals.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
            No withdrawal requests yet.
          </p>
        ) : (
          <ul className="space-y-2">
            {withdrawals.map((w) => (
              <li
                key={w.id}
                className="flex items-center justify-between rounded-xl border border-border bg-card p-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">
                    {w.email}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    ₹{w.amountInr} → {w.upiId}
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-primary/15 px-2.5 py-1 text-[11px] font-semibold capitalize text-primary">
                  {w.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
