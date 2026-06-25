'use client'

import * as React from 'react'
import * as AvatarPrimitive from '@radix-ui/react-avatar'
import { cn } from '@/lib/cn'

// ─── Types ─────────────────────────────────────────────────────────────────

export interface AvatarProps {
  /** Image source URL */
  src?: string
  /** Accessible alt text for the image */
  alt?: string
  /** Fallback text shown when image fails (e.g. initials "AB") */
  fallback: string
  /** Size preset */
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  /** Additional class names */
  className?: string
}

const sizeMap = {
  xs: 'h-6 w-6 text-xs',
  sm: 'h-8 w-8 text-sm',
  md: 'h-10 w-10 text-sm',
  lg: 'h-12 w-12 text-base',
  xl: 'h-16 w-16 text-lg',
} as const

// ─── Component ─────────────────────────────────────────────────────────────

export function Avatar({ src, alt, fallback, size = 'md', className }: AvatarProps) {
  return (
    <AvatarPrimitive.Root
      className={cn(
        'relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full',
        'bg-brand-100 dark:bg-brand-900',
        sizeMap[size],
        className,
      )}
    >
      {src && (
        <AvatarPrimitive.Image
          src={src}
          alt={alt ?? fallback}
          className="h-full w-full object-cover"
        />
      )}
      <AvatarPrimitive.Fallback
        className="flex h-full w-full items-center justify-center font-semibold text-brand-700 dark:text-brand-300"
        delayMs={src ? 600 : 0}
      >
        {fallback.slice(0, 2).toUpperCase()}
      </AvatarPrimitive.Fallback>
    </AvatarPrimitive.Root>
  )
}
