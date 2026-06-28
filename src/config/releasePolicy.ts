import { WalletError } from '@/domain/errors'

export type ReleaseCapability = 'mainnet' | 'transactionSigning' | 'transactionBroadcasting'

export interface ReleasePolicy {
  readonly channel: 'development' | 'production'
  readonly approvalId: string | null
  readonly capabilities: Readonly<Record<ReleaseCapability, boolean>>
}

interface ApprovedProductionRelease {
  readonly approvalId: string
  readonly approvedAt: string
}

/**
 * Production capabilities require an explicit, reviewed source change with
 * approval metadata. Client-side environment variables cannot promote a build.
 */
const APPROVED_PRODUCTION_RELEASE: ApprovedProductionRelease | null = null

function createActiveReleasePolicy(approval: ApprovedProductionRelease | null): ReleasePolicy {
  const approved = approval !== null

  return Object.freeze({
    channel: approved ? 'production' : 'development',
    approvalId: approval?.approvalId ?? null,
    capabilities: Object.freeze({
      mainnet: approved,
      transactionSigning: approved,
      transactionBroadcasting: approved,
    }),
  })
}

export const ACTIVE_RELEASE_POLICY: ReleasePolicy = createActiveReleasePolicy(
  APPROVED_PRODUCTION_RELEASE,
)

export function assertReleaseCapability(capability: ReleaseCapability): void {
  if (!ACTIVE_RELEASE_POLICY.capabilities[capability]) {
    throw new WalletError(
      'RELEASE_CAPABILITY_DISABLED',
      'This capability is disabled in development and testnet-only releases.',
    )
  }
}
