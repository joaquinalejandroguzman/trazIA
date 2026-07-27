import type { GraphNode, IntegrationNode, ModuleNode, SpecStatus } from '../types'

// --- Tipos ---

/** Segmento del donut de trazabilidad */
export interface DonutSegment {
  status: SpecStatus
  count: number
  percentage: number  // 0-100, redondeado al entero
  color: string       // hex color del tema
}

/** Tipo de filtro activo (para "last wins") */
export type ActiveFilterType = 'search' | 'traceability' | null

// --- Constantes internas ---

/** Colores del tema para cada estado de trazabilidad */
const STATUS_COLORS: Record<SpecStatus, string> = {
  traced: '#10B981',
  untraced: '#EF4444',
  drift: '#F59E0B',
  na: '#6B7280',
}

// --- Funciones puras ---

/**
 * Filtra nodos por coincidencia de nombre (case-insensitive substring).
 * Retorna solo los nodos cuyo name contiene query como subcadena,
 * sin distinguir mayúsculas de minúsculas.
 */
export function filterNodesByName(nodes: GraphNode[], query: string): GraphNode[] {
  const lowerQuery = query.toLowerCase()
  return nodes.filter((node) => node.name.toLowerCase().includes(lowerQuery))
}

/**
 * Ordena nodos alfabéticamente por nombre (case-insensitive) y limita a maxResults.
 * Usa localeCompare con sensitivity 'base' para comparación estable.
 */
export function sortAndCap(nodes: GraphNode[], maxResults: number): GraphNode[] {
  const sorted = [...nodes].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
  )
  return sorted.slice(0, maxResults)
}

/**
 * Calcula los segmentos del donut a partir de los conteos del análisis.
 * - Deriva `na` como totalModules - traced - untraced - drift
 * - Omite segmentos con count === 0
 * - Cada porcentaje se calcula como Math.round(count / totalModules * 100)
 */
export function computeDonutSegments(
  tracedCount: number,
  untracedCount: number,
  driftCount: number,
  totalModules: number
): DonutSegment[] {
  if (totalModules === 0) return []

  const naCount = totalModules - tracedCount - untracedCount - driftCount

  const raw: Array<{ status: SpecStatus; count: number }> = [
    { status: 'traced', count: tracedCount },
    { status: 'untraced', count: untracedCount },
    { status: 'drift', count: driftCount },
    { status: 'na', count: naCount },
  ]

  return raw
    .filter((entry) => entry.count > 0)
    .map((entry) => ({
      status: entry.status,
      count: entry.count,
      percentage: Math.round((entry.count / totalModules) * 100),
      color: STATUS_COLORS[entry.status],
    }))
}

/**
 * Calcula IDs de nodos a dimear (complemento del set de matching).
 * Retorna allNodeIds \ matchingIds (set difference).
 */
export function computeDimmedIds(
  allNodeIds: Set<string>,
  matchingIds: Set<string>
): Set<string> {
  const dimmed = new Set<string>()
  for (const id of allNodeIds) {
    if (!matchingIds.has(id)) {
      dimmed.add(id)
    }
  }
  return dimmed
}

/**
 * Calcula IDs de módulos a dimear por filtro de trazabilidad.
 * Retorna los IDs de módulos cuyo specStatus no coincide con selectedStatus.
 * Trata specStatus undefined como 'untraced'.
 */
export function computeTraceabilityDimmedIds(
  modules: ModuleNode[],
  selectedStatus: SpecStatus
): Set<string> {
  const dimmed = new Set<string>()
  for (const mod of modules) {
    const effectiveStatus: SpecStatus = mod.specStatus ?? 'untraced'
    if (effectiveStatus !== selectedStatus) {
      dimmed.add(mod.id)
    }
  }
  return dimmed
}

/**
 * Devuelve el icono correspondiente al tipo de nodo.
 * Mapeo determinista: module → '📄', folder → '📁', database → '🗄️', external_api → '🌐'
 */
export function getNodeTypeIcon(node: GraphNode): string {
  switch (node.type) {
    case 'module':
      return '📄'
    case 'folder':
      return '📁'
    case 'database':
      return '🗄️'
    case 'external_api':
      return '🌐'
  }
}

/**
 * Agrupa integraciones por tipo: databases primero, luego external_apis.
 * No pierde ni duplica ítems. Mantiene el orden relativo dentro de cada grupo.
 */
export function groupIntegrationsByType(integrations: IntegrationNode[]): IntegrationNode[] {
  const databases = integrations.filter((i) => i.type === 'database')
  const apis = integrations.filter((i) => i.type === 'external_api')
  return [...databases, ...apis]
}
