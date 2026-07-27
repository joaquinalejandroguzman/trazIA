import { useState, useEffect } from 'react'

const MOBILE_BREAKPOINT = 768

/**
 * Hook que detecta si el viewport es mobile (< 768px).
 * Escucha cambios de tamaño de ventana en tiempo real.
 */
export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < MOBILE_BREAKPOINT)

  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [])

  return isMobile
}
