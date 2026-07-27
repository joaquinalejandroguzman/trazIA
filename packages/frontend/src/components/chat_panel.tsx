import React, { useState, useEffect, useRef, useCallback } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faComment, faPaperPlane } from '@fortawesome/free-solid-svg-icons'
import { useChat } from '../hooks/use_chat'
import type { ModuleNode } from '../types'
import './chat_panel.css'

// Props del componente ChatPanel — controlado externamente por usePanelLayout
interface ChatPanelProps {
  modules: ModuleNode[]
  readme?: string
  isOpen: boolean           // controlado externamente por usePanelLayout
  onToggle: () => void      // callback para toggle
  visible: boolean          // si false, no renderiza FAB ni panel
}

// Panel flotante de chat contextual con TrazIA
export const ChatPanel: React.FC<ChatPanelProps> = ({
  modules,
  readme,
  isOpen,
  onToggle,
  visible,
}) => {
  const { messages, isLoading, error, analyzingModules, sendMessage } = useChat({ modules, readme })
  const [inputValue, setInputValue] = useState<string>('')

  // Refs para manejo de focus y scroll
  const inputRef = useRef<HTMLInputElement>(null)
  const fabRef = useRef<HTMLButtonElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Focus al input cuando se abre el panel
  useEffect(() => {
    if (isOpen && visible) {
      // Esperar a que la animación de apertura inicie para hacer focus
      setTimeout(() => {
        inputRef.current?.focus()
      }, 50)
    }
  }, [isOpen, visible])

  // Devolver focus al FAB cuando se cierra el panel
  useEffect(() => {
    if (!isOpen && visible) {
      setTimeout(() => {
        fabRef.current?.focus()
      }, 200)
    }
  }, [isOpen, visible])

  // Listener de tecla Escape para cerrar el panel
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && visible) {
        onToggle()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, visible, onToggle])

  // Scroll automático al último mensaje cuando llega una respuesta
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  // Envía el mensaje al presionar Enter o hacer click en el botón
  const handleSend = useCallback(async () => {
    const text = inputValue.trim()
    if (!text || isLoading) return

    setInputValue('')
    await sendMessage(text)
  }, [inputValue, isLoading, sendMessage])

  // Maneja tecla Enter en el input
  const handleKeyPress = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSend()
      }
    },
    [handleSend]
  )

  // Cuando visible=false, no renderizar FAB ni panel (pero mantener estado interno intacto)
  if (!visible) {
    return null
  }

  return (
    <>
      {/* Botón flotante (FAB) — esquina inferior derecha */}
      <button
        ref={fabRef}
        className="chat-fab"
        onClick={onToggle}
        aria-expanded={isOpen}
        aria-label={isOpen ? 'Cerrar chat' : 'Abrir chat'}
        title={isOpen ? 'Cerrar chat' : 'Abrir chat'}
      >
        <FontAwesomeIcon icon={faComment} />
      </button>

      {/* Panel de chat */}
      <div
        className={`chat-panel ${!isOpen ? 'chat-panel--closed' : ''}`}
        role="dialog"
        aria-label="Chat de TrazIA"
      >
        {/* Header */}
        <div className="chat-panel__header">
          <span className="chat-panel__title">TrazIA Chat</span>
          <button
            className="chat-panel__close"
            onClick={onToggle}
            aria-label="Cerrar chat"
            title="Cerrar"
          >
            ×
          </button>
        </div>

        {/* Área de mensajes */}
        <div
          className="chat-panel__messages"
          role="log"
          aria-live="polite"
          aria-label="Mensajes del chat"
        >
          {messages.map((msg, index) => (
            <div
              key={index}
              className={`chat-panel__message chat-panel__message--${msg.role}`}
            >
              {msg.content}
            </div>
          ))}

          {/* Indicador de carga */}
          {isLoading && (
            <div className="chat-panel__loading" aria-live="polite">
              <span className="chat-panel__spinner" />
              {analyzingModules && analyzingModules.length > 0
                ? `Analizando ${analyzingModules.length} módulo${analyzingModules.length > 1 ? 's' : ''}...`
                : 'Pensando...'}
            </div>
          )}

          {/* Ancla para scroll automático */}
          <div ref={messagesEndRef} />
        </div>

        {/* Error si existe */}
        {error && <div className="chat-panel__error">{error}</div>}

        {/* Input + botón enviar */}
        <div className="chat-panel__input-area">
          <input
            ref={inputRef}
            className="chat-panel__input"
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder="Preguntá sobre el repositorio..."
            disabled={isLoading}
            aria-label="Escribir mensaje"
          />
          <button
            className="chat-panel__send"
            onClick={handleSend}
            disabled={isLoading || !inputValue.trim()}
            aria-label="Enviar mensaje"
            title="Enviar"
          >
            <FontAwesomeIcon icon={faPaperPlane} />
          </button>
        </div>
      </div>
    </>
  )
}
