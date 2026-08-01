'use client'

import { LayoutGrid, ShieldCheck, Wallet } from 'lucide-react'
import { useApp } from '@/components/app-provider'
import type { View } from '@/components/app-shell'

const baseTabs: { view: View; label: string; icon: typeof LayoutGrid }[] = [
  { view: 'lobby', label: 'Games', icon: LayoutGrid },
  { view: 'wallet', label: 'Wallet', icon: Wallet },
]

export function BottomNav({
  current,
  onNavigate,
}: {
  current: View
  onNavigate: (view: View) => void
}) {
  const { user } = useApp()
  const tabs = [...baseTabs]
  if (user?.isAdmin) {
    tabs.push({ view: 'admin', label: 'Admin', icon: ShieldCheck })
  }

  return (
    <nav className="sticky bottom-0 z-30 border-t border-border bg-background/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-md items-stretch justify-around px-2 py-1.5">
        {tabs.map(({ view, label, icon: Icon }) => {
          const active = current === view
          return (
            <button
              key={view}
              onClick={() => onNavigate(view)}
              className={`flex flex-1 flex-col items-center gap-1 rounded-lg py-2 text-xs font-medium transition ${
                active
                  ? 'text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              aria-current={active ? 'page' : undefined}
            >
              <Icon className={`size-5 ${active ? 'scale-110' : ''} transition-transform`} />
              {label}
            </button>
          )
        })}
      </div>
    </nav>
  )
}
