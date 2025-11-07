import { useEffect, useRef, forwardRef, useImperativeHandle, useState } from 'react'
import 'mathlive/static.css'

interface MathLiveEditorProps {
  value: string
  onChange: (latex: string) => void
  onBlur?: () => void
  onEnter?: () => void
  onFocus?: () => void
  onConvertToText?: () => void
  onNavigate?: (direction: 'up' | 'down') => void
  placeholder?: string
}

export interface MathLiveEditorRef {
  focus: () => void
}

export const MathLiveEditor = forwardRef<MathLiveEditorRef, MathLiveEditorProps>(
  function MathLiveEditor({ value, onChange, onBlur, onEnter, onFocus, onConvertToText, onNavigate, placeholder }, ref) {
  const mathfieldRef = useRef<any>(null)

  useImperativeHandle(ref, () => ({
    focus: () => {
      const mf = mathfieldRef.current
      if (mf) {
        mf.focus()
      }
    }
  }))

  useEffect(() => {
    const mf = mathfieldRef.current
    if (!mf) return

    // Handle input changes
    const handleInput = (evt: Event) => {
      const target = evt.target as any
      if (target && target.value !== undefined) {
        onChange(target.value)
      }
    }

    // Handle focus
    const handleFocus = () => {
      if (onFocus) onFocus()
    }

    // Handle blur
    const handleBlur = () => {
      if (onBlur) onBlur()
    }

    // Handle keyboard
    const handleKeyDown = (evt: KeyboardEvent) => {
      // 위/아래 화살표로 입력창 간 이동
      if (evt.key === 'ArrowUp' || evt.key === 'ArrowDown') {
        evt.preventDefault()
        if (onNavigate) {
          onNavigate(evt.key === 'ArrowUp' ? 'up' : 'down')
        }
        return
      }

      // Ctrl+' to convert to text input (only if empty)
      if ((evt.ctrlKey || evt.metaKey) && evt.key === "'" && value.trim() === '') {
        evt.preventDefault()
        if (onConvertToText) onConvertToText()
        return
      }

      if (evt.key === 'Enter') {
        // Allow Ctrl+Enter for multiline within same cell
        if (evt.ctrlKey || evt.shiftKey || evt.metaKey) {
          // Let MathLive handle multiline mode
          return
        }
        // Plain Enter creates new expression line
        evt.preventDefault()
        if (onEnter) onEnter()
      }

    }

    mf.addEventListener('input', handleInput)
    mf.addEventListener('focus', handleFocus)
    mf.addEventListener('blur', handleBlur)
    mf.addEventListener('keydown', handleKeyDown)

    return () => {
      mf.removeEventListener('input', handleInput)
      mf.removeEventListener('focus', handleFocus)
      mf.removeEventListener('blur', handleBlur)
      mf.removeEventListener('keydown', handleKeyDown)
    }
  }, [onChange, onFocus, onBlur, onEnter, onConvertToText, onNavigate, value])

  // Update mathfield when value changes externally
  useEffect(() => {
    const mf = mathfieldRef.current
    if (!mf) return

    if (mf.value !== value) {
      mf.value = value
    }
  }, [value])

  return (
    <math-field
      ref={mathfieldRef}
      style={{
        width: '100%',
        fontSize: '18px',
        fontWeight: 'bold',
        padding: '12px',
        border: 'none',
        borderRadius: '0',
        minHeight: '50px',
        backgroundColor: 'transparent',
      }}
    >
      {value}
    </math-field>
  )
})

// Declare custom element for TypeScript
declare global {
  namespace JSX {
    interface IntrinsicElements {
      'math-field': any
    }
  }
}
