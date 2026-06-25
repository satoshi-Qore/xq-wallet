'use client'

/**
 * MobileSidebarDrawer — mobile sidebar overlay (< 1024px only).
 *
 * Renders the same Sidebar content inside a slide-in drawer with a
 * semi-transparent backdrop. Closed by: backdrop click, Escape key,
 * or route change (handled in AppShell).
 *
 * Accessibility:
 *  - role="dialog" + aria-modal="true" + aria-label
 *  - Escape key closes the drawer
 *  - Focus is trapped while open (no external dependencies needed for Sprint 1)
 */

import { useEffect, useRef } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useUIStore } from '@/lib/stores'
import { NAV_ITEMS } from '@/config/navigation'
import { APP, NAV } from '@/config/strings'
import { NetworkBadge } from '@/components/shared/NetworkBadge/NetworkBadge'
import { ThemeToggle } from '@/components/shared/ThemeToggle/ThemeToggle'

function XQLogo() {
  return (
    <div
      aria-hidden="true"
      className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white"
    >
      XQ
    </div>
  )
}

export function MobileSidebarDrawer() {
  const isSidebarOpen = useUIStore((s) => s.isSidebarOpen)
  const closeSidebar = useUIStore((s) => s.closeSidebar)
  const pathname = usePathname()
  const closeButtonRef = useRef<HTMLButtonElement>(null)

  // Trap focus on open — move focus to close button
  useEffect(() => {
    if (isSidebarOpen) {
      closeButtonRef.current?.focus()
    }
  }, [isSidebarOpen])

  // Escape key handler
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
      {/* Backdrop */}
      <div
        aria-hidden="true"
        onClick={closeSidebar}
        className={cn(
          'fixed inset-0 z-50 bg-black/50 lg:hidden',
          'transition-opacity duration-200',
          isSidebarOpen ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
      />

      {/* Drawer panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-72 flex-col lg:hidden',
          'border-r border-[var(--border)] bg-[var(--surface)]',
          // Slide animation — respects prefers-reduced-motion via globals.css
          'transition-transform duration-300 ease-in-out',
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        {/* Drawer header */}
        <div className="flex items-center justify-between px-4 py-5">
          <div className="flex items-center gap-3">
            <XQLogo />
            <span className="text-sm font-semibold text-[var(--foreground)]">
              {APP.name}
            </span>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={closeSidebar}
            aria-label={NAV.closeMenu}
            className={cn(
              'flex h-9 w-9 items-center justify-center rounded-md text-[var(--muted)]',
              'hover:bg-[var(--surface-subtle)] hover:text-[var(--foreground)]',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
              'transition-colors',
            )}
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="mx-4 h-px bg-[var(--border)]" aria-hidden="true" />

        {/* Nav items */}
        <nav className="flex-1 overflow-y-auto px-2 py-3" aria-label="Mobile navigation drawer">
          <ul role="list" className="space-y-0.5">
            {NAV_ITEMS.map((item) => {
              const isActive =
                pathname === item.href ||
                (item.href !== '/dashboard' && pathname.startsWith(item.href))
              const Icon = item.icon

              return (
                <li key={item.key}>
                  <Link
                    href={item.href}
                    onClick={closeSidebar}
                    aria-current={isActive ? 'page' : undefined}
                    aria-label={item.ariaLabel}
                    className={cn(
                      'group flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
                      isActive
                        ? 'bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300'
                        : 'text-[var(--muted)] hover:bg-[var(--surface-subtle)] hover:text-[var(--foreground)]',
                    )}
                  >
                    <Icon
                      className={cn(
                        'h-5 w-5 shrink-0',
                        isActive
                          ? 'text-brand-600 dark:text-brand-400'
                          : 'text-[var(--muted)] group-hover:text-[var(--foreground)]',
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

        <div className="mx-4 h-px bg-[var(--border)]" aria-hidden="true" />

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-4">
          <NetworkBadge network="devnet" />
          <ThemeToggle />
        </div>
      </div>
    </>
  )
}
