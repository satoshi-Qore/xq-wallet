/**
 * Root page — redirects to the wallet dashboard.
 *
 * In Sprint 2+, this will check wallet state:
 *  - No wallet → redirect to /onboarding
 *  - Locked wallet → redirect to /unlock
 *  - Unlocked wallet → redirect to /dashboard
 *
 * For Sprint 1, always redirect to /dashboard (shell-only).
 */

import { redirect } from 'next/navigation'

export default function RootPage() {
  redirect('/dashboard')
}
