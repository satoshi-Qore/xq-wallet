'use client'

/**
 * Lock screen page.
 *
 * Displayed when the wallet exists but the session is locked.
 * Delegates unlock logic to walletStore (which calls WalletService).
 * Updates sessionStore on successful unlock.
 *
 * Architecture: ARCHITECTURE.md §8 — Onboarding Architecture
 */

import { useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useWalletStore, useSessionStore } from '@/lib/stores'
import { LockScreen } from '@/components/onboarding'

export default function LockPage() {
  const router = useRouter()
  const { wallet, isLoading, error: storeError, unlockWallet, clearError } = useWalletStore()
  const { unlock } = useSessionStore()

  const handleUnlock = useCallback(
    async (password: string) => {
      clearError()
      try {
        await unlockWallet(password)
        unlock()
        router.push('/dashboard')
      } catch {
        // storeError is set by unlockWallet action
      }
    },
    [unlockWallet, unlock, clearError, router],
  )

  return (
    <LockScreen
      walletName={wallet?.name ?? 'XQ Wallet'}
      isLoading={isLoading}
      error={storeError?.message ?? null}
      onUnlock={handleUnlock}
    />
  )
}
