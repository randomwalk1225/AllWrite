import { useStore } from '../store'
import './PanelTabs.css'

export function PanelTabs() {
  const activePanelTab = useStore((state) => state.activePanelTab)
  const setActivePanelTab = useStore((state) => state.setActivePanelTab)

  return (
    <div className="panel-tabs">
      <button
        className={`panel-tab ${activePanelTab === 'expression' ? 'active' : ''}`}
        onClick={() => setActivePanelTab('expression')}
      >
        수식
      </button>
      <button
        className={`panel-tab ${activePanelTab === 'geometry' ? 'active' : ''}`}
        onClick={() => setActivePanelTab('geometry')}
      >
        도형
      </button>
      <button
        className={`panel-tab ${activePanelTab === 'page' ? 'active' : ''}`}
        onClick={() => setActivePanelTab('page')}
      >
        페이지
      </button>
    </div>
  )
}
