import type { ViewState } from '../../types'
import { graphToScreen, getVisibleBounds, generateTicks } from '../geo/coordinates'

export class GraphRenderer {
  private ctx: CanvasRenderingContext2D
  private width: number
  private height: number
  private dpr: number

  constructor(canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d')!
    this.dpr = window.devicePixelRatio || 1
    this.width = 0
    this.height = 0
    this.resize()
  }

  resize() {
    const canvas = this.ctx.canvas
    const rect = canvas.getBoundingClientRect()

    this.width = rect.width
    this.height = rect.height

    canvas.width = this.width * this.dpr
    canvas.height = this.height * this.dpr

    // Reset transform before scaling to prevent cumulative scaling
    this.ctx.setTransform(1, 0, 0, 1, 0, 0)
    this.ctx.scale(this.dpr, this.dpr)
  }

  getContext() {
    return this.ctx
  }

  clear() {
    this.ctx.clearRect(0, 0, this.width, this.height)
  }

  drawGrid(view: ViewState) {
    if (!view.grid) return

    // Fixed 20px grid spacing in screen coordinates
    const gridSpacing = 20

    this.ctx.strokeStyle = '#e0e0e0'
    this.ctx.lineWidth = 1

    // Vertical grid lines (every 20px)
    this.ctx.beginPath()
    for (let x = 0; x <= this.width; x += gridSpacing) {
      this.ctx.moveTo(x, 0)
      this.ctx.lineTo(x, this.height)
    }
    this.ctx.stroke()

    // Horizontal grid lines (every 20px)
    this.ctx.beginPath()
    for (let y = 0; y <= this.height; y += gridSpacing) {
      this.ctx.moveTo(0, y)
      this.ctx.lineTo(this.width, y)
    }
    this.ctx.stroke()
  }

  drawAxes(view: ViewState, highlightAxis?: 'x' | 'y' | null) {
    if (!view.axis) return

    const origin = graphToScreen(0, 0, this.width, this.height, view)
    const bounds = getVisibleBounds(this.width, this.height, view)

    // X-axis
    if (bounds.yMin <= 0 && bounds.yMax >= 0) {
      this.ctx.strokeStyle = highlightAxis === 'x' ? '#87ceeb' : '#333'
      this.ctx.lineWidth = highlightAxis === 'x' ? 3 : 2
      this.ctx.beginPath()
      this.ctx.moveTo(0, origin.y)
      this.ctx.lineTo(this.width, origin.y)
      this.ctx.stroke()
    }

    // Y-axis
    if (bounds.xMin <= 0 && bounds.xMax >= 0) {
      this.ctx.strokeStyle = highlightAxis === 'y' ? '#87ceeb' : '#333'
      this.ctx.lineWidth = highlightAxis === 'y' ? 3 : 2
      this.ctx.beginPath()
      this.ctx.moveTo(origin.x, 0)
      this.ctx.lineTo(origin.x, this.height)
      this.ctx.stroke()
    }

    // Draw tick labels
    this.drawTickLabels(view, bounds)
  }

  private drawTickLabels(view: ViewState, bounds: ReturnType<typeof getVisibleBounds>) {
    const xTicks = generateTicks(bounds.xMin, bounds.xMax, 15)
    const yTicks = generateTicks(bounds.yMin, bounds.yMax, 15)

    this.ctx.fillStyle = '#666'
    this.ctx.font = '12px sans-serif'
    this.ctx.textAlign = 'center'
    this.ctx.textBaseline = 'top'

    const origin = graphToScreen(0, 0, this.width, this.height, view)

    // X-axis labels
    for (const x of xTicks) {
      if (Math.abs(x) < 1e-10) continue // Skip origin
      const screen = graphToScreen(x, 0, this.width, this.height, view)
      const label = formatNumber(x)
      this.ctx.fillText(label, screen.x, origin.y + 5)
    }

    // Y-axis labels
    this.ctx.textAlign = 'right'
    this.ctx.textBaseline = 'middle'
    for (const y of yTicks) {
      if (Math.abs(y) < 1e-10) continue // Skip origin
      const screen = graphToScreen(0, y, this.width, this.height, view)
      const label = formatNumber(y)
      this.ctx.fillText(label, origin.x - 5, screen.y)
    }
  }

  drawFunction(
    points: Array<{ x: number; y: number }>,
    color: string,
    view: ViewState,
    lineWidth: number = 2
  ) {
    if (points.length === 0) return

    this.ctx.strokeStyle = color
    this.ctx.lineWidth = lineWidth
    this.ctx.lineCap = 'round'
    this.ctx.lineJoin = 'round'

    this.ctx.beginPath()
    let isDrawing = false
    let prevPoint: { x: number; y: number } | null = null

    for (const point of points) {
      if (!isFinite(point.y)) {
        isDrawing = false
        prevPoint = null
        continue
      }

      const screen = graphToScreen(point.x, point.y, this.width, this.height, view)

      // Check for discontinuities: if the y-value changes too drastically between consecutive points,
      // break the line to avoid drawing vertical asymptotes
      if (prevPoint !== null) {
        const dy = Math.abs(point.y - prevPoint.y)
        const dx = Math.abs(point.x - prevPoint.x)

        // If the slope is too steep (indicating a discontinuity/asymptote), break the line
        // Also check if points are too far apart in screen space
        const prevScreen = graphToScreen(prevPoint.x, prevPoint.y, this.width, this.height, view)
        const screenDist = Math.abs(screen.y - prevScreen.y)

        if (dx > 0 && (dy / dx > 100 || screenDist > this.height / 2)) {
          isDrawing = false
          prevPoint = null
        }
      }

      if (!isDrawing) {
        this.ctx.moveTo(screen.x, screen.y)
        isDrawing = true
      } else {
        this.ctx.lineTo(screen.x, screen.y)
      }

      prevPoint = point
    }

    this.ctx.stroke()
  }

  drawImplicitFunction(
    contours: Array<Array<{ x: number; y: number }>>,
    color: string,
    view: ViewState,
    lineWidth: number = 2
  ) {
    if (contours.length === 0) return

    this.ctx.strokeStyle = color
    this.ctx.lineWidth = lineWidth
    this.ctx.lineCap = 'round'
    this.ctx.lineJoin = 'round'

    for (const segment of contours) {
      if (segment.length < 2) continue

      this.ctx.beginPath()
      const start = graphToScreen(segment[0].x, segment[0].y, this.width, this.height, view)
      this.ctx.moveTo(start.x, start.y)

      for (let i = 1; i < segment.length; i++) {
        const point = graphToScreen(segment[i].x, segment[i].y, this.width, this.height, view)
        this.ctx.lineTo(point.x, point.y)
      }

      this.ctx.stroke()
    }
  }

  drawPoint(
    point: { x: number; y: number; label?: string },
    color: string,
    view: ViewState,
    selected: boolean = false
  ) {
    const screen = graphToScreen(point.x, point.y, this.width, this.height, view)

    // Draw the point
    this.ctx.fillStyle = color
    this.ctx.beginPath()
    this.ctx.arc(screen.x, screen.y, selected ? 6 : 4, 0, 2 * Math.PI)
    this.ctx.fill()

    // Draw border
    this.ctx.strokeStyle = selected ? '#fff' : color
    this.ctx.lineWidth = selected ? 2 : 1
    this.ctx.stroke()

    // Note: Label rendering is now handled by LaTeX overlay in GraphCanvas
  }

  drawGraphPoint(
    point: { x: number; y: number; label: string },
    color: string,
    view: ViewState
  ) {
    const screen = graphToScreen(point.x, point.y, this.width, this.height, view)

    // Draw the point (larger)
    this.ctx.fillStyle = color
    this.ctx.beginPath()
    this.ctx.arc(screen.x, screen.y, 5, 0, 2 * Math.PI)
    this.ctx.fill()

    // Draw white border
    this.ctx.strokeStyle = '#fff'
    this.ctx.lineWidth = 2
    this.ctx.stroke()

    // Note: Label rendering is now handled by LaTeX overlay in GraphCanvas
  }
}

function formatNumber(value: number): string {
  if (Math.abs(value) < 1e-10) return '0'
  if (Math.abs(value) >= 1000 || (Math.abs(value) < 0.01 && value !== 0)) {
    return value.toExponential(1)
  }
  return value.toFixed(2).replace(/\.?0+$/, '')
}
