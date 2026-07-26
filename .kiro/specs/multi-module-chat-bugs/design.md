# Multi-Module Chat Bugs — Bugfix Design

## Overview

Este diseño aborda 3 bugs en el feature de chat multi-módulo:

1. **Bug Crítico — `analyzingModules` es código muerto** (frontend): React batchea `setAnalyzingModules(responseModules)` y `setAnalyzingModules(null)` en el mismo handler async de `use_chat.ts`, por lo que el componente nunca renderiza el estado intermedio.
2. **Bug Medio — sourceContent en preguntas generales** (backend): Cuando `isGeneralRepoQuestion` es true, `focusModules = modules` envía snippets de código de todos los módulos al LLM (miles de caracteres innecesarios).
3. **Bug Medio — Contador "1/N" hardcodeado** (frontend): `chat_panel.tsx` muestra `Analizando (1/${analyzingModules.length})...` con un "1" estático que simula progreso falso.

La estrategia general es: corregir el ciclo de vida del estado en el frontend, agregar una opción `includeSnippets` al backend, y simplificar el texto del indicador de carga.

## Glossary

- **Bug_Condition (C)**: Conjunto de condiciones de entrada que disparan cada bug
- **Property (P)**: Comportamiento correcto esperado bajo C
- **Preservation**: Comportamientos existentes que NO deben cambiar tras el fix
- **`analyzingModules`**: Estado en `use_chat.ts` (string[] | null) que indica qué módulos está procesando el LLM
- **`buildRepoContext`**: Función en `context_builder.ts` que construye el string de contexto del repo para el LLM
- **`isGeneralRepoQuestion`**: Función en `context_builder.ts` que clasifica si el mensaje es una pregunta general
- **`focusModules`**: Array de módulos cuyo sourceContent se incluye en el contexto del LLM
- **`includeSnippets`**: Nueva opción booleana para `buildRepoContext` que controla si incluir sourceContent de focusModules
- **`sendMessage`**: Función async en `use_chat.ts` que envía mensajes al backend y gestiona el estado

## Bug Details

### Bug Condition

Los 3 bugs se manifiestan en situaciones distintas pero relacionadas al flujo de chat:

**Bug 1** se manifiesta cuando el usuario envía un mensaje y la respuesta incluye `analyzingModules` con módulos. El handler async ejecuta `setAnalyzingModules(responseModules)` seguido inmediatamente de `setAnalyzingModules(null)` en la misma microtask — React batchea ambas y el componente nunca ve el estado intermedio.

**Bug 2** se manifiesta cuando `isGeneralRepoQuestion` retorna true. El endpoint setea `focusModules = modules` (todos) y `buildRepoContext` incluye snippets truncados de cada uno, generando contextos de 15.000+ caracteres innecesarios en el prompt.

**Bug 3** se manifiesta cuando el componente `chat_panel.tsx` renderiza el indicador de carga con `analyzingModules.length > 0`. El texto muestra `1/${analyzingModules.length}` con un "1" estático que nunca avanza.

**Formal Specification:**

```
FUNCTION isBugCondition(input)
  INPUT: input of type { bug: 1 | 2 | 3, context: ChatContext }
  OUTPUT: boolean

  // Bug 1: analyzingModules nunca se renderiza
  IF input.bug == 1 THEN
    RETURN input.context.responseHasModules == true
           AND input.context.setAnalyzingModules_called_with_array == true
           AND input.context.setAnalyzingModules_called_with_null == true
           AND input.context.both_in_same_async_handler == true
  END IF

  // Bug 2: sourceContent innecesario en preguntas generales
  IF input.bug == 2 THEN
    RETURN isGeneralRepoQuestion(input.context.message, []) == true
           AND input.context.focusModules == allModules
           AND buildRepoContext_includes_sourceContent == true
  END IF

  // Bug 3: Contador hardcodeado
  IF input.bug == 3 THEN
    RETURN input.context.analyzingModules != null
           AND input.context.analyzingModules.length > 0
           AND input.context.displayText contains "1/"
  END IF
END FUNCTION
```

### Examples

- **Bug 1**: Usuario pregunta "¿qué hace payments?" → backend responde con `analyzingModules: ["payments"]` → `setAnalyzingModules(["payments"])` seguido de `setAnalyzingModules(null)` → componente nunca muestra "Analizando payments..."
- **Bug 2**: Usuario pregunta "¿cómo está organizado el repositorio?" → `isGeneralRepoQuestion` = true → `focusModules = modules` (10 módulos) → `buildRepoContext` genera 15.000+ chars con snippets de código → LLM recibe contexto innecesariamente grande
- **Bug 3**: `analyzingModules = ["payments", "auth", "logger"]` → componente muestra "Analizando (1/3)..." en vez de "Analizando 3 módulos..."
- **Edge case Bug 1**: Si la respuesta NO trae módulos → `setAnalyzingModules(null)` → no hay bug (ya era null)

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Mouse clicks y toda interacción de UI del chat panel deben seguir funcionando exactamente igual
- `clearChat()` debe seguir reseteando `analyzingModules` a null y generando nuevo sessionId
- Cuando `buildRepoContext` se invoca sin `focusModules`, debe seguir excluyendo `sourceContent` de todos los módulos
- Cuando `buildRepoContext` se invoca con `focusModules` e `includeSnippets` no se especifica (o es true), debe seguir incluyendo snippets truncados (500/300 chars)
- Preguntas que mencionan módulos específicos (no generales) deben seguir incluyendo `sourceContent` truncado
- El indicador "Pensando..." debe seguir mostrándose cuando no hay módulos analizados
- `detectMentionedModules` debe mantener deduplicación y case-insensitivity
- `isGeneralRepoQuestion` debe seguir retornando false cuando hay módulos mencionados

**Scope:**
Inputs que NO activan ninguno de los 3 bugs deben producir exactamente el mismo comportamiento que antes del fix:
- Mensajes clasificados como saludo/jailbreak/offtopic (respuestas fijas)
- Preguntas sobre módulos específicos (focusModules con snippets)
- Estado de loading sin módulos analizados ("Pensando...")

## Hypothesized Root Cause

### Bug 1: React batching de estado en async handler

**Causa raíz confirmada por lectura de código:**

En `use_chat.ts` líneas 48-62, dentro del bloque `try` del `sendMessage`:
1. L55: `setAnalyzingModules(responseModules)` — setea el array de módulos
2. L60: `setAnalyzingModules(null)` — resetea inmediatamente

Desde React 18, todos los `setState` dentro de un mismo event handler (incluyendo async/await continuations dentro del mismo scope) se batchean automáticamente. React no flushea entre L55 y L60, por lo que el componente nunca ve `analyzingModules !== null`.

**Fix requerido:** Mover el `setAnalyzingModules(null)` fuera de este handler. El estado debe setearse con el array cuando llega la respuesta y persistir hasta que el usuario envíe el próximo mensaje (donde se limpia al inicio).

### Bug 2: focusModules incluye snippets por defecto

**Causa raíz confirmada por lectura de código:**

En `chat.ts` línea 81: `focusModules = modules` (todos los módulos) cuando `isGeneral === true`.
En `context_builder.ts` línea 67-71: si un módulo está en `focusIds` y tiene `sourceContent`, se incluye siempre el snippet truncado.

No hay mecanismo para decir "quiero los módulos como focus pero sin incluir sus snippets de código". Para preguntas generales, lo que se necesita es solo metadata (nombre, path, dependencias) sin código fuente.

**Fix requerido:** Agregar opción `includeSnippets: boolean` a `BuildRepoContextOptions`. Cuando es `false`, no incluir `sourceContent` aunque el módulo esté en `focusModules`.

### Bug 3: Template literal con "1" hardcodeado

**Causa raíz confirmada por lectura de código:**

En `chat_panel.tsx` línea 136:
```tsx
`Analizando (1/${analyzingModules.length})...`
```

El "1" es un literal que nunca cambia. No hay mecanismo de progreso real (el backend responde en una sola llamada, no hay streaming de progreso por módulo).

**Fix requerido:** Cambiar a `Analizando ${analyzingModules.length} módulos...` que refleja la realidad sin simular progreso.

## Correctness Properties

Property 1: Bug Condition - analyzingModules visible durante loading

_For any_ mensaje enviado por el usuario donde la respuesta del backend incluye `analyzingModules` con al menos un módulo, el hook `useChat` SHALL setear `analyzingModules` con el array de módulos de forma que sea visible durante todo el periodo de `isLoading === true`, y solo limpiar a null al inicio del siguiente `sendMessage`.

**Validates: Requirements 2.1**

Property 2: Bug Condition - Preguntas generales sin sourceContent

_For any_ invocación a `buildRepoContext` con `focusModules` y `includeSnippets: false`, la función SHALL excluir `sourceContent` de todos los módulos del output, incluyendo solo metadata (nombre, path, dependencias, specStatus, specHealthScore).

**Validates: Requirements 2.2**

Property 3: Bug Condition - Texto del indicador sin progreso falso

_For any_ renderizado del indicador de carga donde `analyzingModules` es un array con N elementos (N > 0), el componente SHALL mostrar `Analizando N módulos...` (o `Analizando 1 módulo...` si N === 1) sin el formato "1/N" que simula progreso.

**Validates: Requirements 2.3**

Property 4: Preservation - focusModules con includeSnippets=true mantiene snippets

_For any_ invocación a `buildRepoContext` con `focusModules` e `includeSnippets` no especificado o `true`, la función SHALL producir el mismo resultado que la implementación original (incluir sourceContent truncado según el límite 500/300 chars).

**Validates: Requirements 3.2, 3.4, 3.5**

Property 5: Preservation - clearChat resetea estado correctamente

_For any_ invocación de `clearChat()`, el hook SHALL resetear `analyzingModules` a null, vaciar messages, limpiar error, y generar nuevo sessionId — comportamiento idéntico al actual.

**Validates: Requirements 3.3**

Property 6: Preservation - Indicador "Pensando..." sin módulos

_For any_ estado de loading donde `analyzingModules` es null o array vacío, el componente SHALL mostrar "Pensando..." exactamente como antes del fix.

**Validates: Requirements 3.1, 3.6**

## Fix Implementation

### Changes Required

Asumiendo que el análisis de causa raíz es correcto:

**File**: `packages/frontend/src/hooks/use_chat.ts`

**Function**: `sendMessage`

**Specific Changes**:
1. **Limpiar analyzingModules al inicio de sendMessage**: Agregar `setAnalyzingModules(null)` al principio del handler, antes del fetch. Esto resetea el estado del mensaje anterior.
2. **Remover el segundo setAnalyzingModules(null)**: Eliminar la línea `setAnalyzingModules(null)` que se ejecuta después de agregar el mensaje del asistente (L60). El estado debe persistir hasta el próximo `sendMessage`.
3. **Mantener el setAnalyzingModules(null) en el catch**: En caso de error, seguir limpiando a null para no dejar estado stale.

---

**File**: `packages/backend/src/agents/chat/context_builder.ts`

**Interface**: `BuildRepoContextOptions`

**Specific Changes**:
4. **Agregar campo `includeSnippets?: boolean`** a la interfaz `BuildRepoContextOptions`. Default: `true` (backward compatibility).
5. **Condicionar inclusión de sourceContent**: En la lógica de `buildRepoContext`, solo incluir el snippet si `options?.includeSnippets !== false` (equivalente a: incluir si es `true` o `undefined`).

---

**File**: `packages/backend/src/routes/chat.ts`

**Specific Changes**:
6. **Pasar `includeSnippets: false` para preguntas generales**: Cuando `isGeneral === true`, invocar `buildRepoContext(modules, { readme, focusModules, includeSnippets: false })`.

---

**File**: `packages/frontend/src/components/chat_panel.tsx`

**Specific Changes**:
7. **Cambiar texto del indicador**: Reemplazar `` `Analizando (1/${analyzingModules.length})...` `` por `` `Analizando ${analyzingModules.length} módulo${analyzingModules.length > 1 ? 's' : ''}...` ``

## Testing Strategy

### Validation Approach

La estrategia de testing sigue dos fases: primero, surfear counterexamples que demuestran los bugs en código sin fixear, y luego verificar que el fix funciona correctamente y preserva el comportamiento existente.

### Exploratory Bug Condition Checking

**Goal**: Surfear counterexamples que demuestran los bugs ANTES de implementar el fix. Confirmar o refutar el análisis de causa raíz.

**Test Plan**: Escribir tests que simulen el flujo de cada bug y ejecutarlos sobre el código sin fixear para observar los fallos.

**Test Cases**:
1. **Bug 1 — React batching test**: Simular `sendMessage` y verificar que `analyzingModules` es visible durante loading (fallará en código sin fixear — el estado será null siempre)
2. **Bug 2 — General question snippets test**: Invocar `buildRepoContext` con `focusModules` (simulando pregunta general) y verificar que incluye sourceContent (demostrará el bug)
3. **Bug 3 — Hardcoded counter test**: Renderizar `chat_panel` con `analyzingModules=["a","b","c"]` y verificar que el texto contiene "1/3" (demostrará el bug)

**Expected Counterexamples**:
- Bug 1: `analyzingModules` nunca es distinto de null durante el ciclo de vida del componente
- Bug 2: El contexto generado para pregunta general incluye `--- Código fuente ---` de múltiples módulos
- Bug 3: El texto renderizado contiene "Analizando (1/3)..." en lugar del formato correcto

### Fix Checking

**Goal**: Verificar que para todos los inputs donde la condición de bug se cumple, la función fixeada produce el comportamiento esperado.

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := fixedFunction(input)
  ASSERT expectedBehavior(result)
END FOR
```

**Bug 1:**
```
FOR ALL response WHERE response.analyzingModules.length > 0 DO
  call sendMessage(text)
  ASSERT analyzingModules == response.analyzingModules DURING isLoading == true
  call sendMessage(nextText)
  ASSERT analyzingModules == null AT START of sendMessage
END FOR
```

**Bug 2:**
```
FOR ALL modules, message WHERE isGeneralRepoQuestion(message, []) == true DO
  result := buildRepoContext(modules, { focusModules: modules, includeSnippets: false })
  ASSERT result DOES NOT CONTAIN any module's sourceContent
  ASSERT result CONTAINS all modules' metadata (name, path, specStatus, etc.)
END FOR
```

**Bug 3:**
```
FOR ALL analyzingModules WHERE analyzingModules.length > 0 DO
  rendered := render(<ChatPanel />, { analyzingModules })
  ASSERT rendered CONTAINS `Analizando ${analyzingModules.length} módulo`
  ASSERT rendered DOES NOT CONTAIN "1/"
END FOR
```

### Preservation Checking

**Goal**: Verificar que para todos los inputs donde la condición de bug NO se cumple, la función fixeada produce el mismo resultado que la original.

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT originalFunction(input) = fixedFunction(input)
END FOR
```

**Testing Approach**: Property-based testing es recomendado para preservation checking porque:
- Genera muchos test cases automáticamente sobre el dominio de inputs
- Detecta edge cases que tests manuales podrían omitir
- Provee garantías fuertes de que el comportamiento no cambió para inputs no-buggy

**Test Plan**: Observar comportamiento en código sin fixear para inputs no-buggy, luego escribir property-based tests que capturan ese comportamiento.

**Test Cases**:
1. **buildRepoContext con includeSnippets=true**: Verificar que produce exactamente el mismo output que la versión original cuando includeSnippets no se especifica o es true
2. **buildRepoContext sin focusModules**: Verificar que sigue excluyendo sourceContent de todos los módulos
3. **clearChat preservation**: Verificar que `clearChat` sigue reseteando todo el estado correctamente
4. **"Pensando..." preservation**: Verificar que cuando analyzingModules es null/vacío, se muestra "Pensando..."

### Unit Tests

- `detectMentionedModules`: multi-match (devuelve todos los mencionados), deduplicación (mismo módulo mencionado 2 veces → aparece 1 vez), caso vacío (mensaje vacío / módulos vacíos)
- `isGeneralRepoQuestion`: keyword + módulo mencionado → false, solo keyword → true, nada → false
- `buildRepoContext` con `focusModules` array: snippets truncados a 500/300, `includeSnippets: false` excluye código
- `buildRepoContext` backward compatibility: `focusModule` (deprecated singular) sigue funcionando
- `useChat` sendMessage: analyzingModules se setea cuando llega respuesta, se limpia al inicio del próximo send
- `chat_panel.tsx`: texto correcto con 1 módulo ("Analizando 1 módulo..."), con N módulos ("Analizando N módulos...")

### Property-Based Tests

- Generar arrays aleatorios de ModuleNode con sourceContent y verificar que `buildRepoContext` con `includeSnippets: false` NUNCA incluye sourceContent de ningún módulo (Property 2)
- Generar arrays aleatorios de ModuleNode y verificar que `buildRepoContext` con `includeSnippets: true` produce output idéntico al comportamiento actual (Property 4)
- Generar mensajes aleatorios y arrays de módulos, verificar que `detectMentionedModules` no produce duplicados y respeta case-insensitivity
- Generar mensajes con keywords generales + módulos mencionados, verificar que `isGeneralRepoQuestion` retorna false cuando `mentionedModules.length > 0`
- Actualizar property tests existentes (Property 13, 15) para usar `focusModules` array en vez de `focusModule` deprecated

### Integration Tests

- Test end-to-end del endpoint POST /api/chat con pregunta general → verificar que la respuesta es coherente y el contexto no incluye snippets
- Test end-to-end con pregunta sobre módulo específico → verificar que focusModules incluye snippets
- Test del flujo completo de UI: sendMessage → loading con módulos → respuesta → siguiente sendMessage limpia estado
