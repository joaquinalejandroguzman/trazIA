---
inclusion: always
---

# TrazIA — Project Steering

## ¿Qué es este proyecto?

TrazIA es un **escáner de arquitectura** para repositorios de código. El desarrollador pasa un repositorio (por drag-folder, conectando GitHub, o clonando por URL) y en segundos obtiene un **grafo interactivo** de cómo está organizado el proyecto: carpetas, archivos, integraciones entre módulos, conexiones a bases de datos e integraciones con APIs externas.

El objetivo es que un desarrollador que abre el proyecto **por primera vez** pueda entenderlo en pocos minutos, sin tener que abrir decenas de archivos uno por uno para reconstruir mentalmente cómo se conecta todo. TrazIA hace ese trabajo de reconocimiento por él: lee el código, detecta la estructura real y la dibuja.

El núcleo del producto no es solo el árbol de carpetas — eso ya lo muestra cualquier IDE. El valor está en que el grafo también expone las conexiones que normalmente están escondidas en el código: qué módulo habla con qué base de datos, qué endpoints externos consume cada parte del sistema, y cómo se relacionan los componentes entre sí.

### Funcionalidades centrales (MVP)

0. **Carga del proyecto** — el usuario puede iniciar el escaneo de tres formas:
   - Arrastrar una carpeta (drag-folder)
   - Conectar un repositorio de GitHub
   - Clonar un repositorio mediante una URL

   En todos los casos, la aplicación analiza la estructura del proyecto **sin necesidad de ejecutarlo** (análisis estático).

1. **Pipeline de agentes** que corren como funciones Lambda invocando Claude vía AWS Bedrock:
   - **Agente Analizador** — mapea carpetas, archivos, módulos y dependencias internas (imports) a partir de análisis estático, sin ejecutar el proyecto
   - **Agente de Integraciones** — recorre el código buscando puntos de conexión externos: clientes de base de datos (drivers, ORMs, connection strings), llamadas a APIs externas (fetch/axios/SDKs de terceros), variables de entorno relacionadas a servicios externos, y colas/mensajería si las hay
   - **Agente Orquestador** — combina el mapa de estructura con las integraciones detectadas y arma el grafo final que consume el frontend

2. **Visualización** con grafo interactivo (react-flow):
   - Nodos de **carpetas/archivos**, agrupados por su ubicación real en el árbol del proyecto
   - Nodos de **integración** diferenciados visualmente (color/ícono distinto) para bases de datos y APIs externas, conectados por una arista al módulo que los usa
   - Click en un nodo → panel de detalle: ruta del archivo, imports/exports, y en el caso de integraciones, qué se detectó (ej. "usa `pg` para conectar a Postgres", "llama a `api.stripe.com`")

3. **Vista de resumen** del proyecto: cantidad de módulos, cantidad de integraciones detectadas (bases de datos y APIs), y lenguaje/stack predominante — un primer vistazo rápido antes de entrar al grafo

### Alcance estricto del MVP (lo que se compromete en 5 días)

- Input: solo URL de GitHub pública (cubre tanto "conectar repositorio" como "clonar por URL" — son el mismo mecanismo por debajo)
- Stack analizado: todos los archivos relevantes del repositorio; las aristas de dependencia (imports) se extraen solo en TS/JS, pero todos los archivos aparecen como nodos en el grafo
- Grafo estático (carpetas + imports + integraciones detectadas por patrones de código), sin trazas de runtime
- Detección de integraciones limitada a patrones comunes y explícitos en el código (imports de drivers de BD conocidos, llamadas HTTP a dominios externos, SDKs de terceros reconocibles)
- Analizador + Agente de Integraciones + Orquestador de punta a punta

### Stretch goals (solo día 4+ si van adelantados)

- Input por carpeta local (drag-folder)
- Soporte multi-lenguaje
- Detección de integraciones más profunda (colas, websockets, variables de entorno no explícitas)
- Exportar el grafo (imagen o JSON)
- Buscar/filtrar nodos por nombre, tipo o integración

## Stack tecnológico

- **Backend:** Node.js / TypeScript
- **Frontend:** React + react-flow (grafo interactivo)
- **Agentes:** AWS Lambda (una función por agente)
- **IA:** AWS Bedrock en `sa-east-1` (São Paulo), vía AnthropicBedrockMantle
  (`@anthropic-ai/bedrock-sdk`) — `anthropic.claude-haiku-4-5` (Analizador),
  `anthropic.claude-sonnet-4-6` (Agente de Integraciones). IDs y región por
  variable de entorno, nunca hardcodeados.
- **Persistencia:** DynamoDB (caché de escaneos ya realizados, para no re-analizar el mismo repo en cada visita), S3 (hosting frontend)

## Estructura del proyecto

```
backend/
  agents/
    analyzer/         → Agente Analizador (mapeo de carpetas, archivos y dependencias internas)
    integrations/      → Agente de Integraciones (detección de BD y APIs externas)
    orchestrator/      → Agente Orquestador (arma el grafo final)
  shared/              → tipos TypeScript compartidos, contrato JSON entre 
frontend/              → aplicación React con react-flow
.kiro/
  steering/            → este archivo y convenciones
```

Cada agente vive en su propia carpeta bajo `packages/backend/src/agents/` y se despliega como una función Lambda independiente.