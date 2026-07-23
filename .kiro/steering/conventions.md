---
inclusion: always
---

# Convenciones y Estándares

## Nomenclatura

- **Variables y funciones:** camelCase → `getSpecScore()`, `repoUrl`
- **Clases e interfaces:** PascalCase → `AnalyzerAgent`, `ModuleNode`
- **Constantes:** UPPER_SNAKE_CASE → `MAX_RETRIES`, `BEDROCK_REGION`
- **Archivos TypeScript/JS:** snake_case para lógica de agentes y utilidades → `ears_writer.ts`, `spec_health_score.ts`
  - Excepciones: archivos de rutas en frontend (componentes React) usan snake_case → `repo_input.tsx`, `architecture_graph.tsx`
  - Excepciones: archivos de rutas de API usan snake_case → `generate_spec.ts`
  - Archivos de punto de entrada y configuración pueden usar nombres descriptivos → `app.ts`, `index.ts`
- **Comentarios:** en español, siempre

## Estructura de agentes

Cada agente vive en su propia carpeta bajo `packages/backend/src/agents/`:

```
packages/backend/src/agents/<nombre-agente>/
  index.ts        → handler Lambda (punto de entrada)
  <nombre>.ts     → lógica principal del agente
  types.ts        → tipos locales del agente (si los hay)
```

Los tipos y contratos compartidos entre agentes van en `packages/backend/src/shared/`.

## Contrato JSON entre agentes

Los agentes se comunican con un contrato JSON estricto. Todo tipo compartido vive en `src/shared/types.ts`. Ejemplo de estructura base:

```typescript
// Nodo del grafo que todos los agentes conocen
interface ModuleNode {
  id: string;           // ruta relativa del módulo
  name: string;
  specStatus: 'traced' | 'drift' | 'untraced';
  specHealthScore: number; // 0–100
  dependencies: string[]; // ids de otros ModuleNode
}
```

Cualquier cambio al contrato requiere actualizar `src/shared/types.ts` y los agentes que lo consumen.

## Patrones preferidos

- **Un agente, una responsabilidad** — el Analizador no infiere specs, el Redactor EARS no calcula scores
- **Sin estado entre invocaciones Lambda** — cada llamada es stateless; el estado persiste en DynamoDB
- **Tipos explícitos en TypeScript** — no usar `any`; si el tipo es desconocido, usar `unknown` y narrowing
- **Errores con contexto** — loggear siempre con `{ agente, módulo, error }` para facilitar debugging en CloudWatch
- **Dependency injection en servicios** — las dependencias se pasan como parámetro, no se instancian adentro; facilita testear los agentes sin AWS
- **Hooks personalizados en React** para la lógica reutilizable del frontend

## Anti-patrones (evitar)

- No poner lógica de negocio directamente en el handler Lambda (`index.ts`)
- No hacer llamadas a Bedrock desde el frontend — siempre a través de la API
- No asumir que el repo analizado tiene estructura conocida — todo acceso al árbol de archivos debe ser defensivo
- No usar `any` en TypeScript
- No mezclar recursos AWS entre las dos cuentas del equipo en producción

## Commits

Formato Conventional Commits:

```
feat: agrega cálculo de Spec Health Score por módulo
fix: corrige parsing de imports circulares en el Analizador
chore: actualiza tipos compartidos del contrato entre agentes
docs: actualiza steering con convenciones de agentes
```

Tipos válidos: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `ci`
