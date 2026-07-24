# Implementation Plan: Folder Node Hierarchy Titles

## Overview

Implementar títulos con jerarquía tipográfica en los nodos de carpeta del grafo de arquitectura. Se extraen funciones puras de cálculo de profundidad y mapeo de fontSize a un módulo utilitario, se modifican los nodos de carpeta en `architecture_graph.tsx` para consumir estos valores, y se valida con property-based tests y unit tests.

## Tasks

- [x] 1. Crear módulo utilitario de jerarquía de carpetas
  - [x] 1.1 Crear `packages/frontend/src/utils/folder_hierarchy.ts` con las funciones `computeFolderDepth` y `getHierarchyFontSize`
    - Definir la constante `HIERARCHY_FONT_SIZES` con la escala tipográfica `['1.5rem', '1.25rem', '1.0rem', '0.875rem', '0.8rem', '0.75rem']`
    - Implementar `computeFolderDepth(folderId, foldersMap)` que recorre la cadena `parentFolder` con un `Set<string>` de visitados para detectar ciclos
    - Devolver depth 1 para carpetas raíz, orphans (parentFolder inexistente), y ciclos detectados
    - Implementar `getHierarchyFontSize(depth)` que indexa `HIERARCHY_FONT_SIZES` con clampeo a depth 6
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9_

  - [ ]* 1.2 Escribir property tests para `computeFolderDepth`
    - **Property 1: Depth calculation invariant**
    - Generar árboles aleatorios de FolderNodes (1-20 nodos, profundidad 1-10, incluir orphans y ciclos) con fast-check
    - Verificar que `depth(node) === ancestors(node).length + 1` para árboles válidos y `depth === 1` para orphans/ciclos
    - Mínimo 100 iteraciones (`{ numRuns: 100 }`)
    - **Validates: Requirements 1.1, 1.2, 2.9**

  - [ ]* 1.3 Escribir property tests para `getHierarchyFontSize`
    - **Property 2: Depth-to-fontSize mapping is correct and capped**
    - Generar enteros aleatorios 1-100 con fast-check
    - Verificar que `getHierarchyFontSize(d) === HIERARCHY_FONT_SIZES[Math.min(d, 6) - 1]`
    - Mínimo 100 iteraciones (`{ numRuns: 100 }`)
    - **Validates: Requirements 1.3, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8**

  - [ ]* 1.4 Escribir unit tests (example-based) para `computeFolderDepth` y `getHierarchyFontSize`
    - Test carpeta raíz sin parent → depth 1, fontSize 1.5rem
    - Test cadena de 3 niveles → depths [1, 2, 3]
    - Test cadena de 8 niveles → depths 7 y 8 mapean a 0.75rem
    - Test parent inexistente (orphan) → depth 1
    - Test referencia circular A→B→A → ambas depth 1
    - Test auto-referencia A→A → depth 1
    - _Requirements: 1.1, 1.2, 1.4, 1.5_

- [x] 2. Checkpoint - Verificar funciones utilitarias
  - Ensure all tests pass, ask the user if questions arise.

- [x] 3. Modificar el renderizado de nodos de carpeta en el grafo
  - [x] 3.1 Actualizar `buildLayoutNodes` en `packages/frontend/src/components/architecture_graph.tsx` para usar títulos jerárquicos
    - Importar `computeFolderDepth` y `getHierarchyFontSize` desde `../utils/folder_hierarchy`
    - Construir un `Map<string, FolderNode>` a partir del array `folders` al inicio de la función
    - Calcular `depth` y `hierarchyFontSize` para cada carpeta antes de crear su nodo
    - Reemplazar el `data.label` actual de los nodos de carpeta con el nuevo JSX centrado:
      - Container con `position: absolute`, `top: 0`, `left: 0`, `right: 0`, `height: FOLDER_PADDING_Y`, `display: flex`, `alignItems: center`, `justifyContent: center`, `gap: 4`, `overflow: hidden`
      - Ícono 📁 con `fontSize: hierarchyFontSize`, `lineHeight: 1`
      - Span del nombre con `fontWeight: 700`, `fontSize: hierarchyFontSize`, `color: colors.text`, `opacity: 0.9`, `whiteSpace: nowrap`, `overflow: hidden`, `textOverflow: ellipsis`, `maxWidth: calc(100% - 2rem)`
    - _Requirements: 2.1, 3.1, 3.2, 3.3, 3.4, 3.5, 4.1, 4.2, 4.3_

  - [ ]* 3.2 Escribir property test para consistencia de color de zona
    - **Property 4: Zone color consistency**
    - Generar paths aleatorios (combinaciones de segmentos típicos) con fast-check
    - Verificar que el color aplicado al título === `ZONE_COLORS[detectZone(path)].text`
    - Mínimo 100 iteraciones (`{ numRuns: 100 }`)
    - **Validates: Requirements 4.1**

  - [ ]* 3.3 Escribir integration tests para el renderizado del título en `architecture_graph.test.tsx`
    - Verificar que el nodo de carpeta renderiza el título centrado (`justifyContent: center`)
    - Verificar que el ícono 📁 está presente con gap 4px
    - Verificar `fontWeight: 700` y `opacity: 0.9` en los estilos inline
    - Verificar que texto largo se trunca con `textOverflow: 'ellipsis'`
    - _Requirements: 3.1, 3.2, 3.4, 3.5, 4.2, 4.3_

- [x] 4. Final checkpoint - Verificar integración completa
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- El proyecto ya tiene `fast-check` y `vitest` como devDependencies, no se requiere instalación adicional
- Los property tests y unit tests van en el mismo archivo: `packages/frontend/src/utils/folder_hierarchy.test.ts`
- Los integration tests van en: `packages/frontend/src/components/architecture_graph.test.tsx`

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "1.3", "1.4"] },
    { "id": 2, "tasks": ["3.1"] },
    { "id": 3, "tasks": ["3.2", "3.3"] }
  ]
}
```
