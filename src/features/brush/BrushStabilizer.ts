/**
 * BrushStabilizer - Krita-inspired brush stabilization
 *
 * Implements three smoothing methods:
 * 1. Basic - Simple temporal averaging
 * 2. Weighted - Gaussian weighted smoothing
 * 3. Stabilizer - Queue-based with delay distance
 */

export interface Point {
  x: number
  y: number
  pressure?: number
  tilt?: { x: number; y: number }
  rotation?: number
  timestamp: number
}

export interface StabilizerConfig {
  mode: 'none' | 'basic' | 'weighted' | 'stabilizer'
  // Queue size for temporal averaging (higher = smoother but more lag)
  queueSize: number
  // Delay distance - minimum distance before starting to output (for sharp corners)
  delayDistance: number
  // Finish stabilization when stroke ends
  finishStabilizer: boolean
  // Stabilize sensors (pressure, tilt, rotation)
  stabilizeSensors: boolean
  // Zoom level for distance compensation
  zoomLevel: number
}

export class BrushStabilizer {
  private config: StabilizerConfig
  private pointQueue: Point[] = []
  private accumulatedDistance: number = 0
  private isStrokeActive: boolean = false
  private lastOutputPoint: Point | null = null

  constructor(config: Partial<StabilizerConfig> = {}) {
    this.config = {
      mode: 'stabilizer',
      queueSize: 10,
      delayDistance: 30,
      finishStabilizer: true,
      stabilizeSensors: true,
      zoomLevel: 1.0,
      ...config
    }
  }

  /**
   * Update stabilizer configuration
   */
  updateConfig(config: Partial<StabilizerConfig>): void {
    this.config = { ...this.config, ...config }
  }

  /**
   * Start a new stroke
   */
  startStroke(): void {
    this.isStrokeActive = true
    this.pointQueue = []
    this.accumulatedDistance = 0
    this.lastOutputPoint = null
  }

  /**
   * End current stroke
   */
  endStroke(): Point[] {
    this.isStrokeActive = false

    // If finish stabilizer is enabled, output remaining points
    if (this.config.finishStabilizer && this.pointQueue.length > 0) {
      const remainingPoints: Point[] = []

      // Output all queued points
      while (this.pointQueue.length > 0) {
        const point = this.processQueuedPoint()
        if (point) {
          remainingPoints.push(point)
        }
      }

      return remainingPoints
    }

    return []
  }

  /**
   * Add a new point to the stabilizer
   */
  addPoint(point: Point): Point[] {
    if (!this.isStrokeActive) {
      return []
    }

    if (this.config.mode === 'none') {
      return [point]
    }

    this.pointQueue.push(point)

    // Limit queue size
    if (this.pointQueue.length > this.config.queueSize) {
      this.pointQueue.shift()
    }

    // For basic and weighted modes, output immediately
    if (this.config.mode === 'basic' || this.config.mode === 'weighted') {
      const smoothedPoint = this.smoothPoint()
      if (smoothedPoint) {
        this.lastOutputPoint = smoothedPoint
        return [smoothedPoint]
      }
      return []
    }

    // For stabilizer mode, use delay distance
    if (this.config.mode === 'stabilizer') {
      return this.processStabilizerMode(point)
    }

    return []
  }

  /**
   * Process stabilizer mode with delay distance
   */
  private processStabilizerMode(newPoint: Point): Point[] {
    const outputPoints: Point[] = []

    if (this.pointQueue.length < 2) {
      return []
    }

    // Calculate distance from last output point
    const lastPoint = this.lastOutputPoint || this.pointQueue[0]
    const distance = this.calculateDistance(lastPoint, newPoint)

    // Apply zoom compensation
    const adjustedDelayDistance = this.config.delayDistance / this.config.zoomLevel

    this.accumulatedDistance += distance

    // Output points when accumulated distance exceeds delay distance
    // Safety: limit to prevent infinite loops
    let iterations = 0
    const maxIterations = Math.min(this.pointQueue.length, 10)

    while (this.accumulatedDistance >= adjustedDelayDistance &&
           this.pointQueue.length >= 2 &&
           iterations < maxIterations) {
      iterations++

      const smoothedPoint = this.smoothPoint()
      if (smoothedPoint) {
        outputPoints.push(smoothedPoint)
        this.lastOutputPoint = smoothedPoint

        // Remove oldest point from queue to prevent infinite loop
        this.pointQueue.shift()

        // Reset accumulated distance after outputting a point
        this.accumulatedDistance = Math.max(0, this.accumulatedDistance - adjustedDelayDistance)
      } else {
        break
      }
    }

    return outputPoints
  }

  /**
   * Process queued point (used when finishing stroke)
   */
  private processQueuedPoint(): Point | null {
    if (this.pointQueue.length === 0) {
      return null
    }

    const smoothedPoint = this.smoothPoint()
    if (smoothedPoint) {
      this.lastOutputPoint = smoothedPoint
      // IMPORTANT: Remove the point from queue to prevent infinite loop
      this.pointQueue.shift()
      return smoothedPoint
    }

    // If smoothing failed, still remove the point to prevent infinite loop
    this.pointQueue.shift()
    return null
  }

  /**
   * Smooth point based on current mode
   */
  private smoothPoint(): Point | null {
    if (this.pointQueue.length === 0) {
      return null
    }

    switch (this.config.mode) {
      case 'basic':
        return this.basicSmoothing()
      case 'weighted':
        return this.weightedSmoothing()
      case 'stabilizer':
        return this.weightedSmoothing() // Stabilizer also uses weighted smoothing
      default:
        return this.pointQueue[this.pointQueue.length - 1]
    }
  }

  /**
   * Basic temporal averaging
   */
  private basicSmoothing(): Point | null {
    if (this.pointQueue.length === 0) {
      return null
    }

    const count = this.pointQueue.length
    let sumX = 0, sumY = 0
    let sumPressure = 0
    let sumTiltX = 0, sumTiltY = 0
    let sumRotation = 0

    for (const point of this.pointQueue) {
      sumX += point.x
      sumY += point.y
      if (this.config.stabilizeSensors) {
        if (point.pressure !== undefined) sumPressure += point.pressure
        if (point.tilt) {
          sumTiltX += point.tilt.x
          sumTiltY += point.tilt.y
        }
        if (point.rotation !== undefined) sumRotation += point.rotation
      }
    }

    const lastPoint = this.pointQueue[this.pointQueue.length - 1]

    return {
      x: sumX / count,
      y: sumY / count,
      pressure: this.config.stabilizeSensors ? sumPressure / count : lastPoint.pressure,
      tilt: this.config.stabilizeSensors ? {
        x: sumTiltX / count,
        y: sumTiltY / count
      } : lastPoint.tilt,
      rotation: this.config.stabilizeSensors ? sumRotation / count : lastPoint.rotation,
      timestamp: lastPoint.timestamp
    }
  }

  /**
   * Weighted smoothing with Gaussian weights
   */
  private weightedSmoothing(): Point | null {
    if (this.pointQueue.length === 0) {
      return null
    }

    const count = this.pointQueue.length
    const weights = this.calculateGaussianWeights(count)

    let sumX = 0, sumY = 0
    let sumPressure = 0
    let sumTiltX = 0, sumTiltY = 0
    let sumRotation = 0
    let totalWeight = 0

    for (let i = 0; i < count; i++) {
      const point = this.pointQueue[i]
      const weight = weights[i]

      sumX += point.x * weight
      sumY += point.y * weight
      totalWeight += weight

      if (this.config.stabilizeSensors) {
        if (point.pressure !== undefined) sumPressure += point.pressure * weight
        if (point.tilt) {
          sumTiltX += point.tilt.x * weight
          sumTiltY += point.tilt.y * weight
        }
        if (point.rotation !== undefined) sumRotation += point.rotation * weight
      }
    }

    const lastPoint = this.pointQueue[count - 1]

    return {
      x: sumX / totalWeight,
      y: sumY / totalWeight,
      pressure: this.config.stabilizeSensors ? sumPressure / totalWeight : lastPoint.pressure,
      tilt: this.config.stabilizeSensors ? {
        x: sumTiltX / totalWeight,
        y: sumTiltY / totalWeight
      } : lastPoint.tilt,
      rotation: this.config.stabilizeSensors ? sumRotation / totalWeight : lastPoint.rotation,
      timestamp: lastPoint.timestamp
    }
  }

  /**
   * Calculate Gaussian weights for smoothing
   */
  private calculateGaussianWeights(count: number): number[] {
    const weights: number[] = []
    const sigma = count / 3.0 // Standard deviation

    for (let i = 0; i < count; i++) {
      // Gaussian function: e^(-(x^2) / (2 * sigma^2))
      const x = i - (count - 1)
      const weight = Math.exp(-(x * x) / (2 * sigma * sigma))
      weights.push(weight)
    }

    return weights
  }

  /**
   * Calculate Euclidean distance between two points
   */
  private calculateDistance(p1: Point, p2: Point): number {
    const dx = p2.x - p1.x
    const dy = p2.y - p1.y
    return Math.sqrt(dx * dx + dy * dy)
  }

  /**
   * Get current queue length
   */
  getQueueLength(): number {
    return this.pointQueue.length
  }

  /**
   * Get accumulated distance (for debugging)
   */
  getAccumulatedDistance(): number {
    return this.accumulatedDistance
  }

  /**
   * Reset stabilizer state
   */
  reset(): void {
    this.pointQueue = []
    this.accumulatedDistance = 0
    this.isStrokeActive = false
    this.lastOutputPoint = null
  }
}
