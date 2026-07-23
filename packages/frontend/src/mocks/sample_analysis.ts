import type { AnalysisResult } from '../types'

// Datos de ejemplo basados en la estructura REAL del proyecto TrazIA
// Refleja la arquitectura de agentes (analyzer, ears-writer, orchestrator) + rutas + shared types
export const SAMPLE_ANALYSIS: AnalysisResult = {
  repoUrl: 'https://github.com/usuario/trazia-backend',
  analyzedAt: new Date().toISOString(),
  projectHealthScore: 58,
  totalModules: 18,
  tracedCount: 6,
  driftCount: 3,
  untracedCount: 9,
  modules: [
    // ============ Punto de entrada ============
    {
      id: 'packages/backend/src/app.ts',
      name: 'app.ts',
      path: 'packages/backend/src/app.ts',
      specStatus: 'traced',
      specHealthScore: 92,
      dependencies: [
        'packages/backend/src/routes/health.ts',
        'packages/backend/src/routes/analyze.ts',
        'packages/backend/src/routes/generate_spec.ts',
      ],
      linesOfCode: 58,
      lastModified: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      specContent: `# Servidor Express Principal

**WHEN** el servidor Express inicia
**THEN** el sistema **SHALL** registrar las rutas /health, /api/analyze y /api/generate-spec

**WHEN** se recibe una petición HTTP
**THEN** el sistema **SHALL** parsear el body como JSON mediante express.json()

**IF** el puerto no está definido en process.env.PORT
**THEN** el sistema **SHALL** usar 3001 como puerto por defecto`,
    },

    // ============ Rutas de API ============
    {
      id: 'packages/backend/src/routes/health.ts',
      name: 'routes/health',
      path: 'packages/backend/src/routes/health.ts',
      specStatus: 'traced',
      specHealthScore: 100,
      dependencies: [],
      linesOfCode: 24,
      lastModified: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
      specContent: `# Health Check Endpoint

**WHEN** se recibe GET /health
**THEN** el sistema **SHALL** responder con status 200 y body { "status": "ok", "service": "trazia-backend" }`,
    },
    {
      id: 'packages/backend/src/routes/analyze.ts',
      name: 'routes/analyze',
      path: 'packages/backend/src/routes/analyze.ts',
      specStatus: 'untraced',
      specHealthScore: 22,
      dependencies: [
        'packages/backend/src/shared/types.ts',
        'packages/backend/src/agents/analyzer/index.ts',
        'packages/backend/src/agents/orchestrator/index.ts',
      ],
      linesOfCode: 48,
      lastModified: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'packages/backend/src/routes/generate_spec.ts',
      name: 'routes/generate_spec',
      path: 'packages/backend/src/routes/generate_spec.ts',
      specStatus: 'untraced',
      specHealthScore: 18,
      dependencies: [
        'packages/backend/src/shared/types.ts',
        'packages/backend/src/agents/ears-writer/index.ts',
      ],
      linesOfCode: 52,
      lastModified: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    },

    // ============ Agente Analizador ============
    {
      id: 'packages/backend/src/agents/analyzer/index.ts',
      name: 'agents/analyzer/index',
      path: 'packages/backend/src/agents/analyzer/index.ts',
      specStatus: 'untraced',
      specHealthScore: 0,
      dependencies: ['packages/backend/src/agents/analyzer/analyzer.ts'],
      linesOfCode: 8,
      lastModified: new Date(Date.now() - 0.5 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'packages/backend/src/agents/analyzer/analyzer.ts',
      name: 'agents/analyzer/analyzer',
      path: 'packages/backend/src/agents/analyzer/analyzer.ts',
      specStatus: 'drift',
      specHealthScore: 45,
      dependencies: [
        'packages/backend/src/shared/types.ts',
        'packages/backend/src/utils/ast_parser.ts',
        'packages/backend/src/utils/dependency_graph.ts',
      ],
      linesOfCode: 18,
      lastModified: new Date(Date.now() - 0.5 * 60 * 60 * 1000).toISOString(),
      specContent: `# Agente Analizador de Repositorios

**WHEN** se recibe la ruta de un repositorio local
**THEN** el sistema **SHALL** escanear recursivamente todos los archivos .ts y .js

[⚠️ SPEC DESACTUALIZADA - código scaffold recién creado, falta implementar lógica]`,
    },

    // ============ Agente Redactor EARS ============
    {
      id: 'packages/backend/src/agents/ears-writer/index.ts',
      name: 'agents/ears-writer/index',
      path: 'packages/backend/src/agents/ears-writer/index.ts',
      specStatus: 'untraced',
      specHealthScore: 0,
      dependencies: ['packages/backend/src/agents/ears-writer/ears_writer.ts'],
      linesOfCode: 8,
      lastModified: new Date(Date.now() - 0.5 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'packages/backend/src/agents/ears-writer/ears_writer.ts',
      name: 'agents/ears-writer/ears_writer',
      path: 'packages/backend/src/agents/ears-writer/ears_writer.ts',
      specStatus: 'drift',
      specHealthScore: 38,
      dependencies: [
        'packages/backend/src/shared/types.ts',
        'packages/backend/src/services/bedrock_client.ts',
      ],
      linesOfCode: 24,
      lastModified: new Date(Date.now() - 0.5 * 60 * 60 * 1000).toISOString(),
      specContent: `# Agente Redactor EARS

**WHEN** se recibe código fuente de un módulo sin spec
**THEN** el sistema **SHALL** invocar Claude Sonnet vía AWS Bedrock para inferir su intención

[⚠️ SPEC DESACTUALIZADA - lógica de invocación a Bedrock aún no implementada]`,
    },

    // ============ Agente Orquestador ============
    {
      id: 'packages/backend/src/agents/orchestrator/index.ts',
      name: 'agents/orchestrator/index',
      path: 'packages/backend/src/agents/orchestrator/index.ts',
      specStatus: 'untraced',
      specHealthScore: 0,
      dependencies: ['packages/backend/src/agents/orchestrator/orchestrator.ts'],
      linesOfCode: 8,
      lastModified: new Date(Date.now() - 0.5 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'packages/backend/src/agents/orchestrator/orchestrator.ts',
      name: 'agents/orchestrator/orchestrator',
      path: 'packages/backend/src/agents/orchestrator/orchestrator.ts',
      specStatus: 'drift',
      specHealthScore: 42,
      dependencies: ['packages/backend/src/shared/types.ts'],
      linesOfCode: 21,
      lastModified: new Date(Date.now() - 0.5 * 60 * 60 * 1000).toISOString(),
      specContent: `# Agente Orquestador - Spec Health Score

**WHEN** se recibe una lista de módulos con sus specs
**THEN** el sistema **SHALL** calcular un score 0-100 por módulo comparando spec vs código actual

[⚠️ SPEC DESACTUALIZADA - algoritmo de comparación EARS vs código no implementado]`,
    },

    // ============ Tipos compartidos ============
    {
      id: 'packages/backend/src/shared/types.ts',
      name: 'shared/types',
      path: 'packages/backend/src/shared/types.ts',
      specStatus: 'traced',
      specHealthScore: 88,
      dependencies: [],
      linesOfCode: 62,
      lastModified: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
      specContent: `# Contrato JSON entre Agentes

**WHERE** se definen los tipos compartidos del sistema
**THE** interfaz ModuleNode **SHALL** incluir: id, name, path, specStatus, specHealthScore, dependencies

**THE** tipo SpecStatus **SHALL** ser exactamente 'traced' | 'drift' | 'untraced'

**WHERE** los agentes se comunican entre sí
**THE** sistema **SHALL** usar AnalysisResult como formato de respuesta del pipeline completo`,
    },

    // ============ Utilidades ============
    {
      id: 'packages/backend/src/utils/connect_optional_service.ts',
      name: 'utils/connect_optional_service',
      path: 'packages/backend/src/utils/connect_optional_service.ts',
      specStatus: 'traced',
      specHealthScore: 95,
      dependencies: [],
      linesOfCode: 32,
      lastModified: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(),
    },

    // ============ Tipos de salud ============
    {
      id: 'packages/backend/src/types/health.ts',
      name: 'types/health',
      path: 'packages/backend/src/types/health.ts',
      specStatus: 'traced',
      specHealthScore: 100,
      dependencies: [],
      linesOfCode: 12,
      lastModified: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    },

    // ============ Módulos sin spec (caja negra) ============
    {
      id: 'packages/backend/src/services/git_cloner.ts',
      name: 'services/git_cloner',
      path: 'packages/backend/src/services/git_cloner.ts',
      specStatus: 'untraced',
      specHealthScore: 0,
      dependencies: [],
      linesOfCode: 142,
      lastModified: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'packages/backend/src/services/bedrock_client.ts',
      name: 'services/bedrock_client',
      path: 'packages/backend/src/services/bedrock_client.ts',
      specStatus: 'untraced',
      specHealthScore: 0,
      dependencies: [],
      linesOfCode: 98,
      lastModified: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'packages/backend/src/utils/ast_parser.ts',
      name: 'utils/ast_parser',
      path: 'packages/backend/src/utils/ast_parser.ts',
      specStatus: 'untraced',
      specHealthScore: 0,
      dependencies: ['packages/backend/src/shared/types.ts'],
      linesOfCode: 215,
      lastModified: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'packages/backend/src/utils/dependency_graph.ts',
      name: 'utils/dependency_graph',
      path: 'packages/backend/src/utils/dependency_graph.ts',
      specStatus: 'untraced',
      specHealthScore: 0,
      dependencies: ['packages/backend/src/shared/types.ts'],
      linesOfCode: 178,
      lastModified: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    },
  ],
}
