/**
 * Convert LaTeX to math.js compatible expression
 * This is a simplified converter for common cases
 */
export function latexToMathJS(latex: string): string {
  let expr = latex

  // Remove display math delimiters
  expr = expr.replace(/^\\\[|\\\]$/g, '')
  expr = expr.replace(/^\$\$|\$\$$/g, '')
  expr = expr.replace(/^\$|\$$/g, '')

  // Remove \displaylines wrapper (MathLive multiline mode)
  // Only remove closing paren if we found displaylines
  if (expr.includes('\\displaylines')) {
    expr = expr.replace(/\\displaylines\s*\(/g, '')
    // Remove the matching closing paren at the end
    expr = expr.replace(/\)$/, '')
  }

  // Split by line breaks and take first equation only
  // (each line should be in its own expression)
  const lines = expr.split(/\\\\/)
  if (lines.length > 1) {
    // Take only the first non-empty line for graphing
    expr = lines.find(line => line.trim()) || lines[0]
  }

  // Clean up any remaining line breaks
  expr = expr.replace(/\\\\/g, '')

  // Handle comparison operators (equations)
  // Convert == to = for equation handling
  expr = expr.replace(/==/g, '=')

  // Check if this is an equation (has = sign)
  // Note: We don't extract the implicit function here anymore
  // We'll handle it in the expression detection

  // Convert fractions: \frac{a}{b} -> (a)/(b)
  expr = expr.replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '(($1)/($2))')

  // Convert fractions without braces: \frac23 -> (2)/(3)
  // This handles single digit/char fractions
  expr = expr.replace(/\\frac([0-9a-zA-Z])([0-9a-zA-Z])/g, '(($1)/($2))')

  // Convert sqrt: \sqrt{x} -> sqrt(x)
  expr = expr.replace(/\\sqrt\{([^}]+)\}/g, 'sqrt($1)')

  // Convert sqrt without braces: \sqrt3 -> sqrt(3)
  expr = expr.replace(/\\sqrt([0-9a-zA-Z])/g, 'sqrt($1)')

  // Convert nth root: \sqrt[n]{x} -> nthRoot(x, n)
  expr = expr.replace(/\\sqrt\[([^\]]+)\]\{([^}]+)\}/g, 'nthRoot($2, $1)')

  // Convert powers: x^{n} or x^n -> x^(n)
  expr = expr.replace(/\^\\{([^}]+)\\}/g, '^($1)')
  expr = expr.replace(/\^\{([^}]+)\}/g, '^($1)')

  // Handle single character exponents
  expr = expr.replace(/\^([a-zA-Z0-9])/g, '^$1')

  // Convert subscripts (just remove them for now)
  expr = expr.replace(/_\{([^}]+)\}/g, '')
  expr = expr.replace(/_([a-zA-Z0-9])/g, '')

  // Convert \left and \right FIRST (before trig functions)
  expr = expr.replace(/\\left/g, '')
  expr = expr.replace(/\\right/g, '')

  // Convert curly braces to parentheses
  expr = expr.replace(/\{/g, '(')
  expr = expr.replace(/\}/g, ')')

  // Fix LaTeX function calls without parentheses BEFORE converting function names
  // This handles cases like \sin x \cos x -> \sin(x) \cos(x)
  expr = expr.replace(/\\(sin|cos|tan|sec|csc|cot|arcsin|arccos|arctan|sinh|cosh|tanh|log|ln)\s+([a-zA-Z])/g, '\\$1($2)')

  // Trigonometric functions - replace the LaTeX commands
  expr = expr.replace(/\\sin/g, 'sin')
  expr = expr.replace(/\\cos/g, 'cos')
  expr = expr.replace(/\\tan/g, 'tan')
  expr = expr.replace(/\\sec/g, 'sec')
  expr = expr.replace(/\\csc/g, 'csc')
  expr = expr.replace(/\\cot/g, 'cot')

  // Inverse trig
  expr = expr.replace(/\\arcsin/g, 'asin')
  expr = expr.replace(/\\arccos/g, 'acos')
  expr = expr.replace(/\\arctan/g, 'atan')

  // Hyperbolic
  expr = expr.replace(/\\sinh/g, 'sinh')
  expr = expr.replace(/\\cosh/g, 'cosh')
  expr = expr.replace(/\\tanh/g, 'tanh')

  // Logarithms
  expr = expr.replace(/\\log/g, 'log10')
  expr = expr.replace(/\\ln/g, 'log')

  // Absolute value: |x| -> abs(x)
  expr = expr.replace(/\|([^|]+)\|/g, 'abs($1)')

  // Convert \cdot to *
  expr = expr.replace(/\\cdot/g, '*')

  // Convert \times to *
  expr = expr.replace(/\\times/g, '*')

  // Convert \div to /
  expr = expr.replace(/\\div/g, '/')

  // Convert \pi to pi
  expr = expr.replace(/\\pi/g, 'pi')

  // Convert \theta to theta
  expr = expr.replace(/\\theta/g, 'theta')

  // Remove extra spaces
  expr = expr.replace(/\s+/g, '')

  // Handle implicit multiplication: 2x -> 2*x, (x)(y) -> (x)*(y)
  expr = expr.replace(/(\d)([a-zA-Z(])/g, '$1*$2')
  expr = expr.replace(/\)(\()/g, ')*(')
  expr = expr.replace(/\)([a-zA-Z])/g, ')*$1')

  return expr
}

/**
 * Convert math.js expression to LaTeX (simplified)
 */
export function mathJSToLatex(expr: string): string {
  let latex = expr

  // Convert sqrt(x) to \sqrt{x}
  latex = latex.replace(/sqrt\(([^)]+)\)/g, '\\sqrt{$1}')

  // Convert functions to LaTeX
  latex = latex.replace(/sin\(/g, '\\sin(')
  latex = latex.replace(/cos\(/g, '\\cos(')
  latex = latex.replace(/tan\(/g, '\\tan(')
  latex = latex.replace(/asin\(/g, '\\arcsin(')
  latex = latex.replace(/acos\(/g, '\\arccos(')
  latex = latex.replace(/atan\(/g, '\\arctan(')

  // Logarithms
  latex = latex.replace(/log10\(/g, '\\log(')
  latex = latex.replace(/log\(/g, '\\ln(')

  // Convert abs(x) to |x|
  latex = latex.replace(/abs\(([^)]+)\)/g, '|$1|')

  // Convert pi to \pi
  latex = latex.replace(/\bpi\b/g, '\\pi')

  // Convert theta to \theta
  latex = latex.replace(/\btheta\b/g, '\\theta')

  // Convert multiplication to \cdot (optional)
  latex = latex.replace(/\*/g, '\\cdot ')

  return latex
}

/**
 * Validate if a LaTeX string can be converted
 */
export function validateLatex(latex: string): { valid: boolean; error?: string } {
  try {
    const mathjs = latexToMathJS(latex)
    if (!mathjs || mathjs.trim() === '') {
      return { valid: false, error: 'Empty expression' }
    }
    return { valid: true }
  } catch (error) {
    return { valid: false, error: (error as Error).message }
  }
}

/**
 * Detect if an expression is implicit (contains both x and y with =)
 * or explicit (y = f(x) or just f(x)) or a point (x,y)
 */
export function detectExpressionKind(mathjs: string): 'implicit' | 'cartesian' | 'point' {
  // Check if it's a point notation by trying to parse it
  const parsedPoint = parsePoint(mathjs)
  if (parsedPoint) {
    return 'point'
  }

  // Check if expression contains '='
  if (!mathjs.includes('=')) {
    return 'cartesian' // Just f(x), no equation
  }

  // Check if it's y = f(x) pattern (explicit function)
  const explicitMatch = mathjs.match(/^y\s*=\s*(.+)$/i)
  if (explicitMatch) {
    return 'cartesian' // y = f(x) is always explicit/cartesian
  }

  // Check if it's f(x) = y pattern (explicit function, reversed)
  const explicitReverseMatch = mathjs.match(/^(.+)\s*=\s*y$/i)
  if (explicitReverseMatch) {
    return 'cartesian' // f(x) = y is explicit/cartesian
  }

  // Otherwise, treat as implicit (e.g., x^2 + y^2 = 1)
  return 'implicit'
}

/**
 * Convert an equation to implicit form f(x,y) = 0
 * Example: x^2 + y^2 = 1 -> x^2 + y^2 - 1
 */
export function toImplicitForm(mathjs: string): string {
  if (!mathjs.includes('=')) {
    return mathjs // Already in single expression form
  }

  // Split by '=' and move everything to left side
  const parts = mathjs.split('=')
  if (parts.length !== 2) {
    return mathjs // Invalid equation
  }

  const [left, right] = parts.map(p => p.trim())

  // Return (left) - (right) to make it f(x,y) = 0
  return `(${left}) - (${right})`
}

/**
 * Extract explicit function from y = f(x)
 * Returns just f(x) part
 */
export function extractExplicitFunction(mathjs: string): string {
  const explicitMatch = mathjs.match(/^y\s*=\s*(.+)$/)
  if (explicitMatch) {
    return explicitMatch[1]
  }
  return mathjs
}

/**
 * Evaluate a simple math expression to a number
 * Handles pi, sqrt(), and basic arithmetic
 */
function evaluateSimpleExpression(expr: string): number | null {
  try {
    // Replace pi with its value
    let evaluated = expr.replace(/\bpi\b/gi, String(Math.PI))

    // Handle sqrt() function
    evaluated = evaluated.replace(/sqrt\(([^)]+)\)/g, (_, arg) => {
      const argValue = evaluateSimpleExpression(arg)
      return argValue !== null ? String(Math.sqrt(argValue)) : 'NaN'
    })

    // Evaluate using eval (safe here since we control the input)
    const result = Function(`"use strict"; return (${evaluated})`)()

    if (typeof result === 'number' && isFinite(result)) {
      return result
    }
  } catch (e) {
    // Evaluation failed
  }
  return null
}

/**
 * Parse point coordinates from (x,y) format
 * Now supports π, sqrt(), and expressions like (pi, 1) or (sqrt(3), 5)
 */
export function parsePoint(mathjs: string): { x: number; y: number } | null {
  const trimmed = mathjs.trim()

  // Check if starts and ends with parentheses
  if (!trimmed.startsWith('(') || !trimmed.endsWith(')')) {
    return null
  }

  // Remove outer parentheses
  const inner = trimmed.slice(1, -1).trim()

  // Find the comma that separates x and y coordinates
  // We need to handle nested parentheses correctly
  let depth = 0
  let commaIndex = -1

  for (let i = 0; i < inner.length; i++) {
    const char = inner[i]
    if (char === '(') {
      depth++
    } else if (char === ')') {
      depth--
    } else if (char === ',' && depth === 0) {
      commaIndex = i
      break
    }
  }

  if (commaIndex === -1) {
    return null
  }

  const xStr = inner.slice(0, commaIndex).trim()
  const yStr = inner.slice(commaIndex + 1).trim()

  // Try to evaluate both coordinates
  const x = evaluateSimpleExpression(xStr)
  const y = evaluateSimpleExpression(yStr)

  if (x !== null && y !== null) {
    return { x, y }
  }

  return null
}
