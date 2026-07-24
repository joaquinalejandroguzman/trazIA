import React, { useState } from 'react'
import { useAnalysis } from './hooks/use_analysis'
import { RepoInput } from './components/repo_input'
import { ProjectSummary } from './components/project_summary'
import { ArchitectureGraph } from './components/architecture_graph'
import { GraphLegend } from './components/graph_legend'
import { ModulePanel } from './components/module_panel'
import { ErrorBanner } from './components/error_banner'
import type { ModuleNode } from './types'
import './App.css'

// Componente raíz de la aplicación TrazIA — orquesta el flujo completo
const App: React.FC = () => {
  const { status, result, error, generatingSpec, analyzeRepo, generateSpec, clearError, reset } = useAnalysis()
  // Guardamos solo el id para evitar closures obsoletos: el objeto se deriva en cada render
  const [selectedModuleId, setSelectedModuleId] = useState<string | null>(null)
  const selectedModule = result?.modules.find((m) => m.id === selectedModuleId) ?? null

  const handleAnalyze = (repoUrl: string) => {
    setSelectedModuleId(null)
    analyzeRepo(repoUrl)
  }

  const handleGenerateSpec = async (moduleId: string) => {
    // No hace falta sincronizar nada a mano: selectedModule se recalcula
    // automáticamente en el siguiente render con los datos actualizados de result
    await generateSpec(moduleId)
  }

  const handleNodeClick = (module: ModuleNode) => {
    setSelectedModuleId(module.id)
  }

  const handleClosePanel = () => {
    setSelectedModuleId(null)
  }

  const showDashboard = status === 'success' && result

  return (
    <div className="app">
      {/* Barra superior con input de URL (hero inicial o compacto) */}
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
              onNodeClick={handleNodeClick}
              selectedModuleId={selectedModule?.id}
            />
          </section>

          {/* Panel lateral derecho: detalles del módulo seleccionado */}
          <ModulePanel
            module={selectedModule}
            onClose={handleClosePanel}
            onGenerateSpec={handleGenerateSpec}
            isGenerating={generatingSpec === selectedModule?.id}
          />
        </main>
      )}
    </div>
  )
}

export default App
