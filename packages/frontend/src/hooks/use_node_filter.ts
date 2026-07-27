import { useState, useCallback } from 'react'
import type { ModuleNode, SpecStatus } from '../types'
import type { ActiveFilterType } from '../utils/summary_panel_helpers'
import { computeDimmedIds, computeTraceabilityDimmedIds } from '../utils/summary_panel_helpers'

// Retorno del hook useNodeFilter
export interface UseNodeFilterReturn {
  dimmedNodeIds: Set<string> | null
  activeFilterType: ActiveFilterType
  applySearchFilter: (matchingIds: Set<string> | null) => void
  applyTraceabilityFilter: (status: SpecStatus | null, modules: ModuleNode[]) => void
  clearAll: () => void
}

/**
 * Hook que encapsula la lógica de filtrado/dimming con semántica "last filter wins".
 * Cuando se activa un filtro de búsqueda y luego uno de trazabilidad (o viceversa),
 * solo el último activado determina qué nodos se dimean.
 *
 * @param allNodeIds - Set con todos los IDs de nodos del grafo
 */
export function useNodeFilter(allNodeIds: Set<string>): UseNodeFilterReturn {
  const [dimmedNodeIds, setDimmedNodeIds] = useState<Set<string> | null>(null)
  const [activeFilterType, setActiveFilterType] = useState<ActiveFilterType>(null)

  // Aplica filtro de búsqueda. Si matchingIds es null, limpia el filtro de búsqueda.
  const applySearchFilter = useCallback(
    (matchingIds: Set<string> | null) => {
      if (matchingIds === null) {
        // Solo limpiar si el filtro activo actualmente es de búsqueda
        setActiveFilterType((current) => {
          if (current === 'search') {
            setDimmedNodeIds(null)
            return null
          }
          return current
        })
        return
      }
      // "Last filter wins": activar búsqueda reemplaza cualquier filtro anterior
      const dimmed = computeDimmedIds(allNodeIds, matchingIds)
      setDimmedNodeIds(dimmed)
      setActiveFilterType('search')
    },
    [allNodeIds]
  )

  // Aplica filtro de trazabilidad. Si status es null, limpia el filtro de trazabilidad.
  const applyTraceabilityFilter = useCallback(
    (status: SpecStatus | null, modules: ModuleNode[]) => {
      if (status === null) {
        // Solo limpiar si el filtro activo es de trazabilidad
        setActiveFilterType((current) => {
          if (current === 'traceability') {
            setDimmedNodeIds(null)
            return null
          }
          return current
        })
        return
      }
      // "Last filter wins": activar trazabilidad reemplaza cualquier filtro anterior
      const dimmed = computeTraceabilityDimmedIds(modules, status)
      setDimmedNodeIds(dimmed)
      setActiveFilterType('traceability')
    },
    []
  )

  // Limpia todos los filtros y restaura el estado inicial
  const clearAll = useCallback(() => {
    setDimmedNodeIds(null)
    setActiveFilterType(null)
  }, [])

  return {
    dimmedNodeIds,
    activeFilterType,
    applySearchFilter,
    applyTraceabilityFilter,
    clearAll,
  }
}
