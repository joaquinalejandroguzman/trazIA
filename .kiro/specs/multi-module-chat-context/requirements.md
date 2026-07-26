# Requirements Document

## Introduction

El chat contextual de TrazIA actualmente solo incluye el código fuente (sourceContent) de un único módulo en el contexto enviado al LLM. Cuando el usuario pregunta por el repositorio en general o menciona múltiples módulos, el LLM solo recibe metadatos sin código y responde con "no tengo suficiente información". Esta feature extiende el sistema de contexto para soportar múltiples módulos simultáneamente y detectar preguntas generales sobre el repositorio, incluyendo snippets de código de todos los módulos relevantes.

## Glossary

- **Context_Builder**: Módulo backend (`context_builder.ts`) responsable de construir el contexto textual del repositorio que se envía al LLM, incluyendo metadatos de módulos y código fuente
- **Chat_Route**: Endpoint POST `/api/chat` que orquesta la clasificación de intención, construcción de contexto e invocación al LLM
- **Prompt_Module**: Módulo backend (`prompt.ts`) que contiene el system prompt y respuestas fijas del chat
- **Chat_Panel**: Componente React del frontend que muestra la interfaz de chat flotante con mensajes, input y estado de carga
- **UseChat_Hook**: Hook React (`use_chat.ts`) que gestiona el estado del chat y la comunicación con el backend
- **ModuleNode**: Interfaz TypeScript que representa un módulo del repositorio con sus metadatos, dependencias y código fuente opcional
- **sourceContent**: Campo opcional de ModuleNode que contiene el código fuente truncado del módulo (máx 4000 chars)
- **focusModules**: Array de ModuleNode cuyos snippets de código se incluyen en el contexto del LLM
- **Pregunta_General**: Mensaje del usuario que se refiere al repositorio en su totalidad sin mencionar módulos específicos por nombre

## Requirements

### Requirement 1: Detección de múltiples módulos mencionados

**User Story:** As a developer using TrazIA chat, I want the system to detect all modules I mention in my message, so that I receive context-aware responses about multiple modules simultaneously.

#### Acceptance Criteria

1. WHEN the user sends a message mentioning one or more module names, THE Context_Builder SHALL return an array containing all ModuleNode objects whose name field matches as a case-insensitive substring within the message, with each module appearing at most once in the result
2. WHEN the user sends a message mentioning one or more module path segments, THE Context_Builder SHALL return an array containing all ModuleNode objects whose last path segment (the portion after the final "/" separator in the path field) matches as a case-insensitive substring within the message, with each module appearing at most once in the result
3. WHEN the user sends a message that does not mention any module name or path segment, THE Context_Builder SHALL return an empty array
4. THE Context_Builder SHALL use substring matching (includes) without word boundaries for module name and path segment detection, preserving compatibility with the existing matching behavior
5. WHEN the user sends a message mentioning multiple modules, THE Context_Builder SHALL return matching ModuleNode objects in the same order they appear in the input modules array
6. IF a module matches both by name and by last path segment within the same message, THEN THE Context_Builder SHALL include that module only once in the returned array

### Requirement 2: Detección de pregunta general del repositorio

**User Story:** As a developer using TrazIA chat, I want the system to recognize when I'm asking about the repository in general, so that it provides a comprehensive overview with code from all modules.

#### Acceptance Criteria

1. WHEN the user sends a message that contains at least one of the keywords "repo", "repositorio", "proyecto", "app", "aplicación", "código", "código fuente", or "general" as a substring (case-insensitive) AND the mentionedModules array is empty, THE Context_Builder SHALL return true indicating a general repository question
2. WHEN the user sends a message where the mentionedModules array contains at least one ModuleNode, THE Context_Builder SHALL return false, regardless of whether the message also contains general keywords
3. WHEN the user sends a message that does not contain any of the defined general keywords as a substring (case-insensitive) AND the mentionedModules array is empty, THE Context_Builder SHALL return false
4. IF the message is an empty string or contains only whitespace, THEN THE Context_Builder SHALL return false
5. WHEN the user sends a message containing a multi-word keyword such as "código fuente", THE Context_Builder SHALL detect it by substring match against the lowercased message, matching the full multi-word phrase as a contiguous sequence

### Requirement 3: Construcción de contexto multi-module

**User Story:** As a developer using TrazIA chat, I want code snippets from multiple modules included in the LLM context, so that the LLM can provide informed answers about more than one module at a time.

#### Acceptance Criteria

1. WHEN focusModules contains between 1 and 4 elements, THE Context_Builder SHALL include a sourceContent snippet truncated to 500 characters for each module in focusModules, wrapped in delimiters "--- Código fuente ({module_name}) ---" and "--- Fin código fuente ---"
2. WHEN focusModules contains 5 or more elements, THE Context_Builder SHALL include a sourceContent snippet truncated to 300 characters for each module in focusModules, wrapped in the same delimiters
3. WHEN focusModules contains exactly 1 element, THE Context_Builder SHALL include its sourceContent snippet truncated to 500 characters, maintaining equivalent behavior to the previous single-module implementation
4. WHEN a module in focusModules has no sourceContent (undefined or empty string), THE Context_Builder SHALL omit the code snippet section for that module
5. WHEN focusModules is undefined or an empty array, THE Context_Builder SHALL not include any code snippet sections in the context output
6. THE Context_Builder SHALL apply character-based truncation (not line-based) to sourceContent, slicing at the character limit without concern for line boundaries

### Requirement 4: Orquestación de detección y contexto en la ruta de chat

**User Story:** As a developer using TrazIA chat, I want the endpoint to orchestrate multi-module detection and general question recognition, so that the correct context is assembled for the LLM.

#### Acceptance Criteria

1. WHEN the message is classified as a general repository question by isGeneralRepoQuestion, THE Chat_Route SHALL pass all available modules from the request body as focusModules to the context builder, taking priority over any result from detectMentionedModules
2. WHEN detectMentionedModules returns 2 or more modules AND the message is not classified as a general repository question, THE Chat_Route SHALL pass those detected modules as focusModules to the context builder
3. WHEN detectMentionedModules returns exactly 1 module AND the message is not classified as a general repository question, THE Chat_Route SHALL pass that single module as focusModules to the context builder
4. WHEN detectMentionedModules returns 0 modules AND the message is not classified as a general repository question, THE Chat_Route SHALL invoke the context builder without focusModules, preserving the current fallback behavior
5. THE Chat_Route SHALL include an analyzingModules field in the ChatResponse JSON as an array of strings containing the name property of each module passed as focusModules
6. WHEN no focusModules are passed to the context builder, THE Chat_Route SHALL set the analyzingModules field in the ChatResponse to an empty array
7. THE Chat_Route SHALL evaluate orchestration priority in the following order: general repository question first, then multi-module detection (2 or more), then single module detection (exactly 1), then no-focus fallback — selecting the first matching condition

### Requirement 5: System prompt addendum para preguntas generales

**User Story:** As a developer using TrazIA chat, I want the LLM to provide structured repository overviews when I ask general questions, so that I get a useful summary of all modules.

#### Acceptance Criteria

1. WHEN the message is classified as a general repository question, THE Chat_Route SHALL append the value of GENERAL_REPO_ADDENDUM to the system prompt after the existing CHAT_SYSTEM_PROMPT content, separated by a newline character
2. THE Prompt_Module (prompt.ts) SHALL export a string constant named GENERAL_REPO_ADDENDUM with the exact text: "El usuario está preguntando sobre el repositorio en general. Arrancá tu respuesta con 'Voy a analizar todos los módulos del repositorio:' y hacé un resumen de qué hace cada uno, basándote en el código fuente proporcionado."
3. WHEN the message is NOT classified as a general repository question, THE Chat_Route SHALL NOT append the GENERAL_REPO_ADDENDUM to the system prompt
4. IF the intent is classified as 'saludo', 'jailbreak', or 'offtopic', THEN THE Chat_Route SHALL NOT append the GENERAL_REPO_ADDENDUM to the system prompt, and SHALL return the corresponding fixed reply without invoking the LLM

### Requirement 6: Frontend — tipo ChatResponse actualizado

**User Story:** As a frontend developer, I want the ChatResponse type to include the analyzing modules information, so that the UI can display which modules are being analyzed.

#### Acceptance Criteria

1. THE ChatResponse interface SHALL include an optional field `analyzingModules` of type `string[]` (array of module name strings)
2. THE UseChatReturn interface SHALL include a field `analyzingModules` of type `string[] | null`
3. WHEN the useChat hook initializes, THE useChat hook SHALL expose `analyzingModules` as `null`
4. WHEN the backend response contains an `analyzingModules` field with 1 or more elements, THE useChat hook SHALL set `analyzingModules` to that array in its return value
5. WHEN the backend response does not contain `analyzingModules` or it is an empty array, THE useChat hook SHALL expose `null` as the `analyzingModules` value
6. WHEN the assistant message is added to the messages array, THE useChat hook SHALL reset `analyzingModules` to `null`

### Requirement 7: Frontend — indicador de carga contextual

**User Story:** As a user of TrazIA chat, I want the loading indicator to show how many modules are being analyzed, so that I have visibility into what the system is doing.

#### Acceptance Criteria

1. WHILE the chat is loading AND analyzingModules is a non-empty array, THE Chat_Panel SHALL display the spinner with the static text "Analizando (1/{X})..." where X equals the length of the analyzingModules array and the "1" remains fixed without incrementing during the request lifecycle
2. WHILE the chat is loading AND analyzingModules is null or an empty array, THE Chat_Panel SHALL display the spinner with the text "Pensando..."
3. WHEN the assistant response is received and added to messages, THE UseChat_Hook SHALL set analyzingModules to null and set isLoading to false
4. WHEN the backend response includes an analyzingModules field with a non-empty array, THE UseChat_Hook SHALL set the analyzingModules state to that array before the assistant message is added, so that the spinner text transitions from "Pensando..." to "Analizando (1/{X})..."
5. WHILE the loading indicator is visible, THE Chat_Panel SHALL set aria-live="polite" on the loading container so that screen readers announce changes to the loading text
