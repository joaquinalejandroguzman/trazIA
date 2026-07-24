import React, { useState, useEffect } from 'react'
import { useAnalysis } from './hooks/use_analysis'
import { RepoInput } from './components/repo_input'
import { ProjectSummary } from './components/project_summary'
import { ArchitectureGraph } from './components/architecture_graph'
import { GraphLegend } from './components/graph_legend'
import { ModulePanel } from './components/module_panel'
import { ErrorBanner } from './components/error_banner'
import type { GraphNode } from './types'
import './App.css'

// Componente raíz de la aplicación TrazIA — orquesta el flujo completo
const App: React.FC = () => {
  const { status, result, error, generatingSpec, analyzeRepo, generateSpec, clearError, reset } = useAnalysis()
  // Guardamos el nodo seleccionado completo para poder mostrarlo en el panel
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null)

  // Sincroniza el nodo seleccionado con los datos frescos de result.modules
  useEffect(() => {
    if (selectedNode && selectedNode.type === 'module' && result) {
      const freshModule = result.modules.find((m) => m.id === selectedNode.id)
      if (freshModule && freshModule !== selectedNode) {
        setSelectedNode(freshModule)
      }
    }
  }, [result, selectedNode])

  const handleAnalyze = (repoUrl: string) => {
    setSelectedNode(null)
    analyzeRepo(repoUrl)
  }

  const handleGenerateSpec = async (moduleId: string) => {
    await generateSpec(moduleId)
    // Actualizamos el nodo seleccionado con los datos frescos del result
    // (se recalcula en el siguiente render si hace falta)
  }

  const handleNodeClick = (node: GraphNode) => {
    setSelectedNode(node)
  }

  const handleClosePanel = () => {
    setSelectedNode(null)
  }

  const showDashboard = status === 'success' && result

  return (
    <div className="app">
      {/* Barra superior con input de URL */}
      <header className="app__header">
        <RepoInput onAnalyze={handleAnalyze} status={status} onReset={reset} />
      </header>

      {/* Banner de error si falla el análisis */}
      {error && (
        <div className="app__error-container">
          <ErrorBanner message={error} onDismiss={clearError} />
        </div>
      )}

      {/* Dashboard completo: summary + grafo + panel */}
      {showDashboard && (
        <main className="app__main">
          {/* Columna izquierda: resumen del proyecto y leyenda */}
          <aside className="app__sidebar">
            <ProjectSummary result={result} />
            <GraphLegend />
          </aside>

          {/* Columna central: grafo interactivo */}
          <section className="app__graph-container">
            <ArchitectureGraph
              modules={result.modules}
              folders={result.folders}
              integrations={result.integrations}
              edges={result.edges}
              onNodeClick={handleNodeClick}
              selectedNodeId={selectedNode?.id}
            />
          </section>

          {/* Panel lateral derecho: detalles del nodo seleccionado */}
          <ModulePanel
            node={selectedNode}
            onClose={handleClosePanel}
            onGenerateSpec={handleGenerateSpec}
            generatingSpec={generatingSpec}
            specError={error}
          />
        </main>
      )}
    </div>
  )
}

export default App
