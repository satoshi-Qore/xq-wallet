'use client'

/**
 * AppShell — the top-level layout wrapper for authenticated wallet screens.
 *
 * Desktop layout (≥ 1024px):
 *   ┌──────────┬─────────────────────────────┐
 *   │          │  Header                     │
 *   │ Sidebar  ├─────────────────────────────┤
 *   │ (240px)  │  main (scrollable)          │
 *   │          │                             │
 *   └──────────┴─────────────────────────────┘
 *
 * Mobile layout (< 1024px):
 *   ┌─────────────────────────────┐
 *   │  Header (hamburger)         │
 *   ├─────────────────────────────┤
 *   │  main (scrollable)          │
 *   │                             │
 *   ├─────────────────────────────┤
 *   │  BottomNav (fixed)          │
 *   └─────────────────────────────┘
 *
 * Mobile sidebar opens as an overlay drawer controlled by uiStore.isSidebarOpen.
 */

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { useUIStore } from '@/lib/stores'
import { useIsDesktop } from '@/hooks'
import { Sidebar } from '@/components/layout/Sidebar'
import { Header } from '@/components/layout/Header'
import { BottomNav } from '@/components/layout/BottomNav'
import { MobileSidebarDrawer } from './MobileSidebarDrawer'

interface AppShellProps {
  children: React.ReactNode
}

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname()
  const closeSidebar = useUIStore((s) => s.closeSidebar)
  const isDesktop = useIsDesktop()

  // Close mobile drawer on route change
  useEffect(() => {
    closeSidebar()
  }, [pathname, closeSidebar])

  // Close mobile drawer when screen becomes desktop
  useEffect(() => {
    if (isDesktop) closeSidebar()
  }, [isDesktop, closeSidebar])

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--surface-subtle)]">
      {/* Desktop sidebar — always visible on lg+ */}
      <Sidebar />

      {/* Mobile sidebar overlay drawer */}
      <MobileSidebarDrawer />

      {/* Main content column */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />

        {/* Scrollable page area */}
        <main
          id="main-content"
          tabIndex={-1}
          className={cn(
            'flex-1 overflow-y-auto',
            // Bottom padding to clear the BottomNav on mobile
            'pb-14 lg:pb-0',
          )}
        >
          {children}
        </main>

        {/* Mobile bottom navigation */}
        <BottomNav />
      </div>
    </div>
  )
}
