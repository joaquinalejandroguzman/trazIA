# TrazIA

*Hackathon Código Facilito x AWS Kiro — Reto 🟨 Productividad y herramientas para desarrolladores*

> Pegás la URL de un repo y en segundos ves un mapa interactivo de tu arquitectura, coloreado según qué partes tienen trazabilidad de intención real y cuáles son una caja negra. Con un click, un agente genera la spec faltante en sintaxis EARS, lista para guardarse en `.kiro/specs/`.

---

## Instalación

Requiere **Node.js 18+** y **npm 9+** (con soporte de workspaces).

```bash
# Clonar el repositorio
git clone https://github.com/tu-org/trazia.git
cd trazia

# Instalar todas las dependencias del monorepo (backend + frontend)
npm install
```

Esto instala las dependencias de `packages/backend` y `packages/frontend` en una sola operación gracias a los npm workspaces.

---

## Comandos de desarrollo

Ejecutar desde el directorio raíz del monorepo:

```bash
# Levantar backend y frontend en paralelo (hot-reload)
npm run dev

# Compilar backend y frontend para producción
npm run build

# Ejecutar ESLint en todos los paquetes
npm run lint

# Ejecutar todos los tests del monorepo
npm run test
```

Ejecutar desde un paquete específico:

```bash
# Solo el backend
cd packages/backend
npm run dev      # ts-node-dev con hot-reload en http://localhost:3001
npm run build    # compila TypeScript a dist/
npm run lint     # ESLint sobre src/**/*.ts
npm run test     # Jest

# Solo el frontend
cd packages/frontend
npm run dev      # Vite dev server con HMR en http://localhost:5173
npm run build    # tsc + vite build para producción
npm run lint     # ESLint sobre src/**/*.{ts,tsx}
npm run test     # Vitest
```

---

## Estructura del proyecto

```
trazia/                          ← workspace root
├── package.json                 ← scripts raíz, declaración de workspaces
├── tsconfig.base.json           ← configuración TypeScript base compartida
├── .eslintrc.json               ← configuración ESLint base compartida
├── .gitignore
├── .husky/
│   ├── pre-commit               ← hook: lint-staged
│   └── commit-msg               ← hook: commitlint
├── .commitlintrc.json           ← reglas Conventional Commits
├── .lintstagedrc.json           ← configuración lint-staged
├── README.md
└── packages/
    ├── backend/                 ← servidor Node.js/TypeScript
    │   ├── package.json
    │   ├── tsconfig.json        ← extiende ../../tsconfig.base.json
    │   ├── .env.example
    │   └── src/
    │       ├── app.ts           ← punto de entrada Express
    │       ├── routes/          ← definición de rutas
    │       ├── services/        ← lógica de negocio (agentes)
    │       ├── types/           ← tipos TypeScript del backend
    │       └── utils/           ← utilidades compartidas
    └── frontend/                ← aplicación React + Vite
        ├── package.json
        ├── vite.config.ts
        ├── tsconfig.json        ← extiende ../../tsconfig.base.json
        ├── .env.example
        └── src/
            ├── main.tsx         ← punto de entrada Vite
            ├── App.tsx
            ├── components/
            │   └── architecture_graph.tsx  ← grafo interactivo React Flow
            ├── hooks/           ← hooks personalizados de React
            ├── services/
            │   └── api_client.ts           ← cliente HTTP configurado
            └── types/           ← tipos TypeScript del frontend
```

---

## Variables de entorno

Cada paquete incluye un archivo `.env.example` con las variables requeridas. Copiar el ejemplo y ajustar los valores antes de arrancar en local:

```bash
cp packages/backend/.env.example packages/backend/.env
cp packages/frontend/.env.example packages/frontend/.env
```

### Backend (`packages/backend/.env`)

| Variable | Por defecto | Descripción |
|----------|-------------|-------------|
| `PORT`   | `3001`      | Puerto donde escucha el servidor Express |

### Frontend (`packages/frontend/.env`)

| Variable        | Por defecto              | Descripción |
|-----------------|--------------------------|-------------|
| `VITE_API_URL`  | `http://localhost:3001`  | URL base del backend |

> Las variables con prefijo `VITE_` son expuestas al cliente por Vite. No incluir secretos con ese prefijo.

---

## El problema que resuelve

El código se acumula más rápido de lo que se documenta — sea porque se generó con IA sin spec previa, o porque un dev lo escribió a mano hace años sin dejar rastro de por qué existe. En ambos casos el síntoma es el mismo: nadie sabe qué partes del repo se entienden y cuáles son deuda invisible, hasta que se rompe algo o entra alguien nuevo al equipo.

## Cómo funciona

1. **Carga:** URL de GitHub pública. Análisis estático, sin necesidad de ejecutar el proyecto.
2. **Pipeline de agentes (Lambda + Bedrock):**
   - **Agente Analizador** — mapea módulos, dependencias y estructura del código
   - **Agente Redactor EARS** — infiere el requisito que cumple cada módulo y redacta un `requirements.md` retroactivo
   - **Agente Orquestador** — calcula el **Spec Health Score** por módulo y a nivel proyecto
3. **Visualización:** grafo interactivo coloreado por estado de trazabilidad:
   - 🟢 trazado — tiene spec vigente
   - 🟡 drift — spec desactualizada respecto al código
   - 🔴 sin trazabilidad — caja negra, no hay spec
4. **Interacción:** click en un nodo rojo → el agente genera la spec faltante en vivo, en sintaxis EARS

## Stack tecnológico

- **Backend:** Node.js / TypeScript / Express
- **Frontend:** React + Vite + React Flow (`@xyflow/react`)
- **Agentes:** AWS Lambda (una función por agente)
- **IA:** AWS Bedrock — Claude Haiku (Analizador) y Claude Sonnet (Redactor EARS)
- **Persistencia:** DynamoDB (histórico de Spec Health Score), S3 (hosting frontend)
