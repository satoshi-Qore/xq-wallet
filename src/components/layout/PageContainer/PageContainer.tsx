/**
 * PageContainer — constrains page content width and applies standard padding.
 *
 * Every wallet page wraps its content in this component for consistent
 * horizontal rhythm across all screen sizes.
 *
 * Not a client component — pure presentational wrapper.
 */

import { cn } from '@/lib/utils'

interface PageContainerProps {
  children: React.ReactNode
  /** Remove max-width constraint for full-bleed layouts */
  fullWidth?: boolean
  className?: string
}

export function PageContainer({
  children,
  fullWidth = false,
  className,
}: PageContainerProps) {
  return (
    <div
      className={cn(
        'w-full px-4 py-6 md:px-6 md:py-8',
        !fullWidth && 'mx-auto max-w-4xl',
        className,
      )}
    >
      {children}
    </div>
  )
}
