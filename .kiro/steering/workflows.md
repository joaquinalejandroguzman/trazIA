---
inclusion: manual
---

# Workflows y Comandos

Actívalo en el chat con `#workflows` cuando necesites que Kiro conozca los comandos del proyecto.

---

## Instalación

```bash
npm install
```

## Correr en desarrollo

```bash
# Backend (desde packages/backend)
npm run dev

# Frontend (desde packages/frontend)
npm run dev

# O desde el raíz del monorepo
npm run dev --workspace=frontend
npm run dev --workspace=backend
```

## Build

```bash
npm run build
```

## Deploy (Lambda)

<!-- Completar cuando esté definida la estrategia de deploy — SAM, CDK o serverless framework -->

## Tests

```bash
npm run test
```

## Variables de entorno

<!-- Sin valores — solo nombres y propósito -->

- `AWS_REGION` → región donde corre Bedrock y Lambda (ej: sa-east-1)
- `BEDROCK_MODEL_ANALYZER` → ID del modelo Claude para el Agente Analizador (ej: anthropic.claude-haiku-4-5)
- `BEDROCK_MODEL_INTEGRATIONS` → ID del modelo Claude para el Agente de Integraciones (ej: anthropic.claude-sonnet-4-6)
- `DYNAMODB_TABLE_SCANS` → nombre de la tabla DynamoDB para caché de escaneos ya realizados
