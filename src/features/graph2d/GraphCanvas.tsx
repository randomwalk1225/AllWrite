import { useEffect, useRef, useCallback, useState, useMemo } from 'react'
import { useStore, formatCoordLatex } from '../../store'
import { GraphRenderer } from '../../core/render/renderer'
import { compileExpression, sampleFunction, sampleImplicitFunction, evaluateExpression } from '../../core/math/evaluator'
import { getVisibleBounds, screenToGraph, graphToScreen } from '../../core/geo/coordinates'
import { findAllIntersections, findClosestIntersection, findAllIntercepts } from '../../core/math/intersection'
import { KonvaDrawingLayer, type KonvaDrawingLayerHandle } from './KonvaDrawingLayer'
import { HexColorPicker } from 'react-colorful'
import katex from 'katex'
import 'katex/dist/katex.min.css'
import html2canvas from 'html2canvas'

export function GraphCanvas() {
  const baseCanvasRef = useRef<HTMLCanvasElement>(null)
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null)
  const konvaStageRef = useRef<any>(null)
  const drawingLayerRef = useRef<KonvaDrawingLayerHandle>(null)
  const baseRendererRef = useRef<GraphRenderer | null>(null)
  const overlayRendererRef = useRef<GraphRenderer | null>(null)
  const [isPanning, setIsPanning] = useState(false)
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null)
  const [isDraggingImage, setIsDraggingImage] = useState(false)
  const draggingImageRef = useRef<{ id: string; transform: DOMMatrix; rotation?: number } | null>(null)
  const loadedImagesRef = useRef<Map<string, HTMLImageElement>>(new Map())
  const contoursDataRef = useRef<Map<string, Array<Array<{ x: number; y: number }>>>>(new Map())
  const [isShiftPressed, setIsShiftPressed] = useState(false)
  const [mousePosition, setMousePosition] = useState<{ x: number; y: number } | null>(null)
  const [highlightAxis, setHighlightAxis] = useState<'x' | 'y' | null>(null)
  const [showPenSettings, setShowPenSettings] = useState(false)
  const [showHighlighterSettings, setShowHighlighterSettings] = useState(false)
  const [showEraserSettings, setShowEraserSettings] = useState(false)
  const [showColorPopup, setShowColorPopup] = useState(false)
  const [showSelectionHelp, setShowSelectionHelp] = useState(true)
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 })
  const [colorGestureDrag, setColorGestureDrag] = useState<{ startX: number; startY: number } | null>(null)
  const [captureMessage, setCaptureMessage] = useState<string | null>(null)
  const [trashSwipeDrag, setTrashSwipeDrag] = useState<{ startY: number; currentY: number } | null>(null)
  const [captureDrag, setCaptureDrag] = useState<{ startY: number; currentY: number } | null>(null)
  const gestureInProgressRef = useRef(false)
  const saveCounterRef = useRef(0)
  const graphContainerRef = useRef<HTMLDivElement>(null)

  // Text input state
  const [textInputVisible, setTextInputVisible] = useState(false)
  const [textInputPosition, setTextInputPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 })
  const [textInputValue, setTextInputValue] = useState('')
  const [editingTextId, setEditingTextId] = useState<string | null>(null) // Track which text is being edited
  const textInputRef = useRef<HTMLTextAreaElement>(null)
  const [textareaWidth, setTextareaWidth] = useState(200)
  const [isResizingTextarea, setIsResizingTextarea] = useState(false)
  const resizeStartXRef = useRef(0)
  const resizeStartWidthRef = useRef(200)
  const [editingFontSize, setEditingFontSize] = useState(20)
  const [editingColor, setEditingColor] = useState('#000000')
  const editingContainerRef = useRef<HTMLDivElement>(null)

  // Text object drag state
  const [isDraggingText, setIsDraggingText] = useState(false)
  const draggingTextRef = useRef<{
    textId: string
    startMouseX: number
    startMouseY: number
    startTextX: number
    startTextY: number
  } | null>(null)

  // Geometry creation drag state
  const [isCreatingGeometry, setIsCreatingGeometry] = useState(false)
  const creationDragRef = useRef<{
    firstPointId: string
    currentPos: { x: number; y: number }
  } | null>(null)

  const view = useStore((state) => state.view)
  const expressions = useStore((state) => state.expressions)
  const graphPoints = useStore((state) => state.graphPoints)

  // Create stable key from expressions to prevent unnecessary re-renders
  // Only re-render base layer when expression content actually changes
  const expressionKeys = useMemo(
    () => expressions.map(e => `${e.id}-${e.input}-${e.kind}-${e.visible}-${e.selected}`).join('|'),
    [expressions]
  )
  const addGraphPoint = useStore((state) => state.addGraphPoint)
  const removeGraphPoint = useStore((state) => state.removeGraphPoint)
  const clearGraphPoints = useStore((state) => state.clearGraphPoints)
  const images = useStore((state) => state.images)
  const addImage = useStore((state) => state.addImage)
  const updateImage = useStore((state) => state.updateImage)
  const removeImage = useStore((state) => state.removeImage)
  const clearAll = useStore((state) => state.clearAll)
  const resetView = useStore((state) => state.resetView)
  const zoomAxis = useStore((state) => state.zoomAxis)
  const gridMode = useStore((state) => state.gridMode)
  const setGridMode = useStore((state) => state.setGridMode)
  const visibilityMode = useStore((state) => state.visibilityMode)
  const setVisibilityMode = useStore((state) => state.setVisibilityMode)
  const undo = useStore((state) => state.undo)
  const redo = useStore((state) => state.redo)
  const canUndo = useStore((state) => state.canUndo)
  const canRedo = useStore((state) => state.canRedo)

  // Drawing tools
  const drawings = useStore((state) => state.drawings)
  const addDrawing = useStore((state) => state.addDrawing)
  const removeDrawing = useStore((state) => state.removeDrawing)
  const updateDrawing = useStore((state) => state.updateDrawing)
  const clearDrawings = useStore((state) => state.clearDrawings)
  const drawingTool = useStore((state) => state.drawingTool)
  const setDrawingTool = useStore((state) => state.setDrawingTool)
  const penColor = useStore((state) => state.penColor)
  const setPenColor = useStore((state) => state.setPenColor)
  const highlighterColor = useStore((state) => state.highlighterColor)
  const setHighlighterColor = useStore((state) => state.setHighlighterColor)
  const penThickness = useStore((state) => state.penThickness)
  const setPenThickness = useStore((state) => state.setPenThickness)
  const highlighterThickness = useStore((state) => state.highlighterThickness)
  const setHighlighterThickness = useStore((state) => state.setHighlighterThickness)
  const eraserThickness = useStore((state) => state.eraserThickness)
  const setEraserThickness = useStore((state) => state.setEraserThickness)
  const colorHistory = useStore((state) => state.colorHistory)

  // Text objects
  const textObjects = useStore((state) => state.textObjects)
  const addTextObject = useStore((state) => state.addTextObject)
  const removeTextObject = useStore((state) => state.removeTextObject)
  const updateTextObject = useStore((state) => state.updateTextObject)

  // Geometry tools
  const geometryObjects = useStore((state) => state.geometryObjects)
  const addGeometryObject = useStore((state) => state.addGeometryObject)
  const updateGeometryObject = useStore((state) => state.updateGeometryObject)
  const removeGeometryObject = useStore((state) => state.removeGeometryObject)
  const geometryTool = useStore((state) => state.geometryTool)
  const setGeometryTool = useStore((state) => state.setGeometryTool)
  const creationState = useStore((state) => state.creationState)
  const pointVisibilityMode = useStore((state) => state.pointVisibilityMode)
  const setPointVisibilityMode = useStore((state) => state.setPointVisibilityMode)
  const shapeRenderMode = useStore((state) => state.shapeRenderMode)
  const setShapeRenderMode = useStore((state) => state.setShapeRenderMode)
  const setCreationState = useStore((state) => state.setCreationState)
  const addCreationPoint = useStore((state) => state.addCreationPoint)
  const finishCreation = useStore((state) => state.finishCreation)
  const cancelCreation = useStore((state) => state.cancelCreation)
  const setRegularPolygonDialog = useStore((state) => state.setRegularPolygonDialog)
  const selectedIds = useStore((state) => state.selectedIds)
  const setSelectedIds = useStore((state) => state.setSelectedIds)

  // Page management
  const currentPageIndex = useStore((state) => state.currentPageIndex)
  const updatePageThumbnail = useStore((state) => state.updatePageThumbnail)

  // Capture canvas thumbnail
  const captureCanvasThumbnail = useCallback(async () => {
    const container = graphContainerRef.current
    if (!container) return null

    try {
      // Use html2canvas to capture the entire graph container
      const canvas = await html2canvas(container, {
        scale: 0.3, // Lower resolution for thumbnail
        logging: false,
        backgroundColor: '#ffffff'
      })

      // Convert to JPEG data URL
      const dataURL = canvas.toDataURL('image/jpeg', 0.6)
      return dataURL
    } catch (error) {
      console.error('Error capturing canvas thumbnail:', error)
      return null
    }
  }, [])

  // Auto-capture thumbnail of current page periodically
  useEffect(() => {
    // Wait a bit for rendering to complete, then capture
    const timeoutId = setTimeout(() => {
      captureCanvasThumbnail().then(thumbnail => {
        if (thumbnail) {
          updatePageThumbnail(currentPageIndex, thumbnail)
        }
      })
    }, 500) // Delay to ensure rendering is complete

    return () => clearTimeout(timeoutId)
  }, [
    currentPageIndex,
    expressions,
    drawings,
    textObjects,
    geometryObjects,
    images,
    view,
    captureCanvasThumbnail,
    updatePageThumbnail
  ])

  // Render base layer: grid, axes, and function graphs (expensive operations)
  const renderBaseLayer = useCallback(() => {
    const renderer = baseRendererRef.current
    if (!renderer) return

    const canvas = baseCanvasRef.current
    if (!canvas) return

    renderer.clear()

    // Draw grid and axes based on gridMode
    if (gridMode === 'grid' || gridMode === 'grid-axis') {
      renderer.drawGrid(view)
    }
    if (gridMode === 'axis' || gridMode === 'grid-axis') {
      renderer.drawAxes(view, null) // No highlight in base layer
    }

    // Draw each expression (functions only, not points)
    // Note: Drawing is now on separate Konva layer, so no performance impact
    for (const expr of expressions) {
        if (!expr.visible) continue

        // Skip empty expressions and points (points go in overlay layer)
        if (expr.kind === 'point') continue
        if (!expr.input || expr.input.trim() === '') continue

        // Skip calculator mode expressions (no variables)
        // Check if expression contains variables (x, y, t, theta)
        const hasVariables = /[xyt]|theta/.test(expr.input.toLowerCase())
        if (!hasVariables) continue

        try {
          const compiled = compileExpression(expr.input)
          const bounds = getVisibleBounds(
            canvas.clientWidth,
            canvas.clientHeight,
            view
          )
          const lineWidth = expr.selected ? 4 : 2

          if (expr.kind === 'cartesian') {
            const domain: [number, number] = expr.domain?.x || [bounds.xMin, bounds.xMax]
            const points = sampleFunction(compiled, domain, 1000)
            renderer.drawFunction(points, expr.color, view, lineWidth)
          } else if (expr.kind === 'implicit') {
            const contours = sampleImplicitFunction(compiled, bounds, 300)  // High resolution for accurate intersections
            // Store contours data for click detection
            contoursDataRef.current.set(expr.id, contours)
            renderer.drawImplicitFunction(contours, expr.color, view, lineWidth)
          }
          // TODO: Add support for parametric, polar
        } catch (error) {
          // Silently skip errors during typing (incomplete expressions)
          // Only log actual syntax errors, not "end of expression" errors
          const errorMsg = (error as Error).message
          if (!errorMsg.includes('Unexpected end of expression') &&
              !errorMsg.includes('end of input')) {
            console.error(`Failed to render expression ${expr.id}:`, error)
          }
          // Don't remove expressions, just skip them
          // User might still be typing
        }
      }
  }, [view, expressions, gridMode])

  // Render overlay layer: points, drawings, and images (fast operations)
  const renderOverlayLayer = useCallback(() => {
    const renderer = overlayRendererRef.current
    if (!renderer) return

    const canvas = overlayCanvasRef.current
    if (!canvas) return

    renderer.clear()

    // Draw highlighted axes (if any) on top of everything
    if (highlightAxis) {
      renderer.drawAxes(view, highlightAxis)
    }

    // Draw expression points
    for (const expr of expressions) {
      if (!expr.visible) continue
      if (expr.kind === 'point' && expr.point) {
        renderer.drawPoint(expr.point, expr.color, view, expr.selected)
      }
    }

    // Draw graph points (intersections, intercepts)
    // Only draw points if visibility mode allows it
    if (visibilityMode !== 'function-labels') {
      for (const point of graphPoints) {
        // Use point's color if specified, otherwise default to red
        const pointColor = point.color || '#ff0000'
        renderer.drawGraphPoint(point, pointColor, view)
      }
    }

    // Note: Geometry objects are now rendered in KonvaDrawingLayer for unified selection
    // TODO: Render other geometry types (segment, line, circle, polygon) in Konva

    const ctx = renderer.getContext()

    // Draw images (only legacy images without graphPosition)
    // Images with graphPosition are rendered in KonvaDrawingLayer
    for (const image of images) {
      // Skip images with graphPosition - they're rendered by Konva
      if (image.graphPosition) {
        continue
      }

      const imgElement = loadedImagesRef.current.get(image.id)
      if (!imgElement || !imgElement.complete) {
        // Load image if not loaded
        if (!loadedImagesRef.current.has(image.id)) {
          const img = new Image()
          img.onload = () => {
            loadedImagesRef.current.set(image.id, img)
            renderOverlayLayer() // Re-render overlay when image loads
          }
          img.src = image.src
          loadedImagesRef.current.set(image.id, img)
        }
        continue
      }

      ctx.save()
      ctx.globalAlpha = image.opacity

      // Use lower quality during image dragging for better performance
      if (isDraggingImage) {
        ctx.imageSmoothingQuality = 'low'
      } else {
        ctx.imageSmoothingQuality = 'high'
      }

      // Use dragging transform if this image is being dragged
      const transform = (draggingImageRef.current?.id === image.id)
        ? draggingImageRef.current.transform
        : image.transform

      // Use dragging rotation if this image is being rotated
      const rotation = (draggingImageRef.current?.id === image.id && draggingImageRef.current.rotation !== undefined)
        ? draggingImageRef.current.rotation
        : (image.rotation || 0)

      // Image position is stored in screen pixel coordinates (e, f)
      // This keeps images fixed on screen when graph is panned/zoomed
      ctx.translate(transform.e, transform.f)

      // Apply rotation if present
      if (rotation) {
        ctx.rotate(rotation)
      }

      ctx.scale(transform.a, transform.d)

      // Draw image centered at origin
      ctx.drawImage(imgElement, -0.5, -0.5, 1, 1)

      ctx.restore()

      // Draw selection border and resize handles in screen coordinates (not scaled)
      if (selectedImageId === image.id) {
        const centerX = transform.e
        const centerY = transform.f
        const halfWidth = transform.a / 2
        const halfHeight = transform.d / 2

        // Helper function to rotate a point around the image center
        const rotatePoint = (x: number, y: number) => {
          const dx = x - centerX
          const dy = y - centerY
          return {
            x: centerX + dx * Math.cos(rotation) - dy * Math.sin(rotation),
            y: centerY + dx * Math.sin(rotation) + dy * Math.cos(rotation)
          }
        }

        // Calculate unrotated corner positions
        const corners = [
          { x: centerX - halfWidth, y: centerY - halfHeight }, // top-left
          { x: centerX + halfWidth, y: centerY - halfHeight }, // top-right
          { x: centerX + halfWidth, y: centerY + halfHeight }, // bottom-right
          { x: centerX - halfWidth, y: centerY + halfHeight }  // bottom-left
        ]

        // Rotate corners
        const rotatedCorners = corners.map(c => rotatePoint(c.x, c.y))

        // Draw border as a path
        ctx.strokeStyle = '#4ecdc4'
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.moveTo(rotatedCorners[0].x, rotatedCorners[0].y)
        for (let i = 1; i < rotatedCorners.length; i++) {
          ctx.lineTo(rotatedCorners[i].x, rotatedCorners[i].y)
        }
        ctx.closePath()
        ctx.stroke()

        // Draw resize handles at rotated corners (always 8x8 pixels)
        const handleSize = 8
        ctx.fillStyle = '#4ecdc4'
        for (const corner of rotatedCorners) {
          ctx.fillRect(corner.x - handleSize / 2, corner.y - handleSize / 2, handleSize, handleSize)
        }

        // Draw edge handles at middle of each side
        const edgeHandles = [
          { x: centerX, y: centerY - halfHeight },  // top (north)
          { x: centerX + halfWidth, y: centerY },   // right (east)
          { x: centerX, y: centerY + halfHeight },  // bottom (south)
          { x: centerX - halfWidth, y: centerY }    // left (west)
        ]
        const rotatedEdgeHandles = edgeHandles.map(h => rotatePoint(h.x, h.y))
        for (const handle of rotatedEdgeHandles) {
          ctx.fillRect(handle.x - handleSize / 2, handle.y - handleSize / 2, handleSize, handleSize)
        }

        // Draw delete button outside top-right corner
        const deleteButtonSize = 20
        const deleteButtonOffset = { x: halfWidth + 15, y: -halfHeight - deleteButtonSize / 2 - 15 }
        const deleteButtonPos = rotatePoint(centerX + deleteButtonOffset.x, centerY + deleteButtonOffset.y)
        ctx.fillStyle = '#ff4444'
        ctx.beginPath()
        ctx.arc(deleteButtonPos.x, deleteButtonPos.y, deleteButtonSize / 2, 0, 2 * Math.PI)
        ctx.fill()
        // Draw X
        ctx.strokeStyle = '#ffffff'
        ctx.lineWidth = 2
        const offset = deleteButtonSize / 4
        ctx.beginPath()
        ctx.moveTo(deleteButtonPos.x - offset, deleteButtonPos.y - offset)
        ctx.lineTo(deleteButtonPos.x + offset, deleteButtonPos.y + offset)
        ctx.moveTo(deleteButtonPos.x + offset, deleteButtonPos.y - offset)
        ctx.lineTo(deleteButtonPos.x - offset, deleteButtonPos.y + offset)
        ctx.stroke()

        // Draw rotation handle at top center (10px further away)
        const rotateButtonSize = 20
        const rotateButtonOffset = { x: 0, y: -halfHeight - rotateButtonSize / 2 - 15 }
        const rotateButtonPos = rotatePoint(centerX + rotateButtonOffset.x, centerY + rotateButtonOffset.y)
        ctx.fillStyle = '#4ecdc4'
        ctx.beginPath()
        ctx.arc(rotateButtonPos.x, rotateButtonPos.y, rotateButtonSize / 2, 0, 2 * Math.PI)
        ctx.fill()
        // Draw rotation icon (circular arrow)
        ctx.strokeStyle = '#ffffff'
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.arc(rotateButtonPos.x, rotateButtonPos.y, rotateButtonSize / 4, 0.3, Math.PI * 1.7, false)
        ctx.stroke()
        // Draw arrow head
        const arrowSize = 3
        const arrowAngle = Math.PI * 1.7
        const arrowX = rotateButtonPos.x + Math.cos(arrowAngle) * rotateButtonSize / 4
        const arrowY = rotateButtonPos.y + Math.sin(arrowAngle) * rotateButtonSize / 4
        ctx.beginPath()
        ctx.moveTo(arrowX, arrowY)
        ctx.lineTo(arrowX - arrowSize, arrowY - arrowSize)
        ctx.moveTo(arrowX, arrowY)
        ctx.lineTo(arrowX + arrowSize, arrowY - arrowSize)
        ctx.stroke()
      }
    }

    // Draw dotted lines from points to labels
    if (visibilityMode === 'labels-only' || visibilityMode === 'point-labels') {
      ctx.save()
      ctx.strokeStyle = '#999'
      ctx.lineWidth = 1
      ctx.setLineDash([3, 3])

      // Draw lines for graph points
      for (const point of graphPoints) {
        const screen = graphToScreen(point.x, point.y, canvas.width, canvas.height, view)
        const labelLeft = screen.x
        const labelTop = screen.y - 10 // 10px above the point (same as HTML label positioning)

        ctx.beginPath()
        ctx.moveTo(screen.x, screen.y)
        ctx.lineTo(labelLeft, labelTop)
        ctx.stroke()
      }

      // Draw lines for expression points
      for (const expr of expressions) {
        if (expr.kind === 'point' && expr.point && expr.visible) {
          const screen = graphToScreen(expr.point.x, expr.point.y, canvas.width, canvas.height, view)
          const labelLeft = screen.x
          const labelTop = screen.y - 10 // 10px above the point

          ctx.beginPath()
          ctx.moveTo(screen.x, screen.y)
          ctx.lineTo(labelLeft, labelTop)
          ctx.stroke()
        }
      }

      ctx.restore()
    }

    // Drawings are now rendered by KonvaDrawingLayer
  }, [view, expressions, graphPoints, images, selectedImageId, isDraggingImage, highlightAxis, visibilityMode, geometryObjects])

  // Handle color gesture drag (swipe to change color quickly)
  useEffect(() => {
    if (!colorGestureDrag) return

    const gestureDetectedRef = { current: false }

    const handleMouseMove = (e: MouseEvent) => {
      if (!colorGestureDrag) return

      const deltaX = e.clientX - colorGestureDrag.startX
      const deltaY = e.clientY - colorGestureDrag.startY
      const threshold = 30 // minimum distance to trigger color change

      // Determine direction and change color
      if (Math.abs(deltaX) > threshold || Math.abs(deltaY) > threshold) {
        let newColor: string | null = null

        if (Math.abs(deltaX) > Math.abs(deltaY)) {
          // Horizontal drag
          if (deltaX > threshold) {
            // Right: Red
            newColor = '#ff0000'
          } else if (deltaX < -threshold) {
            // Left: Blue
            newColor = '#0000ff'
          }
        } else {
          // Vertical drag
          if (deltaY > threshold) {
            // Down: Black
            newColor = '#000000'
          } else if (deltaY < -threshold) {
            // Up: Green
            newColor = '#00cc00'
          }
        }

        if (newColor) {
          if (drawingTool === 'pen') {
            setPenColor(newColor)
          } else if (drawingTool === 'highlighter') {
            setHighlighterColor(newColor)
          }
          gestureDetectedRef.current = true
          gestureInProgressRef.current = true
          setColorGestureDrag(null) // Reset drag state after color change
          setShowColorPopup(false) // Close popup
        }
      }
    }

    const handleMouseUp = (e: MouseEvent) => {
      const startDrag = colorGestureDrag
      if (!startDrag) return

      const deltaX = e.clientX - startDrag.startX
      const deltaY = e.clientY - startDrag.startY
      const clickThreshold = 5 // If movement is less than this, it's a click

      console.log('Color button mouseup:', { deltaX, deltaY, gestureDetected: gestureDetectedRef.current })

      // If gesture was detected, mark it
      if (gestureDetectedRef.current) {
        gestureInProgressRef.current = true
      }

      setColorGestureDrag(null)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [colorGestureDrag, drawingTool, setPenColor, setHighlighterColor])

  // Initialize all renderers and handle resize
  useEffect(() => {
    const baseCanvas = baseCanvasRef.current
    const overlayCanvas = overlayCanvasRef.current
    if (!baseCanvas || !overlayCanvas) return

    const baseRenderer = new GraphRenderer(baseCanvas)
    const overlayRenderer = new GraphRenderer(overlayCanvas)
    baseRendererRef.current = baseRenderer
    overlayRendererRef.current = overlayRenderer

    let resizeFrame: number | null = null
    const handleResize = () => {
      // Cancel previous pending resize if still queued
      if (resizeFrame !== null) {
        cancelAnimationFrame(resizeFrame)
      }

      // Schedule resize and render for next frame to avoid rapid successive calls
      resizeFrame = requestAnimationFrame(() => {
        baseRenderer.resize()
        overlayRenderer.resize()
        // Update canvas size for Konva layer
        const rect = baseCanvas.getBoundingClientRect()
        setCanvasSize({ width: rect.width, height: rect.height })
        renderBaseLayer()
        renderOverlayLayer()
        resizeFrame = null
      })
    }

    // Initial render
    baseRenderer.resize()
    overlayRenderer.resize()
    // Initial canvas size
    const rect = baseCanvas.getBoundingClientRect()
    setCanvasSize({ width: rect.width, height: rect.height })
    renderBaseLayer()
    renderOverlayLayer()

    // Use ResizeObserver to detect canvas size changes (e.g., when split panel moves)
    const resizeObserver = new ResizeObserver(() => {
      handleResize()
    })
    resizeObserver.observe(baseCanvas)

    // Also listen for window resize as backup
    window.addEventListener('resize', handleResize)
    return () => {
      if (resizeFrame !== null) {
        cancelAnimationFrame(resizeFrame)
      }
      resizeObserver.disconnect()
      window.removeEventListener('resize', handleResize)
    }
  }, [renderBaseLayer, renderOverlayLayer])

  // Re-render base layer when view, gridMode, or expression content changes (expensive operations)
  // Note: renderBaseLayer is not in dependencies to avoid re-running when expressions array reference changes
  // We use expressionKeys to detect actual content changes
  useEffect(() => {
    renderBaseLayer()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, gridMode, expressionKeys])

  // Re-render overlay layer when points or images change (fast operations)
  // Drawings and geometry objects are now handled by KonvaDrawingLayer
  useEffect(() => {
    renderOverlayLayer()
  }, [view, graphPoints, images, selectedImageId, isDraggingImage, highlightAxis, renderOverlayLayer])

  // Track Shift key state and handle arrow keys for axis scaling
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Shift') {
        setIsShiftPressed(true)
      }

      // Enter or Escape to finish polygon
      if (geometryTool === 'polygon' && creationState.tempPoints.length >= 3) {
        if (e.key === 'Enter' || e.key === 'Escape') {
          e.preventDefault()

          // Create polygon with all points
          const polygonPoints = creationState.tempPoints.map(pointId => {
            const point = geometryObjects.find(obj => obj.id === pointId)
            return point?.points[0]
          }).filter(p => p !== undefined) as GeometryPoint[]

          if (polygonPoints.length >= 3) {
            const newPolygonId = addGeometryObject({
              type: 'polygon',
              points: polygonPoints,
              color: '#ABD5B1',
              strokeWidth: 4,
              visible: true,
              selected: false,
              scale: 1,
              dependencies: creationState.tempPoints,
            })

            // Update all points to mark polygon as dependent
            creationState.tempPoints.forEach((pointId, index) => {
              const point = geometryObjects.find(obj => obj.id === pointId)
              if (point) {
                updateGeometryObject(pointId, {
                  dependents: [...(point.dependents || []), newPolygonId],
                  selected: false,
                  // Reset first point color to default
                  color: index === 0 ? '#4ecdc4' : point.color,
                })
              }
            })

            // Clear creation state
            finishCreation()
          }
        }
      }

      // Arrow keys for axis scaling when Shift is pressed and axis is highlighted
      if (highlightAxis && e.shiftKey) {
        if (e.key === 'ArrowUp' || e.key === 'ArrowRight') {
          e.preventDefault()
          zoomAxis(highlightAxis, 1.1)
        } else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') {
          e.preventDefault()
          zoomAxis(highlightAxis, 0.9)
        }
      }
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Shift') {
        setIsShiftPressed(false)
        setHighlightAxis(null)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [highlightAxis, zoomAxis, geometryTool, creationState, geometryObjects, addGeometryObject, updateGeometryObject, finishCreation])

  // Clear image selection when exiting select mode
  useEffect(() => {
    if (drawingTool !== 'select') {
      setSelectedImageId(null)
      setIsDraggingImage(false)
    }
  }, [drawingTool])

  // Close drawing settings when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      setShowPenSettings(false)
      setShowHighlighterSettings(false)
      setShowEraserSettings(false)
    }

    if (showPenSettings || showHighlighterSettings || showEraserSettings) {
      document.addEventListener('click', handleClickOutside)
      return () => {
        document.removeEventListener('click', handleClickOutside)
      }
    }
  }, [showPenSettings, showHighlighterSettings, showEraserSettings])

  // Update highlight axis based on Shift + mouse position
  useEffect(() => {
    if (!isShiftPressed || !mousePosition || !overlayCanvasRef.current) {
      setHighlightAxis(null)
      return
    }

    const canvas = overlayCanvasRef.current
    const origin = graphToScreen(0, 0, canvas.clientWidth, canvas.clientHeight, view)

    // Check distance from axes (30px threshold)
    const distFromXAxis = Math.abs(mousePosition.y - origin.y)
    const distFromYAxis = Math.abs(mousePosition.x - origin.x)

    if (distFromXAxis < 30 && distFromXAxis < distFromYAxis) {
      setHighlightAxis('x')
    } else if (distFromYAxis < 30 && distFromYAxis < distFromXAxis) {
      setHighlightAxis('y')
    } else {
      setHighlightAxis(null)
    }
  }, [isShiftPressed, mousePosition, view])

  // Track mouse position
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = overlayCanvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const canvasX = e.clientX - rect.left
    const canvasY = e.clientY - rect.top

    setMousePosition({
      x: canvasX,
      y: canvasY
    })

    // Update preview while dragging to create geometry
    if (isCreatingGeometry && creationDragRef.current) {
      const graphPos = screenToGraph(canvasX, canvasY, canvas.clientWidth, canvas.clientHeight, view)
      creationDragRef.current.currentPos = graphPos

      // Update preview state for rendering
      setCreationState({
        preview: {
          start: creationDragRef.current.firstPointId,
          end: graphPos,
        }
      })
    }

    // Update preview for circle-three-points while dragging third point
    if (creationState.toolType === 'circle-three-points' && creationState.tempPoints.length === 2 && isCreatingGeometry && creationDragRef.current) {
      const graphPos = screenToGraph(canvasX, canvasY, canvas.clientWidth, canvas.clientHeight, view)

      // Update drag position
      creationDragRef.current.currentPos = graphPos

      // Update preview state (end position is the third point position)
      setCreationState({
        preview: {
          start: creationState.tempPoints[0], // Not really used, but kept for consistency
          end: graphPos, // This is the third point position
        }
      })
    }

    // Update preview for polygon while creating
    if (geometryTool === 'polygon' && creationState.tempPoints.length > 0) {
      const graphPos = screenToGraph(canvasX, canvasY, canvas.clientWidth, canvas.clientHeight, view)

      setCreationState({
        preview: {
          start: creationState.tempPoints[0], // Not really used, but kept for consistency
          end: graphPos, // Current mouse position
        }
      })
    }

    // Note: Geometry object dragging is now handled by KonvaDrawingLayer

    // Eraser tool: delete strokes on hover
    if (drawingTool === 'eraser') {
      const strokeId = getStrokeAtPoint(canvasX, canvasY)
      if (strokeId) {
        removeDrawing(strokeId)
      }
    }
  }, [drawingTool, removeDrawing, isCreatingGeometry, setCreationState, view])

  // Handle trash swipe drag with window-level events
  useEffect(() => {
    if (!trashSwipeDrag) return

    const handleMouseMove = (e: MouseEvent) => {
      console.log('Window mousemove for trash, currentY:', e.clientY, 'distance:', e.clientY - trashSwipeDrag.startY)
      setTrashSwipeDrag(prev => prev ? { ...prev, currentY: e.clientY } : null)
    }

    const handleMouseUp = (e: MouseEvent) => {
      console.log('Window mouseup for trash!')
      if (trashSwipeDrag) {
        const swipeDistance = e.clientY - trashSwipeDrag.startY
        console.log('Swipe distance:', swipeDistance)
        console.log('Current state - drawings:', drawings.length, 'graphPoints:', graphPoints.length, 'images:', images.length)

        if (swipeDistance > 50) {
          // Swiped down - clear all objects
          console.log('Clearing all objects!')
          clearAll()
          setCaptureMessage('모두 지워짐!')
          setTimeout(() => setCaptureMessage(null), 1000)
        } else if (Math.abs(swipeDistance) < 10) {
          // Just a click - clear drawings only
          console.log('Clearing drawings only')
          clearDrawings()
        }
      }
      setTrashSwipeDrag(null)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [trashSwipeDrag, drawings, graphPoints, images, clearDrawings, clearAll])

  // Handle capture button drag for saving to file
  useEffect(() => {
    if (!captureDrag) return

    const handleMouseMove = (e: MouseEvent) => {
      setCaptureDrag(prev => prev ? { ...prev, currentY: e.clientY } : null)
    }

    const handleMouseUp = (e: MouseEvent) => {
      if (captureDrag) {
        const swipeDistance = e.clientY - captureDrag.startY

        if (swipeDistance > 50) {
          // Swiped down - save to file
          console.log('Saving to file!')
          saveToFile()
        } else if (Math.abs(swipeDistance) < 10) {
          // Just a click - copy to clipboard
          console.log('Copying to clipboard!')
          captureToClipboard()
        }
      }
      setCaptureDrag(null)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [captureDrag])

  // Handle text object dragging
  useEffect(() => {
    if (!isDraggingText) return

    const handleMouseMove = (e: MouseEvent) => {
      if (!draggingTextRef.current || !overlayCanvasRef.current) return

      const canvas = overlayCanvasRef.current
      const rect = canvas.getBoundingClientRect()

      const currentMouseX = e.clientX - rect.left
      const currentMouseY = e.clientY - rect.top

      // Convert delta to graph coordinates
      const startScreen = { x: draggingTextRef.current.startMouseX, y: draggingTextRef.current.startMouseY }
      const endScreen = { x: currentMouseX, y: currentMouseY }

      const startGraph = screenToGraph(startScreen.x, startScreen.y, rect.width, rect.height, view)
      const endGraph = screenToGraph(endScreen.x, endScreen.y, rect.width, rect.height, view)

      const deltaGraphX = endGraph.x - startGraph.x
      const deltaGraphY = endGraph.y - startGraph.y

      const newX = draggingTextRef.current.startTextX + deltaGraphX
      const newY = draggingTextRef.current.startTextY + deltaGraphY

      updateTextObject(draggingTextRef.current.textId, { x: newX, y: newY })
    }

    const handleMouseUp = () => {
      setIsDraggingText(false)
      draggingTextRef.current = null
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDraggingText, view, updateTextObject])

  // Handle textarea resize
  useEffect(() => {
    if (!isResizingTextarea) return

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - resizeStartXRef.current
      const newWidth = Math.max(200, Math.min(800, resizeStartWidthRef.current + deltaX))
      setTextareaWidth(newWidth)
    }

    const handleMouseUp = () => {
      setIsResizingTextarea(false)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isResizingTextarea])

  // Auto-resize textarea when it becomes visible, value, or font size changes
  useEffect(() => {
    if (textInputVisible && textInputRef.current) {
      const textarea = textInputRef.current
      // Small delay to ensure DOM is updated
      setTimeout(() => {
        textarea.style.height = 'auto'
        const newHeight = Math.max(40, textarea.scrollHeight)
        textarea.style.height = `${newHeight}px`
      }, 0)
    }
  }, [textInputVisible, textInputValue, editingFontSize])

  // Handle clipboard paste for images
  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      console.log('[Paste] Event triggered', e)

      // Check if we're focused on an input field
      const activeElement = document.activeElement
      console.log('[Paste] Active element:', activeElement?.tagName, activeElement)
      if (activeElement && (
        activeElement.tagName === 'INPUT' ||
        activeElement.tagName === 'TEXTAREA' ||
        activeElement.getAttribute('contenteditable') === 'true'
      )) {
        console.log('[Paste] Ignoring - input field is focused')
        return
      }

      const items = e.clipboardData?.items
      console.log('[Paste] Clipboard items:', items?.length)
      if (!items) {
        // No clipboard items, try internal paste
        console.log('[Paste] No items, trying internal paste')
        if (drawingLayerRef.current?.hasCopiedItems()) {
          e.preventDefault()
          drawingLayerRef.current?.paste()
        }
        return
      }

      let foundImage = false
      for (let i = 0; i < items.length; i++) {
        const item = items[i]
        console.log('[Paste] Item type:', item.type)

        if (item.type.indexOf('image') !== -1) {
          console.log('[Paste] Image found!')
          foundImage = true
          e.preventDefault() // Prevent default paste behavior
          const blob = item.getAsFile()
          if (!blob) {
            console.log('[Paste] Failed to get blob')
            continue
          }

          const reader = new FileReader()
          reader.onload = (event) => {
            console.log('[Paste] FileReader loaded')
            const src = event.target?.result as string
            if (!src) {
              console.log('[Paste] No src from reader')
              return
            }

            // Create image centered on screen in screen coordinates
            const canvas = overlayCanvasRef.current
            if (!canvas) {
              console.log('[Paste] No canvas ref!')
              return
            }
            console.log('[Paste] Creating image...')

            // Load image to get actual dimensions
            const img = new Image()
            img.onload = () => {
              const aspectRatio = img.width / img.height

              // Target size: 50% of canvas height
              let targetHeight = canvas.clientHeight * 0.5
              let targetWidth = targetHeight * aspectRatio

              // If width exceeds canvas width, scale down by width instead
              if (targetWidth > canvas.clientWidth * 0.5) {
                targetWidth = canvas.clientWidth * 0.5
                targetHeight = targetWidth / aspectRatio
              }

              const transform = new DOMMatrix()
              transform.a = targetWidth // scale x (pixels)
              transform.d = targetHeight // scale y (pixels)
              transform.e = canvas.clientWidth / 2 // translate x (screen pixels, centered)
              transform.f = canvas.clientHeight / 2 // translate y (screen pixels, centered)

              // Also create graphPosition for Konva-based selection
              const centerGraph = screenToGraph(
                canvas.clientWidth / 2,
                canvas.clientHeight / 2,
                canvas.clientWidth,
                canvas.clientHeight,
                view
              )
              const widthGraph = targetWidth / (view.scale * view.scaleX)
              const heightGraph = targetHeight / (view.scale * view.scaleY)

              addImage({
                src,
                transform,
                opacity: 1,
                locked: false,
                aspectRatio,
                graphPosition: {
                  x: centerGraph.x,
                  y: centerGraph.y,
                  width: widthGraph,
                  height: heightGraph,
                  rotation: 0
                }
              })
            }
            img.src = src
          }
          reader.readAsDataURL(blob)
        }
      }

      // If no image was found, try internal paste
      if (!foundImage) {
        console.log('[Paste] No image in clipboard, trying internal paste')
        if (drawingLayerRef.current?.hasCopiedItems()) {
          e.preventDefault()
          drawingLayerRef.current?.paste()
        }
      }
    }

    window.addEventListener('paste', handlePaste)
    return () => window.removeEventListener('paste', handlePaste)
  }, [addImage, view, drawingLayerRef])

  // Handle keyboard shortcuts for images
  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      if (!selectedImageId) return

      const canvas = overlayCanvasRef.current
      if (!canvas) return

      const image = images.find(img => img.id === selectedImageId)
      if (!image) return

      // Delete selected image
      if (e.key === 'Delete') {
        removeImage(selectedImageId)
        setSelectedImageId(null)
        return
      }

      // Arrow keys to move image by 1px (only if Shift is not pressed - Shift is for axis scaling)
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key) && !e.shiftKey) {
        e.preventDefault()

        // Move by 1px in screen coordinates (much simpler now!)
        const newTransform = new DOMMatrix(image.transform)

        if (e.key === 'ArrowLeft') {
          newTransform.e -= 1
        } else if (e.key === 'ArrowRight') {
          newTransform.e += 1
        } else if (e.key === 'ArrowUp') {
          newTransform.f -= 1
        } else { // ArrowDown
          newTransform.f += 1
        }

        updateImage(selectedImageId, { transform: newTransform })
        return
      }

      // Copy selected image to clipboard
      if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
        try {
          // Convert base64 to blob
          const response = await fetch(image.src)
          const blob = await response.blob()

          // Copy to clipboard
          await navigator.clipboard.write([
            new ClipboardItem({
              [blob.type]: blob
            })
          ])
        } catch (err) {
          console.error('Failed to copy image to clipboard:', err)
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedImageId, images, removeImage, updateImage, view])

  // Handle mouse wheel for zooming with non-passive listener
  useEffect(() => {
    const canvas = overlayCanvasRef.current
    if (!canvas) return

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault()

      const rect = canvas.getBoundingClientRect()
      const mouseX = e.clientX - rect.left
      const mouseY = e.clientY - rect.top

      const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1

      // If Shift is pressed and an axis is highlighted, zoom only that axis
      if (highlightAxis) {
        zoomAxis(highlightAxis, zoomFactor)
      } else {
        useStore.getState().zoom(zoomFactor, mouseX, mouseY)
      }
    }

    canvas.addEventListener('wheel', handleWheel, { passive: false })
    return () => canvas.removeEventListener('wheel', handleWheel)
  }, [highlightAxis, zoomAxis])

  // Check if click is on an image or resize handle
  const getImageAtPoint = (canvasX: number, canvasY: number): { id: string; handle?: string } | null => {
    if (!overlayCanvasRef.current) return null

    // Check images in reverse order (top to bottom)
    for (let i = images.length - 1; i >= 0; i--) {
      const image = images[i]

      const rotation = image.rotation || 0
      const centerX = image.transform.e
      const centerY = image.transform.f
      const halfWidth = image.transform.a / 2
      const halfHeight = image.transform.d / 2

      // Helper function to rotate a point around the image center
      const rotatePoint = (x: number, y: number) => {
        const dx = x - centerX
        const dy = y - centerY
        return {
          x: centerX + dx * Math.cos(rotation) - dy * Math.sin(rotation),
          y: centerY + dx * Math.sin(rotation) + dy * Math.cos(rotation)
        }
      }

      // If selected, check delete button, rotation handle and resize handles first
      if (selectedImageId === image.id) {
        // Check delete button (outside top-right corner)
        const deleteButtonSize = 20
        const deleteButtonOffset = { x: halfWidth + 15, y: -halfHeight - deleteButtonSize / 2 - 15 }
        const deleteButtonPos = rotatePoint(centerX + deleteButtonOffset.x, centerY + deleteButtonOffset.y)
        const distToDelete = Math.sqrt(
          Math.pow(canvasX - deleteButtonPos.x, 2) + Math.pow(canvasY - deleteButtonPos.y, 2)
        )
        if (distToDelete <= deleteButtonSize / 2) {
          return { id: image.id, handle: 'delete' }
        }

        // Check rotation handle (top center, 10px further away)
        const rotateButtonSize = 20
        const rotateButtonOffset = { x: 0, y: -halfHeight - rotateButtonSize / 2 - 15 }
        const rotateButtonPos = rotatePoint(centerX + rotateButtonOffset.x, centerY + rotateButtonOffset.y)
        const distToRotate = Math.sqrt(
          Math.pow(canvasX - rotateButtonPos.x, 2) + Math.pow(canvasY - rotateButtonPos.y, 2)
        )
        if (distToRotate <= rotateButtonSize / 2) {
          return { id: image.id, handle: 'rotate' }
        }

        // Check resize handles (8x8 pixel handles)
        const handleSize = 8
        const handleTolerance = handleSize / 2

        // Calculate unrotated corner positions
        const corners = [
          { name: 'nw', x: centerX - halfWidth, y: centerY - halfHeight },
          { name: 'ne', x: centerX + halfWidth, y: centerY - halfHeight },
          { name: 'se', x: centerX + halfWidth, y: centerY + halfHeight },
          { name: 'sw', x: centerX - halfWidth, y: centerY + halfHeight }
        ]

        // Rotate corners and check for clicks
        for (const corner of corners) {
          const rotatedCorner = rotatePoint(corner.x, corner.y)
          if (Math.abs(canvasX - rotatedCorner.x) <= handleTolerance &&
              Math.abs(canvasY - rotatedCorner.y) <= handleTolerance) {
            return { id: image.id, handle: corner.name }
          }
        }

        // Check edge handles (middle of each side)
        const edgeHandles = [
          { name: 'n', x: centerX, y: centerY - halfHeight },  // top (north)
          { name: 'e', x: centerX + halfWidth, y: centerY },   // right (east)
          { name: 's', x: centerX, y: centerY + halfHeight },  // bottom (south)
          { name: 'w', x: centerX - halfWidth, y: centerY }    // left (west)
        ]

        // Rotate edge handles and check for clicks
        for (const edge of edgeHandles) {
          const rotatedEdge = rotatePoint(edge.x, edge.y)
          if (Math.abs(canvasX - rotatedEdge.x) <= handleTolerance &&
              Math.abs(canvasY - rotatedEdge.y) <= handleTolerance) {
            return { id: image.id, handle: edge.name }
          }
        }
      }

      // Check if point is within image bounds (accounting for rotation)
      // Transform click point to image-local coordinates
      const localX = canvasX - centerX
      const localY = canvasY - centerY
      const unrotatedX = localX * Math.cos(-rotation) - localY * Math.sin(-rotation)
      const unrotatedY = localX * Math.sin(-rotation) + localY * Math.cos(-rotation)

      if (Math.abs(unrotatedX) <= halfWidth && Math.abs(unrotatedY) <= halfHeight) {
        return { id: image.id }
      }
    }
    return null
  }

  // Check if click is on a drawing stroke
  const getStrokeAtPoint = (canvasX: number, canvasY: number): string | null => {
    const canvas = overlayCanvasRef.current
    if (!canvas) return null

    const tolerance = 10 // pixels

    // Check strokes in reverse order (top to bottom)
    for (let i = drawings.length - 1; i >= 0; i--) {
      const stroke = drawings[i]
      if (stroke.points.length < 2) continue

      // Convert graph coordinates to screen coordinates and check distance
      for (let j = 1; j < stroke.points.length; j++) {
        const p1 = graphToScreen(stroke.points[j - 1].x, stroke.points[j - 1].y, canvas.clientWidth, canvas.clientHeight, view)
        const p2 = graphToScreen(stroke.points[j].x, stroke.points[j].y, canvas.clientWidth, canvas.clientHeight, view)

        // Calculate distance from point to line segment
        const dx = p2.x - p1.x
        const dy = p2.y - p1.y
        const lengthSquared = dx * dx + dy * dy

        if (lengthSquared === 0) {
          // p1 and p2 are the same point
          const dist = Math.sqrt(Math.pow(canvasX - p1.x, 2) + Math.pow(canvasY - p1.y, 2))
          if (dist <= tolerance + stroke.width / 2) {
            return stroke.id
          }
        } else {
          // Calculate projection of click point onto line segment
          const t = Math.max(0, Math.min(1, ((canvasX - p1.x) * dx + (canvasY - p1.y) * dy) / lengthSquared))
          const projX = p1.x + t * dx
          const projY = p1.y + t * dy
          const dist = Math.sqrt(Math.pow(canvasX - projX, 2) + Math.pow(canvasY - projY, 2))

          if (dist <= tolerance + stroke.width / 2) {
            return stroke.id
          }
        }
      }
    }
    return null
  }

  // Helper functions for selection
  const deselectAllImages = () => {
    images.forEach(image => {
      if (image.selected) {
        updateImage(image.id, { selected: false })
      }
    })
    setSelectedImageId(null)
  }

  const deselectAllStrokes = () => {
    drawings.forEach(stroke => {
      if (stroke.selected) {
        updateDrawing(stroke.id, { selected: false })
      }
    })
  }

  // Helper function to convert hex color to RGBA with specified alpha
  const hexToRgba = (hex: string, alpha: number): string => {
    // Remove # if present
    hex = hex.replace('#', '')

    // Parse hex values
    const r = parseInt(hex.substring(0, 2), 16)
    const g = parseInt(hex.substring(2, 4), 16)
    const b = parseInt(hex.substring(4, 6), 16)

    return `rgba(${r}, ${g}, ${b}, ${alpha})`
  }

  // Simplify points using Douglas-Peucker algorithm
  const simplifyPoints = (points: Array<{ x: number; y: number }>, tolerance: number = 2.0): Array<{ x: number; y: number }> => {
    if (points.length <= 2) return points

    // Find point with maximum distance from line between first and last
    let maxDist = 0
    let maxIndex = 0
    const first = points[0]
    const last = points[points.length - 1]

    for (let i = 1; i < points.length - 1; i++) {
      const point = points[i]
      // Calculate perpendicular distance from point to line
      const dx = last.x - first.x
      const dy = last.y - first.y
      const norm = Math.sqrt(dx * dx + dy * dy)
      if (norm === 0) continue

      const dist = Math.abs((point.x - first.x) * dy - (point.y - first.y) * dx) / norm
      if (dist > maxDist) {
        maxDist = dist
        maxIndex = i
      }
    }

    // If max distance is greater than tolerance, recursively simplify
    if (maxDist > tolerance) {
      const left = simplifyPoints(points.slice(0, maxIndex + 1), tolerance)
      const right = simplifyPoints(points.slice(maxIndex), tolerance)
      return [...left.slice(0, -1), ...right]
    } else {
      return [first, last]
    }
  }

  // Helper function to draw smooth curves using Catmull-Rom spline
  const drawSmoothCurve = (ctx: CanvasRenderingContext2D, points: Array<{ x: number; y: number }>) => {
    if (points.length < 2) return

    // Simplify points first to remove unnecessary details
    const simplified = simplifyPoints(points, 1.5)

    ctx.beginPath()
    ctx.moveTo(simplified[0].x, simplified[0].y)

    if (simplified.length === 2) {
      // Just two points, draw a line
      ctx.lineTo(simplified[1].x, simplified[1].y)
    } else if (simplified.length === 3) {
      // Three points, use quadratic curve
      ctx.quadraticCurveTo(
        simplified[1].x, simplified[1].y,
        simplified[2].x, simplified[2].y
      )
    } else {
      // Four or more points, use Catmull-Rom spline
      // Draw curve through all points except first and last (which are control points)
      for (let i = 0; i < simplified.length - 1; i++) {
        const p0 = simplified[Math.max(0, i - 1)]
        const p1 = simplified[i]
        const p2 = simplified[i + 1]
        const p3 = simplified[Math.min(simplified.length - 1, i + 2)]

        // Catmull-Rom to Bezier conversion
        const cp1x = p1.x + (p2.x - p0.x) / 6
        const cp1y = p1.y + (p2.y - p0.y) / 6
        const cp2x = p2.x - (p3.x - p1.x) / 6
        const cp2y = p2.y - (p3.y - p1.y) / 6

        ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y)
      }
    }
    ctx.stroke()
  }

  // Generate filename with date, time, and counter
  const generateFilename = () => {
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    const hours = String(now.getHours()).padStart(2, '0')
    const minutes = String(now.getMinutes()).padStart(2, '0')
    const seconds = String(now.getSeconds()).padStart(2, '0')

    saveCounterRef.current += 1
    const counter = String(saveCounterRef.current).padStart(3, '0')

    return `AllWrite_${year}${month}${day}_${hours}${minutes}${seconds}_${counter}.png`
  }

  // Save graph to file as PNG
  const saveToFile = async () => {
    try {
      // Capture only graph canvas (without UI buttons)
      const graphElement = graphContainerRef.current
      if (!graphElement) {
        setCaptureMessage('Graph not ready')
        setTimeout(() => setCaptureMessage(null), 1000)
        return
      }

      setCaptureMessage('캡처 중...')

      // Use html2canvas to capture only the graph canvas
      const canvas = await html2canvas(graphElement, {
        backgroundColor: '#ffffff',
        scale: 2, // Higher quality
        logging: false,
        useCORS: true,
        allowTaint: true
      })

      // Check if running in Electron
      if (window.electron) {
        // Use Electron IPC to save directly to Downloads/allwrite_img
        const dataUrl = canvas.toDataURL('image/png')
        const filename = generateFilename()

        try {
          const result = await window.electron.saveImage(dataUrl, filename)
          if (result.success) {
            setCaptureMessage('저장완료!')
            setTimeout(() => setCaptureMessage(null), 1000)
          } else {
            setCaptureMessage('Failed to save')
            setTimeout(() => setCaptureMessage(null), 1000)
          }
        } catch (err) {
          console.error('Failed to save file:', err)
          setCaptureMessage('Failed to save')
          setTimeout(() => setCaptureMessage(null), 1000)
        }
      } else {
        // Fallback to browser download
        canvas.toBlob((blob) => {
          if (!blob) {
            setCaptureMessage('Failed to create image')
            setTimeout(() => setCaptureMessage(null), 1000)
            return
          }

          try {
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = generateFilename()
            document.body.appendChild(a)
            a.click()
            document.body.removeChild(a)
            URL.revokeObjectURL(url)

            setCaptureMessage('저장완료!')
            setTimeout(() => setCaptureMessage(null), 1000)
          } catch (err) {
            console.error('Failed to save file:', err)
            setCaptureMessage('Failed to save')
            setTimeout(() => setCaptureMessage(null), 1000)
          }
        }, 'image/png')
      }
    } catch (err) {
      console.error('Error saving graph:', err)
      setCaptureMessage('Error saving')
      setTimeout(() => setCaptureMessage(null), 1000)
    }
  }

  // Capture graph to clipboard as PNG
  const captureToClipboard = async () => {
    try {
      // Capture only graph canvas (without UI buttons)
      const graphElement = graphContainerRef.current
      if (!graphElement) {
        setCaptureMessage('Graph not ready')
        setTimeout(() => setCaptureMessage(null), 1000)
        return
      }

      setCaptureMessage('복사 중...')

      // Use html2canvas to capture only the graph canvas
      const canvas = await html2canvas(graphElement, {
        backgroundColor: '#ffffff',
        scale: 2, // Higher quality
        logging: false,
        useCORS: true,
        allowTaint: true
      })

      // Convert to blob and copy to clipboard
      canvas.toBlob(async (blob) => {
        if (!blob) {
          setCaptureMessage('Failed to create image')
          setTimeout(() => setCaptureMessage(null), 1000)
          return
        }

        try {
          await navigator.clipboard.write([
            new ClipboardItem({ 'image/png': blob })
          ])
          setCaptureMessage('복사완료!')
          setTimeout(() => setCaptureMessage(null), 1000)
        } catch (err) {
          console.error('Failed to copy to clipboard:', err)
          setCaptureMessage('Failed to copy')
          setTimeout(() => setCaptureMessage(null), 1000)
        }
      }, 'image/png')
    } catch (err) {
      console.error('Error capturing graph:', err)
      setCaptureMessage('Error capturing')
      setTimeout(() => setCaptureMessage(null), 1000)
    }
  }

  // Handle mouse drag for panning or image dragging
  // Helper function to find a point at the clicked location
  const findPointAtLocation = (graphX: number, graphY: number, threshold: number = 0.3): string | null => {
    for (const obj of geometryObjects) {
      if (obj.type === 'point' && obj.points.length > 0) {
        const point = obj.points[0]
        const distance = Math.sqrt(Math.pow(point.x - graphX, 2) + Math.pow(point.y - graphY, 2))
        if (distance < threshold) {
          return obj.id
        }
      }
    }
    return null
  }

  // Helper function to find a circle at the clicked location
  const findCircleAtLocation = (graphX: number, graphY: number, threshold: number = 0.5): string | null => {
    for (const obj of geometryObjects) {
      if (obj.type === 'circle' && obj.points.length > 0 && obj.radius !== undefined) {
        const center = obj.points[0]
        const distanceFromCenter = Math.sqrt(Math.pow(center.x - graphX, 2) + Math.pow(center.y - graphY, 2))
        // Check if click is near the circle's perimeter
        const distanceFromPerimeter = Math.abs(distanceFromCenter - obj.radius)
        if (distanceFromPerimeter < threshold) {
          return obj.id
        }
      }
    }
    return null
  }

  // Helper function to find if a point is on or near a line/segment/ray
  const findLineAtLocation = (graphX: number, graphY: number, threshold: number = 0.3): { id: string; t: number } | null => {
    for (const obj of geometryObjects) {
      if (['segment', 'line', 'ray'].includes(obj.type) && obj.points && obj.points.length >= 2) {
        const p1 = obj.points[0]
        const p2 = obj.points[1]

        // Vector from p1 to p2
        const dx = p2.x - p1.x
        const dy = p2.y - p1.y
        const lengthSq = dx * dx + dy * dy

        if (lengthSq === 0) continue // Degenerate line

        // Parameter t for projection: (graphPos - p1) · (p2 - p1) / |p2 - p1|²
        const t = ((graphX - p1.x) * dx + (graphY - p1.y) * dy) / lengthSq

        // For segments, t must be in [0, 1]
        if (obj.type === 'segment' && (t < 0 || t > 1)) continue
        // For rays, t must be >= 0
        if (obj.type === 'ray' && t < 0) continue

        // Calculate closest point on line
        const closestX = p1.x + t * dx
        const closestY = p1.y + t * dy

        // Distance from click to closest point
        const distance = Math.sqrt(Math.pow(graphX - closestX, 2) + Math.pow(graphY - closestY, 2))

        if (distance < threshold) {
          return { id: obj.id, t }
        }
      }
    }
    return null
  }

  // Helper function to find if a point is on or near a circle
  const findCircleForConstraint = (graphX: number, graphY: number, threshold: number = 0.3): { id: string; angle: number } | null => {
    for (const obj of geometryObjects) {
      if (obj.type === 'circle' && obj.points.length > 0 && obj.radius !== undefined) {
        const center = obj.points[0]
        const distanceFromCenter = Math.sqrt(Math.pow(center.x - graphX, 2) + Math.pow(center.y - graphY, 2))
        const distanceFromPerimeter = Math.abs(distanceFromCenter - obj.radius)

        if (distanceFromPerimeter < threshold) {
          // Calculate angle
          const angle = Math.atan2(graphY - center.y, graphX - center.x)
          return { id: obj.id, angle }
        }
      }
    }
    return null
  }

  // Helper function to find if a point is on or near a polygon edge
  const findPolygonAtLocation = (graphX: number, graphY: number, threshold: number = 0.3): { id: string; edgeIndex: number; t: number } | null => {
    for (const obj of geometryObjects) {
      if (obj.type === 'polygon' && obj.points && obj.points.length >= 3) {
        // Check each edge
        for (let i = 0; i < obj.points.length; i++) {
          const p1 = obj.points[i]
          const p2 = obj.points[(i + 1) % obj.points.length]

          const dx = p2.x - p1.x
          const dy = p2.y - p1.y
          const lengthSq = dx * dx + dy * dy

          if (lengthSq === 0) continue

          const t = ((graphX - p1.x) * dx + (graphY - p1.y) * dy) / lengthSq

          if (t < 0 || t > 1) continue // Not on this edge segment

          const closestX = p1.x + t * dx
          const closestY = p1.y + t * dy
          const distance = Math.sqrt(Math.pow(graphX - closestX, 2) + Math.pow(graphY - closestY, 2))

          if (distance < threshold) {
            return { id: obj.id, edgeIndex: i, t }
          }
        }
      }
    }
    return null
  }

  // Calculate text width based on content and font size
  const calculateTextWidth = (text: string, fontSize: number): number => {
    if (!text) return 200

    const lines = text.split('\n')
    const maxLineLength = Math.max(...lines.map(line => line.length))

    // Estimate width: character count * font size factor + padding
    // Using 0.6 as approximation for bold font width ratio
    const estimatedWidth = maxLineLength * fontSize * 0.6 + 30

    return Math.max(200, Math.min(800, estimatedWidth))
  }

  const handleTextInputSubmit = () => {
    if (!textInputValue.trim() || !overlayCanvasRef.current) return

    if (editingTextId) {
      // Update existing text with new content, maxWidth, fontSize, and color
      updateTextObject(editingTextId, {
        text: textInputValue,
        maxWidth: textareaWidth,
        fontSize: editingFontSize,
        color: editingColor
      })
      setEditingTextId(null)
    } else {
      // Add new text
      const canvas = overlayCanvasRef.current
      const rect = canvas.getBoundingClientRect()
      const graphPos = screenToGraph(
        textInputPosition.x,
        textInputPosition.y,
        rect.width,
        rect.height,
        view
      )

      addTextObject({
        text: textInputValue,
        x: graphPos.x,
        y: graphPos.y,
        fontSize: editingFontSize,
        color: editingColor,
        maxWidth: textareaWidth
      })
    }

    setTextInputVisible(false)
    setTextInputValue('')
  }

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = overlayCanvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const canvasX = e.clientX - rect.left
    const canvasY = e.clientY - rect.top

    // Handle text tool (only on canvas click, not text object)
    if (drawingTool === 'text' && !textInputVisible) {
      setTextInputPosition({ x: canvasX, y: canvasY })
      setTextInputVisible(true)
      setTextInputValue('')
      setTextareaWidth(200) // Default width for new text
      setEditingFontSize(20) // Default font size
      setEditingColor(penColor) // Use current pen color
      setTimeout(() => textInputRef.current?.focus(), 10)
      return
    }

    // Note: Geometry object selection is now handled by KonvaDrawingLayer for unified selection

    // If creation state is active, handle geometry object creation
    if (creationState.active && creationState.toolType !== 'none') {
      const graphPos = screenToGraph(canvasX, canvasY, canvas.clientWidth, canvas.clientHeight, view)

      // Handle point creation types
      if (creationState.toolType === 'point-fixed') {
        // Generate label (A, B, C, ...)
        const pointCount = geometryObjects.filter(obj => obj.type === 'point').length
        const label = String.fromCharCode(65 + (pointCount % 26)) // A-Z, then wraps

        // Check if point is on a line, circle, or polygon
        const lineConstraint = findLineAtLocation(graphPos.x, graphPos.y)
        const circleConstraint = findCircleForConstraint(graphPos.x, graphPos.y)
        const polygonConstraint = findPolygonAtLocation(graphPos.x, graphPos.y)

        let constraint: any = undefined
        let constrainedPosition = { x: graphPos.x, y: graphPos.y }

        // Priority: line > circle > polygon
        if (lineConstraint) {
          constraint = {
            objectId: lineConstraint.id,
            type: 'line' as const,
            param: lineConstraint.t
          }
          // Project point onto line
          const line = geometryObjects.find(o => o.id === lineConstraint.id)
          if (line && line.points && line.points.length >= 2) {
            const p1 = line.points[0]
            const p2 = line.points[1]
            const dx = p2.x - p1.x
            const dy = p2.y - p1.y
            constrainedPosition = {
              x: p1.x + lineConstraint.t * dx,
              y: p1.y + lineConstraint.t * dy
            }
          }
        } else if (circleConstraint) {
          constraint = {
            objectId: circleConstraint.id,
            type: 'circle' as const,
            param: circleConstraint.angle
          }
          // Project point onto circle
          const circle = geometryObjects.find(o => o.id === circleConstraint.id)
          if (circle && circle.points && circle.radius !== undefined) {
            const center = circle.points[0]
            constrainedPosition = {
              x: center.x + circle.radius * Math.cos(circleConstraint.angle),
              y: center.y + circle.radius * Math.sin(circleConstraint.angle)
            }
          }
        } else if (polygonConstraint) {
          constraint = {
            objectId: polygonConstraint.id,
            type: 'polygon' as const,
            param: { edgeIndex: polygonConstraint.edgeIndex, t: polygonConstraint.t }
          }
          // Project point onto polygon edge
          const polygon = geometryObjects.find(o => o.id === polygonConstraint.id)
          if (polygon && polygon.points && polygon.points.length > polygonConstraint.edgeIndex) {
            const p1 = polygon.points[polygonConstraint.edgeIndex]
            const p2 = polygon.points[(polygonConstraint.edgeIndex + 1) % polygon.points.length]
            const dx = p2.x - p1.x
            const dy = p2.y - p1.y
            constrainedPosition = {
              x: p1.x + polygonConstraint.t * dx,
              y: p1.y + polygonConstraint.t * dy
            }
          }
        }

        // Create a fixed point at the clicked location (or constrained position)
        addGeometryObject({
          type: 'point',
          subType: 'point-fixed',
          points: [constrainedPosition],
          color: constraint ? '#ff6b6b' : '#4ecdc4', // Red if constrained, cyan if free
          strokeWidth: 4,
          visible: true,
          selected: false,
          label: label,
          scale: 1, // Initialize scale for constant visual size
          constraint: constraint,
        })

        // Don't finish creation - keep the tool active to place more points
        return
      }

      // Handle midpoint creation (requires selecting two existing points)
      if (creationState.toolType === 'point-midpoint') {
        // First check if a circle was clicked
        const clickedCircleId = findCircleAtLocation(graphPos.x, graphPos.y)

        if (clickedCircleId) {
          // Create a point at the circle's center
          const circle = geometryObjects.find(obj => obj.id === clickedCircleId)
          if (circle && circle.points[0]) {
            const centerX = circle.points[0].x
            const centerY = circle.points[0].y

            // Generate label
            const pointCount = geometryObjects.filter(obj => obj.type === 'point').length
            const label = String.fromCharCode(65 + (pointCount % 26))

            // Create fixed point at circle center
            addGeometryObject({
              type: 'point',
              subType: 'point-fixed',
              points: [{ x: centerX, y: centerY }],
              color: '#4ecdc4',
              strokeWidth: 4,
              visible: true,
              selected: false,
              label: label,
              scale: 1,
            })

            // Finish creation and keep tool active
            finishCreation()
          }
          return
        }

        const clickedPointId = findPointAtLocation(graphPos.x, graphPos.y)

        if (clickedPointId) {
          // Check if we already selected this point
          if (creationState.tempPoints.includes(clickedPointId)) {
            return // Can't select the same point twice
          }

          // Add the selected point to tempPoints
          addCreationPoint(clickedPointId)

          // Highlight the selected point
          updateGeometryObject(clickedPointId, { selected: true })

          // If we have two points selected, create the midpoint
          if (creationState.tempPoints.length === 1) {
            // We now have 2 points (1 existing + 1 just added)
            const point1Id = creationState.tempPoints[0]
            const point2Id = clickedPointId

            const point1 = geometryObjects.find(obj => obj.id === point1Id)
            const point2 = geometryObjects.find(obj => obj.id === point2Id)

            if (point1 && point2 && point1.points[0] && point2.points[0]) {
              const midX = (point1.points[0].x + point2.points[0].x) / 2
              const midY = (point1.points[0].y + point2.points[0].y) / 2

              // Generate label
              const pointCount = geometryObjects.filter(obj => obj.type === 'point').length
              const label = String.fromCharCode(65 + (pointCount % 26))

              // Create midpoint with dependencies
              const newMidpointId = addGeometryObject({
                type: 'point',
                subType: 'point-midpoint',
                points: [{ x: midX, y: midY }],
                color: '#ff6b6b',
                strokeWidth: 4,
                visible: true,
                selected: false,
                label: label,
                scale: 1,
                dependencies: [point1Id, point2Id],
                ratio: { m: 1, n: 1 }, // Default to midpoint (1:1)
              })

              // Update parent points to track this midpoint as a dependent
              updateGeometryObject(point1Id, {
                dependents: [...(point1.dependents || []), newMidpointId],
                selected: false, // Deselect after creation
              })
              updateGeometryObject(point2Id, {
                dependents: [...(point2.dependents || []), newMidpointId],
                selected: false, // Deselect after creation
              })

              // Finish creation and keep tool active for creating more midpoints
              finishCreation()
            }
          }
          return
        }
      }

      // Handle line creation types (click-drag-release interaction)
      if (creationState.toolType === 'line-segment' ||
          creationState.toolType === 'line-infinite' ||
          creationState.toolType === 'line-ray') {
        let clickedPointId = findPointAtLocation(graphPos.x, graphPos.y)

        // If no existing point was clicked, create a new point at the clicked location
        if (!clickedPointId) {
          const pointCount = geometryObjects.filter(obj => obj.type === 'point').length
          const label = String.fromCharCode(65 + (pointCount % 26))

          clickedPointId = addGeometryObject({
            type: 'point',
            subType: 'point-fixed',
            points: [{ x: graphPos.x, y: graphPos.y }],
            color: '#4ecdc4',
            strokeWidth: 4,
            visible: true,
            selected: true, // Select first point
            label: label,
            scale: 1,
          })
        } else {
          // Highlight existing point
          updateGeometryObject(clickedPointId, { selected: true })
        }

        // Start dragging to create line
        setIsCreatingGeometry(true)
        creationDragRef.current = {
          firstPointId: clickedPointId,
          currentPos: graphPos,
        }

        // Store the first point in tempPoints
        addCreationPoint(clickedPointId)

        return
      }

      // Handle circle creation types (click-drag-release interaction)
      if (creationState.toolType === 'circle-center-radius') {
        let clickedPointId = findPointAtLocation(graphPos.x, graphPos.y)

        // If no existing point was clicked, create a new point at the clicked location
        if (!clickedPointId) {
          const pointCount = geometryObjects.filter(obj => obj.type === 'point').length
          const label = String.fromCharCode(65 + (pointCount % 26))

          clickedPointId = addGeometryObject({
            type: 'point',
            subType: 'point-fixed',
            points: [{ x: graphPos.x, y: graphPos.y }],
            color: '#4ecdc4',
            strokeWidth: 4,
            visible: true,
            selected: true, // Select first point
            label: label,
            scale: 1,
          })
        } else {
          // Highlight existing point
          updateGeometryObject(clickedPointId, { selected: true })
        }

        // Start dragging to create circle
        setIsCreatingGeometry(true)
        creationDragRef.current = {
          firstPointId: clickedPointId,
          currentPos: graphPos,
        }

        // Store the first point (center) in tempPoints
        addCreationPoint(clickedPointId)

        return
      }

      // Handle circle-diameter (click-drag-release interaction)
      if (creationState.toolType === 'circle-diameter') {
        let clickedPointId = findPointAtLocation(graphPos.x, graphPos.y)

        // If no existing point was clicked, create a new point at the clicked location
        if (!clickedPointId) {
          const pointCount = geometryObjects.filter(obj => obj.type === 'point').length
          const label = String.fromCharCode(65 + (pointCount % 26))

          clickedPointId = addGeometryObject({
            type: 'point',
            subType: 'point-fixed',
            points: [{ x: graphPos.x, y: graphPos.y }],
            color: '#4ecdc4',
            strokeWidth: 4,
            visible: true,
            selected: true, // Select first point
            label: label,
            scale: 1,
          })
        } else {
          // Highlight existing point
          updateGeometryObject(clickedPointId, { selected: true })
        }

        // Start dragging to create circle
        setIsCreatingGeometry(true)
        creationDragRef.current = {
          firstPointId: clickedPointId,
          currentPos: graphPos,
        }

        // Store the first point (first diameter endpoint) in tempPoints
        addCreationPoint(clickedPointId)

        return
      }

      // Handle regular polygons (click-drag-release interaction)
      if (creationState.toolType === 'polygon-regular') {
        let clickedPointId = findPointAtLocation(graphPos.x, graphPos.y)

        // If no existing point was clicked, create a new point at the clicked location
        if (!clickedPointId) {
          const pointCount = geometryObjects.filter(obj => obj.type === 'point').length
          const label = String.fromCharCode(65 + (pointCount % 26))

          clickedPointId = addGeometryObject({
            type: 'point',
            subType: 'point-fixed',
            points: [{ x: graphPos.x, y: graphPos.y }],
            color: '#4ecdc4',
            strokeWidth: 4,
            visible: true,
            selected: true, // Select center point
            label: label,
            scale: 1,
          })
        } else {
          // Highlight existing point
          updateGeometryObject(clickedPointId, { selected: true })
        }

        // Start dragging to create regular polygon
        setIsCreatingGeometry(true)
        creationDragRef.current = {
          firstPointId: clickedPointId,
          currentPos: graphPos,
        }

        // Store the center point in tempPoints
        addCreationPoint(clickedPointId)

        return
      }

      // Handle rectangle, square, parallelogram, rhombus, kite, right-triangle (click-drag-release interaction)
      if (creationState.toolType === 'polygon-rectangle' ||
          creationState.toolType === 'polygon-square' ||
          creationState.toolType === 'polygon-parallelogram' ||
          creationState.toolType === 'polygon-rhombus' ||
          creationState.toolType === 'polygon-kite' ||
          creationState.toolType === 'polygon-right-triangle') {
        let clickedPointId = findPointAtLocation(graphPos.x, graphPos.y)

        // If no existing point was clicked, create a new point at the clicked location
        if (!clickedPointId) {
          const pointCount = geometryObjects.filter(obj => obj.type === 'point').length
          const label = String.fromCharCode(65 + (pointCount % 26))

          clickedPointId = addGeometryObject({
            type: 'point',
            subType: 'point-fixed',
            points: [{ x: graphPos.x, y: graphPos.y }],
            color: '#4ecdc4',
            strokeWidth: 4,
            visible: true,
            selected: true, // Select first point
            label: label,
            scale: 1,
          })
        } else {
          // Highlight existing point
          updateGeometryObject(clickedPointId, { selected: true })
        }

        // Start dragging to create polygon
        setIsCreatingGeometry(true)
        creationDragRef.current = {
          firstPointId: clickedPointId,
          currentPos: graphPos,
        }

        // Store the first point in tempPoints
        addCreationPoint(clickedPointId)

        return
      }

      // Handle circle-three-points (click-click-drag interaction)
      if (creationState.toolType === 'circle-three-points') {
        // First two clicks: create/select points
        if (creationState.tempPoints.length < 2) {
          let clickedPointId = findPointAtLocation(graphPos.x, graphPos.y)

          // If no existing point was clicked, create a new point at the clicked location
          if (!clickedPointId) {
            const pointCount = geometryObjects.filter(obj => obj.type === 'point').length
            const label = String.fromCharCode(65 + (pointCount % 26))

            clickedPointId = addGeometryObject({
              type: 'point',
              subType: 'point-fixed',
              points: [{ x: graphPos.x, y: graphPos.y }],
              color: '#4ecdc4',
              strokeWidth: 4,
              visible: true,
              selected: true,
              label: label,
              scale: 1,
            })
          } else {
            // Check if we already selected this point
            if (creationState.tempPoints.includes(clickedPointId)) {
              return // Can't select the same point twice
            }
            // Highlight existing point
            updateGeometryObject(clickedPointId, { selected: true })
          }

          // Add the selected point to tempPoints
          addCreationPoint(clickedPointId)
        } else {
          // Third click: start dragging to position third point
          // Don't create the point yet, wait for mouse up
          setIsCreatingGeometry(true)
          creationDragRef.current = {
            firstPointId: '', // Not used for this
            currentPos: graphPos,
          }
        }

        return
      }

      // TODO: Handle other creation types (slider)
      // For now, just return to prevent default panning behavior
      return
    }

    // Legacy: If geometry tool is active, handle geometry object creation
    if (geometryTool !== 'none' && geometryTool !== 'select') {
      const graphPos = screenToGraph(canvasX, canvasY, canvas.clientWidth, canvas.clientHeight, view)

      if (geometryTool === 'point') {
        // Generate label (A, B, C, ...)
        const pointCount = geometryObjects.filter(obj => obj.type === 'point').length
        const label = String.fromCharCode(65 + (pointCount % 26)) // A-Z, then wraps

        // Create a point at the clicked location
        addGeometryObject({
          type: 'point',
          points: [{ x: graphPos.x, y: graphPos.y }],
          color: '#000000',
          strokeWidth: 4,
          visible: true,
          selected: false,
          label: label,
          scale: 1, // Initialize scale for constant visual size
        })
        return
      }

      if (geometryTool === 'polygon') {
        // Check if clicking near the first point to close the polygon
        if (creationState.tempPoints.length >= 3) {
          const firstPointId = creationState.tempPoints[0]
          const firstPoint = geometryObjects.find(obj => obj.id === firstPointId)

          if (firstPoint && firstPoint.points[0]) {
            const firstPos = firstPoint.points[0]
            const distance = Math.sqrt(
              Math.pow(graphPos.x - firstPos.x, 2) +
              Math.pow(graphPos.y - firstPos.y, 2)
            )

            // If clicking near first point (within 0.3 units), close the polygon
            if (distance < 0.3) {
              // Create polygon with all points
              const polygonPoints = creationState.tempPoints.map(pointId => {
                const point = geometryObjects.find(obj => obj.id === pointId)
                return point?.points[0]
              }).filter(p => p !== undefined) as GeometryPoint[]

              if (polygonPoints.length >= 3) {
                const newPolygonId = addGeometryObject({
                  type: 'polygon',
                  points: polygonPoints,
                  color: '#ABD5B1',
                  strokeWidth: 4,
                  visible: true,
                  selected: false,
                  scale: 1,
                  dependencies: creationState.tempPoints,
                })

                // Update all points to mark polygon as dependent
                creationState.tempPoints.forEach((pointId, index) => {
                  const point = geometryObjects.find(obj => obj.id === pointId)
                  if (point) {
                    updateGeometryObject(pointId, {
                      dependents: [...(point.dependents || []), newPolygonId],
                      selected: false,
                      // Reset first point color to default
                      color: index === 0 ? '#4ecdc4' : point.color,
                    })
                  }
                })

                // Clear creation state
                finishCreation()
              }
              return
            }
          }
        }

        // Add new point to polygon
        let clickedPointId = findPointAtLocation(graphPos.x, graphPos.y)

        if (!clickedPointId) {
          const pointCount = geometryObjects.filter(obj => obj.type === 'point').length
          const label = String.fromCharCode(65 + (pointCount % 26))

          // First point should be orange to indicate start
          const isFirstPoint = creationState.tempPoints.length === 0

          // Check if point is on a line, circle, or polygon
          const lineConstraint = findLineAtLocation(graphPos.x, graphPos.y)
          const circleConstraint = findCircleForConstraint(graphPos.x, graphPos.y)
          const polygonConstraint = findPolygonAtLocation(graphPos.x, graphPos.y)

          let constraint: any = undefined
          let constrainedPosition = { x: graphPos.x, y: graphPos.y }

          // Priority: line > circle > polygon
          if (lineConstraint) {
            constraint = {
              objectId: lineConstraint.id,
              type: 'line' as const,
              param: lineConstraint.t
            }
            // Project point onto line
            const line = geometryObjects.find(o => o.id === lineConstraint.id)
            if (line && line.points && line.points.length >= 2) {
              const p1 = line.points[0]
              const p2 = line.points[1]
              const dx = p2.x - p1.x
              const dy = p2.y - p1.y
              constrainedPosition = {
                x: p1.x + lineConstraint.t * dx,
                y: p1.y + lineConstraint.t * dy
              }
            }
          } else if (circleConstraint) {
            constraint = {
              objectId: circleConstraint.id,
              type: 'circle' as const,
              param: circleConstraint.angle
            }
            // Project point onto circle
            const circle = geometryObjects.find(o => o.id === circleConstraint.id)
            if (circle && circle.points && circle.radius !== undefined) {
              const center = circle.points[0]
              constrainedPosition = {
                x: center.x + circle.radius * Math.cos(circleConstraint.angle),
                y: center.y + circle.radius * Math.sin(circleConstraint.angle)
              }
            }
          } else if (polygonConstraint) {
            constraint = {
              objectId: polygonConstraint.id,
              type: 'polygon' as const,
              param: { edgeIndex: polygonConstraint.edgeIndex, t: polygonConstraint.t }
            }
            // Project point onto polygon edge
            const polygon = geometryObjects.find(o => o.id === polygonConstraint.id)
            if (polygon && polygon.points && polygon.points.length > polygonConstraint.edgeIndex) {
              const p1 = polygon.points[polygonConstraint.edgeIndex]
              const p2 = polygon.points[(polygonConstraint.edgeIndex + 1) % polygon.points.length]
              const dx = p2.x - p1.x
              const dy = p2.y - p1.y
              constrainedPosition = {
                x: p1.x + polygonConstraint.t * dx,
                y: p1.y + polygonConstraint.t * dy
              }
            }
          }

          // Determine color: orange for first point, red for constrained, cyan for free
          const pointColor = isFirstPoint ? '#ff9800' : (constraint ? '#ff6b6b' : '#4ecdc4')

          clickedPointId = addGeometryObject({
            type: 'point',
            subType: 'point-fixed',
            points: [constrainedPosition],
            color: pointColor,
            strokeWidth: 4,
            visible: true,
            selected: true,
            label: label,
            scale: 1,
            constraint: constraint,
          })
        } else {
          // Check if we already selected this point
          if (creationState.tempPoints.includes(clickedPointId)) {
            return // Can't select the same point twice
          }
          // Highlight existing point
          updateGeometryObject(clickedPointId, { selected: true })
        }

        // Add point to tempPoints
        addCreationPoint(clickedPointId)

        return
      }

      // TODO: Handle other geometry tools (segment, line, circle)
      // For now, just return to prevent default panning behavior
      return
    }

    // If select tool is active, handle selection
    if (drawingTool === 'select') {
      const isShiftPressed = e.shiftKey

      // Check if clicking on an image handle first
      const imageInfo = getImageAtPoint(canvasX, canvasY)
      if (imageInfo && imageInfo.handle) {
        // Clicking on a handle (delete, rotate, resize) - let it fall through to image manipulation logic
        // Don't return here, continue to the image manipulation code below
      } else {
        // Check if clicking on a stroke
        const strokeId = getStrokeAtPoint(canvasX, canvasY)
        if (strokeId) {
          const stroke = drawings.find(s => s.id === strokeId)
          if (stroke) {
            if (isShiftPressed) {
              // Multi-select: toggle this stroke
              updateDrawing(strokeId, { selected: !stroke.selected })
            } else {
              // Single select: deselect all others, select this one
              deselectAllImages()
              drawings.forEach(s => {
                if (s.id === strokeId) {
                  updateDrawing(s.id, { selected: true })
                } else if (s.selected) {
                  updateDrawing(s.id, { selected: false })
                }
              })
            }
          }
          return
        }

        // Check if clicking on an image (not a handle)
        if (imageInfo) {
          const image = images.find(img => img.id === imageInfo.id)
          if (image) {
            if (isShiftPressed) {
              // Multi-select: toggle this image
              updateImage(imageInfo.id, { selected: !image.selected })
              if (!image.selected) {
                setSelectedImageId(imageInfo.id)
              }
              return
            } else {
              // If image is already selected, allow dragging (fall through to image drag logic)
              if (image.selected) {
                // Don't return, continue to image drag logic below
              } else {
                // Single select: deselect all others, select this one
                deselectAllStrokes()
                images.forEach(img => {
                  if (img.id === imageInfo.id) {
                    updateImage(img.id, { selected: true })
                    setSelectedImageId(img.id)
                  } else if (img.selected) {
                    updateImage(img.id, { selected: false })
                  }
                })
                return
              }
            }
          }
        } else {
          // Clicking on empty space: deselect all
          if (!isShiftPressed) {
            deselectAllImages()
            deselectAllStrokes()
          }
          return
        }
      }
    }

    // Drawing tools (pen, highlighter, eraser, select) are now handled by KonvaDrawingLayer
    if (drawingTool === 'pen' || drawingTool === 'highlighter' || drawingTool === 'eraser' || drawingTool === 'select') {
      // Pass through to Konva layer
      return
    }

    // Check if clicking on an image or resize handle
    const imageInfo = getImageAtPoint(canvasX, canvasY)
    if (imageInfo) {
      const image = images.find(img => img.id === imageInfo.id)
      if (!image) return

      // Handle delete button click
      if (imageInfo.handle === 'delete') {
        removeImage(imageInfo.id)
        setSelectedImageId(null)
        return
      }

      setSelectedImageId(imageInfo.id)

      if (imageInfo.handle) {
        // Handle rotation
        if (imageInfo.handle === 'rotate') {
          const initialRotation = image.rotation || 0
          const centerX = image.transform.e
          const centerY = image.transform.f

          // Calculate initial angle from center to mouse
          const startAngle = Math.atan2(canvasY - centerY, canvasX - centerX)

          let renderFrame: number | null = null

          const handleMouseMove = (e: MouseEvent) => {
            const currentX = e.clientX - rect.left
            const currentY = e.clientY - rect.top

            // Calculate current angle from center to mouse
            const currentAngle = Math.atan2(currentY - centerY, currentX - centerX)

            // Calculate rotation delta
            const deltaAngle = currentAngle - startAngle
            const newRotation = initialRotation + deltaAngle

            // Update dragging ref
            draggingImageRef.current = { id: imageInfo.id, transform: image.transform, rotation: newRotation }

            // Throttle rendering with requestAnimationFrame
            if (renderFrame === null) {
              renderFrame = requestAnimationFrame(() => {
                renderOverlayLayer()
                renderFrame = null
              })
            }
          }

          const handleMouseUp = () => {
            // Cancel any pending render
            if (renderFrame !== null) {
              cancelAnimationFrame(renderFrame)
              renderFrame = null
            }

            // Now update store once at the end
            if (draggingImageRef.current && draggingImageRef.current.rotation !== undefined) {
              updateImage(draggingImageRef.current.id, { rotation: draggingImageRef.current.rotation })
              draggingImageRef.current = null
            }

            // Final render
            renderOverlayLayer()

            window.removeEventListener('mousemove', handleMouseMove)
            window.removeEventListener('mouseup', handleMouseUp)
          }

          window.addEventListener('mousemove', handleMouseMove)
          window.addEventListener('mouseup', handleMouseUp)
          return
        }

        // Start resize - now using screen coordinates
        const initialTransform = new DOMMatrix(image.transform)
        const initialRotation = image.rotation || 0
        const startScreenX = e.clientX - rect.left
        const startScreenY = e.clientY - rect.top

        let renderFrame: number | null = null

        const handleMouseMove = (e: MouseEvent) => {
          const currentScreenX = e.clientX - rect.left
          const currentScreenY = e.clientY - rect.top

          // Calculate deltas in screen space
          const screenDx = currentScreenX - startScreenX
          const screenDy = currentScreenY - startScreenY

          // For rotated images, transform delta to image-local coordinates
          const localDx = screenDx * Math.cos(-initialRotation) - screenDy * Math.sin(-initialRotation)
          const localDy = screenDx * Math.sin(-initialRotation) + screenDy * Math.cos(-initialRotation)

          const newTransform = new DOMMatrix(initialTransform)

          // Helper to rotate a vector by the image rotation
          const rotateVector = (dx: number, dy: number) => {
            return {
              x: dx * Math.cos(initialRotation) - dy * Math.sin(initialRotation),
              y: dx * Math.sin(initialRotation) + dy * Math.cos(initialRotation)
            }
          }

          // Calculate new size and position based on which handle is being dragged
          if (imageInfo.handle === 'se') {
            // Bottom-right: top-left corner is fixed (in local coords)
            const newWidth = Math.max(10, initialTransform.a + localDx)
            const newHeight = Math.max(10, initialTransform.d + localDy)

            // Local offset from old center to new center
            const centerOffsetLocal = { x: (localDx) / 2, y: (localDy) / 2 }
            const centerOffsetScreen = rotateVector(centerOffsetLocal.x, centerOffsetLocal.y)

            newTransform.a = newWidth
            newTransform.d = newHeight
            newTransform.e = initialTransform.e + centerOffsetScreen.x
            newTransform.f = initialTransform.f + centerOffsetScreen.y
          } else if (imageInfo.handle === 'sw') {
            // Bottom-left: top-right corner is fixed (in local coords)
            const newWidth = Math.max(10, initialTransform.a - localDx)
            const newHeight = Math.max(10, initialTransform.d + localDy)

            const centerOffsetLocal = { x: (-localDx) / 2, y: (localDy) / 2 }
            const centerOffsetScreen = rotateVector(centerOffsetLocal.x, centerOffsetLocal.y)

            newTransform.a = newWidth
            newTransform.d = newHeight
            newTransform.e = initialTransform.e + centerOffsetScreen.x
            newTransform.f = initialTransform.f + centerOffsetScreen.y
          } else if (imageInfo.handle === 'ne') {
            // Top-right: bottom-left corner is fixed (in local coords)
            const newWidth = Math.max(10, initialTransform.a + localDx)
            const newHeight = Math.max(10, initialTransform.d - localDy)

            const centerOffsetLocal = { x: (localDx) / 2, y: (-localDy) / 2 }
            const centerOffsetScreen = rotateVector(centerOffsetLocal.x, centerOffsetLocal.y)

            newTransform.a = newWidth
            newTransform.d = newHeight
            newTransform.e = initialTransform.e + centerOffsetScreen.x
            newTransform.f = initialTransform.f + centerOffsetScreen.y
          } else if (imageInfo.handle === 'nw') {
            // Top-left: bottom-right corner is fixed (in local coords)
            const newWidth = Math.max(10, initialTransform.a - localDx)
            const newHeight = Math.max(10, initialTransform.d - localDy)

            const centerOffsetLocal = { x: (-localDx) / 2, y: (-localDy) / 2 }
            const centerOffsetScreen = rotateVector(centerOffsetLocal.x, centerOffsetLocal.y)

            newTransform.a = newWidth
            newTransform.d = newHeight
            newTransform.e = initialTransform.e + centerOffsetScreen.x
            newTransform.f = initialTransform.f + centerOffsetScreen.y
          } else if (imageInfo.handle === 'n') {
            // Top edge: only height changes, bottom edge is fixed
            const newHeight = Math.max(10, initialTransform.d - localDy)

            // When dragging north handle up (negative localDy), height increases and center moves up (negative y)
            const centerOffsetLocal = { x: 0, y: -localDy / 2 }
            const centerOffsetScreen = rotateVector(centerOffsetLocal.x, centerOffsetLocal.y)

            newTransform.d = newHeight
            newTransform.e = initialTransform.e + centerOffsetScreen.x
            newTransform.f = initialTransform.f + centerOffsetScreen.y
          } else if (imageInfo.handle === 's') {
            // Bottom edge: only height changes, top edge is fixed
            const newHeight = Math.max(10, initialTransform.d + localDy)

            // When dragging south handle down (positive localDy), height increases and center moves down (positive y)
            const centerOffsetLocal = { x: 0, y: localDy / 2 }
            const centerOffsetScreen = rotateVector(centerOffsetLocal.x, centerOffsetLocal.y)

            newTransform.d = newHeight
            newTransform.e = initialTransform.e + centerOffsetScreen.x
            newTransform.f = initialTransform.f + centerOffsetScreen.y
          } else if (imageInfo.handle === 'e') {
            // Right edge: only width changes, left edge is fixed
            const newWidth = Math.max(10, initialTransform.a + localDx)

            // When dragging east handle right (positive localDx), width increases and center moves right (positive x)
            const centerOffsetLocal = { x: localDx / 2, y: 0 }
            const centerOffsetScreen = rotateVector(centerOffsetLocal.x, centerOffsetLocal.y)

            newTransform.a = newWidth
            newTransform.e = initialTransform.e + centerOffsetScreen.x
            newTransform.f = initialTransform.f + centerOffsetScreen.y
          } else if (imageInfo.handle === 'w') {
            // Left edge: only width changes, right edge is fixed
            const newWidth = Math.max(10, initialTransform.a - localDx)

            // When dragging west handle left (negative localDx), width increases and center moves left (negative x)
            const centerOffsetLocal = { x: -localDx / 2, y: 0 }
            const centerOffsetScreen = rotateVector(centerOffsetLocal.x, centerOffsetLocal.y)

            newTransform.a = newWidth
            newTransform.e = initialTransform.e + centerOffsetScreen.x
            newTransform.f = initialTransform.f + centerOffsetScreen.y
          }

          // Update dragging ref
          draggingImageRef.current = { id: imageInfo.id, transform: newTransform }

          // Throttle rendering with requestAnimationFrame
          if (renderFrame === null) {
            renderFrame = requestAnimationFrame(() => {
              renderOverlayLayer()
              renderFrame = null
            })
          }
        }

        const handleMouseUp = () => {
          // Cancel any pending render
          if (renderFrame !== null) {
            cancelAnimationFrame(renderFrame)
            renderFrame = null
          }

          // Now update store once at the end
          if (draggingImageRef.current) {
            updateImage(draggingImageRef.current.id, { transform: draggingImageRef.current.transform })
            draggingImageRef.current = null
          }

          // Final render
          renderOverlayLayer()

          window.removeEventListener('mousemove', handleMouseMove)
          window.removeEventListener('mouseup', handleMouseUp)
        }

        window.addEventListener('mousemove', handleMouseMove)
        window.addEventListener('mouseup', handleMouseUp)
      } else {
        // Start image drag - now using screen coordinates
        setIsDraggingImage(true)
        const startScreenX = e.clientX - rect.left
        const startScreenY = e.clientY - rect.top
        const initialTransform = new DOMMatrix(image.transform)

        let renderFrame: number | null = null

        const handleMouseMove = (e: MouseEvent) => {
          const currentScreenX = e.clientX - rect.left
          const currentScreenY = e.clientY - rect.top

          const dx = currentScreenX - startScreenX
          const dy = currentScreenY - startScreenY

          const newTransform = new DOMMatrix(initialTransform)
          newTransform.e = initialTransform.e + dx
          newTransform.f = initialTransform.f + dy

          // Update dragging ref
          draggingImageRef.current = { id: imageInfo.id, transform: newTransform }

          // Throttle rendering with requestAnimationFrame for smooth 60fps
          if (renderFrame === null) {
            renderFrame = requestAnimationFrame(() => {
              renderOverlayLayer()
              renderFrame = null
            })
          }
        }

        const handleMouseUp = () => {
          setIsDraggingImage(false)

          // Cancel any pending render
          if (renderFrame !== null) {
            cancelAnimationFrame(renderFrame)
            renderFrame = null
          }

          // Now update store once at the end
          if (draggingImageRef.current) {
            updateImage(draggingImageRef.current.id, { transform: draggingImageRef.current.transform })
            draggingImageRef.current = null
          }

          // Final render with updated store
          renderOverlayLayer()

          window.removeEventListener('mousemove', handleMouseMove)
          window.removeEventListener('mouseup', handleMouseUp)
        }

        window.addEventListener('mousemove', handleMouseMove)
        window.addEventListener('mouseup', handleMouseUp)
      }
      return
    }

    // Clear image selection if clicking on empty space
    setSelectedImageId(null)

    const startX = e.clientX
    const startY = e.clientY
    let lastX = e.clientX
    let lastY = e.clientY

    const handleMouseMove = (e: MouseEvent) => {
      // Calculate total movement from start
      const totalDx = e.clientX - startX
      const totalDy = e.clientY - startY
      const totalMovement = Math.sqrt(totalDx * totalDx + totalDy * totalDy)

      // Only start panning if moved more than 5 pixels
      if (totalMovement > 5) {
        setIsPanning(true)

        const dx = (e.clientX - lastX) / view.scale
        const dy = -(e.clientY - lastY) / view.scale // Flip Y

        useStore.getState().pan(dx, dy)
      }

      lastX = e.clientX
      lastY = e.clientY
    }

    const handleMouseUp = (e: MouseEvent) => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)

      setIsPanning(false)

      // Calculate total movement from start
      const totalDx = e.clientX - startX
      const totalDy = e.clientY - startY
      const totalMovement = Math.sqrt(totalDx * totalDx + totalDy * totalDy)

      // If moved less than 5 pixels, treat as a click to find intersection or intercept
      if (totalMovement < 5) {
        const rect = canvas.getBoundingClientRect()
        const clickX = e.clientX - rect.left
        const clickY = e.clientY - rect.top

        const graphCoords = screenToGraph(clickX, clickY, canvas.clientWidth, canvas.clientHeight, view)

        // First, check if we clicked on an existing point to remove it
        const clickRadius = 20 / view.scale // Screen pixels to graph units
        const clickedPointIndex = graphPoints.findIndex(point => {
          const dist = Math.sqrt(
            Math.pow(point.x - graphCoords.x, 2) + Math.pow(point.y - graphCoords.y, 2)
          )
          return dist < clickRadius
        })

        if (clickedPointIndex !== -1) {
          // Remove the clicked point
          removeGraphPoint(clickedPointIndex)
          return
        }

        // Find intersections near the click point
        // Exclude calculator mode expressions (no variables)
        const cartesianExprs = expressions.filter(expr => {
          if (expr.kind !== 'cartesian' || !expr.visible) return false
          if (!expr.input || expr.input.trim() === '') return false
          // Check if expression contains variables
          const hasVariables = /[xyt]|theta/.test(expr.input.toLowerCase())
          return hasVariables
        })
        const implicitExprs = expressions.filter(expr => {
          if (expr.kind !== 'implicit' || !expr.visible) return false
          if (!expr.input || expr.input.trim() === '') return false
          // Check if expression contains variables
          const hasVariables = /[xyt]|theta/.test(expr.input.toLowerCase())
          return hasVariables
        })

        let pointToAdd: { x: number; y: number; label: string } | null = null

        // Helper function to find closest point on implicit function contours
        const findClosestPointOnContours = (exprId: string, clickPoint: { x: number; y: number }, maxDist: number) => {
          const contours = contoursDataRef.current.get(exprId)
          if (!contours) return null

          let closestPoint: { x: number; y: number } | null = null
          let minDist = maxDist

          for (const segment of contours) {
            for (const point of segment) {
              const dist = Math.sqrt(
                Math.pow(point.x - clickPoint.x, 2) + Math.pow(point.y - clickPoint.y, 2)
              )
              if (dist < minDist) {
                minDist = dist
                closestPoint = point
              }
            }
          }

          return closestPoint
        }

        // Try to find intercepts on implicit functions (not arbitrary points)
        // Allow clicking within 30 pixels from the actual point (converted to graph coordinates)
        const maxDist = 30 / view.scale
        const candidatePoints: Array<{ x: number; y: number; label: string; distance: number }> = []

        // Helper function to add point only if not already in candidates
        const addCandidate = (x: number, y: number, distance: number) => {
          // Check if this point is already in candidates (within 0.0001 tolerance)
          const alreadyInCandidates = candidatePoints.some(p =>
            Math.abs(p.x - x) < 0.0001 && Math.abs(p.y - y) < 0.0001
          )
          if (!alreadyInCandidates) {
            candidatePoints.push({ x, y, label: `(${x}, ${y})`, distance })
          }
        }

        for (const expr of implicitExprs) {
          // Check for vertical and horizontal lines
          const verticalLineMatch = expr.input.match(/^\(x\)\s*-\s*\((.+)\)$/)
          const horizontalLineMatch = expr.input.match(/^\(y\)\s*-\s*\((.+)\)$/)

          // Handle vertical line x=c with x-axis (y=0)
          if (verticalLineMatch) {
            try {
              const xValueExpr = verticalLineMatch[1]
              const xValue = evaluateExpression(compileExpression(xValueExpr), { x: 0, y: 0 })

              if (isFinite(xValue)) {
                // Check if click is near x-axis (y≈0) and near this x value
                if (Math.abs(graphCoords.y) < maxDist && Math.abs(graphCoords.x - xValue) < maxDist) {
                  const dist = Math.sqrt(
                    Math.pow(xValue - graphCoords.x, 2) + Math.pow(0 - graphCoords.y, 2)
                  )
                  addCandidate(xValue, 0, dist)
                }
              }
            } catch (e) {
              // Ignore
            }
            continue
          }

          // Handle horizontal line y=c with y-axis (x=0)
          if (horizontalLineMatch) {
            try {
              const yValueExpr = horizontalLineMatch[1]
              const yValue = evaluateExpression(compileExpression(yValueExpr), { x: 0, y: 0 })

              if (isFinite(yValue)) {
                // Check if click is near y-axis (x≈0) and near this y value
                if (Math.abs(graphCoords.x) < maxDist && Math.abs(graphCoords.y - yValue) < maxDist) {
                  const dist = Math.sqrt(
                    Math.pow(0 - graphCoords.x, 2) + Math.pow(yValue - graphCoords.y, 2)
                  )
                  addCandidate(0, yValue, dist)
                }
              }
            } catch (e) {
              // Ignore
            }
            continue
          }

          const closest = findClosestPointOnContours(expr.id, graphCoords, maxDist)
          if (closest) {
            const x = Math.round(closest.x * 10000) / 10000
            const y = Math.round(closest.y * 10000) / 10000

            // ONLY accept if it's an intercept
            if (Math.abs(closest.y) < 0.1) {
              const dist = Math.sqrt(Math.pow(closest.x - graphCoords.x, 2) + Math.pow(0 - graphCoords.y, 2))
              addCandidate(x, 0, dist)
            } else if (Math.abs(closest.x) < 0.1) {
              const dist = Math.sqrt(Math.pow(0 - graphCoords.x, 2) + Math.pow(closest.y - graphCoords.y, 2))
              addCandidate(0, y, dist)
            }
            // Don't add arbitrary points on the curve - only intercepts
          }
        }

        // Try to find intersections between implicit and cartesian functions
        if (implicitExprs.length > 0 && cartesianExprs.length > 0) {
          // Check for intersections between implicit and cartesian
          for (const implicitExpr of implicitExprs) {
            // Check if this is a vertical line (x = constant form)
            console.log('Checking implicit expr:', implicitExpr.input)
            const verticalLineMatch = implicitExpr.input.match(/^\(x\)\s*-\s*\((.+)\)$/)
            const horizontalLineMatch = implicitExpr.input.match(/^\(y\)\s*-\s*\((.+)\)$/)

            if (verticalLineMatch) {
              // This is a vertical line: x = value
              console.log('Matched as vertical line! Extracted:', verticalLineMatch[1])
              try {
                const xValueExpr = verticalLineMatch[1]
                const xValue = evaluateExpression(compileExpression(xValueExpr), { x: 0, y: 0 })
                console.log('Evaluated x value:', xValue)

                if (isFinite(xValue)) {
                  // Find intersections with cartesian functions at this x value
                  for (const cartesianExpr of cartesianExprs) {
                    try {
                      const compiled = compileExpression(cartesianExpr.input)
                      const y = evaluateExpression(compiled, { x: xValue })
                      console.log(`Intersection at x=${xValue}: y=${y}`)

                      if (isFinite(y)) {
                        const dist = Math.sqrt(
                          Math.pow(xValue - graphCoords.x, 2) + Math.pow(y - graphCoords.y, 2)
                        )
                        console.log(`Distance: ${dist}, maxDist: ${maxDist}`)
                        if (dist < maxDist) {
                          console.log('Adding candidate:', xValue, y)
                          addCandidate(xValue, y, dist)
                        }
                      }
                    } catch (e) {
                      continue
                    }
                  }
                }
              } catch (e) {
                // Not a valid vertical line, fall back to contour method
              }
            } else if (horizontalLineMatch) {
              // This is a horizontal line: y = value
              console.log('Matched as horizontal line! Extracted:', horizontalLineMatch[1])
              try {
                const yValueExpr = horizontalLineMatch[1]
                const yValue = evaluateExpression(compileExpression(yValueExpr), { x: 0, y: 0 })
                console.log('Evaluated y value:', yValue)

                if (isFinite(yValue)) {
                  // Find intersections with cartesian functions where f(x) = yValue
                  // We need to solve f(x) = yValue, which means finding roots of f(x) - yValue = 0
                  for (const cartesianExpr of cartesianExprs) {
                    try {
                      const compiled = compileExpression(cartesianExpr.input)

                      // Search for x values where f(x) = yValue in the visible range
                      const searchRadius = 20 // Search in a wider range
                      const xMin = graphCoords.x - searchRadius
                      const xMax = graphCoords.x + searchRadius
                      const steps = 500
                      const dx = (xMax - xMin) / steps

                      let prevY = evaluateExpression(compiled, { x: xMin })
                      let prevSign = isFinite(prevY) ? Math.sign(prevY - yValue) : null

                      for (let i = 1; i <= steps; i++) {
                        const x = xMin + i * dx
                        const y = evaluateExpression(compiled, { x })

                        if (!isFinite(y)) {
                          prevSign = null
                          prevY = y
                          continue
                        }

                        const sign = Math.sign(y - yValue)

                        // Check for sign change (crossing the horizontal line)
                        if (prevSign !== null && sign !== 0 && sign !== prevSign && isFinite(prevY)) {
                          // Found a crossing! Use bisection to find exact point
                          let a = xMin + (i - 1) * dx
                          let b = x

                          for (let j = 0; j < 20; j++) {
                            const mid = (a + b) / 2
                            const midY = evaluateExpression(compiled, { x: mid })

                            if (Math.abs(midY - yValue) < 1e-10) {
                              break
                            }

                            const midSign = Math.sign(midY - yValue)
                            if (midSign === prevSign) {
                              a = mid
                            } else {
                              b = mid
                            }
                          }

                          const intersectionX = (a + b) / 2
                          const dist = Math.sqrt(
                            Math.pow(intersectionX - graphCoords.x, 2) + Math.pow(yValue - graphCoords.y, 2)
                          )

                          console.log(`Intersection at x=${intersectionX}: y=${yValue}, distance=${dist}`)
                          if (dist < maxDist) {
                            console.log('Adding candidate:', intersectionX, yValue)
                            addCandidate(intersectionX, yValue, dist)
                          }
                        }

                        prevSign = sign
                        prevY = y
                      }
                    } catch (e) {
                      continue
                    }
                  }
                }
              } catch (e) {
                // Not a valid horizontal line, fall back to contour method
              }
            }

            // Use contour method for all implicit functions (including vertical lines as fallback)
            const contours = contoursDataRef.current.get(implicitExpr.id)
            if (!contours) continue

            for (const cartesianExpr of cartesianExprs) {
              try {
                const compiled = compileExpression(cartesianExpr.input)
                const compiledImplicit = compileExpression(implicitExpr.input)

                // Check each point on the implicit contour
                for (const segment of contours) {
                  for (const point of segment) {
                    const yOnCartesian = evaluateExpression(compiled, { x: point.x })
                    // If implicit point is close to the cartesian function
                    if (isFinite(yOnCartesian) && Math.abs(point.y - yOnCartesian) < 0.1) {
                      console.log('Found potential intersection at contour point:', point.x, point.y, 'cartesian y:', yOnCartesian)

                      // Refine using 1D Newton-Raphson on x only
                      // We want to find x where: cartesian(x) intersects implicit curve
                      // Since point is on implicit curve, we search along x-axis

                      let x = point.x
                      const h = 1e-10  // Smaller h for better numerical derivative

                      // Newton-Raphson to solve: cartesian(x) - implicitY(x) = 0
                      for (let iter = 0; iter < 50; iter++) {  // More iterations
                        // For y=f(x), evaluate at current x
                        const yCart = evaluateExpression(compiled, { x })

                        // Find corresponding y on implicit curve at this x
                        // Use high-precision bisection
                        let yImpl = point.y
                        let yMin = point.y - 1.0
                        let yMax = point.y + 1.0

                        for (let j = 0; j < 50; j++) {  // More iterations for better precision
                          const yMid = (yMin + yMax) / 2
                          const implVal = evaluateExpression(compiledImplicit, { x, y: yMid })

                          if (Math.abs(implVal) < 1e-12) {  // Higher precision
                            yImpl = yMid
                            break
                          }

                          const implMin = evaluateExpression(compiledImplicit, { x, y: yMin })
                          if (implVal * implMin < 0) {
                            yMax = yMid
                          } else {
                            yMin = yMid
                          }
                        }

                        const error = yCart - yImpl

                        if (Math.abs(error) < 1e-10) {  // Higher precision convergence
                          console.log('Converged at x:', x, 'y:', yImpl)

                          const dist = Math.sqrt(
                            Math.pow(x - graphCoords.x, 2) + Math.pow(yImpl - graphCoords.y, 2)
                          )
                          console.log('Distance to click:', dist, 'maxDist:', maxDist)

                          if (dist < maxDist) {
                            console.log('Adding intersection candidate:', x, yImpl)
                            addCandidate(x, yImpl, dist)
                          }
                          break
                        }

                        // Derivative of error function
                        const yCart2 = evaluateExpression(compiled, { x: x + h })
                        const derivCart = (yCart2 - yCart) / h

                        if (Math.abs(derivCart) < 1e-15) break  // Avoid division by zero

                        // Update x with adaptive damping
                        const dx = -error / derivCart
                        const dampFactor = Math.min(0.8, 1.0 / (1.0 + Math.abs(dx)))  // Adaptive damping
                        x = x + dx * dampFactor

                        if (!isFinite(x) || Math.abs(dx) < 1e-12) break
                      }
                    }
                  }
                }
              } catch (e) {
                continue
              }
            }
          }
        }

        // Try to find intersections between implicit functions
        if (implicitExprs.length >= 2) {
          for (let i = 0; i < implicitExprs.length; i++) {
            const contours1 = contoursDataRef.current.get(implicitExprs[i].id)
            if (!contours1) continue

            for (let j = i + 1; j < implicitExprs.length; j++) {
              const contours2 = contoursDataRef.current.get(implicitExprs[j].id)
              if (!contours2) continue

              // Find points that are on both contours
              for (const segment1 of contours1) {
                for (const point1 of segment1) {
                  for (const segment2 of contours2) {
                    for (const point2 of segment2) {
                      // If two points are very close, it's an intersection
                      const dist = Math.sqrt(
                        Math.pow(point1.x - point2.x, 2) + Math.pow(point1.y - point2.y, 2)
                      )
                      if (dist < 0.05) {
                        const clickDist = Math.sqrt(
                          Math.pow(point1.x - graphCoords.x, 2) + Math.pow(point1.y - graphCoords.y, 2)
                        )
                        if (clickDist < maxDist) {
                          const x = Math.round(point1.x * 10000) / 10000
                          const y = Math.round(point1.y * 10000) / 10000
                          addCandidate(x, y, clickDist)
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }

        // Try cartesian and implicit functions
        const allFunctionExprs = [...cartesianExprs, ...implicitExprs]
        if (allFunctionExprs.length >= 2) {
          const searchRadius = 1.0 / view.scale * 100
          const intersections = findAllIntersections(
            allFunctionExprs,
            graphCoords,
            searchRadius
          )

          for (const intersection of intersections) {
            const dist = Math.sqrt(
              Math.pow(intersection.x - graphCoords.x, 2) + Math.pow(intersection.y - graphCoords.y, 2)
            )
            if (dist < maxDist) {
              const x = Math.round(intersection.x * 10000) / 10000
              const y = Math.round(intersection.y * 10000) / 10000
              addCandidate(x, y, dist)
            }
          }
        }

        // Try to find intercepts for cartesian functions
        if (cartesianExprs.length >= 1) {
          const searchRadius = 1.0 / view.scale * 100
          const intercepts = findAllIntercepts(
            cartesianExprs,
            graphCoords,
            searchRadius
          )

          for (const intercept of intercepts) {
            const dist = Math.sqrt(
              Math.pow(intercept.x - graphCoords.x, 2) + Math.pow(intercept.y - graphCoords.y, 2)
            )
            if (dist < maxDist) {
              const x = Math.round(intercept.x * 10000) / 10000
              const y = Math.round(intercept.y * 10000) / 10000
              // Use appropriate coordinate based on intercept type
              if (intercept.type === 'x-intercept') {
                addCandidate(x, 0, dist)
              } else if (intercept.type === 'y-intercept') {
                addCandidate(0, y, dist)
              } else {
                addCandidate(x, y, dist)
              }
            }
          }
        }

        // Sort candidates by distance and pick the closest
        if (candidatePoints.length > 0) {
          candidatePoints.sort((a, b) => a.distance - b.distance)
          const closest = candidatePoints[0]

          // Check if this point already exists
          const alreadyExists = graphPoints.some(p =>
            Math.abs(p.x - closest.x) < 0.0001 && Math.abs(p.y - closest.y) < 0.0001
          )

          if (!alreadyExists) {
            pointToAdd = closest
          }
        }

        // Add point if we found one and it doesn't already exist
        if (pointToAdd) {
          addGraphPoint({
            x: pointToAdd.x,
            y: pointToAdd.y,
            color: '#555555', // Dark gray for auto-generated intersection points
            isAutoGenerated: true
          })
        }
      }
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
  }

  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    // Handle circle-three-points separately (uses tempPoints, not creationDragRef)
    if (isCreatingGeometry && creationState.toolType === 'circle-three-points' && creationState.tempPoints.length === 2) {
      const canvas = overlayCanvasRef.current
      if (!canvas) return

      const rect = canvas.getBoundingClientRect()
      const canvasX = e.clientX - rect.left
      const canvasY = e.clientY - rect.top
      const graphPos = screenToGraph(canvasX, canvasY, canvas.clientWidth, canvas.clientHeight, view)

      const point1Id = creationState.tempPoints[0]
      const point2Id = creationState.tempPoints[1]

      // Create third point at mouse up location
      let point3Id = findPointAtLocation(graphPos.x, graphPos.y)

      if (!point3Id || point3Id === point1Id || point3Id === point2Id) {
        const pointCount = geometryObjects.filter(obj => obj.type === 'point').length
        const label = String.fromCharCode(65 + (pointCount % 26))

        point3Id = addGeometryObject({
          type: 'point',
          subType: 'point-fixed',
          points: [{ x: graphPos.x, y: graphPos.y }],
          color: '#4ecdc4',
          strokeWidth: 4,
          visible: true,
          selected: false,
          label: label,
          scale: 1,
        })
      }

      // Get latest geometry objects after creating third point
      const currentGeometryObjects = useStore.getState().geometryObjects
      const point1 = currentGeometryObjects.find(obj => obj.id === point1Id)
      const point2 = currentGeometryObjects.find(obj => obj.id === point2Id)
      const point3 = currentGeometryObjects.find(obj => obj.id === point3Id)

      if (point1 && point2 && point3 &&
          point1.points[0] && point2.points[0] && point3.points[0]) {

        const p1 = point1.points[0]
        const p2 = point2.points[0]
        const p3 = point3.points[0]

        // Calculate circumcircle center and radius
        const ax = p1.x, ay = p1.y
        const bx = p2.x, by = p2.y
        const cx = p3.x, cy = p3.y

        // Calculate D (determinant) to check if points are collinear
        const D = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by))

        if (Math.abs(D) < 0.0001) {
          // Points are collinear, cannot create circle
          console.warn('Points are collinear, cannot create circle')
          // Deselect all points
          updateGeometryObject(point1Id, { selected: false })
          updateGeometryObject(point2Id, { selected: false })
          updateGeometryObject(point3Id, { selected: false })
        } else {
          // Calculate circumcenter
          const aSq = ax * ax + ay * ay
          const bSq = bx * bx + by * by
          const cSq = cx * cx + cy * cy

          const centerX = ((aSq * (by - cy) + bSq * (cy - ay) + cSq * (ay - by)) / D)
          const centerY = ((aSq * (cx - bx) + bSq * (ax - cx) + cSq * (bx - ax)) / D)

          // Calculate radius
          const dx = ax - centerX
          const dy = ay - centerY
          const radius = Math.sqrt(dx * dx + dy * dy)

          // Create circle
          const newCircleId = addGeometryObject({
            type: 'circle',
            subType: 'circle-three-points',
            points: [{ x: centerX, y: centerY }],
            radius: radius,
            color: '#808080',
            strokeWidth: 4,
            visible: true,
            selected: false,
            scale: 1,
            dependencies: [point1Id, point2Id, point3Id],
            circleConfig: {
              point1Id: point1Id,
              point2Id: point2Id,
              point3Id: point3Id,
            }
          })

          // Update parent points
          updateGeometryObject(point1Id, {
            dependents: [...(point1.dependents || []), newCircleId],
            selected: false,
          })
          updateGeometryObject(point2Id, {
            dependents: [...(point2.dependents || []), newCircleId],
            selected: false,
          })
          updateGeometryObject(point3Id, {
            dependents: [...(point3.dependents || []), newCircleId],
            selected: false,
          })
        }
      }

      // Clear creation state
      setIsCreatingGeometry(false)
      creationDragRef.current = null
      setCreationState({ preview: undefined })
      finishCreation()
      return
    }

    // Handle geometry creation finalization
    if (isCreatingGeometry && creationDragRef.current) {
      const canvas = overlayCanvasRef.current
      if (!canvas) return

      const rect = canvas.getBoundingClientRect()
      const canvasX = e.clientX - rect.left
      const canvasY = e.clientY - rect.top
      const graphPos = screenToGraph(canvasX, canvasY, canvas.clientWidth, canvas.clientHeight, view)

      const firstPointId = creationDragRef.current.firstPointId

      // Create second point or use existing point at mouse up location
      let secondPointId = findPointAtLocation(graphPos.x, graphPos.y)

      if (!secondPointId || secondPointId === firstPointId) {
        const pointCount = geometryObjects.filter(obj => obj.type === 'point').length
        const label = String.fromCharCode(65 + (pointCount % 26))

        secondPointId = addGeometryObject({
          type: 'point',
          subType: 'point-fixed',
          points: [{ x: graphPos.x, y: graphPos.y }],
          color: '#4ecdc4',
          strokeWidth: 4,
          visible: true,
          selected: false,
          label: label,
          scale: 1,
        })
      }

      // Get latest geometry objects
      const currentGeometryObjects = useStore.getState().geometryObjects
      const point1 = currentGeometryObjects.find(obj => obj.id === firstPointId)
      const point2 = currentGeometryObjects.find(obj => obj.id === secondPointId)

      if (point1 && point2 && point1.points[0] && point2.points[0]) {
        // Create line or circle based on tool type
        if (creationState.toolType === 'line-segment' ||
            creationState.toolType === 'line-infinite' ||
            creationState.toolType === 'line-ray') {
          // Determine line type
          let lineType: 'segment' | 'line' | 'ray' = 'segment'
          let lineColor = '#808080'

          if (creationState.toolType === 'line-infinite') {
            lineType = 'line'
          } else if (creationState.toolType === 'line-ray') {
            lineType = 'ray'
          }

          // Create line
          const newLineId = addGeometryObject({
            type: lineType,
            subType: creationState.toolType,
            points: [point1.points[0], point2.points[0]],
            color: lineColor,
            strokeWidth: 4,
            visible: true,
            selected: false,
            scale: 1,
            dependencies: [firstPointId, secondPointId],
            linePoints: {
              point1Id: firstPointId,
              point2Id: secondPointId,
            }
          })

          // Update parent points
          updateGeometryObject(firstPointId, {
            dependents: [...(point1.dependents || []), newLineId],
            selected: false,
          })
          updateGeometryObject(secondPointId, {
            dependents: [...(point2.dependents || []), newLineId],
            selected: false,
          })
        } else if (creationState.toolType === 'circle-center-radius') {
          // Calculate radius
          const dx = point2.points[0].x - point1.points[0].x
          const dy = point2.points[0].y - point1.points[0].y
          const radius = Math.sqrt(dx * dx + dy * dy)

          // Create circle
          const newCircleId = addGeometryObject({
            type: 'circle',
            subType: 'circle-center-radius',
            points: [point1.points[0]],
            radius: radius,
            color: '#808080',
            strokeWidth: 4,
            visible: true,
            selected: false,
            scale: 1,
            dependencies: [firstPointId, secondPointId],
            circleConfig: {
              centerId: firstPointId,
              radiusPointId: secondPointId,
            }
          })

          // Update parent points
          updateGeometryObject(firstPointId, {
            dependents: [...(point1.dependents || []), newCircleId],
            selected: false,
          })
          updateGeometryObject(secondPointId, {
            dependents: [...(point2.dependents || []), newCircleId],
            selected: false,
          })
        } else if (creationState.toolType === 'circle-diameter') {
          // Calculate center (midpoint) and radius (half distance)
          const p1 = point1.points[0]
          const p2 = point2.points[0]

          const centerX = (p1.x + p2.x) / 2
          const centerY = (p1.y + p2.y) / 2

          const dx = p2.x - p1.x
          const dy = p2.y - p1.y
          const diameter = Math.sqrt(dx * dx + dy * dy)
          const radius = diameter / 2

          // Create circle
          const newCircleId = addGeometryObject({
            type: 'circle',
            subType: 'circle-diameter',
            points: [{ x: centerX, y: centerY }],
            radius: radius,
            color: '#808080',
            strokeWidth: 4,
            visible: true,
            selected: false,
            scale: 1,
            dependencies: [firstPointId, secondPointId],
            circleConfig: {
              point1Id: firstPointId,
              point2Id: secondPointId,
            }
          })

          // Update parent points (diameter endpoints)
          updateGeometryObject(firstPointId, {
            dependents: [...(point1.dependents || []), newCircleId],
            selected: false,
          })
          updateGeometryObject(secondPointId, {
            dependents: [...(point2.dependents || []), newCircleId],
            selected: false,
          })
        } else if (creationState.toolType === 'polygon-regular') {
          // Open dialog to select number of sides
          setRegularPolygonDialog({
            visible: true,
            centerPointId: firstPointId,
            radiusPointId: secondPointId,
            sides: 3, // Default to triangle
          })

          // Clear creation state to stop tracking mouse
          setIsCreatingGeometry(false)
          creationDragRef.current = null
          setCreationState({ preview: undefined })

          // Don't call finishCreation() - keep tempPoints for dialog
          return
        } else if (creationState.toolType === 'polygon-rectangle') {
          // Rectangle: two points define the diagonal
          const p1 = point1.points[0]
          const p2 = point2.points[0]

          // Create rectangle with p1 and p2 as opposite corners
          const vertices = [
            { x: p1.x, y: p1.y },
            { x: p2.x, y: p1.y },
            { x: p2.x, y: p2.y },
            { x: p1.x, y: p2.y },
          ]

          const newPolygonId = addGeometryObject({
            type: 'polygon',
            subType: 'polygon-rectangle',
            points: vertices,
            color: '#ABD5B1',
            strokeWidth: 4,
            visible: true,
            selected: false,
            label: '',
            scale: 1,
            dependencies: [firstPointId, secondPointId],
          })

          updateGeometryObject(firstPointId, {
            dependents: [...(point1.dependents || []), newPolygonId],
            selected: false,
          })
          updateGeometryObject(secondPointId, {
            dependents: [...(point2.dependents || []), newPolygonId],
            selected: false,
          })
        } else if (creationState.toolType === 'polygon-square') {
          // Square: two points define one side
          const p1 = point1.points[0]
          const p2 = point2.points[0]

          // Calculate perpendicular vector
          const dx = p2.x - p1.x
          const dy = p2.y - p1.y
          const perpX = -dy
          const perpY = dx

          // Create square
          const vertices = [
            { x: p1.x, y: p1.y },
            { x: p2.x, y: p2.y },
            { x: p2.x + perpX, y: p2.y + perpY },
            { x: p1.x + perpX, y: p1.y + perpY },
          ]

          const newPolygonId = addGeometryObject({
            type: 'polygon',
            subType: 'polygon-square',
            points: vertices,
            color: '#ABD5B1',
            strokeWidth: 4,
            visible: true,
            selected: false,
            label: '',
            scale: 1,
            dependencies: [firstPointId, secondPointId],
          })

          updateGeometryObject(firstPointId, {
            dependents: [...(point1.dependents || []), newPolygonId],
            selected: false,
          })
          updateGeometryObject(secondPointId, {
            dependents: [...(point2.dependents || []), newPolygonId],
            selected: false,
          })
        } else if (creationState.toolType === 'polygon-parallelogram') {
          // Parallelogram: two points define one side (will need 3rd point)
          // Store as two points for now, but we'll handle 3-point creation differently
          const p1 = point1.points[0]
          const p2 = point2.points[0]

          // Calculate a default parallelogram with 60-degree angle
          const dx = p2.x - p1.x
          const dy = p2.y - p1.y

          // Create offset vector at 60 degrees from the base
          const angle = Math.PI / 3 // 60 degrees
          const offsetX = dx * Math.cos(angle) - dy * Math.sin(angle)
          const offsetY = dx * Math.sin(angle) + dy * Math.cos(angle)

          const vertices = [
            { x: p1.x, y: p1.y },
            { x: p2.x, y: p2.y },
            { x: p2.x + offsetX, y: p2.y + offsetY },
            { x: p1.x + offsetX, y: p1.y + offsetY },
          ]

          const newPolygonId = addGeometryObject({
            type: 'polygon',
            subType: 'polygon-parallelogram',
            points: vertices,
            color: '#ABD5B1',
            strokeWidth: 4,
            visible: true,
            selected: false,
            label: '',
            scale: 1,
            dependencies: [firstPointId, secondPointId],
          })

          updateGeometryObject(firstPointId, {
            dependents: [...(point1.dependents || []), newPolygonId],
            selected: false,
          })
          updateGeometryObject(secondPointId, {
            dependents: [...(point2.dependents || []), newPolygonId],
            selected: false,
          })
        } else if (creationState.toolType === 'polygon-rhombus') {
          // Rhombus: two points define one diagonal
          const p1 = point1.points[0]
          const p2 = point2.points[0]

          // Center of the rhombus
          const centerX = (p1.x + p2.x) / 2
          const centerY = (p1.y + p2.y) / 2

          // Length of first diagonal
          const diag1Length = Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2))

          // Create perpendicular diagonal (make it half the length for aesthetics)
          const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x)
          const perpAngle = angle + Math.PI / 2
          const diag2HalfLength = diag1Length / 4

          const p3x = centerX + diag2HalfLength * Math.cos(perpAngle)
          const p3y = centerY + diag2HalfLength * Math.sin(perpAngle)
          const p4x = centerX - diag2HalfLength * Math.cos(perpAngle)
          const p4y = centerY - diag2HalfLength * Math.sin(perpAngle)

          const vertices = [
            { x: p1.x, y: p1.y },
            { x: p3x, y: p3y },
            { x: p2.x, y: p2.y },
            { x: p4x, y: p4y },
          ]

          const newPolygonId = addGeometryObject({
            type: 'polygon',
            subType: 'polygon-rhombus',
            points: vertices,
            color: '#ABD5B1',
            strokeWidth: 4,
            visible: true,
            selected: false,
            label: '',
            scale: 1,
            dependencies: [firstPointId, secondPointId],
          })

          updateGeometryObject(firstPointId, {
            dependents: [...(point1.dependents || []), newPolygonId],
            selected: false,
          })
          updateGeometryObject(secondPointId, {
            dependents: [...(point2.dependents || []), newPolygonId],
            selected: false,
          })
        } else if (creationState.toolType === 'polygon-kite') {
          // Kite: two points define the axis of symmetry
          const p1 = point1.points[0]
          const p2 = point2.points[0]

          // Calculate perpendicular vector
          const dx = p2.x - p1.x
          const dy = p2.y - p1.y
          const length = Math.sqrt(dx * dx + dy * dy)

          // Perpendicular offset (30% of length on each side)
          const perpX = -dy / length * length * 0.3
          const perpY = dx / length * length * 0.3

          // Position along axis for the two wing points
          const midX = (p1.x + p2.x) / 2
          const midY = (p1.y + p2.y) / 2

          // Wing points at different positions
          const wing1X = p1.x + dx * 0.3
          const wing1Y = p1.y + dy * 0.3
          const wing2X = p1.x + dx * 0.7
          const wing2Y = p1.y + dy * 0.7

          const vertices = [
            { x: p1.x, y: p1.y },
            { x: wing1X + perpX, y: wing1Y + perpY },
            { x: p2.x, y: p2.y },
            { x: wing1X - perpX, y: wing1Y - perpY },
          ]

          const newPolygonId = addGeometryObject({
            type: 'polygon',
            subType: 'polygon-kite',
            points: vertices,
            color: '#ABD5B1',
            strokeWidth: 4,
            visible: true,
            selected: false,
            label: '',
            scale: 1,
            dependencies: [firstPointId, secondPointId],
          })

          updateGeometryObject(firstPointId, {
            dependents: [...(point1.dependents || []), newPolygonId],
            selected: false,
          })
          updateGeometryObject(secondPointId, {
            dependents: [...(point2.dependents || []), newPolygonId],
            selected: false,
          })
        } else if (creationState.toolType === 'polygon-right-triangle') {
          // Right triangle: two points define the legs, third vertex at the right angle
          const p1 = point1.points[0]
          const p2 = point2.points[0]

          // Create right angle at p1
          const dx = p2.x - p1.x
          const dy = p2.y - p1.y

          // Perpendicular vector for the other leg (same length)
          const p3x = p1.x - dy
          const p3y = p1.y + dx

          const vertices = [
            { x: p1.x, y: p1.y },
            { x: p2.x, y: p2.y },
            { x: p3x, y: p3y },
          ]

          const newPolygonId = addGeometryObject({
            type: 'polygon',
            subType: 'polygon-right-triangle',
            points: vertices,
            color: '#ABD5B1',
            strokeWidth: 4,
            visible: true,
            selected: false,
            label: '',
            scale: 1,
            dependencies: [firstPointId, secondPointId],
          })

          updateGeometryObject(firstPointId, {
            dependents: [...(point1.dependents || []), newPolygonId],
            selected: false,
          })
          updateGeometryObject(secondPointId, {
            dependents: [...(point2.dependents || []), newPolygonId],
            selected: false,
          })
        }
      }

      // Clear creation state
      setIsCreatingGeometry(false)
      creationDragRef.current = null
      setCreationState({ preview: undefined })
      finishCreation()
    }
  }

  // Base button style (without positioning)
  const buttonStyle = {
    width: '40px',
    height: '40px',
    borderRadius: '8px',
    border: '1px solid #ccc',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    cursor: 'pointer',
    fontSize: '20px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 2px 6px rgba(0, 0, 0, 0.1)',
    transition: 'all 0.2s',
    lineHeight: 1,
    pointerEvents: 'auto' as const,
  }

  const disabledButtonStyle = {
    ...buttonStyle,
    opacity: 0.3,
    cursor: 'not-allowed',
  }

  // Flexbox container for button groups
  const buttonGroupStyle = (position: { top?: string; bottom?: string; left?: string; right?: string }) => ({
    position: 'absolute' as const,
    display: 'flex',
    gap: '8px',
    zIndex: 1000,
    pointerEvents: 'none' as const,
    ...position,
  })

  return (
    <div
      style={{ position: 'relative', width: '100%', height: '100%' }}
      onClick={() => {
        setShowPenSettings(false)
        setShowHighlighterSettings(false)
        setShowColorPopup(false)
      }}
    >
      {/* Graph canvas container - only includes canvases for capturing */}
      <div
        ref={graphContainerRef}
        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
      >
        {/* Base layer: grid, axes, function graphs */}
        <canvas
          ref={baseCanvasRef}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            zIndex: 1,
            pointerEvents: 'none',
          }}
        />
        {/* Overlay layer: points, images (handles interactions) */}
        <canvas
          ref={overlayCanvasRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            zIndex: 2,
            cursor: isPanning ? 'grabbing'
              : drawingTool === 'eraser' ? 'not-allowed'
              : drawingTool === 'pen' || drawingTool === 'highlighter' ? 'default'
              : drawingTool === 'select' ? 'pointer'
              : drawingTool === 'text' ? 'text'
              : creationState.active ? 'crosshair'
              : 'grab',
            pointerEvents: (drawingTool === 'pen' || drawingTool === 'highlighter' || drawingTool === 'eraser' || drawingTool === 'select') ? 'none' : 'auto',
          }}
        />
        {/* Konva layer: drawings with Perfect Freehand */}
        {canvasSize.width > 0 && canvasSize.height > 0 && (
          <KonvaDrawingLayer
            ref={drawingLayerRef}
            width={canvasSize.width}
            height={canvasSize.height}
            onPanStart={() => setIsPanning(true)}
            stageRef={konvaStageRef}
          />
        )}
      </div>

      {/* Top-right button group: Undo, Redo, Reset */}
      <div style={buttonGroupStyle({ top: '16px', right: '16px' })}>
        {/* Undo button */}
        <button
          onClick={undo}
          disabled={!canUndo()}
          style={canUndo() ? buttonStyle : disabledButtonStyle}
          onMouseEnter={(e) => {
            if (canUndo()) {
              e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 1)'
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)'
            }
          }}
          onMouseLeave={(e) => {
            if (canUndo()) {
              e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.95)'
              e.currentTarget.style.boxShadow = '0 2px 6px rgba(0, 0, 0, 0.1)'
            }
          }}
          title="Undo"
        >
          ↶
        </button>
        {/* Redo button */}
        <button
          onClick={redo}
          disabled={!canRedo()}
          style={canRedo() ? buttonStyle : disabledButtonStyle}
          onMouseEnter={(e) => {
            if (canRedo()) {
              e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 1)'
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)'
            }
          }}
          onMouseLeave={(e) => {
            if (canRedo()) {
              e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.95)'
              e.currentTarget.style.boxShadow = '0 2px 6px rgba(0, 0, 0, 0.1)'
            }
          }}
          title="Redo"
        >
          ↷
        </button>
        {/* Grid/Axes mode dropdown */}
        <select
          value={gridMode}
          onChange={(e) => setGridMode(e.target.value as 'grid' | 'grid-axis' | 'axis' | 'none')}
          style={{
            ...buttonStyle,
            cursor: 'pointer',
            fontSize: '13px',
            padding: '6px 8px',
            minWidth: '120px',
          }}
          title="Toggle grid and axes visibility"
        >
          <option value="grid">그리드</option>
          <option value="none">흰배경</option>
          <option value="axis">축</option>
          <option value="grid-axis">그리드+축</option>
        </select>
        {/* Reset view button */}
        <button
          onClick={resetView}
          style={buttonStyle}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 1)'
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.95)'
            e.currentTarget.style.boxShadow = '0 2px 6px rgba(0, 0, 0, 0.1)'
          }}
          title="Reset view to origin"
        >
          🏠
        </button>
        {/* Capture to clipboard button */}
        <div style={{ position: 'relative' }}>
          <button
            onMouseDown={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setCaptureDrag({ startY: e.clientY, currentY: e.clientY })
            }}
            style={buttonStyle}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 1)'
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.95)'
              e.currentTarget.style.boxShadow = '0 2px 6px rgba(0, 0, 0, 0.1)'
            }}
            title="Click to copy, drag down to save as file"
          >
            <span style={{ transform: 'translateY(-3px)', display: 'inline-block' }}>📷</span>
          </button>
          {/* Balloon message */}
          {captureMessage && (
            <div style={{
              position: 'absolute',
              top: '42px',
              right: '0',
              backgroundColor: '#4ecdc4',
              color: '#ffffff',
              padding: '6px 12px',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: 500,
              whiteSpace: 'nowrap',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
              zIndex: 999999,
            }}>
              {captureMessage}
              {/* Arrow pointing up */}
              <div style={{
                position: 'absolute',
                top: '-6px',
                right: '12px',
                width: '0',
                height: '0',
                borderLeft: '6px solid transparent',
                borderRight: '6px solid transparent',
                borderBottom: '6px solid #4ecdc4',
              }} />
            </div>
          )}
        </div>
      </div>

      {/* Visibility mode dropdown - shown only when there are graph points */}
      {graphPoints.length > 0 && (
        <div style={buttonGroupStyle({ top: '76px', right: '16px' })}>
          <select
            value={visibilityMode}
            onChange={(e) => setVisibilityMode(e.target.value as 'function-labels' | 'points-only' | 'point-labels' | 'labels-only')}
            style={{
              ...buttonStyle,
              cursor: 'pointer',
              fontSize: '13px',
              padding: '6px 8px',
              minWidth: '120px',
            }}
            title="Toggle point and label visibility"
          >
            <option value="function-labels">함수 이름 표시</option>
            <option value="points-only">점 보기</option>
            <option value="labels-only">점+이름 보기</option>
            <option value="point-labels">점+좌표 보기</option>
          </select>
        </div>
      )}

      {/* Top-left button group: Drawing tools */}
      <div style={buttonGroupStyle({ top: '16px', left: '16px' })}>
        {/* Pen tool group */}
        <div style={{ display: 'flex', position: 'relative' }}>
          <button
            onClick={() => {
              setDrawingTool(drawingTool === 'pen' ? 'none' : 'pen')
              setGeometryTool('none') // Deactivate geometry tools
              cancelCreation() // Cancel geometry creation state
              setShowPenSettings(false)
              setShowHighlighterSettings(false)
              setShowColorPopup(false)
            }}
            style={{
              ...buttonStyle,
              backgroundColor: drawingTool === 'pen' ? 'rgba(78, 205, 196, 0.95)' : 'rgba(255, 255, 255, 0.95)',
              position: 'relative',
              borderTopRightRadius: 0,
              borderBottomRightRadius: 0,
            }}
            title="Pen tool"
          >
            <span>✏️</span>
          </button>

          {/* Pen thickness button */}
          <button
            onClick={(e) => {
              e.stopPropagation()
              setShowPenSettings(!showPenSettings)
              setShowHighlighterSettings(false)
              setShowColorPopup(false)
            }}
            style={{
              ...buttonStyle,
              borderTopLeftRadius: 0,
              borderBottomLeftRadius: 0,
              borderLeft: 'none',
              width: '28px',
              minWidth: '28px',
              padding: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            title={`Pen thickness: ${penThickness}px`}
          >
            <div style={{
              width: `${Math.min(penThickness * 2, 16)}px`,
              height: `${Math.min(penThickness * 2, 16)}px`,
              borderRadius: '50%',
              backgroundColor: penColor,
              border: '2px dashed rgba(0, 0, 0, 0.3)',
            }} />
          </button>

          {/* Pen thickness picker popup */}
          {showPenSettings && (
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                position: 'absolute',
                top: '42px',
                left: '0',
                backgroundColor: 'rgba(255, 255, 255, 0.98)',
                border: '1px solid #ccc',
                borderRadius: '8px',
                padding: '8px',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                zIndex: 100,
                minWidth: '100px',
                pointerEvents: 'auto',
              }}>
              {[1, 2, 3, 4, 5, 6].map(thickness => (
                <button
                  key={thickness}
                  onClick={() => {
                    setPenThickness(thickness)
                    setShowPenSettings(false)
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    width: '100%',
                    padding: '8px 12px',
                    marginBottom: '4px',
                    border: penThickness === thickness ? '2px solid #4ecdc4' : '1px solid #ddd',
                    borderRadius: '4px',
                    backgroundColor: penThickness === thickness ? 'rgba(78, 205, 196, 0.1)' : '#fff',
                    cursor: 'pointer',
                    fontSize: '12px',
                  }}
                >
                  <span>{thickness}px</span>
                  <div style={{
                    width: '40px',
                    height: `${thickness}px`,
                    backgroundColor: penColor,
                    borderRadius: `${thickness / 2}px`,
                  }} />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Highlighter tool group */}
        <div style={{ display: 'flex', position: 'relative' }}>
          <button
            onClick={() => {
              setDrawingTool(drawingTool === 'highlighter' ? 'none' : 'highlighter')
              setGeometryTool('none') // Deactivate geometry tools
              cancelCreation() // Cancel geometry creation state
              setShowHighlighterSettings(false)
              setShowPenSettings(false)
              setShowColorPopup(false)
            }}
            style={{
              ...buttonStyle,
              backgroundColor: drawingTool === 'highlighter' ? 'rgba(78, 205, 196, 0.95)' : 'rgba(255, 255, 255, 0.95)',
              position: 'relative',
              borderTopRightRadius: 0,
              borderBottomRightRadius: 0,
            }}
            title="Highlighter tool"
          >
            <span>🖍️</span>
          </button>

          {/* Highlighter thickness button */}
          <button
            onClick={(e) => {
              e.stopPropagation()
              setShowHighlighterSettings(!showHighlighterSettings)
              setShowPenSettings(false)
              setShowColorPopup(false)
            }}
            style={{
              ...buttonStyle,
              borderTopLeftRadius: 0,
              borderBottomLeftRadius: 0,
              borderLeft: 'none',
              width: '28px',
              minWidth: '28px',
              padding: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            title={`Highlighter thickness: ${highlighterThickness}px`}
          >
            <div style={{
              width: `${Math.min(highlighterThickness / 3, 20)}px`,
              height: `${Math.min(highlighterThickness / 3, 20)}px`,
              borderRadius: '50%',
              backgroundColor: highlighterColor,
              opacity: 0.5,
              border: '2px dashed rgba(0, 0, 0, 0.3)',
            }} />
          </button>

          {/* Highlighter thickness picker popup */}
          {showHighlighterSettings && (
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                position: 'absolute',
                top: '42px',
                left: '0',
                backgroundColor: 'rgba(255, 255, 255, 0.98)',
                border: '1px solid #ccc',
                borderRadius: '8px',
                padding: '8px',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                zIndex: 100,
                minWidth: '100px',
                pointerEvents: 'auto',
              }}>
              {[10, 15, 20, 25, 30, 40, 50, 60].map(thickness => (
                <button
                  key={thickness}
                  onClick={() => {
                    setHighlighterThickness(thickness)
                    setShowHighlighterSettings(false)
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    width: '100%',
                    padding: '8px 12px',
                    marginBottom: '4px',
                    border: highlighterThickness === thickness ? '2px solid #4ecdc4' : '1px solid #ddd',
                    borderRadius: '4px',
                    backgroundColor: highlighterThickness === thickness ? 'rgba(78, 205, 196, 0.1)' : '#fff',
                    cursor: 'pointer',
                    fontSize: '12px',
                  }}
                >
                  <span>{thickness}px</span>
                  <div style={{
                    width: '40px',
                    height: `${Math.min(thickness, 24)}px`,
                    backgroundColor: highlighterColor,
                    borderRadius: `${Math.min(thickness, 24) / 2}px`,
                    opacity: 0.4,
                  }} />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Common color picker button */}
        <div style={{ position: 'relative' }}>
          <button
            onMouseDown={(e) => {
              e.stopPropagation()
              // Start gesture drag detection
              gestureInProgressRef.current = false
              setColorGestureDrag({ startX: e.clientX, startY: e.clientY })
            }}
            onClick={(e) => {
              e.stopPropagation()
              console.log('Color button onClick, gestureInProgress:', gestureInProgressRef.current)
              // Only toggle if no gesture was detected
              if (!gestureInProgressRef.current) {
                console.log('Toggling color popup via onClick')
                setShowColorPopup(prev => !prev)
                setShowPenSettings(false)
                setShowHighlighterSettings(false)
              }
            }}
            style={{
              ...buttonStyle,
              padding: '8px',
              backgroundColor: drawingTool === 'pen' ? penColor : drawingTool === 'highlighter' ? highlighterColor : '#ffffff',
              border: '2px solid #ccc',
            }}
            title="Choose color (or drag: right=red, down=black, left=blue)"
          >
            <div style={{
              width: '100%',
              height: '100%',
              backgroundColor: drawingTool === 'pen' ? penColor : drawingTool === 'highlighter' ? highlighterColor : '#888',
              borderRadius: '50%',
              opacity: drawingTool === 'highlighter' ? 0.5 : 1,
            }} />
          </button>

          {/* Color picker popup */}
          {showColorPopup && (
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                position: 'absolute',
                top: '42px',
                left: '0',
                backgroundColor: 'rgba(255, 255, 255, 0.98)',
                border: '1px solid #ccc',
                borderRadius: '8px',
                padding: '12px',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                zIndex: 100,
                pointerEvents: 'auto',
              }}>
              {/* Color picker */}
              <HexColorPicker
                color={drawingTool === 'pen' ? penColor : highlighterColor}
                onChange={(color) => {
                  if (drawingTool === 'pen') {
                    setPenColor(color)
                  } else if (drawingTool === 'highlighter') {
                    setHighlighterColor(color)
                  }
                }}
                style={{ width: '200px', height: '150px' }}
              />

              {/* Preset colors */}
              <div style={{
                marginTop: '12px',
                paddingTop: '12px',
                borderTop: '1px solid #e0e0e0',
              }}>
                <div style={{
                  fontSize: '11px',
                  color: '#666',
                  marginBottom: '6px',
                  fontWeight: 500,
                }}>
                  Preset Colors
                </div>
                <div style={{
                  display: 'flex',
                  gap: '6px',
                  flexWrap: 'wrap',
                }}>
                  {['#2c2c2c', '#ffffff', '#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff', '#ff8800', '#808080'].map(color => (
                    <button
                      key={color}
                      onClick={() => {
                        if (drawingTool === 'pen') {
                          setPenColor(color)
                        } else if (drawingTool === 'highlighter') {
                          setHighlighterColor(color)
                        }
                      }}
                      style={{
                        width: '24px',
                        height: '24px',
                        borderRadius: '4px',
                        backgroundColor: color,
                        border: (drawingTool === 'pen' && penColor === color) || (drawingTool === 'highlighter' && highlighterColor === color) ? '3px solid #4ecdc4' : '2px solid #ddd',
                        cursor: 'pointer',
                        padding: 0,
                        boxShadow: ((drawingTool === 'pen' && penColor === color) || (drawingTool === 'highlighter' && highlighterColor === color)) ? '0 0 4px rgba(78, 205, 196, 0.5)' : 'none',
                      }}
                    />
                  ))}
                </div>
              </div>

              {/* Close button */}
              <button
                onClick={() => setShowColorPopup(false)}
                style={{
                  width: '100%',
                  marginTop: '12px',
                  padding: '6px',
                  backgroundColor: '#4ecdc4',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: 'bold',
                }}
              >
                완료
              </button>
            </div>
          )}
        </div>

        {/* Select tool */}
        <button
          onClick={() => {
            const newTool = drawingTool === 'select' ? 'none' : 'select'
            setDrawingTool(newTool)
            setGeometryTool('none') // Deactivate geometry tools
            cancelCreation() // Cancel geometry creation state
            setShowPenSettings(false)
            setShowHighlighterSettings(false)
            setShowColorPopup(false)
          }}
          style={{
            ...buttonStyle,
            backgroundColor: drawingTool === 'select' ? 'rgba(78, 205, 196, 0.95)' : 'rgba(255, 255, 255, 0.95)',
          }}
          title="Select tool - Click: select object, Drag: free-form lasso select, Shift+Click: multi-select, Handles: resize/rotate, Delete: delete, Ctrl+[: send to back, Ctrl+]: bring to front"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="3" y="3" width="18" height="18" rx="1" stroke="#555" strokeWidth="1.5" strokeDasharray="4 2" fill="none"/>
            <rect x="1.5" y="1.5" width="4" height="4" rx="1" fill="#4ecdc4" stroke="#333" strokeWidth="0.8"/>
            <rect x="18.5" y="1.5" width="4" height="4" rx="1" fill="#4ecdc4" stroke="#333" strokeWidth="0.8"/>
            <rect x="1.5" y="18.5" width="4" height="4" rx="1" fill="#4ecdc4" stroke="#333" strokeWidth="0.8"/>
            <rect x="18.5" y="18.5" width="4" height="4" rx="1" fill="#4ecdc4" stroke="#333" strokeWidth="0.8"/>
          </svg>
        </button>

        {/* Copy & Paste button */}
        <button
          onClick={() => {
            const hasSelection = drawingLayerRef.current?.hasSelection()
            const hasCopied = drawingLayerRef.current?.hasCopiedItems()

            console.log('Copy & Paste clicked:', { hasSelection, hasCopied })

            if (hasSelection) {
              // If something is selected, copy and paste it
              const copiedItems = drawingLayerRef.current?.copy()
              console.log('Copied items:', copiedItems)
              if (copiedItems && (copiedItems.drawings.length > 0 || copiedItems.images.length > 0 || copiedItems.geometryObjects.length > 0)) {
                drawingLayerRef.current?.clearSelection() // Clear selection immediately
                drawingLayerRef.current?.paste(copiedItems) // Paste will auto-select new items
              } else {
                console.log('Nothing to copy - selection was empty')
              }
            } else if (hasCopied) {
              // If nothing is selected but clipboard has data, just paste
              console.log('Pasting from clipboard')
              drawingLayerRef.current?.paste()
            } else {
              // Nothing selected and clipboard is empty - try to get image from system clipboard
              console.log('Trying to paste image from system clipboard')
              navigator.clipboard.read().then(items => {
                for (const item of items) {
                  for (const type of item.types) {
                    if (type.startsWith('image/')) {
                      item.getType(type).then(blob => {
                        const reader = new FileReader()
                        reader.onload = (event) => {
                          const src = event.target?.result as string
                          if (!src) return

                          const canvas = overlayCanvasRef.current
                          if (!canvas) return

                          const img = new Image()
                          img.onload = () => {
                            const aspectRatio = img.width / img.height
                            let targetHeight = canvas.clientHeight * 0.5
                            let targetWidth = targetHeight * aspectRatio

                            if (targetWidth > canvas.clientWidth * 0.5) {
                              targetWidth = canvas.clientWidth * 0.5
                              targetHeight = targetWidth / aspectRatio
                            }

                            const transform = new DOMMatrix()
                            transform.a = targetWidth
                            transform.d = targetHeight
                            transform.e = canvas.clientWidth / 2
                            transform.f = canvas.clientHeight / 2

                            const centerGraph = screenToGraph(
                              canvas.clientWidth / 2,
                              canvas.clientHeight / 2,
                              canvas.clientWidth,
                              canvas.clientHeight,
                              view
                            )
                            const widthGraph = targetWidth / (view.scale * view.scaleX)
                            const heightGraph = targetHeight / (view.scale * view.scaleY)

                            addImage({
                              src,
                              transform,
                              opacity: 1,
                              locked: false,
                              aspectRatio,
                              graphPosition: {
                                x: centerGraph.x,
                                y: centerGraph.y,
                                width: widthGraph,
                                height: heightGraph,
                                rotation: 0
                              }
                            })
                          }
                          img.src = src
                        }
                        reader.readAsDataURL(blob)
                      })
                      return
                    }
                  }
                }
              }).catch(err => {
                console.log('No image in system clipboard:', err)
              })
            }
          }}
          style={buttonStyle}
          title="Copy & Paste selected items (or paste from clipboard)"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            {/* Clipboard (back) */}
            <rect x="2" y="3" width="12" height="15" rx="2" fill="#D4A574" stroke="#666" strokeWidth="1.5"/>
            <rect x="5" y="2" width="6" height="3" rx="1" fill="#999" stroke="#666" strokeWidth="1"/>

            {/* Document (front) */}
            <rect x="10" y="10" width="12" height="12" rx="1.5" fill="white" stroke="#666" strokeWidth="1.5"/>
            <line x1="12" y1="13" x2="19" y2="13" stroke="#999" strokeWidth="1.5" strokeLinecap="round"/>
            <line x1="12" y1="16" x2="19" y2="16" stroke="#999" strokeWidth="1.5" strokeLinecap="round"/>
            <line x1="12" y1="19" x2="17" y2="19" stroke="#999" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </button>

        {/* Eraser tool group */}
        <div style={{ display: 'flex', position: 'relative' }}>
          <button
            onClick={() => {
              setDrawingTool(drawingTool === 'eraser' ? 'none' : 'eraser')
              setGeometryTool('none') // Deactivate geometry tools
              cancelCreation() // Cancel geometry creation state
              setShowPenSettings(false)
              setShowHighlighterSettings(false)
              setShowEraserSettings(false)
              setShowColorPopup(false)
            }}
            style={{
              ...buttonStyle,
              backgroundColor: drawingTool === 'eraser' ? 'rgba(255, 107, 107, 0.95)' : 'rgba(255, 255, 255, 0.95)',
              borderTopRightRadius: 0,
              borderBottomRightRadius: 0,
            }}
            title="Eraser tool - Click and drag over objects to delete (hover shows preview)"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M20 20H7L3 16C2.4 15.4 2.4 14.6 3 14L14 3C14.6 2.4 15.4 2.4 16 3L21 8C21.6 8.6 21.6 9.4 21 10L10 21" stroke="#555" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
              <path d="M3.5 14.5L9.5 20.5" stroke="#555" strokeWidth="1.5" strokeLinecap="round"/>
              <rect x="3" y="14" width="7" height="7" rx="1" transform="rotate(-45 6.5 17.5)" fill="#FFB4B4" opacity="0.6"/>
              <line x1="7" y1="21" x2="20" y2="21" stroke="#555" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>

          {/* Eraser thickness button */}
          <button
            onClick={(e) => {
              e.stopPropagation()
              setShowEraserSettings(!showEraserSettings)
              setShowPenSettings(false)
              setShowHighlighterSettings(false)
              setShowColorPopup(false)
            }}
            style={{
              ...buttonStyle,
              borderTopLeftRadius: 0,
              borderBottomLeftRadius: 0,
              borderLeft: 'none',
              width: '28px',
              minWidth: '28px',
              padding: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            title={`Eraser thickness: ${eraserThickness}px`}
          >
            {/* Water droplet style icon */}
            <div style={{
              position: 'relative',
              width: `${Math.min(eraserThickness / 2, 16)}px`,
              height: `${Math.min(eraserThickness / 2, 16)}px`,
            }}>
              {/* Main droplet body */}
              <div style={{
                position: 'absolute',
                width: '100%',
                height: '100%',
                borderRadius: '50%',
                backgroundColor: 'rgba(100, 200, 255, 0.15)',
                border: '2px solid rgba(100, 200, 255, 0.4)',
              }} />
              {/* Inner glow */}
              <div style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                width: 'calc(100% - 8px)',
                height: 'calc(100% - 8px)',
                borderRadius: '50%',
                backgroundColor: 'rgba(180, 230, 255, 0.2)',
              }} />
              {/* Top left highlight */}
              <div style={{
                position: 'absolute',
                top: '20%',
                left: '20%',
                width: '25%',
                height: '25%',
                borderRadius: '50%',
                backgroundColor: 'rgba(255, 255, 255, 0.6)',
              }} />
              {/* Smaller highlight */}
              <div style={{
                position: 'absolute',
                top: '30%',
                right: '20%',
                width: '15%',
                height: '15%',
                borderRadius: '50%',
                backgroundColor: 'rgba(255, 255, 255, 0.4)',
              }} />
            </div>
          </button>

          {/* Eraser thickness picker popup */}
          {showEraserSettings && (
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                position: 'absolute',
                top: '42px',
                left: '0',
                backgroundColor: 'rgba(255, 255, 255, 0.98)',
                border: '1px solid #ccc',
                borderRadius: '8px',
                padding: '8px',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                zIndex: 100,
                minWidth: '100px',
                pointerEvents: 'auto',
              }}>
              {[10, 20, 30, 40, 50, 60, 80, 100].map(thickness => (
                <button
                  key={thickness}
                  onClick={() => {
                    setEraserThickness(thickness)
                    setShowEraserSettings(false)
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    width: '100%',
                    padding: '8px 12px',
                    marginBottom: '4px',
                    border: eraserThickness === thickness ? '2px solid #ff6b6b' : '1px solid #ddd',
                    borderRadius: '4px',
                    backgroundColor: eraserThickness === thickness ? 'rgba(255, 107, 107, 0.1)' : '#fff',
                    cursor: 'pointer',
                    fontSize: '12px',
                  }}
                >
                  <span>{thickness}px</span>
                  {/* Water droplet style icon */}
                  <div style={{
                    position: 'relative',
                    width: `${Math.min(thickness / 2, 20)}px`,
                    height: `${Math.min(thickness / 2, 20)}px`,
                  }}>
                    {/* Main droplet body */}
                    <div style={{
                      position: 'absolute',
                      width: '100%',
                      height: '100%',
                      borderRadius: '50%',
                      backgroundColor: 'rgba(100, 200, 255, 0.15)',
                      border: '2px solid rgba(100, 200, 255, 0.4)',
                    }} />
                    {/* Inner glow */}
                    <div style={{
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      transform: 'translate(-50%, -50%)',
                      width: 'calc(100% - 8px)',
                      height: 'calc(100% - 8px)',
                      borderRadius: '50%',
                      backgroundColor: 'rgba(180, 230, 255, 0.2)',
                    }} />
                    {/* Top left highlight */}
                    <div style={{
                      position: 'absolute',
                      top: '20%',
                      left: '20%',
                      width: '25%',
                      height: '25%',
                      borderRadius: '50%',
                      backgroundColor: 'rgba(255, 255, 255, 0.6)',
                    }} />
                    {/* Smaller highlight */}
                    <div style={{
                      position: 'absolute',
                      top: '30%',
                      right: '20%',
                      width: '15%',
                      height: '15%',
                      borderRadius: '50%',
                      backgroundColor: 'rgba(255, 255, 255, 0.4)',
                    }} />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Text tool button */}
        <button
          onClick={() => {
            setDrawingTool(drawingTool === 'text' ? 'none' : 'text')
            setGeometryTool('none') // Deactivate geometry tools
            cancelCreation() // Cancel geometry creation state
            setShowPenSettings(false)
            setShowHighlighterSettings(false)
            setShowEraserSettings(false)
            setShowColorPopup(false)
          }}
          style={{
            ...buttonStyle,
            backgroundColor: drawingTool === 'text' ? 'rgba(78, 205, 196, 0.95)' : 'rgba(255, 255, 255, 0.95)',
            fontSize: '20px',
            fontWeight: 'bold',
          }}
          title="Text tool - Click on canvas to add text"
        >
          T
        </button>

        {/* Clear drawings button */}
        <button
          onMouseDown={(e) => {
            console.log('Trash button mousedown!')
            e.preventDefault()
            e.stopPropagation()
            setTrashSwipeDrag({ startY: e.clientY, currentY: e.clientY })
          }}
          onTouchStart={(e) => {
            const touch = e.touches[0]
            setTrashSwipeDrag({ startY: touch.clientY, currentY: touch.clientY })
          }}
          onTouchMove={(e) => {
            if (trashSwipeDrag) {
              const touch = e.touches[0]
              setTrashSwipeDrag({ ...trashSwipeDrag, currentY: touch.clientY })
            }
          }}
          onTouchEnd={(e) => {
            if (trashSwipeDrag && e.changedTouches.length > 0) {
              const touch = e.changedTouches[0]
              const swipeDistance = touch.clientY - trashSwipeDrag.startY
              if (swipeDistance > 50) {
                // Swiped down - clear all objects
                console.log('Clearing all objects!')
                clearAll()
                setCaptureMessage('모두 지워짐!')
                setTimeout(() => setCaptureMessage(null), 1000)
              } else if (Math.abs(swipeDistance) < 10) {
                // Just a tap - clear drawings only
                console.log('Clearing drawings only')
                clearDrawings()
              }
              setTrashSwipeDrag(null)
            }
          }}
          style={{
            ...buttonStyle,
            transform: trashSwipeDrag ? `translateY(${Math.min(trashSwipeDrag.currentY - trashSwipeDrag.startY, 50)}px)` : 'none',
            transition: trashSwipeDrag ? 'none' : 'all 0.2s',
            position: 'relative' as const,
            zIndex: 1000,
            pointerEvents: 'auto' as const,
          }}
          title="Clear all drawings (or swipe down to clear everything)"
        >
          🗑️
        </button>

        {/* Delete selected items button - only shown when items are selected */}
        {(selectedIds.length > 0 || textObjects.some(t => t.selected)) && (
          <button
            onClick={() => {
              console.log("Delete button (×) clicked, selectedIds:", selectedIds)
              // Delete selected items (try all types for each ID)
              selectedIds.forEach(id => {
                // Try to remove as drawing (stroke)
                const drawing = drawings.find(d => d.id === id)
                if (drawing) {
                  console.log(`Removing drawing ${id}`)
                  removeDrawing(id)
                }

                // Try to remove as geometry object
                const geometryObj = geometryObjects.find(obj => obj.id === id)
                if (geometryObj) {
                  console.log(`Removing geometry object ${id}`)
                  removeGeometryObject(id)
                }

                // Try to remove as image
                const image = images.find(img => img.id === id)
                if (image) {
                  console.log(`Removing image ${id}`)
                  removeImage(id)
                }
              })
              setSelectedIds([])

              // Delete selected text objects
              textObjects.filter(t => t.selected).forEach(t => {
                console.log(`Removing text object ${t.id}`)
                removeTextObject(t.id)
              })

              console.log("Delete completed")
            }}
            style={{
              ...buttonStyle,
              backgroundColor: 'rgba(255, 100, 100, 0.95)',
              color: '#fff',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(255, 80, 80, 1)'
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(255, 100, 100, 0.95)'
              e.currentTarget.style.boxShadow = '0 2px 6px rgba(0, 0, 0, 0.1)'
            }}
            title="Delete selected items"
          >
            ×
          </button>
        )}
      </div>

      {/* Selection tool help panel - disabled */}

      {/* Bottom-right button group: Zoom controls */}
      <div style={buttonGroupStyle({ bottom: '16px', right: '16px' })}>
        {/* Zoom in button */}
        <button
          onClick={() => {
            const centerX = canvasSize.width / 2
            const centerY = canvasSize.height / 2
            useStore.getState().zoom(1.2, centerX, centerY)
          }}
          style={buttonStyle}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 1)'
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.95)'
            e.currentTarget.style.boxShadow = '0 2px 6px rgba(0, 0, 0, 0.1)'
          }}
          title="Zoom in"
        >
          +
        </button>

        {/* Zoom out button */}
        <button
          onClick={() => {
            const centerX = canvasSize.width / 2
            const centerY = canvasSize.height / 2
            useStore.getState().zoom(0.8, centerX, centerY)
          }}
          style={buttonStyle}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 1)'
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.95)'
            e.currentTarget.style.boxShadow = '0 2px 6px rgba(0, 0, 0, 0.1)'
          }}
          title="Zoom out"
        >
          −
        </button>
      </div>

      {/* Point visibility mode dropdown - below home button - only show if there are points */}
      {geometryObjects.some(obj => obj.type === 'point') && (
        <div style={{ ...buttonGroupStyle({ top: '60px', right: '16px' }) }}>
          <select
            value={pointVisibilityMode}
            onChange={(e) => setPointVisibilityMode(e.target.value as 'hide' | 'show' | 'show-with-labels')}
            style={{
              ...buttonStyle,
              cursor: 'pointer',
              fontSize: '13px',
              padding: '6px 8px',
              minWidth: '120px',
            }}
            title="Point visibility mode"
          >
            <option value="hide">점 숨김</option>
            <option value="show">점 보기</option>
            <option value="show-with-labels">점+레이블</option>
          </select>
        </div>
      )}

      {/* Shape render mode dropdown - below point visibility - only show if there are shapes */}
      {geometryObjects.some(obj => obj.type === 'circle' || obj.type === 'polygon') && (
        <div style={{ ...buttonGroupStyle({ top: geometryObjects.some(obj => obj.type === 'point') ? '110px' : '60px', right: '16px' }) }}>
          <select
            value={shapeRenderMode}
            onChange={(e) => setShapeRenderMode(e.target.value as 'fill' | 'stroke' | 'both')}
            style={{
              ...buttonStyle,
              cursor: 'pointer',
              fontSize: '13px',
              padding: '6px 8px',
              minWidth: '120px',
            }}
            title="Shape render mode"
          >
            <option value="fill">면 보기</option>
            <option value="stroke">외곽선 보기</option>
            <option value="both">면+외곽선</option>
          </select>
        </div>
      )}

      {/* LaTeX labels for graph points */}
      {overlayCanvasRef.current && visibilityMode !== 'function-labels' && visibilityMode !== 'points-only' && graphPoints.map((point, index) => {
        if (!point.latexLabel) return null

        const canvas = overlayCanvasRef.current!
        const rect = canvas.getBoundingClientRect()
        const screen = graphToScreen(
          point.x,
          point.y,
          rect.width,
          rect.height,
          view
        )

        const labelLeft = screen.x + 8
        const labelTop = screen.y - 8

        return (
          <div
            key={`gp-${index}`}
            ref={(el) => {
              if (el) {
                // Measure actual rendered size and check overlap
                const labelRect = el.getBoundingClientRect()
                const canvasRect = canvas.getBoundingClientRect()

                // Convert to canvas-relative coordinates
                const labelCanvasLeft = labelRect.left - canvasRect.left
                const labelCanvasTop = labelRect.top - canvasRect.top
                const labelCanvasRight = labelCanvasLeft + labelRect.width
                const labelCanvasBottom = labelCanvasTop + labelRect.height

                let isCovered = false
                for (const image of images) {
                  const halfWidth = image.transform.a / 2
                  const halfHeight = image.transform.d / 2
                  const imgLeft = image.transform.e - halfWidth
                  const imgRight = image.transform.e + halfWidth
                  const imgTop = image.transform.f - halfHeight
                  const imgBottom = image.transform.f + halfHeight

                  // Check if rectangles overlap
                  if (!(labelCanvasRight < imgLeft || labelCanvasLeft > imgRight ||
                        labelCanvasBottom < imgTop || labelCanvasTop > imgBottom)) {
                    isCovered = true
                    break
                  }
                }

                // Update display based on actual overlap
                if (isCovered) {
                  el.style.display = 'none'
                } else {
                  el.style.display = 'block'
                }
              }
            }}
            style={{
              position: 'absolute',
              left: `${labelLeft}px`,
              top: `${labelTop}px`,
              pointerEvents: 'none',
              fontSize: '21px',
              fontWeight: 'bold',
              color: point.color || '#555555',
              backgroundColor: 'rgba(255, 255, 255, 0.9)',
              padding: '2px 6px',
              borderRadius: '3px',
              transform: 'translateY(-100%)',
            }}
            dangerouslySetInnerHTML={{
              __html: katex.renderToString(
                visibilityMode === 'labels-only' ? (point.customLabel || 'P') : point.latexLabel,
                {
                  throwOnError: false,
                  displayMode: false,
                }
              )
            }}
          />
        )
      })}
      {/* LaTeX labels for expression points */}
      {overlayCanvasRef.current && expressions.map((expr) => {
        if (expr.kind !== 'point' || !expr.point || !expr.visible) return null

        const canvas = overlayCanvasRef.current!
        const rect = canvas.getBoundingClientRect()
        const screen = graphToScreen(
          expr.point.x,
          expr.point.y,
          rect.width,
          rect.height,
          view
        )

        // Generate LaTeX label for the point
        const latexLabel = `\\left(${formatCoordLatex(expr.point.x)}, ${formatCoordLatex(expr.point.y)}\\right)`

        const labelLeft = screen.x + 8
        const labelTop = screen.y - 8

        return (
          <div
            key={`ep-${expr.id}`}
            ref={(el) => {
              if (el) {
                // Measure actual rendered size and check overlap
                const labelRect = el.getBoundingClientRect()
                const canvasRect = canvas.getBoundingClientRect()

                // Convert to canvas-relative coordinates
                const labelCanvasLeft = labelRect.left - canvasRect.left
                const labelCanvasTop = labelRect.top - canvasRect.top
                const labelCanvasRight = labelCanvasLeft + labelRect.width
                const labelCanvasBottom = labelCanvasTop + labelRect.height

                let isCovered = false
                for (const image of images) {
                  const halfWidth = image.transform.a / 2
                  const halfHeight = image.transform.d / 2
                  const imgLeft = image.transform.e - halfWidth
                  const imgRight = image.transform.e + halfWidth
                  const imgTop = image.transform.f - halfHeight
                  const imgBottom = image.transform.f + halfHeight

                  // Check if rectangles overlap
                  if (!(labelCanvasRight < imgLeft || labelCanvasLeft > imgRight ||
                        labelCanvasBottom < imgTop || labelCanvasTop > imgBottom)) {
                    isCovered = true
                    break
                  }
                }

                // Update display based on actual overlap
                if (isCovered) {
                  el.style.display = 'none'
                } else {
                  el.style.display = 'block'
                }
              }
            }}
            style={{
              position: 'absolute',
              left: `${labelLeft}px`,
              top: `${labelTop}px`,
              pointerEvents: 'none',
              fontSize: '21px',
              fontWeight: 'bold',
              color: expr.color,
              backgroundColor: 'rgba(255, 255, 255, 0.9)',
              padding: '2px 6px',
              borderRadius: '3px',
              transform: 'translateY(-100%)',
            }}
            dangerouslySetInnerHTML={{
              __html: katex.renderToString(latexLabel, {
                throwOnError: false,
                displayMode: false,
              })
            }}
          />
        )
      })}
      {/* Function labels - shown when visibilityMode is 'function-labels' */}
      {overlayCanvasRef.current && visibilityMode === 'function-labels' && expressions.map((expr, index) => {
        if (!expr.visible || expr.kind === 'point' || !expr.latex) return null

        const canvas = overlayCanvasRef.current!
        const rect = canvas.getBoundingClientRect()

        // Find a good position on the curve to place the label
        // Use a point near the right side of the visible area
        const xPos = view.center.x + (rect.width / view.scale) * 0.3

        let yPos = 0
        if (expr.kind === 'cartesian' && expr.input) {
          try {
            const compiled = compileExpression(expr.input)
            yPos = evaluateExpression(compiled, { x: xPos })
          } catch (e) {
            return null
          }
        } else if (expr.kind === 'implicit') {
          // For implicit functions, use center y
          yPos = view.center.y
        }

        if (!isFinite(yPos)) return null

        const screen = graphToScreen(xPos, yPos, rect.width, rect.height, view)

        // Check if the label position is within the canvas
        if (screen.x < 0 || screen.x > rect.width || screen.y < 0 || screen.y > rect.height) {
          return null
        }

        const labelLeft = screen.x + 12
        const labelTop = screen.y - 8

        return (
          <div
            key={`fn-${expr.id}`}
            style={{
              position: 'absolute',
              left: `${labelLeft}px`,
              top: `${labelTop}px`,
              pointerEvents: 'none',
              fontSize: '21px',
              fontWeight: 'bold',
              color: expr.color,
              backgroundColor: 'rgba(255, 255, 255, 0.9)',
              padding: '2px 6px',
              borderRadius: '3px',
              transform: 'translateY(-100%)',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
            }}
            dangerouslySetInnerHTML={{
              __html: katex.renderToString(expr.latex, {
                throwOnError: false,
                displayMode: false,
              })
            }}
          />
        )
      })}
      {/* Text objects */}
      {overlayCanvasRef.current && textObjects.map((textObj) => {
        const canvas = overlayCanvasRef.current!
        const rect = canvas.getBoundingClientRect()
        const screen = graphToScreen(textObj.x, textObj.y, rect.width, rect.height, view)

        // Hide text object when it's being edited
        if (editingTextId === textObj.id) {
          return null
        }

        return (
          <div
            key={textObj.id}
            style={{
              position: 'absolute',
              left: `${screen.x}px`,
              top: `${screen.y}px`,
              fontSize: `${textObj.fontSize}px`,
              color: textObj.color,
              fontWeight: 'bold',
              pointerEvents: 'auto',
              cursor: drawingTool === 'text' ? 'default' : 'move',
              userSelect: 'none',
              whiteSpace: 'pre-wrap',
              wordWrap: 'break-word',
              backgroundColor: 'rgba(255, 255, 255, 0.8)',
              padding: '4px 8px',
              borderRadius: '4px',
              border: textObj.selected ? '2px solid #4CAF50' : '1px solid rgba(0, 0, 0, 0.2)',
              zIndex: 1000,
              maxWidth: textObj.maxWidth ? `${textObj.maxWidth}px` : undefined,
              overflowWrap: 'break-word',
              lineHeight: '1.5',
              minHeight: 'fit-content',
              height: 'auto',
            }}
            onMouseDown={(e) => {
              e.stopPropagation()
              // Allow dragging unless text tool is active
              if (drawingTool !== 'text') {
                // Start dragging immediately
                draggingTextRef.current = {
                  textId: textObj.id,
                  startMouseX: e.clientX - rect.left,
                  startMouseY: e.clientY - rect.top,
                  startTextX: textObj.x,
                  startTextY: textObj.y,
                }
                setIsDraggingText(true)
                // Select this text object
                updateTextObject(textObj.id, { selected: true })
              }
            }}
          >
            {textObj.text}
            {/* Edit icon - only show when selected and not editing */}
            {textObj.selected && editingTextId !== textObj.id && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  // Enter edit mode
                  setEditingTextId(textObj.id)
                  setTextInputValue(textObj.text)
                  setTextInputPosition({ x: screen.x, y: screen.y })
                  // Use existing maxWidth or calculate from text
                  const initialWidth = textObj.maxWidth || calculateTextWidth(textObj.text, textObj.fontSize)
                  setTextareaWidth(initialWidth)
                  setEditingFontSize(textObj.fontSize)
                  setEditingColor(textObj.color)
                  setTextInputVisible(true)
                  setTimeout(() => textInputRef.current?.focus(), 10)
                }}
                onMouseDown={(e) => {
                  // Prevent drag when clicking edit icon
                  e.stopPropagation()
                }}
                style={{
                  position: 'absolute',
                  top: '-5px',
                  right: '-5px',
                  width: '16px',
                  height: '16px',
                  borderRadius: '50%',
                  backgroundColor: 'rgba(78, 205, 196, 0.95)',
                  border: '1px solid rgba(0, 0, 0, 0.2)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '8px',
                  padding: 0,
                  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.2)',
                }}
                title="Edit text"
              >
                ✏️
              </button>
            )}
          </div>
        )
      })}
      {/* Text input field */}
      {textInputVisible && (() => {
        return (
          <div
            ref={editingContainerRef}
            style={{
              position: 'absolute',
              left: `${textInputPosition.x}px`,
              top: `${textInputPosition.y}px`,
              zIndex: 1000,
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
            }}
          >
            {/* Font size and color controls */}
            <div style={{
              display: 'flex',
              gap: '4px',
              backgroundColor: 'rgba(255, 255, 255, 0.95)',
              padding: '4px',
              borderRadius: '4px',
              border: '1px solid #4CAF50',
            }}>
              {/* Font size buttons */}
              <button
                onClick={() => setEditingFontSize(Math.max(12, editingFontSize - 2))}
                onMouseDown={(e) => e.preventDefault()}
                style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '4px',
                  border: '1px solid #ddd',
                  backgroundColor: '#fff',
                  cursor: 'pointer',
                  fontSize: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                title="Decrease font size"
              >
                -
              </button>
              <span style={{
                fontSize: '12px',
                padding: '0 4px',
                display: 'flex',
                alignItems: 'center',
                minWidth: '32px',
                justifyContent: 'center',
              }}>
                {editingFontSize}px
              </span>
              <button
                onClick={() => setEditingFontSize(Math.min(48, editingFontSize + 2))}
                onMouseDown={(e) => e.preventDefault()}
                style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '4px',
                  border: '1px solid #ddd',
                  backgroundColor: '#fff',
                  cursor: 'pointer',
                  fontSize: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                title="Increase font size"
              >
                +
              </button>
              {/* Color picker */}
              <input
                type="color"
                value={editingColor}
                onChange={(e) => setEditingColor(e.target.value)}
                onMouseDown={(e) => e.stopPropagation()}
                style={{
                  width: '32px',
                  height: '24px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  cursor: 'pointer',
                }}
                title="Change text color"
              />
            </div>
            {/* Textarea and resize handle */}
            <div style={{
              display: 'flex',
              alignItems: 'stretch',
            }}>
              <textarea
              ref={textInputRef}
              value={textInputValue}
              onChange={(e) => {
                setTextInputValue(e.target.value)
                // Auto-resize textarea height based on content
                const textarea = e.target
                textarea.style.height = 'auto'
                const newHeight = Math.max(40, textarea.scrollHeight)
                textarea.style.height = `${newHeight}px`
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleTextInputSubmit()
                } else if (e.key === 'Escape') {
                  setTextInputVisible(false)
                  setTextInputValue('')
                  setEditingTextId(null)
                }
              }}
              onBlur={(e) => {
                setTimeout(() => {
                  // Check if focus moved to an element within the editing container
                  const relatedTarget = e.relatedTarget as HTMLElement
                  if (relatedTarget && editingContainerRef.current?.contains(relatedTarget)) {
                    // Focus moved within editing area, don't submit
                    return
                  }

                  // Focus moved outside editing area, submit or cancel
                  if (textInputValue.trim()) {
                    handleTextInputSubmit()
                  } else {
                    setTextInputVisible(false)
                    setTextInputValue('')
                    setEditingTextId(null)
                  }
                }, 100)
              }}
              style={{
                padding: '4px 8px',
                fontSize: `${editingFontSize}px`,
                fontWeight: 'bold',
                color: editingColor,
                border: '2px solid #4CAF50',
                borderRadius: '4px 0 0 4px',
                outline: 'none',
                width: `${textareaWidth}px`,
                minHeight: '40px',
                resize: 'none',
                overflow: 'hidden',
                fontFamily: 'inherit',
                lineHeight: '1.5',
                backgroundColor: 'rgba(255, 255, 255, 0.8)',
                whiteSpace: 'pre-wrap',
                wordWrap: 'break-word',
              }}
              placeholder="텍스트 입력..."
            />
            {/* Resize handle */}
            <div
              onMouseDown={(e) => {
                e.preventDefault()
                e.stopPropagation()
                setIsResizingTextarea(true)
                resizeStartXRef.current = e.clientX
                resizeStartWidthRef.current = textareaWidth
              }}
              style={{
                width: '8px',
                backgroundColor: 'rgba(78, 205, 196, 0.5)',
                cursor: 'ew-resize',
                borderRadius: '0 4px 4px 0',
                border: '2px solid #4CAF50',
                borderLeft: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                userSelect: 'none',
              }}
            >
              <div style={{
                width: '2px',
                height: '20px',
                backgroundColor: '#4CAF50',
                borderRadius: '1px',
              }} />
            </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
