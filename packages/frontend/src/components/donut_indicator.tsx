import React from 'react'
import type { SpecStatus } from '../types'
import { computeDonutSegments, DonutSegment } from '../utils/summary_panel_helpers'

// --- Tipos ---

interface DonutIndicatorProps {
  tracedCount: number
  untracedCount: number
  driftCount: number
  totalModules: number
  onSegmentClick: (status: SpecStatus | null) => void
  activeSegment: SpecStatus | null
}

// --- Constantes del SVG ---

/** Radio del donut */
const RADIUS = 40
/** Centro del SVG */
const CENTER = 60
/** Grosor del anillo */
const STROKE_WIDTH = 20
/** Circunferencia total: 2 * π * r */
const CIRCUMFERENCE = 2 * Math.PI * RADIUS
/** Offset radial para el segmento activo (en px) */
const ACTIVE_OFFSET = 3

// --- Helpers internos ---

/**
 * Calcula el ángulo medio de un segmento para determinar la dirección del offset radial.
 * startAngle y segmentAngle están en grados (0–360).
 */
function computeRadialTranslate(startAngle: number, segmentAngle: number): string {
  const midAngle = startAngle + segmentAngle / 2
  // Convertir a radianes; SVG stroke-dashoffset empieza en las 3 en punto (0°),
  // pero queremos desplazar desde el centro hacia afuera en la dirección del medio del arco.
  // El offset del stroke empieza en la parte superior (12 en punto) por el rotate(-90),
  // así que el ángulo real en el sistema de coordenadas SVG es midAngle - 90.
  const radians = ((midAngle - 90) * Math.PI) / 180
  const dx = Math.cos(radians) * ACTIVE_OFFSET
  const dy = Math.sin(radians) * ACTIVE_OFFSET
  return `translate(${dx.toFixed(2)}px, ${dy.toFixed(2)}px)`
}

// --- Componente ---

/**
 * Indicador de trazabilidad tipo donut.
 * Muestra la distribución porcentual de módulos por estado de trazabilidad.
 * Click en un segmento filtra el grafo; segundo click en el mismo desactiva el filtro.
 */
export const DonutIndicator: React.FC<DonutIndicatorProps> = ({
  tracedCount,
  untracedCount,
  driftCount,
  totalModules,
  onSegmentClick,
  activeSegment,
}) => {
  // Guard: no renderizar si no hay módulos
  if (totalModules === 0) return null

  // Calcular segmentos usando la función pura
  const segments: DonutSegment[] = computeDonutSegments(
    tracedCount,
    untracedCount,
    driftCount,
    totalModules
  )

  // Porcentaje de traced para el centro
  const tracedPercentage = Math.round((tracedCount / totalModules) * 100)

  // Calcular offsets acumulados para posicionar cada segmento
  let cumulativePercentage = 0

  /**
   * Maneja click en un segmento: toggle si ya está activo, activar si no.
   */
  const handleSegmentClick = (status: SpecStatus) => {
    if (activeSegment === status) {
      onSegmentClick(null)
    } else {
      onSegmentClick(status)
    }
  }

  // Leyenda de colores para mostrar debajo del donut
  const LEGEND_LABELS: Record<SpecStatus, string> = {
    traced: 'Trazado',
    untraced: 'Sin trazar',
    drift: 'Desactualizado',
    na: 'No aplica',
  }

  return (
    <div className="donut-indicator" style={{ textAlign: 'center' }}>
      <h4 className="donut-indicator__title" style={{ margin: '0 0 8px 0', fontSize: '0.85rem', fontWeight: 600, color: '#ffffff' }}>
        Trazabilidad de módulos
      </h4>
      <svg viewBox="0 0 120 120" width="120" height="120" style={{ display: 'block', margin: '0 auto' }}>
        {segments.map((segment) => {
          // Longitud del arco para este segmento
          const segmentLength = (segment.percentage / 100) * CIRCUMFERENCE
          // Offset desde el inicio (stroke-dashoffset desplaza hacia atrás)
          const dashOffset = CIRCUMFERENCE - (cumulativePercentage / 100) * CIRCUMFERENCE

          // Ángulo de inicio y ángulo del segmento (para calcular offset radial)
          const startAngle = (cumulativePercentage / 100) * 360
          const segmentAngle = (segment.percentage / 100) * 360

          // Determinar si este segmento está activo
          const isActive = activeSegment === segment.status

          // Calcular transform para segmento activo (separación radial)
          // Combinamos la rotación -90° (para que empiece arriba) con el offset radial
          const radialTranslate = isActive
            ? computeRadialTranslate(startAngle, segmentAngle)
            : 'translate(0px, 0px)'
          const combinedTransform = `rotate(-90deg) ${radialTranslate}`

          // Avanzar el acumulado para el siguiente segmento
          cumulativePercentage += segment.percentage

          return (
            <circle
              key={segment.status}
              className="donut-indicator__segment"
              cx={CENTER}
              cy={CENTER}
              r={RADIUS}
              fill="none"
              stroke={segment.color}
              strokeWidth={STROKE_WIDTH}
              strokeDasharray={`${segmentLength} ${CIRCUMFERENCE - segmentLength}`}
              strokeDashoffset={dashOffset}
              style={{
                transform: combinedTransform,
                transformOrigin: `${CENTER}px ${CENTER}px`,
                transition: 'all 200ms ease',
                cursor: 'pointer',
              }}
              onClick={() => handleSegmentClick(segment.status)}
              data-status={segment.status}
              role="button"
              aria-label={`${segment.status}: ${segment.percentage}%`}
            />
          )
        })}

        {/* Texto central: porcentaje de traced */}
        <text
          className="donut-indicator__center-text"
          x={CENTER}
          y={CENTER}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize="16"
          fontWeight="bold"
          fill="#ffffff"
        >
          {tracedPercentage}%
        </text>
      </svg>

      {/* Leyenda de colores */}
      <div className="donut-indicator__legend" style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '8px 12px', marginTop: '8px' }}>
        {segments.map((segment) => (
          <span key={segment.status} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.72rem', color: '#ffffff' }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: segment.color, flexShrink: 0 }} />
            {LEGEND_LABELS[segment.status]}
          </span>
        ))}
      </div>
    </div>
  )
}
