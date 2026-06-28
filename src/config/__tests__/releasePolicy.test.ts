import { describe, expect, it } from 'vitest'
import { ACTIVE_RELEASE_POLICY, assertReleaseCapability } from '../releasePolicy'

describe('release policy', () => {
  it('defaults to an immutable development policy with no dangerous capabilities', () => {
    expect(ACTIVE_RELEASE_POLICY).toEqual({
      channel: 'development',
      approvalId: null,
      capabilities: {
        mainnet: false,
        transactionSigning: false,
        transactionBroadcasting: false,
      },
    })
    expect(Object.isFrozen(ACTIVE_RELEASE_POLICY)).toBe(true)
    expect(Object.isFrozen(ACTIVE_RELEASE_POLICY.capabilities)).toBe(true)
  })

  it.each(['mainnet', 'transactionSigning', 'transactionBroadcasting'] as const)(
    'rejects the %s capability',
    (capability) => {
      expect(() => assertReleaseCapability(capability)).toThrow(
        expect.objectContaining({ code: 'RELEASE_CAPABILITY_DISABLED' }),
      )
    },
  )
})
