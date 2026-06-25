'use client'

/**
 * Import Wallet page — multi-step flow.
 *
 * Steps:
 *   import:phrase    → enter 12/15/18/21/24 word recovery phrase
 *   import:password  → set vault password
 *   import:complete  → redirect to /dashboard
 *
 * Security: the mnemonic is passed directly from local state to importWallet().
 * It is never placed in any Zustand store.
 *
 * Architecture: ARCHITECTURE.md §8 — Onboarding Architecture
 */

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useWalletStore, useOnboardingStore, useSessionStore } from '@/lib/stores'
import {
  validateMnemonicWords,
  mnemonicSummaryError,
  IMPORT_WORD_COUNTS,
  type ImportWordCount,
  IMPORT_STEPS,
} from '@/lib/onboarding'
import { SeedWordInput, ConfirmPasswordForm, OnboardingStepper } from '@/components/onboarding'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'

// ─── Page ──────────────────────────────────────────────────────────────────

export default function ImportPage() {
  const router = useRouter()

  const { importWallet, wallet, isLoading, error: storeError, clearError } = useWalletStore()
  const {
    step,
    completedSteps,
    setMode,
    setStep,
    markStepComplete,
    setPasswordSet,
    setNewWalletId,
    _reset: resetOnboarding,
  } = useOnboardingStore()
  const { unlock } = useSessionStore()

  // Local phrase state — never in any store
  const [wordCount, setWordCount] = useState<ImportWordCount>(12)
  const [words, setWords] = useState<string[]>(Array(12).fill(''))
  const [phraseError, setPhraseError] = useState<string | null>(null)
  // Holds the validated mnemonic string between import:phrase and import:password
  const [validatedMnemonic, setValidatedMnemonic] = useState<string | null>(null)

  // Initialise
  useEffect(() => {
    resetOnboarding()
    setMode('import')
    setStep('import:phrase')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Redirect once wallet is created
  useEffect(() => {
    if (step === 'import:complete' && wallet) {
      setNewWalletId(wallet.id)
      router.push('/dashboard')
    }
  }, [step, wallet, setNewWalletId, router])

  // ── Word count change ────────────────────────────────────────────────────

  const handleWordCountChange = useCallback((count: ImportWordCount) => {
    setWordCount(count)
    setWords(Array(count).fill(''))
    setPhraseError(null)
  }, [])

  const handleWordChange = useCallback((index: number, value: string) => {
    setWords((prev) => {
      const next = [...prev]
      next[index] = value
      return next
    })
  }, [])

  // ── Phrase step ──────────────────────────────────────────────────────────

  const mnemonicValidation = validateMnemonicWords(words)
  const mnemonicError = mnemonicSummaryError(mnemonicValidation)

  const handlePhraseSubmit = useCallback(() => {
    if (!mnemonicValidation.isValid) {
      setPhraseError(mnemonicError ?? 'Please complete your recovery phrase.')
      return
    }
    setPhraseError(null)
    const phrase = words.map((w) => w.trim().toLowerCase()).join(' ')
    setValidatedMnemonic(phrase)
    markStepComplete('import:phrase')
    setStep('import:password')
  }, [mnemonicValidation, mnemonicError, words, markStepComplete, setStep])

  // ── Password step ────────────────────────────────────────────────────────

  const handleSetPassword = useCallback(
    async (password: string) => {
      if (!validatedMnemonic) return
      clearError()
      try {
        await importWallet({ mnemonic: validatedMnemonic, password })
        setValidatedMnemonic(null)
        setPasswordSet(true)
        unlock()
        markStepComplete('import:password')
        setStep('import:complete')
      } catch {
        // storeError surfaced via externalError
      }
    },
    [
      validatedMnemonic,
      importWallet,
      clearError,
      setPasswordSet,
      unlock,
      markStepComplete,
      setStep,
    ],
  )

  // ── Rendering ─────────────────────────────────────────────────────────────

  const stepperCompletedKeys = completedSteps.filter((s) =>
    IMPORT_STEPS.some((is) => is.key === s),
  ) as string[]

  return (
    <div className="flex min-h-dvh flex-col items-center justify-start px-4 py-8">
      <div className="w-full max-w-lg space-y-8">
        {/* Header */}
        <header className="space-y-1 text-center">
          <h1 className="text-2xl font-bold text-[hsl(var(--foreground))]">Import Wallet</h1>
          <p className="text-sm text-[hsl(var(--muted))]">
            Restore your wallet from an existing recovery phrase.
          </p>
        </header>

        {step !== 'import:complete' && (
          <OnboardingStepper
            steps={IMPORT_STEPS}
            currentKey={step}
            completedKeys={stepperCompletedKeys}
          />
        )}

        {/* ── Step: phrase ──────────────────────────────────────── */}
        {step === 'import:phrase' && (
          <section aria-labelledby="phrase-heading" className="space-y-6">
            <div className="space-y-1">
              <h2
                id="phrase-heading"
                className="text-base font-semibold text-[hsl(var(--foreground))]"
              >
                Enter your recovery phrase
              </h2>
              <p className="text-sm text-[hsl(var(--muted))]">
                Type each word of your BIP-39 recovery phrase in order.
              </p>
            </div>

            {/* Word count selector */}
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium text-[hsl(var(--foreground))]">
                Word count
              </legend>
              <div className="flex flex-wrap gap-2" role="group" aria-label="Select word count">
                {IMPORT_WORD_COUNTS.map((count) => (
                  <button
                    key={count}
                    type="button"
                    onClick={() => handleWordCountChange(count)}
                    aria-pressed={wordCount === count}
                    className={[
                      'rounded-full border px-3 py-1 text-sm font-medium transition-colors',
                      wordCount === count
                        ? 'border-brand-600 bg-brand-600 text-white'
                        : 'border-[hsl(var(--border))] bg-transparent text-[hsl(var(--foreground))] hover:bg-[hsl(var(--surface-subtle))]',
                    ].join(' ')}
                  >
                    {count} words
                  </button>
                ))}
              </div>
            </fieldset>

            {/* Word grid */}
            <div
              className={['grid gap-2', wordCount > 12 ? 'grid-cols-3' : 'grid-cols-3'].join(' ')}
              role="group"
              aria-label="Recovery phrase words"
            >
              {words.map((word, i) => (
                <SeedWordInput
                  key={i}
                  index={i}
                  value={word}
                  onChange={(v) => handleWordChange(i, v)}
                  hasError={mnemonicValidation.unknownWordIndices.includes(i)}
                />
              ))}
            </div>

            {/* Validation feedback */}
            {(phraseError ?? mnemonicError) && (
              <p role="alert" className="text-sm text-red-500 dark:text-red-400">
                {phraseError ?? mnemonicError}
              </p>
            )}

            {mnemonicValidation.isValid && (
              <p role="status" className="text-sm text-emerald-600 dark:text-emerald-400">
                ✓ Valid recovery phrase
              </p>
            )}

            <Button
              variant="primary"
              size="lg"
              fullWidth
              onClick={handlePhraseSubmit}
              disabled={!mnemonicValidation.isComplete}
            >
              Continue
            </Button>
          </section>
        )}

        {/* ── Step: password ───────────────────────────────────────── */}
        {step === 'import:password' && (
          <section aria-labelledby="import-password-heading" className="space-y-6">
            <div className="space-y-1">
              <h2
                id="import-password-heading"
                className="text-base font-semibold text-[hsl(var(--foreground))]"
              >
                Set a password
              </h2>
              <p className="text-sm text-[hsl(var(--muted))]">
                Encrypt your recovered wallet with a strong password.
              </p>
            </div>

            <ConfirmPasswordForm
              onSubmit={handleSetPassword}
              isLoading={isLoading}
              externalError={storeError?.message ?? null}
              submitLabel="Import wallet"
            />

            <Button
              variant="ghost"
              size="md"
              fullWidth
              disabled={isLoading}
              onClick={() => {
                setValidatedMnemonic(null)
                setStep('import:phrase')
              }}
            >
              Back — edit phrase
            </Button>
          </section>
        )}

        {/* ── Step: complete ───────────────────────────────────────── */}
        {step === 'import:complete' && (
          <section aria-labelledby="import-complete-heading" className="space-y-4 text-center">
            <h2
              id="import-complete-heading"
              className="text-base font-semibold text-[hsl(var(--foreground))]"
            >
              Wallet imported!
            </h2>
            <Spinner className="mx-auto" aria-label="Redirecting to dashboard" />
            <p className="text-sm text-[hsl(var(--muted))]">Redirecting to your dashboard…</p>
          </section>
        )}
      </div>
    </div>
  )
}
