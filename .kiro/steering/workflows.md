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
# Backend / API
npm run dev

# Frontend
npm run dev --workspace=frontend
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
