# Implementation Plan: Dependency Analysis Chat

## Overview

Implementar análisis de dependencias inversas en el chat de TrazIA. Se agregan funciones puras en `context_builder.ts` para detectar preguntas de dependencias, calcular inversas, y construir contexto. Se agrega un addendum en `prompt.ts` y se orquesta todo desde `chat.ts`. Los tests usan Jest + fast-check.

## Tasks

- [x] 1. Implementar detección de preguntas de dependencia
  - [x] 1.1 Agregar `isDependencyQuestion` y helper `normalizeAccents` en context_builder.ts
    - Agregar función `normalizeAccents(text: string): string` que usa `String.prototype.normalize('NFD')` y elimina marcas diacríticas con regex `/[\u0300-\u036f]/g`
    - Agregar constantes `DEPENDENCY_DELETION_PATTERNS` y `DEPENDENCY_QUERY_PATTERNS` con los patrones ya normalizados (sin acentos, lowercase)
    - Exportar función `isDependencyQuestion(message: string): boolean` que normaliza el mensaje de entrada y evalúa si contiene algún patrón como substring
    - Retornar `false` para mensajes vacíos o solo whitespace
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_

  - [ ]* 1.2 Escribir tests unitarios para `isDependencyQuestion` en context_builder.test.ts
    - Tests para cada patrón de eliminación individual
    - Tests para cada patrón de consulta de dependencias
    - Tests con variantes de case (mayúsculas/minúsculas)
    - Tests con variantes de acentos ("qué" vs "que", "quién" vs "quien")
    - Test mensaje vacío → false, mensaje sin patrón → false
    - Test patrón como substring con texto antes y después
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 6.1_

  - [ ]* 1.3 Escribir property test round-trip para `isDependencyQuestion`
    - **Property 1: Detección round-trip de patrones de dependencia**
    - **Validates: Requirements 1.1, 1.2, 1.4, 1.6**
    - Archivo: `context_builder.dependency.property.test.ts`
    - Generar patrón aleatorio de la lista, concatenar texto arbitrario antes/después, aplicar case/accent randomizado, verificar que retorna `true`
    - Mínimo 100 iteraciones (`{ numRuns: 100 }`)

- [x] 2. Implementar análisis de dependencias inversas
  - [x] 2.1 Agregar `analyzeDependencies` en context_builder.ts
    - Exportar función `analyzeDependencies(targets: ModuleNode[], allModules: ModuleNode[]): ModuleNode[]`
    - Recorrer `allModules` y retornar aquellos cuyo `dependencies` contiene el ID de al menos un target
    - Excluir los propios targets del resultado
    - Sin duplicados, preservar orden de aparición en `allModules`
    - Retornar `[]` si targets vacío o allModules vacío
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7_

  - [ ]* 2.2 Escribir tests unitarios para `analyzeDependencies` en context_builder.test.ts
    - Test grafo lineal A→B→C: inversas de B = [A]
    - Test módulo con auto-referencia: se excluye del resultado
    - Test múltiples targets: unión sin duplicados
    - Test array vacío de modules → []
    - Test target sin dependencias inversas → []
    - _Requirements: 2.1, 2.2, 2.4, 2.5, 2.6, 2.7, 6.7_

  - [ ]* 2.3 Escribir property test de corrección de dependencias inversas
    - **Property 2: Corrección de dependencias inversas**
    - **Validates: Requirements 2.1**
    - Archivo: `context_builder.dependency.property.test.ts`
    - Generar grafos aleatorios (1-20 ModuleNode con deps válidas), verificar que todo módulo retornado tiene target.id en su `dependencies`
    - Mínimo 100 iteraciones

  - [ ]* 2.4 Escribir property test de exclusión del target
    - **Property 3: Exclusión del target en su propio resultado**
    - **Validates: Requirements 2.4**
    - Archivo: `context_builder.dependency.property.test.ts`
    - Generar grafos con auto-referencias forzadas, verificar que target nunca aparece en resultado
    - Mínimo 100 iteraciones

  - [ ]* 2.5 Escribir property test sin duplicados y cota superior
    - **Property 4: Sin duplicados y cota superior en análisis multi-target**
    - **Validates: Requirements 2.5**
    - Archivo: `context_builder.dependency.property.test.ts`
    - Generar grafos + múltiples targets, verificar sin IDs duplicados y `resultado.length <= allModules.length - targets.length`
    - Mínimo 100 iteraciones

- [x] 3. Implementar construcción de contexto de dependencias
  - [x] 3.1 Agregar `buildDependencyContext` en context_builder.ts
    - Exportar función `buildDependencyContext(targets: ModuleNode[], inverseDeps: ModuleNode[], allModules: ModuleNode[]): string`
    - Generar encabezado `=== Análisis de Dependencias: {target.name} ===` por cada target
    - Listar dependencias inversas con formato `- {dep.name} ({dep.path})`
    - Si no hay inversas: texto "Ningún módulo depende de {target.name}"
    - Incluir `Total de módulos afectados: {N}`
    - Incluir sección "Módulos de los que depende:" con las dependencias directas del target resueltas desde `allModules`
    - Retornar string vacío si `targets` vacío
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

  - [ ]* 3.2 Escribir tests unitarios para `buildDependencyContext` en context_builder.test.ts
    - Test formato con dependencias inversas: contiene encabezado, lista, total
    - Test sin dependencias inversas: contiene "Ningún módulo depende de"
    - Test target sin dependencias directas: sección muestra "ninguna"
    - Test targets vacío: retorna string vacío
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

  - [ ]* 3.3 Escribir property test de completitud del contexto
    - **Property 5: Completitud del contexto de dependencias**
    - **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**
    - Archivo: `context_builder.dependency.property.test.ts`
    - Generar targets + inverseDeps aleatorios, verificar presencia de encabezado, nombres, paths, total, y sección de dependencias directas
    - Mínimo 100 iteraciones

- [x] 4. Checkpoint - Verificar funciones puras
  - Ensure all tests pass, ask the user if questions arise.
  - Ejecutar `npm run test:backend` y `npm run lint -w packages/backend`

- [x] 5. Agregar addendum de prompt y orquestar en chat route
  - [x] 5.1 Agregar `DEPENDENCY_ANALYSIS_ADDENDUM` en prompt.ts
    - Exportar constante `DEPENDENCY_ANALYSIS_ADDENDUM: string` con instrucciones para el LLM sobre cómo responder preguntas de dependencias
    - Instruir a listar módulos afectados, indicar cantidad numérica, mencionar explícitamente si no hay inversas, explicar impacto potencial
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

  - [x] 5.2 Integrar análisis de dependencias en chat.ts
    - Importar `isDependencyQuestion`, `analyzeDependencies`, `buildDependencyContext` desde context_builder
    - Importar `DEPENDENCY_ANALYSIS_ADDENDUM` desde prompt
    - Agregar bloque condicional después de `detectMentionedModules` y antes de `buildRepoContext`
    - Si `isDependencyQuestion(truncatedMessage)` es true y `mentionedModules.length >= 1`: invocar `analyzeDependencies`, luego `buildDependencyContext`, concatenar addendum al `systemPromptAddendum`
    - Concatenar `dependencyContext` al contexto del system prompt junto con el repoContext
    - Envolver en try/catch con log `{ agente: 'chat-route', módulo: 'dependency-analysis', error }` y continuar flujo normal en caso de error
    - Si `isDependencyQuestion` es false o no hay módulos mencionados: flujo idéntico al actual
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_

  - [ ]* 5.3 Escribir test de integración en chat.test.ts
    - Test flujo completo: mensaje de dependencia con módulos → HTTP 200, reply no vacío, sessionId no vacío
    - Test mensaje de dependencia sin módulos mencionados → flujo normal sin crash
    - Test mensaje normal → comportamiento idéntico al actual (regresión)
    - Test error en análisis → HTTP 200, flujo normal sin dep context
    - _Requirements: 5.1, 5.4, 5.6, 6.5_

- [x] 6. Final checkpoint - Verificar build completo
  - Ensure all tests pass, ask the user if questions arise.
  - Ejecutar `npm run test:backend`, `npm run lint -w packages/backend`, `npm run build -w packages/backend`

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- Todas las funciones nuevas son puras (sin side effects), lo que simplifica testing
- Los patrones se almacenan ya normalizados para optimizar evaluación en runtime
- fast-check ya está instalado en el proyecto

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "5.1"] },
    { "id": 1, "tasks": ["1.2", "1.3", "2.1"] },
    { "id": 2, "tasks": ["2.2", "2.3", "2.4", "2.5", "3.1"] },
    { "id": 3, "tasks": ["3.2", "3.3", "5.2"] },
    { "id": 4, "tasks": ["5.3"] }
  ]
}
```
