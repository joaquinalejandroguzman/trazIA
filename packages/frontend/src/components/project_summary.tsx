import React, { useState, useEffect, useMemo } from 'react'
import type { AnalysisResult, GraphNode, SpecStatus } from '../types'
import { computeTraceabilityDimmedIds } from '../utils/summary_panel_helpers'
import { IntegrationList } from './integration_list'
import { NodeSearch } from './node_search'
import { DonutIndicator } from './donut_indicator'

interface ProjectSummaryProps {
  result: AnalysisResult
  // Callbacks para interacción con el grafo
  onFitToNode?: (nodeId: string) => void
  onDimNodes?: (matchingIds: Set<string>, filterType: 'search' | 'traceability') => void
  onClearDimming?: () => void
  // Señal externa para limpiar filtros internos (cuando el grafo recibe click directo)
  clearFiltersSignal?: number
  // Callback directo para filtro de trazabilidad (pasa status al hook en App)
  onTraceabilityFilter?: (status: SpecStatus | null) => void
}

// No-op por defecto para callbacks opcionales
const noop = () => {}

// Tarjetas de resumen del proyecto + sub-componentes interactivos
export const ProjectSummary: React.FC<ProjectSummaryProps> = ({
  result,
  onFitToNode = noop,
  onDimNodes = noop,
  onClearDimming = noop,
  clearFiltersSignal = 0,
  onTraceabilityFilter,
}) => {
  const {
    totalModules,
    totalIntegrations,
    primaryLanguage,
    integrations,
    repoUrl,
    analyzedAt,
    tracedCount,
    untracedCount,
    driftCount,
  } = result

  // Estado del segmento activo en el donut de trazabilidad
  const [activeSegment, setActiveSegment] = useState<SpecStatus | null>(null)

  // Resetear segmento activo cuando cambia la señal externa de limpieza
  useEffect(() => {
    setActiveSegment(null)
  }, [clearFiltersSignal])

  // Preparar lista unificada de todos los nodos para el buscador
  const allNodes: GraphNode[] = useMemo(
    () => [...result.modules, ...result.folders, ...result.integrations],
    [result]
  )

  // --- Callbacks internos ---

  // Búsqueda → dimming: emitir IDs coincidentes al padre
  const handleSearchFilterChange = (matchingIds: Set<string> | null) => {
    if (matchingIds === null) {
      onClearDimming()
    } else {
      onDimNodes(matchingIds, 'search')
    }
  }

  // Donut → dimming: emitir filtro de trazabilidad al padre
  const handleSegmentClick = (status: SpecStatus | null) => {
    setActiveSegment(status)
    if (onTraceabilityFilter) {
      // Usa el callback directo que invoca applyTraceabilityFilter en App
      onTraceabilityFilter(status)
    } else if (status === null) {
      onClearDimming()
    } else {
      // Fallback: calcular IDs a dimear y enviar como filtro genérico
      const dimmedIds = computeTraceabilityDimmedIds(result.modules, status)
      onDimNodes(dimmedIds, 'traceability')
    }
  }

  // --- Render helpers existentes ---

  // Extrae el nombre del repo de la URL para mostrarlo
  const repoName = repoUrl.replace(/^https?:\/\/github\.com\//, '').replace(/\/$/, '')

  // Contar por tipo de integración
  const dbCount = integrations.filter((i) => i.type === 'database').length
  const apiCount = integrations.filter((i) => i.type === 'external_api').length

  return (
    <div className="project-summary">
      <div className="project-summary__header">
        <div>
          <h2 className="project-summary__repo-name">{repoName}</h2>
          <p className="project-summary__date">
            Analizado el{' '}
            {new Date(analyzedAt).toLocaleDateString('es-AR', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </p>
        </div>
      </div>

      {/* Buscador de nodos — justo debajo del nombre del repo */}
      <NodeSearch
        nodes={allNodes}
        onSelect={onFitToNode}
        onFilterChange={handleSearchFilterChange}
        clearSignal={clearFiltersSignal}
      />

      <div className="project-summary__cards">
        <div className="project-summary__card">
          <span className="project-summary__card-value">{totalModules}</span>
          <span className="project-summary__card-label">📁 Módulos</span>
        </div>
        <div className="project-summary__card project-summary__card--integrations">
          <span className="project-summary__card-value">{totalIntegrations}</span>
          <span className="project-summary__card-label">🔌 Integraciones</span>
        </div>
        <div className="project-summary__card project-summary__card--db">
          <span className="project-summary__card-value">{dbCount}</span>
          <span className="project-summary__card-label">🗄️ Bases de datos</span>
        </div>
        <div className="project-summary__card project-summary__card--api">
          <span className="project-summary__card-value">{apiCount}</span>
          <span className="project-summary__card-label">🌐 APIs externas</span>
        </div>
      </div>

      <div className="project-summary__meta">
        <p className="project-summary__language">
          Stack predominante: <strong>{primaryLanguage}</strong>
        </p>
      </div>

      <DonutIndicator
        tracedCount={tracedCount}
        untracedCount={untracedCount}
        driftCount={driftCount}
        totalModules={totalModules}
        onSegmentClick={handleSegmentClick}
        activeSegment={activeSegment}
      />

      <IntegrationList
        integrations={integrations}
        onNavigate={onFitToNode}
      />
    </div>
  )
}
