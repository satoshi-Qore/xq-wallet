'use client'

/**
 * Sidebar — 240px fixed left panel, desktop only (hidden on < lg).
 *
 * Structure:
 *  ┌──────────────────────┐
 *  │  Logo + App name     │  ← Brand header
 *  │  ──────────────────  │
 *  │  Nav items           │  ← NAV_ITEMS config
 *  │  ──────────────────  │
 *  │  Network badge       │  ← Status footer
 *  │  Theme toggle        │
 *  └──────────────────────┘
 *
 * Accessibility: role="navigation" + aria-label, aria-current on active item.
 */

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { NAV_ITEMS } from '@/config/navigation'
import { APP } from '@/config/strings'
import { NetworkBadge } from '@/components/shared/NetworkBadge/NetworkBadge'
import { ThemeToggle } from '@/components/shared/ThemeToggle/ThemeToggle'

// ─── XQ Logo mark ──────────────────────────────────────────────────────────

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

// ─── Component ─────────────────────────────────────────────────────────────

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside
      className={cn(
        // Layout — 240px wide, full height, fixed left column
        'hidden lg:flex lg:flex-col',
        'w-60 h-full shrink-0',
        // Visual
        'border-r border-[var(--border)] bg-[var(--surface)]',
      )}
      role="navigation"
      aria-label="Sidebar"
    >
      {/* Brand header */}
      <div className="flex items-center gap-3 px-4 py-5">
        <XQLogo />
        <span className="text-sm font-semibold text-[var(--foreground)]">
          {APP.name}
        </span>
      </div>

      {/* Divider */}
      <div className="mx-4 h-px bg-[var(--border)]" aria-hidden="true" />

      {/* Nav items */}
      <nav className="flex-1 overflow-y-auto px-2 py-3" aria-label="Main navigation">
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
                  aria-current={isActive ? 'page' : undefined}
                  aria-label={item.ariaLabel}
                  className={cn(
                    // Base
                    'group flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1',
                    // States
                    isActive
                      ? 'bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300'
                      : 'text-[var(--muted)] hover:bg-[var(--surface-subtle)] hover:text-[var(--foreground)]',
                  )}
                >
                  <Icon
                    className={cn(
                      'h-4 w-4 shrink-0 transition-colors',
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

      {/* Divider */}
      <div className="mx-4 h-px bg-[var(--border)]" aria-hidden="true" />

      {/* Footer */}
      <div className="flex items-center justify-between px-4 py-4">
        <NetworkBadge network="devnet" />
        <ThemeToggle />
      </div>
    </aside>
  )
}
