import { i18n } from '../../content/i18n/index.js'
import { useT } from '../../content/locale.js'
import '../../styles/toolbar.css'

interface OfficeToolbarProps {
  zoom: number
  onZoomChange: (zoom: number) => void
  showStatusPanel: boolean
  onToggleStatusPanel: () => void
  heatmapEnabled: boolean
  onToggleHeatmap: () => void
  heatmapSourceCount: number
  heatmapZoneCount: number
  compact: boolean
}

export function OfficeToolbar({
  zoom,
  onZoomChange,
  showStatusPanel,
  onToggleStatusPanel,
  heatmapEnabled,
  onToggleHeatmap,
  heatmapSourceCount,
  heatmapZoneCount,
  compact,
}: OfficeToolbarProps) {
  const tt = useT()
  const zoomLabel = `${zoom >= 10 || Number.isInteger(zoom) ? zoom.toFixed(0) : zoom.toFixed(1)}x`

  return (
    <>
      <div className="gs-office-toolbar">
        <button
          type="button"
          className={`gs-office-toolbar__button ${showStatusPanel ? 'is-active' : ''}`}
          onClick={onToggleStatusPanel}
          aria-pressed={showStatusPanel}
        >
          {tt(i18n.liveOffice.telemetry)}
        </button>

        <button
          type="button"
          className={`gs-office-toolbar__button ${heatmapEnabled ? 'is-active' : ''}`}
          onClick={onToggleHeatmap}
          aria-pressed={heatmapEnabled}
        >
          {tt(i18n.liveOffice.heatmap)}
        </button>
      </div>

      <div className="gs-office-toolbar__zoom">
        <button
          type="button"
          aria-label={tt(i18n.common.zoomIn)}
          onClick={() => onZoomChange(Math.min(10, zoom + 1))}
        >
          +
        </button>
        <span>{zoomLabel}</span>
        <button
          type="button"
          aria-label={tt(i18n.common.zoomOut)}
          onClick={() => onZoomChange(Math.max(1, zoom - 1))}
        >
          -
        </button>
      </div>

      {heatmapEnabled ? (
        <div className="gs-office-toolbar__legend" role="status" aria-live="polite">
          <div className="gs-office-toolbar__legend-eyebrow">{tt(i18n.liveOffice.activityHeatmap)}</div>
          <div className="gs-office-toolbar__legend-body">
            <span>{heatmapSourceCount} {tt(i18n.liveOffice.activeSources)}</span>
            <span>{heatmapZoneCount} {tt(i18n.liveOffice.hotZones)}</span>
            <span>{compact ? tt(i18n.liveOffice.pinchDragToInspect) : tt(i18n.liveOffice.panZoomToInspect)}</span>
          </div>
        </div>
      ) : null}
    </>
  )
}
