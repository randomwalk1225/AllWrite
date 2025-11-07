import type { Point2D, ViewState } from '../../types'

/**
 * Convert screen coordinates to graph coordinates
 */
export function screenToGraph(
  screenX: number,
  screenY: number,
  canvasWidth: number,
  canvasHeight: number,
  view: ViewState
): Point2D {
  const centerX = canvasWidth / 2
  const centerY = canvasHeight / 2

  const x = (screenX - centerX) / (view.scale * view.scaleX) + view.center.x
  const y = -(screenY - centerY) / (view.scale * view.scaleY) + view.center.y // Flip Y axis

  return { x, y }
}

/**
 * Convert graph coordinates to screen coordinates
 */
export function graphToScreen(
  graphX: number,
  graphY: number,
  canvasWidth: number,
  canvasHeight: number,
  view: ViewState
): Point2D {
  const centerX = canvasWidth / 2
  const centerY = canvasHeight / 2

  const x = (graphX - view.center.x) * (view.scale * view.scaleX) + centerX
  const y = -(graphY - view.center.y) * (view.scale * view.scaleY) + centerY // Flip Y axis

  return { x, y }
}

/**
 * Get visible graph bounds for current view
 */
export function getVisibleBounds(
  canvasWidth: number,
  canvasHeight: number,
  view: ViewState
): { xMin: number; xMax: number; yMin: number; yMax: number } {
  const topLeft = screenToGraph(0, 0, canvasWidth, canvasHeight, view)
  const bottomRight = screenToGraph(canvasWidth, canvasHeight, canvasWidth, canvasHeight, view)

  return {
    xMin: topLeft.x,
    xMax: bottomRight.x,
    yMin: bottomRight.y,
    yMax: topLeft.y,
  }
}

/**
 * Generate nice tick values for axis labels
 */
export function generateTicks(min: number, max: number, targetCount: number = 10): number[] {
  const range = max - min
  if (range === 0) return [min]

  // Calculate nice step size using 1-2-5 sequence
  const rawStep = range / targetCount
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)))
  const normalizedStep = rawStep / magnitude

  let niceStep: number
  if (normalizedStep <= 1) {
    niceStep = 1 * magnitude
  } else if (normalizedStep <= 2) {
    niceStep = 2 * magnitude
  } else if (normalizedStep <= 5) {
    niceStep = 5 * magnitude
  } else {
    niceStep = 10 * magnitude
  }

  // Generate ticks
  const ticks: number[] = []
  const start = Math.ceil(min / niceStep) * niceStep
  for (let value = start; value <= max; value += niceStep) {
    // Fix floating point precision issues
    ticks.push(Math.round(value / niceStep) * niceStep)
  }

  return ticks
}
