import { getStroke } from 'perfect-freehand'
import { BrushStabilizer } from './src/features/brush/BrushStabilizer.ts'

const canvas = document.getElementById('canvas')
const ctx = canvas.getContext('2d')
const colorPicker = document.getElementById('colorPicker')
const brushSize = document.getElementById('brushSize')
const sizeDisplay = document.getElementById('sizeDisplay')
const toolbar = document.querySelector('.toolbar')
const captureBtn = document.getElementById('captureBtn')
const captureMenu = document.getElementById('captureMenu')
const toast = document.getElementById('toast')

// Toast notification function
function showToast(message) {
  toast.textContent = message
  toast.classList.add('show')

  setTimeout(() => {
    toast.classList.remove('show')
  }, 2000)
}

// Clear all canvas function
window.clearAllCanvas = function() {
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  saveState()
  showToast('화면이 모두 지워졌습니다')
}

// Set canvas size to full screen
function resizeCanvas() {
  const width = window.innerWidth || document.documentElement.clientWidth || document.body.clientWidth
  const height = window.innerHeight || document.documentElement.clientHeight || document.body.clientHeight

  // Save current canvas content only if canvas is initialized
  let imageData = null
  if (canvas.width > 0 && canvas.height > 0) {
    try {
      imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    } catch (e) {
      console.warn('Failed to save canvas content:', e)
    }
  }

  canvas.width = width
  canvas.height = height
  canvas.style.width = width + 'px'
  canvas.style.height = height + 'px'

  // Restore canvas content if it was saved
  if (imageData) {
    try {
      ctx.putImageData(imageData, 0, 0)
    } catch (e) {
      console.warn('Failed to restore canvas content:', e)
    }
  }

  console.log('Canvas resized to:', canvas.width, 'x', canvas.height)
}

// Initial resize
resizeCanvas()
window.addEventListener('load', resizeCanvas)
window.addEventListener('resize', resizeCanvas)

// Force multiple resizes for Electron timing
setTimeout(resizeCanvas, 100)
setTimeout(resizeCanvas, 300)
setTimeout(resizeCanvas, 1000)

// Save initial blank state after load
window.addEventListener('load', () => {
  setTimeout(() => {
    saveState()
  }, 1100) // After all resizes
})

// Drawing state
let isDrawing = false
let startX = 0
let startY = 0
let lastX = 0
let lastY = 0
let currentColor = '#000000'
let currentSize = 3
let eraserSize = 20
let currentTool = 'none'
let tempCanvas = null
let captureMode = false
let currentPoints = [] // For Perfect Freehand
let drawingRenderFrame = null // For RAF throttling
let pendingDrawingUpdate = false

// Brush stabilizer instance
// Disabled for better real-time responsiveness in writing window
const brushStabilizer = new BrushStabilizer({
  mode: 'none',
  queueSize: 10,
  delayDistance: 10,
  finishStabilizer: true,
  stabilizeSensors: true,
  zoomLevel: 1.0
})

// Undo/Redo state
let history = []
let historyStep = -1
const MAX_HISTORY = 50

// Log that Perfect Freehand is loaded
console.log('Perfect Freehand loaded successfully')
console.log('Brush stabilizer initialized (mode: none for better real-time responsiveness)')

// History management functions
function saveState() {
  // Remove any states after current step (when new action after undo)
  historyStep++
  history = history.slice(0, historyStep)

  // Save current canvas state
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
  history.push(imageData)

  // Limit history size
  if (history.length > MAX_HISTORY) {
    history.shift()
    historyStep--
  }

  updateUndoRedoButtons()
}

window.undo = function() {
  if (historyStep > 0) {
    historyStep--
    const imageData = history[historyStep]
    ctx.putImageData(imageData, 0, 0)
    updateUndoRedoButtons()
  }
}

window.redo = function() {
  if (historyStep < history.length - 1) {
    historyStep++
    const imageData = history[historyStep]
    ctx.putImageData(imageData, 0, 0)
    updateUndoRedoButtons()
  }
}

function updateUndoRedoButtons() {
  const undoBtn = document.getElementById('undoBtn')
  const redoBtn = document.getElementById('redoBtn')

  if (undoBtn) {
    undoBtn.disabled = historyStep <= 0
  }
  if (redoBtn) {
    redoBtn.disabled = historyStep >= history.length - 1
  }
}

function getSvgPathFromStroke(stroke) {
  if (!stroke.length) return ''

  const d = stroke.reduce(
    (acc, [x0, y0], i, arr) => {
      const [x1, y1] = arr[(i + 1) % arr.length]
      acc.push(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2)
      return acc
    },
    ['M', ...stroke[0], 'Q']
  )

  d.push('Z')
  return d.join(' ')
}

function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

function drawStrokePath(path, color, opacity = 1.0) {
  ctx.save()
  ctx.fillStyle = color
  ctx.globalAlpha = opacity
  const p = new Path2D(path)
  ctx.fill(p)
  ctx.restore()
}

// Update mouse event passthrough based on tool state
function updateMouseEvents() {
  // captureMode일 때는 항상 마우스 이벤트를 받아야 함 (ignore = false)
  const shouldIgnore = currentTool === 'none' && !captureMode
  if (window.electron?.setIgnoreMouseEvents) {
    window.electron.setIgnoreMouseEvents(shouldIgnore)
  }
}

// Set initial state: passthrough mouse events
window.addEventListener('load', () => {
  updateMouseEvents()
})

// Toolbar mouse events: temporarily enable clicks when hovering over toolbar
toolbar.addEventListener('mouseenter', () => {
  if (currentTool === 'none' && window.electron?.setIgnoreMouseEvents) {
    window.electron.setIgnoreMouseEvents(false)
  }
})

toolbar.addEventListener('mouseleave', () => {
  updateMouseEvents()
})

// Capture menu mouse events
captureMenu.addEventListener('mouseenter', () => {
  if (currentTool === 'none' && window.electron?.setIgnoreMouseEvents) {
    window.electron.setIgnoreMouseEvents(false)
  }
})

captureMenu.addEventListener('mouseleave', () => {
  updateMouseEvents()
})

// Update brush size display
brushSize.addEventListener('input', (e) => {
  currentSize = parseInt(e.target.value)
  sizeDisplay.textContent = currentSize
})

// Update color
colorPicker.addEventListener('input', (e) => {
  currentColor = e.target.value
})

// Tool selection with toggle functionality
window.setTool = function(tool) {
  console.log('setTool called:', tool, '-> current:', currentTool)

  // Toggle: if same tool is clicked again, deactivate it
  if (currentTool === tool) {
    currentTool = 'none'
  } else {
    currentTool = tool
  }

  console.log('Tool changed to:', currentTool)

  // Update button active states
  document.querySelectorAll('.tool-button').forEach(btn => btn.classList.remove('active'))

  const toolButtons = {
    'pen': 'penBtn',
    'highlighter': 'highlighterBtn',
    'arrow': 'arrowBtn',
    'line': 'lineBtn',
    'rectangle': 'rectangleBtn',
    'eraser': 'eraserBtn'
  }

  if (currentTool !== 'none' && toolButtons[currentTool]) {
    document.getElementById(toolButtons[currentTool]).classList.add('active')
  }

  // Update cursor with custom icons
  canvas.className = '' // Clear all classes first

  if (currentTool === 'none') {
    canvas.className = 'default-cursor'
  } else if (currentTool === 'pen') {
    canvas.className = 'pen-cursor'
  } else if (currentTool === 'highlighter') {
    canvas.className = 'highlighter-cursor'
  } else if (currentTool === 'arrow') {
    canvas.className = 'arrow-cursor'
  } else if (currentTool === 'line') {
    canvas.className = 'line-cursor'
  } else if (currentTool === 'rectangle') {
    canvas.className = 'rectangle-cursor'
  } else if (currentTool === 'eraser') {
    canvas.className = 'eraser-cursor'
  }

  // Update mouse event passthrough
  updateMouseEvents()
}

// Drawing functions
function startDrawing(e) {
  console.log('startDrawing called, currentTool:', currentTool, 'captureMode:', captureMode)

  if (captureMode || currentTool === 'none') {
    console.log('startDrawing blocked - captureMode or tool is none')
    return
  }

  isDrawing = true
  startX = e.clientX
  startY = e.clientY
  lastX = e.clientX
  lastY = e.clientY

  console.log('Drawing started at:', startX, startY)

  // Save current canvas state for all drawing tools
  if (currentTool !== 'eraser') {
    tempCanvas = ctx.getImageData(0, 0, canvas.width, canvas.height)
  }

  // Initialize points array for pen and highlighter
  if (currentTool === 'pen' || currentTool === 'highlighter') {
    currentPoints = [[e.clientX, e.clientY, 0.5]] // Start with first point
    // Start brush stabilizer (currently disabled for better responsiveness)
    brushStabilizer.startStroke()
    console.log('Initialized points for pen/highlighter')
  }
}

function draw(e) {
  if (!isDrawing || captureMode) return

  const x = e.clientX
  const y = e.clientY

  if (currentTool === 'pen' || currentTool === 'highlighter') {
    // Check distance to last point
    let shouldAddPoint = true
    if (currentPoints.length > 0) {
      const lastPoint = currentPoints[currentPoints.length - 1]
      const dx = x - lastPoint[0]
      const dy = y - lastPoint[1]
      const distance = Math.sqrt(dx * dx + dy * dy)

      // Skip adding point if too close, but still trigger RAF to render existing points
      if (distance < 2) { // Reduced from 3 for smoother strokes
        shouldAddPoint = false
      }
    }

    // Add point to array if far enough
    if (shouldAddPoint) {
      currentPoints.push([x, y, 0.5])
    }

    // Always request RAF even if we didn't add a point (to render pending points)
    pendingDrawingUpdate = true

    // Use requestAnimationFrame to throttle rendering (same as main graph)
    if (drawingRenderFrame === null) {
      drawingRenderFrame = requestAnimationFrame(() => {
        if (!pendingDrawingUpdate) {
          drawingRenderFrame = null
          return
        }

        // Use Perfect Freehand to generate smooth stroke
        if (currentPoints.length > 1) {
          const size = currentSize

          // Optimized settings matching main graph (0.5 smoothing, 0.15 streamline)
          const stroke = getStroke(currentPoints, {
            size: size,
            thinning: 0,
            smoothing: 0.5,  // Reduced from 0.8 for better responsiveness
            streamline: 0.15,  // Reduced from 0.3 to minimize lag
            easing: (t) => t,
            start: { taper: 0, cap: true },
            end: { taper: 0, cap: true },
          })

          const pathData = getSvgPathFromStroke(stroke)

          // Clear and redraw entire stroke
          if (tempCanvas) {
            ctx.putImageData(tempCanvas, 0, 0)
          }

          // Apply transparency for highlighter using fillStyle (like main graph)
          if (currentTool === 'highlighter') {
            ctx.save()
            ctx.fillStyle = hexToRgba(currentColor, 0.3)
            const p = new Path2D(pathData)
            ctx.fill(p)
            ctx.restore()
          } else {
            drawStrokePath(pathData, currentColor, 1.0)
          }
        }

        pendingDrawingUpdate = false
        drawingRenderFrame = null
      })
    }

    lastX = x
    lastY = y
  } else if (currentTool === 'eraser') {
    // Eraser
    ctx.globalCompositeOperation = 'destination-out'
    ctx.beginPath()
    ctx.arc(x, y, eraserSize, 0, Math.PI * 2)
    ctx.fill()
    ctx.globalCompositeOperation = 'source-over'

    lastX = x
    lastY = y
  } else {
    // For shapes, restore canvas and draw preview
    if (tempCanvas) {
      ctx.putImageData(tempCanvas, 0, 0)
    }

    ctx.strokeStyle = currentColor
    ctx.lineWidth = currentSize
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'

    if (currentTool === 'line') {
      drawLine(startX, startY, x, y)
    } else if (currentTool === 'arrow') {
      drawArrow(startX, startY, x, y)
    } else if (currentTool === 'rectangle') {
      drawRectangle(startX, startY, x, y)
    }
  }
}

function stopDrawing(e) {
  if (!isDrawing || captureMode) return

  // Cancel any pending RAF for drawing
  if (drawingRenderFrame !== null) {
    cancelAnimationFrame(drawingRenderFrame)
    drawingRenderFrame = null
    pendingDrawingUpdate = false
  }

  // Get remaining stabilized points when finishing stroke
  if (currentTool === 'pen' || currentTool === 'highlighter') {
    const remainingPoints = brushStabilizer.endStroke()

    // Add remaining points to currentPoints
    for (const point of remainingPoints) {
      currentPoints.push([point.x, point.y, point.pressure || 0.5])
    }

    // Redraw final stroke with all points using optimized settings
    if (currentPoints.length > 1 && tempCanvas) {
      const size = currentSize

      const stroke = getStroke(currentPoints, {
        size: size,
        thinning: 0,
        smoothing: 0.5,  // Optimized setting
        streamline: 0.15,  // Optimized setting
        easing: (t) => t,
        start: { taper: 0, cap: true },
        end: { taper: 0, cap: true },
      })

      const pathData = getSvgPathFromStroke(stroke)

      // Clear and redraw final stroke
      ctx.putImageData(tempCanvas, 0, 0)

      // Apply transparency for highlighter
      if (currentTool === 'highlighter') {
        ctx.save()
        ctx.fillStyle = hexToRgba(currentColor, 0.3)
        const p = new Path2D(pathData)
        ctx.fill(p)
        ctx.restore()
      } else {
        drawStrokePath(pathData, currentColor, 1.0)
      }
    }
  }

  isDrawing = false
  tempCanvas = null
  currentPoints = []

  // Save state for undo/redo
  saveState()
}

function drawLine(x1, y1, x2, y2) {
  ctx.beginPath()
  ctx.moveTo(x1, y1)
  ctx.lineTo(x2, y2)
  ctx.stroke()
}

function drawArrow(x1, y1, x2, y2) {
  const headLength = 15 + currentSize * 2
  const angle = Math.atan2(y2 - y1, x2 - x1)

  // Draw line
  ctx.beginPath()
  ctx.moveTo(x1, y1)
  ctx.lineTo(x2, y2)
  ctx.stroke()

  // Draw arrow head
  ctx.beginPath()
  ctx.moveTo(x2, y2)
  ctx.lineTo(x2 - headLength * Math.cos(angle - Math.PI / 6), y2 - headLength * Math.sin(angle - Math.PI / 6))
  ctx.moveTo(x2, y2)
  ctx.lineTo(x2 - headLength * Math.cos(angle + Math.PI / 6), y2 - headLength * Math.sin(angle + Math.PI / 6))
  ctx.stroke()
}

function drawRectangle(x1, y1, x2, y2) {
  ctx.strokeRect(x1, y1, x2 - x1, y2 - y1)
}

// Event listeners for drawing
canvas.addEventListener('mousedown', startDrawing)
canvas.addEventListener('mousemove', draw)
canvas.addEventListener('mouseup', stopDrawing)
canvas.addEventListener('mouseout', stopDrawing)

// Capture dropdown toggle
captureBtn.addEventListener('click', (e) => {
  e.stopPropagation()
  captureMenu.classList.toggle('show')
})

// Close dropdown when clicking outside
document.addEventListener('click', (e) => {
  if (!captureBtn.contains(e.target) && !captureMenu.contains(e.target)) {
    captureMenu.classList.remove('show')
  }
})

// Capture functions
window.captureFullScreen = async function() {
  captureMenu.classList.remove('show')

  try {
    console.log('Starting full screen capture...')

    // Check if electron API is available
    if (!window.electron?.captureScreen) {
      showToast('캡처 기능을 사용할 수 없습니다')
      console.error('captureScreen API not available')
      return
    }

    // Capture the actual screen background
    console.log('Capturing screen...')
    const screenDataUrl = await window.electron.captureScreen()

    if (!screenDataUrl) {
      showToast('화면 캡처 실패: 스크린 데이터 없음')
      console.error('captureScreen returned empty')
      return
    }

    console.log('Screen captured, compositing...')

    // Create a temporary canvas to composite background + drawing
    const compositeCanvas = document.createElement('canvas')
    compositeCanvas.width = canvas.width
    compositeCanvas.height = canvas.height
    const compositeCtx = compositeCanvas.getContext('2d')

    if (!compositeCtx) {
      showToast('캔버스 생성 실패')
      return
    }

    // Load background image
    console.log('Loading background image...')
    const bgImage = new Image()

    try {
      await new Promise((resolve, reject) => {
        bgImage.onload = () => {
          console.log('Background image loaded')
          console.log('Background image size:', bgImage.width, 'x', bgImage.height)
          console.log('Canvas size:', canvas.width, 'x', canvas.height)
          resolve()
        }
        bgImage.onerror = (e) => {
          console.error('Background image load error:', e)
          reject(new Error('배경 이미지 로드 실패'))
        }
        bgImage.src = screenDataUrl
      })
    } catch (e) {
      showToast('배경 이미지 로드 실패')
      console.error(e)
      return
    }

    // Draw background (scale to canvas size)
    console.log('Drawing composite...')
    compositeCtx.drawImage(bgImage, 0, 0, canvas.width, canvas.height)

    // Draw canvas content on top
    compositeCtx.drawImage(canvas, 0, 0)

    // Get composite as data URL
    const dataUrl = compositeCanvas.toDataURL('image/png')

    // Copy to clipboard
    console.log('Copying to clipboard...')
    if (window.electron?.copyImageToClipboard) {
      const clipboardResult = await window.electron.copyImageToClipboard(dataUrl)
      if (clipboardResult.success) {
        console.log('Copied to clipboard')
      } else {
        console.error('Clipboard copy failed:', clipboardResult.error)
      }
    }

    // Generate filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)
    const filename = `capture_${timestamp}.png`

    console.log('Saving image...')

    // Save image using electron API
    if (window.electron?.saveImage) {
      const result = await window.electron.saveImage(dataUrl, filename)
      if (result.success) {
        console.log('Image saved successfully')
        showToast(`저장됨: ${filename} (클립보드에 복사됨)`)
      } else {
        showToast('이미지 저장 실패: ' + result.error)
        console.error('Save error:', result.error)
      }
    } else {
      showToast('저장 기능을 사용할 수 없습니다')
    }
  } catch (error) {
    console.error('Capture error:', error)
    showToast('캡처 중 오류: ' + error.message)
  }
}

window.startRectCapture = function() {
  captureMenu.classList.remove('show')
  captureMode = true
  canvas.style.cursor = 'crosshair'

  // Update mouse events to ensure we can capture
  updateMouseEvents()

  let captureStartX = 0
  let captureStartY = 0
  let isSelecting = false
  let overlay = null

  const handleCaptureMouseDown = (e) => {
    isSelecting = true
    captureStartX = e.clientX
    captureStartY = e.clientY

    // Save current canvas
    overlay = ctx.getImageData(0, 0, canvas.width, canvas.height)
  }

  const handleCaptureMouseMove = (e) => {
    if (!isSelecting) return

    // Restore canvas
    if (overlay) {
      ctx.putImageData(overlay, 0, 0)
    }

    // Draw selection rectangle
    ctx.strokeStyle = '#2196f3'
    ctx.lineWidth = 2
    ctx.setLineDash([5, 5])
    ctx.strokeRect(captureStartX, captureStartY, e.clientX - captureStartX, e.clientY - captureStartY)
    ctx.setLineDash([])
  }

  const handleCaptureMouseUp = async (e) => {
    if (!isSelecting) return

    // Stop selecting immediately to prevent further drawing
    isSelecting = false

    const x1 = Math.min(captureStartX, e.clientX)
    const y1 = Math.min(captureStartY, e.clientY)
    const width = Math.abs(e.clientX - captureStartX)
    const height = Math.abs(e.clientY - captureStartY)

    // Always restore original canvas to clean up selection rectangle
    if (overlay) {
      ctx.putImageData(overlay, 0, 0)
    }

    if (width > 10 && height > 10) {
      try {
        // Capture the actual screen background
        const screenDataUrl = await window.electron?.captureScreen()

        if (!screenDataUrl) {
          showToast('화면 캡처 실패')
          return
        }

        // Create composite canvas for the selected region
        const tempCanvas = document.createElement('canvas')
        tempCanvas.width = width
        tempCanvas.height = height
        const tempCtx = tempCanvas.getContext('2d')

        // Load background image
        const bgImage = new Image()
        await new Promise((resolve, reject) => {
          bgImage.onload = resolve
          bgImage.onerror = reject
          bgImage.src = screenDataUrl
        })

        console.log('Background image size:', bgImage.width, 'x', bgImage.height)
        console.log('Canvas size:', canvas.width, 'x', canvas.height)
        console.log('Selection region:', x1, y1, width, height)

        // Calculate scaling factors
        const scaleX = bgImage.width / canvas.width
        const scaleY = bgImage.height / canvas.height

        console.log('Scale factors:', scaleX, scaleY)

        // Calculate the region in the background image coordinates
        const bgX = x1 * scaleX
        const bgY = y1 * scaleY
        const bgWidth = width * scaleX
        const bgHeight = height * scaleY

        console.log('Background region:', bgX, bgY, bgWidth, bgHeight)

        // Draw background region (scaled from background image)
        tempCtx.drawImage(bgImage, bgX, bgY, bgWidth, bgHeight, 0, 0, width, height)

        // Create temporary canvas for the drawing region
        const drawingCanvas = document.createElement('canvas')
        drawingCanvas.width = width
        drawingCanvas.height = height
        const drawingCtx = drawingCanvas.getContext('2d')

        // Copy drawing region
        const canvasRegion = ctx.getImageData(x1, y1, width, height)
        drawingCtx.putImageData(canvasRegion, 0, 0)

        // Draw canvas content on top of background
        tempCtx.drawImage(drawingCanvas, 0, 0)

        // Get as data URL
        const dataUrl = tempCanvas.toDataURL('image/png')

        // Copy to clipboard
        if (window.electron?.copyImageToClipboard) {
          const clipboardResult = await window.electron.copyImageToClipboard(dataUrl)
          if (clipboardResult.success) {
            console.log('Region copied to clipboard')
          } else {
            console.error('Clipboard copy failed:', clipboardResult.error)
          }
        }

        // Generate filename
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)
        const filename = `capture_region_${timestamp}.png`

        // Save image
        if (window.electron?.saveImage) {
          const result = await window.electron.saveImage(dataUrl, filename)
          if (result.success) {
            showToast(`저장됨: ${filename} (클립보드에 복사됨)`)
          } else {
            showToast('이미지 저장 실패: ' + result.error)
          }
        }
      } catch (error) {
        console.error('Region capture error:', error)
        showToast('영역 캡처 중 오류 발생')
      }
    }

    // Cleanup event listeners
    canvas.removeEventListener('mousedown', handleCaptureMouseDown)
    canvas.removeEventListener('mousemove', handleCaptureMouseMove)
    canvas.removeEventListener('mouseup', handleCaptureMouseUp)

    // Exit capture mode
    captureMode = false

    // Restore cursor based on current tool
    canvas.className = '' // Clear all classes first

    if (currentTool === 'none') {
      canvas.className = 'default-cursor'
    } else if (currentTool === 'pen') {
      canvas.className = 'pen-cursor'
    } else if (currentTool === 'highlighter') {
      canvas.className = 'highlighter-cursor'
    } else if (currentTool === 'arrow') {
      canvas.className = 'arrow-cursor'
    } else if (currentTool === 'line') {
      canvas.className = 'line-cursor'
    } else if (currentTool === 'rectangle') {
      canvas.className = 'rectangle-cursor'
    } else if (currentTool === 'eraser') {
      canvas.className = 'eraser-cursor'
    }

    // Update mouse events to restore previous state
    updateMouseEvents()
  }

  canvas.addEventListener('mousedown', handleCaptureMouseDown)
  canvas.addEventListener('mousemove', handleCaptureMouseMove)
  canvas.addEventListener('mouseup', handleCaptureMouseUp)
}

window.closeWindow = function() {
  window.close()
}

// Toolbar dragging
let isDraggingToolbar = false
let toolbarOffsetX = 0
let toolbarOffsetY = 0

toolbar.addEventListener('mousedown', (e) => {
  // Don't drag if clicking on a button or input
  if (e.target.tagName === 'BUTTON' || e.target.tagName === 'INPUT') {
    return
  }

  // Get actual position on screen using getBoundingClientRect
  const rect = toolbar.getBoundingClientRect()

  // Remove transform and convert to left/top positioning before dragging
  toolbar.style.transform = 'none'
  toolbar.style.left = rect.left + 'px'
  toolbar.style.top = rect.top + 'px'
  toolbar.style.right = 'auto'
  toolbar.style.bottom = 'auto'

  isDraggingToolbar = true
  toolbarOffsetX = e.clientX - rect.left
  toolbarOffsetY = e.clientY - rect.top
  toolbar.style.cursor = 'grabbing'
})

document.addEventListener('mousemove', (e) => {
  if (!isDraggingToolbar) return

  let newX = e.clientX - toolbarOffsetX
  let newY = e.clientY - toolbarOffsetY

  // Keep toolbar within window bounds
  newX = Math.max(0, Math.min(newX, window.innerWidth - toolbar.offsetWidth))
  newY = Math.max(0, Math.min(newY, window.innerHeight - toolbar.offsetHeight))

  toolbar.style.left = newX + 'px'
  toolbar.style.top = newY + 'px'
  toolbar.style.right = 'auto'
  toolbar.style.bottom = 'auto'
})

document.addEventListener('mouseup', (e) => {
  if (!isDraggingToolbar) return

  isDraggingToolbar = false
  toolbar.style.cursor = 'move'

  // Check if toolbar is near edges for docking
  const toolbarRect = toolbar.getBoundingClientRect()
  const windowWidth = window.innerWidth
  const windowHeight = window.innerHeight
  const snapDistance = 50

  const distanceToLeft = toolbarRect.left
  const distanceToRight = windowWidth - toolbarRect.right
  const distanceToTop = toolbarRect.top
  const distanceToBottom = windowHeight - toolbarRect.bottom

  // Determine which edge is closest
  const minDistance = Math.min(distanceToLeft, distanceToRight, distanceToTop, distanceToBottom)

  if (minDistance < snapDistance) {
    if (minDistance === distanceToTop) {
      // Snap to top - horizontal
      toolbar.classList.remove('vertical')
      toolbar.classList.add('horizontal')
      toolbar.style.top = '20px'
      toolbar.style.left = '50%'
      toolbar.style.transform = 'translateX(-50%)'
      toolbar.style.right = 'auto'
      toolbar.style.bottom = 'auto'
    } else if (minDistance === distanceToBottom) {
      // Snap to bottom - horizontal
      toolbar.classList.remove('vertical')
      toolbar.classList.add('horizontal')
      toolbar.style.bottom = '20px'
      toolbar.style.left = '50%'
      toolbar.style.transform = 'translateX(-50%)'
      toolbar.style.top = 'auto'
      toolbar.style.right = 'auto'
    } else if (minDistance === distanceToLeft) {
      // Snap to left - vertical
      toolbar.classList.remove('horizontal')
      toolbar.classList.add('vertical')
      toolbar.style.left = '20px'
      toolbar.style.top = '50%'
      toolbar.style.transform = 'translateY(-50%)'
      toolbar.style.right = 'auto'
      toolbar.style.bottom = 'auto'
    } else if (minDistance === distanceToRight) {
      // Snap to right - vertical
      toolbar.classList.remove('horizontal')
      toolbar.classList.add('vertical')
      toolbar.style.right = '20px'
      toolbar.style.top = '50%'
      toolbar.style.transform = 'translateY(-50%)'
      toolbar.style.left = 'auto'
      toolbar.style.bottom = 'auto'
    }
  } else {
    // Free floating - remove transform
    toolbar.style.transform = 'none'
  }
})

// Prevent toolbar from interfering with drawing
toolbar.addEventListener('mousedown', (e) => {
  e.stopPropagation()
})

// Touch support for canvas
canvas.addEventListener('touchstart', (e) => {
  if (captureMode) return
  e.preventDefault()
  const touch = e.touches[0]
  const mouseEvent = new MouseEvent('mousedown', {
    clientX: touch.clientX,
    clientY: touch.clientY
  })
  canvas.dispatchEvent(mouseEvent)
})

canvas.addEventListener('touchmove', (e) => {
  if (captureMode) return
  e.preventDefault()
  const touch = e.touches[0]
  const mouseEvent = new MouseEvent('mousemove', {
    clientX: touch.clientX,
    clientY: touch.clientY
  })
  canvas.dispatchEvent(mouseEvent)
})

canvas.addEventListener('touchend', (e) => {
  if (captureMode) return
  e.preventDefault()
  const mouseEvent = new MouseEvent('mouseup', {})
  canvas.dispatchEvent(mouseEvent)
})

// Keyboard shortcuts for undo/redo
document.addEventListener('keydown', (e) => {
  // Ctrl+Z: Undo
  if (e.ctrlKey && e.key === 'z' && !e.shiftKey) {
    e.preventDefault()
    window.undo()
  }
  // Ctrl+Y or Ctrl+Shift+Z: Redo
  else if (e.ctrlKey && (e.key === 'y' || (e.shiftKey && e.key === 'z'))) {
    e.preventDefault()
    window.redo()
  }
})
