# Implementation Plan: EARS On-Demand

## Overview

Transformar la generación de specs EARS de un proceso batch (dentro del pipeline de análisis) a un proceso on-demand (endpoint dedicado invocado por el frontend al seleccionar un módulo). El resultado: un `/api/analyze` rápido y generación individual bajo demanda con cache local.

## Tasks

- [x] 1. Actualizar tipos compartidos y contrato JSON
  - [x] 1.1 Actualizar `ModuleNode` en frontend types (`packages/frontend/src/types/index.ts`)
    - Agregar campo `sourceContent?: string` al interface `ModuleNode`
    - Agregar campo `earsSpec?: string` al interface `ModuleNode`
    - Actualizar `GenerateSpecResponse` para usar `{ moduleId: string, earsSpec: string }` (remover `specContent` y `savedPath`)
    - _Requirements: 1.3, 2.1, 3.5_

  - [x] 1.2 Actualizar comentario de `sourceContent` en backend types (`packages/backend/src/shared/types.ts`)
    - Cambiar el comentario de `sourceContent` para indicar que ahora se incluye en la respuesta JSON al frontend (ya no es solo "campo temporal del pipeline")
    - _Requirements: 1.3_

- [x] 2. Implementar cambios en el backend
  - [x] 2.1 Remover generación EARS del pipeline de análisis (`packages/backend/src/routes/analyze.ts`)
    - Eliminar el import de `generateEarsSpecs` del archivo
    - Eliminar el paso 4 completo (la llamada a `generateEarsSpecs(modules)` y su log)
    - Pasar `modules` directamente a `buildAnalysisResult` en lugar de `modulesWithSpecs`
    - Renumerar el paso 5 (Orquestar) como paso 4 en los comentarios
    - _Requirements: 1.1, 1.2, 1.4_

  - [x] 2.2 Implementar POST `/api/generate-spec` (`packages/backend/src/routes/generate_spec.ts`)
    - Reemplazar el stub 501 con la implementación completa
    - Importar `generateEarsSpec` desde `../../agents/ears_writer/ears_writer`
    - Parsear body: `{ moduleId, moduleName, sourceContent }`
    - Validar que los tres campos son strings no vacíos; retornar 400 indicando el campo que falló
    - Validar que `sourceContent.length <= 100_000`; retornar 400 si excede
    - Invocar `generateEarsSpec(moduleName, sourceContent)` directamente (sin retry wrapper adicional)
    - Si el resultado empieza con `> ⚠️`, retornar 502 con `{ error: "Error upstream al generar spec: <mensaje>" }`
    - Si no, retornar 200 con `{ moduleId, earsSpec: resultado }`
    - Agregar catch genérico para 500 con logging estructurado `{ agente, módulo, error }`
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 5.1, 5.2, 5.3_

  - [ ]* 2.3 Escribir property tests para POST `/api/generate-spec` (`packages/backend/src/routes/__tests__/generate_spec.property.test.ts`)
    - **Property 2: Valid request with successful agent produces correct 200 response**
    - **Property 3: Invalid request produces 400 with field indication**
    - **Property 4: Agent error prefix maps to 502**
    - Mockear `generateEarsSpec` para aislar la lógica del endpoint
    - Usar `fast-check` con mínimo 100 iteraciones por propiedad
    - **Validates: Requirements 2.1, 2.2, 2.3, 2.5, 5.2, 5.3**

  - [ ]* 2.4 Escribir unit tests para la ruta analyze sin EARS (`packages/backend/src/routes/__tests__/analyze.test.ts`)
    - Verificar que el pipeline NO invoca `generateEarsSpecs`
    - Verificar que la respuesta incluye `earsSpec: ""` para cada módulo
    - Verificar que `sourceContent` se incluye en la respuesta
    - **Validates: Requirements 1.1, 1.2, 1.3**

- [x] 3. Checkpoint — Verificar backend
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Implementar cambios en el frontend — api_client y hook
  - [x] 4.1 Agregar soporte de skip-retry en `api_client` (`packages/frontend/src/services/api_client.ts`)
    - Agregar chequeo en el interceptor de respuesta: si `config` tiene un flag `_skipRetry: true`, no reintentar aunque el error sea retryable
    - Esto permite que la llamada a `/api/generate-spec` evite el retry automático ante 502
    - Coordinar con spec `bedrock-hardening` — el mecanismo debe ser compatible con los reintentos de `/api/analyze`
    - _Requirements: 3.10_

  - [x] 4.2 Refactorizar `useAnalysis` hook (`packages/frontend/src/hooks/use_analysis.ts`)
    - Agregar estado `specErrorModules` como `Set<string>` para trackear módulos con error
    - Cambiar `generateSpec` para recibir solo `moduleId` y buscar `moduleName`/`sourceContent` del módulo en `result.modules`
    - Cambiar request body a `{ moduleId, moduleName, sourceContent }`
    - Implementar `AbortController` con timeout de 30 segundos
    - Pasar `{ _skipRetry: true }` en el config de axios para evitar retry del interceptor
    - En caso de éxito: actualizar solo `module.earsSpec` en el result local, NO modificar `specStatus` ni `specHealthScore`
    - En caso de error (502, timeout, red): agregar moduleId al set `specErrorModules`
    - Agregar guard: si el módulo ya tiene `earsSpec` non-empty, retornar sin hacer request (cache hit)
    - Agregar guard: si `sourceContent` es vacío/undefined, no disparar request
    - Agregar guard: si moduleId está en `specErrorModules`, no auto-trigger
    - Exponer `specErrorModules` y una función `clearSpecError(moduleId)` para el botón "Reintentar"
    - Actualizar tipo de retorno de `generateSpec` para usar el nuevo `GenerateSpecResponse`
    - En mock mode: adaptar el mock para usar `earsSpec` en vez de `specContent`
    - _Requirements: 3.1, 3.2, 3.4, 3.5, 3.7, 3.8, 3.10, 4.1, 4.2, 4.3_

  - [ ]* 4.3 Escribir property tests para `useAnalysis` hook (`packages/frontend/src/hooks/__tests__/use_analysis.property.test.ts`)
    - **Property 5: Request gating by earsSpec presence**
    - **Property 6: Successful spec storage preserves specStatus**
    - Mockear `apiClient.post` y validar con `fast-check`
    - Mínimo 100 iteraciones por propiedad
    - **Validates: Requirements 3.1, 3.5, 4.1, 4.2**

- [x] 5. Implementar cambios en ModulePanel — auto-trigger y UI
  - [x] 5.1 Actualizar `ModulePanel` con auto-trigger y renderizado de spec (`packages/frontend/src/components/module_panel.tsx`)
    - Agregar `useEffect` keyeado a `selectedNode?.id` que auto-dispara `generateSpec` cuando `earsSpec` está vacío
    - Implementar guards: sourceContent vacío → cartel "No hay código fuente disponible", módulo en specErrorModules → no auto-trigger, generación en curso → no duplicar
    - Agregar sección de spec en el panel: renderizar `earsSpec` como texto Markdown cuando está disponible
    - Mostrar spinner mientras `generatingSpec === module.id`
    - Mostrar error truncado a 200 chars cuando falla
    - Agregar botón "Reintentar" que aparece solo cuando el módulo está en `specErrorModules` — al clickear limpia el error y re-dispara `generateSpec`
    - Actualizar props del componente para recibir `specErrorModules` y `clearSpecError`
    - _Requirements: 3.1, 3.2, 3.3, 3.5, 3.6, 3.7, 3.8, 3.9_

  - [x] 5.2 Actualizar `App.tsx` para pasar nuevas props a ModulePanel (`packages/frontend/src/App.tsx`)
    - Pasar `specErrorModules` y `clearSpecError` del hook al componente `ModulePanel`
    - Ajustar la lógica de `handleGenerateSpec` si hace falta
    - _Requirements: 3.1, 3.7_

  - [ ]* 5.3 Escribir property test para truncación de error en ModulePanel (`packages/frontend/src/components/__tests__/module_panel.property.test.ts`)
    - **Property 7: Error message truncation**
    - Generar strings de error arbitrarios con `fast-check` y verificar que el renderizado nunca excede 200 chars + "…"
    - Mínimo 100 iteraciones
    - **Validates: Requirements 3.6**

- [x] 6. Checkpoint — Verificar integración frontend
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 7. Property tests de truncación y auto-trigger
  - [ ]* 7.1 Escribir property test para truncación de sourceContent (`packages/backend/src/shared/__tests__/truncation.property.test.ts`)
    - **Property 1: Source content truncation preserves prefix**
    - Generar strings arbitrarios con `fast-check`, truncar a 4000 chars, verificar que es prefijo del original y tiene longitud ≤ 4000
    - Mínimo 100 iteraciones
    - **Validates: Requirements 1.3**

  - [ ]* 7.2 Escribir test unitario para auto-trigger del useEffect (`packages/frontend/src/components/__tests__/module_panel.auto_trigger.test.tsx`)
    - **Property 8: Auto-trigger fires at most once per module selection**
    - **Property 9: Error state blocks auto-trigger**
    - **Property 10: Empty sourceContent blocks auto-trigger**
    - Renderizar ModulePanel con React Testing Library, verificar que `generateSpec` se llama exactamente una vez por selección
    - Verificar que módulos en `specErrorModules` no disparan auto-trigger
    - Verificar que módulos sin `sourceContent` no disparan auto-trigger
    - **Validates: Requirements 3.2, 3.7, 3.8, 3.9**

- [x] 8. Checkpoint final — Asegurar que todos los tests pasan
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- La implementación del `_skipRetry` en api_client debe coordinarse con el spec `bedrock-hardening` que modifica el mismo interceptor
- `specStatus` y `specHealthScore` son inmutables desde la perspectiva de este feature — solo Haiku los clasifica durante el análisis

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2"] },
    { "id": 1, "tasks": ["2.1", "2.2"] },
    { "id": 2, "tasks": ["2.3", "2.4", "4.1"] },
    { "id": 3, "tasks": ["4.2"] },
    { "id": 4, "tasks": ["4.3", "5.1", "5.2"] },
    { "id": 5, "tasks": ["5.3", "7.1", "7.2"] }
  ]
}
```
