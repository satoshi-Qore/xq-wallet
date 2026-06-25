'use client'

/**
 * DashboardActions — Client Component island for interactive dashboard elements.
 *
 * Why client? Next.js App Router Server Components cannot pass event handlers
 * to rendered output. BalanceCard and QuickActionCard contain onClick handlers
 * (stub behaviour for Sprint 1) so they must live in a Client Component.
 *
 * Architecture principle: push the client boundary as deep as possible.
 * Everything else in dashboard/page.tsx remains a Server Component.
 *
 * Sprint 2: replace stub onClick handlers with real navigation / wallet logic.
 */

import type { ElementType } from 'react'
import { ArrowUpRight, ArrowDownLeft, Clock, Wallet } from 'lucide-react'
import { cn } from '@/lib/utils'
import { DASHBOARD } from '@/config/strings'

// ─── Balance Card ──────────────────────────────────────────────────────────

export function BalanceCard() {
  return (
    <div className="rounded-xl border border-[hsl(var(--border))] bg-surface p-6">
      <p className="text-xs font-medium uppercase tracking-wider text-[hsl(var(--muted))]">
        {DASHBOARD.balanceLabel}
      </p>
      <p className="mt-2 font-mono text-4xl font-bold tracking-tight text-[hsl(var(--foreground))]">
        {DASHBOARD.balancePlaceholder}
      </p>
      <p className="mt-3 text-sm text-[hsl(var(--muted))]">{DASHBOARD.connectPrompt}</p>

      {/* Sprint 1 stub: disabled until wallet creation is implemented (Sprint 2) */}
      <button
        type="button"
        disabled
        aria-disabled="true"
        className="mt-5 inline-flex cursor-not-allowed items-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white opacity-50"
        title="Wallet creation coming in Sprint 2"
      >
        <Wallet className="h-4 w-4" aria-hidden="true" />
        Create Wallet
      </button>
    </div>
  )
}

// ─── Quick Action Card ─────────────────────────────────────────────────────

interface QuickActionProps {
  icon: ElementType
  label: string
  description: string
}

function QuickActionCard({ icon: Icon, label, description }: QuickActionProps) {
  return (
    <button
      type="button"
      disabled
      aria-disabled="true"
      title="Available after wallet setup"
      className={cn(
        'group flex cursor-not-allowed flex-col items-start gap-2 rounded-xl p-4 text-left',
        'border border-[hsl(var(--border))] bg-surface',
        'opacity-50 transition-colors',
      )}
    >
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 dark:bg-brand-950">
        <Icon className="h-4 w-4 text-brand-600 dark:text-brand-400" aria-hidden="true" />
      </div>
      <div>
        <p className="text-sm font-medium text-[hsl(var(--foreground))]">{label}</p>
        <p className="text-xs text-[hsl(var(--muted))]">{description}</p>
      </div>
    </button>
  )
}

// ─── Quick Actions Grid ────────────────────────────────────────────────────

const QUICK_ACTIONS: QuickActionProps[] = [
  { icon: ArrowUpRight, label: 'Send', description: 'Send XQ to any address' },
  { icon: ArrowDownLeft, label: 'Receive', description: 'Share your QR code' },
  { icon: Clock, label: 'History', description: 'View all transactions' },
]

export function QuickActionsGrid() {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {QUICK_ACTIONS.map((action) => (
        <QuickActionCard key={action.label} {...action} />
      ))}
    </div>
  )
}
