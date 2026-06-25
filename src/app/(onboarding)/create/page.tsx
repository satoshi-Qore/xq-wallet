'use client'

/**
 * Create Wallet page — multi-step flow driven by onboardingStore.
 *
 * Steps:
 *   create:generate  → display generated mnemonic for backup
 *   create:verify    → word-order quiz (4 blanked words)
 *   create:password  → set + confirm vault password
 *   create:complete  → success banner → redirect to /dashboard
 *
 * Security invariants (SEC-01):
 *   - The mnemonic lives in component-local useState, never in any Zustand store.
 *   - After importWallet() succeeds, the local mnemonic ref is nulled immediately.
 *   - The store never sees the mnemonic — only the encrypted vault.
 *
 * Architecture: ARCHITECTURE.md §8 — Onboarding Architecture
 */

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { generate } from '@/core/crypto'
import { useWalletStore, useOnboardingStore, useSessionStore } from '@/lib/stores'
import {
  validatePasswordPair,
  checkVerifyAnswers,
  pickVerifyIndices,
  CREATE_STEPS,
} from '@/lib/onboarding'
import {
  SeedPhraseGrid,
  SeedWordInput,
  ConfirmPasswordForm,
  OnboardingStepper,
} from '@/components/onboarding'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import type { WordCount } from '@/domain/wallet'

// ─── Types ─────────────────────────────────────────────────────────────────

type VerifyAnswers = Readonly<Record<number, string>>

// ─── Page ──────────────────────────────────────────────────────────────────

export default function CreatePage() {
  const router = useRouter()

  // Store hooks — components never access WalletService directly
  const { importWallet, wallet, isLoading, error: storeError, clearError } = useWalletStore()
  const {
    wordCount,
    step,
    completedSteps,
    setMode,
    setStep,
    markStepComplete,
    completeVerification,
    setPasswordSet,
    setNewWalletId,
    _reset: resetOnboarding,
  } = useOnboardingStore()
  const { unlock } = useSessionStore()

  // Local state — mnemonic NEVER enters the store (SEC-01)
  const mnemonicRef = useRef<string | null>(null)
  const [displayMnemonic, setDisplayMnemonic] = useState<string[]>([])
  const [verifyIndices, setVerifyIndices] = useState<number[]>([])
  const [verifyAnswers, setVerifyAnswers] = useState<VerifyAnswers>({})
  const [verifyError, setVerifyError] = useState<string | null>(null)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [obscured, setObscured] = useState(false)

  // Initialise: set mode, generate mnemonic, advance to first step
  useEffect(() => {
    resetOnboarding()
    setMode('create')
    const phrase = generate((wordCount ?? 12) as WordCount)
    mnemonicRef.current = phrase
    setDisplayMnemonic(phrase.split(' '))
    setStep('create:generate')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Pick verification quiz indices when we enter the verify step
  useEffect(() => {
    if (step === 'create:verify' && displayMnemonic.length > 0 && verifyIndices.length === 0) {
      setVerifyIndices(pickVerifyIndices(displayMnemonic.length, 4))
    }
  }, [step, displayMnemonic.length, verifyIndices.length])

  // Redirect to dashboard once the wallet is created
  useEffect(() => {
    if (step === 'create:complete' && wallet) {
      setNewWalletId(wallet.id)
      router.push('/dashboard')
    }
  }, [step, wallet, setNewWalletId, router])

  // ── Step handlers ────────────────────────────────────────────────────────

  const handleBackedUp = useCallback(() => {
    markStepComplete('create:generate')
    setStep('create:verify')
    setVerifyError(null)
  }, [markStepComplete, setStep])

  const handleVerify = useCallback(() => {
    if (!mnemonicRef.current) return
    const ok = checkVerifyAnswers(mnemonicRef.current, verifyIndices, verifyAnswers)
    if (!ok) {
      setVerifyError('One or more words are incorrect. Please check and try again.')
      return
    }
    setVerifyError(null)
    completeVerification()
    markStepComplete('create:verify')
    setStep('create:password')
  }, [mnemonicRef, verifyIndices, verifyAnswers, completeVerification, markStepComplete, setStep])

  const handleSetPassword = useCallback(
    async (password: string) => {
      if (!mnemonicRef.current) return
      const validation = validatePasswordPair(password, password) // already validated inside ConfirmPasswordForm
      if (!validation.valid) {
        setPasswordError(validation.error)
        return
      }
      clearError()
      setPasswordError(null)
      try {
        await importWallet({ mnemonic: mnemonicRef.current, password })
        mnemonicRef.current = null // SEC-01: clear immediately after vault creation
        setDisplayMnemonic([])
        setPasswordSet(true)
        unlock()
        markStepComplete('create:password')
        setStep('create:complete')
      } catch {
        // storeError holds the typed WalletError
        setPasswordError(storeError?.message ?? 'An error occurred. Please try again.')
      }
    },
    [importWallet, clearError, setPasswordSet, unlock, markStepComplete, setStep, storeError],
  )

  // ── Step rendering ───────────────────────────────────────────────────────

  const stepperCompletedKeys = completedSteps.filter((s) =>
    CREATE_STEPS.some((cs) => cs.key === s),
  ) as string[]

  return (
    <div className="flex min-h-dvh flex-col items-center justify-start px-4 py-8">
      <div className="w-full max-w-lg space-y-8">
        {/* Header */}
        <header className="space-y-1 text-center">
          <h1 className="text-2xl font-bold text-[hsl(var(--foreground))]">Create Wallet</h1>
          <p className="text-sm text-[hsl(var(--muted))]">Set up your new non-custodial wallet.</p>
        </header>

        {/* Stepper — hide on setup/complete */}
        {step !== 'create:complete' && (
          <OnboardingStepper
            steps={CREATE_STEPS}
            currentKey={step}
            completedKeys={stepperCompletedKeys}
          />
        )}

        {/* ── Step: generate ─────────────────────────────────────── */}
        {step === 'create:generate' && (
          <section aria-labelledby="generate-heading" className="space-y-6">
            <div className="space-y-1">
              <h2
                id="generate-heading"
                className="text-base font-semibold text-[hsl(var(--foreground))]"
              >
                Your recovery phrase
              </h2>
              <p className="text-sm text-[hsl(var(--muted))]">
                Write down these {displayMnemonic.length} words in order and store them safely. This
                phrase is the only way to recover your wallet.
              </p>
            </div>

            <div className="relative">
              <SeedPhraseGrid words={displayMnemonic} obscured={obscured} />
              <button
                type="button"
                onClick={() => setObscured((v) => !v)}
                className="absolute -top-8 right-0 text-xs text-brand-600 underline underline-offset-2 hover:text-brand-700 dark:text-brand-400"
              >
                {obscured ? 'Show phrase' : 'Hide phrase'}
              </button>
            </div>

            <div className="rounded-lg border border-amber-500/30 bg-amber-50 px-4 py-3 dark:bg-amber-950/20">
              <p className="text-xs font-medium text-amber-800 dark:text-amber-300">
                ⚠ Never share your recovery phrase. XQ Wallet staff will never ask for it.
              </p>
            </div>

            <Button variant="primary" size="lg" fullWidth onClick={handleBackedUp}>
              I&apos;ve written it down — continue
            </Button>
          </section>
        )}

        {/* ── Step: verify ───────────────────────────────────────── */}
        {step === 'create:verify' && (
          <section aria-labelledby="verify-heading" className="space-y-6">
            <div className="space-y-1">
              <h2
                id="verify-heading"
                className="text-base font-semibold text-[hsl(var(--foreground))]"
              >
                Verify your phrase
              </h2>
              <p className="text-sm text-[hsl(var(--muted))]">
                Enter the missing words to confirm you&apos;ve saved your recovery phrase.
              </p>
            </div>

            <div className="space-y-3" role="group" aria-label="Word verification inputs">
              {verifyIndices.map((wordIdx) => (
                <div key={wordIdx} className="flex items-center gap-3">
                  <span className="min-w-[4rem] text-sm text-[hsl(var(--muted))]">
                    Word {wordIdx + 1}
                  </span>
                  <div className="flex-1">
                    <SeedWordInput
                      index={wordIdx}
                      value={verifyAnswers[wordIdx] ?? ''}
                      onChange={(v) => setVerifyAnswers((prev) => ({ ...prev, [wordIdx]: v }))}
                      hasError={
                        verifyError !== null &&
                        (verifyAnswers[wordIdx] ?? '').length > 0 &&
                        (verifyAnswers[wordIdx] ?? '').toLowerCase() !==
                          displayMnemonic[wordIdx]?.toLowerCase()
                      }
                    />
                  </div>
                </div>
              ))}
            </div>

            {verifyError && (
              <p role="alert" className="text-sm text-red-500 dark:text-red-400">
                {verifyError}
              </p>
            )}

            <Button variant="primary" size="lg" fullWidth onClick={handleVerify}>
              Confirm
            </Button>
            <Button
              variant="ghost"
              size="md"
              fullWidth
              onClick={() => {
                setStep('create:generate')
                setVerifyError(null)
                setVerifyAnswers({})
              }}
            >
              Back — view phrase again
            </Button>
          </section>
        )}

        {/* ── Step: password ─────────────────────────────────────── */}
        {step === 'create:password' && (
          <section aria-labelledby="password-heading" className="space-y-6">
            <div className="space-y-1">
              <h2
                id="password-heading"
                className="text-base font-semibold text-[hsl(var(--foreground))]"
              >
                Protect your wallet
              </h2>
              <p className="text-sm text-[hsl(var(--muted))]">
                Choose a strong password to encrypt your vault. You&apos;ll need this to unlock your
                wallet.
              </p>
            </div>

            <ConfirmPasswordForm
              onSubmit={handleSetPassword}
              isLoading={isLoading}
              externalError={passwordError ?? storeError?.message ?? null}
              submitLabel="Create wallet"
            />
          </section>
        )}

        {/* ── Step: complete ─────────────────────────────────────── */}
        {step === 'create:complete' && (
          <section aria-labelledby="complete-heading" className="space-y-6 text-center">
            <h2
              id="complete-heading"
              className="text-base font-semibold text-[hsl(var(--foreground))]"
            >
              Wallet created!
            </h2>
            <Spinner className="mx-auto" aria-label="Redirecting to dashboard" />
            <p className="text-sm text-[hsl(var(--muted))]">Redirecting to your dashboard…</p>
          </section>
        )}
      </div>
    </div>
  )
}
