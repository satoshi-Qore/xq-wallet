'use client'

import * as React from 'react'
import * as ProgressPrimitive from '@radix-ui/react-progress'
import { cn } from '@/lib/cn'

// ─── Types ─────────────────────────────────────────────────────────────────

export interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Value 0–100. Pass null for indeterminate. */
  value?: number | null
  /** Accessible label */
  'aria-label'?: string
  /** Size preset */
  size?: 'sm' | 'md' | 'lg'
  /** Colour variant */
  variant?: 'brand' | 'success' | 'warning' | 'error'
}

const sizeMap = {
  sm: 'h-1',
  md: 'h-2',
  lg: 'h-3',
} as const

const variantMap = {
  brand: 'bg-brand-500',
  success: 'bg-green-500',
  warning: 'bg-amber-500',
  error: 'bg-red-500',
} as const

// ─── Component ─────────────────────────────────────────────────────────────

export const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(
  (
    {
      value = null,
      size = 'md',
      variant = 'brand',
      className,
      'aria-label': ariaLabel = 'Progress',
      ...props
    },
    ref,
  ) => {
    const isIndeterminate = value === null

    return (
      <ProgressPrimitive.Root
        ref={ref}
        value={value ?? undefined}
        max={100}
        aria-label={ariaLabel}
        className={cn(
          'relative w-full overflow-hidden rounded-full bg-[hsl(var(--surface-elevated))]',
          sizeMap[size],
          className,
        )}
        {...props}
      >
        <ProgressPrimitive.Indicator
          className={cn(
            'h-full rounded-full transition-all duration-500 ease-in-out',
            variantMap[variant],
            isIndeterminate && 'animate-[indeterminate_1.5s_ease-in-out_infinite] w-1/3',
          )}
          style={!isIndeterminate ? { transform: `translateX(-${100 - (value ?? 0)}%)` } : {}}
        />
      </ProgressPrimitive.Root>
    )
  },
)

Progress.displayName = 'Progress'
