// Expression types
export type ExprKind = 'cartesian' | 'parametric' | 'polar' | 'inequality' | 'implicit' | 'point' | 'text'

export interface Expression {
  id: string
  kind: ExprKind
  input: string
  latex: string
  color: string
  params?: Record<string, number>
  visible: boolean
  selected?: boolean
  domain?: {
    x?: [number, number]
    t?: [number, number]
    theta?: [number, number]
  }
  point?: {
    x: number
    y: number
    label?: string
  }
  transform?: {
    translateX: number  // Translation in graph coordinates
    translateY: number
    scale: number       // Uniform scale factor
    rotation: number    // Rotation in radians
  }
}

// View state
export interface ViewState {
  center: { x: number; y: number }
  scale: number
  scaleX: number  // X-axis scale multiplier
  scaleY: number  // Y-axis scale multiplier
  grid: boolean
  axis: boolean
}

// Image layer
export interface ImageLayer {
  id: string
  src: string
  transform: DOMMatrix  // Legacy screen-based transform (will be deprecated)
  opacity: number
  locked: boolean
  rotation?: number  // Rotation angle in radians
  aspectRatio: number  // width / height ratio
  selected?: boolean  // Selection state for multi-select
  // Graph-based positioning (new approach)
  graphPosition?: {
    x: number  // Center x in graph coordinates
    y: number  // Center y in graph coordinates
    width: number  // Width in graph units
    height: number  // Height in graph units
    rotation: number  // Rotation in radians
  }
}

// Point in 2D space
export interface Point2D {
  x: number
  y: number
}
