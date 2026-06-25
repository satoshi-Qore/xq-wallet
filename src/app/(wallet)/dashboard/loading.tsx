/**
 * Dashboard loading skeleton — shown during streaming/suspense.
 * Uses the production Skeleton component from ui/Skeleton.
 * Matches dashboard layout to prevent cumulative layout shift.
 */

import { PageContainer } from '@/components/layout/PageContainer'
import { Skeleton } from '@/components/ui/Skeleton'

export default function DashboardLoading() {
  return (
    <PageContainer>
      <div className="space-y-6">
        {/* Balance card skeleton — P0-01: bg-surface, border hsl() */}
        <div className="rounded-xl border border-[hsl(var(--border))] bg-surface p-6">
          <Skeleton variant="text" width="6rem" height="0.75rem" />
          <Skeleton className="mt-3" width="10rem" height="2.5rem" />
          <Skeleton className="mt-3" variant="text" width="16rem" />
          <Skeleton className="mt-5" width="8rem" height="2.5rem" />
        </div>

        {/* Quick actions skeleton */}
        <div>
          <Skeleton className="mb-3" variant="text" width="7rem" />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="rounded-xl border border-[hsl(var(--border))] bg-surface p-4">
                <Skeleton variant="block" width="2.25rem" height="2.25rem" />
                <Skeleton className="mt-2" variant="text" width="5rem" />
                <Skeleton className="mt-1" variant="text" width="8rem" />
              </div>
            ))}
          </div>
        </div>

        {/* Activity skeleton */}
        <div className="rounded-xl border border-[hsl(var(--border))] bg-surface">
          <div className="border-b border-[hsl(var(--border))] px-5 py-4">
            <Skeleton variant="text" width="8rem" />
          </div>
          <div className="space-y-4 px-5 py-6">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex items-center gap-4">
                <Skeleton variant="circular" width="2.5rem" height="2.5rem" />
                <div className="flex-1 space-y-1">
                  <Skeleton variant="text" width="8rem" />
                  <Skeleton variant="text" width="5rem" />
                </div>
                <Skeleton variant="text" width="4rem" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </PageContainer>
  )
}
