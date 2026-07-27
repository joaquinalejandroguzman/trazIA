# Implementation Plan: Interactive Summary Panel

## Overview

Transformar el componente `ProjectSummary` de un panel estático a un centro de control interactivo con tres funcionalidades: lista expandible de integraciones con navegación al grafo, buscador de nodos con dimming, e indicador donut de trazabilidad con filtrado. La arquitectura eleva estado de filtrado a App.tsx, introduce el hook `useNodeFilter`, extrae funciones puras a un módulo de utilidades, y añade tres sub-componentes internos al panel.

## Tasks

- [x] 1. Crear tipos, utilidades puras y hook de filtrado
  - [x] 1.1 Crear tipos y funciones puras en `utils/summary_panel_helpers.ts`
    - Crear archivo `packages/frontend/src/utils/summary_panel_helpers.ts`
    - Definir tipos `DonutSegment` y `ActiveFilterType`
    - Implementar funciones puras: `filterNodesByName`, `sortAndCap`, `computeDonutSegments`, `computeDimmedIds`, `computeTraceabilityDimmedIds`, `getNodeTypeIcon`, `groupIntegrationsByType`
    - Todas las funciones deben ser exportadas y sin side-effects
    - _Requirements: 1.3, 1.5, 2.2, 2.3, 2.4, 2.8, 2.9, 3.1, 3.3, 3.4, 3.7, 3.9_

  - [ ]* 1.2 Write property tests for `filterNodesByName` and `sortAndCap`
    - **Property 5: Node filter function correctness**
    - **Property 6: Filter results sorted alphabetically and capped at 50**
    - **Validates: Requirements 2.2, 2.3, 2.8**
    - Crear archivo `packages/frontend/src/utils/summary_panel_helpers.test.ts`
    - Usar fast-check con mínimo 100 iteraciones por propiedad

  - [ ]* 1.3 Write property tests for `computeDonutSegments`
    - **Property 8: Donut segment computation**
    - **Validates: Requirements 3.1, 3.3, 3.7, 3.9**
    - Verificar suma de porcentajes ≈ 100, segmentos con count 0 omitidos, cálculo correcto de `na`

  - [ ]* 1.4 Write property tests for `computeDimmedIds` and `computeTraceabilityDimmedIds`
    - **Property 7: Search dimming is the complement of matching nodes**
    - **Property 9: Traceability dimming by specStatus**
    - **Validates: Requirements 2.4, 3.4**

  - [ ]* 1.5 Write property tests for `groupIntegrationsByType` and `getNodeTypeIcon`
    - **Property 4: Integration list ordering (databases before APIs)**
    - **Property 2: Node type icon mapping**
    - **Validates: Requirements 1.3, 1.5, 2.9**

  - [x] 1.6 Crear hook `useNodeFilter` en `hooks/use_node_filter.ts`
    - Implementar lógica de "last filter wins"
    - Exponer: `dimmedNodeIds`, `activeFilterType`, `applySearchFilter`, `applyTraceabilityFilter`, `clearAll`
    - El hook recibe `allNodeIds: Set<string>` y calcula complementos internamente
    - _Requirements: 4.6_

  - [ ]* 1.7 Write property test for `useNodeFilter` last-filter-wins behavior
    - **Property 11: Last filter wins**
    - **Validates: Requirements 4.6**
    - Testar con `renderHook` de React Testing Library + fast-check

- [x] 2. Checkpoint - Verificar utilidades
  - Ensure all tests pass, ask the user if questions arise.

- [x] 3. Implementar sub-componente `IntegrationList`
  - [x] 3.1 Crear componente `IntegrationList` en `components/integration_list.tsx`
    - Componente colapsable con estado interno `expanded`
    - Click en la tarjeta de integraciones expande/colapsa la lista
    - Mostrar integraciones agrupadas por tipo (databases primero, luego APIs externas) usando `groupIntegrationsByType`
    - Iconos: 🗄️ para `database`, 🌐 para `external_api`
    - Click en nombre de integración invoca `onNavigate(nodeId)`
    - Máximo 20 ítems visibles con scroll vertical si excede
    - No renderizar si `integrations` está vacío
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7_

  - [ ]* 3.2 Write unit tests for `IntegrationList`
    - Test expand/collapse toggle
    - Test agrupación por tipo
    - Test click invoca `onNavigate` con el ID correcto
    - Test no renderiza si lista vacía
    - Test scroll con más de 20 integraciones
    - **Property 1: Integration list expand/collapse round-trip**
    - **Property 3: Click-to-navigate invokes fitToNode with correct ID**
    - **Validates: Requirements 1.1, 1.2, 1.4, 1.6**

- [x] 4. Implementar sub-componente `NodeSearch`
  - [x] 4.1 Crear componente `NodeSearch` en `components/node_search.tsx`
    - Campo de texto con placeholder "Buscar nodos..."
    - Filtrar cuando query tiene ≥ 2 caracteres usando `filterNodesByName` + `sortAndCap(_, 50)`
    - Emitir `onFilterChange(matchingIds)` cuando hay resultados, o `null` si query < 2 chars
    - Mostrar lista de resultados con iconos según tipo de nodo (usar `getNodeTypeIcon`)
    - Click en resultado invoca `onSelect(nodeId)` y limpia el campo
    - Mostrar mensaje "No se encontraron nodos" si búsqueda sin resultados y query ≥ 2
    - Ocultar resultados si query < 2 caracteres
    - Escuchar `clearSignal` para resetear campo desde fuera
    - _Requirements: 2.1, 2.2, 2.3, 2.5, 2.6, 2.7, 2.8, 2.9, 2.10, 2.11_

  - [ ]* 4.2 Write unit tests for `NodeSearch`
    - Test placeholder renderizado
    - Test no filtra con 1 carácter
    - Test filtra correctamente con ≥ 2 caracteres
    - Test click en resultado limpia búsqueda
    - Test clearSignal resetea el estado
    - Test mensaje de "no resultados"
    - _Requirements: 2.1, 2.6, 2.10, 2.11_

- [x] 5. Implementar sub-componente `DonutIndicator`
  - [x] 5.1 Crear componente `DonutIndicator` en `components/donut_indicator.tsx`
    - Renderizar donut SVG con `stroke-dasharray` para los segmentos
    - Colores del tema: verde (traced), rojo (untraced), amarillo (drift), gris (na)
    - Mostrar porcentaje de `traced` en el centro del donut
    - Click en segmento emite `onSegmentClick(status)`, segundo click en mismo segmento emite `null`
    - Segmento activo se separa visualmente del centro (offset radial)
    - No renderizar si `totalModules === 0`
    - Omitir segmentos con count 0
    - Usar `computeDonutSegments` para calcular segmentos
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9_

  - [ ]* 5.2 Write unit tests for `DonutIndicator`
    - Test renderiza segmentos correctos
    - Test centro muestra porcentaje traced
    - Test no renderiza si totalModules = 0
    - Test click toggle en segmento
    - Test segmento con count 0 no se renderiza
    - _Requirements: 3.1, 3.2, 3.3, 3.8, 3.9_

- [x] 6. Checkpoint - Verificar sub-componentes
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Integrar en `ProjectSummary` y extender `App.tsx`
  - [x] 7.1 Refactorizar `ProjectSummary` para aceptar nuevas props y renderizar sub-componentes
    - Extender `ProjectSummaryProps` con `onFitToNode`, `onDimNodes`, `onClearDimming`, `clearFiltersSignal`
    - Importar y renderizar `IntegrationList`, `NodeSearch`, `DonutIndicator`
    - Preparar la lista de todos los nodos (modules + folders + integrations) para `NodeSearch`
    - Conectar callbacks internos: búsqueda → `onDimNodes`/`onClearDimming`, donut → `onDimNodes`/`onClearDimming`, integración → `onFitToNode`
    - Pasar `clearFiltersSignal` a `NodeSearch` y resetear `DonutIndicator` cuando cambia
    - _Requirements: 1.1, 1.2, 1.4, 2.1, 2.5, 3.4, 3.5, 4.4_

  - [x] 7.2 Integrar `useNodeFilter` en `App.tsx` y pasar `dimmedNodeIds` al grafo
    - Instanciar `useNodeFilter` en App.tsx con los IDs de todos los nodos
    - Pasar `dimmedNodeIds` como nueva prop a `ArchitectureGraph`
    - Conectar callbacks de `ProjectSummary`: `onFitToNode` → `graphRef.current?.fitToNode`, `onDimNodes` → `applySearchFilter`/`applyTraceabilityFilter`, `onClearDimming` → `clearAll`
    - En `handleNodeClick` existente: invocar `clearAll()` del hook e incrementar `clearFiltersSignal`
    - _Requirements: 4.1, 4.3, 4.4, 4.5, 4.6_

  - [x] 7.3 Extender `ArchitectureGraph` para aplicar dimming basado en `dimmedNodeIds`
    - Añadir prop `dimmedNodeIds?: Set<string> | null` a `ArchitectureGraphProps`
    - En `buildLayoutNodes`: aplicar `opacity: 0.25` + transición 200ms a nodos en `dimmedNodeIds`
    - Mantener funcionalidad de click en todos los nodos independientemente de opacidad
    - Si `dimmedNodeIds` es null, todos los nodos a opacidad 1.0
    - Animación `fitToNode` usa `FIT_VIEW_DURATION` (800ms) ya existente
    - Guard: ignorar `fitToNode` si bounds.width === 0 (nodo inexistente)
    - _Requirements: 4.1, 4.2, 4.5_

- [x] 8. Checkpoint - Verificar integración completa
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 9. Tests de integración
  - [ ]* 9.1 Write integration tests for the full flow
    - Test: búsqueda aplica dimming al grafo y click en resultado navega
    - Test: click en segmento de donut aplica dimming por trazabilidad
    - Test: click directo en nodo del grafo limpia filtros
    - Test: "last filter wins" cuando se combinan búsqueda y trazabilidad
    - **Property 10: Graph click clears all active filters**
    - **Validates: Requirements 4.3, 4.6**

- [x] 10. Final checkpoint - Verificar todo
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- El proyecto usa Vitest + fast-check (ya disponibles como dependencias de desarrollo)
- Archivos siguen convención snake_case del proyecto
- Los comentarios en código deben ser en español

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "1.3", "1.4", "1.5", "1.6"] },
    { "id": 2, "tasks": ["1.7", "3.1", "4.1", "5.1"] },
    { "id": 3, "tasks": ["3.2", "4.2", "5.2"] },
    { "id": 4, "tasks": ["7.1", "7.3"] },
    { "id": 5, "tasks": ["7.2"] },
    { "id": 6, "tasks": ["9.1"] }
  ]
}
```
