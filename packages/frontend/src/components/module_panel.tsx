import React, { useState } from 'react'
import type { ModuleNode } from '../types'
import { SpecHealthBar } from './spec_health_bar'

interface ModulePanelProps {
  module: ModuleNode | null
  onClose: () => void
  onGenerateSpec: (moduleId: string) => void
  isGenerating: boolean
}

// FALLBACK: eliminar cuando el backend siempre provea proseSummary en ModuleNode.
// Este parser regex es frágil y no cubre todos los patrones EARS. Existe solo para
// que el modo mock muestre algo legible. En producción, el Agente Redactor EARS
// genera el resumen en prosa directamente.
function generateProseSummary(specContent: string): string {
  if (import.meta.env.DEV) {
    console.warn('[TrazIA] Usando fallback local para proseSummary — el backend debería proveerlo')
  }

  // Extrae las líneas con keywords EARS y las convierte a prosa simple
  const lines = specContent
    .split('\n')
    .filter((line) => /^\*\*(WHEN|THEN|IF|WHERE|THE)\*\*/.test(line.trim()))
    .map((line) =>
      line
        .replace(/\*\*/g, '')
        .replace(/^(WHEN|THEN|IF|WHERE|THE)\s+/, '')
        .replace(/\s*SHALL\s*/, ' ')
        .trim()
    )

  if (lines.length === 0) return 'Módulo con spec generada.'
  return lines.slice(0, 3).join('. ') + '.'
}

// Panel lateral que muestra detalles de un módulo seleccionado
export const ModulePanel: React.FC<ModulePanelProps> = ({
  module,
  onClose,
  onGenerateSpec,
  isGenerating,
}) => {
  const [showFullEars, setShowFullEars] = useState(false)

  if (!module) return null

  const canGenerateSpec = module.specStatus === 'untraced' && !isGenerating
  // Usa el resumen en prosa del backend si está disponible; si no, lo genera localmente
  const proseSummary = module.proseSummary
    ?? (module.specContent ? generateProseSummary(module.specContent) : null)

  return (
    <aside
      className={`module-panel ${module ? 'module-panel--open' : ''}`}
      role="complementary"
      aria-label="Detalles del módulo"
    >
      <div className="module-panel__header">
        <h2 className="module-panel__title">{module.name}</h2>
        <button
          className="module-panel__close"
          onClick={onClose}
          aria-label="Cerrar panel"
          title="Cerrar"
        >
          ✕
        </button>
      </div>

      <div className="module-panel__body">
        <section className="module-panel__section">
          <h3 className="module-panel__section-title">Ruta</h3>
          <p className="module-panel__code">{module.path}</p>
        </section>

        <section className="module-panel__section">
          <h3 className="module-panel__section-title">Estado</h3>
          <div className="module-panel__status">
            <span className={`module-panel__badge module-panel__badge--${module.specStatus}`}>
              {module.specStatus === 'traced' && '🟢 Trazado'}
              {module.specStatus === 'drift' && '🟡 Drift'}
              {module.specStatus === 'untraced' && '🔴 Sin trazabilidad'}
            </span>
          </div>
        </section>

        <section className="module-panel__section">
          <SpecHealthBar score={module.specHealthScore} size="small" showLabel />
        </section>

        {module.linesOfCode !== undefined && (
          <section className="module-panel__section">
            <h3 className="module-panel__section-title">Líneas de código</h3>
            <p className="module-panel__text">{module.linesOfCode.toLocaleString()}</p>
          </section>
        )}

        {module.lastModified && (
          <section className="module-panel__section">
            <h3 className="module-panel__section-title">Última modificación</h3>
            <p className="module-panel__text">
              {new Date(module.lastModified).toLocaleDateString('es-AR', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </p>
          </section>
        )}

        {module.dependencies.length > 0 && (
          <section className="module-panel__section">
            <h3 className="module-panel__section-title">
              Dependencias ({module.dependencies.length})
            </h3>
            <ul className="module-panel__list">
              {module.dependencies.map((dep) => (
                <li key={dep} className="module-panel__list-item">
                  <code className="module-panel__code-inline">{dep}</code>
                </li>
              ))}
            </ul>
          </section>
        )}

        {module.specContent && (
          <section className="module-panel__section">
            <h3 className="module-panel__section-title">Intención del módulo</h3>
            {proseSummary && (
              <p className="module-panel__prose-summary">{proseSummary}</p>
            )}
            {module.specStatus === 'drift' && (
              <div className="module-panel__drift-warning">
                ⚠️ Esta spec puede estar desactualizada respecto al código actual
              </div>
            )}
            <button
              className="module-panel__toggle-ears"
              onClick={() => setShowFullEars(!showFullEars)}
              aria-expanded={showFullEars}
            >
              {showFullEars ? '▾ Ocultar spec EARS' : '▸ Ver spec EARS completa'}
            </button>
            {showFullEars && (
              <pre className="module-panel__spec-content">{module.specContent}</pre>
            )}
          </section>
        )}

        {canGenerateSpec && (
          <section className="module-panel__section module-panel__section--actions">
            <button
              className="module-panel__btn module-panel__btn--primary"
              onClick={() => onGenerateSpec(module.id)}
              disabled={isGenerating}
            >
              {isGenerating ? (
                <>
                  <span className="module-panel__spinner" aria-hidden="true" />
                  Generando spec…
                </>
              ) : (
                '✨ Generar spec EARS'
              )}
            </button>
            <p className="module-panel__hint">
              El agente redactará la spec retroactiva en sintaxis EARS
            </p>
          </section>
        )}
      </div>
    </aside>
  )
}
