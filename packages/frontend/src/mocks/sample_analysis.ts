import type { AnalysisResult } from '../types'

// Datos de ejemplo para testear el dashboard sin backend
export const SAMPLE_ANALYSIS: AnalysisResult = {
  repoUrl: 'https://github.com/usuario/proyecto-ejemplo',
  analyzedAt: new Date().toISOString(),
  projectHealthScore: 67,
  totalModules: 12,
  tracedCount: 5,
  driftCount: 3,
  untracedCount: 4,
  modules: [
    {
      id: 'src/app.ts',
      name: 'app.ts',
      path: 'src/app.ts',
      specStatus: 'traced',
      specHealthScore: 95,
      dependencies: ['src/routes/health.ts', 'src/services/analyzer.ts'],
      linesOfCode: 120,
      lastModified: '2024-01-15T10:30:00Z',
      specContent: `# App Principal

**WHEN** el servidor inicia
**THEN** el sistema **SHALL** configurar Express y registrar todas las rutas

**WHEN** se recibe una petición HTTP
**THEN** el sistema **SHALL** aplicar middleware de logging y manejo de errores`,
    },
    {
      id: 'src/routes/health.ts',
      name: 'routes/health',
      path: 'src/routes/health.ts',
      specStatus: 'traced',
      specHealthScore: 88,
      dependencies: [],
      linesOfCode: 45,
      lastModified: '2024-01-14T09:20:00Z',
    },
    {
      id: 'src/services/analyzer.ts',
      name: 'services/analyzer',
      path: 'src/services/analyzer.ts',
      specStatus: 'drift',
      specHealthScore: 62,
      dependencies: ['src/utils/parser.ts', 'src/types/module.ts'],
      linesOfCode: 340,
      lastModified: '2024-01-16T14:45:00Z',
      specContent: `# Analizador de Código

**WHEN** se recibe la URL de un repositorio
**THEN** el sistema **SHALL** clonar el repositorio localmente

[SPEC DESACTUALIZADA - código modificado recientemente]`,
    },
    {
      id: 'src/services/ears_writer.ts',
      name: 'services/ears_writer',
      path: 'src/services/ears_writer.ts',
      specStatus: 'untraced',
      specHealthScore: 35,
      dependencies: ['src/types/module.ts'],
      linesOfCode: 280,
      lastModified: '2024-01-15T16:10:00Z',
    },
    {
      id: 'src/utils/parser.ts',
      name: 'utils/parser',
      path: 'src/utils/parser.ts',
      specStatus: 'traced',
      specHealthScore: 92,
      dependencies: [],
      linesOfCode: 156,
      lastModified: '2024-01-10T11:00:00Z',
    },
    {
      id: 'src/types/module.ts',
      name: 'types/module',
      path: 'src/types/module.ts',
      specStatus: 'traced',
      specHealthScore: 100,
      dependencies: [],
      linesOfCode: 68,
      lastModified: '2024-01-08T08:30:00Z',
      specContent: `# Tipos de Módulo

**WHERE** se definen tipos TypeScript para el sistema
**THE** interfaz ModuleNode **SHALL** incluir: id, name, path, specStatus, dependencies`,
    },
    {
      id: 'src/services/orchestrator.ts',
      name: 'services/orchestrator',
      path: 'src/services/orchestrator.ts',
      specStatus: 'drift',
      specHealthScore: 58,
      dependencies: ['src/services/analyzer.ts', 'src/services/ears_writer.ts'],
      linesOfCode: 210,
      lastModified: '2024-01-16T13:20:00Z',
    },
    {
      id: 'src/utils/git_client.ts',
      name: 'utils/git_client',
      path: 'src/utils/git_client.ts',
      specStatus: 'untraced',
      specHealthScore: 42,
      dependencies: [],
      linesOfCode: 95,
      lastModified: '2024-01-12T15:40:00Z',
    },
    {
      id: 'src/config/bedrock.ts',
      name: 'config/bedrock',
      path: 'src/config/bedrock.ts',
      specStatus: 'traced',
      specHealthScore: 85,
      dependencies: [],
      linesOfCode: 52,
      lastModified: '2024-01-09T12:15:00Z',
    },
    {
      id: 'src/routes/analyze.ts',
      name: 'routes/analyze',
      path: 'src/routes/analyze.ts',
      specStatus: 'drift',
      specHealthScore: 55,
      dependencies: ['src/services/orchestrator.ts'],
      linesOfCode: 78,
      lastModified: '2024-01-16T10:05:00Z',
    },
    {
      id: 'src/routes/generate_spec.ts',
      name: 'routes/generate_spec',
      path: 'src/routes/generate_spec.ts',
      specStatus: 'untraced',
      specHealthScore: 28,
      dependencies: ['src/services/ears_writer.ts'],
      linesOfCode: 62,
      lastModified: '2024-01-15T17:30:00Z',
    },
    {
      id: 'src/utils/logger.ts',
      name: 'utils/logger',
      path: 'src/utils/logger.ts',
      specStatus: 'untraced',
      specHealthScore: 38,
      dependencies: [],
      linesOfCode: 44,
      lastModified: '2024-01-11T09:50:00Z',
    },
  ],
}
