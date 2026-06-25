'use client'

import * as React from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/cn'
import { focusRing, transition } from '@/lib/tokens'

// ─── Types ─────────────────────────────────────────────────────────────────

export interface ChipProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** Optional leading icon */
  icon?: React.ReactNode
  /** Makes the chip dismissible — calls onDismiss when the × button is clicked */
  onDismiss?: () => void
  /** Accessible label for the dismiss button */
  dismissLabel?: string
  /** Visual variant */
  variant?: 'default' | 'brand' | 'outline'
}

// ─── Component ─────────────────────────────────────────────────────────────

export function Chip({
  icon,
  onDismiss,
  dismissLabel = 'Remove',
  variant = 'default',
  className,
  children,
  ...props
}: ChipProps) {
  const variantClasses = {
    default:
      'bg-[hsl(var(--surface-elevated))] text-[hsl(var(--foreground))] border border-[hsl(var(--border))]',
    brand: 'bg-brand-100 text-brand-800 dark:bg-brand-900/30 dark:text-brand-300',
    outline: 'bg-transparent text-[hsl(var(--foreground))] border border-[hsl(var(--border))]',
  }

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium',
        variantClasses[variant],
        className,
      )}
      {...props}
    >
      {icon && (
        <span className="shrink-0 text-current" aria-hidden="true">
          {icon}
        </span>
      )}
      {children}
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label={`${dismissLabel}${typeof children === 'string' ? ` ${children}` : ''}`}
          className={cn(
            'ml-0.5 shrink-0 rounded-full p-0.5',
            'hover:bg-black/10 dark:hover:bg-white/10',
            transition,
            focusRing,
          )}
        >
          <X className="h-3 w-3" aria-hidden="true" />
        </button>
      )}
    </span>
  )
}
