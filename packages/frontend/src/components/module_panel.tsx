import React from 'react'
import type { ModuleNode, FolderNode, IntegrationNode, GraphNode } from '../types'

interface ModulePanelProps {
  node: GraphNode | null
  onClose: () => void
}

// Panel lateral que muestra detalles de un nodo seleccionado (módulo, carpeta o integración)
export const ModulePanel: React.FC<ModulePanelProps> = ({ node, onClose }) => {
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
