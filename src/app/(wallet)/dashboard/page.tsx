/**
 * Dashboard page — Server Component.
 *
 * Architecture: App Router Server Component by default (no 'use client').
 * Interactive sub-trees are isolated in DashboardActions (Client Component).
 * Static sections (RecentActivity, section headings) render on the server.
 *
 * Sprint 1: structural shell only. No wallet logic, no crypto, no RPC.
 */

import type { Metadata } from 'next'
import { Activity } from 'lucide-react'
import { PageContainer } from '@/components/layout/PageContainer'
import { DASHBOARD } from '@/config/strings'
import { BalanceCard, QuickActionsGrid } from './_components/DashboardActions'

// ─── Recent Activity (static — Server Component) ───────────────────────────

function RecentActivity() {
  return (
    <div className="rounded-xl border border-[hsl(var(--border))] bg-surface">
      <div className="flex items-center justify-between border-b border-[hsl(var(--border))] px-5 py-4">
        <h2 className="text-sm font-semibold text-[hsl(var(--foreground))]">
          {DASHBOARD.recentActivity}
        </h2>
        <span className="text-xs text-[hsl(var(--muted))]">QoreChain Devnet</span>
      </div>

      {/* Empty state */}
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-surface-subtle">
          <Activity className="h-5 w-5 text-[hsl(var(--muted))]" aria-hidden="true" />
        </div>
        <p className="text-sm font-medium text-[hsl(var(--foreground))]">{DASHBOARD.noActivity}</p>
        <p className="mt-1 max-w-xs text-xs text-[hsl(var(--muted))]">
          {DASHBOARD.noActivityDescription}
        </p>
      </div>
    </div>
  )
}

// ─── Page ──────────────────────────────────────────────────────────────────

export const metadata: Metadata = {
  title: 'Dashboard | XQ Wallet',
}

export default function DashboardPage() {
  return (
    <PageContainer>
      <div className="space-y-6">
        {/* Client island: balance + create wallet CTA */}
        <BalanceCard />

        {/* Quick actions — client island (stub onClick handlers) */}
        <section aria-labelledby="quick-actions-heading">
          <h2
            id="quick-actions-heading"
            className="mb-3 text-xs font-semibold uppercase tracking-wider text-[hsl(var(--muted))]"
          >
            {DASHBOARD.quickActions}
          </h2>
          <QuickActionsGrid />
        </section>

        {/* Recent activity — static, no client JS needed */}
        <RecentActivity />
      </div>
    </PageContainer>
  )
}
