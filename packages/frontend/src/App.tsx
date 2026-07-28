import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useAnalysis } from './hooks/use_analysis'
import { useNodeFilter } from './hooks/use_node_filter'
import { usePanelLayout } from './hooks/use_panel_layout'
import { useIsMobile } from './hooks/use_is_mobile'
import { RepoInput } from './components/repo_input'
import { ProjectSummary } from './components/project_summary'
import { ArchitectureGraph, type ArchitectureGraphRef } from './components/architecture_graph'
import { GraphLegend } from './components/graph_legend'
import { ModulePanel } from './components/module_panel'
import { ChatPanel } from './components/chat_panel'
import { ErrorBanner } from './components/error_banner'
import { Footer } from './components/footer'
import { ToggleSidebarButton } from './components/toggle_sidebar_button'
import { SidebarPanel } from './components/sidebar_panel'
import type { GraphNode, SpecStatus } from './types'
import './App.css'

// Componente raíz de la aplicación TrazIA — orquesta el flujo completo
const App: React.FC = () => {
  const { status, result, error, generatingSpec, specErrorModules, analyzeRepo, generateSpec, clearSpecError, clearError, reset } = useAnalysis()
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null)
  const graphRef = useRef<ArchitectureGraphRef>(null)
  const [clearFiltersSignal, setClearFiltersSignal] = useState(0)

  // Detectar si es mobile para condicionar el comportamiento de paneles
  const isMobile = useIsMobile()

  // Hook de paneles — solo se usa activamente en mobile
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

  // Focus management en mobile: al entrar en Vista Completa, mover foco al botón de cierre
  useEffect(() => {
    if (isMobile && rightPanelOpen) {
      setTimeout(() => {
        const closeBtn = document.querySelector('.module-panel__close') as HTMLElement
        closeBtn?.focus()
      }, 250)
    }
  }, [rightPanelOpen, isMobile])

  const handleAnalyze = (repoUrl: string) => {
    setSelectedNode(null)
    analyzeRepo(repoUrl)
  }

  const handleGenerateSpec = async (moduleId: string) => {
    await generateSpec(moduleId)
  }

  const handleNodeClick = (node: GraphNode) => {
    setSelectedNode(node)
    if (isMobile) {
      openRightPanel()
    }
    clearAll()
    setClearFiltersSignal(prev => prev + 1)
  }

  const handleClosePanel = () => {
    setSelectedNode(null)
    if (isMobile) {
      closeRightPanel()
    }
  }

  const handleDimNodes = useCallback((matchingIds: Set<string>, filterType: 'search' | 'traceability') => {
    if (filterType === 'search') {
      applySearchFilter(matchingIds)
    }
  }, [applySearchFilter])

  const handleTraceabilityFilter = useCallback((status: SpecStatus | null) => {
    if (status === null) {
      clearAll()
    } else if (result) {
      applyTraceabilityFilter(status, result.modules)
    }
  }, [applyTraceabilityFilter, clearAll, result])

  const handleClearDimming = useCallback(() => {
    clearAll()
  }, [clearAll])

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
      <header className="app__header">
        <RepoInput onAnalyze={handleAnalyze} status={status} onReset={reset} />
      </header>

      {error && (
        <div className="app__error-container">
          <ErrorBanner message={error} onDismiss={clearError} />
        </div>
      )}

      {!showDashboard && <Footer />}

      {showDashboard && (
        <main className={`app__main ${isMobile ? 'app__main--mobile' : ''}`}>
          {/* Desktop: sidebar siempre visible como grid column */}
          {!isMobile && (
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
          )}

          {/* Mobile: sidebar como overlay con toggle */}
          {isMobile && (
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
          )}

          {/* Grafo interactivo */}
          <section className="app__graph-container">
            {/* Toggle solo visible en mobile */}
            {isMobile && (
              <ToggleSidebarButton
                isExpanded={leftPanelOpen}
                onClick={toggleLeftPanel}
                visible={showLeftToggle}
              />
            )}
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

          {/* Panel de detalle */}
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

          {/* Chat contextual */}
          <ChatPanel
            modules={result.modules}
            readme={result.readme}
            isOpen={isMobile ? chatOpen : undefined}
            onToggle={isMobile ? toggleChat : undefined}
            visible={isMobile ? showChatToggle : true}
            isRightPanelOpen={!isMobile && selectedNode !== null}
          />
        </main>
      )}
    </div>
  )
}

export default App
