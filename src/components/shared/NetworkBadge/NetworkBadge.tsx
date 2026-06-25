/**
 * NetworkBadge — displays the active network with an animated status dot.
 *
 * Variants:
 *   mainnet  → green   (production)
 *   testnet  → yellow  (testing)
 *   devnet   → blue    (development)
 *
 * Sprint 1: receives network as a prop.
 * Sprint 2+: will read from networkStore.
 */

import type { NetworkEnvironment } from '@/types'
import { cn } from '@/lib/utils'

// Re-export so consumers can import from this module if needed.
export type { NetworkEnvironment }

// ─── Types ─────────────────────────────────────────────────────────────────

interface NetworkBadgeProps {
  network: NetworkEnvironment
  className?: string
}

// ─── Config ────────────────────────────────────────────────────────────────

const NETWORK_CONFIG: Record<
  NetworkEnvironment,
  { label: string; dotClass: string; badgeClass: string }
> = {
  mainnet: {
    label: 'Mainnet',
    dotClass: 'bg-green-500',
    badgeClass:
      'bg-green-50 text-green-700 ring-green-600/20 dark:bg-green-950 dark:text-green-300 dark:ring-green-400/20',
  },
  testnet: {
    label: 'Testnet',
    dotClass: 'bg-yellow-500',
    badgeClass:
      'bg-yellow-50 text-yellow-700 ring-yellow-600/20 dark:bg-yellow-950 dark:text-yellow-300 dark:ring-yellow-400/20',
  },
  devnet: {
    label: 'Devnet',
    dotClass: 'bg-blue-500',
    badgeClass:
      'bg-blue-50 text-blue-700 ring-blue-600/20 dark:bg-blue-950 dark:text-blue-300 dark:ring-blue-400/20',
  },
}

// ─── Component ─────────────────────────────────────────────────────────────

export function NetworkBadge({ network, className }: NetworkBadgeProps) {
  const config = NETWORK_CONFIG[network]

  return (
    <span
      role="status"
      aria-label={`Connected to ${config.label}`}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5',
        'text-xs font-medium ring-1 ring-inset',
        config.badgeClass,
        className,
      )}
    >
      {/* Animated presence dot */}
      <span className="relative flex h-1.5 w-1.5" aria-hidden="true">
        <span
          className={cn(
            'absolute inline-flex h-full w-full animate-ping rounded-full opacity-75',
            config.dotClass,
          )}
        />
        <span className={cn('relative inline-flex h-1.5 w-1.5 rounded-full', config.dotClass)} />
      </span>
      {config.label}
      {config.label}
    </span>
  )
}
