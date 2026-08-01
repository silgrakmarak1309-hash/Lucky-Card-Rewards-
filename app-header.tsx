'use client'

import { useEffect, useRef, useState } from 'react'
import { Coins, LogOut, ShieldCheck, User, Wallet } from 'lucide-react'
import { useApp } from '@/components/app-provider'
import type { View } from '@/components/app-shell'

export function AppHeader({
  onNavigate,
}: {
  onNavigate: (view: View) => void
}) {
  const { user, logout } = useApp()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menuOpen) return
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [menuOpen])

  if (!user) return null

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-md items-center justify-between px-4">
        {/* Top-left: wallet balance */}
        <button
          onClick={() => onNavigate('wallet')}
          className="flex items-center gap-2 rounded-full border border-border bg-card py-1.5 pl-2 pr-3 transition hover:border-primary/60"
          aria-label="Open wallet"
        >
          <span className="flex size-7 items-center justify-center rounded-full bg-primary/15 text-primary">
            <Wallet className="size-4" />
          </span>
          <span className="flex items-center gap-1 text-sm font-bold tabular-nums text-foreground">
            <Coins className="size-3.5 text-primary" />
            {user.coins.toLocaleString()}
          </span>
        </button>

        {/* Top-right: profile */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="flex size-9 items-center justify-center rounded-full border border-border bg-card text-foreground transition hover:border-primary/60"
            aria-label="Open profile menu"
            aria-expanded={menuOpen}
          >
            <User className="size-4" />
          </button>

          {menuOpen && (
            <div className="absolute right-0 mt-2 w-60 overflow-hidden rounded-xl border border-border bg-popover shadow-2xl">
              <div className="border-b border-border p-4">
                <p className="text-xs text-muted-foreground">Signed in as</p>
                <p className="truncate text-sm font-semibold text-foreground">
                  {user.email}
                </p>
                {user.isAdmin && (
                  <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                    <ShieldCheck className="size-3" />
                    Admin
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-px bg-border">
                <div className="bg-popover p-3 text-center">
                  <p className="text-base font-bold tabular-nums text-foreground">
                    {user.totalFlips}
                  </p>
                  <p className="text-[11px] text-muted-foreground">Flips</p>
                </div>
                <div className="bg-popover p-3 text-center">
                  <p className="text-base font-bold tabular-nums text-foreground">
                    {user.totalAdsWatched}
                  </p>
                  <p className="text-[11px] text-muted-foreground">Ads watched</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setMenuOpen(false)
                  logout()
                }}
                className="flex w-full items-center gap-2 border-t border-border px-4 py-3 text-sm font-medium text-destructive transition hover:bg-destructive/10"
              >
                <LogOut className="size-4" />
                Log out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
