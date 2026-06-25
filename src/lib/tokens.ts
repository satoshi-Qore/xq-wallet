/**
 * Shared design token class strings used across all UI components.
 * Centralising these prevents drift and duplication in component files.
 */

/** Standard focus-visible ring — WCAG 2.1 AA visible focus indicator */
export const focusRing =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-950'

/** Standard disabled state — prevents interaction, reduces opacity */
export const disabledState = 'disabled:pointer-events-none disabled:opacity-50'

/** Fast colour transition — used on buttons, inputs, interactive elements */
export const transition = 'transition-colors duration-200 ease-in-out'

/** Standard border using design token */
export const border = 'border border-[hsl(var(--border))]'

/** Muted text using design token */
export const textMuted = 'text-[hsl(var(--muted))]'

/** Surface background using design token */
export const bgSurface = 'bg-[hsl(var(--surface))]'

/** Elevated surface background using design token */
export const bgElevated = 'bg-[hsl(var(--surface-elevated))]'

/** Standard label typography */
export const labelText = 'text-sm font-medium text-[hsl(var(--foreground))]'

/** Error text colour */
export const errorText = 'text-red-500 dark:text-red-400'

/** Minimum touch target enforced on mobile — 44×44px per WCAG 2.1 */
export const touchTarget = 'min-h-[44px] min-w-[44px]'
