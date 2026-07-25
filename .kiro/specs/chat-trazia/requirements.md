# Requirements Document

## Introduction

Este documento define los requisitos para un chat contextual integrado en TrazIA. El chat permite al usuario hacer preguntas sobre la estructura del repositorio analizado, usando como contexto los metadatos del grafo de módulos (sin código fuente). Un router determinístico clasifica la intención del mensaje antes de decidir si invocar al LLM, optimizando costos y latencia.

## Glossary

- **Sistema_Chat**: Subsistema backend que expone el endpoint de chat y orquesta la generación de respuestas.
- **Router_Intención**: Componente determinístico que clasifica el mensaje del usuario en categorías (saludo, offtopic, jailbreak, pregunta sobre el repo) sin invocar al LLM.
- **Constructor_Contexto**: Componente que arma el prompt de contexto a partir de los metadatos del grafo de módulos y el README.
- **Cliente_LLM**: Instancia compartida de AnthropicBedrock usada para generar respuestas (modelo Haiku).
- **Historial_Sesión**: Almacenamiento en memoria de los últimos mensajes de la conversación para una sesión dada.
- **ModuleNode**: Tipo existente que representa un módulo en el grafo de arquitectura (id, name, path, type, dependencies, specStatus, specHealthScore).
- **Mensaje_Usuario**: Texto enviado por el usuario al endpoint de chat (máximo 1000 caracteres).
- **Respuesta_Asistente**: Texto generado por el Sistema_Chat como reply al Mensaje_Usuario.
- **ChatPanel**: Componente React que renderiza el panel flotante de chat, incluyendo el botón de activación, el área de mensajes y el input.
- **Panel_Spec**: Panel lateral existente que muestra el contenido de una spec EARS generada para un módulo seleccionado.
- **Detección_Módulo**: Lógica dentro del Router o del Constructor_Contexto que identifica si el mensaje del usuario hace referencia a un módulo específico del grafo por nombre o path.

## Requirements

### Requisito 1: Endpoint de Chat

**User Story:** Como usuario de TrazIA, quiero enviar preguntas sobre el repositorio analizado a través de un endpoint de chat, para obtener respuestas contextuales sin tener que inspeccionar el grafo manualmente.

#### Criterios de Aceptación

1. THE Sistema_Chat SHALL exponer un endpoint POST /api/chat que acepte un cuerpo JSON con los campos: message (string), modules (ModuleNode[]), y readme (string, opcional).
2. WHEN el Sistema_Chat recibe una petición válida, THE Sistema_Chat SHALL devolver una respuesta JSON con el campo reply (string).
3. IF el campo message está ausente o vacío, THEN THE Sistema_Chat SHALL devolver HTTP 400 con un mensaje de error descriptivo.
4. IF el campo modules está ausente o no es un array, THEN THE Sistema_Chat SHALL devolver HTTP 400 con un mensaje de error descriptivo.

### Requisito 2: Router de Intención

**User Story:** Como operador del sistema, quiero que los saludos, mensajes offtopic y ataques de prompt injection se manejen sin invocar al LLM, para reducir costos y latencia.

#### Criterios de Aceptación

1. WHEN el Mensaje_Usuario es un saludo (contiene patrones como "hola", "buenos días", "qué tal", "hey"), THE Router_Intención SHALL clasificarlo como saludo y THE Sistema_Chat SHALL responder con un mensaje fijo de bienvenida sin invocar al Cliente_LLM.
2. WHEN el Mensaje_Usuario es un intento de jailbreak o prompt injection (contiene patrones como "ignore previous instructions", "olvidá las instrucciones", "actúa como", "sos un"), THE Router_Intención SHALL clasificarlo como jailbreak y THE Sistema_Chat SHALL responder con un mensaje de rechazo fijo sin invocar al Cliente_LLM.
3. WHEN el Mensaje_Usuario no está relacionado con el repositorio ni es un saludo ni es jailbreak (contiene preguntas sobre clima, política, deportes, u otros temas no técnicos), THE Router_Intención SHALL clasificarlo como offtopic y THE Sistema_Chat SHALL responder: "Eso no está relacionado con el repositorio. Podés preguntar sobre la estructura, módulos o dependencias del código."
4. WHEN el Mensaje_Usuario es una pregunta sobre la estructura, módulos, dependencias o estado de trazabilidad del repositorio, THE Router_Intención SHALL clasificarlo como pregunta_repo y THE Sistema_Chat SHALL continuar al paso de generación con el Cliente_LLM.
5. THE Router_Intención SHALL permitir agregar nuevas reglas de clasificación sin modificar el endpoint ni otros componentes del sistema.

### Requisito 3: Construcción de Contexto para el LLM

**User Story:** Como usuario, quiero que las respuestas del chat estén basadas en la estructura real del repositorio, para que sean precisas y relevantes.

#### Criterios de Aceptación

1. WHEN el Router_Intención clasifica un mensaje como pregunta_repo, THE Constructor_Contexto SHALL generar un contexto que incluya: id, name, path y type de cada módulo; dependencias de cada módulo; y estado de trazabilidad (specStatus, specHealthScore) de cada módulo.
2. WHEN el campo readme está presente en la petición, THE Constructor_Contexto SHALL incluir el contenido del README truncado a un máximo de 3000 caracteres.
3. THE Constructor_Contexto SHALL excluir del contexto el código fuente completo de los módulos (campo sourceContent de ModuleNode).
4. THE Constructor_Contexto SHALL excluir del contexto el contenido de specs EARS generadas (campo earsSpec de ModuleNode).

### Requisito 4: Invocación del LLM

**User Story:** Como usuario, quiero recibir respuestas generadas por IA que sean coherentes y rápidas, para resolver mis dudas sobre el repositorio ágilmente.

#### Criterios de Aceptación

1. THE Sistema_Chat SHALL usar la instancia compartida de AnthropicBedrock (bedrockClient) para generar respuestas.
2. THE Sistema_Chat SHALL usar el modelo global.anthropic.claude-haiku-4-5-20251001-v1:0 para todas las invocaciones de chat.
3. THE Sistema_Chat SHALL configurar el parámetro temperature en 0.3 para las invocaciones al LLM.
4. THE Sistema_Chat SHALL configurar un timeout de 30 segundos para cada invocación al LLM.
5. THE Sistema_Chat SHALL separar la lógica de construcción del system prompt en un módulo independiente del endpoint.

### Requisito 5: Historial de Conversación

**User Story:** Como usuario, quiero que el chat recuerde mis preguntas anteriores en la misma sesión, para poder mantener conversaciones con contexto.

#### Criterios de Aceptación

1. THE Historial_Sesión SHALL mantener los últimos 8 mensajes (pares usuario/asistente) por sesión.
2. WHEN la cantidad de mensajes almacenados supera 8, THE Historial_Sesión SHALL descartar los mensajes más antiguos manteniendo solo los 8 más recientes.
3. THE Sistema_Chat SHALL incluir el Historial_Sesión en cada invocación al Cliente_LLM como parte del array de mensajes.
4. THE Historial_Sesión SHALL almacenarse en memoria del proceso (sin persistencia en base de datos).

### Requisito 6: Manejo de Errores

**User Story:** Como usuario, quiero recibir mensajes claros cuando algo falla, para saber si debo reintentar o reformular mi pregunta.

#### Criterios de Aceptación

1. WHEN el Cliente_LLM devuelve un error de throttling (HTTP 429) o error transitorio, THE Sistema_Chat SHALL reintentar la invocación usando la utilidad withLlmRetry con backoff exponencial.
2. WHEN el Cliente_LLM devuelve un error no transitorio después de agotar los reintentos, THE Sistema_Chat SHALL devolver { reply: "Error al generar respuesta. Intentá de nuevo." } con HTTP 200.
3. WHEN el timeout de 30 segundos se excede sin respuesta del LLM, THE Sistema_Chat SHALL devolver { reply: "La respuesta tardó demasiado. Intentá con una pregunta más corta." } con HTTP 200.

### Requisito 7: Sanitización de Input

**User Story:** Como operador del sistema, quiero que el input del usuario esté sanitizado, para prevenir abusos y proteger la estabilidad del servicio.

#### Criterios de Aceptación

1. WHEN el Mensaje_Usuario excede 1000 caracteres, THE Sistema_Chat SHALL truncar el mensaje a 1000 caracteres antes de procesarlo.
2. THE Sistema_Chat SHALL no revelar el system prompt ni las instrucciones internas del LLM en ninguna respuesta al usuario.

### Requisito 8: Rendimiento

**User Story:** Como usuario, quiero que las respuestas del chat sean rápidas, para no perder el flujo de trabajo al explorar el repositorio.

#### Criterios de Aceptación

1. THE Sistema_Chat SHALL responder en menos de 5 segundos para preguntas típicas sobre la estructura del repositorio (excluyendo latencia de red del cliente).
2. THE Sistema_Chat SHALL usar el modelo Haiku (global.anthropic.claude-haiku-4-5-20251001-v1:0) en vez de Sonnet para optimizar velocidad y costo de las respuestas de chat.

### Requisito 9: Interfaz de Usuario del Chat

**User Story:** Como usuario de TrazIA, quiero interactuar con el chat a través de un panel flotante elegante y responsivo, para hacer preguntas sin perder de vista el grafo de arquitectura.

#### Criterios de Aceptación

1. THE ChatPanel SHALL renderizar un botón flotante circular en la esquina inferior derecha con ícono de chat.
2. WHEN el usuario clickea el botón flotante, THE ChatPanel SHALL abrir un panel de chat flotante sobre el grafo con animación suave de apertura.
3. THE ChatPanel SHALL mantener el grafo visible detrás del panel (el panel NO modifica el layout existente).
4. THE ChatPanel SHALL incluir un header con el nombre del asistente.
5. THE ChatPanel SHALL incluir un área de mensajes diferenciando visualmente mensajes del usuario y del asistente.
6. THE ChatPanel SHALL incluir un input de texto con botón enviar.
7. WHILE el Sistema_Chat está procesando una respuesta, THE ChatPanel SHALL mostrar un spinner con el texto "Pensando...".
8. WHEN el usuario clickea el botón de cerrar O presiona la tecla Escape, THE ChatPanel SHALL cerrar el panel con animación suave.
9. THE ChatPanel SHALL ser responsive y funcional en desktop y mobile.
10. THE ChatPanel SHALL usar un z-index alto para renderizarse por encima del grafo de arquitectura.

### Requisito 10: Coexistencia del Chat con el Panel de Specs

**User Story:** Como usuario de TrazIA, quiero poder usar el chat y el panel de specs al mismo tiempo, para consultar sobre el repo mientras genero especificaciones.

#### Criterios de Aceptación

1. WHEN el panel de spec está cerrado, THE ChatPanel SHALL posicionarse en la esquina inferior derecha.
2. WHEN el panel de spec está abierto, THE ChatPanel SHALL reposicionarse a la izquierda del panel de spec para evitar superposición.
3. THE ChatPanel SHALL permitir que ambos paneles (chat y specs) estén abiertos simultáneamente.
4. IF hay conflicto visual entre el chat y el panel de spec, THEN THE ChatPanel SHALL ceder prioridad visual al panel de spec reposicionándose.
5. WHEN el usuario cierra el panel de spec, THE ChatPanel SHALL NO cerrarse y SHALL volver a su posición original en la esquina inferior derecha.
6. WHEN el usuario cierra el ChatPanel, THE Panel_Spec SHALL NO verse afectado.

### Requisito 11: Contexto Enriquecido por Módulo Específico

**User Story:** Como usuario de TrazIA, quiero que cuando pregunto por un módulo específico ("¿Qué hace payments.ts?"), el chat incluya el código fuente de ese módulo en el contexto del LLM, para obtener respuestas detalladas sobre su comportamiento.

#### Criterios de Aceptación

1. WHEN el Mensaje_Usuario menciona un módulo específico por nombre (e.g., "¿Qué hace payments.ts?", "explicame el módulo auth"), THE Router_Intención SHALL detectar la mención del módulo y THE Sistema_Chat SHALL buscar ese módulo en el array de ModuleNode[] recibido.
2. WHEN el módulo mencionado existe en el array de modules, THE Constructor_Contexto SHALL incluir el campo sourceContent de ese módulo específico en el contexto enviado al LLM, además de la estructura general (metadatos de todos los módulos).
3. WHEN el módulo mencionado NO existe en el array de modules, THE Sistema_Chat SHALL responder con un mensaje fijo: "No encontré ese módulo en el repositorio. Podés preguntar por cualquier módulo que aparezca en el grafo."
4. THE Constructor_Contexto SHALL incluir el sourceContent de como máximo 1 módulo por pregunta, para mantener el consumo de tokens bajo.
5. WHEN el Mensaje_Usuario no menciona ningún módulo específico, THE Constructor_Contexto SHALL enviar solo la estructura general (metadatos) + README sin código fuente (comportamiento existente del Requisito 3).
