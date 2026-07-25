import path from 'path'
import os from 'os'
import fs from 'fs'
import { simpleGit } from 'simple-git'

// Directorio base para repos clonados temporalmente
const CLONE_BASE_DIR = path.join(os.tmpdir(), 'trazia-repos')

/**
 * Clona un repositorio público de GitHub en un directorio temporal.
 * Usa --depth=1 para clonar solo el último commit (rápido, liviano).
 *
 * @param repoUrl - URL del repositorio (https://github.com/usuario/repo)
 * @returns Ruta absoluta al directorio donde se clonó el repo
 */
export async function cloneRepository(repoUrl: string): Promise<string> {
  // Valida formato básico de URL GitHub
  const match = repoUrl.match(/github\.com\/([\w.-]+)\/([\w.-]+)/)
  if (!match) {
    throw new Error(`URL no válida: se esperaba un repositorio público de GitHub`)
  }

  const owner = match[1]
  const repo = match[2].replace(/\.git$/, '')

  // Crea directorio base si no existe
  if (!fs.existsSync(CLONE_BASE_DIR)) {
    fs.mkdirSync(CLONE_BASE_DIR, { recursive: true })
  }

  // Directorio destino con timestamp para evitar colisiones
  const targetDir = path.join(CLONE_BASE_DIR, `${owner}_${repo}_${Date.now()}`)

  const git = simpleGit()

  try {
    await git.clone(repoUrl, targetDir, [
      '--depth', '1',        // solo último commit
      '--single-branch',     // solo rama principal
    ])
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)

    // Errores comunes con mensajes legibles
    if (message.includes('not found') || message.includes('Repository not found')) {
      throw new Error(`Repositorio no encontrado: ${repoUrl}`)
    }
    if (message.includes('could not read Username') || message.includes('Authentication')) {
      throw new Error(`Repositorio privado o requiere autenticación: ${repoUrl}`)
    }

    throw new Error(`Error al clonar repositorio: ${message}`)
  }

  return targetDir
}

/**
 * Elimina un directorio de repo clonado temporalmente.
 * Llamar después de procesar el análisis para no acumular basura en /tmp.
 */
export async function cleanupClonedRepo(repoPath: string): Promise<void> {
  try {
    if (fs.existsSync(repoPath)) {
      fs.rmSync(repoPath, { recursive: true, force: true })
    }
  } catch {
    // No es crítico si falla la limpieza — el OS limpiará /tmp eventualmente
    console.warn(JSON.stringify({ agente: 'git-cloner', módulo: 'cleanup', mensaje: 'No se pudo limpiar repo temporal', repoPath }))
  }
}
