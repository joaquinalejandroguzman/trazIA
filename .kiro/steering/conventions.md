---
inclusion: manual
---

# Convenciones y Estándares

Este archivo es de inclusión MANUAL — actívalo en el chat con `#conventions` cuando quieras que Kiro lo tenga en cuenta.
Úsalo para reglas detalladas de código, patrones a seguir y anti-patrones a evitar.

---
- Comentarios y mensajes de error en español
- Commits en formato Conventional Commits

## Nomenclatura

- Variables: camelCase en TypeScript y React
- Funciones: verbos en snake_case → get_user_by_id()
- Clases: PascalCase → UserService
- Constantes: UPPER_SNAKE_CASE → MAX_RETRIES
- Archivos: snake_case → user_service.jsx

## Patrones preferidos

- Dependency injection en servicios
- Hooks personalizados en React para lógica reutilizable

## Anti-patrones (evitar)

- No usar lógica de negocio directamente en los endpoints
- No hacer queries directas a BD desde los componentes React
- No usar any en TypeScript

## Manejo de errores

- Siempre loggear errores con contexto suficiente
- Retornar errores HTTP con estructura { error: string, detail: string }
