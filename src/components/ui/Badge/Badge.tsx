import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/cn'

// ─── Variants ──────────────────────────────────────────────────────────────

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full font-medium whitespace-nowrap',
  {
    variants: {
      variant: {
        default: 'bg-[hsl(var(--surface-elevated))] text-[hsl(var(--foreground))] border border-[hsl(var(--border))]',
        success: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
        warning: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
        error: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
        info: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
        brand: 'bg-brand-100 text-brand-800 dark:bg-brand-900/30 dark:text-brand-400',
      },
      size: {
        sm: 'px-2 py-0.5 text-xs',
        md: 'px-2.5 py-0.5 text-sm',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
    },
  },
)

// ─── Types ─────────────────────────────────────────────────────────────────

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  /** Optional leading dot indicator */
  dot?: boolean
}

// ─── Component ─────────────────────────────────────────────────────────────

export function Badge({ variant, size, dot = false, className, children, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant, size }), className)} {...props}>
      {dot && (
        <span
          className="h-1.5 w-1.5 rounded-full bg-current"
          aria-hidden="true"
        />
      )}
      {children}
    </span>
  )
}
