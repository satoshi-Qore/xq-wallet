'use client'

/**
 * ThemeToggle — cycles through light → dark → system themes.
 *
 * Uses next-themes useTheme hook. Renders a Sun, Moon, or Monitor icon
 * based on the resolved theme. Hydration-safe: icon renders null until
 * mounted to prevent mismatch.
 *
 * Accessibility: icon-only button with descriptive aria-label.
 */

import { useEffect, useState } from 'react'
import { useTheme } from 'next-themes'
import { Sun, Moon, Monitor } from 'lucide-react'
import { cn } from '@/lib/utils'

// Theme cycle order: system → light → dark → system…
const THEME_CYCLE: Array<'system' | 'light' | 'dark'> = ['system', 'light', 'dark']

function getNextTheme(current: string | undefined): 'system' | 'light' | 'dark' {
  const idx = THEME_CYCLE.indexOf(current as 'system' | 'light' | 'dark')
  return THEME_CYCLE[(idx + 1) % THEME_CYCLE.length]
}

function getAriaLabel(theme: string | undefined): string {
  switch (theme) {
    case 'light': return 'Switch to dark mode'
    case 'dark': return 'Switch to system theme'
    default: return 'Switch to light mode'
  }
}

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme, resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  // Prevent hydration mismatch — only render icon client-side
  useEffect(() => setMounted(true), [])

  const handleClick = () => {
    setTheme(getNextTheme(theme))
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={getAriaLabel(theme)}
      className={cn(
        'flex h-9 w-9 items-center justify-center rounded-md',
        'text-[var(--muted)] hover:bg-[var(--surface-subtle)] hover:text-[var(--foreground)]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
        'transition-colors',
        className,
      )}
    >
      {/* Render nothing until mounted to avoid hydration mismatch */}
      {mounted ? (
        theme === 'system' ? (
          <Monitor className="h-4 w-4" aria-hidden="true" />
        ) : resolvedTheme === 'dark' ? (
          <Moon className="h-4 w-4" aria-hidden="true" />
        ) : (
          <Sun className="h-4 w-4" aria-hidden="true" />
        )
      ) : (
        <span className="h-4 w-4" aria-hidden="true" />
      )}
    </button>
  )
}
