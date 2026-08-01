'use client'

import { useEffect, useState } from 'react'
import { AdminPage } from '@/components/admin-page'
import { AppHeader } from '@/components/app-header'
import { BottomNav } from '@/components/bottom-nav'
import { GameLobby } from '@/components/game-lobby'
import { LoginScreen } from '@/components/login-screen'
import { useApp } from '@/components/app-provider'
import { WalletPage } from '@/components/wallet-page'
import { initializeAdMob } from '@/lib/admob'

export type View = 'lobby' | 'wallet' | 'admin'

export function AppShell() {
  const { ready, user } = useApp()
  const [view, setView] = useState<View>('lobby')

  // Initialize AdMob once (no-op on the web preview).
  useEffect(() => {
    initializeAdMob()
  }, [])

  // Keep the view valid when auth state changes.
  useEffect(() => {
    if (!user) setView('lobby')
    else if (view === 'admin' && !user.isAdmin) setView('lobby')
  }, [user, view])

  // Avoid a hydration flash while reading localStorage.
  if (!ready) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <div className="size-8 animate-spin rounded-full border-2 border-border border-t-primary" />
      </div>
    )
  }

  if (!user) return <LoginScreen />

  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader onNavigate={setView} />
      <main className="flex-1">
        {view === 'lobby' && <GameLobby />}
        {view === 'wallet' && <WalletPage />}
        {view === 'admin' && <AdminPage />}
      </main>
      <BottomNav current={view} onNavigate={setView} />
    </div>
  )
}
