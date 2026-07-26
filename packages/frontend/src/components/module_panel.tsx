import React, { useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faClone, faDownload, faCheck } from '@fortawesome/free-solid-svg-icons'
import type { ModuleNode, FolderNode, IntegrationNode, GraphNode } from '../types'
import { getTraceabilityColor, getEffectiveScore } from '../constants/theme'
import { countDirectChildren, formatChildLabel, getSortedSubfolders, getSortedChildFiles, getParentFolder, truncateFolderName } from '../utils/folder_panel_helpers'

interface ModulePanelProps {
  node: GraphNode | null
  onClose: () => void
  onGenerateSpec: (moduleId: string) => Promise<void>
  generatingSpec: string | null
  specError: string | null
  // Props para on-demand EARS spec
  specErrorModules: Set<string>
  clearSpecError: (moduleId: string) => void
  // Nuevas props para folder-panel-content
  allFolders?: FolderNode[]
  allModules?: ModuleNode[]
  onNodeNavigate?: (nodeId: string) => void
}

// Panel lateral que muestra detalles de un nodo seleccionado (módulo, carpeta o integración)
export const ModulePanel: React.FC<ModulePanelProps> = ({ node, onClose, onGenerateSpec, generatingSpec, specError, specErrorModules, clearSpecError, allFolders, allModules, onNodeNavigate }) => {
  const [copied, setCopied] = useState(false)

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

            {/* Carpeta padre — debajo de la ruta para archivos */}
            {(() => {
              const parent = getParentFolder(node as { parentFolder?: string }, allFolders ?? [])
              if (!parent) return null
              return (
                <section className="module-panel__section">
                  <h3 className="module-panel__section-title">Carpeta padre</h3>
                  <div className="module-panel__folder-buttons">
                    <button
                      className="module-panel__folder-btn"
                      onClick={() => onNodeNavigate?.(parent.id)}
                      title={parent.name}
                    >
                      📁 {truncateFolderName(parent.name)}
                    </button>
                  </div>
                </section>
              )
            })()}

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

              // Early return: módulos con specStatus 'na' no necesitan trazabilidad
              if (specStatus === 'na') {
                return (
                  <section className="module-panel__section">
                    <h3 className="module-panel__section-title">Trazabilidad</h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: '0.85rem', color: '#666' }}>No aplica trazabilidad</span>
                      <span
                        style={{
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          padding: '2px 8px',
                          borderRadius: 4,
                          color: '#fff',
                          backgroundColor: '#adb5bd',
                        }}
                      >
                        N/A
                      </span>
                    </div>
                  </section>
                )
              }

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
              // El caso specStatus 'na' ya retornó arriba: no llega hasta acá
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

            {/* Sección de spec EARS on-demand — solo visible si hay spec, se está generando, o hubo error */}
            {(node as ModuleNode).specStatus !== 'na' && (() => {
              const module = node as ModuleNode
              const isGenerating = generatingSpec === module.id
              const hasSpec = !!module.earsSpec
              const hasError = specErrorModules.has(module.id)

              // No mostrar la sección si no hay spec, no se está generando y no hay error
              if (!hasSpec && !isGenerating && !hasError) return null

              const handleRetry = () => {
                clearSpecError(module.id)
                onGenerateSpec(module.id)
              }

              // Copiar spec al portapapeles
              const handleCopy = async () => {
                if (!module.earsSpec) return
                try {
                  await navigator.clipboard.writeText(module.earsSpec)
                  setCopied(true)
                  setTimeout(() => setCopied(false), 2000)
                } catch {
                  // Fallback para navegadores sin clipboard API
                  const textarea = document.createElement('textarea')
                  textarea.value = module.earsSpec
                  document.body.appendChild(textarea)
                  textarea.select()
                  document.execCommand('copy')
                  document.body.removeChild(textarea)
                  setCopied(true)
                  setTimeout(() => setCopied(false), 2000)
                }
              }

              // Descargar spec como .md
              const handleDownload = () => {
                if (!module.earsSpec) return
                const blob = new Blob([module.earsSpec], { type: 'text/markdown' })
                const url = URL.createObjectURL(blob)
                const link = document.createElement('a')
                link.href = url
                link.download = `${module.name.replace(/\.[^.]+$/, '')}_spec.md`
                document.body.appendChild(link)
                link.click()
                document.body.removeChild(link)
                URL.revokeObjectURL(url)
              }

              return (
                <section className="module-panel__section">
                  <div className="module-panel__spec-header">
                    <h3 className="module-panel__section-title">Spec EARS</h3>
                    {hasSpec && (
                      <div className="module-panel__spec-actions">
                        <button
                          className="module-panel__spec-action-btn"
                          onClick={handleCopy}
                          title={copied ? 'Copiado' : 'Copiar spec'}
                          aria-label={copied ? 'Copiado' : 'Copiar spec al portapapeles'}
                        >
                          {copied ? <FontAwesomeIcon icon={faCheck} /> : <FontAwesomeIcon icon={faClone} />}
                        </button>
                        <button
                          className="module-panel__spec-action-btn"
                          onClick={handleDownload}
                          title="Descargar como .md"
                          aria-label="Descargar spec como archivo markdown"
                        >
                          <FontAwesomeIcon icon={faDownload} />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Caso: generando spec (spinner) */}
                  {isGenerating && !hasSpec && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span
                        className="module-panel__spinner"
                        style={{
                          display: 'inline-block',
                          width: 16,
                          height: 16,
                          border: '2px solid #e0e0e0',
                          borderTop: '2px solid #1976d2',
                          borderRadius: '50%',
                          animation: 'spin 0.8s linear infinite',
                        }}
                      />
                      <span style={{ fontSize: '0.85rem', color: '#666' }}>Generando spec...</span>
                    </div>
                  )}

                  {/* Caso: error — mostrar mensaje truncado + botón Reintentar */}
                  {hasError && !hasSpec && (
                    <div>
                      {specError && (
                        <p
                          style={{
                            fontSize: '0.75rem',
                            color: '#d32f2f',
                            marginBottom: 8,
                            wordBreak: 'break-word',
                          }}
                        >
                          {specError.length > 200 ? `${specError.slice(0, 200)}…` : specError}
                        </p>
                      )}
                      <button
                        className="module-panel__retry-btn"
                        onClick={handleRetry}
                        style={{
                          padding: '6px 12px',
                          borderRadius: 4,
                          border: '1px solid #d32f2f',
                          backgroundColor: 'transparent',
                          color: '#d32f2f',
                          fontSize: '0.8rem',
                          fontWeight: 500,
                          cursor: 'pointer',
                        }}
                      >
                        Reintentar
                      </button>
                    </div>
                  )}

                  {/* Caso: spec disponible (cache hit o recién generada) */}
                  {hasSpec && (
                    <pre className="module-panel__spec-content">
                      {module.earsSpec}
                    </pre>
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
              {(() => {
                const counts = countDirectChildren(node.id, allFolders ?? [], allModules ?? [])
                return (
                  <>
                    <p className="module-panel__text">
                      {formatChildLabel(counts.folders, 'folder')}
                    </p>
                    <p className="module-panel__text">
                      {formatChildLabel(counts.files, 'file')}
                    </p>
                  </>
                )
              })()}
            </section>

            {/* Carpeta padre — debajo de contenido para carpetas */}
            {(() => {
              const parent = getParentFolder(node as { parentFolder?: string }, allFolders ?? [])
              if (!parent) return null
              return (
                <section className="module-panel__section">
                  <h3 className="module-panel__section-title">Carpeta padre</h3>
                  <div className="module-panel__folder-buttons">
                    <button
                      className="module-panel__folder-btn"
                      onClick={() => onNodeNavigate?.(parent.id)}
                      title={parent.name}
                    >
                      📁 {truncateFolderName(parent.name)}
                    </button>
                  </div>
                </section>
              )
            })()}

            {(() => {
              const sortedSubfolders = getSortedSubfolders(node.id, allFolders ?? [])
              if (sortedSubfolders.length === 0) return null
              return (
                <section className="module-panel__section">
                  <h3 className="module-panel__section-title">Subcarpetas</h3>
                  <div className="module-panel__folder-buttons">
                    {sortedSubfolders.map((sub) => (
                      <button
                        key={sub.id}
                        className="module-panel__folder-btn"
                        onClick={() => onNodeNavigate?.(sub.id)}
                        title={sub.name}
                      >
                        📁 {truncateFolderName(sub.name)}
                      </button>
                    ))}
                  </div>
                </section>
              )
            })()}

            {(() => {
              const graphNodeIds = new Set([
                ...(allModules ?? []).map(m => m.id),
                ...(allFolders ?? []).map(f => f.id)
              ])
              const childFiles = getSortedChildFiles(
                node.id,
                allModules ?? [],
                graphNodeIds
              )
              if (childFiles.length === 0) return null
              return (
                <section className="module-panel__section">
                  <h3 className="module-panel__section-title">Archivos</h3>
                  <div className="module-panel__folder-buttons">
                    {childFiles.map((file) => (
                      <button
                        key={file.id}
                        className="module-panel__folder-btn"
                        onClick={() => onNodeNavigate?.(file.id)}
                        title={file.name}
                      >
                        📄 {truncateFolderName(file.name)}
                      </button>
                    ))}
                  </div>
                </section>
              )
            })()}
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
