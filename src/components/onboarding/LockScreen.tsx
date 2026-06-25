'use client'

/**
 * LockScreen — full-viewport lock overlay.
 *
 * Consumes walletStore and sessionStore through props (not directly importing
 * store hooks) so it can be tested and reused in different contexts.
 *
 * Accessibility:
 *   - role="main" / aria-label on the outer container
 *   - XQ Wallet logo and wallet name for user orientation
 *   - Error from failed unlock attempts is surfaced by UnlockForm
 */

import { UnlockForm } from './UnlockForm'
import { cn } from '@/lib/cn'

export interface LockScreenProps {
  walletName?: string
  isLoading: boolean
  error: string | null
  onUnlock: (password: string) => Promise<void>
  className?: string
}

export function LockScreen({
  walletName = 'XQ Wallet',
  isLoading,
  error,
  onUnlock,
  className,
}: LockScreenProps) {
  return (
    <main
      aria-label="Wallet locked"
      className={cn(
        'flex min-h-dvh flex-col items-center justify-center',
        'bg-[hsl(var(--background))] px-4',
        className,
      )}
    >
      <div className="w-full max-w-sm space-y-8">
        {/* Logo + wallet name */}
        <header className="flex flex-col items-center gap-3 text-center">
          <div
            aria-hidden="true"
            className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-600 text-lg font-bold text-white"
          >
            XQ
          </div>
          <div className="space-y-1">
            <h1 className="text-xl font-semibold text-[hsl(var(--foreground))]">{walletName}</h1>
            <p className="text-sm text-[hsl(var(--muted))]">
              Your wallet is locked. Enter your password to continue.
            </p>
          </div>
        </header>

        {/* Unlock form */}
        <UnlockForm onSubmit={onUnlock} isLoading={isLoading} error={error} />
      </div>
    </main>
  )
}
