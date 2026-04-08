import { useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { Button } from '../ui/Button'

export type TxPreviewRow = {
  label: string
  value: string
}

export type TxPreviewContent = {
  actionLabel?: string
  eyebrow?: string
  note?: string
  rows: TxPreviewRow[]
  subtitle: string
  title: string
}

type TxPreviewModalProps = {
  onClose: () => void
  onConfirm: () => void
  preview: TxPreviewContent
}

export function TxPreviewModal({ onClose, onConfirm, preview }: TxPreviewModalProps) {
  const modalRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    const modal = modalRef.current
    if (!modal || typeof document === 'undefined') {
      return
    }

    const focusable = Array.from(
      modal.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      ),
    ).filter((element) => !element.hasAttribute('disabled'))

    const firstFocusable = focusable[0] ?? null
    const lastFocusable = focusable[focusable.length - 1] ?? null

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        return
      }

      if (event.key !== 'Tab' || !firstFocusable || !lastFocusable) {
        return
      }

      if (event.shiftKey) {
        if (document.activeElement === firstFocusable || !modal.contains(document.activeElement)) {
          event.preventDefault()
          lastFocusable.focus()
        }
        return
      }

      if (document.activeElement === lastFocusable || !modal.contains(document.activeElement)) {
        event.preventDefault()
        firstFocusable.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    firstFocusable?.focus()

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose])

  return (
    <div className="tx-preview-overlay" role="presentation">
      <button
        type="button"
        className="proof-drawer-backdrop"
        aria-label="Close wallet preview"
        onClick={onClose}
      />
      <motion.aside
        ref={modalRef}
        className="tx-preview-modal"
        initial={{ opacity: 0, y: 18, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 18, scale: 0.98 }}
        transition={{ duration: 0.18, ease: 'easeOut' }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tx-preview-title"
      >
        <div className="tx-preview-modal__header">
          <div className="tx-preview-modal__copy">
            <span className="tx-preview-modal__eyebrow">
              {preview.eyebrow ?? 'Wallet approval'}
            </span>
            <h2 id="tx-preview-title" className="tx-preview-modal__title">
              {preview.title}
            </h2>
            <p className="tx-preview-modal__subtitle">{preview.subtitle}</p>
          </div>
          <button
            type="button"
            className="explorer-close"
            onClick={onClose}
            aria-label="Close wallet preview"
          >
            ×
          </button>
        </div>

        <div className="tx-preview-modal__body">
          <div className="tx-preview-modal__rows">
            {preview.rows.map((row) => (
              <div className="tx-preview-modal__row" key={`${row.label}-${row.value}`}>
                <span>{row.label}</span>
                <strong>{row.value}</strong>
              </div>
            ))}
          </div>
          <div className="tx-preview-modal__note">
            {preview.note ??
              'Your wallet may still show raw transaction JSON. This preview is the same action in plain language.'}
          </div>
        </div>

        <div className="tx-preview-modal__actions">
          <Button variant="secondary" onClick={onClose}>
            Not now
          </Button>
          <Button onClick={onConfirm}>{preview.actionLabel ?? 'Continue to wallet'}</Button>
        </div>
      </motion.aside>
    </div>
  )
}
