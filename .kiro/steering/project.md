---
inclusion: always
---

# TrazIA — Project Steering

## ¿Qué es este proyecto?

TrazIA es una herramienta de trazabilidad de intención para repositorios de código. El desarrollador pega la URL de un repo y en segundos obtiene un grafo interactivo de su arquitectura coloreado según **qué módulos tienen spec real y cuáles son caja negra** — con un click, un agente genera la spec faltante en sintaxis EARS, lista para guardarse en `.kiro/specs/`.

TrazIA infiere la intención **sin asumir el origen del código**. Funciona igual en código generado con IA sin spec previa que en código escrito a mano hace años sin documentar. En ambos casos el síntoma es el mismo: nadie sabe qué partes del repo se entienden y cuáles son deuda invisible.

Importante: cuando el repo no tiene spec previa, TrazIA no "recupera" un documento perdido — **genera una spec nueva, inferida hoy**, que adopta la convención Kiro (EARS + `.kiro/specs/`) sobre un código que nunca la tuvo. Es documentación retroactiva, no arqueología. Por eso toda spec generada por el Redactor EARS se trata como **propuesta a confirmar**, no como verdad verificada, hasta que un humano la revisa (ver stretch goal "Edición de spec antes de guardar").

El núcleo del producto no es el grafo: es la trazabilidad. El grafo es la interfaz para navegar un concepto más profundo: ¿qué partes de este código alguien realmente *entendió* y documentó su intención, y cuáles existen sin dejar rastro de por qué?

En la práctica, TrazIA funciona como un **Visualizador de Arquitectura**: el objetivo es que un desarrollador pueda entender un proyecto complejo en pocos minutos, sin tener que abrir decenas de archivos uno por uno. La aplicación "lee" el código y construye un mapa interactivo de cómo está organizado el proyecto y cómo se relacionan sus componentes — y ese mismo mapa es el que se colorea según el estado de trazabilidad de cada módulo.

### Funcionalidades centrales (MVP)

0. **Carga del proyecto** — el usuario puede iniciar el análisis de tres formas:
   - Arrastrar una carpeta (drag-folder)
   - Conectar un repositorio de GitHub
   - Clonar un repositorio mediante una URL

   En todos los casos, la aplicación analiza la estructura del proyecto **sin necesidad de ejecutarlo** (análisis estático). Ver "Alcance estricto del MVP" para qué modos de carga están comprometidos en los 5 días vs. cuáles quedan como stretch goal.

1. **Pipeline de agentes** que corren como funciones Lambda invocando Claude vía AWS Bedrock:
   - **Agente Analizador** — mapea módulos, dependencias y estructura real del código (análisis estático, sin ejecutar el proyecto)
   - **Agente Redactor EARS** — infiere qué requisito cumple cada módulo (leyendo código, nombres, comentarios y mensajes de commit) y redacta un `requirements.md` retroactivo en sintaxis EARS; no asume origen IA ni código reciente — funciona igual con cualquier codebase.
     - **EARS es la fuente canónica**, no solo un formato de salida: al ser estructurada (`WHEN <trigger> the <system> SHALL <response>`), es lo que permite comparación mecánica contra el código para drift-checking y Spec Health Score.
     - Para el desarrollador que nunca usó Kiro, el grafo no muestra EARS crudo: muestra un **resumen legible en prosa, derivado automáticamente de la spec EARS**, como capa de presentación. El EARS completo queda disponible al expandir el nodo o al guardar en `.kiro/specs/`. Así no se pierde la estructura que sostiene el resto del roadmap, pero tampoco se le exige al usuario aprender la sintaxis para entender qué hace su código.
   - **Agente Orquestador** — calcula el **Spec Health Score** por módulo y a nivel proyecto

2. **Visualización** con grafo interactivo (react-flow) coloreado por estado de trazabilidad:
   - 🟢 trazado — tiene spec vigente
   - 🟡 drift — spec existe pero está desactualizada respecto al código
   - 🔴 sin trazabilidad — caja negra, no hay spec

3. **Generación on-demand** — click en un nodo rojo → el agente genera la spec faltante en vivo en EARS, lista para guardarse

### Alcance estricto del MVP (lo que se compromete en 5 días)

- Input: solo URL de GitHub pública (cubre tanto "conectar repositorio" como "clonar por URL" — son el mismo mecanismo por debajo)
- Stack analizado: solo TypeScript/JavaScript
- Grafo estático (carpetas + imports), sin trazas de runtime
- Analizador + Redactor EARS + Spec Health Score de punta a punta
- Output guardado en `.kiro/specs/` del repo analizado

### Stretch goals (solo día 4+ si van adelantados)

- Drift-checker contra specs existentes
- Generador de steering (`product.md` / `tech.md` / `structure.md`)
- Soporte multi-lenguaje
- Edición de spec antes de guardar
- Input por carpeta local (drag-folder)

## Stack tecnológico

- **Backend:** Node.js / TypeScript
- **Frontend:** React + react-flow (grafo interactivo)
- **Agentes:** AWS Lambda (una función por agente)
- **IA:** AWS Bedrock en `sa-east-1` (São Paulo), vía AnthropicBedrockMantle
  (`@anthropic-ai/bedrock-sdk`) — `anthropic.claude-haiku-4-5` (Analizador),
  `anthropic.claude-sonnet-4-6` (Redactor EARS). IDs y región por variable
  de entorno, nunca hardcodeados.
- **Persistencia:** DynamoDB (histórico de Spec Health Score), S3 (hosting frontend)
- **Specs del producto:** formato EARS, guardadas en `.kiro/specs/`

## Estructura del proyecto

```
backend/
  agents/
    analyzer/      → Agente Analizador (mapeo de módulos y dependencias)
    ears-writer/   → Agente Redactor EARS (inferencia y redacción de specs)
    orchestrator/  → Agente Orquestador (Spec Health Score)
  shared/          → tipos TypeScript compartidos, contrato JSON entre 
frontend/          → aplicación React con react-flow
.kiro/
  specs/           → specs EARS del propio proyecto trazIA
  steering/        → este archivo y convenciones
```

Cada agente vive en su propia carpeta bajo `packages/backend/src/agents/` y se despliega como una función Lambda independiente.

## Uso de Kiro en el proyecto

El producto final *es* la estructura de Kiro generada y visualizada — no es decorativo. TrazIA usa specs EARS para su propio desarrollo (spec-driven), y el output que genera se guarda directo en `.kiro/specs/` del repo analizado. Kiro es tanto la herramienta de construcción como la demostración viva del concepto.

Esta convención de Kiro (EARS + `.kiro/specs/`) se aplica **aunque el repo analizado nunca haya usado Kiro**: un sistema puede tener specs sin haber sido construido con Kiro, porque "spec" es un concepto independiente de la herramienta — Kiro aporta la convención (formato + ubicación), no el concepto en sí. TrazIA elige mantener EARS como formato de salida (y no documentación genérica en prosa libre) porque es lo que habilita drift-checking y Spec Health Score de forma verificable; la prosa libre es más amigable de leer pero mucho más difícil de comparar automáticamente contra el código.