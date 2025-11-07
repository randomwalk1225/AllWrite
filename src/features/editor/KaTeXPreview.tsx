import { useEffect, useRef } from 'react'
import katex from 'katex'
import 'katex/dist/katex.min.css'

interface KaTeXPreviewProps {
  latex: string
  displayMode?: boolean
  className?: string
}

export function KaTeXPreview({ latex, displayMode = false, className = '' }: KaTeXPreviewProps) {
  const containerRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container || !latex) {
      if (container) container.innerHTML = ''
      return
    }

    try {
      katex.render(latex, container, {
        displayMode,
        throwOnError: false,
        errorColor: '#ff6b6b',
        strict: false,
        trust: false,
      })
    } catch (error) {
      container.innerHTML = `<span style="color: #ff6b6b;">Error: ${(error as Error).message}</span>`
    }
  }, [latex, displayMode])

  return <span ref={containerRef} className={className} />
}
