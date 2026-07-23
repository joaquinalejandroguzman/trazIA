import React from 'react'
import { SPEC_STATUS_DOT_COLORS } from '../constants/theme'

// Leyenda visual del grafo: colores por estado de trazabilidad
export const GraphLegend: React.FC = () => {
  const items = [
    {
      status: 'traced' as const,
      color: SPEC_STATUS_DOT_COLORS.traced,
      label: 'Trazado',
      description: 'Tiene spec vigente',
    },
    {
      status: 'drift' as const,
      color: SPEC_STATUS_DOT_COLORS.drift,
      label: 'Drift',
      description: 'Spec desactualizada',
    },
    {
      status: 'untraced' as const,
      color: SPEC_STATUS_DOT_COLORS.untraced,
      label: 'Sin trazabilidad',
      description: 'Caja negra, sin spec',
    },
  ]

  return (
    <div className="graph-legend" role="list" aria-label="Leyenda del grafo">
      {items.map((item) => (
        <div
          key={item.status}
          className="graph-legend__item"
          role="listitem"
          title={item.description}
        >
          <span
            className="graph-legend__dot"
            style={{ backgroundColor: item.color }}
            aria-hidden="true"
          />
          <span className="graph-legend__label">{item.label}</span>
        </div>
      ))}
    </div>
  )
}
