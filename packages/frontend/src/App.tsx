import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useAnalysis } from './hooks/use_analysis'
import { useNodeFilter } from './hooks/use_node_filter'
import { RepoInput } from './components/repo_input'
import { ProjectSummary } from './components/project_summary'
import { ArchitectureGraph, type ArchitectureGraphRef } from './components/architecture_graph'
import { GraphLegend } from './components/graph_legend'
import { ModulePanel } from './components/module_panel'
import { ChatPanel } from './components/chat_panel'
import { ErrorBanner } from './components/error_banner'
import type { GraphNode, SpecStatus } from './types'
import './App.css'

// Componente raíz de la aplicación TrazIA — orquesta el flujo completo
const App: React.FC = () => {
  const { status, result, error, generatingSpec, specErrorModules, analyzeRepo, generateSpec, clearSpecError, clearError, reset } = useAnalysis()
  // Guardamos el nodo seleccionado completo para poder mostrarlo en el panel
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null)
  // Ref imperativa para controlar el centrado del grafo
  const graphRef = useRef<ArchitectureGraphRef>(null)
  // Señal para limpiar filtros del panel cuando se clickea un nodo en el grafo
  const [clearFiltersSignal, setClearFiltersSignal] = useState(0)

  // Calcular todos los IDs de nodos para el hook de filtrado
  const allNodeIds = useMemo(() => {
    if (!result) return new Set<string>()
    const ids = new Set<string>()
    for (const m of result.modules) ids.add(m.id)
    for (const f of result.folders) ids.add(f.id)
    for (const i of result.integrations) ids.add(i.id)
    return ids
  }, [result])

  // Hook de filtrado/dimming para el grafo
  const { dimmedNodeIds, applySearchFilter, applyTraceabilityFilter, clearAll } = useNodeFilter(allNodeIds)

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
    // Limpiar filtros cuando se clickea un nodo directamente en el grafo
    clearAll()
    setClearFiltersSignal(prev => prev + 1)
  }

  const handleClosePanel = () => {
    setSelectedNode(null)
  }

  // Maneja el filtro de búsqueda desde NodeSearch del ProjectSummary
  const handleDimNodes = useCallback((matchingIds: Set<string>, filterType: 'search' | 'traceability') => {
    if (filterType === 'search') {
      applySearchFilter(matchingIds)
    }
    // Trazabilidad se maneja por onTraceabilityFilter separado
  }, [applySearchFilter])

  // Maneja el filtro de trazabilidad desde el DonutIndicator
  const handleTraceabilityFilter = useCallback((status: SpecStatus | null) => {
    if (status === null) {
      clearAll()
    } else if (result) {
      applyTraceabilityFilter(status, result.modules)
    }
  }, [applyTraceabilityFilter, clearAll, result])

  // Limpia todos los filtros de dimming
  const handleClearDimming = useCallback(() => {
    clearAll()
  }, [clearAll])

  // Navega a cualquier nodo (carpeta o módulo): actualiza la selección y centra el grafo
  const handleNodeNavigate = (nodeId: string) => {
    const targetFolder = result?.folders.find(f => f.id === nodeId)
    const targetModule = result?.modules.find(m => m.id === nodeId)
    const target = targetFolder ?? targetModule

    if (!target) return  // Guard: nodo no existe, no hacer nada

    setSelectedNode(target)
    graphRef.current?.fitToNode(nodeId)
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
        <>
          <main className="app__main">
            {/* Columna izquierda: resumen del proyecto y leyenda */}
            <aside className="app__sidebar">
              <ProjectSummary
                result={result}
                onFitToNode={(nodeId) => graphRef.current?.fitToNode(nodeId)}
                onDimNodes={handleDimNodes}
                onClearDimming={handleClearDimming}
                clearFiltersSignal={clearFiltersSignal}
                onTraceabilityFilter={handleTraceabilityFilter}
              />
              <GraphLegend />
            </aside>

            {/* Columna central: grafo interactivo */}
            <section className="app__graph-container">
              <ArchitectureGraph
                ref={graphRef}
                modules={result.modules}
                folders={result.folders}
                integrations={result.integrations}
                edges={result.edges}
                onNodeClick={handleNodeClick}
                selectedNodeId={selectedNode?.id}
                dimmedNodeIds={dimmedNodeIds}
              />
            </section>

            {/* Panel lateral derecho: detalles del nodo seleccionado */}
            <ModulePanel
              node={selectedNode}
              onClose={handleClosePanel}
              onGenerateSpec={handleGenerateSpec}
              generatingSpec={generatingSpec}
              specError={error}
              specErrorModules={specErrorModules}
              clearSpecError={clearSpecError}
              allFolders={result.folders}
              allModules={result.modules}
              onNodeNavigate={handleNodeNavigate}
            />
          </main>

          {/* Chat contextual — posición fija, coexiste con el panel de spec */}
          <ChatPanel
            modules={result.modules}
            readme={result.readme}
            isSpecPanelOpen={selectedNode !== null}
            specPanelWidth={400}
          />
        </>
      )}
    </div>
  )
}

export default App
