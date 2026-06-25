/**
 * Navigation configuration.
 * All navigation items are defined here — never hardcoded in components.
 * Layout components read this config to render sidebar and bottom nav.
 */

import {
  LayoutDashboard,
  ArrowUpRight,
  ArrowDownLeft,
  Clock,
  Settings,
  type LucideIcon,
} from 'lucide-react'

// ─── Types ─────────────────────────────────────────────────────────────────

export interface NavItem {
  /** Unique key for this item */
  key: string
  /** Display label */
  label: string
  /** Route href */
  href: string
  /** Lucide icon component */
  icon: LucideIcon
  /** ARIA label for icon-only contexts */
  ariaLabel: string
  /** Shown in bottom nav on mobile (max 5) */
  showInBottomNav: boolean
}

// ─── Items ─────────────────────────────────────────────────────────────────

export const NAV_ITEMS: NavItem[] = [
  {
    key: 'dashboard',
    label: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
    ariaLabel: 'Go to dashboard',
    showInBottomNav: true,
  },
  {
    key: 'send',
    label: 'Send',
    href: '/send',
    icon: ArrowUpRight,
    ariaLabel: 'Send XQ',
    showInBottomNav: true,
  },
  {
    key: 'receive',
    label: 'Receive',
    href: '/receive',
    icon: ArrowDownLeft,
    ariaLabel: 'Receive XQ',
    showInBottomNav: true,
  },
  {
    key: 'history',
    label: 'History',
    href: '/history',
    icon: Clock,
    ariaLabel: 'View transaction history',
    showInBottomNav: true,
  },
  {
    key: 'settings',
    label: 'Settings',
    href: '/settings',
    icon: Settings,
    ariaLabel: 'Open settings',
    showInBottomNav: true,
  },
]

export const BOTTOM_NAV_ITEMS = NAV_ITEMS.filter((item) => item.showInBottomNav)

// ─── Helpers ───────────────────────────────────────────────────────────────

/**
 * Returns true if a nav item should be considered active for the given pathname.
 * Dashboard uses exact-match to prevent it from matching all child routes.
 */
export function isNavItemActive(item: NavItem, pathname: string): boolean {
  return pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))
}
