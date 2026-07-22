import React from 'react'

// Leyenda visual del grafo: colores por estado de trazabilidad
export const GraphLegend: React.FC = () => {
  const items = [
    {
      status: 'traced',
      color: '#2ecc71',
      label: 'Trazado',
      description: 'Tiene spec vigente',
    },
    {
      status: 'drift',
      color: '#f39c12',
      label: 'Drift',
      description: 'Spec desactualizada',
    },
    {
      status: 'untraced',
      color: '#e74c3c',
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
