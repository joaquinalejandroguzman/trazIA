# Implementation Plan: Traceability NA Panel Fix

## Overview

Corregir el componente `ModulePanel` para que cuando un nodo módulo tenga `specStatus === 'na'`, no renderice la barra de salud de trazabilidad ni la sección "Spec EARS". En su lugar debe mostrar únicamente un texto informativo "No aplica trazabilidad" con el badge "N/A". El fix se implementa con un early return en la sección de trazabilidad y una guarda condicional en la sección Spec EARS.

## Tasks

- [x] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - Panel NA renderiza barra de progreso y sección Spec EARS incorrectamente
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate the bug exists
  - **Scoped PBT Approach**: Scope the property to modules with `specStatus === 'na'` combined with arbitrary values for `specHealthScore`, `earsSpec`, and `sourceContent`
  - Bug Condition: `isBugCondition(input) := input.node.type === 'module' AND input.node.specStatus === 'na'`
  - Expected Behavior: For all inputs satisfying C(X), the rendered ModulePanel SHALL contain "No aplica trazabilidad" text and "N/A" badge, SHALL NOT contain a progress bar element, SHALL NOT contain the "Spec EARS" section title
  - Use `fast-check` to generate arbitrary `specHealthScore` (number 0-100), `earsSpec` (string | undefined), `sourceContent` (string | undefined) while keeping `specStatus: 'na'` fixed
  - Assert: `queryByText("No aplica trazabilidad")` is present
  - Assert: progress bar element (height 8px, borderRadius 4px) is NOT present
  - Assert: `queryByText("Spec EARS")` is NOT present
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS (this is correct - it proves the bug exists because the progress bar and Spec EARS section ARE rendered for NA modules)
  - Document counterexamples found (e.g., "ModulePanel with specStatus 'na' and specHealthScore 0 renders progress bar and Spec EARS section")
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 2.3_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Comportamiento intacto para módulos con specStatus !== 'na'
  - **IMPORTANT**: Follow observation-first methodology
  - Observe on UNFIXED code: ModulePanel with `specStatus: 'traced'` and score 85 → renders progress bar, "85%", badge "Trazado", sección Spec EARS con contenido
  - Observe on UNFIXED code: ModulePanel with `specStatus: 'untraced'` → renders progress bar at 0%, badge "Sin spec", sección Spec EARS con botón "Generar Spec"
  - Observe on UNFIXED code: ModulePanel with `specStatus: 'drift'` → renders progress bar, badge "Drift", sección Spec EARS con botón "Mejorar Spec"
  - Use `fast-check` to generate arbitrary combinations of `specStatus ∈ {traced, untraced, drift}` × `specHealthScore` (0-100) × `earsSpec` (string | undefined)
  - Write property-based test: for all modules with `specStatus !== 'na'`, the rendered output SHALL contain a progress bar element and the "Spec EARS" section title
  - Write property-based test: for all modules with `specStatus === 'traced'`, the score text matches the specHealthScore value
  - Write property-based test: badges are correct per specStatus (Trazado/Sin spec/Drift)
  - Verify tests PASS on UNFIXED code (confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 3. Fix para ModulePanel — no renderizar trazabilidad ni Spec EARS cuando specStatus === 'na'

  - [x] 3.1 Implementar early return en sección de trazabilidad para specStatus === 'na'
    - En el IIFE de la sección de trazabilidad dentro de `module_panel.tsx`, agregar un return temprano después de calcular `specStatus`
    - El early return renderiza: título "Trazabilidad", contenedor flex con texto "No aplica trazabilidad" y badge "N/A" (fondo `#adb5bd`, color blanco, borderRadius, fontSize consistentes con badges existentes)
    - No renderizar barra de progreso, score numérico ni botón de acción
    - _Bug_Condition: isBugCondition(input) where input.node.type === 'module' AND input.node.specStatus === 'na'_
    - _Expected_Behavior: Panel muestra solo "No aplica trazabilidad" con badge "N/A", sin barra ni score_
    - _Preservation: Módulos con specStatus !== 'na' no se ven afectados por el early return_
    - _Requirements: 2.1, 2.3_

  - [x] 3.2 Agregar guarda condicional en sección Spec EARS para specStatus === 'na'
    - Envolver el IIFE de la sección "Spec EARS" en una condición `specStatus !== 'na'`
    - Cuando `specStatus === 'na'`, el bloque completo de Spec EARS (título, contenido, botones de acción) no se renderiza
    - No modificar la lógica interna del IIFE de Spec EARS — solo agregar la guarda externa
    - _Bug_Condition: isBugCondition(input) where input.node.specStatus === 'na'_
    - _Expected_Behavior: Sección Spec EARS no se renderiza en absoluto para módulos NA_
    - _Preservation: Módulos con specStatus !== 'na' siguen renderizando Spec EARS normalmente_
    - _Requirements: 2.2_

  - [x] 3.3 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Panel NA muestra solo texto informativo
    - **IMPORTANT**: Re-run the SAME test from task 1 - do NOT write a new test
    - The test from task 1 encodes the expected behavior (text "No aplica trazabilidad", badge "N/A", no progress bar, no "Spec EARS")
    - When this test passes, it confirms the expected behavior is satisfied
    - Run bug condition exploration test from step 1
    - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed)
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 3.4 Verify preservation tests still pass
    - **Property 2: Preservation** - Comportamiento intacto para otros specStatus
    - **IMPORTANT**: Re-run the SAME tests from task 2 - do NOT write new tests
    - Run preservation property tests from step 2
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - Confirm all tests still pass after fix (no regressions introduced)
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 4. Checkpoint - Ensure all tests pass
  - Run full test suite (`vitest run` en packages/frontend)
  - Verify exploration test (Property 1) passes
  - Verify preservation tests (Property 2) pass
  - Verify existing tests in `module_panel.test.tsx` still pass
  - Ensure no regressions, ask the user if questions arise

## Notes

- El test runner es `vitest run` (ya configurado en el proyecto)
- `fast-check` ya está disponible como dependencia de desarrollo
- Los tests se ubican en `packages/frontend/src/components/module_panel.test.tsx` (ya existe)
- El archivo a modificar es `packages/frontend/src/components/module_panel.tsx`
- No se requieren cambios en tipos, props, ni en `getEffectiveScore` — solo rendering condicional en JSX
- El fix es puramente visual/rendering — no afecta lógica de negocio ni estado

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1", "2"] },
    { "id": 1, "tasks": ["3.1", "3.2"] },
    { "id": 2, "tasks": ["3.3", "3.4"] },
    { "id": 3, "tasks": ["4"] }
  ]
}
```
