'use client'

import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/cn'
import { focusRing, disabledState, transition } from '@/lib/tokens'
import { Spinner } from '@/components/ui/Spinner/Spinner'

// ─── Variants ──────────────────────────────────────────────────────────────

const iconButtonVariants = cva(
  [
    'inline-flex items-center justify-center',
    'rounded-lg cursor-pointer select-none',
    'shrink-0',
    transition,
    focusRing,
    disabledState,
  ],
  {
    variants: {
      variant: {
        primary: 'bg-brand-600 text-white hover:bg-brand-700 active:bg-brand-800',
        secondary: [
          'bg-[hsl(var(--surface-elevated))] text-[hsl(var(--foreground))]',
          'border border-[hsl(var(--border))]',
          'hover:bg-[hsl(var(--surface-subtle))]',
        ],
        ghost: 'bg-transparent text-[hsl(var(--foreground))] hover:bg-[hsl(var(--surface-subtle))]',
        destructive: 'bg-red-600 text-white hover:bg-red-700 active:bg-red-800',
      },
      size: {
        sm: 'h-8 w-8',
        md: 'h-10 w-10',
        lg: 'h-12 w-12',
      },
    },
    defaultVariants: {
      variant: 'ghost',
      size: 'md',
    },
  },
)

// ─── Types ─────────────────────────────────────────────────────────────────

export interface IconButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof iconButtonVariants> {
  /** The icon to display — required */
  icon: React.ReactNode
  /** Accessible label — required for icon-only buttons (WCAG 2.1 SC 1.1.1) */
  'aria-label': string
  /** Shows a loading spinner */
  isLoading?: boolean
}

// ─── Component ─────────────────────────────────────────────────────────────

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ variant, size, icon, isLoading = false, className, disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled ?? isLoading}
        aria-busy={isLoading}
        className={cn(iconButtonVariants({ variant, size }), className)}
        {...props}
      >
        {isLoading ? <Spinner size="sm" aria-hidden="true" /> : icon}
      </button>
    )
  },
)

IconButton.displayName = 'IconButton'
