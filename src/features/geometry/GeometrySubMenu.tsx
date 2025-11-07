import { useStore } from '../../store'
import type { GeometryToolType } from '../../store'
import './GeometrySubMenu.css'

interface SubMenuOption {
  type: GeometryToolType
  icon: string
  label: string
}

const subMenuOptions: Record<'point' | 'line' | 'circle', SubMenuOption[]> = {
  point: [
    { type: 'point-fixed', icon: '●', label: '고정점' },
    { type: 'point-slider', icon: '⟷', label: '끌개' },
    { type: 'point-midpoint', icon: '◐', label: '중점' },
  ],
  line: [
    { type: 'line-infinite', icon: '↔', label: '직선' },
    { type: 'line-segment', icon: '─', label: '선분' },
    { type: 'line-ray', icon: '→', label: '반직선' },
  ],
  circle: [
    { type: 'circle-center-radius', icon: '⊙', label: '중심-반지름' },
    { type: 'circle-three-points', icon: '◎', label: '세 점' },
    { type: 'circle-diameter', icon: '⊚', label: '지름' },
  ],
}

export function GeometrySubMenu() {
  const geometrySubMenu = useStore((state) => state.geometrySubMenu)
  const setGeometrySubMenu = useStore((state) => state.setGeometrySubMenu)
  const startCreation = useStore((state) => state.startCreation)

  if (!geometrySubMenu.visible || !geometrySubMenu.toolType) {
    return null
  }

  const options = subMenuOptions[geometrySubMenu.toolType]

  const handleSelect = (subType: GeometryToolType) => {
    // Start creation with selected subtype
    startCreation(subType)
    // Close submenu
    setGeometrySubMenu({ visible: false, toolType: null })
  }

  const handleClose = () => {
    setGeometrySubMenu({ visible: false, toolType: null })
  }

  return (
    <>
      {/* Backdrop to close menu */}
      <div className="submenu-backdrop" onClick={handleClose} />

      {/* Submenu panel */}
      <div className="geometry-submenu">
        <div className="submenu-header">
          <h4>
            {geometrySubMenu.toolType === 'point' && '점'}
            {geometrySubMenu.toolType === 'line' && '선'}
            {geometrySubMenu.toolType === 'circle' && '원'}
          </h4>
          <button className="submenu-close" onClick={handleClose}>×</button>
        </div>

        <div className="submenu-options">
          {options.map((option) => (
            <button
              key={option.type}
              className="submenu-option"
              onClick={() => handleSelect(option.type)}
            >
              <span className="option-icon">{option.icon}</span>
              <span className="option-label">{option.label}</span>
            </button>
          ))}
        </div>
      </div>
    </>
  )
}
