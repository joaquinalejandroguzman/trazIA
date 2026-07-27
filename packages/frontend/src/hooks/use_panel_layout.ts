import { useState, useCallback, useRef } from 'react'

// Estado de visibilidad de los paneles del layout
export interface PanelLayoutState {
  leftPanelOpen: boolean
  rightPanelOpen: boolean
  chatOpen: boolean
  // Derivados — controlan visibilidad de botones toggle
  showLeftToggle: boolean    // false cuando rightPanelOpen
  showChatToggle: boolean    // false cuando rightPanelOpen || leftPanelOpen
  showChat: boolean          // false cuando rightPanelOpen || leftPanelOpen
}

// Acciones disponibles para controlar los paneles
export interface PanelLayoutActions {
  toggleLeftPanel: () => void
  openRightPanel: () => void
  closeRightPanel: () => void
  toggleChat: () => void
}

export type UsePanelLayoutReturn = PanelLayoutState & PanelLayoutActions

/**
 * Hook que centraliza la lógica de estado de los paneles del layout principal.
 *
 * Reglas de negocio:
 * - El panel izquierdo y el chat están ocultos por defecto.
 * - Al abrir el panel derecho (Vista Completa), se guardan los estados previos
 *   de leftPanelOpen y chatOpen, y se fuerzan ambos a false.
 * - Al cerrar el panel derecho, se restauran los estados previos.
 * - toggleLeftPanel solo actúa si el panel derecho está cerrado.
 * - toggleChat solo actúa si showChatToggle es true (!rightPanelOpen && !leftPanelOpen).
 */
export function usePanelLayout(): UsePanelLayoutReturn {
  const [leftPanelOpen, setLeftPanelOpen] = useState(false)
  const [rightPanelOpen, setRightPanelOpen] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)

  // Refs para guardar el estado previo al entrar en Vista Completa
  const prevLeftPanelOpen = useRef(false)
  const prevChatOpen = useRef(false)

  // Toggle del panel izquierdo: solo actúa si el panel derecho está cerrado
  const toggleLeftPanel = useCallback(() => {
    setRightPanelOpen((currentRight) => {
      if (!currentRight) {
        setLeftPanelOpen((prev) => !prev)
      }
      return currentRight
    })
  }, [])

  // Abre el panel derecho en Vista Completa: guarda estado previo y fuerza ocultación
  const openRightPanel = useCallback(() => {
    setLeftPanelOpen((currentLeft) => {
      prevLeftPanelOpen.current = currentLeft
      return false
    })
    setChatOpen((currentChat) => {
      prevChatOpen.current = currentChat
      return false
    })
    setRightPanelOpen(true)
  }, [])

  // Cierra el panel derecho: restaura los estados previos guardados
  const closeRightPanel = useCallback(() => {
    setRightPanelOpen(false)
    setLeftPanelOpen(prevLeftPanelOpen.current)
    setChatOpen(prevChatOpen.current)
  }, [])

  // Toggle del chat: solo actúa si showChatToggle es true
  const toggleChat = useCallback(() => {
    setRightPanelOpen((currentRight) => {
      if (!currentRight) {
        setLeftPanelOpen((currentLeft) => {
          if (!currentLeft) {
            setChatOpen((prev) => !prev)
          }
          return currentLeft
        })
      }
      return currentRight
    })
  }, [])

  // Valores derivados
  const showLeftToggle = !rightPanelOpen
  const showChatToggle = !rightPanelOpen && !leftPanelOpen
  const showChat = chatOpen && !rightPanelOpen && !leftPanelOpen

  return {
    leftPanelOpen,
    rightPanelOpen,
    chatOpen,
    showLeftToggle,
    showChatToggle,
    showChat,
    toggleLeftPanel,
    openRightPanel,
    closeRightPanel,
    toggleChat,
  }
}
