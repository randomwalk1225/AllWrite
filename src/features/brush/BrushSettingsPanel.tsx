import { useStore } from '../../store'
import './BrushSettingsPanel.css'

export function BrushSettingsPanel() {
  const brushStabilizer = useStore((state) => state.brushStabilizer)
  const setBrushStabilizer = useStore((state) => state.setBrushStabilizer)

  // Temporarily hidden - set to true to show the panel again
  const showStabilizerSettings = true

  return (
    <div className="brush-settings-panel">
      {showStabilizerSettings && (
        <>
          <div className="brush-settings-section">
            <h3>Brush Stabilization</h3>

            <div className="setting-group">
              <label htmlFor="stabilizer-mode">Mode</label>
              <select
                id="stabilizer-mode"
                value={brushStabilizer.mode}
                onChange={(e) =>
                  setBrushStabilizer({
                    mode: e.target.value as 'none' | 'basic' | 'weighted' | 'stabilizer'
                  })
                }
              >
                <option value="none">None</option>
                <option value="basic">Basic</option>
                <option value="weighted">Weighted</option>
                <option value="stabilizer">Stabilizer (Krita)</option>
              </select>
            </div>

            {brushStabilizer.mode !== 'none' && (
              <>
                <div className="setting-group">
                  <label htmlFor="queue-size">
                    Queue Size: {brushStabilizer.queueSize}
                  </label>
                  <input
                    id="queue-size"
                    type="range"
                    min="5"
                    max="200"
                    value={brushStabilizer.queueSize}
                    onChange={(e) =>
                      setBrushStabilizer({ queueSize: parseInt(e.target.value) })
                    }
                  />
                  <span className="setting-hint">
                    Higher = smoother but more lag
                  </span>
                </div>

                {brushStabilizer.mode === 'stabilizer' && (
                  <div className="setting-group">
                    <label htmlFor="delay-distance">
                      Delay Distance: {brushStabilizer.delayDistance}
                    </label>
                    <input
                      id="delay-distance"
                      type="range"
                      min="0"
                      max="100"
                      value={brushStabilizer.delayDistance}
                      onChange={(e) =>
                        setBrushStabilizer({
                          delayDistance: parseInt(e.target.value)
                        })
                      }
                    />
                    <span className="setting-hint">
                      Dead zone for sharp corners
                    </span>
                  </div>
                )}

                <div className="setting-group checkbox">
                  <label>
                    <input
                      type="checkbox"
                      checked={brushStabilizer.finishStabilizer}
                      onChange={(e) =>
                        setBrushStabilizer({
                          finishStabilizer: e.target.checked
                        })
                      }
                    />
                    <span>Finish stabilizer on stroke end</span>
                  </label>
                </div>

                <div className="setting-group checkbox">
                  <label>
                    <input
                      type="checkbox"
                      checked={brushStabilizer.stabilizeSensors}
                      onChange={(e) =>
                        setBrushStabilizer({
                          stabilizeSensors: e.target.checked
                        })
                      }
                    />
                    <span>Stabilize pressure & tilt</span>
                  </label>
                </div>
              </>
            )}
          </div>

          <div className="brush-settings-section">
            <h3>Tips</h3>
            <ul className="tips-list">
              <li><strong>None:</strong> No stabilization, raw input</li>
              <li><strong>Basic:</strong> Simple averaging</li>
              <li><strong>Weighted:</strong> Gaussian weighted smoothing</li>
              <li><strong>Stabilizer:</strong> Krita-style with delay distance</li>
            </ul>
            <p className="tip-note">
              💡 Start with Stabilizer mode, Queue Size 50, and Delay Distance 30 for a Krita-like feel.
            </p>
          </div>
        </>
      )}
    </div>
  )
}
