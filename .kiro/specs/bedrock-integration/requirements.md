# Requirements Document

## Introduction

Este documento describe los requisitos para integrar AWS Bedrock como motor de IA real en el backend de TrazIA. El sistema actual realiza análisis completamente estático (regex). Con esta integración, el pipeline de agentes pasará a usar modelos de lenguaje (Claude Haiku para clasificación de módulos y Claude Sonnet para generación de specs EARS) vía el cliente `AnthropicBedrock` del SDK `@anthropic-ai/bedrock-sdk`, desplegado en la región `sa-east-1`.

El pipeline resultante es:

```
POST /api/analyze
  → clona repo (git_cloner)
  → lee código fuente de módulos (antes del cleanup)
  → analyzer (Haiku: clasifica módulos, score real)
  → integrations (sin cambios)
  → ears_writer (Sonnet: genera specs EARS por módulo)
  → orchestrator (projectHealthScore real)
  → limpia repo clonado
  → response
```

## Glossary

- **Bedrock_Client**: Instancia de `AnthropicBedrock` del paquete `@anthropic-ai/bedrock-sdk`, configurada para `sa-east-1`. Única instancia compartida en el proceso.
- **Haiku**: Modelo `global.anthropic.claude-haiku-4-5-20251001-v1:0` en AWS Bedrock. Usado por el Analyzer para clasificación rápida y scoring.
- **Sonnet**: Modelo `global.anthropic.claude-sonnet-4-6` en AWS Bedrock. Usado por el EARS Writer para generación de specs.
- **EARS_Writer**: Agente que recibe el código fuente de un módulo y produce una spec en sintaxis EARS como Markdown.
- **Analyzer**: Agente que clasifica módulos como `traced`, `drift` o `untraced` y asigna un `specHealthScore` (0–100) real usando Haiku.
- **Orchestrator**: Agente que combina módulos e integraciones en el grafo final, calculando el `projectHealthScore` real a partir de los scores individuales.
- **SpecStatus**: Valor discriminado: `traced` (el módulo tiene spec actualizada), `drift` (spec existe pero está desincronizada del código), `untraced` (no hay spec).
- **specHealthScore**: Entero de 0 a 100 que representa la cobertura y calidad de la spec de un módulo. Campo obligatorio en `ModuleNode` (definido en `src/shared/types.ts`).
- **projectHealthScore**: Entero de 0 a 100 que representa la salud general del proyecto, calculado como promedio aritmético de los `specHealthScore` individuales. Campo obligatorio en `AnalysisResult` (definido en `src/shared/types.ts`).
- **Retry_Backoff**: Mecanismo que reintenta una llamada al LLM un máximo de `MAX_LLM_RETRIES` veces con espera exponencial ante errores transitorios de Bedrock (mensajes que contienen "Try your request again" o errores de tipo `ThrottlingException`).

---

## Requirements

### Requirement 1: Cliente Bedrock compartido

**User Story:** Como desarrollador, quiero un único cliente Bedrock correctamente configurado y exportado desde un módulo central, para que todos los agentes compartan la misma instancia sin duplicar configuración.

#### Acceptance Criteria

1. THE Bedrock_Client SHALL instanciarse como `AnthropicBedrock` (no `AnthropicBedrockMantle`) del paquete `@anthropic-ai/bedrock-sdk`.
2. WHEN el módulo `bedrock_client.ts` se carga, IF la variable de entorno `BEDROCK_REGION` no está definida, THEN THE Bedrock_Client SHALL lanzar un error sincrónico de configuración con el mensaje que indica exactamente qué variable falta, antes de exportar cualquier instancia.
3. WHEN el módulo `bedrock_client.ts` se carga, IF la variable de entorno `BEDROCK_MODEL_ANALYZER` no está definida, THEN THE Bedrock_Client SHALL lanzar un error sincrónico de configuración con el mensaje que indica exactamente qué variable falta, antes de exportar cualquier instancia.
4. WHEN el módulo `bedrock_client.ts` se carga, IF la variable de entorno `BEDROCK_MODEL_EARS` no está definida, THEN THE Bedrock_Client SHALL lanzar un error sincrónico de configuración con el mensaje que indica exactamente qué variable falta, antes de exportar cualquier instancia.
5. THE Bedrock_Client SHALL exportarse como instancia única desde `packages/backend/src/clients/bedrock_client.ts` para ser importado por los agentes que lo requieran.
6. THE Bedrock_Client SHALL usar las credenciales AWS del perfil `trazia-backend` configurado en `~/.aws/credentials`, sin que las credenciales aparezcan en ningún archivo de código fuente o variable de entorno del repositorio.

---

### Requirement 2: Retry con backoff en llamadas al LLM

**User Story:** Como operador del sistema, quiero que todas las llamadas al LLM reintenten automáticamente ante errores transitorios de cold start, para que los usuarios no vean fallos aleatorios al invocar el servicio por primera vez.

#### Acceptance Criteria

1. IF una llamada al LLM produce un error cuyo mensaje contiene "Try your request again" o cuyo tipo es `ThrottlingException`, THEN THE Retry_Backoff SHALL clasificarlo como error transitorio y ejecutar el ciclo de reintentos.
2. THE Retry_Backoff SHALL leer el número máximo de reintentos desde la variable de entorno `MAX_LLM_RETRIES` (entero entre 1 y 10); WHEN la variable no está definida o su valor es inválido, THE Retry_Backoff SHALL usar el valor por defecto `3`.
3. WHEN el intento N falla con un error transitorio, THE Retry_Backoff SHALL esperar `min(MAX_RETRY_DELAY_MS, max(1000, BASE_RETRY_DELAY_MS * 2^(N-1)))` milisegundos antes del siguiente intento, donde `BASE_RETRY_DELAY_MS` por defecto es `1000` ms y `MAX_RETRY_DELAY_MS` por defecto es `30000` ms.
4. IF todos los intentos fallaron con error transitorio, THEN THE Retry_Backoff SHALL loggear las estadísticas del ciclo de reintentos (`{ intentos, últimoError, tiempoTotalMs }`) y propagar el error original envuelto con ese contexto para que el llamador lo maneje.
5. IF el error producido por una llamada al LLM no es transitorio, THEN THE Retry_Backoff SHALL propagarlo inmediatamente sin reintentar.
6. THE Retry_Backoff SHALL implementarse como función utilitaria reutilizable en `packages/backend/src/shared/llm_retry.ts` usable por cualquier agente.

---

### Requirement 3: Clasificación de módulos con Haiku (Analyzer)

**User Story:** Como usuario de TrazIA, quiero que cada módulo del repositorio tenga un `specHealthScore` real y un `specStatus` clasificado por IA, para que el grafo refleje el estado de documentación real del proyecto y no valores hardcodeados.

#### Acceptance Criteria

1. WHEN el Analyzer procesa un módulo cuyo archivo está incluido en los resultados del file scanner (no binario, no excluido), THE Analyzer SHALL invocar Haiku para clasificar el módulo como `traced`, `drift` o `untraced` y asignar un `specHealthScore` entre 0 y 100.
2. THE Analyzer SHALL leer el contenido de cada archivo mientras el directorio clonado aún existe en disco, antes de que sea eliminado.
3. WHEN Haiku retorna una clasificación, THE Analyzer SHALL parsear la respuesta como JSON con los campos `specStatus: 'traced' | 'drift' | 'untraced'` y `specHealthScore: number`; WHEN el valor de `specHealthScore` está fuera del rango [0, 100], THE Analyzer SHALL clamparlo al límite más cercano.
4. IF la respuesta de Haiku no es JSON válido o no contiene los campos esperados, THEN THE Analyzer SHALL asignar `specStatus: 'untraced'` y `specHealthScore: 0` al módulo afectado sin interrumpir el análisis del resto de módulos.
5. IF la llamada a Haiku falla después de 3 intentos con backoff exponencial, THEN THE Analyzer SHALL asignar `specStatus: 'untraced'` y `specHealthScore: 0` al módulo afectado sin interrumpir el análisis del resto de módulos.
6. WHEN el contenido de un archivo supera los 4000 caracteres, THE Analyzer SHALL truncar el contenido a los primeros 4000 caracteres antes de enviarlo a Haiku; WHEN el contenido tiene 4000 caracteres o menos, THE Analyzer SHALL enviarlo en su totalidad.
7. THE Analyzer SHALL enviar todas las solicitudes de clasificación a Haiku de forma simultánea y esperar colectivamente sus resultados, para que la latencia total sea proporcional al módulo más lento y no a la suma de todos.

---

### Requirement 4: Generación de specs EARS con Sonnet (EARS Writer)

**User Story:** Como desarrollador, quiero que TrazIA genere automáticamente una spec en formato EARS para cada módulo del repositorio analizado, para obtener un punto de partida concreto de documentación sin tener que escribirla manualmente.

#### Acceptance Criteria

1. WHEN el EARS_Writer recibe el código fuente de un módulo, THE EARS_Writer SHALL invocar Sonnet para generar una spec en sintaxis EARS.
2. THE EARS_Writer SHALL retornar la spec como string en formato Markdown, con un encabezado `# Requirements: <nombre del módulo>` seguido de los requisitos en sintaxis EARS, lista para guardarse como `requirements.md`.
3. THE EARS_Writer SHALL incluir en el prompt a Sonnet instrucciones explícitas para usar los patrones EARS: `WHEN <trigger> THE SYSTEM SHALL <response>`, `WHILE <condition> THE SYSTEM SHALL <response>`, `IF <condition> THEN THE SYSTEM SHALL <response>`.
4. IF la llamada a Sonnet falla después de agotar los reintentos, THEN THE EARS_Writer SHALL retornar un string Markdown con el mensaje `> ⚠️ Error al generar la spec: <mensaje del error>` sin lanzar excepción.
5. THE EARS_Writer SHALL exponerse como función exportada desde `packages/backend/src/agents/ears_writer/ears_writer.ts`.
6. THE EARS_Writer SHALL recibir el contenido del módulo como parámetro string (ya leído antes del cleanup), no leer el archivo directamente.

---

### Requirement 5: Cálculo real de projectHealthScore (Orchestrator)

**User Story:** Como usuario de TrazIA, quiero que el `projectHealthScore` del resultado refleje el promedio real de los scores de los módulos, para que la métrica de salud del proyecto sea significativa y no un valor constante.

#### Acceptance Criteria

1. WHEN el Orchestrator construye el `AnalysisResult`, THE Orchestrator SHALL calcular el `projectHealthScore` como el promedio aritmético de los valores `specHealthScore` de todos los módulos (incluyendo aquellos con `specHealthScore: 0`), considerando que `specHealthScore` es un campo obligatorio en `ModuleNode`.
2. IF la lista de módulos está vacía, THEN THE Orchestrator SHALL asignar `projectHealthScore: 0`.
3. THE Orchestrator SHALL incluir el `projectHealthScore` en el `AnalysisResult` retornado al cliente como campo de tipo `number` con valor en el rango [0, 100].
4. THE Orchestrator SHALL redondear el `projectHealthScore` al entero más cercano usando la regla de redondeo estándar (0.5 se redondea hacia arriba) antes de incluirlo en la respuesta.

---

### Requirement 6: Variables de entorno y configuración

**User Story:** Como operador del sistema, quiero que todos los IDs de modelos, la región y los parámetros de retry se configuren mediante variables de entorno, para poder desplegar en distintos entornos sin modificar el código.

#### Acceptance Criteria

1. WHEN el sistema inicia, IF alguna de las variables de entorno `BEDROCK_REGION`, `BEDROCK_MODEL_ANALYZER` o `BEDROCK_MODEL_EARS` no está definida, THEN THE System SHALL registrar un error que indique exactamente qué variable falta y detenerse sin completar el inicio.
2. WHEN el sistema inicia, IF el valor de `MAX_LLM_RETRIES` o `BASE_RETRY_DELAY_MS` no es un entero positivo válido, THEN THE System SHALL registrar un error descriptivo y detenerse; WHEN las variables no están definidas, THE System SHALL usar los valores por defecto `3` y `1000` respectivamente.
3. THE System SHALL incluir en `packages/backend/.env.example` una entrada por cada variable de entorno reconocida por el sistema, con un comentario de una línea que explique su propósito y un valor de ejemplo no funcional (que no sea una credencial real).
4. THE System SHALL garantizar que ningún archivo rastreado por git contenga credenciales AWS, IDs de modelos reales ni valores secretos.

---

### Requirement 7: Manejo de errores y resiliencia

**User Story:** Como usuario de TrazIA, quiero que un fallo del LLM en un módulo no interrumpa el análisis completo del repositorio, para recibir siempre un grafo parcialmente útil aunque la IA no esté disponible.

#### Acceptance Criteria

1. IF la llamada al LLM para un módulo específico falla de forma permanente (tras agotar reintentos), THEN THE Analyzer SHALL continuar con el resto de módulos y registrar el error con el contexto `{ agente, módulo, error }`.
2. IF el Bedrock_Client no puede inicializarse (variables de entorno faltantes o credenciales inválidas), THEN THE System SHALL retornar un error HTTP 503 con un cuerpo JSON `{ "error": "<mensaje descriptivo>" }` al cliente en lugar de un crash no manejado.
3. WHILE el análisis de un repositorio está en progreso, THE System SHALL loggear el estado de cada llamada al LLM con el contexto `{ agente, módulo, intento, error }` para facilitar el debugging en CloudWatch.
