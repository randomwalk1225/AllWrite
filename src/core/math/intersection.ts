import { compileExpression, evaluateExpression } from './evaluator'

/**
 * Check if expression is linear (form: a*x + b)
 */
function isLinear(expr: string): { a: number; b: number } | null {
  try {
    // Test if f(x) = a*x + b by checking if f''(x) = 0
    const compiled = compileExpression(expr)

    // Sample at multiple points to check linearity
    const testPoints = [0, 1, 2, -1, -2]
    const values = testPoints.map(x => evaluateExpression(compiled, { x }))

    if (!values.every(isFinite)) return null

    // Calculate slope between consecutive points
    const slopes = []
    for (let i = 1; i < testPoints.length; i++) {
      const slope = (values[i] - values[i-1]) / (testPoints[i] - testPoints[i-1])
      slopes.push(slope)
    }

    // Check if all slopes are equal (within tolerance)
    const firstSlope = slopes[0]
    const isConstantSlope = slopes.every(s => Math.abs(s - firstSlope) < 1e-10)

    if (isConstantSlope) {
      const a = firstSlope
      const b = values[0] - a * testPoints[0]
      return { a, b }
    }

    return null
  } catch {
    return null
  }
}

/**
 * Find analytical intersection of two lines
 */
function findLinearIntersection(
  line1: { a: number; b: number },
  line2: { a: number; b: number }
): { x: number; y: number } | null {
  // line1: y = a1*x + b1
  // line2: y = a2*x + b2
  // Intersection: a1*x + b1 = a2*x + b2
  // x = (b2 - b1) / (a1 - a2)

  const denominator = line1.a - line2.a

  // Parallel lines
  if (Math.abs(denominator) < 1e-15) return null

  const x = (line2.b - line1.b) / denominator
  const y = line1.a * x + line1.b

  return { x, y }
}

/**
 * Check if an expression represents a horizontal line (y = constant)
 * Returns the y value if it's a horizontal line, null otherwise
 */
function checkHorizontalLine(expr: string): number | null {
  console.log('checkHorizontalLine:', expr)

  try {
    const compiled = compileExpression(expr)

    // Test if the expression is independent of x
    // For a horizontal line y=c, the expression should be constant for all x values
    const testXValues = [0, 1, -1, 5, -5, 10, -10]
    const results: number[] = []

    for (const x of testXValues) {
      try {
        const val = evaluateExpression(compiled, { x })
        if (!isFinite(val)) {
          console.log('  Not a horizontal line - result not finite at x =', x)
          return null
        }
        results.push(val)
      } catch (e) {
        console.log('  Not a horizontal line - evaluation failed at x =', x)
        return null
      }
    }

    // Check if all results are the same (independent of x)
    const first = results[0]
    const isConstant = results.every(val => Math.abs(val - first) < 1e-10)

    if (isConstant) {
      console.log('  ✓ Horizontal line detected: y =', first)
      return first
    } else {
      console.log('  Not a horizontal line - result depends on x')
      return null
    }
  } catch (e) {
    console.log('  Error in checkHorizontalLine:', e)
    return null
  }
}

/**
 * Check if an expression represents a vertical line (x = constant)
 * Returns the x value if it's a vertical line, null otherwise
 */
function checkVerticalLine(expr: string): number | null {
  console.log('checkVerticalLine:', expr)

  // IMPORTANT: Cartesian functions like "x", "x^2", "sin(x)" are NOT vertical lines!
  // Only expressions of the form "(x) - (constant)" or "(constant) - (x)" are vertical lines
  // If the expression doesn't contain parentheses, it's likely a cartesian function
  if (!expr.includes('(') || !expr.includes(')')) {
    console.log('  Not a vertical line - no parentheses (likely cartesian function)')
    return null
  }

  // Try multiple pattern variations to extract the constant value
  const patterns = [
    /^\(x\)\s*-\s*\((.+)\)$/,           // (x) - (constant)
    /^\(x\)\s*-\s*(.+)$/,               // (x) - constant
    /^x\s*-\s*\((.+)\)$/,               // x - (constant)
    /^x\s*-\s*(.+)$/,                   // x - constant
    /^\((.+)\)\s*-\s*\(x\)$/,           // (constant) - (x) [reverse]
    /^\((.+)\)\s*-\s*x$/,               // (constant) - x [reverse]
    /^(.+)\s*-\s*\(x\)$/,               // constant - (x) [reverse]
    /^(.+)\s*-\s*x$/,                   // constant - x [reverse]
  ]

  for (let i = 0; i < patterns.length; i++) {
    const match = expr.match(patterns[i])
    if (match) {
      try {
        const constantExpr = match[1]
        console.log(`  Pattern ${i+1} matched, constant expression:`, constantExpr)

        // Evaluate the constant (should not depend on x or y)
        const compiled = compileExpression(constantExpr)
        const value = evaluateExpression(compiled, { x: 0, y: 0 })

        if (isFinite(value)) {
          // For reverse patterns (indices 4-7), the value should stay positive since it's on the left
          const finalValue = (i >= 4) ? value : value
          console.log('  ✓✓✓ Pattern-matched x value found:', finalValue)
          return finalValue
        }
      } catch (e) {
        console.log(`  Pattern ${i+1} match failed to evaluate:`, e)
        continue
      }
    }
  }

  try {
    const compiled = compileExpression(expr)

    // Test multiple x values with different y values to check if output depends on y
    const testXValues = [0, 1, -1, 5, -5]
    const testYValues = [0, 1, -1, 10, -10]

    // For each x value, test if the result is the same for all y values
    for (const xTest of testXValues) {
      const results: number[] = []
      let allSame = true

      for (const yTest of testYValues) {
        try {
          const val = evaluateExpression(compiled, { x: xTest, y: yTest })
          if (!isFinite(val)) {
            allSame = false
            break
          }
          results.push(val)
        } catch {
          allSame = false
          break
        }
      }

      if (allSame && results.length > 0) {
        // Check if all results are the same (independent of y)
        const first = results[0]
        const isConstant = results.every(val => Math.abs(val - first) < 1e-10)

        if (!isConstant) {
          // Result depends on y, so not a vertical line
          console.log('  Not a vertical line - result depends on y')
          return null
        }
      }
    }

    // If we get here, the expression might be a vertical line
    // Now find the x value where the expression equals zero
    console.log('  Detected as vertical line candidate, finding x value...')

    // Try multiple initial guesses to find the root
    const initialGuesses = [0, 1, -1, 2, -2, 5, -5, 10, -10]

    for (const guess of initialGuesses) {
      let x = guess

      // Newton's method with this initial guess
      for (let i = 0; i < 50; i++) {
        const val = evaluateExpression(compiled, { x, y: 0 })

        if (Math.abs(val) < 1e-12) {
          // Converged - but continue to ensure we reached the actual root
          break
        }

        // Numerical derivative
        const h = 1e-8
        const valPlus = evaluateExpression(compiled, { x: x + h, y: 0 })
        const derivative = (valPlus - val) / h

        if (Math.abs(derivative) < 1e-15) {
          break
        }

        const newX = x - val / derivative

        // Check for convergence
        if (Math.abs(newX - x) < 1e-12) {
          x = newX
          break
        }

        x = newX

        // Bounds check
        if (Math.abs(x) > 1000) {
          break
        }
      }

      // Check if we found a valid root
      const finalVal = evaluateExpression(compiled, { x, y: 0 })
      if (Math.abs(finalVal) < 1e-10) {
        console.log('  ✓ Numerical method found x value:', x, 'with f(x) =', finalVal)
        const rounded = Math.round(x * 1e10) / 1e10
        return rounded
      } else {
        console.log('  ✗ Guess', guess, 'failed: x =', x, 'f(x) =', finalVal)
      }
    }

  } catch (e) {
    console.log('  Error in checkVerticalLine:', e)
  }
  return null
}

/**
 * Find intersection between a vertical line (x = xValue) and a function
 * For implicit functions, this may return multiple y values
 */
function findVerticalLineIntersection(
  xValue: number,
  funcExpr: string,
  nearPoint: { x: number; y: number },
  searchRadius: number
): Array<{ x: number; y: number }> {
  try {
    // Check if x value is within search radius
    if (Math.abs(xValue - nearPoint.x) > searchRadius) {
      return []
    }

    console.log(`[findVerticalLineIntersection] Finding intersection for x=${xValue} with expression: ${funcExpr}`)

    // Special case: if funcExpr is just "x", the intersection is at (xValue, xValue)
    if (funcExpr === 'x' || funcExpr === '(x)') {
      console.log(`  Special case: y=x line, returning (${xValue}, ${xValue})`)
      return [{ x: snapToInteger(xValue), y: snapToInteger(xValue) }]
    }

    // Check if funcExpr is a horizontal line (constant function)
    const horizontalY = checkHorizontalLine(funcExpr)
    if (horizontalY !== null) {
      console.log(`  Special case: horizontal line y=${horizontalY}, returning (${xValue}, ${horizontalY})`)
      return [{ x: snapToInteger(xValue), y: snapToInteger(horizontalY) }]
    }

    // Special case: if funcExpr is a linear function like (y) - (x) or (x) - (y)
    // Pattern: (y) - (expression not containing y)
    const yEqualsExprMatch = funcExpr.match(/^\(y\)\s*-\s*\((.+)\)$/)
    if (yEqualsExprMatch) {
      try {
        const rhsExpr = yEqualsExprMatch[1]
        console.log(`  Special case: y = expression, RHS: ${rhsExpr}`)
        const rhsCompiled = compileExpression(rhsExpr)
        const yValue = evaluateExpression(rhsCompiled, { x: xValue, y: 0 })
        if (isFinite(yValue)) {
          console.log(`  Evaluated: y = ${yValue}`)
          return [{ x: snapToInteger(xValue), y: snapToInteger(yValue) }]
        }
      } catch (e) {
        console.log('  Failed to evaluate as y = expression')
      }
    }

    // Pattern: (expression not containing y) - (y)
    const exprEqualsYMatch = funcExpr.match(/^\((.+)\)\s*-\s*\(y\)$/)
    if (exprEqualsYMatch) {
      try {
        const lhsExpr = exprEqualsYMatch[1]
        console.log(`  Special case: expression = y, LHS: ${lhsExpr}`)
        const lhsCompiled = compileExpression(lhsExpr)
        const yValue = evaluateExpression(lhsCompiled, { x: xValue, y: 0 })
        if (isFinite(yValue)) {
          console.log(`  Evaluated: y = ${yValue}`)
          return [{ x: snapToInteger(xValue), y: snapToInteger(yValue) }]
        }
      } catch (e) {
        console.log('  Failed to evaluate as expression = y')
      }
    }

    console.log('  Using numerical method')
    const compiled = compileExpression(funcExpr)

    // For implicit functions (like x^2 + y^2 - 16 = 0), we need to search for all y values
    // where the expression equals zero at this x
    const results: Array<{ x: number; y: number }> = []

    // Search for y values in a range around the near point
    const yMin = nearPoint.y - searchRadius
    const yMax = nearPoint.y + searchRadius
    const steps = 200
    const dy = (yMax - yMin) / steps

    let prevVal = evaluateExpression(compiled, { x: xValue, y: yMin })
    let prevSign = isFinite(prevVal) ? Math.sign(prevVal) : null

    for (let i = 1; i <= steps; i++) {
      const y = yMin + i * dy
      const val = evaluateExpression(compiled, { x: xValue, y })

      if (!isFinite(val)) {
        prevSign = null
        prevVal = val
        continue
      }

      const sign = Math.sign(val)

      // Check for sign change (zero crossing)
      if (prevSign !== null && sign !== 0 && sign !== prevSign && isFinite(prevVal)) {
        // Use bisection to find precise y value
        let a = yMin + (i - 1) * dy
        let b = y

        for (let j = 0; j < 30; j++) {
          const mid = (a + b) / 2
          const midVal = evaluateExpression(compiled, { x: xValue, y: mid })

          if (Math.abs(midVal) < 1e-10) {
            break
          }

          const midSign = Math.sign(midVal)
          if (midSign === prevSign) {
            a = mid
          } else {
            b = mid
          }
        }

        const yIntersection = (a + b) / 2

        // Verify this is actually close to the click point
        const dist = Math.sqrt(
          Math.pow(xValue - nearPoint.x, 2) + Math.pow(yIntersection - nearPoint.y, 2)
        )

        if (dist <= searchRadius) {
          results.push({ x: snapToInteger(xValue), y: snapToInteger(yIntersection) })
        }
      }

      prevSign = sign
      prevVal = val
    }

    return results
  } catch {
    return []
  }
}

/**
 * Find intersection between a horizontal line (y = yValue) and a cartesian function (y = f(x))
 * Solves f(x) = yValue
 */
function findCartesianHorizontalIntersection(
  cartesianExpr: string,
  yValue: number,
  nearPoint: { x: number; y: number },
  searchRadius: number
): Array<{ x: number; y: number }> {
  try {
    console.log(`[findCartesianHorizontalIntersection] Finding where ${cartesianExpr} = ${yValue}`)
    const compiled = compileExpression(cartesianExpr)
    const results: Array<{ x: number; y: number }> = []

    // Search for x values where f(x) = yValue
    const xMin = nearPoint.x - searchRadius
    const xMax = nearPoint.x + searchRadius
    const steps = 200
    const dx = (xMax - xMin) / steps

    let prevVal = evaluateExpression(compiled, { x: xMin })
    let prevSign = isFinite(prevVal) ? Math.sign(prevVal - yValue) : null

    for (let i = 1; i <= steps; i++) {
      const x = xMin + i * dx
      const val = evaluateExpression(compiled, { x })

      if (!isFinite(val)) {
        prevSign = null
        prevVal = val
        continue
      }

      const diff = val - yValue
      const sign = Math.sign(diff)

      // Check for sign change (zero crossing of f(x) - yValue)
      if (prevSign !== null && sign !== 0 && sign !== prevSign && isFinite(prevVal)) {
        // Use bisection to find precise x value
        let a = xMin + (i - 1) * dx
        let b = x

        for (let j = 0; j < 30; j++) {
          const mid = (a + b) / 2
          const midVal = evaluateExpression(compiled, { x: mid })
          const midDiff = midVal - yValue

          if (Math.abs(midDiff) < 1e-10) {
            break
          }

          const midSign = Math.sign(midDiff)
          if (midSign === prevSign) {
            a = mid
          } else {
            b = mid
          }
        }

        const xIntersection = (a + b) / 2

        // Verify this is actually close to the click point
        const dist = Math.sqrt(
          Math.pow(xIntersection - nearPoint.x, 2) + Math.pow(yValue - nearPoint.y, 2)
        )

        if (dist <= searchRadius) {
          console.log(`  ✓ Found intersection at (${xIntersection}, ${yValue})`)
          results.push({ x: snapToInteger(xIntersection), y: snapToInteger(yValue) })
        }
      }

      prevSign = sign
      prevVal = val
    }

    console.log(`  Total intersections found: ${results.length}`)
    return results
  } catch (e) {
    console.log('  Error in findCartesianHorizontalIntersection:', e)
    return []
  }
}

/**
 * Find intersection between a horizontal line (y = yValue) and a function
 * For implicit functions, this may return multiple x values
 */
function findHorizontalLineIntersection(
  yValue: number,
  funcExpr: string,
  nearPoint: { x: number; y: number },
  searchRadius: number
): Array<{ x: number; y: number }> {
  try {
    // Check if y value is within search radius
    if (Math.abs(yValue - nearPoint.y) > searchRadius) {
      return []
    }

    console.log(`[findHorizontalLineIntersection] Finding intersection for y=${yValue} with expression: ${funcExpr}`)

    // Check if funcExpr is a vertical line (constant x)
    const verticalX = checkVerticalLine(funcExpr)
    if (verticalX !== null) {
      console.log(`  Special case: vertical line x=${verticalX}, returning (${verticalX}, ${yValue})`)
      return [{ x: snapToInteger(verticalX), y: snapToInteger(yValue) }]
    }

    // Check if funcExpr is also a horizontal line
    const otherHorizontalLine = checkHorizontalLine(funcExpr)
    if (otherHorizontalLine !== null) {
      if (Math.abs(otherHorizontalLine - yValue) < 1e-10) {
        console.log(`  Both are the same horizontal line, infinite intersections`)
        return [] // Infinite intersections, return empty
      } else {
        console.log(`  Both are different horizontal lines, no intersection`)
        return [] // Parallel horizontal lines, no intersection
      }
    }

    console.log('  Using numerical method to find x values where f(x,y)=0 with y=' + yValue)
    const compiled = compileExpression(funcExpr)

    // For implicit functions (like (x^2+y^2)-(16)), we need to search for all x values
    // where the expression equals zero at the given y
    const results: Array<{ x: number; y: number }> = []

    // Search for x values in a range around the near point
    const xMin = nearPoint.x - searchRadius
    const xMax = nearPoint.x + searchRadius
    const steps = 200
    const dx = (xMax - xMin) / steps

    let prevVal = evaluateExpression(compiled, { x: xMin, y: yValue })
    let prevSign = isFinite(prevVal) ? Math.sign(prevVal) : null

    for (let i = 1; i <= steps; i++) {
      const x = xMin + i * dx
      const val = evaluateExpression(compiled, { x, y: yValue })

      if (!isFinite(val)) {
        prevSign = null
        prevVal = val
        continue
      }

      const sign = Math.sign(val)

      // Check for sign change (zero crossing)
      if (prevSign !== null && sign !== 0 && sign !== prevSign && isFinite(prevVal)) {
        // Use bisection to find precise x value
        let a = xMin + (i - 1) * dx
        let b = x

        for (let j = 0; j < 30; j++) {
          const mid = (a + b) / 2
          const midVal = evaluateExpression(compiled, { x: mid, y: yValue })

          if (Math.abs(midVal) < 1e-10) {
            break
          }

          const midSign = Math.sign(midVal)
          if (midSign === prevSign) {
            a = mid
          } else {
            b = mid
          }
        }

        const xIntersection = (a + b) / 2

        // Verify this is actually close to the click point
        const dist = Math.sqrt(
          Math.pow(xIntersection - nearPoint.x, 2) + Math.pow(yValue - nearPoint.y, 2)
        )

        if (dist <= searchRadius) {
          console.log(`  ✓ Found intersection at (${xIntersection}, ${yValue})`)
          results.push({ x: snapToInteger(xIntersection), y: snapToInteger(yValue) })
        }
      }

      prevSign = sign
      prevVal = val
    }

    console.log(`  Total intersections found: ${results.length}`)
    return results
  } catch (e) {
    console.log('  Error in findHorizontalLineIntersection:', e)
    return []
  }
}

/**
 * Try to recognize if a number is a simple symbolic form
 * Returns LaTeX string if recognized, null otherwise
 */
function tryRecognizeSymbolicForm(num: number): string | null {
  // Very strict tolerance - only recognize if match is within floating point precision
  const tolerance = 1e-14  // ~15 decimal places precision

  console.log('tryRecognizeSymbolicForm:', num)

  // Check if it's close to an integer
  const rounded = Math.round(num)
  if (Math.abs(num - rounded) < tolerance) {
    console.log('  -> Recognized as integer:', rounded)
    return null // Let formatCoordLatex handle integers
  }

  // Check if it's a simple fraction (denominators up to 12 for common fractions only)
  for (let denom = 2; denom <= 12; denom++) {
    const numerator = Math.round(num * denom)
    if (Math.abs(num - numerator / denom) < tolerance) {
      console.log(`  -> Recognized as fraction: ${numerator}/${denom}`)
      if (numerator < 0) {
        return `-\\frac{${Math.abs(numerator)}}{${denom}}`
      }
      return `\\frac{${numerator}}{${denom}}`
    }
  }

  // Check if it's sqrt of an integer (for values up to sqrt(1000))
  const squared = num * num
  const squaredInt = Math.round(squared)
  console.log(`  Checking sqrt: num=${num}, squared=${squared}, squaredInt=${squaredInt}, diff=${Math.abs(squared - squaredInt)}`)

  // Strict tolerance for sqrt - only match if very close
  if (squaredInt >= 2 && squaredInt <= 1000 && Math.abs(squared - squaredInt) < 1e-10) {
    console.log(`  -> Recognized as sqrt: sqrt(${squaredInt})`)

    // Simplify the square root (e.g., sqrt(8) = 2*sqrt(2))
    let coefficient = 1
    let innerValue = squaredInt

    // Find perfect square factors
    for (let factor = 2; factor * factor <= squaredInt; factor++) {
      while (innerValue % (factor * factor) === 0) {
        coefficient *= factor
        innerValue = innerValue / (factor * factor)
      }
    }

    console.log(`  Simplified: ${coefficient}*sqrt(${innerValue})`)

    const isNegative = num < 0

    if (innerValue === 1) {
      // It's a perfect square
      return null // Let formatCoordLatex handle it as an integer
    } else if (coefficient === 1) {
      // No simplification needed
      if (isNegative) {
        return `-\\sqrt{${innerValue}}`
      }
      return `\\sqrt{${innerValue}}`
    } else {
      // Simplified form like 2*sqrt(2)
      if (isNegative) {
        return `-${coefficient}\\sqrt{${innerValue}}`
      }
      return `${coefficient}\\sqrt{${innerValue}}`
    }
  }

  // Check if it's a fraction times sqrt (like sqrt(15)/2)
  for (let denom = 2; denom <= 20; denom++) {
    const numTimesDenom = num * denom
    const numTimesDenomSquared = numTimesDenom * numTimesDenom
    const squaredInt = Math.round(numTimesDenomSquared)

    if (squaredInt >= 2 && squaredInt <= 1000 && Math.abs(numTimesDenomSquared - squaredInt) < tolerance) {
      if (num < 0) {
        return `-\\frac{\\sqrt{${squaredInt}}}{${denom}}`
      }
      return `\\frac{\\sqrt{${squaredInt}}}{${denom}}`
    }
  }

  // Check for pi multiples
  const piMultiple = num / Math.PI
  const piMultipleRounded = Math.round(piMultiple)
  if (Math.abs(piMultiple - piMultipleRounded) < tolerance && Math.abs(piMultipleRounded) <= 10) {
    if (piMultipleRounded === 1) return '\\pi'
    if (piMultipleRounded === -1) return '-\\pi'
    if (piMultipleRounded === 0) return null
    return `${piMultipleRounded}\\pi`
  }

  // Check for pi fractions
  for (let denom = 2; denom <= 12; denom++) {
    const piRatio = (num * denom) / Math.PI
    const numerator = Math.round(piRatio)
    if (Math.abs(piRatio - numerator) < tolerance && Math.abs(numerator) <= 12) {
      if (numerator === 0) continue
      const sign = numerator < 0 ? '-' : ''
      const absNum = Math.abs(numerator)
      if (absNum === 1) {
        return `${sign}\\frac{\\pi}{${denom}}`
      }
      return `${sign}\\frac{${absNum}\\pi}{${denom}}`
    }
  }

  return null
}

/**
 * Snap coordinate to integer if very close (within floating point precision)
 */
function snapToInteger(num: number): number {
  const rounded = Math.round(num)
  // If within floating point precision of an integer, snap to exact integer
  if (Math.abs(num - rounded) < 1e-14) {
    return rounded
  }
  return num
}

/**
 * Add symbolic forms to intersection results by pattern recognition
 */
function addSymbolicForms(
  intersections: Array<{ x: number; y: number }>
): Array<{ x: number; y: number; symbolicX?: string; symbolicY?: string }> {
  console.log('addSymbolicForms called with intersections:', intersections)

  const results = intersections.map(point => {
    console.log('Processing point:', point)

    // Snap coordinates to integers if very close
    const snappedX = snapToInteger(point.x)
    const snappedY = snapToInteger(point.y)

    const symbolicX = tryRecognizeSymbolicForm(snappedX)
    const symbolicY = tryRecognizeSymbolicForm(snappedY)

    const result = {
      x: snappedX,
      y: snappedY,
      ...(symbolicX && { symbolicX }),
      ...(symbolicY && { symbolicY })
    }

    console.log('Result with symbolic forms:', result)
    return result
  })

  console.log('Final results:', results)
  return results
}

/**
 * Find intersection points between two functions near a given point
 */
export function findNearbyIntersections(
  expr1: string,
  expr2: string,
  nearPoint: { x: number; y: number },
  searchRadius: number = 2
): Array<{ x: number; y: number; symbolicX?: string; symbolicY?: string }> {
  console.log('findNearbyIntersections called:')
  console.log('  expr1:', expr1)
  console.log('  expr2:', expr2)
  console.log('  nearPoint:', nearPoint)
  console.log('  searchRadius:', searchRadius)
  try {

    // Check for vertical lines
    const verticalLine1 = checkVerticalLine(expr1)
    const verticalLine2 = checkVerticalLine(expr2)
    console.log('  verticalLine1:', verticalLine1)
    console.log('  verticalLine2:', verticalLine2)

    // Handle vertical line intersections
    if (verticalLine1 !== null && verticalLine2 === null) {
      console.log('  expr1 is vertical line at x =', verticalLine1)
      const results = findVerticalLineIntersection(verticalLine1, expr2, nearPoint, searchRadius)
      return addSymbolicForms(results)
    }
    if (verticalLine2 !== null && verticalLine1 === null) {
      console.log('  expr2 is vertical line at x =', verticalLine2)
      const results = findVerticalLineIntersection(verticalLine2, expr1, nearPoint, searchRadius)
      return addSymbolicForms(results)
    }
    if (verticalLine1 !== null && verticalLine2 !== null) {
      console.log('  Both are vertical lines - no intersection or parallel')
      return []
    }

    // Check for horizontal lines
    const horizontalLine1 = checkHorizontalLine(expr1)
    const horizontalLine2 = checkHorizontalLine(expr2)
    console.log('  horizontalLine1:', horizontalLine1)
    console.log('  horizontalLine2:', horizontalLine2)

    // Handle horizontal line intersections
    if (horizontalLine1 !== null && horizontalLine2 === null) {
      console.log('  expr1 is horizontal line at y =', horizontalLine1)

      // Check if expr2 is a cartesian function (no y variable, no parentheses indicating implicit form)
      if (!expr2.includes('y') && !expr2.includes('(')) {
        console.log('  expr2 is cartesian function, finding where f(x) =', horizontalLine1)
        // For cartesian y=f(x) and horizontal y=c, solve f(x)=c
        const results = findCartesianHorizontalIntersection(expr2, horizontalLine1, nearPoint, searchRadius)
        return addSymbolicForms(results)
      }

      const results = findHorizontalLineIntersection(horizontalLine1, expr2, nearPoint, searchRadius)
      return addSymbolicForms(results)
    }
    if (horizontalLine2 !== null && horizontalLine1 === null) {
      console.log('  expr2 is horizontal line at y =', horizontalLine2)

      // Check if expr1 is a cartesian function
      if (!expr1.includes('y') && !expr1.includes('(')) {
        console.log('  expr1 is cartesian function, finding where f(x) =', horizontalLine2)
        const results = findCartesianHorizontalIntersection(expr1, horizontalLine2, nearPoint, searchRadius)
        return addSymbolicForms(results)
      }

      const results = findHorizontalLineIntersection(horizontalLine2, expr1, nearPoint, searchRadius)
      return addSymbolicForms(results)
    }
    if (horizontalLine1 !== null && horizontalLine2 !== null) {
      console.log('  Both are horizontal lines - no intersection or parallel')
      return []
    }

    // Handle intersection of vertical and horizontal lines
    if (verticalLine1 !== null && horizontalLine1 === null && horizontalLine2 !== null) {
      console.log('  expr1 is vertical line, expr2 is horizontal line')
      const x = verticalLine1
      const y = horizontalLine2
      const dist = Math.sqrt(Math.pow(x - nearPoint.x, 2) + Math.pow(y - nearPoint.y, 2))
      if (dist <= searchRadius) {
        console.log(`  ✓ Intersection at (${x}, ${y})`)
        return addSymbolicForms([{ x: snapToInteger(x), y: snapToInteger(y) }])
      }
      return []
    }
    if (verticalLine2 !== null && horizontalLine2 === null && horizontalLine1 !== null) {
      console.log('  expr2 is vertical line, expr1 is horizontal line')
      const x = verticalLine2
      const y = horizontalLine1
      const dist = Math.sqrt(Math.pow(x - nearPoint.x, 2) + Math.pow(y - nearPoint.y, 2))
      if (dist <= searchRadius) {
        console.log(`  ✓ Intersection at (${x}, ${y})`)
        return addSymbolicForms([{ x: snapToInteger(x), y: snapToInteger(y) }])
      }
      return []
    }

    // Try analytical solution for linear functions
    const linear1 = isLinear(expr1)
    const linear2 = isLinear(expr2)
    console.log('  linear1:', linear1)
    console.log('  linear2:', linear2)

    if (linear1 && linear2) {
      console.log('  Both are linear, finding analytical intersection')
      const intersection = findLinearIntersection(linear1, linear2)
      console.log('  Analytical intersection:', intersection)
      if (intersection) {
        // Check if intersection is within search radius
        const dist = Math.sqrt(
          Math.pow(intersection.x - nearPoint.x, 2) +
          Math.pow(intersection.y - nearPoint.y, 2)
        )
        console.log('  Distance from nearPoint:', dist, 'searchRadius:', searchRadius)
        if (dist <= searchRadius) {
          console.log('  ✓ Intersection found within radius!')
          return addSymbolicForms([intersection])
        } else {
          console.log('  ✗ Intersection too far from nearPoint')
        }
      }
      return []
    }
    console.log('  Not both linear, using numerical method')

    let compiled1, compiled2
    try {
      compiled1 = compileExpression(expr1)
      console.log('  ✓ expr1 compiled successfully')
    } catch (e) {
      console.error('  ✗ Failed to compile expr1:', e)
      return []
    }

    try {
      compiled2 = compileExpression(expr2)
      console.log('  ✓ expr2 compiled successfully')
    } catch (e) {
      console.error('  ✗ Failed to compile expr2:', e)
      return []
    }

    const intersections: Array<{ x: number; y: number }> = []

    // Search in a grid around the point
    const xMin = nearPoint.x - searchRadius
    const xMax = nearPoint.x + searchRadius
    const steps = 200
    console.log('  Numerical search: xMin =', xMin, 'xMax =', xMax, 'steps =', steps)

    const dx = (xMax - xMin) / steps
    let prevSign: number | null = null
    let prevX = xMin
    let prevY1 = evaluateExpression(compiled1, { x: xMin })
    let prevY2 = evaluateExpression(compiled2, { x: xMin })

    // Initialize prevSign for the first point
    if (isFinite(prevY1) && isFinite(prevY2)) {
      prevSign = Math.sign(prevY1 - prevY2)
      console.log('  Initial: x =', xMin, 'y1 =', prevY1, 'y2 =', prevY2, 'diff =', (prevY1 - prevY2), 'sign =', prevSign)
    }

    for (let i = 1; i <= steps; i++) {
      const x = xMin + i * dx
      const y1 = evaluateExpression(compiled1, { x })
      const y2 = evaluateExpression(compiled2, { x })

      if (!isFinite(y1) || !isFinite(y2)) {
        prevSign = null
        prevX = x
        prevY1 = y1
        prevY2 = y2
        continue
      }

      const diff = y1 - y2
      const sign = Math.sign(diff)

      // Debug: log every 20th point
      if (i % 20 === 0) {
        console.log('  [', i, '] x =', x.toFixed(3), 'y1 =', y1.toFixed(3), 'y2 =', y2.toFixed(3), 'diff =', diff.toFixed(3), 'sign =', sign, 'prevSign =', prevSign)
      }

      // Check if diff is very close to zero (direct hit)
      const tolerance = 0.001 // Tolerance for detecting near-zero difference
      if (Math.abs(diff) < tolerance) {
        console.log('  Near-zero difference detected at x =', x, 'diff =', diff)

        // Use root finding to get precise intersection
        const intersectionX = findRoot(
          (x) => {
            const y1 = evaluateExpression(compiled1, { x })
            const y2 = evaluateExpression(compiled2, { x })
            return y1 - y2
          },
          prevX,
          x
        )

        if (intersectionX !== null) {
          const y = evaluateExpression(compiled1, { x: intersectionX })
          if (isFinite(y)) {
            // Check if this intersection is too close to an existing one
            const isDuplicate = intersections.some(existing =>
              Math.abs(existing.x - intersectionX) < 0.1
            )

            if (!isDuplicate) {
              console.log('  ✓ Found intersection at (', intersectionX, ',', y, ')')
              intersections.push({ x: intersectionX, y })
            } else {
              console.log('  ✗ Duplicate intersection, skipping')
            }
          }
        }

        // Skip ahead to avoid finding duplicate intersections
        // Jump past this region by advancing i
        i += 5 // Skip next few steps to avoid duplicates

        prevSign = sign
        prevX = x
        prevY1 = y1
        prevY2 = y2
        continue
      }

      // Check for sign change (intersection)
      if (prevSign !== null && sign !== 0 && sign !== prevSign) {
        console.log('  Sign change detected at x =', x, 'between', prevX, 'and', x)
        // Use hybrid method to find more accurate intersection point
        const intersectionX = findRoot(
          (x) => {
            const y1 = evaluateExpression(compiled1, { x })
            const y2 = evaluateExpression(compiled2, { x })
            return y1 - y2
          },
          prevX,
          x
        )

        if (intersectionX !== null) {
          const y = evaluateExpression(compiled1, { x: intersectionX })
          if (isFinite(y)) {
            console.log('  ✓ Found intersection at (', intersectionX, ',', y, ')')
            intersections.push({ x: intersectionX, y })
          }
        } else {
          console.log('  ✗ Failed to find exact intersection')
        }
      }

      prevSign = sign
      prevX = x
      prevY1 = y1
      prevY2 = y2
    }

    console.log('  Total intersections found:', intersections.length)

    // Add symbolic forms to results through pattern recognition
    return addSymbolicForms(intersections)
  } catch (error) {
    console.error('Error finding intersections:', error)
    return []
  }
}

/**
 * Newton-Raphson method to find root of f(x) = 0
 * More accurate and faster than bisection when derivative is available
 */
function newtonRaphson(
  f: (x: number) => number,
  x0: number,
  maxIterations: number = 20,
  tolerance: number = 1e-12
): number | null {
  let x = x0

  for (let i = 0; i < maxIterations; i++) {
    const fx = f(x)

    if (!isFinite(fx)) return null
    if (Math.abs(fx) < tolerance) return x

    // Numerical derivative using central difference
    const h = 1e-8
    const fxPlus = f(x + h)
    const fxMinus = f(x - h)

    if (!isFinite(fxPlus) || !isFinite(fxMinus)) return null

    const derivative = (fxPlus - fxMinus) / (2 * h)

    // Avoid division by zero
    if (Math.abs(derivative) < 1e-15) return null

    const xNew = x - fx / derivative

    if (!isFinite(xNew)) return null
    if (Math.abs(xNew - x) < tolerance) return xNew

    x = xNew
  }

  return x
}

/**
 * Bisection method to find root of f(x) = 0
 * Used as fallback when Newton-Raphson fails
 */
function bisection(
  f: (x: number) => number,
  a: number,
  b: number,
  maxIterations: number = 20,
  tolerance: number = 1e-12
): number | null {
  let fa = f(a)
  let fb = f(b)

  if (!isFinite(fa) || !isFinite(fb)) return null
  if (fa * fb > 0) return null // No sign change

  for (let i = 0; i < maxIterations; i++) {
    const c = (a + b) / 2
    const fc = f(c)

    if (!isFinite(fc)) return null
    if (Math.abs(fc) < tolerance || Math.abs(b - a) < tolerance) {
      return c
    }

    if (fa * fc < 0) {
      b = c
      fb = fc
    } else {
      a = c
      fa = fc
    }
  }

  return (a + b) / 2
}

/**
 * Hybrid root finding: Try Newton-Raphson first, fall back to bisection
 */
function findRoot(
  f: (x: number) => number,
  a: number,
  b: number
): number | null {
  // Try Newton-Raphson starting from midpoint
  const midpoint = (a + b) / 2
  const newtonResult = newtonRaphson(f, midpoint)

  // Verify Newton result is within bounds and accurate
  if (newtonResult !== null && newtonResult >= a && newtonResult <= b) {
    const fNewton = f(newtonResult)
    if (isFinite(fNewton) && Math.abs(fNewton) < 1e-10) {
      return newtonResult
    }
  }

  // Fall back to bisection
  return bisection(f, a, b)
}

/**
 * Find all intersection points between multiple expressions
 */
export function findAllIntersections(
  expressions: Array<{ input: string; kind: string }>,
  nearPoint: { x: number; y: number },
  searchRadius: number = 2
): Array<{ x: number; y: number; symbolicX?: string; symbolicY?: string; expr1Index: number; expr2Index: number }> {
  const intersections: Array<{ x: number; y: number; symbolicX?: string; symbolicY?: string; expr1Index: number; expr2Index: number }> = []

  // Consider both cartesian and implicit functions
  const cartesianExprs = expressions
    .map((expr, index) => ({ ...expr, index }))
    .filter((expr) => expr.kind === 'cartesian' || expr.kind === 'implicit')

  // Find intersections between all pairs
  for (let i = 0; i < cartesianExprs.length; i++) {
    for (let j = i + 1; j < cartesianExprs.length; j++) {
      const points = findNearbyIntersections(
        cartesianExprs[i].input,
        cartesianExprs[j].input,
        nearPoint,
        searchRadius
      )

      for (const point of points) {
        intersections.push({
          ...point,
          expr1Index: cartesianExprs[i].index,
          expr2Index: cartesianExprs[j].index,
        })
      }
    }
  }

  return intersections
}

/**
 * Find the closest intersection point to a given point
 */
export function findClosestIntersection(
  intersections: Array<{ x: number; y: number }>,
  point: { x: number; y: number },
  maxDistance: number = 0.5
): { x: number; y: number } | null {
  let closest: { x: number; y: number } | null = null
  let minDist = maxDistance

  for (const intersection of intersections) {
    const dist = Math.sqrt(
      Math.pow(intersection.x - point.x, 2) + Math.pow(intersection.y - point.y, 2)
    )

    if (dist < minDist) {
      minDist = dist
      closest = intersection
    }
  }

  return closest
}

/**
 * Find x-intercepts (where y=0) for a function near a given point
 */
export function findXIntercepts(
  expr: string,
  nearPoint: { x: number; y: number },
  searchRadius: number = 5
): Array<{ x: number; y: number }> {
  try {
    const compiled = compileExpression(expr)
    const intercepts: Array<{ x: number; y: number }> = []

    // Search in a range around the click point
    const xMin = nearPoint.x - searchRadius
    const xMax = nearPoint.x + searchRadius
    const steps = 200

    const dx = (xMax - xMin) / steps
    let prevSign: number | null = null
    let prevX = xMin
    let prevY = evaluateExpression(compiled, { x: xMin })

    for (let i = 1; i <= steps; i++) {
      const x = xMin + i * dx
      const y = evaluateExpression(compiled, { x })

      if (!isFinite(y)) {
        prevSign = null
        prevX = x
        prevY = y
        continue
      }

      const sign = Math.sign(y)

      // Check for sign change (crossing x-axis)
      if (prevSign !== null && sign !== 0 && sign !== prevSign && isFinite(prevY)) {
        // Use hybrid method to find more accurate x-intercept
        const interceptX = findRoot(
          (x) => evaluateExpression(compiled, { x }),
          prevX,
          x
        )

        if (interceptX !== null) {
          intercepts.push({ x: snapToInteger(interceptX), y: 0 })
        }
      }

      prevSign = sign
      prevX = x
      prevY = y
    }

    return intercepts
  } catch (error) {
    console.error('Error finding x-intercepts:', error)
    return []
  }
}

/**
 * Find y-intercept (where x=0) for a function
 */
export function findYIntercept(expr: string): { x: number; y: number } | null {
  try {
    const compiled = compileExpression(expr)
    const y = evaluateExpression(compiled, { x: 0 })

    if (isFinite(y)) {
      return { x: 0, y: snapToInteger(y) }
    }

    return null
  } catch (error) {
    console.error('Error finding y-intercept:', error)
    return null
  }
}

/**
 * Find all intercepts (x and y) for multiple expressions near a point
 */
export function findAllIntercepts(
  expressions: Array<{ input: string; kind: string }>,
  nearPoint: { x: number; y: number },
  searchRadius: number = 5
): Array<{ x: number; y: number; type: 'x-intercept' | 'y-intercept' }> {
  const intercepts: Array<{ x: number; y: number; type: 'x-intercept' | 'y-intercept' }> = []

  const cartesianExprs = expressions.filter((expr) => expr.kind === 'cartesian' || expr.kind === 'implicit')

  for (const expr of cartesianExprs) {
    // Find x-intercepts (where y=0)
    const xIntercepts = findXIntercepts(expr.input, nearPoint, searchRadius)
    for (const intercept of xIntercepts) {
      intercepts.push({ ...intercept, type: 'x-intercept' })
    }

    // Find y-intercept (where x=0) if x=0 is within search range AND y is near click point
    if (nearPoint.x - searchRadius <= 0 && nearPoint.x + searchRadius >= 0) {
      const yIntercept = findYIntercept(expr.input)
      // Also check that the y value is near the click point
      if (yIntercept && Math.abs(yIntercept.y - nearPoint.y) <= searchRadius) {
        intercepts.push({ ...yIntercept, type: 'y-intercept' })
      }
    }
  }

  return intercepts
}
