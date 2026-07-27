import React from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faBars, faChevronLeft } from '@fortawesome/free-solid-svg-icons'
import './toggle_sidebar_button.css'

// Props del botón toggle del panel lateral izquierdo
interface ToggleSidebarButtonProps {
  isExpanded: boolean
  onClick: () => void
  visible: boolean // controla si se renderiza (cuando Vista Completa está activa se oculta)
}

// Botón toggle para el panel lateral izquierdo.
// Se posiciona de forma absoluta dentro del contenedor del grafo (top-left).
// Cambia de icono hamburguesa (cerrado) a flecha izquierda (abierto).
export const ToggleSidebarButton: React.FC<ToggleSidebarButtonProps> = ({
  isExpanded,
  onClick,
  visible,
}) => {
  if (!visible) {
    return null
  }

  const ariaLabel = isExpanded ? 'Cerrar panel lateral' : 'Abrir panel lateral'

  return (
    <button
      className="toggle-sidebar-button"
      onClick={onClick}
      aria-expanded={isExpanded}
      aria-label={ariaLabel}
      type="button"
    >
      <FontAwesomeIcon
        icon={isExpanded ? faChevronLeft : faBars}
        aria-hidden="true"
      />
    </button>
  )
}
