import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useAnalysis } from './hooks/use_analysis'
import { useNodeFilter } from './hooks/use_node_filter'
import { usePanelLayout } from './hooks/use_panel_layout'
import { RepoInput } from './components/repo_input'
import { ProjectSummary } from './components/project_summary'
import { ArchitectureGraph, type ArchitectureGraphRef } from './components/architecture_graph'
import { GraphLegend } from './components/graph_legend'
import { ModulePanel } from './components/module_panel'
import { ChatPanel } from './components/chat_panel'
import { ErrorBanner } from './components/error_banner'
import { ToggleSidebarButton } from './components/toggle_sidebar_button'
import { SidebarPanel } from './components/sidebar_panel'
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

  // Hook centralizado de estado de paneles (sidebar, vista completa, chat)
  const {
    leftPanelOpen,
    rightPanelOpen,
    chatOpen,
    showLeftToggle,
    showChatToggle,
    toggleLeftPanel,
    openRightPanel,
    closeRightPanel,
    toggleChat,
  } = usePanelLayout()

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

  // Focus management: al entrar en Vista Completa, mover foco al botón de cierre del panel (Req 6.6)
  useEffect(() => {
    if (rightPanelOpen) {
      setTimeout(() => {
        const closeBtn = document.querySelector('.module-panel__close') as HTMLElement
        closeBtn?.focus()
      }, 250)
    }
  }, [rightPanelOpen])

  const handleAnalyze = (repoUrl: string) => {
    setSelectedNode(null)
    analyzeRepo(repoUrl)
  }

  const handleGenerateSpec = async (moduleId: string) => {
    await generateSpec(moduleId)
  }

  // Al seleccionar un nodo en el grafo → entra en Vista Completa
  const handleNodeClick = (node: GraphNode) => {
    setSelectedNode(node)
    openRightPanel()
    clearAll()
    setClearFiltersSignal(prev => prev + 1)
  }

  // Al cerrar el panel de detalle → sale de Vista Completa y restaura estado previo
  const handleClosePanel = () => {
    setSelectedNode(null)
    closeRightPanel()
  }

  // Maneja el filtro de búsqueda desde NodeSearch del ProjectSummary
  const handleDimNodes = useCallback((matchingIds: Set<string>, filterType: 'search' | 'traceability') => {
    if (filterType === 'search') {
      applySearchFilter(matchingIds)
    }
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

  // Navega a cualquier nodo dentro de Vista Completa (Req 2.9): actualiza contenido sin cerrar/reabrir panel
  const handleNodeNavigate = (nodeId: string) => {
    const targetFolder = result?.folders.find(f => f.id === nodeId)
    const targetModule = result?.modules.find(m => m.id === nodeId)
    const target = targetFolder ?? targetModule

    if (!target) return

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

      {/* Dashboard completo: sidebar + grafo + panel + chat */}
      {showDashboard && (
        <main className="app__main">
          {/* Panel lateral izquierdo — superpuesto al grafo */}
          <SidebarPanel isOpen={leftPanelOpen}>
            <ProjectSummary
              result={result}
              onFitToNode={(nodeId) => graphRef.current?.fitToNode(nodeId)}
              onDimNodes={handleDimNodes}
              onClearDimming={handleClearDimming}
              clearFiltersSignal={clearFiltersSignal}
              onTraceabilityFilter={handleTraceabilityFilter}
            />
            <GraphLegend />
          </SidebarPanel>

          {/* Grafo interactivo — siempre 100% del contenedor */}
          <section className="app__graph-container">
            <ToggleSidebarButton
              isExpanded={leftPanelOpen}
              onClick={toggleLeftPanel}
              visible={showLeftToggle}
            />
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

          {/* Panel de detalle — Vista Completa (fullscreen overlay) */}
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

          {/* Chat contextual — posición fija, controlado por usePanelLayout */}
          <ChatPanel
            modules={result.modules}
            readme={result.readme}
            isOpen={chatOpen}
            onToggle={toggleChat}
            visible={showChatToggle}
          />
        </main>
      )}
    </div>
  )
}

export default App
