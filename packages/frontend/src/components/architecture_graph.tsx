import React from 'react'
import { ReactFlow, ReactFlowProvider } from '@xyflow/react'
import '@xyflow/react/dist/style.css'

// Props reservadas para extensión futura (nodos, aristas, etc.)
interface ArchitectureGraphProps {
  // reservado para props futuras (nodes, edges, etc.)
}

// Contenido interno del grafo separado para que ReactFlowProvider lo envuelva correctamente
const GraphContent: React.FC = () => {
  return (
    // Contenedor con dimensiones explícitas para evitar errores de ReactFlow
    <div style={{ width: '100%', height: '100vh' }}>
      <h2>Aqui va el grafico</h2>
      <ReactFlow nodes={[]} edges={[]} />
    </div>
  )
}

// Componente principal que renderiza el grafo de arquitectura interactivo
export const ArchitectureGraph: React.FC<ArchitectureGraphProps> = () => {
  return (
    <ReactFlowProvider>
      <GraphContent />
    </ReactFlowProvider>
  )
}
