/**
 * Onboarding layout — no AppShell.
 *
 * Onboarding pages (create, import, lock) are full-screen flows that do not
 * show the wallet navigation shell. This layout provides only the minimum
 * structure: a client-side wrapper that applies the background colour and
 * constrains the width for centered content.
 *
 * Route group: src/app/(onboarding)/
 */

import type { ReactNode } from 'react'

interface OnboardingLayoutProps {
  children: ReactNode
}

export default function OnboardingLayout({ children }: OnboardingLayoutProps) {
  return <div className="min-h-dvh bg-[hsl(var(--background))]">{children}</div>
}
