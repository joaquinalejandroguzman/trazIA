import React, { useState } from 'react'
import type { AnalysisStatus } from '../types'

interface RepoInputProps {
  onAnalyze: (repoUrl: string) => void
  status: AnalysisStatus
  onReset: () => void
}

// Valida que la URL sea un repo de GitHub público con formato básico correcto
function isValidGitHubUrl(url: string): boolean {
  return /^https?:\/\/github\.com\/[\w.-]+\/[\w.-]+(\/.*)?$/.test(url.trim())
}

// Componente de entrada de URL — pantalla inicial y barra superior en modo análisis
export const RepoInput: React.FC<RepoInputProps> = ({ onAnalyze, status, onReset }) => {
  const [url, setUrl] = useState('')
  const [validationError, setValidationError] = useState<string | null>(null)

  const isLoading = status === 'loading'
  const hasResult = status === 'success'

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = url.trim()

    if (!trimmed) {
      setValidationError('Ingresá la URL del repositorio')
      return
    }
    if (!isValidGitHubUrl(trimmed)) {
      setValidationError('La URL debe ser un repositorio público de GitHub (https://github.com/usuario/repo)')
      return
    }

    setValidationError(null)
    onAnalyze(trimmed)
  }

  const handleReset = () => {
    setUrl('')
    setValidationError(null)
    onReset()
  }

  return (
    <div className={`repo-input ${hasResult ? 'repo-input--compact' : 'repo-input--hero'}`}>
      {!hasResult && (
        <div className="repo-input__hero-text">
          <h1 className="repo-input__title">
            Traz<span className="repo-input__title-accent">IA</span>
          </h1>
          <p className="repo-input__subtitle">
            Escaneá un repositorio y visualizá su arquitectura en segundos
          </p>
        </div>
      )}

      <form className="repo-input__form" onSubmit={handleSubmit} noValidate>
        <div className="repo-input__field-group">
          <input
            type="url"
            className={`repo-input__field ${validationError ? 'repo-input__field--error' : ''}`}
            placeholder="https://github.com/usuario/repositorio"
            value={url}
            onChange={(e) => {
              setUrl(e.target.value)
              if (validationError) setValidationError(null)
            }}
            disabled={isLoading}
            aria-label="URL del repositorio de GitHub"
            aria-describedby={validationError ? 'url-error' : undefined}
          />
          <button
            type="submit"
            className="repo-input__btn"
            disabled={isLoading || !url.trim()}
            aria-busy={isLoading}
          >
            {isLoading ? (
              <>
                <span className="repo-input__spinner" aria-hidden="true" />
                Analizando…
              </>
            ) : (
              'Analizar'
            )}
          </button>

          {hasResult && (
            <button
              type="button"
              className="repo-input__btn repo-input__btn--secondary"
              onClick={handleReset}
            >
              Nuevo repo
            </button>
          )}
        </div>

        {validationError && (
          <p id="url-error" className="repo-input__error" role="alert">
            {validationError}
          </p>
        )}
      </form>

      {!hasResult && (
        <>
          <div className="repo-input__info-box">
            <h3 className="repo-input__info-title">¿Qué hace TrazIA?</h3>
            <ul className="repo-input__info-list">
              <li>🗺️ Visualiza la estructura de carpetas y módulos como grafo interactivo</li>
              <li>🔗 Detecta integraciones: bases de datos, APIs externas, SDKs</li>
              <li>🎨 Colorea por zona: frontend, backend, shared, config</li>
              <li>✍️ Genera specs de comportamiento para módulos sin documentar</li>
            </ul>
          </div>
        </>
      )}
    </div>
  )
}
