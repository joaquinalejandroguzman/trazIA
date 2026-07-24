# Implementation Plan: bedrock-hardening

## Overview

Cuatro mejoras de hardening del pipeline LLM aplicadas en orden de dependencia: primero el helper
de concurrencia (base de todos los fan-outs), luego la ampliación de detección de errores
transitorios, después el parseo robusto del JSON de Haiku, y finalmente el timeout del frontend.
Cada área incluye property tests con fast-check validando las 8 propiedades formales del diseño.

## Tasks

- [x] 1. Crear `concurrency_limiter.ts` con `parseConcurrency` y `limitedMap`
  - [x] 1.1 Implementar `parseConcurrency` y la constante `MAX_CONCURRENCY`
    - Crear `packages/backend/src/shared/concurrency_limiter.ts`
    - Leer `MAX_LLM_CONCURRENCY` del entorno con `parseInt`; retornar 4 si el valor es `undefined`, `""`, `"0"`, negativo, o no-entero
    - Exportar `MAX_CONCURRENCY` (valor evaluado al cargar el módulo) y `parseConcurrency(raw, defaultValue?)` para permitir testeo aislado
    - _Requirements: 1.1, 1.2_

  - [ ]* 1.2 Escribir unit tests de ejemplo para `parseConcurrency`
    - Cubrir: `undefined`, `""`, `"0"`, `"-1"`, `"abc"`, `"4"`, `"10"`, `"3.5"`
    - Archivo: `packages/backend/src/shared/__tests__/concurrency_limiter.unit.test.ts`
    - _Requirements: 1.2_

  - [x] 1.3 Implementar `limitedMap` con patrón worker-pool
    - Lanzar `min(MAX_CONCURRENCY, items.length)` workers que comparten un índice atómico
    - Pre-asignar `results[i]` para preservar orden; capturar error por ítem con `onError` o `undefined` como fallback
    - _Requirements: 1.3, 1.4, 1.5, 1.6_

  - [ ]* 1.4 Escribir property test — Property 1: concurrencia máxima nunca superada
    - **Property 1: Concurrency_Limiter nunca supera MAX_CONCURRENCY llamadas activas**
    - Instrumentar con contador `inflight`; afirmar `maxInflight <= MAX_CONCURRENCY`
    - Archivo: `packages/backend/src/shared/__tests__/concurrency_limiter.property.test.ts`
    - **Validates: Requirements 1.3, 1.4, 5.6**

  - [ ]* 1.5 Escribir property test — Property 7: `limitedMap` preserva orden del input
    - **Property 7: results[i] corresponde a inputs[i] independientemente del orden de resolución**
    - Usar promesas con resolución aleatoria; comparar índices del resultado con los del input
    - Archivo: `packages/backend/src/shared/__tests__/concurrency_limiter.property.test.ts`
    - **Validates: Requirements 1.5**

  - [ ]* 1.6 Escribir property test — Property 8: `limitedMap` retorna array de igual longitud ante fallos parciales
    - **Property 8: longitud del resultado siempre === longitud del input aunque haya fallos**
    - Generar lista con subconjunto aleatorio de ítems que lanzan error; afirmar `results.length === items.length`
    - Archivo: `packages/backend/src/shared/__tests__/concurrency_limiter.property.test.ts`
    - **Validates: Requirements 1.6**

- [x] 2. Ampliar `isTransientError` en `llm_retry.ts`
  - [x] 2.1 Añadir detección de HTTP 5xx y códigos de red a `isTransientError`
    - Modificar `packages/backend/src/shared/llm_retry.ts`
    - Agregar comprobaciones: `status` ∈ `{500, 502, 503, 504, 529}`, `code` ∈ `{'ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND', 'EPIPE'}`, subcadenas `'socket hang up'` y `'connect ETIMEDOUT'` en `message`
    - Mantener las condiciones existentes (`429`, `ThrottlingException`, `'Try your request again'`) sin cambios
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

  - [ ]* 2.2 Escribir property test — Property 4: `isTransientError` retorna true para el conjunto transitorio
    - **Property 4: isTransientError(err) === true para status ∈ {429, 500, 502, 503, 504, 529}**
    - Muestrear `status` aleatoriamente del conjunto con `fc.constantFrom`
    - Archivo: `packages/backend/src/shared/__tests__/llm_retry.property.test.ts`
    - **Validates: Requirements 2.1, 2.3, 5.3**

  - [ ]* 2.3 Escribir property test — Property 2: backoff dentro del rango esperado
    - **Property 2: calculateBackoffDelay(attempt, base, max) ∈ [min(1000, base), max]**
    - Rangos: `attempt` ∈ [1, 20], `baseDelayMs` ∈ [1, 60 000], `maxDelayMs` ∈ [1 000, 60 000]
    - Archivo: `packages/backend/src/shared/__tests__/llm_retry.property.test.ts`
    - **Validates: Requirements 5.1**

  - [ ]* 2.4 Escribir property test — Property 3: backoff es monótono no decreciente
    - **Property 3: calculateBackoffDelay(n+1, base, max) >= calculateBackoffDelay(n, base, max)**
    - Muestrear `n` ∈ [1, 19] con `base` y `max` fijos por iteración
    - Archivo: `packages/backend/src/shared/__tests__/llm_retry.property.test.ts`
    - **Validates: Requirements 5.2**

  - [ ]* 2.5 Escribir unit tests de ejemplo para `isTransientError` (casos negativos)
    - Cubrir: string, number, null, `Error` sin propiedades clave, `Error` con status 400
    - Archivo: `packages/backend/src/shared/__tests__/llm_retry.property.test.ts`
    - _Requirements: 2.6_

- [x] 3. Checkpoint — Pasar tests de shared antes de continuar
  - Asegurar que todos los tests en `packages/backend/src/shared/__tests__/` pasan. Resolver cualquier duda antes de continuar.

- [x] 4. Implementar `parseHaikuClassification` en `analyzer.ts`
  - [x] 4.1 Extraer y exportar `parseHaikuClassification` como función pura
    - Modificar `packages/backend/src/agents/analyzer/analyzer.ts`
    - Implementar el flujo de 5 pasos del diseño: FENCE → BRACE → PARSE → VALIDATE → clamp
    - Exportar `parseHaikuClassification(raw: string): HaikuClassification` para testeo aislado
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

  - [x] 4.2 Integrar `parseHaikuClassification` en `classifyModuleWithHaiku`
    - Reemplazar el bloque `try { JSON.parse(text) ... } catch { return defaults }` por `return parseHaikuClassification(text)`
    - Eliminar el `try/catch` interior redundante (los defaults están garantizados en la helper)
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

  - [ ]* 4.3 Escribir property test — Property 5: extracción correcta de JSON embebido
    - **Property 5: parseHaikuClassification extrae specStatus y specHealthScore de cualquier contenedor válido**
    - Generar texto combinando prosa aleatoria, fence opcional y JSON válido con `fc.record` + `fc.oneof`
    - Afirmar que el resultado coincide con los valores del JSON embebido
    - Archivo: `packages/backend/src/agents/analyzer/__tests__/haiku_parsing.property.test.ts`
    - **Validates: Requirements 3.1, 3.2, 3.3, 5.4**

  - [ ]* 4.4 Escribir property test — Property 6: `specHealthScore` siempre clampeado a [0, 100]
    - **Property 6: parseHaikuClassification retorna specHealthScore ∈ [0, 100] para cualquier entero n ∈ [-1000, 1000]**
    - Usar `fc.integer({ min: -1000, max: 1000 })` para generar el score
    - Archivo: `packages/backend/src/agents/analyzer/__tests__/haiku_parsing.property.test.ts`
    - **Validates: Requirements 3.6, 5.5**

  - [ ]* 4.5 Escribir unit tests de ejemplo para `parseHaikuClassification`
    - Cubrir: JSON inválido, fence vacío, objeto sin claves requeridas, `specStatus` con valor desconocido, `specHealthScore` decimal en rango, `{ specStatus: 'traced', specHealthScore: 0 }` (válido sin modificación)
    - Archivo: `packages/backend/src/agents/analyzer/__tests__/haiku_parsing.property.test.ts`
    - _Requirements: 3.4, 3.5, 3.6_

- [x] 5. Integrar `limitedMap` en `analyzer.ts` (reemplazar `Promise.all`)
  - [x] 5.1 Reemplazar `Promise.all` del fan-out de clasificación con `limitedMap`
    - Modificar `packages/backend/src/agents/analyzer/analyzer.ts`
    - Importar `limitedMap` y `MAX_CONCURRENCY` desde `../../shared/concurrency_limiter`
    - Reemplazar `await Promise.all(modules.map(...))` por `await limitedMap(modules, fn, onError)`
    - Pasar `onError` que retorna `{ specStatus: 'untraced', specHealthScore: 0 }` ante fallo del módulo
    - _Requirements: 1.3, 1.5, 1.6_

- [x] 6. Integrar `limitedMap` en `ears_writer.ts` (reemplazar `Promise.all`)
  - [x] 6.1 Reemplazar `Promise.all` del fan-out de generación de specs con `limitedMap`
    - Modificar `packages/backend/src/agents/ears_writer/ears_writer.ts`
    - Importar `limitedMap` desde `../../shared/concurrency_limiter`
    - Reemplazar `await Promise.all(modules.map(...))` por `await limitedMap(modules, fn, onError)`
    - Pasar `onError` que retorna `{ ...module, earsSpec: '' }` ante fallo del módulo
    - _Requirements: 1.4, 1.5, 1.6_

- [x] 7. Checkpoint — Pasar tests de agentes antes de continuar
  - Asegurar que todos los tests en `packages/backend/src/agents/analyzer/__tests__/` pasan. Resolver cualquier duda antes de continuar.

- [x] 8. Ajustar timeout y lógica de cortocircuito en `api_client.ts`
  - [x] 8.1 Actualizar `REQUEST_TIMEOUT_MS` y refactorizar el interceptor de respuesta
    - Modificar `packages/frontend/src/services/api_client.ts`
    - Cambiar `REQUEST_TIMEOUT_MS` de `60_000` a `180_000`
    - Mover la detección de `ECONNABORTED` al inicio del interceptor, antes del bloque de retry, rechazando la promesa inmediatamente con el mensaje exacto `'La operación tardó demasiado. Intentá con un repositorio más chico o volvé a intentar.'`
    - El bloque de retry existente (1 reintento, 2 000 ms) aplica solo a errores no-ECONNABORTED
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

  - [ ]* 8.2 Escribir unit tests de ejemplo para el interceptor de `api_client`
    - Cubrir: error 500 se reintenta exactamente 1 vez; ECONNABORTED no se reintenta; segundo reintento fallido no genera tercero
    - Archivo: `packages/frontend/src/services/__tests__/api_client.property.test.ts`
    - _Requirements: 4.2, 4.3, 4.4_

- [x] 9. Checkpoint final — Pasar todos los tests del proyecto
  - Ejecutar `npm test` en `packages/backend` y `packages/frontend`. Asegurar que los 8 property tests y todos los unit tests pasan. Resolver cualquier duda antes de finalizar.

## Notes

- Las sub-tareas marcadas con `*` son opcionales y pueden omitirse para un MVP más rápido
- El diseño usa TypeScript en todo el stack; todos los ejemplos de código deben seguir ese lenguaje
- Convenciones del proyecto: archivos en snake_case, comentarios en español, no usar `any`
- fast-check ya está en `devDependencies` del backend y del frontend — no instalar dependencias nuevas
- Cada property test debe incluir el tag: `// Feature: bedrock-hardening, Property N: <texto>`
- Mínimo 100 iteraciones por property (`{ numRuns: 100 }` en `fc.assert`)
- El helper `parseConcurrency` debe exportarse desde `concurrency_limiter.ts` para facilitar testeo aislado
- `parseHaikuClassification` debe exportarse desde `analyzer.ts` para facilitar testeo aislado

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "1.3"] },
    { "id": 2, "tasks": ["1.4", "1.5", "1.6", "2.1"] },
    { "id": 3, "tasks": ["2.2", "2.3", "2.4", "2.5"] },
    { "id": 4, "tasks": ["4.1", "5.1", "6.1", "8.1"] },
    { "id": 5, "tasks": ["4.2"] },
    { "id": 6, "tasks": ["4.3", "4.4", "4.5", "8.2"] }
  ]
}
```
