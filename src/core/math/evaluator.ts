import { create, all, MathNode } from 'mathjs'

const math = create(all, { predictable: true })

// Allowed symbols in expressions
const ALLOWED_SYMBOLS = ['x', 'y', 't', 'theta', 'pi', 'e', 'i']

// Allowed function names
const ALLOWED_FUNCTIONS = [
  'sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'atan2',
  'sinh', 'cosh', 'tanh', 'asinh', 'acosh', 'atanh',
  'sqrt', 'cbrt', 'abs', 'exp', 'log', 'log10', 'log2',
  'floor', 'ceil', 'round', 'sign', 'min', 'max',
  'pow', 'mod', 'gcd', 'lcm',
]

/**
 * Compile and validate a math expression
 */
export function compileExpression(expr: string) {
  try {
    const node = math.parse(expr)

    // Validate the expression tree
    node.traverse((node: MathNode) => {
      if (node.isSymbolNode) {
        const name = (node as any).name
        if (!ALLOWED_SYMBOLS.includes(name) && !ALLOWED_FUNCTIONS.includes(name)) {
          throw new Error(`Unauthorized symbol: ${name}`)
        }
      }
      if (node.isFunctionNode) {
        const name = (node as any).fn?.name || (node as any).name
        if (!ALLOWED_FUNCTIONS.includes(name)) {
          throw new Error(`Unauthorized function: ${name}`)
        }
      }
    })

    return node.compile()
  } catch (error) {
    throw new Error(`Expression compilation failed: ${(error as Error).message}`)
  }
}

/**
 * Evaluate a compiled expression with given scope
 */
export function evaluateExpression(
  compiled: any,
  scope: Record<string, number>
): number {
  try {
    const result = compiled.evaluate(scope)
    if (typeof result === 'number') {
      return result
    }
    if (typeof result === 'object' && 're' in result) {
      // Complex number - return real part
      return result.re
    }
    return NaN
  } catch {
    return NaN
  }
}

/**
 * Sample a function f(x) over a domain
 */
export function sampleFunction(
  compiled: any,
  domain: [number, number],
  numPoints: number = 1000
): Array<{ x: number; y: number }> {
  const [xMin, xMax] = domain
  const dx = (xMax - xMin) / (numPoints - 1)
  const points: Array<{ x: number; y: number }> = []

  for (let i = 0; i < numPoints; i++) {
    const x = xMin + i * dx
    const y = evaluateExpression(compiled, { x })
    if (isFinite(y)) {
      points.push({ x, y })
    } else {
      // Handle discontinuities by breaking the curve
      if (points.length > 0) {
        points.push({ x, y: NaN })
      }
    }
  }

  return points
}

/**
 * Sample an implicit function f(x, y) = 0 using Marching Squares algorithm
 */
export function sampleImplicitFunction(
  compiled: any,
  bounds: { xMin: number; xMax: number; yMin: number; yMax: number },
  gridSize: number = 100
): Array<Array<{ x: number; y: number }>> {
  const { xMin, xMax, yMin, yMax } = bounds
  const dx = (xMax - xMin) / gridSize
  const dy = (yMax - yMin) / gridSize

  // Create grid of function values
  const grid: number[][] = []
  for (let i = 0; i <= gridSize; i++) {
    grid[i] = []
    const y = yMin + i * dy
    for (let j = 0; j <= gridSize; j++) {
      const x = xMin + j * dx
      grid[i][j] = evaluateExpression(compiled, { x, y })
    }
  }

  // Extract contour lines using Marching Squares
  const contours: Array<Array<{ x: number; y: number }>> = []

  for (let i = 0; i < gridSize; i++) {
    for (let j = 0; j < gridSize; j++) {
      const x0 = xMin + j * dx
      const y0 = yMin + i * dy
      const x1 = x0 + dx
      const y1 = y0 + dy

      // Get values at corners
      const v00 = grid[i][j]
      const v10 = grid[i][j + 1]
      const v01 = grid[i + 1][j]
      const v11 = grid[i + 1][j + 1]

      // Skip if any value is NaN
      if (!isFinite(v00) || !isFinite(v10) || !isFinite(v01) || !isFinite(v11)) {
        continue
      }

      // Determine case based on sign of corners
      const case_ =
        (v00 > 0 ? 8 : 0) |
        (v10 > 0 ? 4 : 0) |
        (v11 > 0 ? 2 : 0) |
        (v01 > 0 ? 1 : 0)

      // Linear interpolation to find zero crossing
      const lerp = (val0: number, val1: number, p0: number, p1: number): number => {
        if (Math.abs(val0 - val1) < 1e-10) return (p0 + p1) / 2
        const t = -val0 / (val1 - val0)
        return p0 + t * (p1 - p0)
      }

      // Calculate edge midpoints where function crosses zero
      const edges: Array<{ x: number; y: number }> = []

      // Top edge
      if ((v00 > 0) !== (v10 > 0)) {
        edges[0] = { x: lerp(v00, v10, x0, x1), y: y0 }
      }
      // Right edge
      if ((v10 > 0) !== (v11 > 0)) {
        edges[1] = { x: x1, y: lerp(v10, v11, y0, y1) }
      }
      // Bottom edge
      if ((v01 > 0) !== (v11 > 0)) {
        edges[2] = { x: lerp(v01, v11, x0, x1), y: y1 }
      }
      // Left edge
      if ((v00 > 0) !== (v01 > 0)) {
        edges[3] = { x: x0, y: lerp(v00, v01, y0, y1) }
      }

      // Connect edges based on case
      const segments: Array<[number, number]> = []
      switch (case_) {
        case 1: case 14: segments.push([3, 2]); break
        case 2: case 13: segments.push([1, 2]); break
        case 3: case 12: segments.push([3, 1]); break
        case 4: case 11: segments.push([0, 1]); break
        case 5: segments.push([3, 0], [1, 2]); break // Ambiguous case
        case 6: case 9: segments.push([0, 2]); break
        case 7: case 8: segments.push([3, 0]); break
        case 10: segments.push([3, 1], [0, 2]); break // Ambiguous case
      }

      // Add segments to contours
      for (const [e1, e2] of segments) {
        if (edges[e1] && edges[e2]) {
          contours.push([edges[e1], edges[e2]])
        }
      }
    }
  }

  return contours
}

/**
 * Sample a parametric curve (x(t), y(t)) over a domain
 * Input: two compiled expressions for x(t) and y(t)
 */
export function sampleParametric(
  compiledX: any,
  compiledY: any,
  domain: [number, number] = [0, 2 * Math.PI],
  numPoints: number = 1000
): Array<{ x: number; y: number }> {
  const [tMin, tMax] = domain
  const dt = (tMax - tMin) / (numPoints - 1)
  const points: Array<{ x: number; y: number }> = []

  for (let i = 0; i < numPoints; i++) {
    const t = tMin + i * dt
    const x = evaluateExpression(compiledX, { t })
    const y = evaluateExpression(compiledY, { t })
    if (isFinite(x) && isFinite(y)) {
      points.push({ x, y })
    } else if (points.length > 0) {
      points.push({ x: NaN, y: NaN })
    }
  }

  return points
}

/**
 * Sample a polar curve r(θ) over a domain
 * Converts polar to Cartesian: x = r*cos(θ), y = r*sin(θ)
 */
export function samplePolar(
  compiled: any,
  domain: [number, number] = [0, 2 * Math.PI],
  numPoints: number = 1000
): Array<{ x: number; y: number }> {
  const [thetaMin, thetaMax] = domain
  const dTheta = (thetaMax - thetaMin) / (numPoints - 1)
  const points: Array<{ x: number; y: number }> = []

  for (let i = 0; i < numPoints; i++) {
    const theta = thetaMin + i * dTheta
    const r = evaluateExpression(compiled, { theta })
    if (isFinite(r)) {
      const x = r * Math.cos(theta)
      const y = r * Math.sin(theta)
      points.push({ x, y })
    } else if (points.length > 0) {
      points.push({ x: NaN, y: NaN })
    }
  }

  return points
}
