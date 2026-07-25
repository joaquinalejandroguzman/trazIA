# Implementation Plan: Compact Folder Layout

## Overview

Reemplazar el algoritmo de layout fijo (2 columnas) en `architecture_graph.tsx` por un motor de layout adaptativo extraído a un módulo independiente (`graph_layout_engine.ts`). El nuevo motor calcula columnas dinámicamente, distribuye subcarpetas con wrapping, computa tamaños bottom-up y posiciona carpetas raíz en grilla. La lógica de rendering permanece en el componente React.

## Tasks

- [x] 1. Crear módulo de layout engine con constantes e interfaces
  - [x] 1.1 Crear `packages/frontend/src/utils/graph_layout_engine.ts` con constantes exportadas y tipos
    - Definir constantes: `FILE_NODE_WIDTH`, `FILE_NODE_HEIGHT`, `FOLDER_PADDING_X`, `FOLDER_PADDING_Y`, `FOLDER_GAP`, `INTEGRATION_NODE_WIDTH`, `INTEGRATION_NODE_HEIGHT`, `ROOT_GAP`, `MIN_FOLDER_WIDTH`, `MIN_FOLDER_HEIGHT`, `MIN_ROOT_COLS`, `MAX_ROOT_COLS`
    - Definir interfaces: `Size`, `Position`, `FolderLayout`, `SubfolderRow`, `LayoutResult`
    - Exportar stubs vacíos de las funciones principales para compilación incremental
    - _Requirements: 1.5, 1.6, 3.2, 3.3, 4.4_

- [x] 2. Implementar funciones de grilla de archivos
  - [x] 2.1 Implementar `getAdaptiveColumns(fileCount)`
    - Retornar columnas según rangos: 0→0, [1,3]→N, [4,8]→2, [9,15]→3, >15→4
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.7_

  - [ ]* 2.2 Write property test for adaptive columns
    - **Property 1: Adaptive columns formula**
    - **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.7**

  - [x] 2.3 Implementar `computeFileGridWidth(cols)` y `computeFileGridHeight(fileCount, cols)`
    - Width = cols × (FILE_NODE_WIDTH + FOLDER_GAP), retorna 0 si cols === 0
    - Height = ceil(fileCount / cols) × (FILE_NODE_HEIGHT + FOLDER_GAP), retorna 0 si fileCount === 0 o cols === 0
    - _Requirements: 1.5, 1.6_

  - [ ]* 2.4 Write property test for file grid dimensions
    - **Property 2: File grid width formula**
    - **Property 3: File node position formula**
    - **Validates: Requirements 1.5, 1.6**

- [x] 3. Implementar algoritmo de wrapping de subcarpetas
  - [x] 3.1 Implementar `wrapSubfolders(subfolderSizes, contentWidth)`
    - Distribuir subcarpetas en filas usando wrapping greedy
    - Si un item excede contentWidth, colocarlo solo y expandir finalContentWidth
    - Mantener orden original de subcarpetas
    - _Requirements: 2.2, 2.4, 2.5_

  - [ ]* 3.2 Write property test for subfolder wrapping
    - **Property 4: Subfolder wrapping validity**
    - **Validates: Requirements 2.2, 2.4, 2.5**

  - [x] 3.3 Implementar `positionSubfoldersInParent(parentId, fileGridHeight, contentWidth, subfoldersByParent, folderSizes)`
    - Calcular posiciones relativas al padre usando resultado de wrapping
    - Primera fila de subcarpetas a Y = FOLDER_PADDING_Y + fileGridHeight + FOLDER_GAP
    - Filas subsiguientes: Y anterior + altura fila anterior + FOLDER_GAP
    - _Requirements: 2.1, 2.3_

  - [ ]* 3.4 Write property test for subfolder row Y positioning
    - **Property 5: Subfolder row Y positioning**
    - **Validates: Requirements 2.1, 2.3**

- [x] 4. Implementar cálculo bottom-up de tamaños de carpetas
  - [x] 4.1 Implementar `calcFolderSize(folderId, modulesByFolder, subfoldersByParent, memo)`
    - Recursión bottom-up con memoización en Map
    - Width = max(fileGridWidth, widestSubfolderRow, MIN_FOLDER_WIDTH) + FOLDER_PADDING_X × 2
    - Height = fileGridHeight + totalSubfolderRowsHeight + FOLDER_PADDING_Y + FOLDER_PADDING_X
    - Carpeta vacía → size mínimo (120×60)
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

  - [ ]* 4.2 Write property test for folder size formula
    - **Property 6: Folder size formula**
    - **Validates: Requirements 3.2, 3.3, 3.4, 3.5**

- [x] 5. Checkpoint - Verificar funciones individuales
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Implementar layout de carpetas raíz en grilla
  - [x] 6.1 Implementar `computeRootGrid(rootFolderIds, folderSizes)`
    - Columnas = clamp(ceil(sqrt(count)), MIN_ROOT_COLS, MAX_ROOT_COLS)
    - Posicionar en row-major: fila = floor(i / cols), columna = i % cols
    - Y de cada fila = suma de alturas anteriores + ROOT_GAP por transición
    - X de cada columna = suma de anchos de columnas anteriores + ROOT_GAP por columna
    - Retornar posiciones, totalWidth y totalHeight
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

  - [ ]* 6.2 Write property test for root grid layout
    - **Property 7: Root grid layout**
    - **Validates: Requirements 4.1, 4.2, 4.3, 4.4**

- [x] 7. Implementar función orquestadora y posicionamiento de integraciones
  - [x] 7.1 Implementar `computeLayout(modules, folders, integrations)`
    - Construir índices: modulesByFolder, subfoldersByParent, rootFolders
    - Calcular tamaños bottom-up para todas las carpetas
    - Posicionar raíces con computeRootGrid
    - Posicionar subcarpetas recursivamente con positionSubfoldersInParent
    - Posicionar integraciones a X = rootGridTotalWidth + ROOT_GAP
    - Retornar LayoutResult completo
    - _Requirements: 4.5, 5.5_

  - [ ]* 7.2 Write property test for integration node separation
    - **Property 8: Integration node separation**
    - **Validates: Requirements 4.5, 5.5**

- [x] 8. Refactorizar `architecture_graph.tsx` para usar el layout engine
  - [x] 8.1 Refactorizar `buildLayoutNodes` para consumir `computeLayout`
    - Eliminar funciones internas `calcFolderSize` y `positionSubfolders`
    - Importar `computeLayout` y constantes desde `graph_layout_engine.ts`
    - Reducir `buildLayoutNodes` a: llamar computeLayout → iterar resultados → crear Node[] con estilos/JSX
    - Mantener toda la lógica de rendering (colores, íconos, labels JSX) en el componente
    - Asegurar que `parentId` se asigna correctamente a hijos
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.6_

  - [ ]* 8.2 Write property test for parent-child node assignment
    - **Property 9: Parent-child node assignment**
    - **Validates: Requirements 5.4**

  - [ ]* 8.3 Write unit tests for refactored component
    - Verificar rendering completo con datos mock
    - Verificar que nodos hijos tienen parentId correcto
    - Verificar que integraciones no se solapan con carpetas
    - _Requirements: 5.1, 5.2, 5.4, 5.5, 5.6_

- [x] 9. Final checkpoint - Verificación completa
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- El test runner es `vitest run` (ya configurado en el proyecto)
- `fast-check` ya está disponible como dependencia de desarrollo
- La lógica de rendering (colores, JSX, estilos) permanece en `architecture_graph.tsx`
- El layout engine es puro (sin dependencias de React) para facilitar testing

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["2.1", "2.3"] },
    { "id": 2, "tasks": ["2.2", "2.4", "3.1"] },
    { "id": 3, "tasks": ["3.2", "3.3"] },
    { "id": 4, "tasks": ["3.4", "4.1"] },
    { "id": 5, "tasks": ["4.2", "6.1"] },
    { "id": 6, "tasks": ["6.2", "7.1"] },
    { "id": 7, "tasks": ["7.2", "8.1"] },
    { "id": 8, "tasks": ["8.2", "8.3"] }
  ]
}
```
