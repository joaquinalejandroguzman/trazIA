// Tipos TypeScript compartidos entre todos los agentes
// Contrato JSON estricto para comunicación entre Analizador, Agente de Integraciones y Orquestador

/**
 * Tipo de nodo en el grafo de arquitectura
 */
export type NodeType = 'module' | 'folder' | 'database' | 'external_api'

/**
 * Tipo de integración externa detectada
 */
export type IntegrationType = 'database' | 'external_api'

/**
 * Estado de spec de un módulo — clasificado por heurísticas o por Haiku (on-demand)
 * - traced: el módulo tiene una spec EARS generada y actualizada
 * - drift: el módulo tiene spec pero hay divergencia respecto al código actual
 * - untraced: el módulo no tiene spec o no pudo clasificarse
 * - na: no aplica — archivo de config, estilo o documentación que no necesita spec
 */
export type SpecStatus = 'traced' | 'drift' | 'untraced' | 'na'

/**
 * Nodo de módulo en el grafo de arquitectura — representa un archivo/módulo del proyecto
 */
export interface ModuleNode {
  id: string              // ruta relativa del módulo (ej: src/agents/analyzer/index.ts)
  name: string            // nombre legible del módulo
  type: 'module'          // discriminante de tipo
  dependencies: string[]  // ids de otros ModuleNode (imports relativos resueltos)
  path: string            // ruta relativa completa
  parentFolder?: string   // id de la carpeta padre (para agrupación visual)
  linesOfCode?: number    // líneas de código (opcional)
  lastModified?: string   // ISO date string de última modificación (opcional)
  // Nuevos campos obligatorios (post-Analyzer)
  specStatus: SpecStatus  // clasificación del módulo por Haiku
  specHealthScore: number // 0–100, clampado
  // Campos de contenido — incluidos en la respuesta JSON al frontend
  sourceContent?: string  // contenido leído del archivo, truncado a 4000 chars — incluido en respuesta al frontend
  earsSpec?: string       // spec EARS generada on-demand por Sonnet — vacío hasta que se genera
}

/**
 * Nodo de carpeta — agrupa archivos visualmente en el grafo
 */
export interface FolderNode {
  id: string              // ruta de la carpeta (ej: "src/routes")
  name: string            // nombre corto (ej: "routes")
  type: 'folder'
  path: string            // ruta relativa
  parentFolder?: string   // id de la carpeta padre (para anidamiento)
  childCount: number      // cantidad de hijos directos
}

/**
 * Nodo de integración externa — representa una BD o API detectada por el Agente de Integraciones
 */
export interface IntegrationNode {
  id: string              // identificador único (ej: "integration:postgresql-pg")
  name: string            // nombre legible (ej: "PostgreSQL (pg)")
  type: IntegrationType   // tipo de integración
  detectedIn: string[]    // ids de ModuleNode donde se detectó el uso
  description: string     // resumen de lo que se detectó (ej: "usa `pg` para conectar a Postgres")
}

/**
 * Nodo genérico del grafo (unión discriminada)
 */
export type GraphNode = ModuleNode | FolderNode | IntegrationNode

/**
 * Arista del grafo de arquitectura
 */
export interface GraphEdge {
  source: string          // id del nodo origen
  target: string          // id del nodo destino
  type: 'dependency' | 'integration'  // imports entre módulos vs conexión a integración
}

/**
 * Resultado completo del análisis de un repositorio (respuesta del Orquestador)
 */
export interface AnalysisResult {
  repoUrl: string
  analyzedAt: string              // ISO date string
  modules: ModuleNode[]
  folders: FolderNode[]
  integrations: IntegrationNode[]
  edges: GraphEdge[]
  totalModules: number
  totalIntegrations: number       // BD + APIs externas detectadas
  primaryLanguage: string         // lenguaje/stack predominante detectado
  tracedCount: number             // módulos con spec generada (specStatus === 'traced')
  untracedCount: number           // módulos sin spec (specStatus === 'untraced')
  driftCount: number              // módulos con spec desactualizada (specStatus === 'drift')
  projectHealthScore: number      // promedio aritmético de specHealthScore, entero 0–100
  readme?: string                 // contenido del README.md del repositorio (truncado)
}

/**
 * Request para iniciar análisis de repositorio
 */
export interface AnalyzeRequest {
  repoUrl: string
}
