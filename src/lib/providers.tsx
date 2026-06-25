'use client'

/**
 * ClientProviders — wraps the entire application with all client-side
 * context providers. Server-rendered layout imports this component.
 *
 * Order matters:
 *  1. ThemeProvider (next-themes) — must be outermost to prevent FOUC
 *  2. Future: QueryClientProvider (TanStack Query — added in Sprint 2)
 */

import type { ReactNode } from 'react'
import { ThemeProvider } from 'next-themes'

interface ClientProvidersProps {
  children: ReactNode
}

export function ClientProviders({ children }: ClientProvidersProps) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      storageKey="xqw-theme"
    >
      {children}
    </ThemeProvider>
  )
}
