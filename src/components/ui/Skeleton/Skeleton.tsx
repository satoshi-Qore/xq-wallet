import * as React from 'react'
import { cn } from '@/lib/cn'

// ─── Types ─────────────────────────────────────────────────────────────────

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Shape variant */
  variant?: 'block' | 'text' | 'circular'
  /** Width (CSS value) — defaults to 100% */
  width?: string | number
  /** Height (CSS value) */
  height?: string | number
}

// ─── Component ─────────────────────────────────────────────────────────────

export function Skeleton({
  variant = 'block',
  width,
  height,
  className,
  style,
  ...props
}: SkeletonProps) {
  const shapeClass = {
    block: 'rounded-md',
    text: 'rounded h-4 w-full',
    circular: 'rounded-full',
  }[variant]

  return (
    <div
      role="status"
      aria-label="Loading…"
      aria-busy="true"
      className={cn(
        'animate-pulse bg-[hsl(var(--surface-elevated))] dark:bg-gray-800',
        shapeClass,
        className,
      )}
      style={{ width, height, ...style }}
      {...props}
    />
  )
}

// ─── Composition helpers ────────────────────────────────────────────────────

/** Pre-built skeleton for a card with avatar + text lines */
export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-start gap-3 p-4', className)}>
      <Skeleton variant="circular" width={40} height={40} />
      <div className="flex-1 space-y-2">
        <Skeleton variant="text" width="60%" />
        <Skeleton variant="text" width="40%" />
      </div>
    </div>
  )
}
