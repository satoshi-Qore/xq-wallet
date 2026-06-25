'use client'

/**
 * Wallet error boundary — catches runtime errors in (wallet) routes.
 * Renders a recovery UI without breaking the shell layout.
 */

import { useEffect } from 'react'
import { AlertTriangle } from 'lucide-react'
import { PageContainer } from '@/components/layout/PageContainer'
import { ERRORS } from '@/config/strings'

interface ErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function WalletError({ error, reset }: ErrorProps) {
  useEffect(() => {
    // Log to error reporting service in production (Sprint 3+)
    console.error('[WalletError]', error)
  }, [error])

  return (
    <PageContainer>
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-950">
          <AlertTriangle className="h-6 w-6 text-red-600 dark:text-red-400" aria-hidden="true" />
        </div>
        {/* P0-01: hsl() for foreground/muted */}
        <h2 className="mb-2 text-lg font-semibold text-[hsl(var(--foreground))]">
          Something went wrong
        </h2>
        <p className="mb-6 max-w-sm text-sm text-[hsl(var(--muted))]">{ERRORS.generic}</p>
        <button
          type="button"
          onClick={reset}
          className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
        >
          {ERRORS.tryAgain}
        </button>
      </div>
    </PageContainer>
  )
}
