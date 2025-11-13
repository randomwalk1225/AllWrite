import { useStore } from '../../store'
import type { GeometryObjectType, GeometryToolType } from '../../store'
import './GeometryToolPanel.css'

export function GeometryToolPanel() {
  const geometryTool = useStore((state) => state.geometryTool)
  const setGeometryTool = useStore((state) => state.setGeometryTool)
  const geometryObjects = useStore((state) => state.geometryObjects)
  const removeGeometryObject = useStore((state) => state.removeGeometryObject)
  const updateGeometryObject = useStore((state) => state.updateGeometryObject)
  const setDrawingTool = useStore((state) => state.setDrawingTool)
  const startCreation = useStore((state) => state.startCreation)
  const cancelCreation = useStore((state) => state.cancelCreation)
  const creationState = useStore((state) => state.creationState)
  const selectedIds = useStore((state) => state.selectedIds)
  const setSelectedIds = useStore((state) => state.setSelectedIds)

  const handleSubToolClick = (subType: GeometryToolType) => {
    // Deactivate all other tools
    setDrawingTool('none')
    setGeometryTool('none')
    // Start creation for this tool
    startCreation(subType)
  }

  const handlePolygonClick = () => {
    // Deactivate all other tools
    setDrawingTool('none')
    cancelCreation()
    // Toggle polygon tool
    if (geometryTool === 'polygon') {
      setGeometryTool('none')
    } else {
      setGeometryTool('polygon')
    }
  }

  const handleGeometryItemClick = (objId: string, e: React.MouseEvent) => {
    e.stopPropagation()

    const obj = geometryObjects.find(o => o.id === objId)
    if (!obj) return

    // If shift key is pressed, toggle selection
    if (e.shiftKey) {
      if (selectedIds.includes(objId)) {
        // Deselect this item
        setSelectedIds(selectedIds.filter(id => id !== objId))
      } else {
        // Add to selection
        setSelectedIds([...selectedIds, objId])
      }
    } else {
      // Single select - select only this item
      setSelectedIds([objId])
    }

    // Activate select tool if not already active
    if (setDrawingTool) {
      setDrawingTool('select')
    }
  }

  const getToolIcon = (type: GeometryObjectType, subType?: GeometryToolType): string => {
    // Check for polygon subtypes
    if (subType === 'polygon-regular') return '⬟'
    if (subType === 'polygon-parallelogram') return '▱'
    if (subType === 'polygon-rhombus') return '◇'
    if (subType === 'polygon-rectangle') return '▭'
    if (subType === 'polygon-square') return '▢'
    if (subType === 'polygon-kite') return '◆'
    if (subType === 'polygon-right-triangle') return '◢'

    // Default icons
    switch (type) {
      case 'point': return '●'
      case 'segment': return '─'
      case 'line': return '↔'
      case 'ray': return '→'
      case 'circle': return '○'
      case 'polygon': return '▱'
      default: return '?'
    }
  }

  const getToolLabel = (type: GeometryObjectType, subType?: GeometryToolType): string => {
    // Check for polygon subtypes
    if (subType === 'polygon-regular') return '정다각형'
    if (subType === 'polygon-parallelogram') return '평행사변형'
    if (subType === 'polygon-rhombus') return '마름모'
    if (subType === 'polygon-rectangle') return '직사각형'
    if (subType === 'polygon-square') return '정사각형'
    if (subType === 'polygon-kite') return '연'
    if (subType === 'polygon-right-triangle') return '직각삼각형'

    // Default labels
    switch (type) {
      case 'point': return '점'
      case 'segment': return '선분'
      case 'line': return '직선'
      case 'ray': return '반직선'
      case 'circle': return '원'
      case 'polygon': return '다각형'
      default: return '?'
    }
  }

  // Submenu options
  const subMenuOptions = {
    point: [
      { type: 'point-fixed' as GeometryToolType, icon: '●', label: '고정점' },
      { type: 'point-midpoint' as GeometryToolType, icon: '◐', label: '중점' },
    ],
    line: [
      { type: 'line-infinite' as GeometryToolType, icon: '↔', label: '직선' },
      { type: 'line-segment' as GeometryToolType, icon: '─', label: '선분' },
      { type: 'line-ray' as GeometryToolType, icon: '→', label: '반직선' },
    ],
    circle: [
      { type: 'circle-center-radius' as GeometryToolType, icon: '⊙', label: '중심-반지름' },
      { type: 'circle-three-points' as GeometryToolType, icon: '◎', label: '세 점' },
      { type: 'circle-diameter' as GeometryToolType, icon: '⊚', label: '지름' },
    ],
  }

  return (
    <div className="geometry-tool-panel">
      <div className="tool-section">
        <h3>도형 도구</h3>
        <div className="tool-list">
          {/* Point tools */}
          <div className="tool-category">
            <div className="category-header">점</div>
            <div className="submenu-list">
              {subMenuOptions.point.map((option) => (
                <button
                  key={option.type}
                  className={`submenu-item ${creationState.toolType === option.type ? 'active' : ''}`}
                  onClick={() => handleSubToolClick(option.type)}
                >
                  <span className="submenu-icon">{option.icon}</span>
                  <span className="submenu-label">{option.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Line tools */}
          <div className="tool-category">
            <div className="category-header">선</div>
            <div className="submenu-list">
              {subMenuOptions.line.map((option) => (
                <button
                  key={option.type}
                  className={`submenu-item ${creationState.toolType === option.type ? 'active' : ''}`}
                  onClick={() => handleSubToolClick(option.type)}
                >
                  <span className="submenu-icon">{option.icon}</span>
                  <span className="submenu-label">{option.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Circle tools */}
          <div className="tool-category">
            <div className="category-header">원</div>
            <div className="submenu-list">
              {subMenuOptions.circle.map((option) => (
                <button
                  key={option.type}
                  className={`submenu-item ${creationState.toolType === option.type ? 'active' : ''}`}
                  onClick={() => handleSubToolClick(option.type)}
                >
                  <span className="submenu-icon">{option.icon}</span>
                  <span className="submenu-label">{option.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Polygon tools */}
          <div className="tool-category">
            <div className="category-header">다각형</div>
            <div className="submenu-list">
              <button
                className={`submenu-item ${creationState.toolType === 'polygon-regular' ? 'active' : ''}`}
                onClick={() => handleSubToolClick('polygon-regular')}
                title="정다각형"
              >
                <span className="submenu-icon">⬟</span>
                <span className="submenu-label">정다각형</span>
              </button>
              <button
                className={`submenu-item ${creationState.toolType === 'polygon-parallelogram' ? 'active' : ''}`}
                onClick={() => handleSubToolClick('polygon-parallelogram')}
                title="평행사변형"
              >
                <span className="submenu-icon">▱</span>
                <span className="submenu-label">평행사변형</span>
              </button>
              <button
                className={`submenu-item ${creationState.toolType === 'polygon-rhombus' ? 'active' : ''}`}
                onClick={() => handleSubToolClick('polygon-rhombus')}
                title="마름모"
              >
                <span className="submenu-icon">◇</span>
                <span className="submenu-label">마름모</span>
              </button>
              <button
                className={`submenu-item ${creationState.toolType === 'polygon-rectangle' ? 'active' : ''}`}
                onClick={() => handleSubToolClick('polygon-rectangle')}
                title="직사각형"
              >
                <span className="submenu-icon">▭</span>
                <span className="submenu-label">직사각형</span>
              </button>
              <button
                className={`submenu-item ${creationState.toolType === 'polygon-square' ? 'active' : ''}`}
                onClick={() => handleSubToolClick('polygon-square')}
                title="정사각형"
              >
                <span className="submenu-icon">▢</span>
                <span className="submenu-label">정사각형</span>
              </button>
              <button
                className={`submenu-item ${creationState.toolType === 'polygon-kite' ? 'active' : ''}`}
                onClick={() => handleSubToolClick('polygon-kite')}
                title="연"
              >
                <span className="submenu-icon">◆</span>
                <span className="submenu-label">연</span>
              </button>
              <button
                className={`submenu-item ${creationState.toolType === 'polygon-right-triangle' ? 'active' : ''}`}
                onClick={() => handleSubToolClick('polygon-right-triangle')}
                title="직각삼각형"
              >
                <span className="submenu-icon">◢</span>
                <span className="submenu-label">직각삼각형</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="tool-section">
        <h3>도형 목록 ({geometryObjects.length})</h3>
        <div className="geometry-list">
          {geometryObjects.length === 0 ? (
            <p className="empty-message">아직 생성된 도형이 없습니다.</p>
          ) : (
            geometryObjects.map((obj) => (
              <div
                key={obj.id}
                className={`geometry-item ${selectedIds.includes(obj.id) ? 'selected' : ''}`}
                onClick={(e) => handleGeometryItemClick(obj.id, e)}
                style={{ cursor: 'pointer' }}
              >
                <span className="geometry-icon" style={{ color: obj.color }}>
                  {getToolIcon(obj.type, obj.subType)}
                </span>
                <span className="geometry-name">
                  {obj.label ? `${obj.label} - ` : ''}{getToolLabel(obj.type, obj.subType)}
                </span>
                <button
                  className="geometry-visibility"
                  onClick={(e) => {
                    e.stopPropagation()
                    updateGeometryObject(obj.id, { visible: !obj.visible })
                  }}
                  title={obj.visible ? "숨기기" : "보이기"}
                  style={{ opacity: obj.visible ? 1 : 0.3 }}
                >
                  {obj.visible ? '👁' : '🚫'}
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
