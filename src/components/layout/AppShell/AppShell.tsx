'use client'

/**
 * AppShell — top-level layout wrapper for all authenticated wallet screens.
 *
 * Desktop layout (≥ 1024px):
 *   ┌──────────┬─────────────────────────────┐
 *   │          │  Header                     │
 *   │ Sidebar  ├─────────────────────────────┤
 *   │ (240px)  │  <main> (scrollable)        │
 *   └──────────┴─────────────────────────────┘
 *
 * Mobile layout (< 1024px):
 *   ┌─────────────────────────────┐
 *   │  Header (hamburger)         │
 *   ├─────────────────────────────┤
 *   │  <main> (scrollable)        │
 *   ├─────────────────────────────┤
 *   │  BottomNav (fixed)          │
 *   └─────────────────────────────┘
 */

import { useEffect, type ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import { useUIStore } from '@/lib/stores'
import { useIsDesktop } from '@/hooks'
import { Sidebar } from '@/components/layout/Sidebar'
import { Header } from '@/components/layout/Header'
import { BottomNav } from '@/components/layout/BottomNav'
import { MobileSidebarDrawer } from './MobileSidebarDrawer'

interface AppShellProps {
  children: ReactNode
}

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname()
  const closeSidebar = useUIStore((s) => s.closeSidebar)
  const isDesktop = useIsDesktop()

  // Close mobile drawer on route change
  useEffect(() => {
    closeSidebar()
  }, [pathname, closeSidebar])

  // Close mobile drawer when viewport becomes desktop width
  useEffect(() => {
    if (isDesktop) closeSidebar()
  }, [isDesktop, closeSidebar])

  return (
    // P0-01: bg-surface-subtle Tailwind token
    <div className="flex h-full overflow-hidden bg-surface-subtle">
      {/* Desktop sidebar — always visible on lg+ */}
      <Sidebar />

      {/* Mobile sidebar overlay drawer */}
      <MobileSidebarDrawer />

      {/* Main content column */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />

        <main id="main-content" tabIndex={-1} className="flex-1 overflow-y-auto pb-14 lg:pb-0">
          {children}
        </main>

        <BottomNav />
      </div>
    </div>
  )
}
