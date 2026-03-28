import { useState, useRef, useCallback } from 'react'
import { useStore } from '../store'
import { useShallow } from 'zustand/react/shallow'
import { HexColorPicker } from 'react-colorful'
import './MobileToolbar.css'

export function MobileToolbar() {
  const [showTray, setShowTray] = useState(false)
  const [showThickness, setShowThickness] = useState<'pen' | 'highlighter' | 'eraser' | null>(null)
  const [showColorPicker, setShowColorPicker] = useState(false)
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const {
    drawingTool, penColor, highlighterColor,
    penThickness, highlighterThickness, eraserThickness,
  } = useStore(useShallow((s) => ({
    drawingTool: s.drawingTool,
    penColor: s.penColor,
    highlighterColor: s.highlighterColor,
    penThickness: s.penThickness,
    highlighterThickness: s.highlighterThickness,
    eraserThickness: s.eraserThickness,
  })))

  const {
    setDrawingTool, setPenColor, setHighlighterColor,
    setPenThickness, setHighlighterThickness, setEraserThickness,
    undo, redo, canUndo, canRedo,
    clearDrawings, clearAll, resetView,
    setGeometryTool, cancelCreation,
  } = useStore(useShallow((s) => ({
    setDrawingTool: s.setDrawingTool,
    setPenColor: s.setPenColor,
    setHighlighterColor: s.setHighlighterColor,
    setPenThickness: s.setPenThickness,
    setHighlighterThickness: s.setHighlighterThickness,
    setEraserThickness: s.setEraserThickness,
    undo: s.undo,
    redo: s.redo,
    canUndo: s.canUndo,
    canRedo: s.canRedo,
    clearDrawings: s.clearDrawings,
    clearAll: s.clearAll,
    resetView: s.resetView,
    setGeometryTool: s.setGeometryTool,
    cancelCreation: s.cancelCreation,
  })))

  const selectTool = useCallback((tool: string) => {
    setDrawingTool(drawingTool === tool ? 'none' : tool)
    setGeometryTool('none')
    cancelCreation()
    setShowTray(false)
    setShowThickness(null)
    setShowColorPicker(false)
  }, [drawingTool, setDrawingTool, setGeometryTool, cancelCreation])

  const handleLongPressStart = useCallback((tool: 'pen' | 'highlighter' | 'eraser') => {
    longPressTimer.current = setTimeout(() => {
      setShowThickness(tool)
    }, 400)
  }, [])

  const handleLongPressEnd = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
  }, [])

  const activeColor = drawingTool === 'highlighter' ? highlighterColor : penColor

  const thicknessOptions = showThickness === 'pen'
    ? [1, 2, 3, 4, 5, 6]
    : showThickness === 'highlighter'
    ? [10, 15, 20, 30, 40, 60]
    : [10, 20, 30, 40, 60, 80]

  const currentThickness = showThickness === 'pen'
    ? penThickness
    : showThickness === 'highlighter'
    ? highlighterThickness
    : eraserThickness

  const setThickness = showThickness === 'pen'
    ? setPenThickness
    : showThickness === 'highlighter'
    ? setHighlighterThickness
    : setEraserThickness

  return (
    <>
      {/* Thickness popup */}
      {showThickness && (
        <>
          <div className="mobile-tray-backdrop" onClick={() => setShowThickness(null)} />
          <div className="mobile-thickness-popup">
            {thicknessOptions.map(t => (
              <button
                key={t}
                className={`mobile-thickness-option ${currentThickness === t ? 'active' : ''}`}
                onClick={() => { setThickness(t); setShowThickness(null) }}
              >
                <div style={{
                  width: Math.min(t * (showThickness === 'pen' ? 3 : 0.6), 28),
                  height: Math.min(t * (showThickness === 'pen' ? 3 : 0.6), 28),
                  borderRadius: '50%',
                  backgroundColor: showThickness === 'eraser' ? '#ccc' : activeColor,
                  opacity: showThickness === 'highlighter' ? 0.4 : 1,
                }} />
              </button>
            ))}
          </div>
        </>
      )}

      {/* Color picker popup */}
      {showColorPicker && (
        <>
          <div className="mobile-tray-backdrop" onClick={() => setShowColorPicker(false)} />
          <div className="mobile-thickness-popup" style={{ flexDirection: 'column', width: '220px' }}>
            <HexColorPicker
              color={drawingTool === 'highlighter' ? highlighterColor : penColor}
              onChange={(c) => drawingTool === 'highlighter' ? setHighlighterColor(c) : setPenColor(c)}
              style={{ width: '100%', height: '140px' }}
            />
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 8 }}>
              {['#2c2c2c', '#ff0000', '#0000ff', '#00aa00', '#ff8800', '#9900cc', '#ffffff'].map(c => (
                <button
                  key={c}
                  onClick={() => {
                    drawingTool === 'highlighter' ? setHighlighterColor(c) : setPenColor(c)
                    setShowColorPicker(false)
                  }}
                  style={{
                    width: 28, height: 28, borderRadius: 6,
                    backgroundColor: c,
                    border: c === (drawingTool === 'highlighter' ? highlighterColor : penColor) ? '3px solid #4ecdc4' : '2px solid #ddd',
                  }}
                />
              ))}
            </div>
          </div>
        </>
      )}

      {/* Secondary tray */}
      {showTray && (
        <>
          <div className="mobile-tray-backdrop" onClick={() => setShowTray(false)} />
          <div className="mobile-tray">
            <button className="mobile-tray-btn" onClick={() => undo()} disabled={!canUndo()}>
              <span>↶</span><span className="mobile-tray-label">실행취소</span>
            </button>
            <button className="mobile-tray-btn" onClick={() => redo()} disabled={!canRedo()}>
              <span>↷</span><span className="mobile-tray-label">다시실행</span>
            </button>
            <button className="mobile-tray-btn" onClick={() => resetView()}>
              <span>🏠</span><span className="mobile-tray-label">초기화</span>
            </button>
            <button className="mobile-tray-btn" onClick={() => { clearDrawings(); setShowTray(false) }}>
              <span>🗑️</span><span className="mobile-tray-label">그림삭제</span>
            </button>
            <button className="mobile-tray-btn" onClick={() => useStore.getState().zoom(1.3)}>
              <span>🔍+</span><span className="mobile-tray-label">확대</span>
            </button>
            <button className="mobile-tray-btn" onClick={() => useStore.getState().zoom(0.7)}>
              <span>🔍−</span><span className="mobile-tray-label">축소</span>
            </button>
            <button className="mobile-tray-btn" onClick={() => { clearAll(); setShowTray(false) }}>
              <span>💣</span><span className="mobile-tray-label">모두삭제</span>
            </button>
            <button className="mobile-tray-btn" onClick={() => selectTool('select')}>
              <span>☝️</span><span className="mobile-tray-label">복사붙이기</span>
            </button>
          </div>
        </>
      )}

      {/* Primary toolbar */}
      <div className="mobile-toolbar">
        <div className="mobile-toolbar-primary">
          <button
            className={`mobile-tool-btn ${drawingTool === 'pen' ? 'active' : ''}`}
            onClick={() => selectTool('pen')}
            onTouchStart={() => handleLongPressStart('pen')}
            onTouchEnd={handleLongPressEnd}
          >
            <span>✏️</span>
            <span className="mobile-tool-label">펜</span>
          </button>

          <button
            className={`mobile-tool-btn ${drawingTool === 'highlighter' ? 'active' : ''}`}
            onClick={() => selectTool('highlighter')}
            onTouchStart={() => handleLongPressStart('highlighter')}
            onTouchEnd={handleLongPressEnd}
          >
            <span>🖍️</span>
            <span className="mobile-tool-label">형광펜</span>
          </button>

          <button
            className={`mobile-tool-btn ${drawingTool === 'eraser' ? 'active' : ''}`}
            onClick={() => selectTool('eraser')}
            onTouchStart={() => handleLongPressStart('eraser')}
            onTouchEnd={handleLongPressEnd}
          >
            <span>🧹</span>
            <span className="mobile-tool-label">지우개</span>
          </button>

          <button
            className={`mobile-tool-btn ${drawingTool === 'select' ? 'active' : ''}`}
            onClick={() => selectTool('select')}
          >
            <span>👆</span>
            <span className="mobile-tool-label">선택</span>
          </button>

          <button
            className={`mobile-tool-btn ${drawingTool === 'text' ? 'active' : ''}`}
            onClick={() => selectTool('text')}
          >
            <span>T</span>
            <span className="mobile-tool-label">텍스트</span>
          </button>

          <button
            className="mobile-tool-btn"
            onClick={() => { setShowColorPicker(!showColorPicker); setShowTray(false); setShowThickness(null) }}
          >
            <div className="mobile-color-indicator" style={{ backgroundColor: activeColor }} />
            <span className="mobile-tool-label">색상</span>
          </button>

          <button
            className={`mobile-tool-btn ${showTray ? 'active' : ''}`}
            onClick={() => { setShowTray(!showTray); setShowThickness(null); setShowColorPicker(false) }}
          >
            <span>⋯</span>
            <span className="mobile-tool-label">더보기</span>
          </button>
        </div>
      </div>
    </>
  )
}
