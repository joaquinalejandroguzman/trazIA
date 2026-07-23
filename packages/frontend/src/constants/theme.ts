import type { SpecStatus } from '../types'

// Fuente de verdad única para los colores de estado de trazabilidad
// Todos los componentes que necesiten colorear por SpecStatus importan de acá

export interface StatusColorSet {
  bg: string      // fondo del nodo / badge
  border: string  // borde del nodo / dot de leyenda
  text: string    // texto dentro del nodo / badge
}

// Colores asociados a cada estado de trazabilidad
export const SPEC_STATUS_COLORS: Record<SpecStatus, StatusColorSet> = {
  traced: { bg: '#d4edda', border: '#2ecc71', text: '#155724' },
  drift: { bg: '#fff3cd', border: '#f39c12', text: '#856404' },
  untraced: { bg: '#f8d7da', border: '#e74c3c', text: '#721c24' },
}

// Colores de borde del nodo (solo el color primario, para uso rápido en leyenda/minimap)
export const SPEC_STATUS_DOT_COLORS: Record<SpecStatus, string> = {
  traced: SPEC_STATUS_COLORS.traced.border,
  drift: SPEC_STATUS_COLORS.drift.border,
  untraced: SPEC_STATUS_COLORS.untraced.border,
}

// Retorna el color de la barra de Spec Health Score según el score numérico
// Usa los mismos colores base del sistema de trazabilidad para consistencia visual
export function getHealthScoreColor(score: number): string {
  if (score < 40) return SPEC_STATUS_COLORS.untraced.border  // rojo
  if (score < 70) return SPEC_STATUS_COLORS.drift.border     // amarillo
  return SPEC_STATUS_COLORS.traced.border                     // verde
}
