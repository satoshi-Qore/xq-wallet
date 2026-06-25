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
import { NAV_ITEMS, isNavItemActive } from '@/config/navigation'
import { APP } from '@/config/strings'
import { XQLogo } from '@/components/ui/XQLogo'
import { NetworkBadge } from '@/components/shared/NetworkBadge'
import { ThemeToggle } from '@/components/shared/ThemeToggle'

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside
      className={cn(
        'hidden lg:flex lg:flex-col',
        'w-60 h-full shrink-0',
        // P0-01: bg-surface token, hsl() for border
        'border-r border-[hsl(var(--border))] bg-surface',
      )}
      role="navigation"
      aria-label="Sidebar"
    >
      {/* Brand header */}
      <div className="flex items-center gap-3 px-4 py-5">
        <XQLogo />
        {/* P0-01: hsl() for foreground */}
        <span className="text-sm font-semibold text-[hsl(var(--foreground))]">{APP.name}</span>
      </div>

      {/* Divider — P0-01: hsl() for border */}
      <div className="mx-4 h-px bg-[hsl(var(--border))]" aria-hidden="true" />

      {/* Nav items */}
      <nav className="flex-1 overflow-y-auto px-2 py-3" aria-label="Main navigation">
        <ul role="list" className="space-y-0.5">
          {NAV_ITEMS.map((item) => {
            const active = isNavItemActive(item, pathname)
            const Icon = item.icon

            return (
              <li key={item.key}>
                <Link
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  aria-label={item.ariaLabel}
                  className={cn(
                    'group flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1',
                    // P0-01: brand tokens + hsl() for muted/surface-subtle
                    active
                      ? 'bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300'
                      : 'text-[hsl(var(--muted))] hover:bg-surface-subtle hover:text-[hsl(var(--foreground))]',
                  )}
                >
                  <Icon
                    className={cn(
                      'h-4 w-4 shrink-0 transition-colors',
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
    </aside>
  )
}
