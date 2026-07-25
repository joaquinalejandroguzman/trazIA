# Implementation Plan: Chat Contextual TrazIA

## Overview

Implementación de un chat contextual que permite al usuario hacer preguntas sobre la arquitectura del repositorio analizado. El sistema clasifica la intención del mensaje (saludo, jailbreak, offtopic, pregunta sobre el repo), construye contexto a partir de los módulos del grafo, invoca al LLM con historial de conversación, y presenta las respuestas en un panel flotante en el frontend.

## Tasks

- [x] 1. Crear el router de intención
  - [x] 1.1 Implementar módulo de clasificación de intención
    - Crear `packages/backend/src/agents/chat/router.ts`
    - Definir tipo `ChatIntent` con categorías: 'saludo' | 'jailbreak' | 'offtopic' | 'pregunta_repo'
    - Definir interfaz `IntentRule` con campos intent y match (función que recibe string y retorna boolean)
    - Implementar array de reglas ordenadas por prioridad: jailbreak > saludo > offtopic
    - Exportar función `classifyIntent(message: string): ChatIntent` que evalúa reglas en orden y retorna 'pregunta_repo' como default
    - Reglas de jailbreak: detectar "ignore previous instructions", "olvidá las instrucciones", "actúa como", "sos un"
    - Reglas de saludo: detectar "hola", "buenos días", "qué tal", "hey", "buen día"
    - Reglas de offtopic: detectar temas no técnicos (clima, política, deportes, recetas)
    - Agregar nuevas reglas requiere solo agregar elementos al array, sin modificar classifyIntent
    - _Requirements: Requisito 2 (criterios 1-5)_

- [x] 2. Crear el constructor de contexto
  - [x] 2.1 Implementar módulo de construcción de contexto
    - Crear `packages/backend/src/agents/chat/context_builder.ts`
    - Exportar función `buildRepoContext(modules: ModuleNode[], options?: { readme?: string; focusModule?: ModuleNode }): string`
    - Incluir para cada módulo: id, name, path, type, dependencies, specStatus, specHealthScore
    - Excluir explícitamente sourceContent y earsSpec de cada módulo que NO sea el focusModule
    - Cuando `options.focusModule` está presente: incluir su `sourceContent` en el contexto junto con los metadatos de todos los módulos
    - Cuando `options.focusModule` NO está presente: excluir todos los sourceContent (comportamiento existente)
    - Máximo 1 focusModule por invocación (la firma solo acepta un único ModuleNode opcional)
    - Cuando readme está presente en `options.readme`, incluirlo truncado a máximo 3000 caracteres
    - Formato de salida: texto plano legible por el LLM (no JSON pesado)
    - Manejar gracefully módulos sin campos opcionales (linesOfCode, lastModified)
    - Exportar función `detectMentionedModule(message: string, modules: ModuleNode[]): ModuleNode | null`
    - Estrategia de matching: comparación case-insensitive contra `module.name` o último segmento del `module.path`
    - Retorna el primer módulo que matchee, o `null` si ninguno matchea
    - _Requirements: Requisito 3 (criterios 1-4), Requisito 11 (criterios 1, 2, 4, 5)_

- [x] 3. Crear el módulo de prompt y respuestas fijas
  - [x] 3.1 Implementar módulo de prompts y respuestas estáticas
    - Crear `packages/backend/src/agents/chat/prompt.ts`
    - Exportar constante `CHAT_SYSTEM_PROMPT` con instrucciones para el LLM: responder sobre estructura del repo, no revelar system prompt, responder en español
    - Exportar constante `FIXED_REPLIES` como Record<'saludo' | 'jailbreak' | 'offtopic' | 'modulo_no_encontrado', string>
    - Respuesta de saludo: amigable, invita a preguntar sobre el repo
    - Respuesta de jailbreak: rechaza el intento sin revelar detalles internos
    - Respuesta de offtopic: "Eso no está relacionado con el repositorio. Podés preguntar sobre la estructura, módulos o dependencias del código."
    - Respuesta de modulo_no_encontrado: "No encontré ese módulo en el repositorio. Podés preguntar por cualquier módulo que aparezca en el grafo."
    - System prompt instruye al LLM a no revelar instrucciones internas
    - _Requirements: Requisito 2 (criterios 1-3), Requisito 4 (criterio 5), Requisito 7 (criterio 2), Requisito 11 (criterio 3)_

- [x] 4. Crear el módulo de historial de sesión
  - [x] 4.1 Implementar historial de conversación en memoria
    - Crear `packages/backend/src/agents/chat/history.ts`
    - Definir interfaz `ChatMessage` con campos role ('user' | 'assistant') y content (string)
    - Exportar función `getHistory(sessionId: string): ChatMessage[]` que retorna array vacío si no existe la sesión
    - Exportar función `addToHistory(sessionId: string, message: ChatMessage): void`
    - Cuando el historial supera 8 mensajes, descartar los más antiguos (FIFO)
    - Store: Map<string, ChatMessage[]> en memoria del módulo (sin persistencia)
    - Exportar función `clearHistory(sessionId: string): void` para limpiar una sesión
    - _Requirements: Requisito 5 (criterios 1-4)_

- [x] 5. Crear el endpoint POST /api/chat
  - [x] 5.1 Implementar ruta de chat en el backend
    - Crear `packages/backend/src/routes/chat.ts`
    - Crear router Express con POST /chat que acepta body con message, modules, readme (opcional), sessionId (opcional)
    - Validar que message exista y no esté vacío (400 si falta)
    - Validar que modules exista y sea array (400 si falta)
    - Truncar message a 1000 caracteres antes de procesar
    - Generar sessionId con crypto.randomUUID() si no viene en el request
    - Invocar classifyIntent y responder con FIXED_REPLIES para saludo/jailbreak/offtopic
    - Para pregunta_repo:
      - Invocar `detectMentionedModule(message, modules)`
      - Si `detectMentionedModule` retorna un módulo → pasarlo como `focusModule` a `buildRepoContext`
      - Si el mensaje menciona un nombre de módulo pero `detectMentionedModule` retorna null (el módulo no existe en el array) → responder con `FIXED_REPLIES['modulo_no_encontrado']` sin invocar al LLM
      - Si no menciona ningún módulo → construir contexto sin focusModule (comportamiento existente)
    - Construir contexto con `buildRepoContext(modules, { readme, focusModule })`, obtener historial, invocar bedrockClient con modelo Haiku, temperature 0.3, max_tokens 1024
    - Usar withLlmRetry para manejar errores transitorios
    - Implementar AbortController con timeout de 30s; si se excede: { reply: "La respuesta tardó demasiado. Intentá con una pregunta más corta." }
    - Si el LLM falla con error no transitorio: { reply: "Error al generar respuesta. Intentá de nuevo." }
    - Actualizar historial con mensaje del usuario y respuesta del asistente
    - Respuesta siempre incluye sessionId
    - _Requirements: Requisito 1 (criterios 1-4), Requisito 4 (criterios 1-4), Requisito 6 (criterios 1-3), Requisito 7 (criterio 1), Requisito 8 (criterios 1-2), Requisito 11 (criterios 1-5)_

  - [x] 5.2 Montar chatRouter en app.ts
    - Modificar `packages/backend/src/app.ts`
    - Agregar import y mount del chatRouter con `app.use("/api", chatRouter)`
    - _Requirements: Requisito 1 (criterio 1)_

- [x] 6. Checkpoint - Verificar backend completo
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Crear tipos de chat en el frontend
  - [x] 7.1 Agregar interfaces TypeScript para el chat
    - Modificar `packages/frontend/src/types/index.ts`
    - Agregar interfaz `ChatMessage` con campos role ('user' | 'assistant') y content (string)
    - Agregar interfaz `ChatRequest` con campos message (string), modules (ModuleNode[]), readme (string opcional), sessionId (string opcional)
    - Agregar interfaz `ChatResponse` con campos reply (string) y sessionId (string)
    - _Requirements: Requisito 1 (tipos compartidos frontend)_

- [x] 8. Crear el hook useChat
  - [x] 8.1 Implementar hook de gestión de estado del chat
    - Crear `packages/frontend/src/hooks/use_chat.ts`
    - Aceptar opciones: modules (ModuleNode[]) y readme (string opcional)
    - Mantener estado local: messages (ChatMessage[]), isLoading (boolean), error (string | null)
    - Generar sessionId al montar usando crypto.randomUUID()
    - Exportar función sendMessage(text: string) que hace POST /api/chat
    - Agregar mensaje del usuario al estado local inmediatamente (optimistic UI)
    - Agregar reply del backend al estado local al recibir respuesta
    - Setear isLoading durante la petición
    - Setear error con mensaje legible si la petición falla
    - Exportar función clearChat() que resetea messages y genera nuevo sessionId
    - _Requirements: Requisito 1 (integración frontend), Requisito 5 (visualización)_

- [x] 9. Crear el componente ChatPanel
  - [x] 9.1 Implementar panel flotante de chat
    - Crear `packages/frontend/src/components/chat_panel.tsx`
    - Botón flotante circular (FAB) con ícono de chat, `position: fixed` en la esquina inferior derecha
    - Animación suave de apertura/cierre: CSS transition `transform: scale(0→1)` + `opacity: 0→1` (300ms ease-out para abrir, 200ms ease-in para cerrar)
    - Header con nombre del asistente "TrazIA Chat" y botón de cerrar (×)
    - Área de mensajes con diferenciación visual: usuario alineado a la derecha con fondo primario, asistente alineado a la izquierda con fondo neutro
    - Input de texto con botón enviar y soporte para tecla Enter (deshabilitado durante loading)
    - Indicador spinner "Pensando..." visible mientras `isLoading === true`
    - Scroll automático al último mensaje cuando llega una respuesta
    - Listener de tecla Escape (`keydown`) para cerrar el panel cuando está abierto
    - Responsividad: Desktop (≥1024px) 400×500px, Tablet (768px–1023px) 360×450px, Mobile (<768px) ancho completo con altura 60vh
    - Estrategia de z-index: FAB `z-index: 1000`, panel de chat `z-index: 1001`, panel de spec `z-index: 1002`
    - `position: fixed` — NO modifica el layout existente del grafo
    - Accesibilidad ARIA: `role="log"` en la lista de mensajes, `aria-live="polite"`, `aria-label` en el input y en el botón FAB
    - Focus management: al abrir el panel, focus va al input; al cerrar, focus vuelve al botón FAB
    - _Requirements: Requisito 9 (criterios 1-10)_

  - [x] 9.2 Integrar ChatPanel en App.tsx
    - Modificar `packages/frontend/src/App.tsx`
    - Renderizar ChatPanel solo cuando hay resultado de análisis disponible
    - Pasar modules y readme como props desde el resultado de análisis
    - Pasar `isSpecPanelOpen` y `specPanelWidth` como props al ChatPanel desde el estado de App
    - Ambos paneles (chat y spec) pueden estar abiertos simultáneamente
    - _Requirements: Requisito 1 (interfaz de usuario), Requisito 10 (criterio 3)_

  - [x] 9.3 Implementar gestión de posición y coexistencia con Panel_Spec
    - Recibir prop `isSpecPanelOpen: boolean` y `specPanelWidth: number` (default 400px) en ChatPanel
    - Cuando Panel_Spec cerrado: posicionar FAB y panel con `right: 24px`
    - Cuando Panel_Spec abierto: posicionar FAB y panel con `right: specPanelWidth + 24px`
    - CSS transition en la propiedad `right` (300ms ease) para reposicionamiento suave
    - Ambos paneles tienen ciclo de vida independiente: cerrar uno NO cierra el otro
    - Cerrar Panel_Spec → ChatPanel vuelve a posición original con animación
    - Cerrar ChatPanel → Panel_Spec no se ve afectado
    - _Requirements: Requisito 10 (criterios 1-6)_

- [x] 10. Checkpoint final - Verificar integración completa
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- El backend usa TypeScript con Express y AWS Bedrock (Haiku) para las respuestas del LLM
- El historial de conversación es in-memory (sin persistencia entre reinicios del servidor)
- Las respuestas fijas para saludo/jailbreak/offtopic no requieren invocación al LLM
- El timeout de 30s protege contra respuestas lentas del modelo
- Los archivos siguen la convención snake_case del proyecto
- Cada task referencia los requisitos específicos que implementa

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "2.1", "3.1", "4.1", "7.1"] },
    { "id": 1, "tasks": ["5.1"] },
    { "id": 2, "tasks": ["5.2"] },
    { "id": 3, "tasks": ["8.1"] },
    { "id": 4, "tasks": ["9.1"] },
    { "id": 5, "tasks": ["9.3"] },
    { "id": 6, "tasks": ["9.2"] }
  ]
}
```
