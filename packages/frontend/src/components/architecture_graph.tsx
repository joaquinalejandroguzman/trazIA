import React, { useMemo, useCallback, useImperativeHandle } from 'react'
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  useReactFlow,
  type Node,
  type Edge,
  type NodeMouseHandler,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import type { ModuleNode, FolderNode, IntegrationNode, GraphNode, GraphEdge } from '../types'
import { ZONE_COLORS, INTEGRATION_COLORS, getFileIcon, detectZone, getTraceabilityColor, getEffectiveScore } from '../constants/theme'
import { computeFolderDepth, getHierarchyFontSize } from '../utils/folder_hierarchy'
import { FIT_VIEW_DURATION, FIT_VIEW_PADDING } from '../utils/folder_panel_helpers'
import {
  computeLayout,
  getAdaptiveColumns,
  FILE_NODE_WIDTH,
  FILE_NODE_HEIGHT,
  FOLDER_PADDING_X,
  FOLDER_PADDING_Y,
  FOLDER_GAP,
  INTEGRATION_NODE_WIDTH,
  INTEGRATION_NODE_HEIGHT,
  ROOT_GAP,
} from '../utils/graph_layout_engine'

// Interfaz imperativa para controlar el grafo desde fuera
export interface ArchitectureGraphRef {
  fitToNode: (nodeId: string) => void
}

// Custom node para carpetas con título jerárquico visible
function FolderGroupNode({ data }: { data: Record<string, unknown> }) {
  return <>{data.label}</>
}

// Registro de nodeTypes (estable, fuera del render para evitar re-renders)
const nodeTypes = { folderGroup: FolderGroupNode }

interface ArchitectureGraphProps {
  modules: ModuleNode[]
  folders: FolderNode[]
  integrations: IntegrationNode[]
  edges: GraphEdge[]
  onNodeClick: (node: GraphNode) => void
  selectedNodeId?: string | null
}

/**
 * Calcula el layout de los nodos dentro de cada carpeta.
 * Delega el cálculo de posiciones y tamaños a computeLayout() del layout engine,
 * y se encarga de crear los Node[] de ReactFlow con estilos y JSX.
 */
function buildLayoutNodes(
  modules: ModuleNode[],
  folders: FolderNode[],
  integrations: IntegrationNode[],
  selectedId?: string | null
): Node[] {
  const nodes: Node[] = []

  // Delegar cálculo de posiciones y tamaños al layout engine
  const { folderSizes, folderPositions, rootGridWidth } = computeLayout(modules, folders, integrations)

  // Agrupar módulos por carpeta padre (para posicionar archivos dentro de su carpeta)
  const modulesByFolder = new Map<string, ModuleNode[]>()
  const rootModules: ModuleNode[] = []

  for (const mod of modules) {
    if (mod.parentFolder) {
      if (!modulesByFolder.has(mod.parentFolder)) {
        modulesByFolder.set(mod.parentFolder, [])
      }
      modulesByFolder.get(mod.parentFolder)!.push(mod)
    } else {
      rootModules.push(mod)
    }
  }

  // Mapa de carpetas para calcular profundidad jerárquica
  const foldersMap = new Map<string, FolderNode>(folders.map(f => [f.id, f]))

  // Crear nodos de carpeta (React Flow parent nodes)
  for (const folder of folders) {
    const size = folderSizes.get(folder.id) ?? { width: 200, height: 150 }
    const position = folderPositions.get(folder.id) ?? { x: 0, y: 0 }
    const zone = detectZone(folder.path)
    const colors = ZONE_COLORS[zone]
    const isSelected = folder.id === selectedId
    const depth = computeFolderDepth(folder.id, foldersMap)
    const hierarchyFontSize = getHierarchyFontSize(depth)

    nodes.push({
      id: folder.id,
      position,
      data: {
        label: (
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: FOLDER_PADDING_Y,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 4,
            overflow: 'hidden',
          }}>
            <span style={{ fontSize: hierarchyFontSize, lineHeight: 1 }}>📁</span>
            <span style={{
              fontWeight: 700,
              fontSize: hierarchyFontSize,
              color: colors.text,
              opacity: 0.9,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              maxWidth: `calc(100% - 2rem)`,
            }}>
              {folder.name}
            </span>
          </div>
        ),
      },
      width: size.width,
      height: size.height,
      style: {
        width: size.width,
        height: size.height,
        background: `${colors.bg}88`,
        border: `1.5px dashed ${isSelected ? '#333' : colors.border}`,
        borderRadius: 12,
        padding: 0,
      },
      type: 'folderGroup',
      draggable: false,
      selectable: true,
      ...(folder.parentFolder ? { parentId: folder.parentFolder, extent: 'parent' as const } : {}),
    })
  }

  // Crear nodos de archivos (hijos de carpetas)
  for (const mod of modules) {
    const zone = detectZone(mod.path)
    const colors = ZONE_COLORS[zone]
    const icon = getFileIcon(mod.path)
    const isSelected = mod.id === selectedId

    // Calcular posición dentro de la carpeta padre usando columnas adaptativas
    let position = { x: 0, y: 0 }
    if (mod.parentFolder) {
      const siblings = modulesByFolder.get(mod.parentFolder) ?? []
      const idx = siblings.indexOf(mod)
      const cols = getAdaptiveColumns(siblings.length)
      const col = cols > 0 ? idx % cols : 0
      const row = cols > 0 ? Math.floor(idx / cols) : 0
      position = {
        x: FOLDER_PADDING_X + col * (FILE_NODE_WIDTH + FOLDER_GAP),
        y: FOLDER_PADDING_Y + row * (FILE_NODE_HEIGHT + FOLDER_GAP),
      }
    } else {
      // Archivos sin carpeta — ponerlos abajo del todo
      const idx = rootModules.indexOf(mod)
      position = { x: idx * (FILE_NODE_WIDTH + 20), y: -80 }
    }

    // Nombre corto: solo el nombre del archivo
    const shortName = mod.path.split('/').pop() ?? mod.name

    // Indicador de trazabilidad: siempre visible — sin datos = score 0 (rojo)
    const effectiveScore = getEffectiveScore(mod.specStatus, mod.specHealthScore)
    const traceabilityColor = getTraceabilityColor(effectiveScore)

    nodes.push({
      id: mod.id,
      position,
      data: {
        label: (
          <div style={{ display: 'flex', alignItems: 'center', gap: 3, padding: '0 6px', position: 'relative', justifyContent: 'space-between', width: '100%'}}>
            <span style={{ fontSize: '0.75rem', flexShrink: 0 }}>{icon}</span>
            <span style={{
              fontSize: '0.68rem',
              fontWeight: 500,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              maxWidth: FILE_NODE_WIDTH - 40,
            }}>
              {shortName}
            </span>
            {/* Indicador circular de trazabilidad — siempre visible */}
            <span
              style={{
                width: 20,
                height: 20,
                borderRadius: '50%',
                backgroundColor: traceabilityColor,
                border: '1.5px solid #000000ff',
                transition: 'background-color 300ms',
              }}
              aria-label={`Trazabilidad: ${effectiveScore}%`}
            />
          </div>
        ),
      },
      width: FILE_NODE_WIDTH,
      height: FILE_NODE_HEIGHT,
      style: {
        width: FILE_NODE_WIDTH,
        height: FILE_NODE_HEIGHT,
        background: colors.bg,
        border: `1.5px solid ${isSelected ? '#333' : colors.border}`,
        borderRadius: 6,
        color: colors.text,
        boxShadow: isSelected ? '0 0 0 2px rgba(0,0,0,0.2)' : undefined,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        overflow: 'visible',
      },
      draggable: false,
      ...(mod.parentFolder ? { parentId: mod.parentFolder, extent: 'parent' as const } : {}),
    })
  }

  // Nodos de integraciones (fuera de las carpetas, a la derecha)
  integrations.forEach((integ, idx) => {
    const colors = INTEGRATION_COLORS[integ.type]
    const isSelected = integ.id === selectedId
    const icon = integ.type === 'database' ? '🗄️' : '🌐'

    nodes.push({
      id: integ.id,
      position: { x: rootGridWidth + ROOT_GAP, y: idx * (INTEGRATION_NODE_HEIGHT + 20) },
      data: {
        label: (
          <div style={{ textAlign: 'center', lineHeight: 1.3 }}>
            <div style={{ fontSize: '1rem' }}>{icon}</div>
            <div style={{
              fontWeight: 600,
              fontSize: '0.68rem',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              maxWidth: INTEGRATION_NODE_WIDTH - 16,
            }}>
              {integ.name}
            </div>
          </div>
        ),
      },
      style: {
        width: INTEGRATION_NODE_WIDTH,
        height: INTEGRATION_NODE_HEIGHT,
        background: colors.bg,
        border: `2px solid ${isSelected ? '#333' : colors.border}`,
        borderRadius: 10,
        color: colors.text,
        boxShadow: isSelected ? '0 0 0 2px rgba(0,0,0,0.2)' : undefined,
        cursor: 'pointer',
      },
      draggable: false,
    })
  })

  return nodes
}

// Convierte las aristas del dominio en aristas de ReactFlow
// Si hay un nodo seleccionado, resalta las aristas conectadas a él
function buildEdges(edges: GraphEdge[], selectedNodeId?: string | null): Edge[] {
  return edges.map((edge) => {
    const isConnected = selectedNodeId
      ? edge.source === selectedNodeId || edge.target === selectedNodeId
      : false

    return {
      id: `${edge.source}→${edge.target}`,
      source: edge.source,
      target: edge.target,
      type: 'simplebezier',
      style: {
        stroke: isConnected
          ? '#4f8ef7'
          : edge.type === 'integration' ? '#ef6c00' : '#90a4ae',
        strokeWidth: isConnected ? 3 : (edge.type === 'integration' ? 2 : 1.2),
        strokeDasharray: edge.type === 'integration' && !isConnected ? '5,5' : undefined,
        opacity: selectedNodeId && !isConnected ? 0.25 : 1,
        transition: 'stroke 200ms, stroke-width 200ms, opacity 200ms',
      },
      animated: isConnected || edge.type === 'integration',
      zIndex: isConnected ? 1 : -1,
    }
  })
}

// Contenido interno del grafo (con forwardRef para exponer fitToNode)
const GraphContent = React.forwardRef<ArchitectureGraphRef, ArchitectureGraphProps>(
  ({ modules, folders, integrations, edges, onNodeClick, selectedNodeId }, ref) => {
    const { setCenter, getNodesBounds } = useReactFlow()

    const fitToNode = useCallback((nodeId: string) => {
      // Obtener las coordenadas absolutas del nodo mediante getNodesBounds
      const bounds = getNodesBounds([nodeId])
      if (!bounds || bounds.width === 0) return

      // Centrar en el título de la carpeta: mitad del ancho, mitad del alto del header
      const centerX = bounds.x + bounds.width / 2
      const centerY = bounds.y + FOLDER_PADDING_Y / 2

      // Zoom máximo configurado en el grafo (2.5) para acercar al título
      setCenter(centerX, centerY, { zoom: 2.5, duration: FIT_VIEW_DURATION })
    }, [setCenter, getNodesBounds])

    useImperativeHandle(ref, () => ({ fitToNode }), [fitToNode])

    const nodes = useMemo(
      () => buildLayoutNodes(modules, folders, integrations, selectedNodeId),
      [modules, folders, integrations, selectedNodeId]
    )
    const flowEdges = useMemo(() => buildEdges(edges, selectedNodeId), [edges, selectedNodeId])

    // Mapeo inverso para recuperar el nodo cuando se hace click
    const nodeById = useMemo(() => {
      const map = new Map<string, GraphNode>()
      for (const m of modules) map.set(m.id, m)
      for (const f of folders) map.set(f.id, f)
      for (const i of integrations) map.set(i.id, i)
      return map
    }, [modules, folders, integrations])

    const handleNodeClick: NodeMouseHandler = (_event, node) => {
      const graphNode = nodeById.get(node.id)
      if (graphNode) onNodeClick(graphNode)
    }

    return (
      <div style={{ width: '100%', height: '100%' }}>
        <ReactFlow
          nodes={nodes}
          edges={flowEdges}
          nodeTypes={nodeTypes}
          onNodeClick={handleNodeClick}
          fitView
          fitViewOptions={{ padding: FIT_VIEW_PADDING }}
          minZoom={0.2}
          maxZoom={2.5}
          proOptions={{ hideAttribution: true }}
        >
          <Background gap={20} color="#e8e8e8" />
          <Controls />
          <MiniMap
            nodeColor={(node) => {
              const graphNode = nodeById.get(node.id)
              if (!graphNode) return '#ccc'
              if (graphNode.type === 'folder' || graphNode.type === 'module') {
                const zone = detectZone(graphNode.path)
                return ZONE_COLORS[zone].border
              }
              return INTEGRATION_COLORS[graphNode.type].border
            }}
            pannable
            zoomable
          />
        </ReactFlow>
      </div>
    )
  }
)

// Componente exportado que envuelve el grafo en su Provider (con forwardRef)
export const ArchitectureGraph = React.forwardRef<ArchitectureGraphRef, ArchitectureGraphProps>(
  (props, ref) => {
    return (
      <ReactFlowProvider>
        <GraphContent ref={ref} {...props} />
      </ReactFlowProvider>
    )
  }
)
