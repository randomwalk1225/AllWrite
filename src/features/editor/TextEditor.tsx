import { useRef, useEffect, forwardRef, useImperativeHandle } from 'react'

export interface TextEditorRef {
  focus: () => void
}

interface TextEditorProps {
  value: string
  onChange: (text: string) => void
  onEnter: () => void
  onFocus?: () => void
  onNavigate?: (direction: 'up' | 'down') => void
  onConvertToMath?: () => void
}

export const TextEditor = forwardRef<TextEditorRef, TextEditorProps>(
  ({ value, onChange, onEnter, onFocus, onNavigate, onConvertToMath }, ref) => {
    const textareaRef = useRef<HTMLTextAreaElement>(null)

    useImperativeHandle(ref, () => ({
      focus: () => {
        textareaRef.current?.focus()
      }
    }))

    // Auto-resize textarea based on content
    useEffect(() => {
      const textarea = textareaRef.current
      if (textarea) {
        // Reset height to auto to get the correct scrollHeight
        textarea.style.height = 'auto'
        // Set height to scrollHeight to fit content, with minimum of 50px
        const newHeight = Math.max(50, textarea.scrollHeight)
        textarea.style.height = `${newHeight}px`
      }
    }, [value])

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      const textarea = textareaRef.current
      if (!textarea) return

      // Ctrl+' to convert to math input
      if ((e.ctrlKey || e.metaKey) && e.key === "'") {
        e.preventDefault()
        if (onConvertToMath) onConvertToMath()
        return
      }

      // 위/아래 화살표로 입력창 간 이동 (커서가 첫/마지막 줄에 있을 때만)
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        const cursorPos = textarea.selectionStart
        const textBeforeCursor = textarea.value.substring(0, cursorPos)
        const textAfterCursor = textarea.value.substring(cursorPos)

        if (e.key === 'ArrowUp') {
          // 첫 줄에 있으면 이전 입력창으로 이동
          if (!textBeforeCursor.includes('\n')) {
            e.preventDefault()
            if (onNavigate) onNavigate('up')
            return
          }
        } else if (e.key === 'ArrowDown') {
          // 마지막 줄에 있으면 다음 입력창으로 이동
          if (!textAfterCursor.includes('\n')) {
            e.preventDefault()
            if (onNavigate) onNavigate('down')
            return
          }
        }
      }

      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        onEnter()
      }
    }

    return (
      <textarea
        ref={textareaRef}
        className="text-editor"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={onFocus}
        placeholder="텍스트 입력... (Shift+Enter로 줄바꿈)"
        style={{
          width: '100%',
          resize: 'none',
          border: 'none',
          outline: 'none',
          fontFamily: 'inherit',
          fontSize: '16px',
          lineHeight: '1.5',
          backgroundColor: 'transparent',
          padding: '15px 12px',
          minHeight: '50px',
          overflow: 'hidden',
          boxSizing: 'border-box',
        }}
      />
    )
  }
)

TextEditor.displayName = 'TextEditor'
