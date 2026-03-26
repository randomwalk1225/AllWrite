import './App.css'
import './features/editor/ExpressionEditor.css'
import { useRef, useEffect, useCallback, useState } from 'react'
import { ExpressionEditor } from './features/editor/ExpressionEditor'
import { GeometryToolPanel } from './features/geometry/GeometryToolPanel'
import { RegularPolygonDialog } from './features/geometry/RegularPolygonDialog'
import { DivisionPointDialog } from './features/geometry/DivisionPointDialog'
import { RegularPolygonEditDialog } from './features/geometry/RegularPolygonEditDialog'
import { GraphCanvas } from './features/graph2d/GraphCanvas'
import { SplitPanel, SplitPanelHandle } from './ui/SplitPanel'
import { PanelTabs } from './ui/PanelTabs'
import { PageList } from './components/PageList'
import { BrushSettingsPanel } from './features/brush/BrushSettingsPanel'
import { useStore } from './store'
import { useIsMobile } from './hooks/useMediaQuery'
import { MobileSheet } from './ui/MobileSheet'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'

function App() {
  const isMobile = useIsMobile()
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false)
  const sidebarRef = useRef<HTMLDivElement>(null)
  const splitPanelRef = useRef<SplitPanelHandle>(null)
  const graphContainerRef = useRef<HTMLDivElement>(null)
  const writingButtonRef = useRef<HTMLButtonElement>(null)
  const deselectAllExpressions = useStore((state) => state.deselectAllExpressions)
  const activePanelTab = useStore((state) => state.activePanelTab)
  const pages = useStore((state) => state.pages)
  const currentPageIndex = useStore((state) => state.currentPageIndex)
  const addPage = useStore((state) => state.addPage)
  const removePage = useStore((state) => state.removePage)
  const switchPage = useStore((state) => state.switchPage)
  const [isExportingPDF, setIsExportingPDF] = useState(false)
  const [exportProgress, setExportProgress] = useState({ current: 0, total: 0 })

  const handle37Ratio = () => {
    splitPanelRef.current?.setThreeSevenRatio()
  }

  // Handle clicks outside the sidebar to deselect all expressions
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (sidebarRef.current && !sidebarRef.current.contains(event.target as Node)) {
        deselectAllExpressions()
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [deselectAllExpressions])

  // Handle keyboard shortcuts for page navigation
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Skip if user is typing in an input field
      const target = event.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return
      }

      // Ctrl+T: New page
      if (event.ctrlKey && event.key === 't') {
        event.preventDefault()
        addPage()
        return
      }

      // Ctrl+W: Close current page
      if (event.ctrlKey && event.key === 'w') {
        event.preventDefault()
        if (pages.length > 1) {
          removePage(currentPageIndex)
        }
        return
      }

      // Ctrl+Tab: Next page
      if (event.ctrlKey && event.key === 'Tab' && !event.shiftKey) {
        event.preventDefault()
        const nextIndex = (currentPageIndex + 1) % pages.length
        switchPage(nextIndex)
        return
      }

      // Ctrl+Shift+Tab: Previous page
      if (event.ctrlKey && event.shiftKey && event.key === 'Tab') {
        event.preventDefault()
        const prevIndex = (currentPageIndex - 1 + pages.length) % pages.length
        switchPage(prevIndex)
        return
      }

      // Ctrl+1-9: Jump to specific page
      if (event.ctrlKey && event.key >= '1' && event.key <= '9') {
        event.preventDefault()
        const pageIndex = parseInt(event.key) - 1
        if (pageIndex < pages.length) {
          switchPage(pageIndex)
        }
        return
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [pages, currentPageIndex, addPage, removePage, switchPage])


  const handleOpenWriting = () => {
    if (window.electron?.openWritingWindow) {
      window.electron.openWritingWindow()
    }
  }

  const exportAllPagesToPDF = useCallback(async () => {
    const originalPageIndex = currentPageIndex
    setIsExportingPDF(true)
    setExportProgress({ current: 0, total: pages.length })

    const pdf = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4'
    })

    try {
      // Capture all pages
      for (let i = 0; i < pages.length; i++) {
        setExportProgress({ current: i + 1, total: pages.length })

        // Switch to page
        switchPage(i)

        // Wait for rendering (reduced from 1000ms to 300ms for faster export)
        await new Promise(resolve => setTimeout(resolve, 300))

        // Find canvas container
        const container = document.querySelector('.canvas-container') as HTMLElement
        if (!container) continue

        // Capture canvas (scale 1.5 for balance between quality and speed)
        const canvas = await html2canvas(container, {
          scale: 1.5,
          logging: false,
          backgroundColor: '#ffffff',
          useCORS: true,
          allowTaint: true
        })

        // Convert to image with JPEG for smaller file size
        const imgData = canvas.toDataURL('image/jpeg', 0.95)

        // Add page to PDF
        if (i > 0) {
          pdf.addPage()
        }

        // A4 landscape: 297mm x 210mm
        const pdfWidth = 297
        const pdfHeight = 210

        // Calculate image aspect ratio and fit to page while maintaining ratio
        const imgWidth = canvas.width
        const imgHeight = canvas.height
        const imgRatio = imgWidth / imgHeight
        const pageRatio = pdfWidth / pdfHeight

        let finalWidth = pdfWidth
        let finalHeight = pdfHeight
        let xOffset = 0
        let yOffset = 0

        if (imgRatio > pageRatio) {
          // Image is wider than page - fit to width
          finalHeight = pdfWidth / imgRatio
          yOffset = (pdfHeight - finalHeight) / 2
        } else {
          // Image is taller than page - fit to height
          finalWidth = pdfHeight * imgRatio
          xOffset = (pdfWidth - finalWidth) / 2
        }

        pdf.addImage(imgData, 'JPEG', xOffset, yOffset, finalWidth, finalHeight)
      }

      // Save PDF
      const pdfBlob = pdf.output('blob')
      const pdfData = await pdfBlob.arrayBuffer()

      // Send to main process for saving
      if (window.electron?.savePDF) {
        await window.electron.savePDF(new Uint8Array(pdfData))
      }

    } finally {
      // Restore original page
      switchPage(originalPageIndex)
      setIsExportingPDF(false)
      setExportProgress({ current: 0, total: 0 })
    }
  }, [pages, currentPageIndex, switchPage])

  // Listen for export PDF event from main process
  useEffect(() => {
    if (window.electron?.onExportPDF) {
      const cleanup = window.electron.onExportPDF(() => {
        exportAllPagesToPDF()
      })
      return cleanup
    }
  }, [exportAllPagesToPDF])

  const sidebarContent = (
    <div className="sidebar" ref={sidebarRef}>
      {!isMobile && <h2>AllWrite</h2>}
      <PanelTabs />
      {activePanelTab === 'expression' && (
        <>
          <ExpressionEditor />
          {!isMobile && (
            <div className="text-mode-hint">
              <span className="hint-icon">💡</span>
              <span className="hint-text">Ctrl+" 클릭하면 텍스트 입력 모드로 전환됩니다</span>
            </div>
          )}
        </>
      )}
      {activePanelTab === 'geometry' && <GeometryToolPanel />}
      {activePanelTab === 'page' && <PageList />}
      {activePanelTab === 'brush' && <BrushSettingsPanel />}
    </div>
  )

  return (
    <div className="app">
      {isMobile ? (
        <>
          {/* Mobile: Full-screen canvas + FAB + Bottom Sheet */}
          <div className="canvas-container" style={{ width: '100vw', height: '100vh' }}>
            <GraphCanvas splitPanelRef={splitPanelRef} />
          </div>

          {/* FAB to open sidebar sheet */}
          <button
            className={`mobile-fab ${mobileSheetOpen ? 'open' : ''}`}
            onClick={() => setMobileSheetOpen(!mobileSheetOpen)}
          >
            {mobileSheetOpen ? '✕' : '📐'}
          </button>

          {/* Bottom Sheet with sidebar content */}
          <MobileSheet open={mobileSheetOpen} onClose={() => setMobileSheetOpen(false)}>
            {sidebarContent}
          </MobileSheet>
        </>
      ) : (
        <SplitPanel
          ref={splitPanelRef}
          left={sidebarContent}
          right={
            <div className="canvas-container">
              <button
                ref={writingButtonRef}
                className="writing-button canvas-writing-button"
                onClick={handleOpenWriting}
                title="모니터에 필기"
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: '2px', fontSize: '18px' }}>
                  🖥️✍️
                </span>
              </button>
              <GraphCanvas splitPanelRef={splitPanelRef} />
            </div>
          }
          defaultLeftWidth={0}
          minLeftWidth={0}
          maxLeftWidth={1200}
        />
      )}
      <RegularPolygonDialog />
      <DivisionPointDialog />
      <RegularPolygonEditDialog />

      {/* PDF Export Loading Overlay */}
      {isExportingPDF && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000,
          color: 'white',
          fontSize: '24px',
          fontWeight: 'bold'
        }}>
          <div style={{ marginBottom: '20px' }}>PDF 생성 중...</div>
          <div style={{ fontSize: '18px', fontWeight: 'normal' }}>
            {exportProgress.current} / {exportProgress.total} 페이지
          </div>
          <div style={{
            width: '300px',
            height: '10px',
            backgroundColor: 'rgba(255, 255, 255, 0.2)',
            borderRadius: '5px',
            marginTop: '20px',
            overflow: 'hidden'
          }}>
            <div style={{
              width: `${(exportProgress.current / exportProgress.total) * 100}%`,
              height: '100%',
              backgroundColor: '#4CAF50',
              transition: 'width 0.3s ease'
            }} />
          </div>
        </div>
      )}
    </div>
  )
}

export default App
