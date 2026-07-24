import fs from 'fs'
import path from 'path'
import type { IntegrationNode, IntegrationType } from '../../shared/types'
import { scanAllFiles, isTextSourceFile } from '../../shared/file_scanner'

// Patrones conocidos de drivers/clientes de bases de datos
const DB_PATTERNS: Array<{ pattern: RegExp; name: string; type: 'database' }> = [
  { pattern: /from\s+['"]pg['"]|require\(['"]pg['"]\)/, name: 'PostgreSQL (pg)', type: 'database' },
  { pattern: /from\s+['"]mysql2?['"]|require\(['"]mysql2?['"]\)/, name: 'MySQL', type: 'database' },
  { pattern: /from\s+['"]mongodb['"]|require\(['"]mongodb['"]\)/, name: 'MongoDB', type: 'database' },
  { pattern: /from\s+['"]mongoose['"]|require\(['"]mongoose['"]\)/, name: 'MongoDB (Mongoose)', type: 'database' },
  { pattern: /from\s+['"]redis['"]|require\(['"]redis['"]\)|from\s+['"]ioredis['"]/, name: 'Redis', type: 'database' },
  { pattern: /from\s+['"]typeorm['"]|require\(['"]typeorm['"]\)/, name: 'TypeORM', type: 'database' },
  { pattern: /from\s+['"]prisma['"]|from\s+['"]@prisma\/client['"]/, name: 'Prisma', type: 'database' },
  { pattern: /from\s+['"]sequelize['"]|require\(['"]sequelize['"]\)/, name: 'Sequelize', type: 'database' },
  { pattern: /from\s+['"]@aws-sdk\/client-dynamodb['"]|from\s+['"]@aws-sdk\/lib-dynamodb['"]/, name: 'DynamoDB', type: 'database' },
  { pattern: /from\s+['"]sqlite3['"]|from\s+['"]better-sqlite3['"]/, name: 'SQLite', type: 'database' },
]

// Patrones conocidos de SDKs y clientes de APIs externas
const API_PATTERNS: Array<{ pattern: RegExp; name: string; type: 'external_api' }> = [
  { pattern: /from\s+['"]stripe['"]|require\(['"]stripe['"]\)/, name: 'Stripe', type: 'external_api' },
  { pattern: /from\s+['"]@sendgrid\/mail['"]/, name: 'SendGrid', type: 'external_api' },
  { pattern: /from\s+['"]twilio['"]|require\(['"]twilio['"]\)/, name: 'Twilio', type: 'external_api' },
  { pattern: /from\s+['"]@aws-sdk\//, name: 'AWS SDK', type: 'external_api' },
  { pattern: /from\s+['"]@google-cloud\//, name: 'Google Cloud', type: 'external_api' },
  { pattern: /from\s+['"]@azure\//, name: 'Azure SDK', type: 'external_api' },
  { pattern: /from\s+['"]firebase['"]|from\s+['"]firebase-admin['"]/, name: 'Firebase', type: 'external_api' },
  { pattern: /from\s+['"]@anthropic-ai\//, name: 'Anthropic API', type: 'external_api' },
  { pattern: /from\s+['"]openai['"]/, name: 'OpenAI API', type: 'external_api' },
  { pattern: /from\s+['"]@octokit\//, name: 'GitHub API (Octokit)', type: 'external_api' },
]

// Patrones de llamadas HTTP genéricas a dominios externos
const HTTP_CALL_PATTERN = /(?:fetch|axios\.(?:get|post|put|delete|patch)|http\.(?:get|post))\s*\(\s*[`'"]([^`'"]+)[`'"]/g

/**
 * Extrae una URL de dominio significativa de una URL completa.
 * Ej: "https://api.stripe.com/v1/charges" → "api.stripe.com"
 */
function extractDomain(url: string): string | null {
  try {
    // Ignorar URLs que empiezan con variable de template o localhost
    if (url.startsWith('${') || url.includes('localhost') || url.includes('127.0.0.1')) {
      return null
    }
    const parsed = new URL(url)
    return parsed.hostname
  } catch {
    return null
  }
}

/**
 * Detecta integraciones externas en un archivo fuente.
 * Busca imports de drivers de BD conocidos, SDKs de terceros y llamadas HTTP a dominios externos.
 */
function detectIntegrations(filePath: string, baseDir: string): IntegrationNode[] {
  let content: string
  try {
    content = fs.readFileSync(filePath, 'utf-8')
  } catch {
    return []
  }

  const relativePath = path.relative(baseDir, filePath).replace(/\\/g, '/')
  const integrations: IntegrationNode[] = []
  const seen = new Set<string>() // evitar duplicados por archivo

  // Buscar patrones de BD
  for (const { pattern, name, type } of DB_PATTERNS) {
    if (pattern.test(content)) {
      const key = `${type}:${name}`
      if (!seen.has(key)) {
        seen.add(key)
        integrations.push({
          id: `integration:${name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
          name,
          type,
          detectedIn: [relativePath],
          description: `Usa ${name} (detectado por import de driver/ORM)`,
        })
      }
    }
  }

  // Buscar patrones de APIs/SDKs
  for (const { pattern, name, type } of API_PATTERNS) {
    if (pattern.test(content)) {
      const key = `${type}:${name}`
      if (!seen.has(key)) {
        seen.add(key)
        integrations.push({
          id: `integration:${name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
          name,
          type,
          detectedIn: [relativePath],
          description: `Usa ${name} SDK (detectado por import)`,
        })
      }
    }
  }

  // Buscar llamadas HTTP genéricas a dominios externos
  HTTP_CALL_PATTERN.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = HTTP_CALL_PATTERN.exec(content)) !== null) {
    const url = match[1]
    const domain = extractDomain(url)
    if (domain) {
      const key = `external_api:${domain}`
      if (!seen.has(key)) {
        seen.add(key)
        integrations.push({
          id: `integration:${domain.replace(/[^a-z0-9.]/g, '-')}`,
          name: domain,
          type: 'external_api' as IntegrationType,
          detectedIn: [relativePath],
          description: `Llama a ${domain} (detectado por fetch/axios/http)`,
        })
      }
    }
  }

  return integrations
}

/**
 * Analiza un repositorio completo y detecta todas las integraciones externas.
 * Escanea todos los archivos de código fuente (no solo TS/JS) buscando patrones.
 * Consolida duplicados: si varios archivos usan el mismo driver/API, se agrupan.
 *
 * @param repoPath - Ruta absoluta al directorio del repositorio clonado
 * @returns Lista de IntegrationNode con los archivos que las usan
 */
export async function detectRepositoryIntegrations(repoPath: string): Promise<IntegrationNode[]> {
  // Escanear todos los archivos relevantes
  const allFiles = scanAllFiles(repoPath, repoPath)
  
  // Filtrar solo archivos de texto/código donde tiene sentido buscar patrones
  const files = allFiles.filter((f) => isTextSourceFile(f))

  // Mapa para consolidar integraciones por ID
  const integrationMap = new Map<string, IntegrationNode>()

  for (const filePath of files) {
    const fileIntegrations = detectIntegrations(filePath, repoPath)

    for (const integration of fileIntegrations) {
      const existing = integrationMap.get(integration.id)
      if (existing) {
        // Consolidar: agregar archivo a la lista de detectedIn
        for (const file of integration.detectedIn) {
          if (!existing.detectedIn.includes(file)) {
            existing.detectedIn.push(file)
          }
        }
      } else {
        integrationMap.set(integration.id, { ...integration })
      }
    }
  }

  return [...integrationMap.values()]
}
