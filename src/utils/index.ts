/**
 * Shared utility functions for XQ Wallet.
 * Keep functions pure, small, and well-typed.
 */

import type { Address } from '@/types'

// ─── String helpers ────────────────────────────────────────────────────────

/**
 * Shortens a blockchain address for display.
 * @example shortenAddress("0x1234567890abcdef") → "0x1234...cdef"
 */
export function shortenAddress(address: Address | string, chars = 4): string {
  if (!address || address.length < chars * 2 + 2) return address
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`
}

/**
 * Conditionally joins class names. Lightweight alternative to clsx.
 */
export function cn(...classes: Array<string | undefined | null | false>): string {
  return classes.filter(Boolean).join(' ')
}

// ─── Number helpers ────────────────────────────────────────────────────────

/**
 * Formats a token amount with a fixed number of decimal places.
 * @example formatAmount("1234567890000000000", 18) → "1.234567890"
 */
export function formatTokenAmount(
  raw: string | bigint,
  decimals: number,
  displayDecimals = 6,
): string {
  const value = typeof raw === 'string' ? BigInt(raw) : raw
  const divisor = BigInt(10 ** decimals)
  const whole = value / divisor
  const fraction = value % divisor

  const fractionStr = fraction.toString().padStart(decimals, '0').slice(0, displayDecimals)
  return `${whole}.${fractionStr}`
}

/**
 * Truncates a number string to a given number of significant decimal places.
 */
export function truncateDecimals(value: string, places: number): string {
  const [integer, decimal] = value.split('.')
  if (!decimal) return value
  return `${integer}.${decimal.slice(0, places)}`
}

// ─── Async helpers ─────────────────────────────────────────────────────────

/**
 * Wraps a promise and returns [data, null] on success or [null, error] on failure.
 * Eliminates repetitive try/catch blocks.
 */
export async function tryCatch<T>(
  promise: Promise<T>,
): Promise<[T, null] | [null, Error]> {
  try {
    const data = await promise
    return [data, null]
  } catch (error) {
    return [null, error instanceof Error ? error : new Error(String(error))]
  }
}

// ─── Validation helpers ────────────────────────────────────────────────────

/**
 * Returns true if the string looks like a valid hex-prefixed address.
 * Note: does not validate checksum — use a proper library for production validation.
 */
export function isValidAddress(value: string): value is Address {
  return /^0x[0-9a-fA-F]{40}$/.test(value)
}
