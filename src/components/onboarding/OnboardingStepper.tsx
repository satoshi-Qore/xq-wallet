'use client'

/**
 * OnboardingStepper — horizontal step indicator for the onboarding flow.
 *
 * Accessibility:
 *   - role="list" / role="listitem" for the step list
 *   - aria-current="step" on the active step
 *   - aria-label on the wrapper describes its purpose
 *   - Completed steps are aria-label-ed as "completed"
 */

import { cn } from '@/lib/cn'
import { Check } from 'lucide-react'

export interface StepItem {
  key: string
  label: string
}

export interface OnboardingStepperProps {
  steps: StepItem[]
  currentKey: string
  completedKeys: readonly string[]
  className?: string
}

export function OnboardingStepper({
  steps,
  currentKey,
  completedKeys,
  className,
}: OnboardingStepperProps) {
  return (
    <nav aria-label="Onboarding progress" className={cn('w-full', className)}>
      <ol role="list" className="flex items-center justify-between gap-1">
        {steps.map((step, i) => {
          const isCompleted = completedKeys.includes(step.key)
          const isCurrent = step.key === currentKey
          const isUpcoming = !isCompleted && !isCurrent

          return (
            <li
              key={step.key}
              role="listitem"
              aria-current={isCurrent ? 'step' : undefined}
              aria-label={
                isCompleted
                  ? `${step.label} — completed`
                  : isCurrent
                    ? `${step.label} — current step`
                    : step.label
              }
              className="flex flex-1 flex-col items-center gap-1"
            >
              {/* Connector line (not shown before first item) */}
              <div className="flex w-full items-center">
                {i > 0 && (
                  <div
                    aria-hidden="true"
                    className={cn(
                      'h-0.5 flex-1 transition-colors duration-300',
                      isCompleted || isCurrent ? 'bg-brand-600' : 'bg-[hsl(var(--border))]',
                    )}
                  />
                )}
                {/* Step circle */}
                <div
                  aria-hidden="true"
                  className={cn(
                    'flex h-7 w-7 shrink-0 items-center justify-center rounded-full',
                    'text-xs font-semibold transition-colors duration-300',
                    isCompleted && 'bg-brand-600 text-white',
                    isCurrent &&
                      'border-2 border-brand-600 bg-transparent text-brand-600 dark:text-brand-400',
                    isUpcoming &&
                      'border-2 border-[hsl(var(--border))] bg-transparent text-[hsl(var(--muted))]',
                  )}
                >
                  {isCompleted ? <Check className="h-3.5 w-3.5" /> : <span>{i + 1}</span>}
                </div>
                {i < steps.length - 1 && (
                  <div
                    aria-hidden="true"
                    className={cn(
                      'h-0.5 flex-1 transition-colors duration-300',
                      isCompleted ? 'bg-brand-600' : 'bg-[hsl(var(--border))]',
                    )}
                  />
                )}
              </div>
              {/* Label */}
              <span
                aria-hidden="true"
                className={cn(
                  'text-center text-[10px] font-medium leading-tight',
                  isCurrent
                    ? 'text-brand-600 dark:text-brand-400'
                    : isCompleted
                      ? 'text-[hsl(var(--foreground))]'
                      : 'text-[hsl(var(--muted))]',
                )}
              >
                {step.label}
              </span>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
