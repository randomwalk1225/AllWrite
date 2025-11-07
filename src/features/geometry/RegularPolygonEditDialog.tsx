import { useStore } from '../../store'
import { useEffect, useRef } from 'react'
import './RegularPolygonEditDialog.css'

export function RegularPolygonEditDialog() {
  const selectedIds = useStore((state) => state.selectedIds) || []
  const geometryObjects = useStore((state) => state.geometryObjects) || []
  const updateGeometryObject = useStore((state) => state.updateGeometryObject)
  const sidesInputRef = useRef<HTMLInputElement>(null)

  // Find selected regular polygon
  const selectedPolygon = geometryObjects.find(
    obj => selectedIds.includes(obj.id) && obj.subType === 'polygon-regular'
  )

  // Auto-focus on sides input when dialog appears
  useEffect(() => {
    if (selectedPolygon && sidesInputRef.current) {
      sidesInputRef.current.focus()
      sidesInputRef.current.select()
    }
  }, [selectedPolygon?.id])

  if (!selectedPolygon || !selectedPolygon.sides || !selectedPolygon.dependencies || selectedPolygon.dependencies.length < 2) {
    return null
  }

  const currentSides = selectedPolygon.sides
  const [centerPointId, radiusPointId] = selectedPolygon.dependencies

  const updateSides = (newSides: number) => {
    // Clamp values between 3 and 20
    const clampedSides = Math.max(3, Math.min(20, newSides))

    // Get the center and radius points
    const centerPoint = geometryObjects.find(obj => obj.id === centerPointId)
    const radiusPoint = geometryObjects.find(obj => obj.id === radiusPointId)

    if (!centerPoint || !radiusPoint || !centerPoint.points || !radiusPoint.points) return

    const center = centerPoint.points[0]
    const radiusPos = radiusPoint.points[0]
    const radius = Math.sqrt(
      Math.pow(radiusPos.x - center.x, 2) + Math.pow(radiusPos.y - center.y, 2)
    )

    // Calculate new vertices
    const vertices: { x: number; y: number }[] = []
    // Start angle from center to radius point (first vertex will be at radius point)
    const startAngle = Math.atan2(radiusPos.y - center.y, radiusPos.x - center.x)

    for (let i = 0; i < clampedSides; i++) {
      const angle = startAngle + (i * 2 * Math.PI / clampedSides)
      vertices.push({
        x: center.x + radius * Math.cos(angle),
        y: center.y + radius * Math.sin(angle),
      })
    }

    // Update the polygon with new sides and vertices
    updateGeometryObject(selectedPolygon.id, {
      sides: clampedSides,
      points: vertices
    })
  }

  const handleSidesChange = (value: number) => {
    updateSides(value)
  }

  return (
    <div className="regular-polygon-edit-dialog">
      <div className="regular-polygon-edit-header">
        <span className="regular-polygon-edit-title">정다각형 변의 수</span>
      </div>

      <div className="regular-polygon-edit-body">
        <div className="sides-row">
          <label className="sides-label">변의 개수:</label>
          <div className="sides-spinbox">
            <button
              className="sides-spinbox-button"
              onClick={() => handleSidesChange(currentSides - 1)}
              disabled={currentSides <= 3}
            >
              −
            </button>
            <input
              ref={sidesInputRef}
              type="number"
              className="sides-spinbox-input"
              value={currentSides}
              onChange={(e) => {
                const value = parseInt(e.target.value)
                if (!isNaN(value)) {
                  handleSidesChange(value)
                }
              }}
              min={3}
              max={20}
            />
            <button
              className="sides-spinbox-button"
              onClick={() => handleSidesChange(currentSides + 1)}
              disabled={currentSides >= 20}
            >
              +
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
