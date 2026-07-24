# Implementation Plan: Traceability Visual Indicators

## Overview

Implementar indicadores visuales de trazabilidad en el grafo de arquitectura de TrazIA. Se añade una función de interpolación de color (`getTraceabilityColor`) y cálculo de score efectivo (`getEffectiveScore`) en `constants/theme.ts`, un indicador circular de 10px en los nodos del grafo, una sección de trazabilidad completa en el `ModulePanel`, y actualización reactiva del grafo tras generación de spec. Se complementa con property-based tests usando fast-check.

## Tasks

- [x] 1. Implementar funciones de color e interpolación en theme.ts
  - [x] 1.1 Implementar `getTraceabilityColor` y `getEffectiveScore` en `constants/theme.ts`
    - Añadir la constante `TRACEABILITY_ANCHORS` con los anchors RGB para rojo (#e53935), amarillo (#fdd835) y verde (#43a047)
    - Implementar `getTraceabilityColor(score: number): string` con interpolación lineal por canal RGB en dos segmentos [0,50] y [50,100], clamping de inputs no finitos/negativos/>100, y formato de salida `#rrggbb` en minúsculas
    - Implementar `getEffectiveScore(specStatus, specHealthScore): number` con las reglas de override: undefined/'untraced' → 0, 'drift' → min(score, 50), 'traced' → score directo
    - Exportar ambas funciones como named exports
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 6.1, 6.2, 6.3, 6.4, 6.5_

  - [ ]* 1.2 Write property test: Piecewise linear interpolation correctness
    - **Property 1: Piecewise linear interpolation correctness**
    - Generar scores aleatorios en [0, 100] y verificar que cada canal RGB del output coincide con la fórmula de interpolación lineal por segmento
    - **Validates: Requirements 1.1, 1.2, 1.3, 1.5, 6.4, 6.5**

  - [ ]* 1.3 Write property test: Input clamping and output format
    - **Property 2: Input clamping and output format**
    - Generar números arbitrarios (incluyendo NaN, Infinity, -Infinity, negativos, >100) y verificar que el output siempre matchea `/^#[0-9a-f]{6}$/` y es equivalente a aplicar clamping primero
    - **Validates: Requirements 6.2, 6.3**

  - [ ]* 1.4 Write property test: Effective score override rules
    - **Property 3: Effective score override rules**
    - Generar combinaciones de specStatus (incluido undefined) × specHealthScore (incluido undefined, 0–100) y verificar las reglas de override: untraced/undefined → 0, drift → min(score, 50), traced → score
    - **Validates: Requirements 1.6, 1.7, 1.8, 1.9**

- [x] 2. Checkpoint - Verificar funciones puras
  - Ensure all tests pass, ask the user if questions arise.

- [x] 3. Añadir indicador de trazabilidad al grafo
  - [x] 3.1 Modificar `buildLayoutNodes` en `components/architecture_graph.tsx` para renderizar el indicador circular
    - Importar `getTraceabilityColor` y `getEffectiveScore` de `constants/theme.ts`
    - En el bloque de creación de nodos de módulo, calcular `effectiveScore` y `traceabilityColor` usando los campos `specStatus` y `specHealthScore` del módulo
    - Añadir un `<span>` circular de 10px con `backgroundColor: traceabilityColor`, `borderRadius: '50%'`, `marginLeft: 'auto'`, `transition: 'background-color 300ms'` a la derecha del nombre de archivo
    - Solo renderizar el indicador cuando `specStatus` o `specHealthScore` estén definidos (condición de visibilidad)
    - Verificar que `Zone_Colors` (bg, border, text) del nodo NO se modifican — el indicador es aditivo
    - Solo aplicar a nodos de tipo `'module'`, no a folders ni integraciones
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 5.1, 5.2, 5.3, 5.4_

  - [ ]* 3.2 Write property test: Zone_Colors preservation with traceability indicator
    - **Property 4: Zone_Colors preservation with traceability indicator**
    - Generar módulos con distintas zonas (frontend/backend/config/shared/unknown) y scores variados, renderizar y verificar que los colores de zona (bg, border, text) permanecen intactos independientemente del specStatus/specHealthScore
    - **Validates: Requirements 2.2**

- [x] 4. Implementar sección de trazabilidad en ModulePanel
  - [x] 4.1 Extender la interfaz `ModulePanelProps` y añadir la sección de trazabilidad en `components/module_panel.tsx`
    - Añadir props: `onGenerateSpec: (moduleId: string) => Promise<void>`, `generatingSpec: string | null`, `specError: string | null`
    - Importar `getTraceabilityColor` y `getEffectiveScore` de `constants/theme.ts`
    - Implementar la sección "Trazabilidad" después de la sección "Dependencias": score como porcentaje (`Math.floor`), progress bar con ancho porcentual y color interpolado, badge de estado con texto/color según specStatus
    - Mostrar "Sin trazabilidad" con "0%" cuando specHealthScore es undefined
    - Implementar el botón "Generar Spec" / "Mejorar Spec" según la tabla de decisión del diseño (zona roja: "Generar Spec", zona amarilla: "Mejorar Spec", zona verde traced: sin botón)
    - Estado de carga: "Generando..." con aria-disabled cuando `generatingSpec === moduleId`
    - Mostrar error truncado a 200 caracteres debajo del botón; limpiar al cambiar nodo o reintentar
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_

  - [ ]* 4.2 Write property test: Button visibility follows effective zone classification
    - **Property 5: Button visibility follows effective zone classification**
    - Generar combinaciones de specStatus × specHealthScore y verificar que el botón es visible con label "Generar Spec" cuando effectiveScore ∈ [0, 33], visible con "Mejorar Spec" cuando ∈ [34, 66], y ausente cuando specStatus es 'traced' AND effectiveScore ∈ [67, 100]
    - **Validates: Requirements 3.1, 3.2, 3.3, 3.4**

  - [ ]* 4.3 Write property test: Score display and progress bar accuracy
    - **Property 6: Score display and progress bar accuracy**
    - Generar scores aleatorios en [0, 100] y verificar que el texto muestra `Math.floor(score)` como porcentaje y el ancho de la progress bar es `score%`, con el color correcto de `getTraceabilityColor(getEffectiveScore(...))`
    - **Validates: Requirements 4.1, 4.2**

- [x] 5. Conectar props en App.tsx y actualización reactiva
  - [x] 5.1 Cablear props de trazabilidad en `App.tsx` hacia `ModulePanel`
    - Pasar `onGenerateSpec={handleGenerateSpec}`, `generatingSpec={generatingSpec}`, `specError={error}` al componente `ModulePanel`
    - Añadir un efecto que sincronice `selectedNode` con los datos frescos de `result.modules` cuando el result cambia (para que el panel refleje actualizaciones post-generación)
    - Verificar que el viewport del grafo no se resetea tras la actualización de módulos (react-flow usa reconciliación por id)
    - _Requirements: 3.5, 3.7, 5.1, 5.2, 5.3, 5.4_

  - [ ]* 5.2 Write unit tests for integration flow
    - Test de integración: click nodo sin spec → click "Generar Spec" → mock de generateSpec → verificar actualización del panel (nuevo score, badge) y del grafo (nuevo color del indicador)
    - Test: error se muestra truncado y se limpia al cambiar nodo
    - Test: botón deshabilitado con "Generando..." durante la generación
    - _Requirements: 3.5, 3.6, 3.7, 3.8, 3.9, 5.1_

- [x] 6. Instalar fast-check y configurar test suite
  - [x] 6.1 Instalar `fast-check` como devDependency y crear archivo de test `packages/frontend/src/constants/theme.test.ts`
    - Ejecutar `npm install -D fast-check` en `packages/frontend`
    - Crear `theme.test.ts` con los property tests de Properties 1, 2 y 3 (mínimo 100 iteraciones cada uno)
    - Crear `packages/frontend/src/components/architecture_graph.test.tsx` con el property test de Property 4
    - Crear `packages/frontend/src/components/module_panel.test.tsx` con los property tests de Properties 5 y 6
    - Incluir también unit tests example-based: anchors exactos (score 0, 50, 100), indicador solo en módulos, badge correcto por specStatus, transición CSS 300ms
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 1.1, 1.2, 1.3, 2.1, 2.5, 4.4, 4.5_

- [x] 7. Final checkpoint - Verificar implementación completa
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- El proyecto usa TypeScript, Vitest y fast-check para property-based testing
- Los `Zone_Colors` existentes NO se modifican — el indicador de trazabilidad es aditivo
- La función `getTraceabilityColor` es pura y reutilizable entre grafo y panel

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "1.3", "1.4", "3.1"] },
    { "id": 2, "tasks": ["3.2", "4.1"] },
    { "id": 3, "tasks": ["4.2", "4.3", "5.1"] },
    { "id": 4, "tasks": ["5.2", "6.1"] }
  ]
}
```
