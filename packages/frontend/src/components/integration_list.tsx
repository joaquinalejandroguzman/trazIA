import React, { useState } from 'react'
import type { IntegrationNode } from '../types'
import { groupIntegrationsByType } from '../utils/summary_panel_helpers'

interface IntegrationListProps {
  integrations: IntegrationNode[]
  onNavigate: (nodeId: string) => void
}

// Iconos por tipo de integración
const INTEGRATION_ICONS: Record<IntegrationNode['type'], string> = {
  database: '🗄️',
  external_api: '🌐',
}

// Máximo de ítems visibles antes de activar scroll
const MAX_VISIBLE_ITEMS = 20

// Altura estimada por ítem (16px) × máximo de ítems visibles
const MAX_LIST_HEIGHT = '320px'

/**
 * Lista expandible de integraciones detectadas.
 * Agrupa por tipo (databases primero, luego APIs externas).
 * Click en el header expande/colapsa. Click en un ítem navega al nodo en el grafo.
 */
export const IntegrationList: React.FC<IntegrationListProps> = ({
  integrations,
  onNavigate,
}) => {
  const [expanded, setExpanded] = useState(false)

  // No renderizar si no hay integraciones
  if (integrations.length === 0) {
    return null
  }

  // Agrupar integraciones por tipo: databases primero, luego APIs externas
  const grouped = groupIntegrationsByType(integrations)

  const handleToggle = () => {
    setExpanded((prev) => !prev)
  }

  const handleItemClick = (nodeId: string) => {
    onNavigate(nodeId)
  }

  return (
    <div className="integration-list">
      <button
        className="integration-list__header"
        onClick={handleToggle}
        aria-expanded={expanded}
        aria-controls="integration-list-items"
        type="button"
      >
        <span className="integration-list__header-icon">🔌</span>
        <span className="integration-list__header-title">
          Integraciones ({integrations.length})
        </span>
        <span
          className={`integration-list__chevron ${expanded ? 'integration-list__chevron--open' : ''}`}
          aria-hidden="true"
        >
          ▸
        </span>
      </button>

      {expanded && (
        <ul
          id="integration-list-items"
          className="integration-list__items"
          role="list"
          style={{
            maxHeight: grouped.length > MAX_VISIBLE_ITEMS ? MAX_LIST_HEIGHT : undefined,
            overflowY: grouped.length > MAX_VISIBLE_ITEMS ? 'auto' : undefined,
          }}
        >
          {grouped.map((integration) => (
            <li key={integration.id} className="integration-list__item">
              <button
                className="integration-list__item-btn"
                onClick={() => handleItemClick(integration.id)}
                type="button"
                title={integration.description}
              >
                <span className="integration-list__item-icon" aria-hidden="true">
                  {INTEGRATION_ICONS[integration.type]}
                </span>
                <span className="integration-list__item-name">
                  {integration.name}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
