'use client'

/**
 * SeedPhraseGrid — displays a BIP-39 mnemonic as a numbered word grid.
 *
 * Accessibility:
 *   - role="list" on the container so screen readers announce it as a list
 *   - each word slot is role="listitem"
 *   - obscured mode uses aria-hidden on the word text, aria-label on the item
 *   - user-select-none in obscured mode (copy protection)
 */

import { cn } from '@/lib/cn'

export interface SeedPhraseGridProps {
  /** Ordered list of mnemonic words (12 or 24 elements). */
  words: string[]
  /**
   * When true, replaces word text with dots.
   * Use while the phrase is first revealed so screenshots are less dangerous.
   * Default: false.
   */
  obscured?: boolean
  className?: string
}

export function SeedPhraseGrid({ words, obscured = false, className }: SeedPhraseGridProps) {
  // 3 columns for ≤12 words, 4 columns for >12 words
  const cols = words.length > 12 ? 'grid-cols-4' : 'grid-cols-3'

  return (
    <ol
      role="list"
      aria-label="Recovery phrase words"
      className={cn('grid gap-2', cols, className)}
    >
      {words.map((word, i) => (
        <li
          key={i}
          role="listitem"
          aria-label={obscured ? `Word ${i + 1}, hidden` : `Word ${i + 1}: ${word}`}
          className={cn(
            'flex items-center gap-1.5 rounded-lg border px-3 py-2',
            'border-[hsl(var(--border))] bg-[hsl(var(--surface))]',
          )}
        >
          <span
            aria-hidden="true"
            className="min-w-[1.25rem] text-right text-xs text-[hsl(var(--muted))]"
          >
            {i + 1}
          </span>
          <span
            aria-hidden={obscured}
            className={cn(
              'font-mono text-sm font-medium text-[hsl(var(--foreground))]',
              obscured && 'select-none blur-sm',
            )}
          >
            {obscured ? '•••••' : word}
          </span>
        </li>
      ))}
    </ol>
  )
}
