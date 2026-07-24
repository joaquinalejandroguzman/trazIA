# Implementation Plan: Bedrock Integration

## Overview

Integración de AWS Bedrock como motor de IA real en el backend de TrazIA. El pipeline de `POST /api/analyze` se extiende con dos nuevos agentes LLM: el Analyzer usa Claude Haiku para clasificar módulos con `specStatus` y `specHealthScore` reales, y el EARS Writer usa Claude Sonnet para generar specs en sintaxis EARS por módulo. El Orchestrator pasa a calcular `projectHealthScore` como promedio real. Se implementa un mecanismo de retry con backoff exponencial compartido por todos los agentes.

## Tasks

- [x] 1. Instalar dependencias y actualizar tipos base
  - [x] 1.1 Agregar `@anthropic-ai/bedrock-sdk ^0.32.0` y `fast-check` a `packages/backend/package.json`
    - Añadir `@anthropic-ai/bedrock-sdk` en `dependencies`
    - Añadir `fast-check` en `devDependencies`
    - _Requirements: 1.1, 6.1_

  - [x] 1.2 Extender `packages/backend/src/shared/types.ts` con los nuevos campos
    - Agregar tipo discriminado `SpecStatus = 'traced' | 'drift' | 'untraced'`
    - Agregar campos obligatorios `specStatus: SpecStatus` y `specHealthScore: number` a `ModuleNode`
    - Agregar campos opcionales `sourceContent?: string` y `earsSpec?: string` a `ModuleNode`
    - Agregar campo `projectHealthScore: number` a `AnalysisResult`
    - _Requirements: 3.1, 3.3, 4.2, 5.3_

- [x] 2. Implementar cliente Bedrock y utilidad de retry
  - [x] 2.1 Crear `packages/backend/src/clients/bedrock_client.ts`
    - Implementar función `requireEnv(name)` que lanza error sincrónico si la variable no está definida
    - Exportar constantes `BEDROCK_REGION`, `BEDROCK_MODEL_ANALYZER`, `BEDROCK_MODEL_EARS` leídas desde env
    - Instanciar y exportar `bedrockClient` como singleton `AnthropicBedrock({ awsRegion: BEDROCK_REGION })`
    - Sin credenciales hardcodeadas — usar perfil `trazia-backend` via AWS SDK default chain
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 6.4_

  - [ ]* 2.2 Escribir unit tests para `bedrock_client.ts` en `packages/backend/src/clients/bedrock_client.test.ts`
    - Test: lanza error si falta `BEDROCK_REGION`
    - Test: lanza error si falta `BEDROCK_MODEL_ANALYZER`
    - Test: lanza error si falta `BEDROCK_MODEL_EARS`
    - Test: instancia `bedrockClient` correctamente cuando todas las variables están presentes
    - _Requirements: 1.2, 1.3, 1.4_

  - [x] 2.3 Crear `packages/backend/src/shared/llm_retry.ts`
    - Definir interfaz `RetryOptions` con `maxRetries?`, `baseDelayMs?`, `maxDelayMs?`
    - Implementar función `isTransientError(error)` — detecta `ThrottlingException` y mensajes con "Try your request again"
    - Implementar `withLlmRetry<T>(fn, context, options)` con backoff exponencial `min(MAX_RETRY_DELAY_MS, max(1000, BASE_RETRY_DELAY_MS * 2^(N-1)))`
    - Leer `MAX_LLM_RETRIES`, `BASE_RETRY_DELAY_MS`, `MAX_RETRY_DELAY_MS` desde env con defaults `3`, `1000`, `30000`
    - Loggear `{ intentos, últimoError, tiempoTotalMs }` al agotar reintentos; propagar error con contexto
    - Propagar errores no transitorios inmediatamente sin reintentar
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

  - [ ]* 2.4 Escribir property tests y unit tests para `llm_retry.ts` en `packages/backend/src/shared/llm_retry.test.ts`
    - **Property 1: Backoff cap invariant** — para cualquier N, baseDelay, maxDelay: `delay <= maxDelay && delay >= Math.min(1000, baseDelay)`
    - **Validates: Requirements 2.3**
    - **Property 2: Transient error classification** — para cualquier error: transitorio si y solo si contiene "Try your request again" o es `ThrottlingException`
    - **Validates: Requirements 2.1, 2.5**
    - Unit test: error no transitorio se propaga en el primer intento sin esperar
    - Unit test: al agotar reintentos se loggea `{ intentos, últimoError, tiempoTotalMs }`
    - _Requirements: 2.1, 2.3, 2.5_

- [x] 3. Checkpoint — Verificar compilación y tests base
  - Ejecutar `npm run build` en `packages/backend` y confirmar que no hay errores de TypeScript
  - Ejecutar `npm test` para validar los unit tests del cliente y retry
  - Preguntar al usuario si hay dudas antes de continuar con los agentes

- [x] 4. Modificar el Analyzer para usar Haiku
  - [x] 4.1 Actualizar `packages/backend/src/agents/analyzer/analyzer.ts` para leer `sourceContent` y clasificar con Haiku
    - Leer contenido de cada archivo con `fs.readFileSync` durante el recorrido existente; truncar a 4000 chars si supera ese límite
    - Almacenar contenido en `ModuleNode.sourceContent`
    - Definir interfaz local `HaikuClassification { specStatus, specHealthScore }`
    - Implementar `classifyModuleWithHaiku(module, sourceContent)` que llama a `bedrockClient.messages.create()` con el prompt definido en el diseño
    - Parsear respuesta JSON; ante parse fallido asignar `{ specStatus: 'untraced', specHealthScore: 0 }`
    - Clampar `specHealthScore` al rango [0, 100] con `Math.max(0, Math.min(100, score))`
    - Invocar clasificaciones en paralelo con `Promise.all()` sobre todos los módulos
    - Ante fallo permanente (tras reintentos vía `withLlmRetry`): asignar defaults y loggear `{ agente: 'analyzer', módulo, error }`
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 7.1, 7.3_

  - [ ]* 4.2 Escribir property tests y unit tests para el Analyzer en `packages/backend/src/agents/analyzer/analyzer.test.ts`
    - **Property 3: specHealthScore range invariant** — para cualquier respuesta de Haiku (incluyendo valores fuera de rango, strings, negativos o >100): `specHealthScore >= 0 && specHealthScore <= 100 && Number.isInteger(specHealthScore)`
    - **Validates: Requirements 3.3**
    - **Property 4: Module failure isolation** — para cualquier lista de módulos con un subconjunto fallando: resultado tiene longitud igual al input, fallidos con `{ specStatus: 'untraced', specHealthScore: 0 }`, exitosos con valores reales
    - **Validates: Requirements 3.4, 3.5, 7.1**
    - Unit test: parse fallido de JSON devuelve `{ specStatus: 'untraced', specHealthScore: 0 }`
    - Unit test: contenido mayor a 4000 chars se trunca antes de enviar a Haiku
    - _Requirements: 3.3, 3.4, 3.5, 3.6_

- [x] 5. Implementar el EARS Writer
  - [x] 5.1 Crear `packages/backend/src/agents/ears_writer/ears_writer.ts`
    - Implementar `generateEarsSpec(moduleName, sourceContent)` que llama a `bedrockClient.messages.create()` con `BEDROCK_MODEL_EARS` y el prompt EARS definido en el diseño
    - Usar `withLlmRetry` para reintentar ante errores transitorios
    - Ante fallo total: retornar `"> ⚠️ Error al generar la spec: <mensaje>"` sin lanzar excepción
    - Implementar `generateEarsSpecs(modules)` que invoca `generateEarsSpec` en paralelo con `Promise.all()` para todos los módulos con `sourceContent`; módulos sin `sourceContent` reciben `earsSpec` vacío
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_

  - [x] 5.2 Crear `packages/backend/src/agents/ears_writer/index.ts`
    - Re-exportar `generateEarsSpec` y `generateEarsSpecs` desde `ears_writer.ts`
    - _Requirements: 4.5_

  - [ ]* 5.3 Escribir property tests y unit tests para el EARS Writer en `packages/backend/src/agents/ears_writer/ears_writer.test.ts`
    - **Property 6: EARS Writer never throws** — para cualquier nombre de módulo y sourceContent (incluyendo vacíos, caracteres especiales, contenido muy largo): `generateEarsSpec` retorna siempre un string sin lanzar excepción
    - **Validates: Requirements 4.4**
    - Unit test: el Markdown de error ante fallo total tiene el formato `> ⚠️ Error al generar la spec: ...`
    - Unit test: `generateEarsSpecs` asigna spec vacía a módulos sin `sourceContent`
    - _Requirements: 4.4, 4.6_

- [x] 6. Checkpoint — Verificar agentes core
  - Ejecutar `npm run build` en `packages/backend` y confirmar compilación sin errores
  - Ejecutar `npm test` y validar que los property tests de Analyzer y EARS Writer pasan
  - Preguntar al usuario si hay dudas antes de continuar

- [ ] 7. Actualizar el Orchestrator y la ruta de análisis
  - [ ] 7.1 Actualizar `packages/backend/src/agents/orchestrator/orchestrator.ts` para calcular `projectHealthScore` real
    - Implementar `calculateProjectHealthScore(modules)`: si lista vacía retornar 0; si no, `Math.round(sum(specHealthScore) / n)`
    - Incluir `projectHealthScore` en el objeto retornado por `buildAnalysisResult`
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

  - [ ]* 7.2 Escribir property tests y unit tests para el Orchestrator en `packages/backend/src/agents/orchestrator/orchestrator.test.ts`
    - **Property 5: projectHealthScore arithmetic** — para cualquier lista no vacía de módulos: `projectHealthScore === Math.round(sum / n)` y `projectHealthScore >= 0 && projectHealthScore <= 100`
    - **Validates: Requirements 5.1, 5.3, 5.4**
    - Unit test: lista vacía de módulos produce `projectHealthScore: 0`
    - _Requirements: 5.1, 5.2, 5.4_

  - [ ] 7.3 Actualizar `packages/backend/src/routes/analyze.ts` para insertar paso EARS Writer y manejar 503
    - Importar `generateEarsSpecs` desde `../agents/ears_writer`
    - Insertar el paso `const modulesWithSpecs = await generateEarsSpecs(modules)` entre la detección de integraciones y el `buildAnalysisResult`
    - Pasar `modulesWithSpecs` (en lugar de `modules`) a `buildAnalysisResult`
    - En el bloque `catch` existente, detectar mensaje que contenga "Variable de entorno requerida no definida" y responder con HTTP 503 `{ "error": "Servicio de IA no disponible: <mensaje>" }`
    - Actualizar log del paso orchestrator para reflejar `modulesWithSpecs.length`
    - _Requirements: 7.2, 6.1_

- [ ] 8. Documentar variables de entorno
  - [ ] 8.1 Actualizar `packages/backend/.env.example` con todas las variables Bedrock
    - Agregar `BEDROCK_REGION` con valor de ejemplo no funcional y comentario descriptivo
    - Agregar `BEDROCK_MODEL_ANALYZER` con valor de ejemplo y comentario
    - Agregar `BEDROCK_MODEL_EARS` con valor de ejemplo y comentario
    - Agregar `MAX_LLM_RETRIES` (opcional, default 3) con comentario
    - Agregar `BASE_RETRY_DELAY_MS` (opcional, default 1000) con comentario
    - Agregar `MAX_RETRY_DELAY_MS` (opcional, default 30000) con comentario
    - _Requirements: 6.3, 6.4_

- [ ] 9. Checkpoint final — Validar integración completa
  - Ejecutar `npm run build` en `packages/backend` y confirmar compilación sin errores de TypeScript
  - Ejecutar `npm test` y confirmar que todos los tests pasan (property tests + unit tests)
  - Preguntar al usuario si hay dudas antes de considerar la tarea completa

## Notes

- Las tareas marcadas con `*` son opcionales y pueden saltarse para un MVP más rápido, aunque se recomienda ejecutarlas para garantizar corrección
- Cada tarea referencia los requisitos específicos para trazabilidad
- Los property tests usan `fast-check` con mínimo 100 iteraciones (`{ numRuns: 100 }`)
- La lógica pura de backoff y clamping debe extraerse como funciones independientes para ser testeable sin mocks
- `sourceContent` es un campo temporal del pipeline — nunca debe serializarse en la respuesta JSON final al cliente
- El cliente Bedrock usa la cadena de credenciales estándar del AWS SDK; el perfil `trazia-backend` debe estar configurado en `~/.aws/credentials`

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2"] },
    { "id": 1, "tasks": ["2.1"] },
    { "id": 2, "tasks": ["2.2", "2.3"] },
    { "id": 3, "tasks": ["2.4", "4.1"] },
    { "id": 4, "tasks": ["4.2", "5.1"] },
    { "id": 5, "tasks": ["5.2", "5.3", "7.1"] },
    { "id": 6, "tasks": ["7.2", "7.3"] },
    { "id": 7, "tasks": ["8.1"] }
  ]
}
```
