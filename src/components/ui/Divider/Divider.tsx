import * as React from 'react'
import { cn } from '@/lib/cn'

// ─── Types ─────────────────────────────────────────────────────────────────

export interface DividerProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Axis of separation */
  orientation?: 'horizontal' | 'vertical'
  /** Optional centred label */
  label?: string
}

// ─── Component ─────────────────────────────────────────────────────────────

export function Divider({
  orientation = 'horizontal',
  label,
  className,
  ...props
}: DividerProps) {
  if (orientation === 'vertical') {
    return (
      <div
        role="separator"
        aria-orientation="vertical"
        className={cn('mx-2 w-px self-stretch bg-[hsl(var(--border))]', className)}
        {...props}
      />
    )
  }

  if (label) {
    return (
      <div
        role="separator"
        aria-orientation="horizontal"
        className={cn('flex items-center gap-3', className)}
        {...props}
      >
        <div className="h-px flex-1 bg-[hsl(var(--border))]" />
        <span className="shrink-0 text-xs text-[hsl(var(--muted))]">{label}</span>
        <div className="h-px flex-1 bg-[hsl(var(--border))]" />
      </div>
    )
  }

  return (
    <div
      role="separator"
      aria-orientation="horizontal"
      className={cn('h-px w-full bg-[hsl(var(--border))]', className)}
      {...props}
    />
  )
}
