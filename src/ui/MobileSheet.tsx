import { ReactNode } from 'react'
import './MobileSheet.css'

interface MobileSheetProps {
  open: boolean
  onClose: () => void
  children: ReactNode
}

export function MobileSheet({ open, onClose, children }: MobileSheetProps) {
  if (!open) return null

  return (
    <>
      <div className="mobile-sheet-backdrop" onClick={onClose} />
      <div className="mobile-sheet">
        <div className="mobile-sheet-handle" onClick={onClose} />
        <div className="mobile-sheet-content">
          {children}
        </div>
      </div>
    </>
  )
}
