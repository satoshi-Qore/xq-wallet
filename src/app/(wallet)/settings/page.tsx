/**
 * Settings page — stub for Sprint 1.
 * Full implementation in Sprint 2: theme picker, auto-lock, network selector, currency.
 */

import type { Metadata } from 'next'
import { Settings } from 'lucide-react'
import { PageContainer } from '@/components/layout/PageContainer'
import { STUBS } from '@/config/strings'

export const metadata: Metadata = { title: 'Settings | XQ Wallet' }

export default function SettingsPage() {
  return (
    <PageContainer>
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-brand-50 dark:bg-brand-950">
          <Settings className="h-7 w-7 text-brand-600 dark:text-brand-400" aria-hidden="true" />
        </div>
        {/* P0-01: hsl() for foreground/muted, bg-surface-subtle */}
        <h1 className="text-xl font-bold text-[hsl(var(--foreground))]">{STUBS.settings.title}</h1>
        <p className="mt-2 max-w-sm text-sm text-[hsl(var(--muted))]">
          {STUBS.settings.description}
        </p>
        <span className="mt-4 inline-flex items-center rounded-full bg-surface-subtle px-3 py-1 text-xs font-medium text-[hsl(var(--muted))]">
          {STUBS.comingSoon}
        </span>
      </div>
    </PageContainer>
  )
}
