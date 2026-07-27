import React, { useState, useEffect, useMemo } from 'react'
import type { GraphNode } from '../types'
import { filterNodesByName, sortAndCap, getNodeTypeIcon } from '../utils/summary_panel_helpers'

interface NodeSearchProps {
  nodes: GraphNode[] // todos los nodos (modules + folders + integrations)
  onSelect: (nodeId: string) => void
  onFilterChange: (matchingIds: Set<string> | null) => void
  clearSignal: number
}

// Mínimo de caracteres para activar la búsqueda
const MIN_QUERY_LENGTH = 2

// Máximo de resultados a mostrar
const MAX_RESULTS = 50

// Altura máxima de la lista de resultados (para scroll)
const MAX_RESULTS_HEIGHT = '300px'

/**
 * Buscador de nodos con lista de resultados.
 * Filtra nodos por nombre (case-insensitive) y emite los IDs coincidentes
 * al padre para que aplique dimming en el grafo.
 */
export const NodeSearch: React.FC<NodeSearchProps> = ({
  nodes,
  onSelect,
  onFilterChange,
  clearSignal,
}) => {
  const [query, setQuery] = useState('')

  // Escuchar cambios en clearSignal para resetear el campo desde fuera
  useEffect(() => {
    setQuery('')
    onFilterChange(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clearSignal])

  // Calcular resultados filtrados solo cuando query tiene ≥ 2 caracteres
  const results = useMemo(() => {
    if (query.length < MIN_QUERY_LENGTH) return null
    const filtered = filterNodesByName(nodes, query)
    return sortAndCap(filtered, MAX_RESULTS)
  }, [nodes, query])

  // Emitir onFilterChange cuando los resultados cambian
  useEffect(() => {
    if (results === null) {
      onFilterChange(null)
    } else {
      const matchingIds = new Set(results.map((n) => n.id))
      onFilterChange(matchingIds)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [results])

  // Manejar cambio en el campo de texto
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value)
  }

  // Manejar click en un resultado: navegar al nodo y limpiar búsqueda
  const handleResultClick = (nodeId: string) => {
    onSelect(nodeId)
    setQuery('')
  }

  // Determinar si debe mostrarse la lista de resultados
  const showResults = query.length >= MIN_QUERY_LENGTH
  const hasResults = results !== null && results.length > 0
  const showEmptyMessage = showResults && results !== null && results.length === 0

  return (
    <div className="node-search" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <input
        className="node-search__input"
        type="text"
        placeholder="Buscar nodos..."
        value={query}
        onChange={handleChange}
        aria-label="Buscar nodos"
      />

      {showResults && hasResults && (
        <ul
          className="node-search__results"
          role="list"
          style={{
            maxHeight: MAX_RESULTS_HEIGHT,
            overflowY: 'auto',
          }}
        >
          {results.map((node) => (
            <li key={node.id} className="node-search__item">
              <button
                className="node-search__item-btn"
                onClick={() => handleResultClick(node.id)}
                type="button"
                title={node.name}
              >
                <span className="node-search__item-icon" aria-hidden="true">
                  {getNodeTypeIcon(node)}
                </span>
                <span className="node-search__item-name">{node.name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {showEmptyMessage && (
        <p className="node-search__empty">No se encontraron nodos</p>
      )}
    </div>
  )
}
