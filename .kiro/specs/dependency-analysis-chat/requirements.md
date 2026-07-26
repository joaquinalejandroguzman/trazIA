# Requirements Document

## Introduction

Análisis de dependencias inversas en el chat de TrazIA. Cuando el usuario pregunta qué pasaría si elimina un módulo o consulta sobre sus dependientes, el sistema analiza el grafo inverso de dependencias y responde indicando qué módulos se verían afectados. Esta funcionalidad se integra en el flujo existente del chat contextual, reutilizando la infraestructura de detección de módulos y construcción de contexto.

## Glossary

- **Chat_Route**: Endpoint POST /api/chat que orquesta la clasificación de intención, detección de módulos, construcción de contexto e invocación al LLM.
- **Context_Builder**: Módulo responsable de construir el contexto textual del repositorio para el LLM, detectar módulos mencionados y clasificar tipos de preguntas.
- **Dependency_Detector**: Función `isDependencyQuestion` que determina si un mensaje del usuario es una pregunta sobre dependencias o eliminación de módulos.
- **Dependency_Analyzer**: Función `analyzeDependencies` que recorre el array de módulos y calcula las dependencias inversas de un módulo objetivo.
- **Inverse_Dependency**: Un módulo A es dependencia inversa de un módulo B si A tiene a B en su campo `dependencies`. Es decir, A importa a B.
- **Target_Module**: El módulo sobre el cual el usuario pregunta qué se rompería si se elimina.
- **Dependency_Context**: Sección de contexto enriquecido que se agrega al prompt del LLM con los resultados del análisis de dependencias inversas.
- **Prompt_Addendum**: Texto que se concatena al system prompt para instruir al LLM sobre cómo responder preguntas de análisis de dependencias.
- **ModuleNode**: Interfaz TypeScript que representa un módulo en el grafo de arquitectura, con campos id, name, type, dependencies, path, specStatus y specHealthScore.

## Requirements

### Requirement 1: Detección de preguntas de dependencia

**User Story:** Como usuario del chat, quiero que el sistema detecte automáticamente cuando pregunto sobre eliminación de un módulo o sus dependencias, para recibir un análisis de impacto sin tener que usar comandos especiales.

#### Acceptance Criteria

1. WHEN el usuario envía un mensaje que contiene al menos uno de los siguientes patrones de eliminación: "qué pasa si borro", "qué pasa si elimino", "qué pasa si quito", "qué se rompe si borro", "qué se rompe si elimino", "qué se rompe si quito", "qué afecta si borro", "qué afecta si elimino", "qué afecta si quito", THE Dependency_Detector SHALL retornar true.
2. WHEN el usuario envía un mensaje que contiene al menos uno de los siguientes patrones de consulta de dependencias: "dependencias de", "quién depende de", "quién usa", "quién importa", THE Dependency_Detector SHALL retornar true.
3. WHEN el usuario envía un mensaje que no contiene ninguno de los patrones definidos en los criterios 1 y 2, THE Dependency_Detector SHALL retornar false.
4. THE Dependency_Detector SHALL realizar la comparación de patrones de forma case-insensitive y accent-insensitive (tratar "qué" y "que", "quién" y "quien" como equivalentes).
5. WHEN el usuario envía un mensaje vacío o compuesto solo de whitespace, THE Dependency_Detector SHALL retornar false.
6. THE Dependency_Detector SHALL evaluar los patrones como substrings del mensaje: el patrón puede aparecer en cualquier posición del texto y con cualquier contenido antes o después.

### Requirement 2: Análisis de dependencias inversas

**User Story:** Como usuario del chat, quiero saber qué módulos se romperían si elimino un módulo específico, para evaluar el impacto antes de hacer cambios.

#### Acceptance Criteria

1. WHEN se invoca el análisis para un Target_Module y un array de ModuleNode[], THE Dependency_Analyzer SHALL retornar todos los ModuleNode cuyo campo `dependencies` contiene el ID del Target_Module.
2. WHEN el Target_Module no tiene ninguna Inverse_Dependency, THE Dependency_Analyzer SHALL retornar un array vacío.
3. THE Dependency_Analyzer SHALL retornar los módulos dependientes como objetos ModuleNode completos, no solo sus IDs.
4. THE Dependency_Analyzer SHALL excluir el Target_Module del resultado de dependencias inversas, incluso si el Target_Module lista su propio ID en su campo `dependencies`.
5. WHEN se pasan múltiples Target_Modules (array de ModuleNode[]), THE Dependency_Analyzer SHALL retornar la unión de dependencias inversas de cada uno, sin módulos duplicados en el resultado combinado, preservando el orden de aparición en el array de módulos de entrada.
6. IF el Target_Module no existe en el array de módulos proporcionado, THEN THE Dependency_Analyzer SHALL retornar un array vacío.
7. IF el array de módulos proporcionado está vacío, THEN THE Dependency_Analyzer SHALL retornar un array vacío.

### Requirement 3: Construcción de contexto de dependencias

**User Story:** Como sistema, quiero construir un bloque de contexto enriquecido con el análisis de dependencias para que el LLM pueda dar respuestas informadas sobre el impacto de eliminar un módulo.

#### Acceptance Criteria

1. WHEN se construye el Dependency_Context para un Target_Module con dependencias inversas, THE Context_Builder SHALL incluir el nombre y path de cada módulo que depende del Target_Module, con un módulo por línea precedido por guión ("- ").
2. WHEN se construye el Dependency_Context para un Target_Module sin dependencias inversas, THE Context_Builder SHALL incluir el texto "Ningún módulo depende de {nombre del Target_Module}".
3. THE Context_Builder SHALL incluir una línea con el texto "Total de módulos afectados: {N}" donde N es la cantidad de módulos que dependen del Target_Module.
4. THE Context_Builder SHALL generar el Dependency_Context con un encabezado "=== Análisis de Dependencias: {nombre} ===" consistente con el formato existente de buildRepoContext.
5. WHEN se construye el Dependency_Context, THE Context_Builder SHALL incluir una sección "Módulos de los que depende:" listando las dependencias directas del Target_Module (los módulos que el Target_Module importa) como información complementaria.

### Requirement 4: Addendum de prompt para análisis de dependencias

**User Story:** Como sistema, quiero instruir al LLM con un addendum específico cuando se detecta una pregunta de dependencias, para que la respuesta sea estructurada y precisa.

#### Acceptance Criteria

1. THE Prompt_Addendum SHALL instruir al LLM a listar los módulos afectados con un módulo por línea, indicando nombre y ruta.
2. THE Prompt_Addendum SHALL instruir al LLM a indicar explícitamente "no tiene dependencias inversas" cuando un módulo no es importado por ningún otro módulo.
3. THE Prompt_Addendum SHALL instruir al LLM a incluir la cantidad numérica de módulos afectados en la respuesta.
4. THE Prompt_Addendum SHALL ser una constante string exportada con el nombre DEPENDENCY_ANALYSIS_ADDENDUM desde packages/backend/src/agents/chat/prompt.ts.

### Requirement 5: Orquestación en la ruta de chat

**User Story:** Como sistema, quiero integrar la detección de preguntas de dependencia y el análisis de impacto en el flujo existente del endpoint de chat, para que las respuestas de dependencia se generen sin romper el comportamiento actual.

#### Acceptance Criteria

1. WHEN el Chat_Route recibe un mensaje clasificado como pregunta de repositorio y el Dependency_Detector retorna true y detectMentionedModules retorna al menos un módulo, THE Chat_Route SHALL invocar el Dependency_Analyzer pasando los módulos detectados como Target_Modules, insertando la invocación después de la detección de módulos y antes de la construcción de contexto.
2. WHEN el Dependency_Analyzer produce un Dependency_Context no vacío, THE Chat_Route SHALL concatenar el Dependency_Context después del contexto de repositorio existente (generado por buildRepoContext) dentro del campo system enviado al LLM.
3. WHEN el Dependency_Analyzer produce resultados, THE Chat_Route SHALL concatenar el DEPENDENCY_ANALYSIS_ADDENDUM al system prompt después de cualquier addendum existente (como GENERAL_REPO_ADDENDUM) y antes del bloque de contexto del repositorio.
4. WHEN el Dependency_Detector retorna false, THE Chat_Route SHALL ejecutar el flujo existente sin invocar al Dependency_Analyzer, produciendo una respuesta idéntica a la que se generaría sin la feature de dependencias integrada.
5. WHEN el Dependency_Detector retorna true pero detectMentionedModules retorna un array vacío, THE Chat_Route SHALL responder con el flujo existente sin invocar al Dependency_Analyzer.
6. IF el Dependency_Analyzer lanza un error, THEN THE Chat_Route SHALL registrar el error con contexto {agente, módulo, error} y continuar el flujo existente sin Dependency_Context ni Prompt_Addendum.

### Requirement 6: Tests unitarios y property-based

**User Story:** Como desarrollador, quiero tests exhaustivos del análisis de dependencias para garantizar corrección ante casos arbitrarios y evitar regresiones.

#### Acceptance Criteria

1. THE Context_Builder SHALL tener tests unitarios que verifiquen la detección correcta de patrones de preguntas de dependencia, cubriendo al menos: preguntas con "depende"/"dependencia" combinada con un nombre de módulo, preguntas con "quién usa"/"qué usa", y preguntas de eliminación ("qué pasa si borro").
2. THE Dependency_Analyzer SHALL tener un property test con al menos 100 ejecuciones que verifique: para cualquier grafo de módulos generado por fast-check (entre 1 y 20 ModuleNode con dependencies aleatorias válidas), todo módulo retornado como dependencia inversa de T efectivamente contiene T.id en su campo dependencies (propiedad de corrección).
3. THE Dependency_Analyzer SHALL tener un property test con al menos 100 ejecuciones que verifique: para cualquier grafo de módulos generado por fast-check (entre 1 y 20 ModuleNode), el Target_Module no aparece en su propio resultado de dependencias inversas (propiedad de exclusión).
4. THE Dependency_Analyzer SHALL tener un property test con al menos 100 ejecuciones que verifique: para cualquier grafo de módulos generado por fast-check (entre 1 y 20 ModuleNode), la cantidad de dependencias inversas retornadas es menor o igual al total de módulos menos uno (propiedad de cota superior).
5. THE Chat_Route SHALL tener un test de integración que verifique el flujo completo: mensaje de dependencia → detección → análisis → contexto → respuesta HTTP 200 con campos reply (string no vacío) y sessionId (string no vacío).
6. THE Dependency_Detector SHALL tener un property test de round-trip con al menos 100 ejecuciones: para cualquier patrón de dependencia concatenado con un nombre de módulo válido, isDependencyQuestion retorna true.
7. IF el array de modules pasado al Dependency_Analyzer está vacío, THEN THE Dependency_Analyzer SHALL retornar un array vacío sin lanzar error.
