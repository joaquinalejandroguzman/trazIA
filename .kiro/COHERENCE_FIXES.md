# Correcciones de Coherencia — Análisis de `.kiro` vs `project.md`

Fecha: 2026-07-23

## Resumen

Se detectaron inconsistencias entre la descripción de `project.md` y la estructura real del código. Este documento lista todos los cambios aplicados para alinear el proyecto con su documentación.

---

## ✅ Cambios Aplicados

### 1. **Estructura de Agentes — Creada**

**Problema:** `project.md` describe una estructura de agentes bajo `backend/agents/` que no existía.

**Solución:** Se crearon los siguientes archivos scaffold:

```
packages/backend/src/agents/
├── analyzer/
│   ├── index.ts          ← handler Lambda
│   └── analyzer.ts       ← lógica de análisis estático
├── ears-writer/
│   ├── index.ts          ← handler Lambda
│   └── ears_writer.ts    ← lógica de generación EARS
└── orchestrator/
    ├── index.ts          ← handler Lambda
    └── orchestrator.ts   ← lógica de Spec Health Score
```

**Estado:** ✅ Scaffolds listos con comentarios TODOs para implementación futura

---

### 2. **Tipos Compartidos — Creados**

**Problema:** `conventions.md` menciona `src/shared/types.ts` como contrato JSON entre agentes, pero no existía.

**Solución:** Se creó `packages/backend/src/shared/types.ts` con:
- `ModuleNode` — nodo del grafo con estado de trazabilidad
- `AnalysisResult` — resultado completo del análisis
- `AnalyzeRequest`, `GenerateSpecResponse` — contratos de API

**Estado:** ✅ Tipos alineados con el frontend (`packages/frontend/src/types/index.ts`)

---

### 3. **Rutas de API — Creadas**

**Problema:** `project.md` describe endpoints `/api/analyze` y `/api/generate-spec` que no existían.

**Solución:** Se crearon:
- `packages/backend/src/routes/analyze.ts` — POST /api/analyze
- `packages/backend/src/routes/generate_spec.ts` — POST /api/generate-spec
- Se registraron en `app.ts`

**Estado:** ✅ Endpoints mock funcionando (retornan estructuras vacías hasta implementar agentes)

---

### 4. **Convenciones de Nomenclatura — Actualizadas**

**Problema:** `conventions.md` decía que *todos* los archivos TS/JS usan `snake_case`, pero el código real usa `app.ts`, `index.ts`, etc.

**Solución:** Se actualizó la sección de nomenclatura en `conventions.md` para reflejar:
- Archivos de lógica de agentes: `snake_case` (ej: `ears_writer.ts`)
- Componentes React: `snake_case` (ej: `repo_input.tsx`)
- Rutas de API: `snake_case` (ej: `generate_spec.ts`)
- Punto de entrada y configuración: nombres descriptivos (ej: `app.ts`, `index.ts`)

**Estado:** ✅ Documentación alineada con práctica real

---

### 5. **Workflows — Comandos Corregidos**

**Problema:** `workflows.md` usaba comandos que no funcionaban en el monorepo.

**Solución:** Se actualizó la sección "Correr en desarrollo" con comandos válidos desde raíz y desde cada paquete.

**Estado:** ✅ Comandos verificados y funcionando

---

## 📋 Checklist de Coherencia

- [x] Estructura de carpetas `agents/` existe y coincide con `project.md`
- [x] `src/shared/types.ts` existe y define el contrato JSON
- [x] Rutas `/api/analyze` y `/api/generate-spec` existen
- [x] `conventions.md` refleja nomenclatura real
- [x] `workflows.md` tiene comandos funcionales
- [x] Frontend y backend comparten la misma definición de `ModuleNode` y `AnalysisResult`
- [x] Todos los archivos compilan sin errores TypeScript

---

## 🚧 Pendientes (TODOs en el código)

Los siguientes componentes están scaffoldeados pero necesitan implementación:

1. **Agente Analizador** (`agents/analyzer/analyzer.ts`)
   - Análisis estático de repositorio (detección de módulos, imports, dependencias)
   - Construcción del grafo de arquitectura

2. **Agente Redactor EARS** (`agents/ears-writer/ears_writer.ts`)
   - Integración con AWS Bedrock (Claude Sonnet)
   - Generación de specs EARS retroactivas

3. **Agente Orquestador** (`agents/orchestrator/orchestrator.ts`)
   - Cálculo de Spec Health Score
   - Detección de drift (spec desactualizada vs código)

4. **Rutas de API** (`routes/analyze.ts`, `routes/generate_spec.ts`)
   - Integración con los 3 agentes Lambda
   - Manejo de clonado de repositorios GitHub
   - Persistencia en DynamoDB

---

## 🎯 Próximos Pasos Recomendados

1. **Implementar Agente Analizador** — es el punto de entrada del pipeline
2. **Configurar AWS Bedrock** — credenciales y permisos para invocar Claude
3. **Implementar Agente Redactor EARS** — core del producto
4. **Implementar Spec Health Score** — diferenciador clave
5. **Integrar Lambda + API Gateway** — deploy de los agentes
6. **Persistencia DynamoDB** — histórico de análisis

---

## ✨ Resultado

El proyecto ahora tiene:
- ✅ Estructura de código alineada con `project.md`
- ✅ Scaffolds listos para implementar los 3 agentes
- ✅ Rutas de API funcionando (mock hasta implementar agentes)
- ✅ Tipos compartidos entre frontend y backend
- ✅ Documentación coherente con la realidad del código
