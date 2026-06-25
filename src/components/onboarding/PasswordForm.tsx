'use client'

/**
 * PasswordForm — single password input with show/hide toggle.
 *
 * Accessibility:
 *   - Explicit label via htmlFor / id
 *   - Error announced via aria-describedby + role="alert"
 *   - Show/hide button has an aria-label that updates with state
 */

import { useState, useId } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { cn } from '@/lib/cn'
import { focusRing, transition, labelText, errorText } from '@/lib/tokens'

export interface PasswordFormProps {
  value: string
  onChange: (value: string) => void
  error?: string | null
  label?: string
  placeholder?: string
  /** HTML autocomplete hint. Default: "new-password" */
  autoComplete?: string
  disabled?: boolean
  id?: string
}

export function PasswordForm({
  value,
  onChange,
  error,
  label = 'Password',
  placeholder = 'Enter password',
  autoComplete = 'new-password',
  disabled = false,
  id: externalId,
}: PasswordFormProps) {
  const generatedId = useId()
  const id = externalId ?? generatedId
  const errorId = `${id}-error`
  const [show, setShow] = useState(false)

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className={labelText}>
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          disabled={disabled}
          aria-describedby={error ? errorId : undefined}
          aria-invalid={!!error}
          className={cn(
            'w-full rounded-lg border px-3 py-2.5 pr-10 text-sm',
            'bg-[hsl(var(--surface))] text-[hsl(var(--foreground))]',
            'placeholder:text-[hsl(var(--muted))]',
            focusRing,
            transition,
            error ? 'border-red-500 dark:border-red-400' : 'border-[hsl(var(--border))]',
            'disabled:pointer-events-none disabled:opacity-50',
          )}
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          disabled={disabled}
          aria-label={show ? 'Hide password' : 'Show password'}
          className={cn(
            'absolute right-2.5 top-1/2 -translate-y-1/2',
            'text-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))]',
            transition,
            'disabled:pointer-events-none',
          )}
        >
          {show ? (
            <EyeOff className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Eye className="h-4 w-4" aria-hidden="true" />
          )}
        </button>
      </div>
      {error && (
        <p id={errorId} role="alert" className={cn('text-xs', errorText)}>
          {error}
        </p>
      )}
    </div>
  )
}
