# Design Document — bedrock-hardening

## Overview

Este documento describe el diseño técnico de las cuatro mejoras de hardening del pipeline LLM de
`/api/analyze`, más la suite de property tests que los valida. El objetivo es que el pipeline opere
de forma robusta sobre repositorios reales con decenas de módulos: sin throttling, sin timeouts
prematuros y sin clasificaciones silenciosamente incorrectas.

### Problemas actuales

| Síntoma | Causa raíz |
|---|---|
| ThrottlingException al analizar repos grandes | `Promise.all` sin límite dispara N llamadas a Bedrock simultáneamente |
| Errores de red no reintentados | `isTransientError` solo cubre 429 y ThrottlingException |
| Clasificaciones incorrectas silenciosas | `JSON.parse` falla cuando Haiku envuelve la respuesta en fences Markdown |
| Timeout prematuro en el frontend | `REQUEST_TIMEOUT_MS = 60_000` insuficiente para repos medianos |

### Cambios en alcance

1. **`concurrency_limiter.ts`** — nuevo helper en `packages/backend/src/shared/`
2. **`llm_retry.ts`** — ampliar `isTransientError` con HTTP 5xx y códigos de red
3. **`analyzer.ts`** — parseo robusto del JSON de Haiku en `classifyModuleWithHaiku`
4. **`api_client.ts`** — subir `REQUEST_TIMEOUT_MS` a 180 000 ms
5. **Tests** — property tests con fast-check en backend y frontend

---

## Architecture

El cambio no altera la topología del pipeline; solo refuerza dos capas horizontales ya existentes.

```mermaid
flowchart TD
    subgraph Frontend
        AC[api_client.ts\ntimeout: 180s]
    end

    subgraph Backend — /api/analyze
        R[route: analyze.ts] --> Orch[orchestrator.ts]
        Orch --> ANZ[analyzer.ts]
        Orch --> EARS[ears_writer.ts]
    end

    subgraph Shared — capas transversales
        CL["concurrency_limiter.ts\n(nuevo)"]
        LR["llm_retry.ts\n(ampliado)"]
    end

    subgraph AWS
        B[(Bedrock)]
    end

    AC -->|HTTP POST /analyze| R
    ANZ -->|usa| CL
    EARS -->|usa| CL
    CL -->|wrappea| LR
    LR -->|invoca| B
```

### Decisión: helper propio vs `p-limit`

La implementación del limitador de concurrencia se hará con un **helper propio** (`concurrency_limiter.ts`)
en lugar de la librería `p-limit`. Razones:

- `p-limit` añade una dependencia de producción para ~30 líneas de código; el helper propio tiene
  cero dependencias externas y es trivial de auditar.
- El contrato que necesitamos (`limitedMap<T>`) es más específico que la API genérica de `p-limit`
  (que devuelve funciones wrapped individuales); el helper expone directamente la semántica
  "mapea lista con concurrencia ≤ N, preserva orden, captura errores por ítem".
- Los tests de property que exige el Req 5 se escriben directamente sobre el helper propio;
  con `p-limit` habría que mockearlo.
- Si en el futuro el equipo necesita la API más completa de `p-limit`, la migración es trivial.

---

## Components and Interfaces

### 1. `concurrency_limiter.ts` (nuevo)

**Ubicación:** `packages/backend/src/shared/concurrency_limiter.ts`

```typescript
// Lee MAX_LLM_CONCURRENCY del entorno; usa 4 como default si no es entero positivo
export const MAX_CONCURRENCY: number

/**
 * Parsea el valor de la env var y devuelve un entero positivo, o el default.
 * Exportado para facilitar el testeo unitario.
 */
export function parseConcurrency(raw: string | undefined, defaultValue?: number): number

/**
 * Ejecuta `fn` sobre cada elemento de `items` con concurrencia máxima MAX_CONCURRENCY.
 * Preserva el orden: results[i] corresponde a items[i].
 * No lanza excepción aunque fn(items[i]) falle; en ese caso results[i] recibe el valor
 * retornado por onError(items[i], err), que por defecto es undefined.
 *
 * @param items    — lista de entradas
 * @param fn       — función asíncrona a ejecutar por ítem
 * @param onError  — handler de error por ítem (opcional); retorna el valor de fallback
 */
export async function limitedMap<T, R>(
  items: T[],
  fn: (item: T) => Promise<R>,
  onError?: (item: T, error: unknown) => R
): Promise<R[]>
```

**Pseudocódigo del algoritmo:**

```
función limitedMap(items, fn, onError):
  resultados = array[items.length]  // posiciones preasignadas
  cola = [...items con índice]
  enVuelo = 0
  puntero = 0

  función procesarSiguiente():
    mientras enVuelo < MAX_CONCURRENCY y puntero < items.length:
      i = puntero++
      enVuelo++
      fn(items[i])
        .then(r  → resultados[i] = r)
        .catch(e → resultados[i] = onError ? onError(items[i], e) : undefined)
        .finally(→ enVuelo--; procesarSiguiente())

  // Arrancar el primer batch
  procesarSiguiente()

  // Esperar a que todos terminen
  await Promise.all(tareas iniciadas)

  retornar resultados
```

> **Nota de implementación real:** en lugar de mantener un array de promesas manualmente,
> se usa el patrón "worker pool": se lanzan `min(MAX_CONCURRENCY, items.length)` workers
> que consumen de una cola compartida con índice atómico (seguro en JS single-thread).

### 2. `llm_retry.ts` — ampliación de `isTransientError`

**Ubicación:** `packages/backend/src/shared/llm_retry.ts` (modificación)

Firma sin cambios; solo se amplía la lógica interna:

```typescript
export function isTransientError(error: unknown): boolean
```

**Condiciones que retornan `true` (acumulativas):**

| Condición | Propiedad del error | Valores |
|---|---|---|
| HTTP throttling / rate limit | `status` | `429` |
| HTTP server error | `status` | `500`, `502`, `503`, `504`, `529` |
| SDK ThrottlingException | `constructor.name` | `'ThrottlingException'` |
| Mensaje SDK | `message` subcadena | `'Try your request again'` |
| Código de red | `code` | `'ECONNRESET'`, `'ECONNREFUSED'`, `'ETIMEDOUT'`, `'ENOTFOUND'`, `'EPIPE'` |
| Mensaje de red | `message` subcadena | `'socket hang up'`, `'connect ETIMEDOUT'` |

Cualquier otro valor (incluido no-Error) retorna `false`.

### 3. `analyzer.ts` — parseo robusto en `classifyModuleWithHaiku`

**Ubicación:** `packages/backend/src/agents/analyzer/analyzer.ts` (modificación)

Se extrae una función auxiliar pura que concentra toda la lógica de extracción/validación:

```typescript
/**
 * Extrae y valida el objeto de clasificación desde el texto de respuesta de Haiku.
 * Aplica los pasos en orden: fence → primer {...} → JSON.parse → validación de tipos → clamp.
 * Exportada para facilitar el testeo unitario.
 */
export function parseHaikuClassification(raw: string): HaikuClassification
```

**Flujo de extracción (en orden):**

```
1. FENCE: ¿contiene ```json ... ``` o ``` ... ```?
   → Sí: extraer texto interior del primer fence → usar como `candidate`
   → No: usar `raw` completo como `candidate`

2. BRACE: localizar primer '{' y su '}' de cierre balanceado en `candidate`
   → Encontrado: usar ese substring como `jsonStr`
   → No encontrado: retornar defaults { specStatus: 'untraced', specHealthScore: 0 }

3. PARSE: JSON.parse(jsonStr)
   → Falla: retornar defaults

4. VALIDATE:
   → ¿falta specStatus (string) o specHealthScore (number)?  → retornar defaults
   → specStatus no ∈ {'traced','drift','untraced'}?          → sustituir 'untraced'
   → specHealthScore < 0?                                     → clamp a 0
   → specHealthScore > 100?                                   → clamp a 100

5. Retornar objeto validado
```

**Firma de integración en `classifyModuleWithHaiku`:**

```typescript
// Antes (frágil):
const parsed = JSON.parse(text)

// Después (robusto):
return parseHaikuClassification(text)
```

La función `classifyModuleWithHaiku` pasa el texto crudo de Bedrock a `parseHaikuClassification`
y retorna el resultado directamente. Los defaults están garantizados en la helper, no en el catch
exterior.

### 4. `api_client.ts` — timeout y lógica de retry

**Ubicación:** `packages/frontend/src/services/api_client.ts` (modificación)

```typescript
// Timeout ampliado: 3 minutos para repos medianos
const REQUEST_TIMEOUT_MS = 180_000
```

**Cambio en el interceptor de respuesta:**

```typescript
// Nuevo: ECONNABORTED omite retry y rechaza directamente
if (error.code === 'ECONNABORTED') {
  return Promise.reject(
    new Error('La operación tardó demasiado. Intentá con un repositorio más chico o volvé a intentar.')
  )
}
```

> El mensaje ya existe en `getReadableErrorMessage`; el cambio es que ahora el interceptor
> **no entra al bloque de retry** cuando detecta `ECONNABORTED`, sino que rechaza de inmediato.
> Axios libera el socket automáticamente al abortar la petición — no se requiere código adicional
> para el criterio 4.5 de liberación de conexión.

**Flujo del interceptor actualizado:**

```
recibe error
  ├── error.code === 'ECONNABORTED'?
  │     → rechazar inmediatamente con mensaje de timeout (sin retry)
  └── ¿retryable (no-ECONNABORTED) Y retryCount < MAX_RETRIES?
        → esperar RETRY_DELAY_MS, reintentar
        → si falla de nuevo: rechazar con mensaje legible (sin tercer intento)
```

---

## Data Models

No se introducen tipos nuevos en `shared/types.ts`. Los tipos relevantes para este spec son
todos locales a los módulos modificados:

```typescript
// En concurrency_limiter.ts — interno
interface WorkerState {
  nextIndex: number   // índice del próximo ítem a procesar (compartido entre workers)
  active: number      // contador de llamadas activas (solo para tests)
}

// En analyzer.ts — ya existente
interface HaikuClassification {
  specStatus: SpecStatus      // 'traced' | 'drift' | 'untraced'
  specHealthScore: number     // entero [0, 100], post-clamp
}

// En llm_retry.ts — cast interno para narrowing
interface TransientErrorShape {
  status?: number
  code?: string
  message: string
}
```

---

## Correctness Properties

*Una propiedad es una característica o comportamiento que debe ser verdadera en todas las ejecuciones válidas de un sistema — esencialmente, un enunciado formal sobre lo que el sistema debe hacer. Las propiedades sirven como puente entre especificaciones legibles por humanos y garantías de corrección verificables automáticamente.*

### Property Reflection (consolidación de redundancias)

Antes de escribir las propiedades, se consolidan los criterios que testean la misma invariante:

- **1.3 y 1.4** (fan-outs de Analyzer y EARS Writer) → misma invariante de concurrencia → consolidan en **Property 1**
- **2.1, 2.3, 5.3** (status HTTP transitorio) → mismo muestreo del conjunto de status → consolidan en **Property 3**
- **3.1, 3.2, 3.3, 5.4** (extracción de JSON desde texto variado) → mismo round-trip de parsing → consolidan en **Property 4**
- **3.6 y 5.5** (clamping de specHealthScore) → misma invariante de rango → consolidan en **Property 5**
- **1.5 y 1.6** (orden e integridad del output) → invariantes complementarias del limiter → se mantienen separadas como **Property 6** y **Property 7**

### Property 1: Concurrencia máxima nunca superada

*Para cualquier* lista de N módulos con N > `MAX_CONCURRENCY`, el Concurrency_Limiter nunca tiene más de `MAX_CONCURRENCY` llamadas activas simultáneamente, medido como el máximo de un contador de inflight que se incrementa al inicio y decrementa al final de cada llamada simulada.

**Validates: Requirements 1.3, 1.4, 5.6**

---

### Property 2: Backoff dentro del rango esperado

*Para cualquier* combinación de `attempt` ∈ [1, 20], `baseDelayMs` ∈ [1, 60 000] y `maxDelayMs` ∈ [1 000, 60 000], `calculateBackoffDelay(attempt, baseDelayMs, maxDelayMs)` retorna un valor en el rango `[Math.min(1000, baseDelayMs), maxDelayMs]`.

**Validates: Requirements 5.1**

---

### Property 3: Backoff es monótono no decreciente

*Para cualquier* `n` ∈ [1, 19] y valores fijos de `baseDelayMs` y `maxDelayMs`, se cumple que `calculateBackoffDelay(n+1, baseDelayMs, maxDelayMs) >= calculateBackoffDelay(n, baseDelayMs, maxDelayMs)`.

**Validates: Requirements 5.2**

---

### Property 4: isTransientError retorna true para errores del conjunto transitorio

*Para cualquier* instancia de `Error` construida con `status` muestreado aleatoriamente del conjunto `{429, 500, 502, 503, 504, 529}`, `isTransientError` retorna `true`.

**Validates: Requirements 2.1, 2.3, 5.3**

---

### Property 5: parseHaikuClassification extrae correctamente de texto con JSON embebido

*Para cualquier* combinación de contenedor (fence Markdown, texto con prosa circundante, o JSON en bruto) que envuelva un objeto con `specStatus` ∈ `{'traced', 'drift', 'untraced'}` y `specHealthScore` ∈ [0, 100], `parseHaikuClassification` retorna exactamente esos valores.

**Validates: Requirements 3.1, 3.2, 3.3, 5.4**

---

### Property 6: specHealthScore siempre clampeado a [0, 100]

*Para cualquier* entero `n` ∈ [-1 000, 1 000], `parseHaikuClassification` aplicada a una respuesta con `specHealthScore: n` retorna un `specHealthScore` en el rango `[0, 100]`.

**Validates: Requirements 3.6, 5.5**

---

### Property 7: limitedMap preserva el orden del input

*Para cualquier* lista de N ítems procesados con el Concurrency_Limiter, `results[i]` corresponde siempre a `inputs[i]`, independientemente del orden de resolución de las promesas.

**Validates: Requirements 1.5**

---

### Property 8: limitedMap retorna array de igual longitud ante fallos parciales

*Para cualquier* lista de N módulos en la que un subconjunto aleatorio lanza error, la longitud del array retornado por `limitedMap` es siempre N.

**Validates: Requirements 1.6**

---

## Error Handling

### Backend

| Escenario | Comportamiento |
|---|---|
| Bedrock retorna ThrottlingException / 429 | `isTransientError` → true → `withLlmRetry` reintenta con backoff |
| Bedrock retorna 500/502/503/504/529 | Igual que anterior (nuevo comportamiento) |
| Error de red (ECONNRESET, etc.) | Igual que anterior (nuevo comportamiento) |
| Haiku retorna JSON envuelto en fence | `parseHaikuClassification` extrae el interior del fence |
| Haiku retorna JSON con prosa circundante | `parseHaikuClassification` localiza el primer `{...}` |
| Haiku retorna texto sin JSON válido | `parseHaikuClassification` retorna defaults sin lanzar excepción |
| `classifyModuleWithHaiku` falla permanentemente | `limitedMap` captura el error; ese módulo recibe `{ specStatus: 'untraced', specHealthScore: 0 }` |
| `generateEarsSpec` falla permanentemente | `limitedMap` captura el error; ese módulo recibe `earsSpec: ''` |

### Frontend

| Escenario | Comportamiento |
|---|---|
| Petición supera 180 s | Interceptor detecta `ECONNABORTED`, rechaza inmediatamente sin retry |
| Error 5xx del servidor | Interceptor aplica 1 reintento con 2 000 ms de espera |
| Segundo intento falla | Rechaza con mensaje legible; sin tercer intento |
| Error 4xx | Rechaza directamente con mensaje legible; sin retry |

---

## Testing Strategy

### Stack

- **Backend:** Jest + fast-check 4.9.0 (ya en `devDependencies`)
- **Frontend:** Vitest + fast-check 4.9.0 (ya en `devDependencies`)

### Archivos de test nuevos

```
packages/backend/src/shared/__tests__/
  concurrency_limiter.property.test.ts   → Properties 1, 7, 8
  llm_retry.property.test.ts             → Properties 2, 3, 4

packages/backend/src/agents/analyzer/__tests__/
  haiku_parsing.property.test.ts         → Properties 5, 6

packages/frontend/src/services/__tests__/
  api_client.property.test.ts            → Property relacionada con timeout y retry count
```

### Unit tests (example-based)

Además de las properties, se cubren con tests de ejemplo:

- `parseConcurrency`: caso `undefined`, `"0"`, `"-1"`, `"abc"`, `""`, `"4"`, `"10"`
- `isTransientError`: caso no-Error (string, number, null), Error sin propiedades clave
- `parseHaikuClassification`: JSON inválido, fence vacío, objeto sin las claves requeridas
- `api_client`: un 500 se reintenta exactamente 1 vez; un ECONNABORTED no se reintenta

### Configuración de property tests

```typescript
// Mínimo 100 iteraciones por property (configurado vía numRuns en fast-check)
fc.assert(fc.property(...), { numRuns: 100 })
```

Cada test lleva un comentario con el tag:
```typescript
// Feature: bedrock-hardening, Property N: <texto de la property>
```

### Criterio de cobertura

- Cada uno de los 8 properties del diseño → 1 property test implementado
- Las funciones auxiliares exportadas (`parseConcurrency`, `parseHaikuClassification`) → cubiertos con unit tests de ejemplo
- `isTransientError` → cubierto por property + unit tests de ejemplo para el caso negativo
