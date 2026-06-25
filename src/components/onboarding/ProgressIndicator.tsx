'use client'

/**
 * ProgressIndicator — simple dot-based or bar-based progress indicator.
 *
 * Accessibility:
 *   - role="progressbar" with aria-valuenow / aria-valuemin / aria-valuemax
 *   - aria-label describes what progress is being tracked
 */

import { cn } from '@/lib/cn'

export interface ProgressIndicatorProps {
  current: number
  total: number
  label?: string
  variant?: 'dots' | 'bar'
  className?: string
}

export function ProgressIndicator({
  current,
  total,
  label = 'Progress',
  variant = 'bar',
  className,
}: ProgressIndicatorProps) {
  const pct = total > 0 ? Math.round((current / total) * 100) : 0

  if (variant === 'dots') {
    return (
      <div
        role="progressbar"
        aria-label={label}
        aria-valuenow={current}
        aria-valuemin={0}
        aria-valuemax={total}
        className={cn('flex items-center justify-center gap-2', className)}
      >
        {Array.from({ length: total }, (_, i) => (
          <span
            key={i}
            aria-hidden="true"
            className={cn(
              'h-2 w-2 rounded-full transition-colors duration-200',
              i < current ? 'bg-brand-600' : 'bg-[hsl(var(--border))]',
            )}
          />
        ))}
      </div>
    )
  }

  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn('h-1.5 w-full overflow-hidden rounded-full bg-[hsl(var(--border))]', className)}
    >
      <div
        aria-hidden="true"
        style={{ width: `${pct}%` }}
        className="h-full bg-brand-600 transition-all duration-300 ease-in-out"
      />
    </div>
  )
}
