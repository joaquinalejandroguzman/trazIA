import React, { useMemo } from 'react'
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  type Node,
  type Edge,
  type NodeMouseHandler,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import type { ModuleNode, SpecStatus } from '../types'

interface ArchitectureGraphProps {
  modules: ModuleNode[]
  onNodeClick: (module: ModuleNode) => void
  selectedModuleId?: string | null
}

// Mapea el estado de trazabilidad al color del nodo
const STATUS_COLORS: Record<SpecStatus, { bg: string; border: string; text: string }> = {
  traced: { bg: '#d4edda', border: '#2ecc71', text: '#155724' },
  drift: { bg: '#fff3cd', border: '#f39c12', text: '#856404' },
  untraced: { bg: '#f8d7da', border: '#e74c3c', text: '#721c24' },
}

// Convierte los ModuleNode del dominio a nodos de ReactFlow
function buildNodes(modules: ModuleNode[], selectedId?: string | null): Node[] {
  const COLUMNS = 4
  const H_GAP = 220
  const V_GAP = 100
  const NODE_W = 180
  const NODE_H = 60

  return modules.map((mod, index) => {
    const col = index % COLUMNS
    const row = Math.floor(index / COLUMNS)
    const colors = STATUS_COLORS[mod.specStatus]
    const isSelected = mod.id === selectedId

    return {
      id: mod.id,
      position: { x: col * H_GAP, y: row * V_GAP },
      data: {
        label: (
          <div style={{ textAlign: 'center', lineHeight: 1.3 }}>
            <div style={{ fontWeight: 600, fontSize: '0.75rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: NODE_W - 20 }}>
              {mod.name}
            </div>
            <div style={{ fontSize: '0.65rem', opacity: 0.75, marginTop: 2 }}>
              {mod.specHealthScore}%
            </div>
          </div>
        ),
      },
      style: {
        background: colors.bg,
        border: `2px solid ${isSelected ? '#333' : colors.border}`,
        borderRadius: 8,
        width: NODE_W,
        height: NODE_H,
        color: colors.text,
        boxShadow: isSelected ? '0 0 0 3px rgba(0,0,0,0.25)' : undefined,
        cursor: 'pointer',
      },
    }
  })
}

// Convierte las dependencias de los módulos en aristas de ReactFlow
function buildEdges(modules: ModuleNode[]): Edge[] {
  const edges: Edge[] = []
  const ids = new Set(modules.map((m) => m.id))

  for (const mod of modules) {
    for (const dep of mod.dependencies) {
      if (ids.has(dep)) {
        edges.push({
          id: `${mod.id}→${dep}`,
          source: mod.id,
          target: dep,
          type: 'smoothstep',
          style: { stroke: '#aaa', strokeWidth: 1 },
          animated: false,
        })
      }
    }
  }

  return edges
}

// Contenido interno del grafo (debe estar dentro del ReactFlowProvider)
const GraphContent: React.FC<ArchitectureGraphProps> = ({
  modules,
  onNodeClick,
  selectedModuleId,
}) => {
  const nodes = useMemo(() => buildNodes(modules, selectedModuleId), [modules, selectedModuleId])
  const edges = useMemo(() => buildEdges(modules), [modules])

  // Mapeo inverso para recuperar el ModuleNode cuando se hace click
  const moduleById = useMemo(
    () => new Map(modules.map((m) => [m.id, m])),
    [modules]
  )

  const handleNodeClick: NodeMouseHandler = (_event, node) => {
    const mod = moduleById.get(node.id)
    if (mod) onNodeClick(mod)
  }

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodeClick={handleNodeClick}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.3}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={16} color="#e0e0e0" />
        <Controls />
        <MiniMap
          nodeColor={(node) => {
            // Recupera el módulo por id para obtener el color real
            const mod = moduleById.get(node.id)
            if (!mod) return '#ccc'
            return STATUS_COLORS[mod.specStatus].border
          }}
          pannable
          zoomable
        />
      </ReactFlow>
    </div>
  )
}

// Componente exportado que envuelve el grafo en su Provider
export const ArchitectureGraph: React.FC<ArchitectureGraphProps> = (props) => {
  return (
    <ReactFlowProvider>
      <GraphContent {...props} />
    </ReactFlowProvider>
  )
}
