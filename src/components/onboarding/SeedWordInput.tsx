'use client'

/**
 * SeedWordInput — single numbered word input with BIP-39 autocomplete.
 *
 * Accessibility:
 *   - Associates the index label with the input via aria-labelledby
 *   - Announces unknown-word errors via aria-describedby + role="alert"
 *   - Autocomplete list uses role="listbox" / role="option"
 */

import { useState, useId, useRef, useCallback } from 'react'
import { cn } from '@/lib/cn'
import { focusRing, transition } from '@/lib/tokens'
import { getWordSuggestions, isKnownWord } from '@/lib/onboarding'

export interface SeedWordInputProps {
  /** 0-based word index — displayed as 1-based label */
  index: number
  value: string
  onChange: (value: string) => void
  /** When true, shows an error indicator on the input border */
  hasError?: boolean
  disabled?: boolean
  /** Called when the user tabs/enters past the last character of a known word */
  onComplete?: () => void
}

export function SeedWordInput({
  index,
  value,
  onChange,
  hasError = false,
  disabled = false,
  onComplete,
}: SeedWordInputProps) {
  const id = useId()
  const labelId = `${id}-label`
  const errorId = `${id}-error`
  const listboxId = `${id}-suggestions`
  const inputRef = useRef<HTMLInputElement>(null)

  const [suggestions, setSuggestions] = useState<string[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [activeIdx, setActiveIdx] = useState(-1)

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const v = e.target.value.toLowerCase().replace(/[^a-z]/g, '')
      onChange(v)
      const s = getWordSuggestions(v)
      setSuggestions(s)
      setShowSuggestions(s.length > 0)
      setActiveIdx(-1)
    },
    [onChange],
  )

  const selectSuggestion = useCallback(
    (word: string) => {
      onChange(word)
      setSuggestions([])
      setShowSuggestions(false)
      setActiveIdx(-1)
      onComplete?.()
    },
    [onChange, onComplete],
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (!showSuggestions) return
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setActiveIdx((i) => Math.min(i + 1, suggestions.length - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setActiveIdx((i) => Math.max(i - 1, -1))
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        if (activeIdx >= 0 && suggestions[activeIdx]) {
          e.preventDefault()
          selectSuggestion(suggestions[activeIdx])
        } else if (suggestions.length === 1) {
          e.preventDefault()
          selectSuggestion(suggestions[0])
        }
      } else if (e.key === 'Escape') {
        setShowSuggestions(false)
        setActiveIdx(-1)
      }
    },
    [showSuggestions, suggestions, activeIdx, selectSuggestion],
  )

  const isValid = value.trim().length > 0 && isKnownWord(value)
  const showError = hasError && value.trim().length > 0

  return (
    <div className="relative">
      <div className="flex items-center gap-1.5">
        <span
          id={labelId}
          aria-hidden="true"
          className="min-w-[1.25rem] text-right text-xs text-[hsl(var(--muted))]"
        >
          {index + 1}
        </span>
        <input
          ref={inputRef}
          type="text"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="none"
          spellCheck={false}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
          onFocus={() => value && setSuggestions(getWordSuggestions(value))}
          disabled={disabled}
          aria-labelledby={labelId}
          aria-describedby={showError ? errorId : undefined}
          aria-invalid={showError}
          aria-autocomplete="list"
          aria-controls={showSuggestions ? listboxId : undefined}
          aria-activedescendant={activeIdx >= 0 ? `${listboxId}-option-${activeIdx}` : undefined}
          className={cn(
            'w-full rounded-md border px-2 py-1.5 font-mono text-sm',
            'bg-[hsl(var(--surface))] text-[hsl(var(--foreground))]',
            'placeholder:text-[hsl(var(--muted))]',
            focusRing,
            transition,
            isValid && 'border-emerald-500 dark:border-emerald-400',
            showError && 'border-red-500 dark:border-red-400',
            !isValid && !showError && 'border-[hsl(var(--border))]',
            'disabled:pointer-events-none disabled:opacity-50',
          )}
        />
      </div>

      {/* Autocomplete suggestions */}
      {showSuggestions && suggestions.length > 0 && (
        <ul
          id={listboxId}
          role="listbox"
          aria-label={`Suggestions for word ${index + 1}`}
          className={cn(
            'absolute left-5 right-0 z-10 mt-1 rounded-md border shadow-md',
            'border-[hsl(var(--border))] bg-[hsl(var(--surface-elevated))]',
            'max-h-40 overflow-y-auto',
          )}
        >
          {suggestions.map((word, si) => (
            <li
              key={word}
              id={`${listboxId}-option-${si}`}
              role="option"
              aria-selected={si === activeIdx}
              onMouseDown={() => selectSuggestion(word)}
              className={cn(
                'cursor-pointer px-3 py-1.5 font-mono text-sm',
                si === activeIdx
                  ? 'bg-brand-600 text-white'
                  : 'hover:bg-[hsl(var(--surface-subtle))] text-[hsl(var(--foreground))]',
              )}
            >
              {word}
            </li>
          ))}
        </ul>
      )}

      {/* Error indicator */}
      {showError && (
        <span id={errorId} role="alert" className="sr-only">
          Word {index + 1} is not a valid BIP-39 word.
        </span>
      )}
    </div>
  )
}
