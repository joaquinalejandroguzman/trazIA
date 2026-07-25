# Documento de Diseño — Chat Contextual TrazIA

## Overview

El chat contextual agrega un endpoint POST /api/chat al backend y un panel flotante en el frontend. El backend usa un router determinístico para clasificar la intención del mensaje (saludo, jailbreak, offtopic, pregunta_repo) y solo invoca al LLM cuando el mensaje es una pregunta legítima sobre el repositorio. El contexto enviado al LLM se limita a metadatos de módulos (sin código fuente) por defecto, pero cuando el usuario menciona un módulo específico, el sistema enriquece el contexto incluyendo el sourceContent de ese módulo (máximo 1 por pregunta). Esto permite respuestas detalladas sobre módulos individuales manteniendo las invocaciones rápidas y baratas con Haiku.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Frontend (React)                                       │
│  ┌──────────────┐    ┌──────────────────┐              │
│  │ ChatPanel    │───▶│ useChat hook      │              │
│  │ (UI flotante)│◀───│ (estado + fetch)  │              │
│  └──────────────┘    └────────┬─────────┘              │
│                               │ POST /api/chat          │
└───────────────────────────────┼─────────────────────────┘
                                │
┌───────────────────────────────┼─────────────────────────┐
│  Backend (Express)            ▼                          │
│  ┌──────────────────────────────────┐                   │
│  │ routes/chat.ts                   │                   │
│  │ - Validación de request          │                   │
│  │ - Sanitización (truncar 1000ch)  │                   │
│  └────────────────┬─────────────────┘                   │
│                   │                                     │
│  ┌────────────────▼─────────────────┐                   │
│  │ agents/chat/router.ts            │                   │
│  │ - Clasificación determinística   │                   │
│  │ - Reglas extensibles             │                   │
│  └────────────────┬─────────────────┘                   │
│                   │ pregunta_repo                        │
│  ┌────────────────▼─────────────────┐                   │
│  │ agents/chat/context_builder.ts   │                   │
│  │ - Comprime metadatos de módulos  │                   │
│  │ - Detecta mención de módulo      │                   │
│  │ - Enriquece con sourceContent    │                   │
│  │ - Trunca README a 3000 chars     │                   │
│  └────────────────┬─────────────────┘                   │
│                   │                                     │
│  ┌────────────────▼─────────────────┐                   │
│  │ agents/chat/prompt.ts            │                   │
│  │ - System prompt del chat         │                   │
│  │ - Combina contexto + historial   │                   │
│  └────────────────┬─────────────────┘                   │
│                   │                                     │
│  ┌────────────────▼─────────────────┐                   │
│  │ agents/chat/history.ts           │                   │
│  │ - Store en memoria (Map)         │                   │
│  │ - Últimos 8 mensajes/sesión      │                   │
│  └────────────────┬─────────────────┘                   │
│                   │                                     │
│  ┌────────────────▼─────────────────┐                   │
│  │ bedrockClient + withLlmRetry     │                   │
│  │ (existentes — reutilizados)      │                   │
│  └──────────────────────────────────┘                   │
└─────────────────────────────────────────────────────────┘
```

### Diagrama de Secuencia — Flujo Principal (con detección de módulo)

```
Usuario     ChatPanel     useChat     POST /api/chat     Router     DetectModule   ContextBuilder     LLM
  │            │             │              │               │            │               │             │
  │─escribe──▶│             │              │               │            │               │             │
  │            │──send──────▶│              │               │            │               │             │
  │            │             │──POST───────▶│               │            │               │             │
  │            │             │              │──classify────▶│            │               │             │
  │            │             │              │◀─pregunta_repo│            │               │             │
  │            │             │              │──detectModule─────────────▶│               │             │
  │            │             │              │◀─ModuleNode|null───────────│               │             │
  │            │             │              │                            │               │             │
  │            │             │              │─[si módulo no existe]──────────────────────────────────▶ │
  │            │             │              │◀─reply fijo "No encontré..."─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ │
  │            │             │              │                            │               │             │
  │            │             │              │─[si módulo existe o null]──────────────────▶│             │
  │            │             │              │  buildCtx(modules, {focusModule})          │             │
  │            │             │              │◀─contexto──────────────────────────────────│             │
  │            │             │              │──invoke─────────────────────────────────────────────────▶│
  │            │             │              │◀─reply──────────────────────────────────────────────────│
  │            │             │◀─{ reply }───│               │            │               │             │
  │            │◀─messages───│              │               │            │               │             │
  │◀─render───│             │              │               │            │               │             │
```

**Nota:** "módulo no existe" se refiere al caso donde el mensaje menciona un nombre de módulo que no se encuentra en el array `modules`. En ese caso se responde directamente sin invocar al LLM.

### Decisiones de Diseño

| Decisión | Justificación |
|----------|---------------|
| Router determinístico (sin LLM para clasificar) | Reduce latencia y costo en ~60% de mensajes (saludos, offtopic) |
| Haiku en vez de Sonnet | 10x más rápido y barato; suficiente para preguntas sobre estructura |
| Contexto sin código fuente (por defecto) | Reduce tokens enviados, baja costo, y el LLM no necesita el código para responder sobre estructura |
| Enriquecimiento con sourceContent de 1 módulo (cuando se detecta mención) | Permite respuestas detalladas sobre un módulo específico sin explotar el consumo de tokens |
| Máximo 1 módulo enriquecido por pregunta | Mantiene el costo predecible y evita exceder la ventana de contexto |
| Historial en memoria (no DynamoDB) | Simplicidad para MVP; el chat es efímero y no requiere persistencia |
| sessionId en el request | Permite al frontend mantener la sesión sin cookies ni auth |
| Temperature 0.3 | Balance entre creatividad y consistencia para respuestas factuales |
| Timeout 30s con mensaje amigable | Mejor UX que un error genérico de red |

## Components and Interfaces

### Backend

#### 1. Route — `packages/backend/src/routes/chat.ts`

**Responsabilidad:** Exponer POST /api/chat, validar y sanitizar el request, orquestar el flujo.

```typescript
// Interfaz del request
interface ChatRequest {
  message: string          // texto del usuario (se trunca a 1000 chars)
  modules: ModuleNode[]    // grafo analizado del repo
  readme?: string          // contenido del README (opcional)
  sessionId?: string       // identificador de sesión (opcional, generado si ausente)
}

// Interfaz del response
interface ChatResponse {
  reply: string            // respuesta del asistente
  sessionId: string        // id de sesión para mantener historial
}
```

**Flujo:**
1. Validar campos requeridos (message, modules)
2. Sanitizar: truncar message a 1000 caracteres
3. Generar sessionId si no viene en el request
4. Invocar Router de intención
5. Si es saludo/jailbreak/offtopic → responder con mensaje fijo
6. Si es pregunta_repo:
   a. Invocar `detectMentionedModule(message, modules)`
   b. Si retorna un módulo → pasarlo como `focusModule` a `buildRepoContext`
   c. Si el mensaje menciona un nombre de módulo pero no existe en `modules` → responder con FIXED_REPLIES['modulo_no_encontrado'] sin invocar al LLM
   d. Si no menciona ningún módulo → construir contexto sin focusModule (comportamiento existente)
7. Construir contexto → invocar LLM → responder
8. Actualizar historial de sesión

#### 2. Router de Intención — `packages/backend/src/agents/chat/router.ts`

**Responsabilidad:** Clasificar el mensaje del usuario sin invocar al LLM.

```typescript
// Categorías de intención
type ChatIntent = 'saludo' | 'jailbreak' | 'offtopic' | 'pregunta_repo'

// Interfaz para reglas extensibles
interface IntentRule {
  intent: ChatIntent
  match: (message: string) => boolean
}

// Función principal
function classifyIntent(message: string): ChatIntent
```

**Estrategia de clasificación (por prioridad):**
1. Jailbreak: regex con patrones de injection (mayor prioridad)
2. Saludo: regex con patrones de saludo
3. Offtopic: heurística de detección de temas no técnicos
4. Default: pregunta_repo (si no matchea ninguna regla anterior)

**Extensibilidad:** Las reglas se definen como array de objetos `IntentRule`. Agregar nuevas reglas es agregar elementos al array sin tocar la lógica de clasificación.

#### 3. Constructor de Contexto — `packages/backend/src/agents/chat/context_builder.ts`

**Responsabilidad:** Comprimir los metadatos de módulos en un string de contexto para el LLM. Opcionalmente enriquecer con el código fuente de un módulo específico.

```typescript
// Opciones para la construcción de contexto
interface BuildRepoContextOptions {
  readme?: string
  focusModule?: ModuleNode
}

// Función principal — construye el contexto para el LLM
function buildRepoContext(modules: ModuleNode[], options?: BuildRepoContextOptions): string

// Detecta si el mensaje menciona un módulo específico del array
// Estrategia: case-insensitive, busca coincidencia con `name` o último segmento del `path`
function detectMentionedModule(message: string, modules: ModuleNode[]): ModuleNode | null
```

**Contenido incluido por módulo (siempre — metadatos):**
- id, name, path, type
- dependencies (lista de ids)
- specStatus, specHealthScore

**Contenido incluido condicionalmente (solo para focusModule):**
- sourceContent del módulo indicado en `options.focusModule`

**Exclusiones explícitas (siempre):**
- sourceContent de módulos que NO son el focusModule
- earsSpec (spec generada)
- Archivos binarios o generados

**README:** Si está presente en `options.readme`, se trunca a 3000 caracteres y se incluye al final del contexto.

**Límite:** Máximo 1 `focusModule` por invocación. La firma de la función solo acepta un único `ModuleNode` opcional.

**Estrategia de matching de `detectMentionedModule`:**
1. Para cada módulo del array, extraer:
   - `module.name` (nombre del módulo)
   - Último segmento del `module.path` (e.g., `"payments.ts"` de `"src/services/payments.ts"`)
2. Comparar contra el `message` de forma case-insensitive
3. Retornar el primer módulo que matchee, o `null` si ninguno matchea
4. Si el mensaje contiene múltiples nombres de módulos, solo se retorna el primer match (garantiza el límite de 1)

#### 4. Prompt — `packages/backend/src/agents/chat/prompt.ts`

**Responsabilidad:** Contener el system prompt y las respuestas fijas. Módulo separado para facilitar iteración del prompt sin tocar la lógica.

```typescript
// System prompt para el LLM
const CHAT_SYSTEM_PROMPT: string

// Respuestas fijas por intención
const FIXED_REPLIES: Record<'saludo' | 'jailbreak' | 'offtopic' | 'modulo_no_encontrado', string>
```

**Respuestas fijas definidas:**
| Clave | Texto |
|-------|-------|
| `saludo` | Mensaje de bienvenida contextual |
| `jailbreak` | Mensaje de rechazo amable |
| `offtopic` | "Eso no está relacionado con el repositorio. Podés preguntar sobre la estructura, módulos o dependencias del código." |
| `modulo_no_encontrado` | "No encontré ese módulo en el repositorio. Podés preguntar por cualquier módulo que aparezca en el grafo." |

#### 5. Historial — `packages/backend/src/agents/chat/history.ts`

**Responsabilidad:** Mantener historial de conversación en memoria por sesión.

```typescript
interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

// Store global en memoria (Map<sessionId, ChatMessage[]>)
function getHistory(sessionId: string): ChatMessage[]
function addToHistory(sessionId: string, message: ChatMessage): void
```

**Límite:** 8 mensajes máximo por sesión. Al agregar el mensaje 9, se descarta el más antiguo (FIFO).

**Almacenamiento:** Map en memoria del proceso. Sin persistencia. Se pierde al reiniciar el servidor.

#### 6. Invocación al LLM

Reutiliza `bedrockClient` y `withLlmRetry` existentes.

```typescript
// Configuración específica para chat
const CHAT_MODEL = 'global.anthropic.claude-haiku-4-5-20251001-v1:0'
const CHAT_TEMPERATURE = 0.3
const CHAT_TIMEOUT_MS = 30_000
const CHAT_MAX_TOKENS = 1024
```

### Frontend

#### 7. Hook — `packages/frontend/src/hooks/use_chat.ts`

**Responsabilidad:** Gestionar el estado del chat y la comunicación con el backend.

```typescript
interface UseChatOptions {
  modules: ModuleNode[]
  readme?: string
}

interface UseChatReturn {
  messages: ChatMessage[]       // historial local de mensajes
  isLoading: boolean            // indica si hay una petición en curso
  error: string | null          // mensaje de error (si hay)
  sendMessage: (text: string) => Promise<void>
  clearChat: () => void         // resetea la conversación
}
```

**Comportamiento:**
- Mantiene mensajes localmente para renderizar el historial
- Envía POST /api/chat con message, modules, readme, sessionId
- Genera sessionId al montar (crypto.randomUUID o fallback)
- Muestra estado de carga mientras espera respuesta

#### 8. Panel de Chat — `packages/frontend/src/components/chat_panel.tsx`

**Responsabilidad:** UI flotante para enviar mensajes y ver respuestas, con posicionamiento dinámico según el estado del panel de specs.

**Elementos:**
- **Botón flotante (FAB):** Botón circular fijo en la esquina inferior derecha con ícono de chat. Siempre visible cuando el chat está cerrado.
- **Panel flotante:** Se abre sobre el grafo sin modificar su layout (usa `position: fixed`).
- **Header:** Muestra el nombre del asistente ("TrazIA Chat") y un botón de cerrar (×).
- **Área de mensajes:** Lista scrollable diferenciando visualmente mensajes del usuario (alineados a derecha, fondo primario) y del asistente (alineados a izquierda, fondo neutro).
- **Input + botón enviar:** Campo de texto con placeholder y botón de envío. Deshabilitado durante loading.
- **Spinner de carga:** Indicador "Pensando..." visible mientras `isLoading === true`.
- **Scroll automático:** Al último mensaje cuando llega una respuesta.

**Animaciones:**
- Apertura: CSS transition `transform: scale(0) → scale(1)` + `opacity: 0 → 1` (300ms ease-out)
- Cierre: Transición inversa (200ms ease-in)
- Reposicionamiento: `transition: right 300ms ease` para movimiento suave al cambiar posición

**Cierre del panel:**
- Click en botón cerrar (×) en el header
- Tecla Escape: listener `keydown` que cierra el panel cuando está abierto

**Posicionamiento dinámico (coexistencia con Panel_Spec):**
- El componente recibe una prop `isSpecPanelOpen: boolean` (o consume un contexto compartido)
- Cuando `isSpecPanelOpen === false`: panel en esquina inferior derecha (`right: 24px`)
- Cuando `isSpecPanelOpen === true`: panel se desplaza a la izquierda del Panel_Spec (`right: specPanelWidth + 24px`)
- La transición de posición es animada (CSS transition en `right`)

**Z-index strategy:**
- Grafo de arquitectura: `z-index: 1` (base)
- Botón FAB del chat: `z-index: 1000`
- Panel de chat: `z-index: 1001`
- Panel de spec: `z-index: 1002` (prioridad visual sobre chat)

**Responsividad:**
- Desktop (≥1024px): Panel de 400px × 500px
- Tablet (768px–1023px): Panel de 360px × 450px
- Mobile (<768px): Panel ocupa 100% del ancho con altura de 60vh

**No modifica layout existente:**
- El ChatPanel usa `position: fixed` y nunca altera dimensiones o posición del contenedor del grafo
- El grafo sigue interactivo detrás del panel (eventos de mouse no bloqueados fuera del área del panel)

**Accesibilidad:**
- Roles ARIA apropiados (`role="log"` para la lista de mensajes, `aria-live="polite"`)
- `aria-label` en el input y en el botón FAB
- Focus management: al abrir el panel, focus va al input; al cerrar, focus vuelve al botón FAB
- Escape key como atajo de teclado para cerrar

#### 9. Gestión de Posición — Lógica de coexistencia con Panel_Spec

**Responsabilidad:** Coordinar la posición del ChatPanel según el estado del Panel_Spec.

**Estrategia:**
- El estado `isSpecPanelOpen` se gestiona en `App.tsx` (ya existe para el Panel_Spec)
- Se pasa como prop al `ChatPanel` o se expone vía contexto React compartido
- Cada panel tiene ciclo de vida independiente: abrir/cerrar uno NO afecta al otro

**Props del ChatPanel relacionadas:**

```typescript
interface ChatPanelProps {
  modules: ModuleNode[]
  readme?: string
  isSpecPanelOpen: boolean   // indica si el panel de spec está abierto
  specPanelWidth?: number    // ancho del panel de spec (default: 400px)
}
```

**Reglas de posicionamiento:**
1. Panel de spec cerrado → ChatPanel FAB y panel en `right: 24px`
2. Panel de spec abierto → ChatPanel FAB y panel en `right: specPanelWidth + 24px`
3. Ambos paneles pueden estar abiertos simultáneamente
4. El Panel_Spec tiene prioridad visual (z-index mayor)
5. Cerrar el Panel_Spec → ChatPanel vuelve a posición original (con animación)
6. Cerrar el ChatPanel → Panel_Spec no se ve afectado

## Data Models

### Tipos del Backend

```typescript
// Categorías de intención del router
type ChatIntent = 'saludo' | 'jailbreak' | 'offtopic' | 'pregunta_repo'

// Regla extensible de clasificación
interface IntentRule {
  intent: ChatIntent
  match: (message: string) => boolean
}

// Request del endpoint
interface ChatRequest {
  message: string          // texto del usuario (máx 1000 chars)
  modules: ModuleNode[]    // grafo analizado del repo
  readme?: string          // contenido del README (opcional)
  sessionId?: string       // identificador de sesión
}

// Response del endpoint
interface ChatResponse {
  reply: string            // respuesta del asistente
  sessionId: string        // id de sesión
}

// Mensaje del historial
interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}
```

### Tipos del Frontend

```typescript
// Opciones para el hook useChat
interface UseChatOptions {
  modules: ModuleNode[]
  readme?: string
}

// Retorno del hook useChat
interface UseChatReturn {
  messages: ChatMessage[]
  isLoading: boolean
  error: string | null
  sendMessage: (text: string) => Promise<void>
  clearChat: () => void
}
```

### Constantes de Configuración

```typescript
const CHAT_MODEL = 'global.anthropic.claude-haiku-4-5-20251001-v1:0'
const CHAT_TEMPERATURE = 0.3
const CHAT_TIMEOUT_MS = 30_000
const CHAT_MAX_TOKENS = 1024
const MAX_MESSAGE_LENGTH = 1000
const MAX_HISTORY_MESSAGES = 8
const MAX_README_LENGTH = 3000
```

## Correctness Properties

*Una propiedad es una característica o comportamiento que debe mantenerse verdadero en todas las ejecuciones válidas del sistema — esencialmente, una declaración formal sobre lo que el sistema debe hacer. Las propiedades sirven como puente entre especificaciones legibles por humanos y garantías de corrección verificables por máquinas.*

### Property 1: Respuesta válida para request válido

*For any* request válido con message no vacío y modules como array, el Sistema_Chat SHALL devolver una respuesta JSON con el campo reply de tipo string.

**Validates: Requirements 1.2**

### Property 2: Validación de input rechaza payloads inválidos

*For any* request donde message está ausente/vacío/solo-whitespace O modules está ausente/no-es-array, el Sistema_Chat SHALL devolver HTTP 400 con un mensaje de error descriptivo.

**Validates: Requirements 1.3, 1.4**

### Property 3: Clasificación de saludos

*For any* mensaje que contiene patrones de saludo (hola, buenos días, qué tal, hey), el Router_Intención SHALL clasificarlo como 'saludo' y el sistema SHALL responder con el mensaje fijo de bienvenida sin invocar al LLM.

**Validates: Requirements 2.1**

### Property 4: Clasificación de jailbreak

*For any* mensaje que contiene patrones de prompt injection (ignore previous instructions, olvidá las instrucciones, actúa como, sos un), el Router_Intención SHALL clasificarlo como 'jailbreak' con mayor prioridad que cualquier otra clasificación.

**Validates: Requirements 2.2**

### Property 5: Clasificación por defecto como pregunta_repo

*For any* mensaje que no matchea ninguna regla de saludo, jailbreak u offtopic, el Router_Intención SHALL clasificarlo como 'pregunta_repo'.

**Validates: Requirements 2.4**

### Property 6: Contexto incluye metadatos completos de todos los módulos

*For any* array de ModuleNode[], el Constructor_Contexto SHALL generar un string de contexto que contiene id, name, path, type, dependencies, specStatus y specHealthScore de cada módulo del array.

**Validates: Requirements 3.1**

### Property 7: Truncado de README a 3000 caracteres

*For any* string readme con longitud mayor a 3000 caracteres, el Constructor_Contexto SHALL incluir como máximo 3000 caracteres del readme en el contexto generado.

**Validates: Requirements 3.2**

### Property 8: Exclusión de campos sensibles del contexto (módulos no enfocados)

*For any* ModuleNode con campos sourceContent o earsSpec poblados que NO sea el focusModule, el Constructor_Contexto SHALL generar un contexto que no contiene el contenido de sourceContent ni de earsSpec de dichos módulos.

**Validates: Requirements 3.3, 3.4**

### Property 9: Historial acotado FIFO de 8 mensajes

*For any* secuencia de N mensajes agregados a una sesión (donde N > 8), el Historial_Sesión SHALL mantener exactamente los 8 mensajes más recientes, descartando los más antiguos.

**Validates: Requirements 5.1, 5.2**

### Property 10: Truncado de mensaje a 1000 caracteres

*For any* mensaje del usuario con longitud mayor a 1000 caracteres, el Sistema_Chat SHALL truncar el mensaje a exactamente 1000 caracteres antes de procesarlo.

**Validates: Requirements 7.1**

### Property 11: Posicionamiento según estado del Panel_Spec

*For any* estado del ChatPanel donde está abierto, si el Panel_Spec está abierto el ChatPanel SHALL posicionarse a la izquierda del Panel_Spec, y si el Panel_Spec está cerrado el ChatPanel SHALL posicionarse en la esquina inferior derecha.

**Validates: Requirements 10.1, 10.2, 10.4**

### Property 12: Independencia de ciclo de vida entre paneles

*For any* estado donde ambos paneles (ChatPanel y Panel_Spec) están abiertos simultáneamente, cerrar el ChatPanel SHALL NO afectar la visibilidad ni el estado del Panel_Spec, y cerrar el Panel_Spec SHALL NO afectar la visibilidad del ChatPanel (que vuelve a su posición original).

**Validates: Requirements 10.5, 10.6**

### Property 13: Detección de módulo e inclusión de sourceContent

*For any* mensaje que contiene el nombre o último segmento del path de un módulo existente en el array de modules (comparación case-insensitive), `detectMentionedModule` SHALL retornar ese módulo y `buildRepoContext` con dicho módulo como `focusModule` SHALL generar un contexto que contiene el sourceContent de ese módulo.

**Validates: Requirements 11.1, 11.2, 11.5**

### Property 14: Módulo no encontrado retorna respuesta fija

*For any* mensaje que menciona un nombre de módulo que NO existe en el array de modules, el Sistema_Chat SHALL responder con el mensaje fijo "No encontré ese módulo en el repositorio. Podés preguntar por cualquier módulo que aparezca en el grafo." sin invocar al LLM.

**Validates: Requirements 11.3**

### Property 15: Límite de un solo módulo enriquecido por pregunta

*For any* invocación a `buildRepoContext`, el contexto generado SHALL contener el sourceContent de como máximo 1 módulo, independientemente de cuántos módulos existan en el array o cuántos se mencionen en el mensaje.

**Validates: Requirements 11.4**

## Error Handling

### Manejo de errores del LLM

| Escenario | Comportamiento |
|-----------|---------------|
| Error transitorio (429, 5xx) | `withLlmRetry` reintenta con backoff exponencial |
| Error no transitorio post-reintentos | Devolver `{ reply: "Error al generar respuesta. Intentá de nuevo." }` con HTTP 200 |
| Timeout (30s) | Devolver `{ reply: "La respuesta tardó demasiado. Intentá con una pregunta más corta." }` con HTTP 200 |

### Validación de input

| Escenario | Comportamiento |
|-----------|---------------|
| `message` ausente o vacío | HTTP 400 con mensaje de error descriptivo |
| `modules` ausente o no es array | HTTP 400 con mensaje de error descriptivo |
| `message` excede 1000 chars | Truncar silenciosamente a 1000 chars y continuar |

### Consideraciones de Seguridad

- **Truncado a 1000 chars:** Previene payloads enormes que podrían generar tokens excesivos.
- **Detección de jailbreak:** Patrones de prompt injection se rechazan antes de llegar al LLM.
- **System prompt no expuesto:** El prompt no se incluye en la respuesta y el LLM está instruido a no revelarlo.
- **Sin código fuente en contexto (por defecto):** No se filtra código del repo analizado a través del chat, salvo cuando el usuario pregunta explícitamente por un módulo específico (máximo 1 módulo por pregunta).

## Testing Strategy

### Enfoque Dual: Unit Tests + Property Tests

El chat contextual se presta bien a property-based testing porque tiene funciones puras con entrada/salida clara (router, context builder, history) y propiedades universales que deben mantenerse para todos los inputs.

### Property-Based Tests (fast-check)

Se usa [fast-check](https://github.com/dubzzz/fast-check) como librería de property-based testing. Cada test corre un mínimo de 100 iteraciones.

| Propiedad | Módulo bajo test | Estrategia de generación |
|-----------|-----------------|--------------------------|
| Property 1: Respuesta válida | routes/chat.ts | Generar ChatRequest aleatorios con message no vacío y modules como array |
| Property 2: Validación input | routes/chat.ts | Generar payloads con message vacío/ausente o modules no-array |
| Property 3: Clasificación saludos | agents/chat/router.ts | Generar strings con patrones de saludo embebidos en texto aleatorio |
| Property 4: Clasificación jailbreak | agents/chat/router.ts | Generar strings con patrones de injection embebidos |
| Property 5: Default pregunta_repo | agents/chat/router.ts | Generar strings técnicos que no matchean greeting/jailbreak/offtopic |
| Property 6: Contexto incluye metadatos | agents/chat/context_builder.ts | Generar arrays de ModuleNode aleatorios |
| Property 7: Truncado README | agents/chat/context_builder.ts | Generar strings de longitud variable (0 a 10000 chars) |
| Property 8: Exclusión campos sensibles | agents/chat/context_builder.ts | Generar ModuleNode con sourceContent y earsSpec aleatorios, invocar buildRepoContext sin focusModule, verificar que ningún sourceContent ni earsSpec aparece en el output |
| Property 9: Historial FIFO | agents/chat/history.ts | Generar secuencias de N mensajes (N de 1 a 50) |
| Property 10: Truncado mensaje | routes/chat.ts | Generar strings de longitud 1001 a 5000 |
| Property 11: Posicionamiento según spec panel | components/chat_panel.tsx | Generar combinaciones de isSpecPanelOpen (true/false) y verificar posición CSS |
| Property 12: Independencia de ciclo de vida | components/chat_panel.tsx | Generar secuencias de abrir/cerrar cada panel y verificar que el otro no se afecta |
| Property 13: Detección de módulo e inclusión de sourceContent | agents/chat/context_builder.ts | Generar arrays de ModuleNode con sourceContent aleatorio y mensajes que contienen nombres de módulos existentes; verificar que detectMentionedModule retorna el módulo correcto y que buildRepoContext con focusModule incluye su sourceContent |
| Property 14: Módulo no encontrado | routes/chat.ts + agents/chat/context_builder.ts | Generar arrays de ModuleNode y mensajes que mencionan nombres NO presentes en el array; verificar que el sistema retorna FIXED_REPLIES['modulo_no_encontrado'] sin invocar al LLM |
| Property 15: Límite de un solo módulo | agents/chat/context_builder.ts | Generar arrays de ModuleNode con múltiples sourceContent poblados y invocar buildRepoContext con un focusModule; verificar que el contexto contiene como máximo 1 sourceContent (el del focusModule) y excluye el de los demás |

**Tag format:** `Feature: chat-trazia, Property {N}: {título}`

### Unit Tests (Jest)

Tests de ejemplo para casos concretos y edge cases:

- Router: mensajes offtopic específicos (clima, deportes, política)
- Router: extensibilidad — agregar nueva regla sin modificar lógica existente
- Prompt: verificar que CHAT_SYSTEM_PROMPT y FIXED_REPLIES están definidos (incluyendo 'modulo_no_encontrado')
- Timeout: mock del LLM que excede 30s → mensaje amigable
- Error no transitorio: mock del LLM que falla → mensaje amigable
- Frontend hook: estado de loading durante petición

#### Detección de Módulo — Unit Tests

- `detectMentionedModule` con mensaje que contiene nombre exacto → retorna el módulo
- `detectMentionedModule` con mensaje que contiene último segmento del path → retorna el módulo
- `detectMentionedModule` case-insensitive: "PAYMENTS.TS" matchea módulo "payments.ts"
- `detectMentionedModule` con mensaje que no menciona ningún módulo → retorna null
- `detectMentionedModule` con mensaje que menciona múltiples módulos → retorna solo el primero
- `buildRepoContext` con focusModule → contexto incluye sourceContent del módulo enfocado
- `buildRepoContext` sin focusModule → contexto excluye todo sourceContent
- Flujo completo: mensaje menciona módulo inexistente → respuesta fija sin invocación al LLM

#### UI Tests — ChatPanel (Requisitos 9 y 10)

**Posicionamiento con/sin Panel_Spec:**
- Renderizar ChatPanel con `isSpecPanelOpen=false` → verificar que el panel está en `right: 24px`
- Renderizar ChatPanel con `isSpecPanelOpen=true` → verificar que el panel se desplaza a la izquierda del spec panel
- Cambiar `isSpecPanelOpen` de true a false → verificar que el panel vuelve a posición original

**Animaciones:**
- Al abrir el panel: verificar que el contenedor tiene clases/estilos de animación de entrada (scale + opacity)
- Al cerrar el panel: verificar transición de salida aplicada
- Al cambiar posición: verificar que `transition` CSS está definido para la propiedad `right`

**Cierre con tecla Escape:**
- Panel abierto + dispatch `keydown` Escape → verificar que el panel se cierra
- Panel cerrado + dispatch `keydown` Escape → verificar que no hay efecto secundario
- Panel abierto + dispatch `keydown` de otra tecla → verificar que el panel sigue abierto

**Responsividad (breakpoints):**
- Viewport 1024px+ → verificar dimensiones del panel (400px × 500px)
- Viewport 768px–1023px → verificar dimensiones adaptadas (360px × 450px)
- Viewport <768px → verificar que el panel ocupa ancho completo

**Coexistencia:**
- Abrir ambos paneles → verificar que ambos están visibles en el DOM
- Cerrar ChatPanel → verificar que Panel_Spec sigue visible
- Cerrar Panel_Spec → verificar que ChatPanel sigue visible y vuelve a posición original

**Z-index:**
- Verificar que Panel_Spec tiene z-index mayor que ChatPanel
- Verificar que ChatPanel tiene z-index mayor que el grafo

### Integration Tests

- Flujo completo: mensaje → router → context → LLM → respuesta (con LLM mockeado)
- Historial: verificar que el historial se incluye en la invocación al LLM
- Retry: mock que devuelve 429 una vez, luego éxito

### Archivos a Crear/Modificar

#### Nuevos archivos:
| Archivo | Descripción |
|---------|-------------|
| `packages/backend/src/agents/chat/router.ts` | Router de intención determinístico |
| `packages/backend/src/agents/chat/context_builder.ts` | Constructor de contexto para LLM |
| `packages/backend/src/agents/chat/prompt.ts` | System prompt y respuestas fijas |
| `packages/backend/src/agents/chat/history.ts` | Historial en memoria por sesión |
| `packages/backend/src/routes/chat.ts` | Endpoint POST /api/chat |
| `packages/frontend/src/hooks/use_chat.ts` | Hook React para el chat |
| `packages/frontend/src/components/chat_panel.tsx` | Panel UI flotante |

#### Archivos a modificar:
| Archivo | Cambio |
|---------|--------|
| `packages/backend/src/app.ts` | Montar chatRouter en `/api` |
| `packages/frontend/src/App.tsx` | Renderizar ChatPanel cuando hay resultado de análisis |
| `packages/frontend/src/types/index.ts` | Agregar tipos ChatMessage, ChatResponse |
