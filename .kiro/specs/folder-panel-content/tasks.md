# Implementation Plan: folder-panel-content

## Overview

Implementar el contenido mejorado del ModulePanel para carpetas: reemplazar el contador genérico "X elementos directos" por un desglose de carpetas/archivos directos, agregar botones de subcarpetas ordenados alfabéticamente, y habilitar navegación click-to-center en el grafo. La implementación se organiza en funciones puras utilitarias, modificaciones al componente ModulePanel, exposición de un mecanismo imperativo en ArchitectureGraph, y wiring final en App.tsx.

## Tasks

- [x] 1. Crear funciones utilitarias puras en folder_panel_helpers.ts
  - [x] 1.1 Crear el archivo `packages/frontend/src/utils/folder_panel_helpers.ts` con la interfaz `DirectChildCounts` y las constantes `MAX_FOLDER_NAME_LENGTH`, `FIT_VIEW_DURATION`, `FIT_VIEW_PADDING`
    - Definir la interfaz `DirectChildCounts` con campos `folders: number` y `files: number`
    - Exportar las constantes según el diseño (30, 800, 0.15)
    - _Requirements: 1.1, 1.2, 2.4, 3.1, 3.2_

  - [x] 1.2 Implementar `countDirectChildren(folderId, allFolders, allModules)` que retorna el conteo de carpetas y archivos hijos directos
    - Filtrar `allFolders` por `parentFolder === folderId` para contar subcarpetas
    - Filtrar `allModules` por `parentFolder === folderId` para contar archivos
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

  - [x] 1.3 Implementar `formatChildLabel(count, type)` que retorna el string con pluralización correcta en español
    - Singular para count === 1: "carpeta directa" / "archivo directo"
    - Plural para count !== 1: "carpetas directas" / "archivos directos"
    - Retornar siempre el formato `${count} ${label}`
    - _Requirements: 1.5, 1.6_

  - [x] 1.4 Implementar `getSortedSubfolders(folderId, allFolders)` que retorna las subcarpetas directas ordenadas alfabéticamente
    - Filtrar subcarpetas con `parentFolder === folderId`
    - Ordenar con `localeCompare` usando `sensitivity: 'base'` para comparación case-insensitive
    - Garantizar estabilidad del sort para nombres case-insensitive iguales
    - _Requirements: 2.1, 2.2, 2.3, 2.5_

  - [x] 1.5 Implementar `truncateFolderName(name, maxLength = 30)` que trunca nombres largos agregando "…"
    - Si `name.length <= maxLength`, retornar sin modificar
    - Si `name.length > maxLength`, retornar `name.slice(0, maxLength) + "…"`
    - _Requirements: 2.4_

  - [ ]* 1.6 Escribir property tests para `countDirectChildren`
    - **Property 1: Child counts are accurate**
    - Generar árboles aleatorios con fast-check: 1 carpeta target + 0-20 folders/modules con parentFolder aleatorio
    - Verificar que `counts.folders` y `counts.files` coinciden con el conteo real
    - **Validates: Requirements 1.1, 1.2, 1.3, 1.4**

  - [ ]* 1.7 Escribir property tests para `formatChildLabel`
    - **Property 2: Pluralization follows Spanish grammar rules**
    - Generar enteros no-negativos 0-1000 × tipo ('folder' | 'file')
    - Verificar singular cuando count === 1, plural en otro caso
    - **Validates: Requirements 1.5, 1.6**

  - [ ]* 1.8 Escribir property tests para `getSortedSubfolders`
    - **Property 3: Subfolder buttons are in stable alphabetical order**
    - Generar arrays de 0-30 FolderNodes con nombres Unicode aleatorios (incluyendo duplicados case-insensitive)
    - Verificar que el output está sorted y preserva orden relativo de iguales
    - **Validates: Requirements 2.1, 2.2, 2.3, 2.5**

  - [ ]* 1.9 Escribir property tests para `truncateFolderName`
    - **Property 4: Folder name truncation**
    - Generar strings aleatorios de 0-200 caracteres
    - Verificar: length ≤ 30 → output === input; length > 30 → output === input.slice(0,30) + "…"
    - **Validates: Requirements 2.4**

  - [ ]* 1.10 Escribir unit tests example-based para las 4 funciones
    - Carpeta sin hijos → counts = { folders: 0, files: 0 }
    - Carpeta con 3 subcarpetas y 5 archivos → counts = { folders: 3, files: 5 }
    - `formatChildLabel(0, 'folder')` → "0 carpetas directas"
    - `formatChildLabel(1, 'file')` → "1 archivo directo"
    - Nombre de 30 chars exactos → no se trunca
    - Nombre de 31 chars → se trunca a 30 + "…"
    - Carpeta sin subcarpetas → `getSortedSubfolders` retorna []
    - Subcarpetas con nombres mixcase → orden case-insensitive correcto
    - _Requirements: 1.1–1.6, 2.1–2.5_

- [x] 2. Checkpoint - Validar funciones utilitarias
  - Ensure all tests pass, ask the user if questions arise.

- [x] 3. Modificar ModulePanel para mostrar contenido mejorado de carpetas
  - [x] 3.1 Actualizar la interfaz `ModulePanelProps` en `module_panel.tsx` para agregar las nuevas props `allFolders`, `allModules` y `onFolderNavigate`
    - `allFolders?: FolderNode[]`
    - `allModules?: ModuleNode[]`
    - `onFolderNavigate?: (folderId: string) => void`
    - _Requirements: 1.1, 1.2, 2.1, 3.3, 3.4_

  - [x] 3.2 Reemplazar la sección de contenido de carpeta en `module_panel.tsx` con el desglose de conteos y la lista de botones de subcarpetas
    - Reemplazar `{childCount} elementos directos` por las dos líneas: `formatChildLabel(counts.folders, 'folder')` y `formatChildLabel(counts.files, 'file')`
    - Agregar sección "Subcarpetas" con botones solo si `sortedSubfolders.length > 0`
    - Cada botón muestra `📁 {truncateFolderName(sub.name)}` con `title={sub.name}` y onClick que invoca `onFolderNavigate`
    - Agregar estilos CSS para la clase `module-panel__folder-buttons` y `module-panel__folder-btn`
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 2.1, 2.2, 2.3, 2.4, 2.5_

  - [ ]* 3.3 Escribir tests de componente para el ModulePanel con folder seleccionada
    - Panel con folder seleccionada muestra conteos separados (no muestra "elementos directos")
    - Click en botón de subcarpeta invoca `onFolderNavigate` con el id correcto
    - Botones no aparecen cuando no hay subcarpetas (sección "Subcarpetas" ausente)
    - Botón muestra nombre truncado para nombres largos (≤ 31 chars incluyendo "…")
    - _Requirements: 1.1–1.7, 2.1–2.5_

- [x] 4. Exponer mecanismo de centrado imperativo en ArchitectureGraph
  - [x] 4.1 Definir la interfaz `ArchitectureGraphRef` con método `fitToNode(nodeId: string)` y refactorizar `ArchitectureGraph` para usar `forwardRef` + `useImperativeHandle`
    - Dentro de `GraphContent`, obtener `fitView` de `useReactFlow()`
    - Implementar `fitToNode` usando `fitView({ nodes: [{ id: nodeId }], duration: 800, padding: 0.15 })`
    - Exportar la interfaz `ArchitectureGraphRef` para uso en App.tsx
    - _Requirements: 3.1, 3.2_

- [x] 5. Wiring completo en App.tsx
  - [x] 5.1 Crear `handleFolderNavigate` en App.tsx y conectar todas las props nuevas
    - Crear `graphRef` con `useRef<ArchitectureGraphRef>(null)` y pasarlo a `ArchitectureGraph`
    - Implementar `handleFolderNavigate(folderId)` que actualiza `selectedNode` y llama `graphRef.current?.fitToNode(folderId)`
    - Pasar `allFolders={result.folders}`, `allModules={result.modules}`, y `onFolderNavigate={handleFolderNavigate}` a `ModulePanel`
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 6. Final checkpoint - Validación completa
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties defined in the design
- Unit tests validate specific examples and edge cases
- La implementación sigue el patrón establecido en `folder_hierarchy.ts` para funciones puras utilitarias
- Se usa `fast-check` (ya en devDependencies) para property-based tests con vitest

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "1.3", "1.4", "1.5"] },
    { "id": 2, "tasks": ["1.6", "1.7", "1.8", "1.9", "1.10"] },
    { "id": 3, "tasks": ["3.1", "4.1"] },
    { "id": 4, "tasks": ["3.2"] },
    { "id": 5, "tasks": ["3.3", "5.1"] }
  ]
}
```
