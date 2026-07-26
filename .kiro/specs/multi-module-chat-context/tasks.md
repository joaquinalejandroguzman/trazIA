# Implementation Plan: Multi-Module Chat Context

## Overview

Extender el sistema de contexto del chat de TrazIA para soportar múltiples módulos simultáneamente, detectar preguntas generales sobre el repositorio, y mostrar indicadores contextuales en el frontend. La implementación sigue un enfoque incremental: primero las funciones puras del context builder, luego la orquestación en la ruta, y finalmente los cambios en frontend.

## Tasks

- [x] 1. Implementar detección multi-módulo y pregunta general en context_builder
  - [x] 1.1 Implementar `detectMentionedModules` en `context_builder.ts`
    - Crear función que retorna array de todos los ModuleNode cuyo `name` o último segmento de `path` matchea como substring case-insensitive en el mensaje
    - Mantener orden del array de entrada, sin duplicados
    - Mantener `detectMentionedModule` (singular) como deprecated, delegando internamente a `detectMentionedModules(msg, modules)[0] ?? null`
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_

  - [x] 1.2 Implementar `isGeneralRepoQuestion` en `context_builder.ts`
    - Crear función que retorna `true` si el mensaje contiene al menos un keyword general como substring case-insensitive Y `mentionedModules` está vacío
    - Keywords: `["repo", "repositorio", "proyecto", "app", "aplicación", "código", "código fuente", "general"]`
    - Retornar `false` para mensajes vacíos o solo whitespace
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [x] 1.3 Extender `buildRepoContext` para aceptar `focusModules[]` con truncado adaptativo
    - Agregar `focusModules?: ModuleNode[]` a `BuildRepoContextOptions`
    - Si `focusModules` tiene 1-4 elementos: snippets truncados a 500 chars con delimitadores "--- Código fuente ({name}) ---" / "--- Fin código fuente ---"
    - Si `focusModules` tiene 5+ elementos: snippets truncados a 300 chars con mismos delimitadores
    - Omitir snippet si `sourceContent` es undefined o vacío
    - Si `focusModule` (singular, deprecated) está definido sin `focusModules`, tratarlo como `focusModules: [focusModule]`
    - Exportar constantes `SNIPPET_LIMIT_SMALL = 500` y `SNIPPET_LIMIT_LARGE = 300`
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

  - [x]* 1.4 Escribir unit tests para `detectMentionedModules` en `context_builder.test.ts`
    - Detecta múltiples módulos por nombre
    - Detecta múltiples módulos por último segmento de path
    - Retorna array vacío sin matches
    - Preserva orden del input
    - No duplica módulos que matchean por name y path segment
    - Usar helper `createModule()` existente
    - _Requirements: 1.1, 1.2, 1.3, 1.5, 1.6_

  - [x]* 1.5 Escribir unit tests para `isGeneralRepoQuestion` en `context_builder.test.ts`
    - Retorna true con keyword general y mentionedModules vacío
    - Retorna false con mentionedModules no vacío (aunque tenga keyword)
    - Retorna false sin keywords generales
    - Retorna false con mensaje vacío o whitespace
    - Detecta multi-word keyword "código fuente"
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [x]* 1.6 Escribir unit tests para `buildRepoContext` con `focusModules` en `context_builder.test.ts`
    - Incluye snippets de múltiples módulos con delimitadores correctos
    - Trunca a 500 chars con 1-4 módulos
    - Trunca a 300 chars con 5+ módulos
    - Omite snippet para módulos sin sourceContent
    - Sin snippets cuando focusModules es undefined o vacío
    - Backward compat: focusModule singular sigue funcionando
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

- [x] 2. Implementar property-based tests para context_builder
  - [x]* 2.1 Escribir property test: Detection completeness
    - **Property 1: Detection completeness**
    - Para cualquier mensaje y array de módulos, `detectMentionedModules` retorna exactamente el subconjunto de módulos cuyo name o último path segment aparece como substring case-insensitive en el mensaje
    - **Validates: Requirements 1.1, 1.2, 1.3, 1.4**

  - [x]* 2.2 Escribir property test: Detection order preservation
    - **Property 2: Detection order preservation**
    - El array retornado preserva el orden relativo del array de entrada
    - **Validates: Requirements 1.5**

  - [x]* 2.3 Escribir property test: Detection deduplication
    - **Property 3: Detection deduplication**
    - El array retornado no contiene duplicados, aún si un módulo matchea por name y path segment
    - **Validates: Requirements 1.6**

  - [x]* 2.4 Escribir property test: General question detection biconditional
    - **Property 4: General question detection biconditional**
    - `isGeneralRepoQuestion` retorna true si y solo si el mensaje contiene al menos un keyword general como substring Y mentionedModules está vacío
    - **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5**

  - [x]* 2.5 Escribir property test: Adaptive truncation for small module sets
    - **Property 5: Adaptive truncation for small module sets**
    - Con 1-4 focusModules con sourceContent > 500 chars, el output contiene exactamente 500 chars de cada snippet
    - **Validates: Requirements 3.1, 3.3**

  - [x]* 2.6 Escribir property test: Adaptive truncation for large module sets
    - **Property 6: Adaptive truncation for large module sets**
    - Con 5+ focusModules con sourceContent > 300 chars, el output contiene exactamente 300 chars de cada snippet
    - **Validates: Requirements 3.2**

  - [x]* 2.7 Escribir property test: Omission of empty sourceContent
    - **Property 7: Omission of empty sourceContent**
    - Si un módulo en focusModules tiene sourceContent undefined o vacío, no se incluyen delimitadores de snippet para ese módulo
    - **Validates: Requirements 3.4**

  - [x]* 2.8 Escribir property test: No snippets without focusModules
    - **Property 8: No snippets without focusModules**
    - Sin focusModules, el output no contiene ningún delimitador de snippet
    - **Validates: Requirements 3.5**

- [x] 3. Checkpoint - Validar context_builder
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Implementar GENERAL_REPO_ADDENDUM y orquestación en la ruta de chat
  - [x] 4.1 Agregar `GENERAL_REPO_ADDENDUM` en `prompt.ts`
    - Exportar constante con texto exacto: "El usuario está preguntando sobre el repositorio en general. Arrancá tu respuesta con 'Voy a analizar todos los módulos del repositorio:' y hacé un resumen de qué hace cada uno, basándote en el código fuente proporcionado."
    - _Requirements: 5.2_

  - [x] 4.2 Actualizar orquestación en `chat.ts`
    - Importar `detectMentionedModules`, `isGeneralRepoQuestion`, y `GENERAL_REPO_ADDENDUM`
    - Evaluar prioridad: general question → multi-module → single module → no-focus
    - Si general question: `focusModules = modules` (todos), append addendum al system prompt
    - Si mentionedModules >= 1: `focusModules = mentionedModules`
    - Si mentionedModules === 0 y no general: sin focusModules (fallback actual)
    - Agregar `analyzingModules: string[]` al response JSON (nombres de módulos en focusModules)
    - Actualizar interfaz `ChatResponse` local con `analyzingModules?: string[]`
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 5.1, 5.3, 5.4_

  - [x]* 4.3 Escribir integration tests para orquestación en `chat.test.ts`
    - Pregunta general → todos los módulos como focusModules + addendum en system prompt
    - Multi-module mencionado → módulos detectados como focusModules
    - Single module → módulo detectado como focusModules
    - Sin match → sin focusModules, sin addendum
    - Response incluye `analyzingModules` con nombres de módulos
    - Response incluye `analyzingModules: []` cuando no hay focusModules
    - Intent no-repo (saludo/jailbreak/offtopic) → sin addendum, sin analyzingModules
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 5.1, 5.3, 5.4_

- [x] 5. Checkpoint - Validar backend completo
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Implementar cambios en frontend
  - [x] 6.1 Actualizar `ChatResponse` en `types/index.ts`
    - Agregar campo opcional `analyzingModules?: string[]` a la interfaz ChatResponse
    - _Requirements: 6.1_

  - [x] 6.2 Actualizar hook `useChat` en `use_chat.ts`
    - Agregar estado `analyzingModules: string[] | null` inicializado en `null`
    - Agregar `analyzingModules` a `UseChatReturn`
    - Cuando response contiene `analyzingModules` con 1+ elementos: setear al array
    - Cuando response no contiene `analyzingModules` o es vacío: mantener `null`
    - Al agregar assistant message: resetear `analyzingModules` a `null`
    - Exponer `analyzingModules` en el retorno del hook
    - _Requirements: 6.2, 6.3, 6.4, 6.5, 6.6_

  - [x] 6.3 Actualizar indicador de carga en `chat_panel.tsx`
    - Consumir `analyzingModules` del hook `useChat`
    - Si `isLoading && analyzingModules && analyzingModules.length > 0`: mostrar "Analizando (1/{X})..." donde X = analyzingModules.length
    - Si `isLoading && (!analyzingModules || analyzingModules.length === 0)`: mostrar "Pensando..."
    - Agregar `aria-live="polite"` al contenedor del indicador de carga
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

- [x] 7. Final checkpoint - Validar implementación completa
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- Se usa el helper `createModule()` existente en los tests, no se hardcodean nombres reales de módulos
- La función `detectMentionedModule` (singular) se mantiene como deprecated por backward compatibility
- El campo `analyzingModules` es opcional en la respuesta para backward compatibility con el frontend existente

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "4.1"] },
    { "id": 1, "tasks": ["1.3"] },
    { "id": 2, "tasks": ["1.4", "1.5", "1.6", "2.1", "2.2", "2.3", "2.4"] },
    { "id": 3, "tasks": ["2.5", "2.6", "2.7", "2.8"] },
    { "id": 4, "tasks": ["4.2", "6.1"] },
    { "id": 5, "tasks": ["4.3", "6.2"] },
    { "id": 6, "tasks": ["6.3"] }
  ]
}
```
