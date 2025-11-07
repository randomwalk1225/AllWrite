import { useState, useRef, useEffect, ReactNode, forwardRef, useImperativeHandle } from 'react'
import './SplitPanel.css'

interface SplitPanelProps {
  left: ReactNode
  right: ReactNode
  defaultLeftWidth?: number
  minLeftWidth?: number
  maxLeftWidth?: number
}

export interface SplitPanelHandle {
  setThreeSevenRatio: () => void
  isPanelCollapsed: () => boolean
}

// Forwardable split panel component with 3:7 ratio support
const SplitPanelComponent = forwardRef<SplitPanelHandle, SplitPanelProps>(({
  left,
  right,
  defaultLeftWidth = 300,
  minLeftWidth = 200,
  maxLeftWidth = 600,
}, ref) => {
  // Use defaultLeftWidth as initial state
  const [leftWidth, setLeftWidth] = useState(defaultLeftWidth)
  const [isDragging, setIsDragging] = useState(false)
  const [savedWidth, setSavedWidth] = useState(defaultLeftWidth)
  const containerRef = useRef<HTMLDivElement>(null)

  // Set 3:7 ratio function (now 25%)
  const setThreeSevenRatio = () => {
    if (containerRef.current) {
      const containerWidth = containerRef.current.getBoundingClientRect().width
      const newWidth = containerWidth * 0.25
      setLeftWidth(Math.max(minLeftWidth, Math.min(maxLeftWidth, newWidth)))
      setSavedWidth(newWidth)
    }
  }

  // Expose methods to parent component
  useImperativeHandle(ref, () => ({
    setThreeSevenRatio,
    isPanelCollapsed: () => {
      if (!containerRef.current) return false
      const isRightCollapsed = leftWidth >= containerRef.current.getBoundingClientRect().width - 10
      return leftWidth === 0 || isRightCollapsed
    },
  }))

  // Restore left panel to 25% width
  const restoreLeftPanel = () => {
    if (containerRef.current) {
      const containerWidth = containerRef.current.getBoundingClientRect().width
      const newWidth = containerWidth * 0.25
      setLeftWidth(Math.max(minLeftWidth, Math.min(maxLeftWidth, newWidth)))
      setSavedWidth(newWidth)
    }
  }

  // Restore right panel (set left to allow right to be 75%)
  const restoreRightPanel = () => {
    if (containerRef.current) {
      const containerWidth = containerRef.current.getBoundingClientRect().width
      const newWidth = containerWidth * 0.25
      setLeftWidth(Math.max(minLeftWidth, Math.min(maxLeftWidth, newWidth)))
      setSavedWidth(newWidth)
    }
  }

  // Maximize left panel (collapse right panel)
  const maximizeLeftPanel = () => {
    if (containerRef.current) {
      const containerWidth = containerRef.current.getBoundingClientRect().width
      setLeftWidth(containerWidth)
    }
  }

  // Maximize right panel (collapse left panel)
  const maximizeRightPanel = () => {
    setLeftWidth(0)
  }

  // Set initial width only if defaultLeftWidth was not explicitly set to 0
  // and was using the default value of 300
  useEffect(() => {
    // Only auto-calculate width if using default 300px value
    // If user explicitly sets 0, respect that
    if (containerRef.current && defaultLeftWidth === 300) {
      const containerWidth = containerRef.current.getBoundingClientRect().width
      const initialWidth = containerWidth * 0.4
      setLeftWidth(Math.max(minLeftWidth, Math.min(maxLeftWidth, initialWidth)))
    }
    // If defaultLeftWidth is 0 or any other explicit value, keep it as is
  }, [defaultLeftWidth, minLeftWidth, maxLeftWidth])

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging || !containerRef.current) return

      const containerRect = containerRef.current.getBoundingClientRect()
      const newWidth = e.clientX - containerRect.left

      // Allow resizing from minLeftWidth to maxLeftWidth
      if (newWidth >= minLeftWidth && newWidth <= maxLeftWidth) {
        setLeftWidth(newWidth)
      }
    }

    const handleMouseUp = () => {
      setIsDragging(false)
    }

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging, minLeftWidth, maxLeftWidth])

  const isRightCollapsed = containerRef.current && leftWidth >= containerRef.current.getBoundingClientRect().width - 10
  const isPanelCollapsed = leftWidth === 0 || isRightCollapsed

  return (
    <div ref={containerRef} className="split-panel">

      <div
        className="split-panel-left"
        style={{ width: leftWidth, position: 'relative' }}
      >
        {left}
        {/* Arrow to toggle left panel - maximize or restore */}
        {leftWidth > 0 && (
          <button
            onClick={isRightCollapsed ? setThreeSevenRatio : maximizeLeftPanel}
            style={{
              position: 'absolute',
              right: '0px',
              bottom: '10px',
              zIndex: 1000,
              width: '16px',
              height: '80px',
              backgroundColor: 'rgba(100, 100, 100, 0.15)',
              border: 'none',
              borderTopLeftRadius: '8px',
              borderBottomLeftRadius: '8px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s ease',
              fontSize: '18px',
              fontWeight: 'bold',
              color: 'rgba(0, 0, 0, 0.6)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(100, 100, 100, 0.3)'
              e.currentTarget.style.color = 'rgba(0, 0, 0, 0.85)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(100, 100, 100, 0.15)'
              e.currentTarget.style.color = 'rgba(0, 0, 0, 0.6)'
            }}
            title={isRightCollapsed ? "분할화면으로 돌아가기" : "수식입력창 전체화면"}
          >
            {isRightCollapsed ? '‹' : '›'}
          </button>
        )}
      </div>

      <div
        className={`split-panel-divider ${isDragging ? 'dragging' : ''}`}
        onMouseDown={handleMouseDown}
      >
        <div className="divider-handle" />
      </div>

      <div className="split-panel-right" style={{ position: 'relative' }}>
        {right}
        {/* Arrow to toggle right panel - maximize or restore */}
        {!isRightCollapsed && (
          <button
            onClick={leftWidth === 0 ? setThreeSevenRatio : maximizeRightPanel}
            style={{
              position: 'absolute',
              left: '0px',
              bottom: '10px',
              zIndex: 1000,
              width: '16px',
              height: '80px',
              backgroundColor: 'rgba(100, 100, 100, 0.15)',
              border: 'none',
              borderTopRightRadius: '8px',
              borderBottomRightRadius: '8px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s ease',
              fontSize: '18px',
              fontWeight: 'bold',
              color: 'rgba(0, 0, 0, 0.6)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(100, 100, 100, 0.3)'
              e.currentTarget.style.color = 'rgba(0, 0, 0, 0.85)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(100, 100, 100, 0.15)'
              e.currentTarget.style.color = 'rgba(0, 0, 0, 0.6)'
            }}
            title={leftWidth === 0 ? "분할화면으로 돌아가기" : "그래프창 전체화면"}
          >
            {leftWidth === 0 ? '›' : '‹'}
          </button>
        )}
      </div>
    </div>
  )
})

SplitPanelComponent.displayName = 'SplitPanel'

export const SplitPanel = SplitPanelComponent
