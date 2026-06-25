'use client'

/**
 * BottomNav — Mobile-only fixed bottom navigation bar (hidden on lg+).
 *
 * Shows up to 5 nav items. Icon + label. Active item highlighted with brand color.
 *
 * Accessibility:
 *  - role="navigation" + aria-label="Mobile navigation"
 *  - aria-current="page" on active item
 *  - Minimum 56px touch targets (exceeds WCAG 2.5.5 minimum of 44px)
 */

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { BOTTOM_NAV_ITEMS, isNavItemActive } from '@/config/navigation'

export function BottomNav() {
  const pathname = usePathname()

  return (
    <nav
      className={cn(
        // Mobile only
        'flex lg:hidden',
        'fixed bottom-0 left-0 right-0 z-40',
        // P0-01: bg-surface token, hsl() for border
        'border-t border-[hsl(var(--border))] bg-surface',
        // iOS safe area
        'pb-safe',
      )}
      role="navigation"
      aria-label="Mobile navigation"
    >
      <ul role="list" className="flex w-full items-stretch">
        {BOTTOM_NAV_ITEMS.map((item) => {
          const active = isNavItemActive(item, pathname)
          const Icon = item.icon

          return (
            <li key={item.key} className="flex flex-1">
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                aria-label={item.ariaLabel}
                className={cn(
                  'flex flex-1 flex-col items-center justify-center gap-1',
                  'min-h-[56px] py-2',
                  'text-[10px] font-medium leading-none',
                  // P0-01: brand tokens, hsl() for muted
                  active ? 'text-brand-600 dark:text-brand-400' : 'text-[hsl(var(--muted))]',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500',
                  'transition-colors',
                )}
              >
                <Icon
                  className={cn(
                    'h-5 w-5 shrink-0',
                    active ? 'text-brand-600 dark:text-brand-400' : 'text-[hsl(var(--muted))]',
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
  )
}
