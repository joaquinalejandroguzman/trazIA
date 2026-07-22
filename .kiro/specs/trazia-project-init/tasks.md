# Implementation Plan: trazia-project-init

## Overview

Crear la estructura base del monorepo TrazIA (npm workspaces) con backend Node.js/TypeScript, frontend React + Vite + React Flow, tooling de calidad (ESLint, Husky, commitlint, lint-staged) y scripts de workspace. El resultado es un árbol de archivos reproducible desde el que el equipo puede comenzar a desarrollar sin configuración adicional.

---

## Tasks

- [ ] 1. Inicializar estructura raíz del monorepo
  - Crear `package.json` raíz con `name: "trazia"`, `version: "0.1.0"`, `private: true`, y campo `workspaces: ["packages/backend", "packages/frontend"]`
  - Crear `tsconfig.base.json` con `strict: true`, `noImplicitAny: true`, `esModuleInterop: true`, `skipLibCheck: true`, `forceConsistentCasingInFileNames: true`, `resolveJsonModule: true`
  - Crear `.eslintrc.json` raíz con reglas `@typescript-eslint/no-explicit-any`, `camelcase` y `@typescript-eslint/naming-convention` (PascalCase para clases/interfaces, UPPER_SNAKE_CASE para `const` de módulo)
  - Crear `.gitignore` excluyendo: `node_modules/`, `dist/`, `.env`, `coverage/`, `*.lcov`, `*.log`, `logs/`
  - Crear `README.md` con secciones "Instalación", "Comandos de desarrollo", "Estructura del proyecto" y "Variables de entorno"
  - _Requirements: 1.1, 1.5, 5.1_

- [ ] 2. Configurar paquete backend
  - [ ] 2.1 Crear estructura de archivos del backend
    - Crear `packages/backend/package.json` con scripts `build` (`tsc`), `dev` (`ts-node-dev --respawn --transpile-only src/app.ts`), `lint` (`eslint "src/**/*.ts"`), `test` (`jest --passWithNoTests`)
    - Crear `packages/backend/tsconfig.json` extendiendo `../../tsconfig.base.json` con `module: "commonjs"`, `target: "ES2020"`, `outDir: "dist"`
    - Crear directorios `src/routes/`, `src/services/`, `src/types/`, `src/utils/` con `.gitkeep` en cada uno
    - Crear `packages/backend/.env.example` con `PORT=3001`
    - _Requirements: 1.2, 2.1, 2.6, 2.8, 4.7_

  - [ ] 2.2 Implementar servidor Express con endpoint `/health`
    - Crear `src/types/health.ts` con la interfaz `HealthCheckResponse { status: "ok"; service: "trazia-backend" }`
    - Crear `src/routes/health.ts` con el router Express para `GET /health` que responda `200`, `Content-Type: application/json` y el body exacto
    - Crear `src/app.ts` que lea `process.env.PORT` (fallback `3001`), configure Express, monte las rutas y exporte `app` y `startServer`; el servidor arranca solo cuando es el módulo de entrada
    - Implementar la función `connectOptionalService` en `src/utils/` siguiendo el patrón de manejo de errores del diseño (`{ agente, módulo, servicio, url, error }` a `stderr`, sin relanzar)
    - _Requirements: 2.2, 2.3, 2.7_

  - [ ]* 2.3 Escribir tests unitarios del backend
    - Test en `app.test.ts`: `GET /health` devuelve `200` y el body correcto
    - Test en `app.test.ts`: servidor arranca en `PORT=3001` cuando la variable no está definida
    - Test en `startupError.test.ts`: servicio externo que falla durante el arranque no detiene el servidor
    - _Requirements: 2.2, 2.3, 2.7_

  - [ ]* 2.4 Escribir property tests del backend (fast-check + Jest)
    - **Property 1: PORT environment variable resolution** — para cualquier entero en [1, 65535], el servidor escucha exactamente en ese puerto
    - **Property 2: PORT fallback when unset** — cuando `PORT` no está definida, el servidor escucha en `3001`
    - **Property 3: Health check response invariant** — para cualquier combinación de headers extras, `GET /health` responde `200`, `Content-Type: application/json` y body exactamente `{ "status": "ok", "service": "trazia-backend" }`
    - Cada `fc.assert` con mínimo `{ numRuns: 100 }` y tag de comentario `// Feature: trazia-project-init, Property N: <texto>`
    - _Requirements: 2.2, 2.3_

- [ ] 3. Checkpoint — Verificar backend
  - Asegúrate de que `tsc --noEmit` sale con código `0` en `packages/backend` y todos los tests pasan. Consulta al usuario si surgen dudas.

- [ ] 4. Configurar paquete frontend
  - [ ] 4.1 Crear estructura de archivos del frontend
    - Crear `packages/frontend/package.json` con scripts `dev` (`vite`), `build` (`tsc && vite build`), `lint` (`eslint "src/**/*.{ts,tsx}"`), `test` (`vitest run`)
    - Crear `packages/frontend/tsconfig.json` extendiendo `../../tsconfig.base.json` con `module: "ESNext"`, `target: "ES2020"`, `jsx: "react-jsx"`
    - Crear `packages/frontend/vite.config.ts` con `@vitejs/plugin-react` habilitado
    - Crear directorios `src/components/`, `src/hooks/`, `src/services/`, `src/types/` con `.gitkeep` donde sea necesario
    - Crear `packages/frontend/.env.example` con `VITE_API_URL=http://localhost:3001`
    - _Requirements: 1.3, 3.1, 3.5, 3.6, 4.7_

  - [ ] 4.2 Implementar componentes y servicios del frontend
    - Crear `src/main.tsx` (punto de entrada Vite con `ReactDOM.createRoot`)
    - Crear `src/App.tsx` que monte `<ArchitectureGraph />`
    - Crear `src/components/architecture_graph.tsx` con el componente `ArchitectureGraph` que renderice un `<ReactFlow>` vacío (0 nodos, 0 aristas) sin errores de consola
    - Crear `src/services/api_client.ts` que lea `import.meta.env.VITE_API_URL`, use `http://localhost:3001` como fallback y exporte la instancia como `export default`
    - _Requirements: 3.2, 3.3, 3.6, 3.7_

  - [ ]* 4.3 Escribir tests unitarios del frontend (Vitest + Testing Library)
    - Test en `api_client.test.ts`: cuando `VITE_API_URL` no está definida, la URL base es `http://localhost:3001`
    - Test en `architecture_graph.test.tsx`: el componente monta sin errores y el contenedor de React Flow está presente en el DOM
    - _Requirements: 3.2, 3.7_

  - [ ]* 4.4 Escribir property test del frontend (Vitest + fast-check)
    - **Property 4: VITE_API_URL resolution** — para cualquier URL válida en `VITE_API_URL`, `api_client.ts` usa exactamente esa URL como base
    - `fc.assert` con mínimo `{ numRuns: 100 }` y tag `// Feature: trazia-project-init, Property 4: VITE_API_URL resolution`
    - _Requirements: 3.7_

- [ ] 5. Checkpoint — Verificar frontend
  - Asegúrate de que `tsc --noEmit` y `npm run build` salen con código `0` en `packages/frontend` y todos los tests pasan. Consulta al usuario si surgen dudas.

- [ ] 6. Configurar scripts raíz del workspace
  - Añadir al `package.json` raíz:
    - `dev`: `concurrently "npm run dev -w packages/backend" "npm run dev -w packages/frontend"` (sin `--kill-others-on-fail`)
    - `build`: `npm-run-all build:backend build:frontend` (secuencial)
    - `lint`: `npm-run-all lint:backend lint:frontend` (secuencial)
    - `test`: `npm-run-all test:backend test:frontend` (secuencial)
    - Scripts auxiliares `build:backend`, `build:frontend`, `lint:backend`, `lint:frontend`, `test:backend`, `test:frontend` delegando a cada workspace
  - Añadir `concurrently` y `npm-run-all` como `devDependencies` en `package.json` raíz
  - _Requirements: 4.1, 4.2, 4.3, 4.6_

- [ ] 7. Configurar Git hooks (Husky + lint-staged + commitlint)
  - Instalar y configurar `husky` en la raíz; crear `.husky/pre-commit` que ejecute `lint-staged`
  - Crear `.husky/commit-msg` que ejecute `commitlint --edit $1`
  - Crear `.lintstagedrc.json` que aplique `eslint --fix` a archivos `*.ts` y `*.tsx` staged
  - Crear `.commitlintrc.json` con `@commitlint/config-conventional` y tipos válidos: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`
  - Añadir `husky`, `lint-staged`, `@commitlint/cli`, `@commitlint/config-conventional` como `devDependencies` en `package.json` raíz
  - _Requirements: 5.2, 5.3, 5.4, 5.5_

- [ ] 8. Checkpoint final — Verificar integración completa
  - Asegúrate de que `npm install` desde la raíz completa sin errores, `npm run lint` produce 0 errores, `npm run build` sale con código `0`, y todos los tests del workspace pasan. Consulta al usuario si surgen dudas.

---

## Notes

- Las tareas marcadas con `*` son opcionales y pueden omitirse para un MVP más rápido
- El diseño usa TypeScript en todo el stack — no es necesario elegir lenguaje
- Los tests de propiedad usan `fast-check` (backend: Jest, frontend: Vitest)
- Cada test de propiedad lleva el tag `// Feature: trazia-project-init, Property N: <texto>`
- Los checkpoints garantizan validación incremental antes de avanzar a la siguiente capa
- La función `connectOptionalService` debe seguir el patrón `{ agente, módulo, servicio, url, error }` definido en `conventions.md`

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["2.1", "4.1"] },
    { "id": 1, "tasks": ["2.2", "4.2"] },
    { "id": 2, "tasks": ["2.3", "2.4", "4.3", "4.4"] },
    { "id": 3, "tasks": ["6"] },
    { "id": 4, "tasks": ["7"] }
  ]
}
```
