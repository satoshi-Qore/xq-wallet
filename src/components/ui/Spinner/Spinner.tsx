'use client'

import * as React from 'react'
import { cn } from '@/lib/cn'

// ─── Types ─────────────────────────────────────────────────────────────────

export interface SpinnerProps extends React.SVGAttributes<SVGSVGElement> {
  /** Size preset */
  size?: 'sm' | 'md' | 'lg'
  /** Accessible label (defaults to "Loading") */
  'aria-label'?: string
}

const sizeMap = {
  sm: 'h-4 w-4',
  md: 'h-6 w-6',
  lg: 'h-8 w-8',
} as const

// ─── Component ─────────────────────────────────────────────────────────────

export function Spinner({
  size = 'md',
  className,
  'aria-label': ariaLabel = 'Loading',
  'aria-hidden': ariaHidden,
  ...props
}: SpinnerProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      role={ariaHidden ? undefined : 'status'}
      aria-label={ariaHidden ? undefined : ariaLabel}
      aria-hidden={ariaHidden}
      className={cn('animate-spin text-current', sizeMap[size], className)}
      {...props}
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  )
}
