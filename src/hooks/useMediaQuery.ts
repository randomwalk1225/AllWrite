import { useState, useEffect } from 'react'

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.matchMedia(query).matches
  })

  useEffect(() => {
    const mql = window.matchMedia(query)
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches)
    mql.addEventListener('change', handler)
    setMatches(mql.matches)
    return () => mql.removeEventListener('change', handler)
  }, [query])

  return matches
}

export function useIsMobile(): boolean {
  return useMediaQuery('(max-width: 480px)')
}

export function useIsTablet(): boolean {
  return useMediaQuery('(min-width: 481px) and (max-width: 768px)')
}

export function useIsDesktop(): boolean {
  return useMediaQuery('(min-width: 769px)')
}

export function useIsTouchDevice(): boolean {
  return useMediaQuery('(pointer: coarse)')
}
