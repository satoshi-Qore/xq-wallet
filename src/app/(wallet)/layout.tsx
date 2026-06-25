/**
 * Wallet shell layout — wraps all authenticated wallet routes.
 *
 * This layout renders the AppShell (Sidebar + Header + BottomNav)
 * around every page in the (wallet) route group.
 *
 * All wallet routes are client-rendered (no SSR for wallet state).
 * The AppShell itself is a 'use client' component.
 *
 * Route group: src/app/(wallet)/
 */

import type { ReactNode } from 'react'
import { AppShell } from '@/components/layout/AppShell'

interface WalletLayoutProps {
  children: ReactNode
}

export default function WalletLayout({ children }: WalletLayoutProps) {
  return <AppShell>{children}</AppShell>
}
