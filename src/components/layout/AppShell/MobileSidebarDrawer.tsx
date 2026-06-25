'use client'

/**
 * MobileSidebarDrawer — mobile sidebar overlay (< 1024px only).
 *
 * Closed by: backdrop click, Escape key, or route change (AppShell).
 *
 * Accessibility:
 *  - role="dialog" + aria-modal + aria-label on the panel
 *  - aria-hidden={!isSidebarOpen} — hides from AT when closed
 *  - inert={!isSidebarOpen} — removes all descendants from keyboard navigation
 *    when closed (React 19 native support). Combined with aria-hidden, this
 *    satisfies WCAG 2.1 SC 2.1.2 and SC 1.3.6.
 *  - Focus moves to close button on open
 *  - Escape key closes the drawer
 *
 * P0-02: inert + aria-hidden on the drawer panel when closed prevents keyboard
 * users from reaching off-screen focusable elements (nav links, close button).
 */

import { useEffect, useRef } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useUIStore } from '@/lib/stores'
import { NAV_ITEMS, isNavItemActive } from '@/config/navigation'
import { APP, NAV } from '@/config/strings'
import { XQLogo } from '@/components/ui/XQLogo'
import { NetworkBadge } from '@/components/shared/NetworkBadge'
import { ThemeToggle } from '@/components/shared/ThemeToggle'

export function MobileSidebarDrawer() {
  const isSidebarOpen = useUIStore((s) => s.isSidebarOpen)
  const closeSidebar = useUIStore((s) => s.closeSidebar)
  const pathname = usePathname()
  const closeButtonRef = useRef<HTMLButtonElement>(null)

  // Move focus to close button when drawer opens
  useEffect(() => {
    if (isSidebarOpen) {
      closeButtonRef.current?.focus()
    }
  }, [isSidebarOpen])

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isSidebarOpen) {
        closeSidebar()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isSidebarOpen, closeSidebar])

  return (
    <>
      {/* Backdrop — P0-01: no token issue (uses bg-black/50) */}
      <div
        aria-hidden="true"
        onClick={closeSidebar}
        className={cn(
          'fixed inset-0 z-50 bg-black/50 lg:hidden',
          'transition-opacity duration-200',
          isSidebarOpen ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
      />

      {/*
       * Drawer panel
       *
       * P0-02: aria-hidden + inert when closed.
       *  - aria-hidden removes the panel from the accessibility tree
       *  - inert (React 19) removes all children from keyboard tab order
       * Both are needed: aria-hidden alone does not remove keyboard focus.
       *
       * P0-01: bg-surface token, hsl() for border/foreground/muted
       */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
        aria-hidden={!isSidebarOpen}
        inert={!isSidebarOpen}
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-72 flex-col lg:hidden',
          'border-r border-[hsl(var(--border))] bg-surface',
          'transition-transform duration-300 ease-in-out',
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        {/* Drawer header */}
        <div className="flex items-center justify-between px-4 py-5">
          <div className="flex items-center gap-3">
            <XQLogo />
            <span className="text-sm font-semibold text-[hsl(var(--foreground))]">{APP.name}</span>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={closeSidebar}
            aria-label={NAV.closeMenu}
            className={cn(
              'flex h-9 w-9 items-center justify-center rounded-md',
              'text-[hsl(var(--muted))]',
              'hover:bg-surface-subtle hover:text-[hsl(var(--foreground))]',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
              'transition-colors',
            )}
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {/* Divider */}
        <div className="mx-4 h-px bg-[hsl(var(--border))]" aria-hidden="true" />

        {/* Nav items */}
        <nav className="flex-1 overflow-y-auto px-2 py-3" aria-label="Mobile navigation drawer">
          <ul role="list" className="space-y-0.5">
            {NAV_ITEMS.map((item) => {
              const active = isNavItemActive(item, pathname)
              const Icon = item.icon

              return (
                <li key={item.key}>
                  <Link
                    href={item.href}
                    onClick={closeSidebar}
                    aria-current={active ? 'page' : undefined}
                    aria-label={item.ariaLabel}
                    className={cn(
                      'group flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
                      active
                        ? 'bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300'
                        : 'text-[hsl(var(--muted))] hover:bg-surface-subtle hover:text-[hsl(var(--foreground))]',
                    )}
                  >
                    <Icon
                      className={cn(
                        'h-5 w-5 shrink-0',
                        active
                          ? 'text-brand-600 dark:text-brand-400'
                          : 'text-[hsl(var(--muted))] group-hover:text-[hsl(var(--foreground))]',
                      )}
                      aria-hidden="true"
                    />
                    <span>{item.label}</span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>

        {/* Divider */}
        <div className="mx-4 h-px bg-[hsl(var(--border))]" aria-hidden="true" />

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-4">
          <NetworkBadge network="devnet" />
          <ThemeToggle />
        </div>
      </div>
    </>
  )
}
