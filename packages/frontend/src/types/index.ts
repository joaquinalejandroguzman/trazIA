// Tipos compartidos del frontend — alineados con el contrato JSON del backend

// Estado de trazabilidad de un módulo
export type SpecStatus = 'traced' | 'drift' | 'untraced'

// Estado del análisis completo
export type AnalysisStatus = 'idle' | 'loading' | 'success' | 'error'

// Nodo del grafo de arquitectura
export interface ModuleNode {
  id: string              // ruta relativa del módulo (ej: src/agents/analyzer/index.ts)
  name: string            // nombre legible (ej: analyzer/index)
  specStatus: SpecStatus
  specHealthScore: number // 0–100
  dependencies: string[]  // ids de otros ModuleNode
  path: string            // ruta relativa al repo
  linesOfCode?: number
  lastModified?: string   // ISO date string
  specContent?: string    // contenido EARS generado o existente
  proseSummary?: string   // resumen legible en prosa derivado de la spec EARS
}

// Respuesta del Agente Orquestador
export interface AnalysisResult {
  repoUrl: string
  analyzedAt: string      // ISO date string
  projectHealthScore: number  // 0–100
  modules: ModuleNode[]
  totalModules: number
  tracedCount: number
  driftCount: number
  untracedCount: number
}

// Request para análisis
export interface AnalyzeRequest {
  repoUrl: string
}

// Response de generación de spec on-demand
export interface GenerateSpecResponse {
  moduleId: string
  specContent: string     // contenido EARS generado
  savedPath: string       // ruta donde se guardó en .kiro/specs/
}
