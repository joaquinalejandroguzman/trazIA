import dagre from 'dagre'
import type { ModuleNode } from '../types'

// Dimensiones por defecto de los nodos
const NODE_WIDTH = 180
const NODE_HEIGHT = 60

// Configuración del layout dirigido acíclico
interface LayoutOptions {
  direction?: 'TB' | 'LR'   // top-to-bottom o left-to-right
  nodeSep?: number           // separación horizontal entre nodos del mismo rango
  rankSep?: number           // separación vertical entre rangos (niveles)
  edgeSep?: number           // separación entre aristas
}

// Resultado del cálculo de layout: posiciones para cada nodo
export interface NodePosition {
  id: string
  x: number
  y: number
}

/**
 * Calcula posiciones óptimas para los nodos usando el algoritmo de dagre.
 * Respeta la topología del grafo de dependencias: los módulos que dependen de otros
 * se colocan debajo (o a la derecha) de sus dependencias.
 */
export function computeLayout(
  modules: ModuleNode[],
  options: LayoutOptions = {}
): NodePosition[] {
  const {
    direction = 'TB',
    nodeSep = 60,
    rankSep = 80,
    edgeSep = 20,
  } = options

  const graph = new dagre.graphlib.Graph()

  // Configurar el grafo como dirigido con layout de izquierda a derecha o arriba a abajo
  graph.setGraph({
    rankdir: direction,
    nodesep: nodeSep,
    ranksep: rankSep,
    edgesep: edgeSep,
    marginx: 20,
    marginy: 20,
  })

  // dagre requiere este default para las aristas
  graph.setDefaultEdgeLabel(() => ({}))

  // Conjunto de IDs válidos para filtrar dependencias que apuntan fuera del grafo
  const validIds = new Set(modules.map((m) => m.id))

  // Registrar todos los nodos con sus dimensiones
  for (const mod of modules) {
    graph.setNode(mod.id, { width: NODE_WIDTH, height: NODE_HEIGHT })
  }

  // Registrar las aristas (dependencias) — solo las que apuntan a nodos existentes
  for (const mod of modules) {
    for (const dep of mod.dependencies) {
      if (validIds.has(dep)) {
        graph.setEdge(mod.id, dep)
      }
    }
  }

  // Ejecutar el algoritmo de layout
  dagre.layout(graph)

  // Extraer las posiciones calculadas
  // dagre retorna el centro del nodo; reactflow espera la esquina superior izquierda
  const positions: NodePosition[] = modules.map((mod) => {
    const node = graph.node(mod.id)
    return {
      id: mod.id,
      x: node.x - NODE_WIDTH / 2,
      y: node.y - NODE_HEIGHT / 2,
    }
  })

  return positions
}

// Re-exporta las dimensiones para que architecture_graph pueda usarlas
export { NODE_WIDTH, NODE_HEIGHT }
