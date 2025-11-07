import { useStore } from '../../store'
import { useEffect, useRef } from 'react'
import './DivisionPointDialog.css'

export function DivisionPointDialog() {
  const selectedIds = useStore((state) => state.selectedIds) || []
  const geometryObjects = useStore((state) => state.geometryObjects) || []
  const updateGeometryObject = useStore((state) => state.updateGeometryObject)
  const mInputRef = useRef<HTMLInputElement>(null)

  // Find selected midpoint/division point
  const selectedMidpoint = geometryObjects.find(
    obj => selectedIds.includes(obj.id) && obj.subType === 'point-midpoint'
  )

  // Auto-focus on m input when dialog appears
  useEffect(() => {
    if (selectedMidpoint && mInputRef.current) {
      mInputRef.current.focus()
      mInputRef.current.select()
    }
  }, [selectedMidpoint?.id])

  if (!selectedMidpoint || !selectedMidpoint.ratio || !selectedMidpoint.dependencies || selectedMidpoint.dependencies.length < 2) {
    return null
  }

  const { m, n } = selectedMidpoint.ratio
  const [point1Id, point2Id] = selectedMidpoint.dependencies

  const updateRatio = (newM: number, newN: number) => {
    // Clamp values between 1 and 20
    const clampedM = Math.max(1, Math.min(20, newM))
    const clampedN = Math.max(1, Math.min(20, newN))

    // Get the two parent points
    const point1 = geometryObjects.find(obj => obj.id === point1Id)
    const point2 = geometryObjects.find(obj => obj.id === point2Id)

    if (!point1 || !point2 || !point1.points || !point2.points) return

    const p1 = point1.points[0]
    const p2 = point2.points[0]

    // Calculate division point using formula: (n*P1 + m*P2) / (m+n)
    const divX = (clampedN * p1.x + clampedM * p2.x) / (clampedM + clampedN)
    const divY = (clampedN * p1.y + clampedM * p2.y) / (clampedM + clampedN)

    // Update the midpoint with new ratio and position
    updateGeometryObject(selectedMidpoint.id, {
      ratio: { m: clampedM, n: clampedN },
      points: [{ x: divX, y: divY }]
    })
  }

  const handleMChange = (value: number) => {
    updateRatio(value, n)
  }

  const handleNChange = (value: number) => {
    updateRatio(m, value)
  }

  return (
    <div className="division-point-dialog">
      <div className="division-point-header">
        <span className="division-point-title">내분점 비율</span>
      </div>

      <div className="division-point-body">
        <div className="ratio-row">
          <label className="ratio-label">m:</label>
          <div className="ratio-spinbox">
            <button
              className="ratio-spinbox-button"
              onClick={() => handleMChange(m - 1)}
              disabled={m <= 1}
            >
              −
            </button>
            <input
              ref={mInputRef}
              type="number"
              className="ratio-spinbox-input"
              value={m}
              onChange={(e) => {
                const value = parseInt(e.target.value)
                if (!isNaN(value)) {
                  handleMChange(value)
                }
              }}
              min={1}
              max={20}
            />
            <button
              className="ratio-spinbox-button"
              onClick={() => handleMChange(m + 1)}
              disabled={m >= 20}
            >
              +
            </button>
          </div>
        </div>

        <div className="ratio-row">
          <label className="ratio-label">n:</label>
          <div className="ratio-spinbox">
            <button
              className="ratio-spinbox-button"
              onClick={() => handleNChange(n - 1)}
              disabled={n <= 1}
            >
              −
            </button>
            <input
              type="number"
              className="ratio-spinbox-input"
              value={n}
              onChange={(e) => {
                const value = parseInt(e.target.value)
                if (!isNaN(value)) {
                  handleNChange(value)
                }
              }}
              min={1}
              max={20}
            />
            <button
              className="ratio-spinbox-button"
              onClick={() => handleNChange(n + 1)}
              disabled={n >= 20}
            >
              +
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
