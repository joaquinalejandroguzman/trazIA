import React from 'react'
import type { AnalysisResult } from '../types'

interface ProjectSummaryProps {
  result: AnalysisResult
}

// Tarjetas de resumen del proyecto: módulos, integraciones, stack
export const ProjectSummary: React.FC<ProjectSummaryProps> = ({ result }) => {
  const {
    totalModules,
    totalIntegrations,
    primaryLanguage,
    integrations,
    repoUrl,
    analyzedAt,
  } = result

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

      <div className="project-summary__agents-info">
        <h3 className="project-summary__agents-title">Pipeline de agentes</h3>
        <ul className="project-summary__agents-list">
          <li>🔍 Analizador — mapea módulos y dependencias internas</li>
          <li>🔌 Integraciones — detecta BD y APIs externas</li>
          <li>🧩 Orquestador — arma el grafo final</li>
        </ul>
      </div>
    </div>
  )
}
