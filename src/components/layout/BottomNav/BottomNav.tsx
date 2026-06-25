'use client'

/**
 * BottomNav — Mobile-only fixed bottom navigation bar (hidden on lg+).
 *
 * Shows up to 5 nav items. Icon + label. Active item highlighted with brand color.
 *
 * Accessibility:
 *  - role="navigation" + aria-label="Mobile navigation"
 *  - aria-current="page" on active item
 *  - Minimum 44×44px touch targets per WCAG 2.5.5
 */

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { BOTTOM_NAV_ITEMS } from '@/config/navigation'

export function BottomNav() {
  const pathname = usePathname()

  return (
    <nav
      className={cn(
        // Mobile only — hidden on desktop
        'flex lg:hidden',
        // Positioning
        'fixed bottom-0 left-0 right-0 z-40',
        // Visual
        'border-t border-[var(--border)] bg-[var(--surface)]',
        // Safe area (iOS notch)
        'pb-safe',
      )}
      role="navigation"
      aria-label="Mobile navigation"
    >
      <ul
        role="list"
        className="flex w-full items-stretch"
      >
        {BOTTOM_NAV_ITEMS.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== '/dashboard' && pathname.startsWith(item.href))
          const Icon = item.icon

          return (
            <li key={item.key} className="flex flex-1">
              <Link
                href={item.href}
                aria-current={isActive ? 'page' : undefined}
                aria-label={item.ariaLabel}
                className={cn(
                  // Layout — fill the <li>, minimum touch target
                  'flex flex-1 flex-col items-center justify-center gap-1',
                  'min-h-[56px] py-2',
                  // Typography
                  'text-[10px] font-medium leading-none',
                  // States
                  isActive
                    ? 'text-brand-600 dark:text-brand-400'
                    : 'text-[var(--muted)]',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500',
                  'transition-colors',
                )}
              >
                <Icon
                  className={cn(
                    'h-5 w-5 shrink-0',
                    isActive
                      ? 'text-brand-600 dark:text-brand-400'
                      : 'text-[var(--muted)]',
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
