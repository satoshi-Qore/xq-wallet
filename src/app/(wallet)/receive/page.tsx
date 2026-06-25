/**
 * Receive page — stub for Sprint 1.
 * Full implementation in Sprint 2: QR code display, address copy.
 */

import type { Metadata } from 'next'
import { ArrowDownLeft } from 'lucide-react'
import { PageContainer } from '@/components/layout/PageContainer'
import { STUBS } from '@/config/strings'

export const metadata: Metadata = { title: 'Receive XQ | XQ Wallet' }

export default function ReceivePage() {
  return (
    <PageContainer>
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-brand-50 dark:bg-brand-950">
          <ArrowDownLeft
            className="h-7 w-7 text-brand-600 dark:text-brand-400"
            aria-hidden="true"
          />
        </div>
        {/* P0-01: hsl() for foreground/muted, bg-surface-subtle */}
        <h1 className="text-xl font-bold text-[hsl(var(--foreground))]">{STUBS.receive.title}</h1>
        <p className="mt-2 max-w-sm text-sm text-[hsl(var(--muted))]">
          {STUBS.receive.description}
        </p>
        <span className="mt-4 inline-flex items-center rounded-full bg-surface-subtle px-3 py-1 text-xs font-medium text-[hsl(var(--muted))]">
          {STUBS.comingSoon}
        </span>
      </div>
    </PageContainer>
  )
}
