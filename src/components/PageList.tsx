import { useState, useRef } from 'react'
import { useStore } from '../store'
import './PageList.css'

export function PageList() {
  const pages = useStore((state) => state.pages)
  const currentPageIndex = useStore((state) => state.currentPageIndex)
  const addPage = useStore((state) => state.addPage)
  const removePage = useStore((state) => state.removePage)
  const switchPage = useStore((state) => state.switchPage)
  const updatePageName = useStore((state) => state.updatePageName)
  const reorderPages = useStore((state) => state.reorderPages)

  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [editingName, setEditingName] = useState('')
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [dropIndex, setDropIndex] = useState<number | null>(null)

  const handlePageClick = (index: number) => {
    if (index !== currentPageIndex && editingIndex === null) {
      switchPage(index)
    }
  }

  const handleAddPage = () => {
    addPage()
  }

  const handleRemovePage = (index: number, e: React.MouseEvent) => {
    e.stopPropagation()
    if (pages.length <= 1) {
      return // Cannot delete the last page
    }
    removePage(index)
  }

  const handleStartEdit = (index: number, e: React.MouseEvent) => {
    e.stopPropagation()
    setEditingIndex(index)
    setEditingName(pages[index].name)
  }

  const handleFinishEdit = () => {
    if (editingIndex !== null && editingName.trim()) {
      updatePageName(editingIndex, editingName.trim())
    }
    setEditingIndex(null)
    setEditingName('')
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleFinishEdit()
    } else if (e.key === 'Escape') {
      setEditingIndex(null)
      setEditingName('')
    }
  }

  // Drag and Drop handlers
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDragIndex(index)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', index.toString())
  }

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (dragIndex !== null && dragIndex !== index) {
      setDropIndex(index)
    }
  }

  const handleDragLeave = () => {
    setDropIndex(null)
  }

  const handleDrop = (e: React.DragEvent, toIndex: number) => {
    e.preventDefault()
    if (dragIndex !== null && dragIndex !== toIndex) {
      reorderPages(dragIndex, toIndex)
    }
    setDragIndex(null)
    setDropIndex(null)
  }

  const handleDragEnd = () => {
    setDragIndex(null)
    setDropIndex(null)
  }

  return (
    <div className="page-list-panel">
      <div className="page-grid">
        {pages.map((page, index) => (
          <div
            key={page.id}
            className={`page-thumbnail ${index === currentPageIndex ? 'current' : ''} ${dragIndex === index ? 'dragging' : ''} ${dropIndex === index ? 'drop-target' : ''}`}
            onClick={() => handlePageClick(index)}
            draggable={editingIndex !== index}
            onDragStart={(e) => handleDragStart(e, index)}
            onDragOver={(e) => handleDragOver(e, index)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, index)}
            onDragEnd={handleDragEnd}
          >
            <div className="page-preview" style={{
              backgroundImage: page.thumbnail ? `url(${page.thumbnail})` : undefined,
              backgroundSize: 'cover',
              backgroundPosition: 'center'
            }}>
              <span className="page-number">{index + 1}</span>
              {index === currentPageIndex && (
                <div className="current-badge">현재</div>
              )}
              <button
                className="remove-page-btn"
                onClick={(e) => handleRemovePage(index, e)}
                title="페이지 삭제"
                disabled={pages.length <= 1}
              >
                ×
              </button>
            </div>
          </div>
        ))}

        {/* Add new page button */}
        <div
          className="page-thumbnail add-page-card"
          onClick={handleAddPage}
          title="새 페이지 추가 (Ctrl+T)"
        >
          <div className="page-preview add-page-preview">
            <span className="add-page-icon">+</span>
          </div>
        </div>
      </div>

      <div className="page-list-hint">
        💡 드래그하여 순서 변경
      </div>
    </div>
  )
}
