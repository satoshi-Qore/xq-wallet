'use client'

/**
 * Header — top bar inside the wallet shell.
 *
 * Desktop: page title (left) + NetworkBadge + ThemeToggle (right)
 * Mobile:  hamburger (left) + page title (center) + ThemeToggle (right)
 *
 * The header does NOT contain auth or wallet state — that is Sprint 2.
 */

import { Menu } from 'lucide-react'
import { usePathname } from 'next/navigation'
import { useUIStore } from '@/lib/stores'
import { NAV_ITEMS } from '@/config/navigation'
import { APP, NAV } from '@/config/strings'
import { NetworkBadge } from '@/components/shared/NetworkBadge'
import { ThemeToggle } from '@/components/shared/ThemeToggle'
import { cn } from '@/lib/utils'

// ─── Page title derived from pathname ──────────────────────────────────────

function usePageTitle(): string {
  const pathname = usePathname()
  const match = NAV_ITEMS.find(
    (item) =>
      pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href)),
  )
  return match?.label ?? APP.name
}

// ─── Component ─────────────────────────────────────────────────────────────

export function Header() {
  const toggleSidebar = useUIStore((s) => s.toggleSidebar)
  const pageTitle = usePageTitle()

  return (
    // P1-03: role="banner" — <header> inside nested divs does not auto-receive banner landmark
    // P0-01: bg-surface token, hsl() for border
    <header
      role="banner"
      className={cn(
        'flex h-14 shrink-0 items-center gap-3 px-4',
        'border-b border-[hsl(var(--border))] bg-surface',
      )}
    >
      {/* Mobile hamburger */}
      <button
        type="button"
        onClick={toggleSidebar}
        aria-label={NAV.openMenu}
        className={cn(
          'flex lg:hidden items-center justify-center',
          'h-9 w-9 rounded-md',
          // P0-01: hsl() for muted/surface-subtle/foreground
          'text-[hsl(var(--muted))]',
          'hover:bg-surface-subtle hover:text-[hsl(var(--foreground))]',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
          'transition-colors',
        )}
      >
        <Menu className="h-5 w-5" aria-hidden="true" />
      </button>

      {/* Page title — P0-01: hsl() for foreground */}
      <h1 className="flex-1 text-sm font-semibold text-[hsl(var(--foreground))] lg:text-base">
        {pageTitle}
      </h1>

      {/* Right side */}
      <div className="flex items-center gap-2">
        <div className="hidden sm:flex">
          <NetworkBadge network="devnet" />
        </div>
        <ThemeToggle />
      </div>
    </header>
  )
}
