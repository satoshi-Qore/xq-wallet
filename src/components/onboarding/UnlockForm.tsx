'use client'

/**
 * UnlockForm — password input form for unlocking a locked wallet.
 *
 * Accessibility:
 *   - Autofocuses the password field on mount
 *   - Error announced via role="alert"
 *   - Loading state disables the form and shows a spinner
 */

import { useState, useRef, useEffect, useCallback } from 'react'
import { PasswordForm } from './PasswordForm'
import { Button } from '@/components/ui/Button'

export interface UnlockFormProps {
  /** Called with the entered password when the user submits. */
  onSubmit: (password: string) => Promise<void>
  isLoading: boolean
  error: string | null
  className?: string
}

export function UnlockForm({ onSubmit, isLoading, error, className }: UnlockFormProps) {
  const [password, setPassword] = useState('')
  const inputRef = useRef<HTMLDivElement>(null)

  // Focus the password field on mount
  useEffect(() => {
    const input = inputRef.current?.querySelector('input')
    input?.focus()
  }, [])

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      if (!password.trim()) return
      await onSubmit(password)
    },
    [password, onSubmit],
  )

  return (
    <form onSubmit={handleSubmit} aria-label="Unlock wallet" className={className} noValidate>
      <div ref={inputRef}>
        <PasswordForm
          label="Password"
          value={password}
          onChange={setPassword}
          placeholder="Enter your password"
          autoComplete="current-password"
          error={error}
          disabled={isLoading}
        />
      </div>
      <Button
        type="submit"
        variant="primary"
        size="lg"
        fullWidth
        isLoading={isLoading}
        disabled={isLoading || !password.trim()}
        className="mt-4"
      >
        Unlock Wallet
      </Button>
    </form>
  )
}
