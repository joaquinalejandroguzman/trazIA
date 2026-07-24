# Requirements Document

## Introduction

El endpoint `/api/analyze` actualmente genera specs EARS (vía Sonnet) para TODOS los módulos detectados durante el análisis, lo que hace que el pipeline tarde ~3 minutos. El diseño original del producto indica que la generación debe ser on-demand: el usuario clickea un nodo del grafo y la spec se genera en vivo solo para ese módulo.

Este feature mueve la generación de EARS del pipeline de análisis a un endpoint dedicado que se invoca por módulo individual cuando el usuario lo solicita. El resultado es un `/analyze` rápido (solo clasificación con Haiku) y generación de specs pesadas de a una, bajo demanda.

## Glossary

- **Analyze_Pipeline**: Pipeline de la ruta POST `/api/analyze` que clona un repositorio, clasifica módulos con Haiku, detecta integraciones y arma el grafo final
- **Generate_Spec_Endpoint**: Ruta POST `/api/generate-spec` que genera la spec EARS para un módulo individual usando Sonnet vía Bedrock
- **EARS_Writer**: Agente existente (`generateEarsSpec`) que invoca Claude Sonnet para generar una especificación EARS dado un nombre de módulo y su código fuente
- **Module_Panel**: Panel lateral del frontend que muestra detalles de un nodo seleccionado en el grafo interactivo
- **Frontend_Hook**: Hook `useAnalysis` que gestiona el estado del análisis y la generación on-demand de specs
- **Source_Content**: Contenido del archivo fuente de un módulo, truncado a 4000 caracteres, necesario como input para la generación EARS
- **Spec_Cache**: Estado local del frontend que almacena specs ya generadas para evitar llamadas redundantes al backend

## Requirements

### Requirement 1: Eliminar generación EARS del pipeline de análisis

**User Story:** As a developer, I want the analysis pipeline to skip EARS generation for all modules, so that the repository analysis completes in seconds instead of minutes.

#### Acceptance Criteria

1. WHEN a repository analysis is requested via POST `/api/analyze`, THE Analyze_Pipeline SHALL execute only: clone, classify with Haiku (analyzer), detect integrations, orchestrate, and respond — without invoking the EARS_Writer or any LLM call for EARS generation for any module
2. WHEN the Analyze_Pipeline completes successfully, THE Analyze_Pipeline SHALL return a response where each ModuleNode has the `earsSpec` field set to an empty string (`""`), while preserving the `specStatus` and `specHealthScore` values as classified by Haiku during the analysis step
3. WHEN the Analyze_Pipeline completes successfully, THE Analyze_Pipeline SHALL include the `sourceContent` field for each ModuleNode in the response payload, containing the file content truncated to a maximum of 4000 characters (files with fewer than 4000 characters are included in full)
4. WHEN the Analyze_Pipeline completes successfully for a repository, THE Analyze_Pipeline SHALL return the full response within 30 seconds of receiving the request (excluding network time for cloning the repository)

### Requirement 2: Implementar endpoint de generación on-demand

**User Story:** As a developer, I want a dedicated endpoint to generate the EARS spec for a single module, so that I can request specs individually without re-running the full analysis.

#### Acceptance Criteria

1. WHEN a POST request is received at `/api/generate-spec` with a JSON body containing non-empty string fields `moduleId`, `moduleName`, and `sourceContent` (where `sourceContent` is at most 100,000 characters), THE Generate_Spec_Endpoint SHALL invoke the existing `generateEarsSpec(moduleName, sourceContent)` function and return HTTP 200 with a JSON response containing `moduleId` (echoed from input) and `earsSpec` (the Markdown string returned by the function)
2. IF the request body is missing `moduleId`, `moduleName`, or `sourceContent`, or any of these fields is not a non-empty string, THEN THE Generate_Spec_Endpoint SHALL return HTTP 400 with a JSON body containing an `error` field indicating which fields failed validation
3. IF the string returned by `generateEarsSpec` starts with the error prefix `> ⚠️ Error`, THEN THE Generate_Spec_Endpoint SHALL return HTTP 502 with a JSON body containing an `error` field indicating the upstream generation failure and the error message from the returned Markdown
4. THE Generate_Spec_Endpoint SHALL reuse the existing `generateEarsSpec` function from the EARS_Writer agent without duplicating logic
5. IF `sourceContent` exceeds 100,000 characters, THEN THE Generate_Spec_Endpoint SHALL return HTTP 400 with a JSON body containing an `error` field indicating the content length limit was exceeded

### Requirement 3: Generación al clickear un módulo en el frontend

**User Story:** As a developer viewing the architecture graph, I want to click a module node and have its EARS spec generated on demand, so that I get detailed specs only for the modules I care about.

#### Acceptance Criteria

1. WHEN the Module_Panel opens for a module node whose `earsSpec` field is undefined or empty, THE Frontend_Hook SHALL automatically call POST `/api/generate-spec` with the module's `moduleId`, `moduleName`, and `sourceContent` without requiring additional user interaction
2. IF a spec generation request is already in progress for the selected module (generatingSpec equals the moduleId), THEN THE Frontend_Hook SHALL NOT send a duplicate request to the Generate_Spec_Endpoint
3. WHILE the Frontend_Hook is awaiting the response from the Generate_Spec_Endpoint, THE Module_Panel SHALL display a spinner indicator in the spec section within 100ms of the request being sent
4. IF the Generate_Spec_Endpoint does not respond within 30 seconds, THEN THE Module_Panel SHALL cancel the request and display an error message indicating a timeout occurred
5. WHEN the Generate_Spec_Endpoint responds with HTTP 200 and a valid `earsSpec` field, THE Module_Panel SHALL display the generated EARS spec content and store the `earsSpec` value in the module's local state without modifying the module's `specStatus`
6. IF the Generate_Spec_Endpoint responds with a non-200 status or a network error, THEN THE Module_Panel SHALL display the error message (truncated to 200 characters) in the spec section and preserve the module's current `specStatus` unchanged
7. IF the auto-trigger fails (502, timeout, or network error), THEN THE Frontend_Hook SHALL mark the module in an error state and SHALL NOT automatically retry generation for that module — only an explicit user action ("Reintentar" button) SHALL re-trigger the request
8. IF the module's `sourceContent` field is undefined or empty, THEN THE Frontend_Hook SHALL NOT trigger the generation request and THE Module_Panel SHALL display an informational message indicating that no source code is available to generate the spec
9. THE auto-trigger SHALL fire at most once per module selection (keyed to the selectedNode id), NOT on every React re-render
10. THE call to POST `/api/generate-spec` SHALL NOT be subject to the automatic retry logic of the HTTP client (api_client interceptor) — a 502 response SHALL NOT be retried at the HTTP layer since `generateEarsSpec` already retried internally via `withLlmRetry`

### Requirement 4: Cache de specs generadas en el frontend

**User Story:** As a developer navigating the graph, I want previously generated specs to be cached locally, so that clicking the same module again shows the spec instantly without regeneration.

#### Acceptance Criteria

1. WHEN a spec is successfully generated for a module, THE Frontend_Hook SHALL update that module's `earsSpec` field in the local `AnalysisResult` state, keyed by the module's `id`, without modifying `specStatus` (which remains as classified by Haiku)
2. WHEN a user clicks a module whose `earsSpec` field is a non-empty string, THE Frontend_Hook SHALL render the cached spec within 100ms without issuing any HTTP request to Generate_Spec_Endpoint
3. THE Spec_Cache SHALL persist in the `AnalysisResult` state until one of the following invalidation events occurs: the user calls `analyzeRepo` with a new repository URL, the user calls `reset`, or the browser page is reloaded
4. IF a user explicitly triggers spec regeneration on a module that already has a non-empty `earsSpec` (via a "Regenerar" action), THEN THE Frontend_Hook SHALL issue a new request to Generate_Spec_Endpoint and overwrite the existing cached `earsSpec` with the fresh response

### Requirement 5: Compatibilidad con el spec bedrock-hardening

**User Story:** As a developer, I want the on-demand generation to benefit from the same retry/resilience patterns applied to Haiku in the analysis pipeline, so that transient Bedrock errors are handled gracefully.

#### Acceptance Criteria

1. THE Generate_Spec_Endpoint SHALL invoke `generateEarsSpec` directly without wrapping the call in an additional `withLlmRetry` or any other retry mechanism, so that the retry behavior is exclusively the one already encapsulated inside `generateEarsSpec` (exponential backoff via `withLlmRetry`)
2. WHEN `generateEarsSpec` returns a string that begins with `> ⚠️` (indicating all retries were exhausted or a non-transient error occurred), THE Generate_Spec_Endpoint SHALL respond with HTTP 502 and a JSON body containing an `error` field with the failure message
3. WHEN `generateEarsSpec` returns a string that does not begin with `> ⚠️`, THE Generate_Spec_Endpoint SHALL respond with HTTP 200 and a JSON body containing `moduleId` and `earsSpec` with the generated Markdown content
