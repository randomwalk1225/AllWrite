import { useState, useRef, useEffect } from 'react'
import { useStore } from '../../store'
import { MathLiveEditor, MathLiveEditorRef } from './MathLiveEditor'
import { TextEditor, TextEditorRef } from './TextEditor'
import { KaTeXPreview } from './KaTeXPreview'
import { latexToMathJS, detectExpressionKind, toImplicitForm, extractExplicitFunction, parsePoint } from '../../core/math/latex-converter'
import { compileExpression, evaluateExpression } from '../../core/math/evaluator'
import './ExpressionEditor.css'

const PRESET_COLORS = [
  '#000000', '#808080', // 검정-회색
  '#0066ff', '#66b3ff', // 파랑-하늘색
  '#ff0000', '#ff6600', // 빨강-오렌지
  '#00cc00', '#99ff33', // 초록-연두색
  '#8b4513', '#cd853f', // 갈색-연하갈색
  '#e6b800', '#ffeb99', // 진한노랑-연한노랑
]

export function ExpressionEditor() {
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null)
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)
  const [colorPickerOpen, setColorPickerOpen] = useState<string | null>(null)
  const [calculatedResults, setCalculatedResults] = useState<Record<string, number | null>>({})
  const expressions = useStore((state) => state.expressions)
  const addExpression = useStore((state) => state.addExpression)
  const insertExpression = useStore((state) => state.insertExpression)
  const updateExpression = useStore((state) => state.updateExpression)
  const removeExpression = useStore((state) => state.removeExpression)
  const editorRefs = useRef<(MathLiveEditorRef | TextEditorRef | null)[]>([])

  // Focus the editor when focusedIndex changes
  useEffect(() => {
    if (focusedIndex !== null && editorRefs.current[focusedIndex]) {
      setTimeout(() => {
        editorRefs.current[focusedIndex]?.focus()
      }, 100)
    }
  }, [focusedIndex, expressions.length])

  // Close color picker when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      setColorPickerOpen(null)
    }

    if (colorPickerOpen) {
      document.addEventListener('click', handleClickOutside)
      return () => {
        document.removeEventListener('click', handleClickOutside)
      }
    }
  }, [colorPickerOpen])

  const handleAddExpression = (latex: string = '', insertAfterIndex?: number) => {
    try {
      // Allow empty expressions
      const mathJSExpr = latex.trim() ? latexToMathJS(latex) : ''

      // Detect expression kind
      const kind = mathJSExpr ? detectExpressionKind(mathJSExpr) : 'cartesian'

      // Convert to appropriate form
      let input = mathJSExpr
      let point = undefined

      if (kind === 'point') {
        const pointCoords = parsePoint(mathJSExpr)
        if (pointCoords) {
          point = {
            ...pointCoords,
            label: `(${pointCoords.x}, ${pointCoords.y})`
          }
          input = '' // Points don't need an input expression
        }
      } else if (kind === 'polar') {
        input = mathJSExpr.replace(/^r\s*=\s*/i, '')
      } else if (kind === 'parametric') {
        input = mathJSExpr
      } else if (kind === 'implicit') {
        input = toImplicitForm(mathJSExpr)
      } else if (kind === 'cartesian') {
        input = extractExplicitFunction(mathJSExpr)
      }

      addExpression({
        kind,
        input,
        latex: latex.trim(),
        color: PRESET_COLORS[expressions.length % PRESET_COLORS.length],
        visible: true,
        selected: false,
        point,
      })

      if (insertAfterIndex !== undefined) {
        setFocusedIndex(insertAfterIndex + 1)
      }
    } catch (err) {
      console.error('Failed to add expression:', err)
      // Still add the expression even if conversion fails
      addExpression({
        kind: 'cartesian',
        input: '',
        latex: latex.trim(),
        color: PRESET_COLORS[expressions.length % PRESET_COLORS.length],
        visible: true,
        selected: false,
      })
    }
  }

  const handleExpressionLatexChange = (exprId: string, latex: string) => {
    try {
      console.log('LaTeX:', latex)

      // If latex is empty, clear the calculation result
      if (!latex || latex.trim() === '') {
        updateExpression(exprId, {
          latex: '',
          input: '',
          kind: 'cartesian',
          point: undefined
        })
        // Remove the calculation result completely
        setCalculatedResults(prev => {
          const newResults = { ...prev }
          delete newResults[exprId]
          return newResults
        })
        return
      }

      const mathJSExpr = latexToMathJS(latex)
      console.log('MathJS:', mathJSExpr)

      // Detect expression kind
      const kind = mathJSExpr ? detectExpressionKind(mathJSExpr) : 'cartesian'
      console.log('Kind:', kind)

      // Convert to appropriate form
      let input = mathJSExpr
      let point = undefined

      if (kind === 'point') {
        const pointCoords = parsePoint(mathJSExpr)
        if (pointCoords) {
          point = {
            ...pointCoords,
            label: `(${pointCoords.x}, ${pointCoords.y})`
          }
          input = '' // Points don't need an input expression
        }
      } else if (kind === 'polar') {
        input = mathJSExpr.replace(/^r\s*=\s*/i, '')
      } else if (kind === 'parametric') {
        input = mathJSExpr
      } else if (kind === 'implicit') {
        input = toImplicitForm(mathJSExpr)
      } else if (kind === 'cartesian') {
        input = extractExplicitFunction(mathJSExpr)
      }
      updateExpression(exprId, {
        latex,
        input,
        kind,
        point
      })

      // Try to evaluate as a calculator expression (no variables)
      if (mathJSExpr && kind === 'cartesian' && input) {
        try {
          // Check if expression contains variables (x, y, t, theta)
          // But allow constants like pi, e
          const hasVariables = /[xyt]|theta/.test(input.toLowerCase())
          if (!hasVariables) {
            // Try to compile and evaluate
            const compiled = compileExpression(mathJSExpr)
            const result = evaluateExpression(compiled, {})
            if (isFinite(result)) {
              setCalculatedResults(prev => ({ ...prev, [exprId]: result }))
            } else {
              // Remove invalid results
              setCalculatedResults(prev => {
                const newResults = { ...prev }
                delete newResults[exprId]
                return newResults
              })
            }
          } else {
            // Remove results for expressions with variables
            setCalculatedResults(prev => {
              const newResults = { ...prev }
              delete newResults[exprId]
              return newResults
            })
          }
        } catch (err) {
          console.log('Not a calculable expression:', err)
          // Remove results on error
          setCalculatedResults(prev => {
            const newResults = { ...prev }
            delete newResults[exprId]
            return newResults
          })
        }
      } else {
        // Remove results if not calculable
        setCalculatedResults(prev => {
          const newResults = { ...prev }
          delete newResults[exprId]
          return newResults
        })
      }
    } catch (err) {
      console.error('Expression conversion error:', err)
      // Just update latex, keep old input
      updateExpression(exprId, { latex })
      // Remove results on error
      setCalculatedResults(prev => {
        const newResults = { ...prev }
        delete newResults[exprId]
        return newResults
      })
    }
  }

  const handleTextChange = (exprId: string, text: string) => {
    // If text is empty, clear the calculation result
    if (!text || text.trim() === '') {
      updateExpression(exprId, {
        input: '',
        latex: '',
      })
      // Remove the calculation result completely
      setCalculatedResults(prev => {
        const newResults = { ...prev }
        delete newResults[exprId]
        return newResults
      })
      return
    }

    updateExpression(exprId, {
      input: text,
      latex: text,
    })
  }

  const handleDeleteExpression = (exprId: string, isMathMode: boolean) => {
    if (expressions.length > 1) {
      // Remove the expression
      removeExpression(exprId)
    } else {
      // If it's the last expression, clear its content instead
      if (isMathMode) {
        updateExpression(exprId, {
          latex: '',
          input: '',
          point: undefined
        })
      } else {
        updateExpression(exprId, {
          input: '',
          latex: ''
        })
      }
    }
    // Always remove the calculation result
    setCalculatedResults(prev => {
      const newResults = { ...prev }
      delete newResults[exprId]
      return newResults
    })
  }

  const handleExpressionFocus = (exprId: string) => {
    // Don't use 'selected' property for input focus
    // 'selected' is only for canvas selection with transformation handles
  }

  const handleKeyDown = (index: number, latex: string) => {
    // Insert new expression after current one
    insertExpression({
      kind: 'cartesian',
      input: '',
      latex: '',
      color: PRESET_COLORS[(expressions.length) % PRESET_COLORS.length],
      visible: true,
      selected: false,
    }, index)

    // Focus the newly inserted expression
    setFocusedIndex(index + 1)
  }

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index)
    e.dataTransfer.effectAllowed = 'move'
    // Set a transparent drag image
    if (e.dataTransfer.setDragImage) {
      const img = new Image()
      img.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'
      e.dataTransfer.setDragImage(img, 0, 0)
    }
  }

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'

    if (draggedIndex === null || draggedIndex === index) return

    setDragOverIndex(index)
  }

  const handleDragEnd = () => {
    setDraggedIndex(null)
    setDragOverIndex(null)
  }

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault()

    if (draggedIndex === null || draggedIndex === dropIndex) {
      handleDragEnd()
      return
    }

    const newExpressions = [...expressions]
    const [draggedItem] = newExpressions.splice(draggedIndex, 1)

    // Adjust drop index if dragging from before to after
    const adjustedDropIndex = draggedIndex < dropIndex ? dropIndex - 1 : dropIndex
    newExpressions.splice(adjustedDropIndex, 0, draggedItem)

    useStore.setState({ expressions: newExpressions })
    handleDragEnd()
  }

  const handleColorClick = (exprId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setColorPickerOpen(colorPickerOpen === exprId ? null : exprId)
  }

  const handleColorSelect = (exprId: string, color: string) => {
    updateExpression(exprId, { color })
    setColorPickerOpen(null)
  }

  const handleConvertToText = (exprId: string, index: number) => {
    updateExpression(exprId, {
      kind: 'text',
      input: '',
      latex: ''
    })
    // Focus the text editor after conversion
    setTimeout(() => {
      editorRefs.current[index]?.focus()
    }, 100)
  }

  const handleConvertToMath = (exprId: string, index: number) => {
    updateExpression(exprId, {
      kind: 'cartesian',
      input: '',
      latex: ''
    })
    // Focus the math editor after conversion
    setTimeout(() => {
      editorRefs.current[index]?.focus()
    }, 100)
  }

  const handleNavigate = (currentIndex: number, direction: 'up' | 'down') => {
    if (direction === 'up' && currentIndex > 0) {
      setFocusedIndex(currentIndex - 1)
    } else if (direction === 'down' && currentIndex < expressions.length - 1) {
      setFocusedIndex(currentIndex + 1)
    }
  }

  const handleAddNewExpression = () => {
    addExpression({
      kind: 'cartesian',
      input: '',
      latex: '',
      color: PRESET_COLORS[expressions.length % PRESET_COLORS.length],
      visible: true,
      selected: false,
    })
    setFocusedIndex(expressions.length)
  }

  return (
    <div className="expression-editor">
      <div className="expression-list">
        {expressions.map((expr, index) => (
          <div
            key={expr.id}
            style={{ display: 'flex', flexDirection: 'column' }}
          >
            <div
              className={`expression-item ${draggedIndex === index ? 'dragging' : ''} ${dragOverIndex === index ? 'drag-over' : ''}`}
              draggable
              onDragStart={(e) => handleDragStart(e, index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragEnd={handleDragEnd}
              onDrop={(e) => handleDrop(e, index)}
            >
              <div
                className={`line-number ${expr.kind !== 'text' ? 'clickable' : ''} ${expr.visible === false ? 'hidden-expr' : ''}`}
                onClick={(e) => {
                  if (expr.kind !== 'text') {
                    e.stopPropagation()
                    updateExpression(expr.id, { visible: !expr.visible })
                  }
                }}
                title={expr.kind !== 'text' ? (expr.visible ? '클릭하여 그래프에서 숨기기' : '클릭하여 그래프에 표시') : ''}
              >
                {expr.kind !== 'text' && expr.visible === false ? (
                  <span className="hidden-indicator">⊘</span>
                ) : (
                  <span>{index + 1}</span>
                )}
              </div>
              <div className={`expression-content ${expr.kind === 'text' ? 'text-input' : ''}`}>
                {expr.kind === 'text' ? (
                  <TextEditor
                    ref={(el) => (editorRefs.current[index] = el)}
                    value={expr.input || ''}
                    onChange={(text) => handleTextChange(expr.id, text)}
                    onEnter={() => handleKeyDown(index, expr.latex)}
                    onFocus={() => handleExpressionFocus(expr.id)}
                    onNavigate={(direction) => handleNavigate(index, direction)}
                    onConvertToMath={() => handleConvertToMath(expr.id, index)}
                  />
                ) : (
                  <>
                    <MathLiveEditor
                      ref={(el) => (editorRefs.current[index] = el)}
                      value={expr.latex}
                      onChange={(latex) => handleExpressionLatexChange(expr.id, latex)}
                      onEnter={() => handleKeyDown(index, expr.latex)}
                      onFocus={() => handleExpressionFocus(expr.id)}
                      onConvertToText={() => handleConvertToText(expr.id, index)}
                      onNavigate={(direction) => handleNavigate(index, direction)}
                    />
                  </>
                )}
              </div>
            {expr.kind !== 'text' && (
              <>
                <button
                  className="delete-button"
                  onClick={() => handleDeleteExpression(expr.id, true)}
                  title={expressions.length === 1 ? 'Clear expression' : 'Delete'}
                >
                  ×
                </button>
                <div className="color-picker-wrapper">
                  <div
                    className="color-indicator"
                    style={{ backgroundColor: expr.color }}
                    onClick={(e) => handleColorClick(expr.id, e)}
                    title="Change color"
                  />
                  {colorPickerOpen === expr.id && (
                    <div className="color-picker-dropdown">
                      {PRESET_COLORS.map((color) => (
                        <div
                          key={color}
                          className="color-option"
                          style={{ backgroundColor: color }}
                          onClick={() => handleColorSelect(expr.id, color)}
                          title={color}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
            {expr.kind === 'text' && (
              <button
                className="delete-button"
                onClick={() => handleDeleteExpression(expr.id, false)}
                title={expressions.length === 1 ? 'Clear text' : 'Delete'}
              >
                ×
              </button>
            )}
            </div>
            {calculatedResults[expr.id] !== undefined && calculatedResults[expr.id] !== null && expr.kind !== 'text' && (
              <div style={{
                width: '100%',
                padding: '8px 12px',
                backgroundColor: '#f0f9ff',
                borderTop: '1px solid #4ecdc4',
                borderLeft: '1px solid #e0e0e0',
                borderRight: '1px solid #e0e0e0',
                borderBottom: '1px solid #e0e0e0'
              }}>
                <math-field
                  read-only
                  style={{
                    fontSize: '16px',
                    border: 'none',
                    padding: '0',
                    backgroundColor: 'transparent',
                    color: '#0066ff',
                    fontWeight: '500'
                  }}
                >
                  {`= ${typeof calculatedResults[expr.id] === 'number'
                    ? Math.abs(calculatedResults[expr.id]!) < 0.0001 || Math.abs(calculatedResults[expr.id]!) > 10000
                      ? calculatedResults[expr.id]!.toExponential(6)
                      : calculatedResults[expr.id]!.toFixed(Math.abs(calculatedResults[expr.id]!) < 1 ? 6 : 2).replace(/\.?0+$/, '')
                    : calculatedResults[expr.id]}`}
                </math-field>
              </div>
            )}
          </div>
        ))}
      </div>
      <button
        className="add-expression-button"
        onClick={handleAddNewExpression}
        title="새 수식 추가 (Enter)"
      >
        <span className="add-icon">+</span>
      </button>
    </div>
  )
}
