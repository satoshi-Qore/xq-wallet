'use client'

/**
 * ConfirmPasswordForm — password + confirm-password field pair.
 *
 * Wraps two PasswordForm instances and exposes a single onSubmit callback
 * called with the validated password. Handles all validation inline.
 *
 * Accessibility: individual PasswordForm instances handle their own a11y.
 * The form has role="form" and an accessible name.
 */

import { useState, useCallback, useId } from 'react'
import { PasswordForm } from './PasswordForm'
import { Button } from '@/components/ui/Button'
import { validatePasswordPair } from '@/lib/onboarding'

export interface ConfirmPasswordFormProps {
  /** Called with the valid password when both fields pass validation. */
  onSubmit: (password: string) => Promise<void> | void
  isLoading?: boolean
  /** External error from the store (e.g., service-level WEAK_PASSWORD). */
  externalError?: string | null
  submitLabel?: string
}

export function ConfirmPasswordForm({
  onSubmit,
  isLoading = false,
  externalError,
  submitLabel = 'Continue',
}: ConfirmPasswordFormProps) {
  const formName = useId()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      const result = validatePasswordPair(password, confirm)
      if (!result.valid) {
        setError(result.error)
        return
      }
      setError(null)
      await onSubmit(password)
    },
    [password, confirm, onSubmit],
  )

  const displayError = error ?? externalError ?? null

  return (
    <form
      onSubmit={handleSubmit}
      aria-label="Set password"
      aria-describedby={displayError ? `${formName}-err` : undefined}
      className="space-y-4"
      noValidate
    >
      <PasswordForm
        label="Password"
        value={password}
        onChange={setPassword}
        placeholder="At least 8 characters"
        autoComplete="new-password"
        disabled={isLoading}
      />
      <PasswordForm
        label="Confirm password"
        value={confirm}
        onChange={setConfirm}
        placeholder="Repeat your password"
        autoComplete="new-password"
        error={displayError}
        disabled={isLoading}
      />
      {displayError && (
        <p id={`${formName}-err`} role="alert" className="text-xs text-red-500 dark:text-red-400">
          {displayError}
        </p>
      )}
      <Button
        type="submit"
        variant="primary"
        size="lg"
        fullWidth
        isLoading={isLoading}
        disabled={isLoading || !password || !confirm}
      >
        {submitLabel}
      </Button>
    </form>
  )
}
