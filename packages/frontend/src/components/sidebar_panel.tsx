import type { ReactNode } from 'react'
import './sidebar_panel.css'

export interface SidebarPanelProps {
  isOpen: boolean
  children: ReactNode
}

/**
 * Wrapper del panel lateral izquierdo (sidebar) que contiene
 * ProjectSummary y GraphLegend.
 *
 * Se superpone al grafo con posición absoluta y anima su visibilidad
 * usando exclusivamente propiedades GPU-optimizadas (transform, opacity).
 */
export function SidebarPanel({ isOpen, children }: SidebarPanelProps) {
  const className = `sidebar-panel${isOpen ? ' sidebar-panel--open' : ''}`

  return (
    <aside className={className} aria-hidden={!isOpen}>
      {children}
    </aside>
  )
}
