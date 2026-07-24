import React from 'react'
import type { ModuleNode, FolderNode, IntegrationNode, GraphNode } from '../types'
import { getTraceabilityColor, getEffectiveScore } from '../constants/theme'

interface ModulePanelProps {
  node: GraphNode | null
  onClose: () => void
  onGenerateSpec: (moduleId: string) => Promise<void>
  generatingSpec: string | null
  specError: string | null
}

// Panel lateral que muestra detalles de un nodo seleccionado (módulo, carpeta o integración)
export const ModulePanel: React.FC<ModulePanelProps> = ({ node, onClose, onGenerateSpec, generatingSpec, specError }) => {
  if (!node) return null

  const isModule = node.type === 'module'
  const isFolder = node.type === 'folder'
  const isIntegration = node.type === 'database' || node.type === 'external_api'

  return (
    <aside
      className={`module-panel ${node ? 'module-panel--open' : ''}`}
      role="complementary"
      aria-label="Detalles del nodo"
    >
      <div className="module-panel__header">
        <h2 className="module-panel__title">{node.name}</h2>
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
        {/* Tipo de nodo */}
        <section className="module-panel__section">
          <h3 className="module-panel__section-title">Tipo</h3>
          <span className={`module-panel__badge module-panel__badge--${node.type}`}>
            {node.type === 'module' && '📄 Archivo'}
            {node.type === 'folder' && '📁 Carpeta'}
            {node.type === 'database' && '🗄️ Base de datos'}
            {node.type === 'external_api' && '🌐 API externa'}
          </span>
        </section>

        {/* Detalles de módulo */}
        {isModule && (
          <>
            <section className="module-panel__section">
              <h3 className="module-panel__section-title">Ruta</h3>
              <p className="module-panel__code">{(node as ModuleNode).path}</p>
            </section>

            {(node as ModuleNode).linesOfCode !== undefined && (
              <section className="module-panel__section">
                <h3 className="module-panel__section-title">Líneas de código</h3>
                <p className="module-panel__text">
                  {(node as ModuleNode).linesOfCode?.toLocaleString()}
                </p>
              </section>
            )}

            {(node as ModuleNode).lastModified && (
              <section className="module-panel__section">
                <h3 className="module-panel__section-title">Última modificación</h3>
                <p className="module-panel__text">
                  {new Date((node as ModuleNode).lastModified!).toLocaleDateString('es-AR', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </p>
              </section>
            )}

            {(node as ModuleNode).dependencies.length > 0 && (
              <section className="module-panel__section">
                <h3 className="module-panel__section-title">
                  Dependencias ({(node as ModuleNode).dependencies.length})
                </h3>
                <ul className="module-panel__list">
                  {(node as ModuleNode).dependencies.map((dep) => (
                    <li key={dep} className="module-panel__list-item">
                      <code className="module-panel__code-inline">{dep}</code>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* Sección de trazabilidad */}
            {(() => {
              const module = node as ModuleNode
              const specStatus = module.specStatus
              const specHealthScore = module.specHealthScore
              const effectiveScore = getEffectiveScore(specStatus, specHealthScore)
              const traceabilityColor = getTraceabilityColor(effectiveScore)
              const hasScore = specHealthScore !== undefined
              const scoreDisplay = hasScore ? `${Math.floor(specHealthScore)}%` : '0%'
              const isGenerating = generatingSpec === module.id

              // Badge de estado: texto y color según specStatus
              const badgeText = specStatus === 'traced' ? 'Trazado'
                : specStatus === 'drift' ? 'Drift'
                : 'Sin spec'
              const badgeColor = specStatus === 'traced' ? '#43a047'
                : specStatus === 'drift' ? '#fdd835'
                : '#e53935'

              // Botón condicional según la zona efectiva
              // Zona roja (0–33): "Generar Spec", zona amarilla (34–66): "Mejorar Spec", zona verde (67–100) + traced: sin botón
              const showButton = !(specStatus === 'traced' && effectiveScore >= 67)
              const buttonLabel = effectiveScore <= 33 ? 'Generar Spec' : 'Mejorar Spec'

              return (
                <section className="module-panel__section">
                  <h3 className="module-panel__section-title">Trazabilidad</h3>

                  {/* Score y badge de estado */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ fontSize: '0.95rem', fontWeight: 500 }}>
                      {hasScore ? scoreDisplay : 'Sin trazabilidad'}
                    </span>
                    <span
                      style={{
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        padding: '2px 8px',
                        borderRadius: 4,
                        color: '#fff',
                        backgroundColor: badgeColor,
                      }}
                    >
                      {badgeText}
                    </span>
                  </div>

                  {/* Score numérico cuando no hay trazabilidad (mostrar "0%" explícito) */}
                  {!hasScore && (
                    <span style={{ fontSize: '0.8rem', color: '#888', display: 'block', marginBottom: 4 }}>
                      0%
                    </span>
                  )}

                  {/* Barra de progreso */}
                  <div
                    style={{
                      width: '100%',
                      height: 8,
                      borderRadius: 4,
                      backgroundColor: '#e0e0e0',
                      overflow: 'hidden',
                      marginBottom: 12,
                    }}
                  >
                    <div
                      style={{
                        width: `${hasScore ? Math.floor(specHealthScore) : 0}%`,
                        height: '100%',
                        borderRadius: 4,
                        backgroundColor: traceabilityColor,
                        transition: 'width 300ms, background-color 300ms',
                      }}
                    />
                  </div>

                  {/* Botón de generación/mejora de spec */}
                  {showButton && (
                    <button
                      className="module-panel__generate-btn"
                      onClick={() => !isGenerating && onGenerateSpec(module.id)}
                      aria-disabled={isGenerating}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        borderRadius: 6,
                        border: 'none',
                        backgroundColor: isGenerating ? '#bdbdbd' : '#1976d2',
                        color: '#fff',
                        fontSize: '0.85rem',
                        fontWeight: 500,
                        cursor: isGenerating ? 'not-allowed' : 'pointer',
                        opacity: isGenerating ? 0.7 : 1,
                        marginBottom: 8,
                      }}
                    >
                      {isGenerating ? 'Generando...' : buttonLabel}
                    </button>
                  )}

                  {/* Error truncado a 200 caracteres */}
                  {specError && (
                    <p
                      style={{
                        fontSize: '0.75rem',
                        color: '#d32f2f',
                        marginTop: 4,
                        wordBreak: 'break-word',
                      }}
                    >
                      {specError.length > 200 ? `${specError.slice(0, 200)}…` : specError}
                    </p>
                  )}
                </section>
              )
            })()}
          </>
        )}

        {/* Detalles de carpeta */}
        {isFolder && (
          <>
            <section className="module-panel__section">
              <h3 className="module-panel__section-title">Ruta</h3>
              <p className="module-panel__code">{(node as FolderNode).path}</p>
            </section>

            <section className="module-panel__section">
              <h3 className="module-panel__section-title">Contenido</h3>
              <p className="module-panel__text">
                {(node as FolderNode).childCount} elementos directos
              </p>
            </section>
          </>
        )}

        {/* Detalles de integración */}
        {isIntegration && (
          <>
            <section className="module-panel__section">
              <h3 className="module-panel__section-title">Descripción</h3>
              <p className="module-panel__text">{(node as IntegrationNode).description}</p>
            </section>

            <section className="module-panel__section">
              <h3 className="module-panel__section-title">
                Detectada en ({(node as IntegrationNode).detectedIn.length} módulos)
              </h3>
              <ul className="module-panel__list">
                {(node as IntegrationNode).detectedIn.map((file) => (
                  <li key={file} className="module-panel__list-item">
                    <code className="module-panel__code-inline">{file}</code>
                  </li>
                ))}
              </ul>
            </section>
          </>
        )}
      </div>
    </aside>
  )
}
