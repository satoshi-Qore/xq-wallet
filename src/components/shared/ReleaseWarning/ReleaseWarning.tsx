import { AlertTriangle } from 'lucide-react'
import { ACTIVE_RELEASE_POLICY } from '@/config/releasePolicy'

export function ReleaseWarning() {
  if (ACTIVE_RELEASE_POLICY.channel === 'production') {
    return null
  }

  return (
    <div
      role="status"
      aria-label="Development release warning"
      className="z-50 flex min-h-9 shrink-0 items-center justify-center gap-2 border-b border-amber-500/40 bg-amber-100 px-4 py-2 text-center text-xs font-semibold tracking-wide text-amber-950 dark:bg-amber-950 dark:text-amber-100"
    >
      <AlertTriangle aria-hidden="true" className="size-4 shrink-0" />
      Development / Testnet Only — Do not use with real funds
    </div>
  )
}
