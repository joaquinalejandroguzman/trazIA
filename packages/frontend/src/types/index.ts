// Tipos compartidos del frontend — alineados con el contrato JSON del backend

// Tipo de nodo en el grafo
export type NodeType = 'module' | 'folder' | 'database' | 'external_api'

// Tipo de integración externa
export type IntegrationType = 'database' | 'external_api'

// Estado del análisis (ciclo de vida del hook)
export type AnalysisStatus = 'idle' | 'loading' | 'success' | 'error'

// Nodo de módulo en el grafo de arquitectura
export interface ModuleNode {
  id: string              // ruta relativa del módulo
  name: string            // nombre legible (ej: analyzer/index)
  type: 'module'          // discriminante de tipo
  dependencies: string[]  // ids de otros ModuleNode
  path: string            // ruta relativa al repo
  parentFolder?: string   // id de la carpeta padre (para agrupación visual)
  linesOfCode?: number
  lastModified?: string   // ISO date string
  // Campos de trazabilidad (opcionales hasta que se genera spec)
  specStatus?: SpecStatus
  specHealthScore?: number
  specContent?: string
}

// Nodo de carpeta — agrupa archivos visualmente
export interface FolderNode {
  id: string              // ruta de la carpeta (ej: "src/routes")
  name: string            // nombre corto (ej: "routes")
  type: 'folder'
  path: string            // ruta relativa
  parentFolder?: string   // id de la carpeta padre (para anidamiento)
  childCount: number      // cantidad de hijos directos
}

// Nodo de integración externa (BD o API)
export interface IntegrationNode {
  id: string              // identificador único
  name: string            // nombre legible (ej: "PostgreSQL (pg)")
  type: IntegrationType   // tipo de integración
  detectedIn: string[]    // ids de ModuleNode donde se detectó
  description: string     // resumen de lo detectado
}

// Nodo genérico del grafo (unión)
export type GraphNode = ModuleNode | FolderNode | IntegrationNode

// Arista del grafo de arquitectura
export interface GraphEdge {
  source: string          // id del nodo origen
  target: string          // id del nodo destino
  type: 'dependency' | 'integration'
}

// Estado de trazabilidad de un módulo
export type SpecStatus = 'traced' | 'untraced' | 'drift'

// Respuesta completa del pipeline de análisis (Orquestador)
export interface AnalysisResult {
  repoUrl: string
  analyzedAt: string          // ISO date string
  modules: ModuleNode[]
  folders: FolderNode[]
  integrations: IntegrationNode[]
  edges: GraphEdge[]
  totalModules: number
  totalIntegrations: number   // BD + APIs externas detectadas
  primaryLanguage: string     // lenguaje/stack predominante
  // Campos de trazabilidad
  tracedCount: number         // módulos con spec generada
  untracedCount: number       // módulos sin spec
  driftCount: number          // módulos cuya spec no refleja el código actual
  projectHealthScore: number  // score global de salud del proyecto (0-100)
}

// Respuesta del endpoint de generación de spec EARS
export interface GenerateSpecResponse {
  moduleId: string
  specContent: string
  savedPath: string
}

// Request para análisis
export interface AnalyzeRequest {
  repoUrl: string
}
