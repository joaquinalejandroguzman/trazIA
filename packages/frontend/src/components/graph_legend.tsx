import React from 'react'
import { ZONE_COLORS, INTEGRATION_COLORS } from '../constants/theme'

// Leyenda visual del grafo: colores por zona del proyecto y tipo de integración
export const GraphLegend: React.FC = () => {
  const zoneItems = [
    { key: 'frontend', color: ZONE_COLORS.frontend.border, label: 'Frontend' },
    { key: 'backend', color: ZONE_COLORS.backend.border, label: 'Backend' },
    { key: 'shared', color: ZONE_COLORS.shared.border, label: 'Shared / Utils' },
    { key: 'config', color: ZONE_COLORS.config.border, label: 'Configuración' },
  ]

  const integrationItems = [
    { key: 'database', color: INTEGRATION_COLORS.database.border, label: '🗄️ Base de datos' },
    { key: 'external_api', color: INTEGRATION_COLORS.external_api.border, label: '🌐 API externa' },
  ]

  return (
    <div className="graph-legend" role="list" aria-label="Leyenda del grafo">
      <div className="graph-legend__section">
        <span className="graph-legend__section-title">Zonas</span>
        {zoneItems.map((item) => (
          <div key={item.key} className="graph-legend__item" role="listitem">
            <span
              className="graph-legend__dot"
              style={{ backgroundColor: item.color }}
              aria-hidden="true"
            />
            <span className="graph-legend__label">{item.label}</span>
          </div>
        ))}
      </div>
      <div className="graph-legend__section">
        <span className="graph-legend__section-title">Integraciones</span>
        {integrationItems.map((item) => (
          <div key={item.key} className="graph-legend__item" role="listitem">
            <span
              className="graph-legend__dot"
              style={{ backgroundColor: item.color }}
              aria-hidden="true"
            />
            <span className="graph-legend__label">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
