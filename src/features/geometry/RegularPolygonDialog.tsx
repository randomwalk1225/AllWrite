import { useStore } from '../../store'
import { useRef, useEffect } from 'react'
import './RegularPolygonDialog.css'

export function RegularPolygonDialog() {
  const regularPolygonDialog = useStore((state) => state.regularPolygonDialog)
  const setRegularPolygonDialog = useStore((state) => state.setRegularPolygonDialog)
  const closeRegularPolygonDialog = useStore((state) => state.closeRegularPolygonDialog)
  const addGeometryObject = useStore((state) => state.addGeometryObject)
  const updateGeometryObject = useStore((state) => state.updateGeometryObject)
  const geometryObjects = useStore((state) => state.geometryObjects)
  const cancelCreation = useStore((state) => state.cancelCreation)
  const inputRef = useRef<HTMLInputElement>(null)

  // Auto-focus on input when dialog appears
  useEffect(() => {
    if (regularPolygonDialog.visible && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [regularPolygonDialog.visible])

  if (!regularPolygonDialog.visible) {
    return null
  }

  const handleIncrement = () => {
    setRegularPolygonDialog({ sides: Math.min(regularPolygonDialog.sides + 1, 20) })
  }

  const handleDecrement = () => {
    setRegularPolygonDialog({ sides: Math.max(regularPolygonDialog.sides - 1, 3) })
  }

  const handleConfirm = () => {
    // Get the center and radius points
    const centerPoint = geometryObjects.find(obj => obj.id === regularPolygonDialog.centerPointId)
    const radiusPoint = geometryObjects.find(obj => obj.id === regularPolygonDialog.radiusPointId)

    if (!centerPoint || !radiusPoint) {
      closeRegularPolygonDialog()
      cancelCreation()
      return
    }

    const center = centerPoint.points[0]
    const radiusPos = radiusPoint.points[0]
    const radius = Math.sqrt(
      Math.pow(radiusPos.x - center.x, 2) + Math.pow(radiusPos.y - center.y, 2)
    )

    // Calculate vertices
    const sides = regularPolygonDialog.sides
    const vertices: { x: number; y: number }[] = []
    // Start angle from center to radius point (first vertex will be at radius point)
    const startAngle = Math.atan2(radiusPos.y - center.y, radiusPos.x - center.x)

    for (let i = 0; i < sides; i++) {
      const angle = startAngle + (i * 2 * Math.PI / sides)
      vertices.push({
        x: center.x + radius * Math.cos(angle),
        y: center.y + radius * Math.sin(angle),
      })
    }

    // Create the polygon
    const newPolygonId = addGeometryObject({
      type: 'polygon',
      subType: 'polygon-regular',
      points: vertices,
      color: '#ABD5B1',
      strokeWidth: 4,
      visible: true,
      selected: false,
      label: '',
      scale: 1,
      dependencies: [regularPolygonDialog.centerPointId!, regularPolygonDialog.radiusPointId!],
      sides: sides,
    })

    // Update parent points to include this polygon as a dependent
    updateGeometryObject(regularPolygonDialog.centerPointId!, {
      dependents: [...(centerPoint.dependents || []), newPolygonId],
    })
    updateGeometryObject(regularPolygonDialog.radiusPointId!, {
      dependents: [...(radiusPoint.dependents || []), newPolygonId],
    })

    // Close dialog and clean up
    closeRegularPolygonDialog()
    cancelCreation()
  }

  const handleCancel = () => {
    closeRegularPolygonDialog()
    cancelCreation()
  }

  return (
    <div className="polygon-input-box">
      <div className="polygon-input-header">
        <span className="polygon-input-title">정다각형</span>
        <button className="polygon-close-button" onClick={handleCancel} title="취소">
          ×
        </button>
      </div>

      <div className="polygon-input-body">
        <label className="polygon-label">변의 개수:</label>
        <div className="polygon-spinbox">
          <button
            className="polygon-spinbox-button"
            onClick={handleDecrement}
            disabled={regularPolygonDialog.sides <= 3}
          >
            −
          </button>
          <input
            ref={inputRef}
            type="number"
            className="polygon-spinbox-input"
            value={regularPolygonDialog.sides}
            onChange={(e) => {
              const value = parseInt(e.target.value)
              if (!isNaN(value)) {
                // Clamp value between 3 and 20
                const clampedValue = Math.max(3, Math.min(20, value))
                setRegularPolygonDialog({ sides: clampedValue })
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleConfirm()
              } else if (e.key === 'Escape') {
                handleCancel()
              }
            }}
            min={3}
            max={20}
          />
          <button
            className="polygon-spinbox-button"
            onClick={handleIncrement}
            disabled={regularPolygonDialog.sides >= 20}
          >
            +
          </button>
        </div>
      </div>

      <button className="polygon-confirm-button" onClick={handleConfirm}>
        확인
      </button>
    </div>
  )
}
