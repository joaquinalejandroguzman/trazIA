// Tipos TypeScript compartidos entre todos los agentes
// Contrato JSON estricto para comunicación entre Analizador, Redactor EARS y Orquestador

/**
 * Estado de trazabilidad de un módulo
 */
export type SpecStatus = 'traced' | 'drift' | 'untraced'

/**
 * Nodo del grafo de arquitectura — estructura que todos los agentes conocen
 */
export interface ModuleNode {
  id: string              // ruta relativa del módulo (ej: src/agents/analyzer/index.ts)
  name: string            // nombre legible del módulo
  specStatus: SpecStatus  // estado de trazabilidad
  specHealthScore: number // 0–100
  dependencies: string[]  // ids de otros ModuleNode (dependencias directas)
  path: string            // ruta relativa completa
  linesOfCode?: number    // líneas de código (opcional)
  lastModified?: string   // ISO date string de última modificación (opcional)
  specContent?: string    // contenido EARS si existe (opcional)
}

/**
 * Resultado completo del análisis de un repositorio
 */
export interface AnalysisResult {
  repoUrl: string
  analyzedAt: string          // ISO date string
  projectHealthScore: number  // 0–100 score global del proyecto
  modules: ModuleNode[]
  totalModules: number
  tracedCount: number         // módulos con spec vigente
  driftCount: number          // módulos con spec desactualizada
  untracedCount: number       // módulos sin spec
}

/**
 * Request para iniciar análisis de repositorio
 */
export interface AnalyzeRequest {
  repoUrl: string
}

/**
 * Response de generación de spec on-demand
 */
export interface GenerateSpecResponse {
  moduleId: string
  specContent: string     // contenido EARS generado
  savedPath: string       // ruta donde se guardó en .kiro/specs/
}
