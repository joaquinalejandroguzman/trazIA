# Requirements Document

## Introduction

El pipeline LLM de `/api/analyze` debe operar de forma robusta sobre repositorios reales con decenas de módulos. Hoy, el uso de `Promise.all` sin límite en `analyzer.ts` y `ears_writer.ts` dispara decenas de llamadas concurrentes a AWS Bedrock, lo que provoca throttling y timeouts. Además, la detección de errores transitorios es parcial, el parseo del JSON de respuesta de Haiku es frágil, y el timeout del frontend (60 s) es insuficiente para repos medianos.

Este spec cubre cuatro mejoras de hardening: limitador de concurrencia configurable, detección ampliada de errores transitorios, parseo robusto del JSON de Haiku, y ajuste del timeout del frontend.

## Glossary

- **Concurrency_Limiter**: helper que controla cuántas promesas se ejecutan en simultáneo, aplicado a los fan-outs de Bedrock.
- **Fan-out**: patrón donde se lanzan múltiples llamadas LLM en paralelo (una por módulo).
- **isTransientError**: función en `llm_retry.ts` que determina si un error debe reintentarse.
- **Haiku**: alias de `classifyModuleWithHaiku` — llama a `claude-haiku` para clasificar un módulo.
- **JSON_Fence**: bloque de código Markdown (\`\`\`json ... \`\`\`) que Haiku puede incluir alrededor del JSON en su respuesta.
- **MAX_LLM_CONCURRENCY**: variable de entorno que controla el máximo de llamadas Bedrock simultáneas. Default: 4.
- **Pipeline**: secuencia completa de agentes (Analyzer → EARS Writer → Orchestrator) disparada por `/api/analyze`.
- **REQUEST_TIMEOUT_MS**: constante del frontend que define el timeout de peticiones HTTP al backend.
- **ThrottlingException**: error de AWS Bedrock cuando se supera el límite de solicitudes por segundo.

## Requirements

### Requirement 1: Límite de concurrencia en fan-outs de Bedrock

**User Story:** Como operador de TrazIA, quiero que las llamadas a Bedrock se ejecuten con un límite de concurrencia configurable, para que el pipeline no provoque throttling ni timeout al analizar repositorios con decenas de módulos.

#### Acceptance Criteria

1. THE Concurrency_Limiter SHALL leer el valor máximo de concurrencia desde la variable de entorno `MAX_LLM_CONCURRENCY` al inicializarse, y exponerlo como constante nombrada `MAX_CONCURRENCY` dentro del módulo del helper.
2. IF `MAX_LLM_CONCURRENCY` no está definida, o su valor no es un entero positivo (incluyendo valores como `"0"`, `"-1"`, `"abc"` o `""`), THEN THE Concurrency_Limiter SHALL usar 4 como valor por defecto.
3. WHEN el Agente Analyzer ejecuta el fan-out de clasificación con Haiku, THE Concurrency_Limiter SHALL garantizar que no más de `MAX_CONCURRENCY` llamadas a Bedrock estén activas simultáneamente.
4. WHEN el Agente EARS_Writer ejecuta el fan-out de generación de specs, THE Concurrency_Limiter SHALL garantizar que no más de `MAX_CONCURRENCY` llamadas a Bedrock estén activas simultáneamente.
5. THE Concurrency_Limiter SHALL preservar el orden de los resultados respecto al orden de entrada de los módulos, de modo que `results[i]` corresponda siempre a `modules[i]`.
6. IF la llamada a Bedrock o el procesamiento de la respuesta de un módulo lanza un error, THEN THE Concurrency_Limiter SHALL continuar procesando los módulos restantes, y el resultado correspondiente al módulo fallido SHALL reflejar el error o los valores por defecto de ese módulo, de modo que la longitud del array de resultados siempre sea igual a la longitud del array de entrada.

---

### Requirement 2: Detección ampliada de errores transitorios

**User Story:** Como operador de TrazIA, quiero que el mecanismo de retry detecte un conjunto más amplio de errores transitorios de Bedrock y de red, para que el pipeline se recupere automáticamente sin propagar fallos evitables.

#### Acceptance Criteria

1. WHEN `isTransientError` recibe un objeto error con la propiedad `status` igual a 500, 502, 503, 504 o 529, THE `isTransientError` SHALL retornar `true`.
2. WHEN `isTransientError` recibe un objeto error cuya propiedad `message` incluye la subcadena `'Try your request again'`, THE `isTransientError` SHALL retornar `true`.
3. WHEN `isTransientError` recibe un objeto error cuya propiedad `constructor.name` es `'ThrottlingException'` o cuya propiedad `status` es `429`, THE `isTransientError` SHALL retornar `true`.
4. WHEN `isTransientError` recibe un objeto error cuya propiedad `code` es `'ECONNRESET'`, `'ECONNREFUSED'`, `'ETIMEDOUT'`, `'ENOTFOUND'` o `'EPIPE'`, THE `isTransientError` SHALL retornar `true`.
5. WHEN `isTransientError` recibe un objeto error cuya propiedad `message` incluye la subcadena `'socket hang up'` o `'connect ETIMEDOUT'`, THE `isTransientError` SHALL retornar `true`.
6. IF el valor recibido por `isTransientError` no es una instancia de `Error`, o es una instancia de `Error` que no satisface ninguna de las condiciones de los criterios 1 al 5, THEN `isTransientError` SHALL retornar `false`.

---

### Requirement 3: Parseo robusto del JSON de respuesta de Haiku

**User Story:** Como desarrollador de TrazIA, quiero que `classifyModuleWithHaiku` extraiga el JSON válido de la respuesta de Haiku incluso cuando venga envuelto en fences Markdown o acompañado de prosa, para evitar clasificaciones silenciosamente incorrectas.

#### Acceptance Criteria

1. WHEN la respuesta de Haiku contiene un bloque JSON envuelto en fences Markdown (\`\`\`json ... \`\`\` o \`\`\` ... \`\`\`), THE `classifyModuleWithHaiku` SHALL extraer el texto interior del primer fence encontrado y usarlo como input del paso de parseo, descartando los delimitadores del fence.
2. WHEN la respuesta de Haiku contiene prosa antes o después del JSON, THE `classifyModuleWithHaiku` SHALL localizar el primer substring que comienza con `{` y termina con el `}` de cierre correspondiente, y usarlo como input del paso de parseo.
3. WHEN el texto resultante del paso de extracción es sintácticamente parseable como JSON y contiene la clave `specStatus` de tipo string y la clave `specHealthScore` de tipo number, THE `classifyModuleWithHaiku` SHALL retornar el objeto parseado para su validación posterior, sin aplicar validaciones de coherencia semántica entre ambos campos.
4. IF el texto de la respuesta de Haiku no contiene ningún bloque JSON sintácticamente parseable tras aplicar los pasos de extracción, o si el JSON parseado carece de las claves `specStatus` o `specHealthScore` con los tipos correctos (string y number respectivamente), THEN THE `classifyModuleWithHaiku` SHALL retornar `{ specStatus: 'untraced', specHealthScore: 0 }` sin lanzar excepción.
5. IF el valor de `specStatus` extraído del JSON no es exactamente `'traced'`, `'drift'` ni `'untraced'`, THEN THE `classifyModuleWithHaiku` SHALL sustituirlo por `'untraced'` antes de retornar el resultado. Un `specStatus` de `'traced'` con `specHealthScore` 0 es válido y SHALL ser retornado sin modificación.
6. IF el valor de `specHealthScore` extraído del JSON es un número menor que 0, THEN THE `classifyModuleWithHaiku` SHALL retornar 0. IF el valor es mayor que 100, THEN THE `classifyModuleWithHaiku` SHALL retornar 100. Valores decimales dentro del rango [0, 100] son aceptados sin redondeo.

---

### Requirement 4: Timeout del frontend ajustado para repos medianos

**User Story:** Como usuario de TrazIA, quiero que el cliente HTTP del frontend espere al menos 3 minutos antes de declarar timeout, para que el análisis de repositorios medianos complete sin interrupciones prematuras.

#### Acceptance Criteria

1. THE `api_client` SHALL definir `REQUEST_TIMEOUT_MS` con el valor literal `180_000` (180 000 ms, 3 minutos), configurable únicamente modificando esa constante en `api_client.ts`.
2. WHEN axios detecta que una petición superó `REQUEST_TIMEOUT_MS` sin recibir respuesta, el interceptor de respuesta SHALL identificar el error por `error.code === 'ECONNABORTED'`, omitir el mecanismo de retry, y rechazar la promesa con un `Error` cuyo `message` sea exactamente `'La operación tardó demasiado. Intentá con un repositorio más chico o volvé a intentar.'`.
3. WHEN el servidor responde con un status 5xx distinto de timeout, o cuando la red falla sin respuesta del servidor, THE `api_client` SHALL aplicar el mecanismo de retry existente (máximo 1 reintento con 2 000 ms de espera) sin modificaciones al comportamiento actual para esos casos.
4. IF la petición de retry también falla (ya sea por timeout, error 5xx u otro error elegible), THEN THE `api_client` SHALL rechazar la promesa con el mensaje de error legible correspondiente al tipo de fallo del segundo intento, sin realizar un tercer intento.
5. THE `api_client` SHALL liberar la conexión HTTP subyacente al abortar por timeout, de modo que no queden sockets pendientes en el event loop de Node.js o en el navegador.

---

### Requirement 5: Correctness properties — tests con fast-check

**User Story:** Como desarrollador de TrazIA, quiero property tests que verifiquen las invariantes de hardening, para detectar regresiones automáticamente en CI.

#### Acceptance Criteria

1. THE Test_Suite SHALL incluir una property con fast-check que, para `attempt` ∈ [1, 20], `baseDelayMs` ∈ [1, 60 000] y `maxDelayMs` ∈ [1 000, 60 000], verifique que `calculateBackoffDelay(attempt, baseDelayMs, maxDelayMs)` retorna un valor en el rango `[Math.min(1000, baseDelayMs), maxDelayMs]`.
2. THE Test_Suite SHALL incluir una property con fast-check que, para `baseDelayMs` ∈ [1, 60 000] y `maxDelayMs` ∈ [1 000, 60 000] fijos, verifique que `calculateBackoffDelay(n+1, baseDelayMs, maxDelayMs) >= calculateBackoffDelay(n, baseDelayMs, maxDelayMs)` para cualquier `n` ∈ [1, 19].
3. THE Test_Suite SHALL incluir una property con fast-check que verifique que `isTransientError` retorna `true` para cualquier instancia de `Error` construida con `status` muestreado aleatoriamente del conjunto `{429, 500, 502, 503, 504, 529}`.
4. WHEN fast-check genera una cadena de texto combinando prosa aleatoria, fences Markdown opcionales y un objeto JSON válido con `specStatus` y `specHealthScore`, THE Test_Suite SHALL verificar que `classifyModuleWithHaiku` extrae y retorna los valores correctos de `specStatus` y `specHealthScore` de ese objeto JSON embebido.
5. THE Test_Suite SHALL incluir una property con fast-check que, para cualquier número entero `n` muestreado del rango [-1 000, 1 000], verifique que el `specHealthScore` retornado por `classifyModuleWithHaiku` al recibir una respuesta de Haiku con `specHealthScore: n` está clampeado al rango `[0, 100]`.
6. THE Test_Suite SHALL incluir una property con fast-check que, para cualquier lista de N módulos con N > `MAX_CONCURRENCY`, verifique que el Concurrency_Limiter nunca tiene más de `MAX_CONCURRENCY` llamadas activas simultáneamente, medido como el máximo de un contador de inflight incrementado al inicio y decrementado al final de cada llamada simulada.
