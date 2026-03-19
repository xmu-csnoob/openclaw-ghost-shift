import { useEffect, useRef, type ReactNode } from 'react'
import { i18n } from '../content/i18n/index.js'
import { t } from '../content/locale.js'

export interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  children: ReactNode
  className?: string
}

export function Modal({ isOpen, onClose, title, children, className = '' }: ModalProps) {
  const modalRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
      document.body.style.overflow = 'hidden'
    }

    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = ''
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  return (
    <div
      className={`gs-modal-backdrop ${className}`}
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div ref={modalRef} className="gs-modal">
        <div className="gs-modal__header">
          <h2 id="modal-title" className="gs-modal__title">{title}</h2>
          <button
            type="button"
            className="gs-modal__close"
            onClick={onClose}
            aria-label={t(i18n.common.close)}
          >
            ✕
          </button>
        </div>
        <div className="gs-modal__content">
          {children}
        </div>
      </div>
    </div>
  )
}
