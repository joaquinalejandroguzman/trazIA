# Requirements Document

## Introduction

Este documento describe los requisitos para la inicialización del proyecto trazIA: un visualizador de arquitectura de código que analiza repositorios y construye un mapa interactivo de sus componentes y relaciones. La inicialización comprende la estructura base del monorepo, el backend en Node.js/TypeScript y el frontend en React + React Flow, listos para el desarrollo del producto.

## Glossary

- **Project_Initializer**: El proceso o script responsable de generar la estructura base del proyecto.
- **Backend**: El servidor Node.js/TypeScript que expone la API REST y orquesta los agentes de análisis.
- **Frontend**: La aplicación React que renderiza el grafo interactivo de arquitectura usando React Flow.
- **Monorepo**: Estructura de repositorio único que contiene tanto el Backend como el Frontend bajo carpetas separadas (`packages/backend` y `packages/frontend`).
- **Workspace**: El directorio raíz del monorepo donde residen los archivos de configuración compartidos.
- **Dev_Server**: Proceso de desarrollo que sirve el Frontend con hot-reload.
- **TypeScript_Compiler**: Herramienta que compila los archivos `.ts` del Backend a JavaScript ejecutable.
- **Linter**: Herramienta ESLint configurada para aplicar las convenciones del proyecto.
- **Health_Check**: Endpoint del Backend que confirma que el servidor está operativo.
- **ArchitectureGraph**: Componente React base que renderiza el grafo interactivo de arquitectura usando `@xyflow/react`.

## Requirements

### Requirement 1: Estructura del Monorepo

**User Story:** Como desarrollador del equipo, quiero una estructura de monorepo bien organizada, para que tanto el backend como el frontend compartan configuración de base y puedan desarrollarse de forma independiente sin conflictos de dependencias.

#### Acceptance Criteria

1. THE Project_Initializer SHALL crear un directorio raíz cuyo `package.json` incluya un campo `workspaces` con al menos `["packages/backend", "packages/frontend"]`, junto con los archivos `.gitignore`, `.eslintrc`, y `tsconfig.base.json`.
2. THE Project_Initializer SHALL crear el paquete `packages/backend` con su propio `package.json`, un `tsconfig.json` que extienda `../../tsconfig.base.json`, y un directorio `src/` vacío rastreable por Git (con `.gitkeep` si es necesario).
3. THE Project_Initializer SHALL crear el paquete `packages/frontend` con su propio `package.json` y un directorio `src/` vacío rastreable por Git (con `.gitkeep` si es necesario).
4. WHEN el desarrollador ejecuta `npm install` desde el directorio raíz, THE Workspace SHALL instalar las dependencias de `packages/backend` y `packages/frontend` en una sola operación, creando sus respectivos `node_modules` sin errores.
5. THE Project_Initializer SHALL crear un archivo `README.md` en el directorio raíz que contenga al menos las siguientes secciones: "Instalación", "Comandos de desarrollo", "Estructura del proyecto" y "Variables de entorno".
6. WHEN el desarrollador ejecuta `npm run dev` o `npm run build` desde `packages/backend` o `packages/frontend` de forma aislada, THE Workspace SHALL completar la operación sin errores de dependencias faltantes.

---

### Requirement 2: Configuración del Backend (Node.js/TypeScript)

**User Story:** Como desarrollador del equipo, quiero un backend Node.js/TypeScript configurado con las convenciones del proyecto, para que pueda comenzar a implementar los agentes de análisis sin perder tiempo en configuración.

#### Acceptance Criteria

1. THE Backend SHALL tener un `tsconfig.json` con `"strict": true` y `"noImplicitAny": true`; WHEN `tsc --noEmit` se ejecuta sobre el código base inicial, THE TypeScript_Compiler SHALL completar con código de salida `0`.
2. THE Backend SHALL tener un servidor HTTP Express que, al iniciarse, lea la variable de entorno `PORT` y escuche en ese puerto; IF `PORT` no está definida, THEN THE Backend SHALL usar el valor por defecto `3001`.
3. WHEN el Backend recibe una petición `GET /health`, THE Backend SHALL responder con código HTTP `200`, cabecera `Content-Type: application/json`, y cuerpo exacto `{ "status": "ok", "service": "trazia-backend" }`.
4. THE Backend SHALL tener ESLint configurado con las siguientes reglas activas y en modo `error`: `@typescript-eslint/no-explicit-any`, `camelcase` (para variables y parámetros), `@typescript-eslint/naming-convention` para PascalCase en clases e interfaces, y UPPER_SNAKE_CASE en variables declaradas con `const` a nivel de módulo; WHEN `npm run lint` se ejecuta sobre el código inicial, THE Linter SHALL producir `0` errores.
5. WHEN el TypeScript_Compiler encuentra un error de tipos durante `npm run build`, THE Backend SHALL terminar el proceso de compilación con un código de salida distinto de cero y mostrar el mensaje de error con archivo y número de línea.
6. THE Backend SHALL incluir los siguientes scripts en su `package.json`: `build` (ejecuta `tsc`), `dev` (inicia el servidor con hot-reload mediante `ts-node-dev` o `nodemon`), `lint` (ejecuta `eslint "src/**/*.ts"`), y `test` (ejecuta la suite de pruebas con Jest).
7. IF el Backend no puede conectarse a un servicio externo configurado durante el arranque, THEN THE Backend SHALL registrar un mensaje de error en `stderr` que incluya el nombre del servicio, la URL intentada y el mensaje de error original, y SHALL continuar el proceso de arranque.
8. THE Backend SHALL tener la siguiente estructura de carpetas en `src/`: `routes/`, `services/`, `types/`, `utils/`, y el archivo de punto de entrada `app.ts`.

---

### Requirement 3: Configuración del Frontend (React + React Flow)

**User Story:** Como desarrollador del equipo, quiero un frontend React con React Flow preconfigurado y las convenciones del proyecto aplicadas, para que pueda comenzar a implementar el grafo de arquitectura sin configuración adicional.

#### Acceptance Criteria

1. THE Frontend SHALL estar configurado con Vite como herramienta de build con los plugins `@vitejs/plugin-react` y TypeScript habilitado; WHEN `npm run build` se ejecuta en `packages/frontend`, THE build SHALL completar con código de salida `0` sin errores de TypeScript.
2. THE Frontend SHALL tener `@xyflow/react` instalado como dependencia de producción y un componente `ArchitectureGraph` ubicado en `src/components/architecture_graph.tsx` que, cuando se renderice, monte un grafo con exactamente 0 nodos y 0 aristas sin arrojar excepciones ni errores en la consola del navegador.
3. WHEN el Dev_Server arranca mediante `npm run dev`, THE Frontend SHALL estar disponible en `http://localhost:5173` dentro de los primeros 30 segundos y el DOM SHALL contener el componente `ArchitectureGraph` montado sin errores de hidratación.
4. THE Frontend SHALL tener ESLint configurado con las reglas `@typescript-eslint/no-explicit-any`, `camelcase`, y `@typescript-eslint/naming-convention` (PascalCase para componentes y clases); WHEN `npm run lint` se ejecuta, THE Linter SHALL producir `0` errores en los archivos `.tsx` y `.ts`.
5. THE Frontend SHALL incluir los siguientes scripts en su `package.json`: `dev` (inicia el Dev_Server con Vite), `build` (compila para producción), `lint` (ejecuta ESLint), y `test` (ejecuta la suite de pruebas con Vitest).
6. THE Frontend SHALL tener la siguiente estructura de carpetas en `src/`: `components/` (con `.gitkeep`), `hooks/` (con `.gitkeep`), `services/`, `types/` (con `.gitkeep`), y los archivos de entrada `main.tsx` y `App.tsx`.
7. THE Frontend SHALL tener un módulo `src/services/api_client.ts` que: (a) lea la variable de entorno `VITE_API_URL` al inicializarse; (b) IF `VITE_API_URL` no está definida, use `http://localhost:3001` como URL base; (c) exporte la instancia configurada como export por defecto.

---

### Requirement 4: Integración y Scripts del Workspace

**User Story:** Como desarrollador del equipo, quiero poder levantar todo el proyecto con un solo comando desde la raíz, para que el proceso de desarrollo sea rápido y sin fricciones.

#### Acceptance Criteria

1. THE Workspace SHALL tener un script `dev` en el `package.json` raíz que inicie el Backend y el Frontend de forma concurrente usando `concurrently` o `npm-run-all`; WHEN se ejecuta, ambos procesos SHALL iniciarse sin que el fallo de uno detenga al otro.
2. THE Workspace SHALL tener un script `lint` en el `package.json` raíz que ejecute `npm run lint` en `packages/backend` y `packages/frontend` secuencialmente; WHEN se ejecuta, SHALL producir `0` errores de ESLint en el código base inicial.
3. THE Workspace SHALL tener un script `build` en el `package.json` raíz que compile el Backend y el Frontend secuencialmente; WHEN se ejecuta, SHALL completar con código de salida `0` en el código base inicial.
4. WHEN el desarrollador ejecuta `npm run dev` desde la raíz, THE Frontend Dev_Server SHALL responder con HTTP `200` en `http://localhost:5173` dentro de los primeros 30 segundos.
5. WHEN el desarrollador ejecuta `npm run dev` desde la raíz, THE Backend SHALL responder con HTTP `200` en `GET http://localhost:3001/health` dentro de los primeros 10 segundos.
6. IF alguno de los procesos concurrentes del script `dev` falla al arrancar, THEN THE Workspace SHALL mostrar en `stderr` el nombre del proceso que falló y el código de salida, sin silenciar el error.
7. THE Workspace SHALL incluir un archivo `.env.example` en `packages/backend` que liste `PORT` con el valor de ejemplo `3001`, y un archivo `.env.example` en `packages/frontend` que liste `VITE_API_URL` con el valor de ejemplo `http://localhost:3001`; todos los valores de ejemplo SHALL ser cadenas no vacías y no funcionales en producción.

---

### Requirement 5: Configuración de Control de Versiones y Calidad

**User Story:** Como desarrollador del equipo, quiero que el repositorio tenga configuradas las herramientas de control de calidad desde el inicio, para que todo el código commiteado cumpla con las convenciones acordadas.

#### Acceptance Criteria

1. THE Project_Initializer SHALL crear un archivo `.gitignore` en la raíz que excluya explícitamente: `node_modules/`, `dist/`, `.env`, `coverage/`, `*.lcov`, `*.log`, y `logs/`.
2. WHEN el desarrollador ejecuta `git commit`, THE Workspace SHALL ejecutar automáticamente `lint-staged` a través del hook `pre-commit` de Husky, el cual SHALL correr ESLint sobre los archivos `.ts` y `.tsx` staged antes de permitir que el commit se complete.
3. WHEN el desarrollador ejecuta `git commit`, THE Workspace SHALL validar el mensaje de commit en el hook `commit-msg` de Husky usando `commitlint`; el mensaje SHALL comenzar con uno de los siguientes tipos: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, o `revert`, seguido de dos puntos y un espacio.
4. IF el Linter detecta errores en los archivos staged durante el hook `pre-commit`, THEN THE Workspace SHALL rechazar el commit y mostrar en la salida la ruta del archivo, el número de línea, el nombre de la regla violada, y el mensaje de error para cada infracción encontrada.
5. IF el mensaje de commit no comienza con uno de los tipos de Conventional Commits válidos seguido de `: `, THEN THE Workspace SHALL rechazar el commit con un mensaje que indique el tipo inválido recibido y la lista de tipos aceptados.
