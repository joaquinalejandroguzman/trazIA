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

- `AWS_REGION` → región donde corre Bedrock y Lambda
- `BEDROCK_MODEL_ANALYZER` → ID del modelo Claude para el Agente Analizador (ej: Haiku)
- `BEDROCK_MODEL_EARS_WRITER` → ID del modelo Claude para el Agente Redactor EARS (ej: Sonnet)
- `DYNAMODB_TABLE_SCORES` → nombre de la tabla DynamoDB para el histórico de Spec Health Score
