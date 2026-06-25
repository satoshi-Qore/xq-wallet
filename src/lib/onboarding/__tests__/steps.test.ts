/**
 * steps.test.ts
 *
 * Tests for checkStepGuard() navigation guards and step metadata helpers.
 */

import { describe, it, expect } from 'vitest'
import {
  checkStepGuard,
  CREATE_STEPS,
  IMPORT_STEPS,
  getStepMeta,
  type StepGuardInput,
} from '../steps'
import type { OnboardingStep } from '@/domain/onboarding'

// ─── Fixture builders ──────────────────────────────────────────────────────

function makeState(overrides: Partial<StepGuardInput> = {}): StepGuardInput {
  return {
    mode: null,
    verificationComplete: false,
    passwordSet: false,
    completedSteps: [],
    ...overrides,
  }
}

// ─── setup step ────────────────────────────────────────────────────────────

describe('checkStepGuard() — setup', () => {
  it('is always allowed regardless of state', () => {
    expect(checkStepGuard('setup', makeState()).allowed).toBe(true)
  })

  it('redirectTo is "setup" when allowed', () => {
    expect(checkStepGuard('setup', makeState()).redirectTo).toBe('setup')
  })
})

// ─── create flow ───────────────────────────────────────────────────────────

describe('checkStepGuard() — create:generate', () => {
  it('allowed when mode is "create"', () => {
    expect(checkStepGuard('create:generate', makeState({ mode: 'create' })).allowed).toBe(true)
  })

  it('denied when mode is null → redirects to setup', () => {
    const result = checkStepGuard('create:generate', makeState())
    expect(result.allowed).toBe(false)
    expect(result.redirectTo).toBe('setup')
  })

  it('denied when mode is "import"', () => {
    const result = checkStepGuard('create:generate', makeState({ mode: 'import' }))
    expect(result.allowed).toBe(false)
    expect(result.redirectTo).toBe('setup')
  })
})

describe('checkStepGuard() — create:verify', () => {
  it('denied without create:generate in completedSteps', () => {
    const result = checkStepGuard('create:verify', makeState({ mode: 'create' }))
    expect(result.allowed).toBe(false)
    expect(result.redirectTo).toBe('create:generate')
  })

  it('allowed after create:generate is completed', () => {
    const result = checkStepGuard(
      'create:verify',
      makeState({ mode: 'create', completedSteps: ['create:generate'] }),
    )
    expect(result.allowed).toBe(true)
  })
})

describe('checkStepGuard() — create:password', () => {
  it('denied without generate completed', () => {
    const result = checkStepGuard('create:password', makeState({ mode: 'create' }))
    expect(result.allowed).toBe(false)
    expect(result.redirectTo).toBe('create:generate')
  })

  it('denied without verificationComplete', () => {
    const result = checkStepGuard(
      'create:password',
      makeState({ mode: 'create', completedSteps: ['create:generate'] }),
    )
    expect(result.allowed).toBe(false)
    expect(result.redirectTo).toBe('create:verify')
  })

  it('allowed after generate + verification complete', () => {
    const result = checkStepGuard(
      'create:password',
      makeState({
        mode: 'create',
        completedSteps: ['create:generate'],
        verificationComplete: true,
      }),
    )
    expect(result.allowed).toBe(true)
  })
})

describe('checkStepGuard() — create:complete', () => {
  it('denied without passwordSet', () => {
    const result = checkStepGuard('create:complete', makeState({ mode: 'create' }))
    expect(result.allowed).toBe(false)
    expect(result.redirectTo).toBe('create:password')
  })

  it('allowed when passwordSet is true', () => {
    const result = checkStepGuard(
      'create:complete',
      makeState({ mode: 'create', passwordSet: true }),
    )
    expect(result.allowed).toBe(true)
  })
})

// ─── import flow ───────────────────────────────────────────────────────────

describe('checkStepGuard() — import:phrase', () => {
  it('allowed when mode is "import"', () => {
    expect(checkStepGuard('import:phrase', makeState({ mode: 'import' })).allowed).toBe(true)
  })

  it('denied when mode is null', () => {
    const result = checkStepGuard('import:phrase', makeState())
    expect(result.allowed).toBe(false)
    expect(result.redirectTo).toBe('setup')
  })

  it('denied when mode is "create"', () => {
    const result = checkStepGuard('import:phrase', makeState({ mode: 'create' }))
    expect(result.allowed).toBe(false)
  })
})

describe('checkStepGuard() — import:password', () => {
  it('denied without import:phrase completed', () => {
    const result = checkStepGuard('import:password', makeState({ mode: 'import' }))
    expect(result.allowed).toBe(false)
    expect(result.redirectTo).toBe('import:phrase')
  })

  it('allowed after import:phrase completed', () => {
    const result = checkStepGuard(
      'import:password',
      makeState({ mode: 'import', completedSteps: ['import:phrase'] }),
    )
    expect(result.allowed).toBe(true)
  })
})

describe('checkStepGuard() — import:complete', () => {
  it('denied without passwordSet', () => {
    const result = checkStepGuard('import:complete', makeState({ mode: 'import' }))
    expect(result.allowed).toBe(false)
    expect(result.redirectTo).toBe('import:password')
  })

  it('allowed when passwordSet is true', () => {
    const result = checkStepGuard(
      'import:complete',
      makeState({ mode: 'import', passwordSet: true }),
    )
    expect(result.allowed).toBe(true)
  })
})

// ─── Step metadata ─────────────────────────────────────────────────────────

describe('CREATE_STEPS', () => {
  it('has 4 steps', () => expect(CREATE_STEPS).toHaveLength(4))

  it('first step is create:generate', () => expect(CREATE_STEPS[0].key).toBe('create:generate'))

  it('last step is create:complete', () => expect(CREATE_STEPS[3].key).toBe('create:complete'))

  it('positions are 1-based and sequential', () => {
    CREATE_STEPS.forEach((s, i) => expect(s.position).toBe(i + 1))
  })
})

describe('IMPORT_STEPS', () => {
  it('has 3 steps', () => expect(IMPORT_STEPS).toHaveLength(3))
  it('first step is import:phrase', () => expect(IMPORT_STEPS[0].key).toBe('import:phrase'))
  it('last step is import:complete', () => expect(IMPORT_STEPS[2].key).toBe('import:complete'))
})

describe('getStepMeta()', () => {
  it('returns metadata for create:generate', () => {
    const meta = getStepMeta('create:generate', 'create')
    expect(meta?.key).toBe('create:generate')
    expect(meta?.label).toBeTruthy()
    expect(meta?.position).toBe(1)
  })

  it('returns undefined for a step not in the flow', () => {
    const meta = getStepMeta('import:phrase' as OnboardingStep, 'create')
    expect(meta).toBeUndefined()
  })

  it('returns metadata for import:password from import flow', () => {
    const meta = getStepMeta('import:password', 'import')
    expect(meta?.position).toBe(2)
  })
})
