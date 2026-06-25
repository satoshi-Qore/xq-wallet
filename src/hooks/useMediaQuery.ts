'use client'

/**
 * useMediaQuery — SSR-safe window.matchMedia hook.
 *
 * Returns `undefined` on the server and during the first client render to
 * prevent hydration mismatches. Resolves to the match result after mount.
 *
 * @example
 * const isDesktop = useMediaQuery('(min-width: 1024px)')
 * // undefined → false during SSR / hydration; true/false once mounted
 */

import { useEffect, useState } from 'react'

export function useMediaQuery(query: string): boolean | undefined {
  const [matches, setMatches] = useState<boolean | undefined>(undefined)

  useEffect(() => {
    const mediaQueryList = window.matchMedia(query)

    // Set initial value after mount
    setMatches(mediaQueryList.matches)

    const listener = (event: MediaQueryListEvent) => {
      setMatches(event.matches)
    }

    mediaQueryList.addEventListener('change', listener)
    return () => mediaQueryList.removeEventListener('change', listener)
  }, [query])

  return matches
}

// ─── Convenience exports ───────────────────────────────────────────────────

/** True when viewport is ≥ 768px (Tailwind `md`) */
export function useIsTablet(): boolean | undefined {
  return useMediaQuery('(min-width: 768px)')
}

/** True when viewport is ≥ 1024px (Tailwind `lg`) — desktop sidebar visible */
export function useIsDesktop(): boolean | undefined {
  return useMediaQuery('(min-width: 1024px)')
}

/** True when user prefers reduced motion */
export function usePrefersReducedMotion(): boolean | undefined {
  return useMediaQuery('(prefers-reduced-motion: reduce)')
}
