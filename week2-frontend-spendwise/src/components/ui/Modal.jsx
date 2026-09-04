/**
 * Modal – accessible dialog built on the native <dialog> element.
 *  • Focus is trapped by the browser (native behaviour of showModal()).
 *  • Esc closes it, backdrop click closes it.
 *  • Body scroll is locked while open.
 *  • Focus returns to the previously focused element on close.
 */

import { useEffect, useRef } from 'react'
import Icon from './Icon'

export default function Modal({ open, onClose, title, description, children, size = 'md' }) {
  const dialogRef = useRef(null)
  const openerRef = useRef(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    if (open && !dialog.open) {
      openerRef.current = document.activeElement
      dialog.showModal()
      document.body.style.overflow = 'hidden'
    } else if (!open && dialog.open) {
      dialog.close()
    }

    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  // Native "cancel" event fires on Esc – route it through onClose so state stays in sync
  const handleCancel = (e) => {
    e.preventDefault()
    onClose()
  }

  const handleClose = () => {
    document.body.style.overflow = ''
    openerRef.current?.focus?.()
  }

  const handleBackdropClick = (e) => {
    if (e.target === dialogRef.current) onClose()
  }

  const widths = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl' }

  return (
    <dialog
      ref={dialogRef}
      onCancel={handleCancel}
      onClose={handleClose}
      onClick={handleBackdropClick}
      aria-labelledby="modal-title"
      aria-describedby={description ? 'modal-desc' : undefined}
      className={`m-auto w-[calc(100%-2rem)] ${widths[size]} rounded-2xl border border-slate-200 bg-white p-0 text-slate-800 shadow-2xl backdrop:bg-slate-900/50 backdrop:backdrop-blur-sm open:animate-fade-in dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100`}
    >
      {open && (
        <div className="p-6">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <h2 id="modal-title" className="text-lg font-semibold">
                {title}
              </h2>
              {description && (
                <p id="modal-desc" className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  {description}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close dialog"
              className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:hover:bg-slate-800 dark:hover:text-slate-100"
            >
              <Icon name="close" size={18} />
            </button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  )
}
