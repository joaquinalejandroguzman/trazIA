---
inclusion: always
---

# TrazIA — Project Steering

## ¿Qué es este proyecto?

TrazIA es una herramienta de trazabilidad de intención para repositorios de código. El desarrollador pega la URL de un repo y en segundos obtiene un grafo interactivo de su arquitectura coloreado según **qué módulos tienen spec real y cuáles son caja negra** — con un click, un agente genera la spec faltante en sintaxis EARS, lista para guardarse en `.kiro/specs/`.

TrazIA infiere la intención **sin asumir el origen del código**. Funciona igual en código generado con IA sin spec previa que en código escrito a mano hace años sin documentar. En ambos casos el síntoma es el mismo: nadie sabe qué partes del repo se entienden y cuáles son deuda invisible.

El núcleo del producto no es el grafo: es la trazabilidad. El grafo es la interfaz para navegar un concepto más profundo: ¿qué partes de este código alguien realmente *entendió* y documentó su intención, y cuáles existen sin dejar rastro de por qué?

### Funcionalidades centrales (MVP)

1. **Pipeline de agentes** que corren como funciones Lambda invocando Claude vía AWS Bedrock:
   - **Agente Analizador** — mapea módulos, dependencias y estructura real del código (análisis estático, sin ejecutar el proyecto)
   - **Agente Redactor EARS** — infiere qué requisito cumple cada módulo (leyendo código, nombres, comentarios y mensajes de commit) y redacta un `requirements.md` retroactivo en sintaxis EARS; no asume origen IA ni código reciente — funciona igual con cualquier codebase
   - **Agente Orquestador** — calcula el **Spec Health Score** por módulo y a nivel proyecto

2. **Visualización** con grafo interactivo (react-flow) coloreado por estado de trazabilidad:
   - 🟢 trazado — tiene spec vigente
   - 🟡 drift — spec existe pero está desactualizada respecto al código
   - 🔴 sin trazabilidad — caja negra, no hay spec

3. **Generación on-demand** — click en un nodo rojo → el agente genera la spec faltante en vivo en EARS, lista para guardarse

### Alcance estricto del MVP (lo que se compromete en 5 días)

- Input: solo URL de GitHub pública
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
