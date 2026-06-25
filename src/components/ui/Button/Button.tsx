'use client'

import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/cn'
import { focusRing, disabledState, transition } from '@/lib/tokens'
import { Spinner } from '@/components/ui/Spinner/Spinner'

// ─── Variants ──────────────────────────────────────────────────────────────

const buttonVariants = cva(
  [
    'inline-flex items-center justify-center gap-2',
    'rounded-lg font-medium whitespace-nowrap',
    'select-none cursor-pointer',
    transition,
    focusRing,
    disabledState,
  ],
  {
    variants: {
      variant: {
        primary: [
          'bg-brand-600 text-white',
          'hover:bg-brand-700 active:bg-brand-800',
        ],
        secondary: [
          'bg-[hsl(var(--surface-elevated))] text-[hsl(var(--foreground))]',
          'border border-[hsl(var(--border))]',
          'hover:bg-[hsl(var(--surface-subtle))] active:opacity-90',
        ],
        ghost: [
          'bg-transparent text-[hsl(var(--foreground))]',
          'hover:bg-[hsl(var(--surface-subtle))] active:opacity-90',
        ],
        destructive: [
          'bg-red-600 text-white',
          'hover:bg-red-700 active:bg-red-800',
        ],
        outline: [
          'bg-transparent text-brand-600 dark:text-brand-400',
          'border border-brand-600 dark:border-brand-400',
          'hover:bg-brand-50 dark:hover:bg-brand-950 active:opacity-90',
        ],
      },
      size: {
        sm: 'h-8 px-3 text-sm',
        md: 'h-10 px-4 text-sm',
        lg: 'h-12 px-6 text-base',
      },
      fullWidth: {
        true: 'w-full',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  },
)

// ─── Types ─────────────────────────────────────────────────────────────────

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  /** Shows a loading spinner and disables the button */
  isLoading?: boolean
  /** Icon rendered before the label */
  leftIcon?: React.ReactNode
  /** Icon rendered after the label */
  rightIcon?: React.ReactNode
}

// ─── Component ─────────────────────────────────────────────────────────────

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant,
      size,
      fullWidth,
      isLoading = false,
      leftIcon,
      rightIcon,
      className,
      children,
      disabled,
      ...props
    },
    ref,
  ) => {
    return (
      <button
        ref={ref}
        disabled={disabled ?? isLoading}
        aria-busy={isLoading}
        className={cn(buttonVariants({ variant, size, fullWidth }), className)}
        {...props}
      >
        {isLoading ? (
          <Spinner size="sm" aria-hidden="true" />
        ) : (
          leftIcon && <span className="shrink-0">{leftIcon}</span>
        )}
        {children}
        {!isLoading && rightIcon && <span className="shrink-0">{rightIcon}</span>}
      </button>
    )
  },
)

Button.displayName = 'Button'
