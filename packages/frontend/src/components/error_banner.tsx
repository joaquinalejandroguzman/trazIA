import React from 'react'

interface ErrorBannerProps {
  message: string
  onDismiss?: () => void
}

// Banner de error inline con opción de cerrar
export const ErrorBanner: React.FC<ErrorBannerProps> = ({ message, onDismiss }) => {
  return (
    <div className="error-banner" role="alert" aria-live="assertive">
      <span className="error-banner__icon" aria-hidden="true">⚠️</span>
      <p className="error-banner__message">{message}</p>
      {onDismiss && (
        <button
          className="error-banner__dismiss"
          onClick={onDismiss}
          aria-label="Cerrar error"
        >
          ✕
        </button>
      )}
    </div>
  )
}
