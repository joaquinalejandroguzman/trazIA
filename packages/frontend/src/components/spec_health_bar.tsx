import React from 'react'

interface SpecHealthBarProps {
  score: number   // 0–100
  size?: 'small' | 'medium' | 'large'
  showLabel?: boolean
  label?: string
}

// Barra visual del Spec Health Score con degradado de color según el puntaje
export const SpecHealthBar: React.FC<SpecHealthBarProps> = ({
  score,
  size = 'medium',
  showLabel = true,
  label,
}) => {
  // Clampea el score entre 0 y 100
  const clampedScore = Math.max(0, Math.min(100, score))

  // Color según el score: 0-39 rojo, 40-69 amarillo, 70-100 verde
  const getScoreColor = (s: number): string => {
    if (s < 40) return '#e74c3c'   // rojo
    if (s < 70) return '#f39c12'   // amarillo
    return '#2ecc71'               // verde
  }

  const barColor = getScoreColor(clampedScore)
  const displayLabel = label ?? `Spec Health Score: ${clampedScore}%`

  return (
    <div className={`spec-health-bar spec-health-bar--${size}`}>
      {showLabel && (
        <label className="spec-health-bar__label">
          {displayLabel}
        </label>
      )}
      <div className="spec-health-bar__track">
        <div
          className="spec-health-bar__fill"
          style={{
            width: `${clampedScore}%`,
            backgroundColor: barColor,
          }}
          role="progressbar"
          aria-valuenow={clampedScore}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={displayLabel}
        />
      </div>
    </div>
  )
}
