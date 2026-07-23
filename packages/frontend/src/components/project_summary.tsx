import React from 'react'
import type { AnalysisResult } from '../types'
import { SpecHealthBar } from './spec_health_bar'

interface ProjectSummaryProps {
  result: AnalysisResult
}

// Tarjetas de resumen del proyecto: score global y distribución de módulos
export const ProjectSummary: React.FC<ProjectSummaryProps> = ({ result }) => {
  const {
    projectHealthScore,
    totalModules,
    tracedCount,
    driftCount,
    untracedCount,
    repoUrl,
    analyzedAt,
  } = result

  // Extrae el nombre del repo de la URL para mostrarlo
  const repoName = repoUrl.replace(/^https?:\/\/github\.com\//, '').replace(/\/$/, '')

  // Calcula porcentajes para mostrar distribución
  const tracedPercent = Math.round((tracedCount / totalModules) * 100)
  const driftPercent = Math.round((driftCount / totalModules) * 100)
  const untracedPercent = Math.round((untracedCount / totalModules) * 100)

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

      <div className="project-summary__score-section">
        <SpecHealthBar
          score={projectHealthScore}
          size="large"
          showLabel
          label={`Spec Health Score: ${projectHealthScore}%`}
        />
        <p className="project-summary__score-hint">
          {projectHealthScore >= 70 && '✅ Proyecto bien documentado'}
          {projectHealthScore >= 40 && projectHealthScore < 70 && '⚠️ Documentación parcial — riesgo medio'}
          {projectHealthScore < 40 && '🔴 Alta deuda de trazabilidad'}
        </p>
      </div>

      <div className="project-summary__cards">
        <div className="project-summary__card">
          <span className="project-summary__card-value">{totalModules}</span>
          <span className="project-summary__card-label">Módulos totales</span>
        </div>
        <div className="project-summary__card project-summary__card--traced">
          <span className="project-summary__card-value">{tracedCount}</span>
          <span className="project-summary__card-label">🟢 Trazados</span>
          <span className="project-summary__card-percent">{tracedPercent}%</span>
        </div>
        <div className="project-summary__card project-summary__card--drift">
          <span className="project-summary__card-value">{driftCount}</span>
          <span className="project-summary__card-label">🟡 Drift</span>
          <span className="project-summary__card-percent">{driftPercent}%</span>
        </div>
        <div className="project-summary__card project-summary__card--untraced">
          <span className="project-summary__card-value">{untracedCount}</span>
          <span className="project-summary__card-label">🔴 Sin spec</span>
          <span className="project-summary__card-percent">{untracedPercent}%</span>
        </div>
      </div>

      <div className="project-summary__agents-info">
        <h3 className="project-summary__agents-title">Pipeline de agentes</h3>
        <ul className="project-summary__agents-list">
          <li>🔍 Analizador — mapea módulos y dependencias</li>
          <li>✍️ Redactor EARS — genera specs retroactivas</li>
          <li>📊 Orquestador — calcula Spec Health Score</li>
        </ul>
      </div>
    </div>
  )
}
