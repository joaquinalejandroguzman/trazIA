# Bugfix Requirements Document

## Introduction

El feature de chat multi-módulo tiene 3 bugs que afectan la experiencia del usuario y el rendimiento del backend:

1. **Bug Crítico — Estado `analyzingModules` es código muerto**: En `use_chat.ts`, React batchea `setAnalyzingModules(responseModules)` y `setAnalyzingModules(null)` en el mismo ciclo async, por lo que el componente nunca renderiza el estado intermedio de "analizando módulos".

2. **Bug Medio — Preguntas generales envían todo el sourceContent**: En `chat.ts`, cuando `isGeneralRepoQuestion` es true, `focusModules = modules` (todos), lo que resulta en que `buildRepoContext` incluye snippets de código fuente de todos los módulos (potencialmente miles de caracteres innecesarios en el prompt del LLM).

3. **Bug Medio — Contador "1/N" hardcodeado**: En `chat_panel.tsx`, el texto `Analizando (1/${analyzingModules.length})...` muestra un "1" estático que nunca avanza, simulando un progreso falso.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN el usuario envía un mensaje y la respuesta del backend incluye `analyzingModules` con módulos THEN el sistema ejecuta `setAnalyzingModules(responseModules)` seguido inmediatamente de `setAnalyzingModules(null)` en el mismo handler async, y React batchea ambas actualizaciones resultando en que el componente nunca renderiza el estado de "analizando módulos"

1.2 WHEN el usuario hace una pregunta general sobre el repositorio (isGeneralRepoQuestion === true) THEN el sistema pasa todos los módulos como `focusModules` a `buildRepoContext`, incluyendo el `sourceContent` truncado de cada módulo en el prompt del LLM, generando contextos de 15.000+ caracteres innecesarios

1.3 WHEN el componente `chat_panel.tsx` muestra el indicador de carga con módulos siendo analizados THEN el sistema muestra `Analizando (1/${analyzingModules.length})...` con el número "1" hardcodeado que nunca cambia, simulando un progreso falso

### Expected Behavior (Correct)

2.1 WHEN el usuario envía un mensaje THEN el sistema SHALL limpiar `analyzingModules` a null al inicio de `sendMessage` (antes del fetch), y cuando la respuesta llega con módulos analizados SHALL setear `analyzingModules` con el array de módulos — de forma que el estado sea visible durante todo el periodo de loading y se limpie solo al enviar el próximo mensaje

2.2 WHEN el usuario hace una pregunta general sobre el repositorio (isGeneralRepoQuestion === true) THEN el sistema SHALL pasar los módulos como `focusModules` pero sin incluir `sourceContent` de ninguno (solo metadata: nombre, path, dependencias), mediante una opción `includeSnippets: boolean` en `buildRepoContext` que sea false para preguntas generales

2.3 WHEN el componente muestra el indicador de carga con módulos siendo analizados THEN el sistema SHALL mostrar `Analizando X módulos...` (donde X es `analyzingModules.length`) sin el formato "1/N" que simula progreso inexistente

### Unchanged Behavior (Regression Prevention)

3.1 WHEN el usuario envía un mensaje y la respuesta NO incluye `analyzingModules` o el array está vacío THEN el sistema SHALL CONTINUE TO mostrar solo "Pensando..." como indicador de carga

3.2 WHEN el usuario hace una pregunta que menciona módulos específicos (no es pregunta general) THEN el sistema SHALL CONTINUE TO incluir `sourceContent` truncado de los módulos mencionados en el contexto del LLM (comportamiento actual de focusModules con snippets)

3.3 WHEN el usuario usa `clearChat()` THEN el sistema SHALL CONTINUE TO resetear `analyzingModules` a null y generar un nuevo sessionId

3.4 WHEN `buildRepoContext` es invocado sin `focusModules` THEN el sistema SHALL CONTINUE TO excluir `sourceContent` de todos los módulos (comportamiento actual sin focus)

3.5 WHEN `buildRepoContext` es invocado con `focusModules` y `includeSnippets` no se especifica o es true THEN el sistema SHALL CONTINUE TO incluir snippets truncados según el límite (500/300 chars) — backward compatibility

3.6 WHEN el chat está en estado de loading sin módulos analizados THEN el sistema SHALL CONTINUE TO mostrar el spinner con texto "Pensando..."
