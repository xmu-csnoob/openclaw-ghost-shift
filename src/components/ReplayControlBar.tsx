import React from 'react'
import type { PlaybackState, PlaybackWindowHours } from '../replay.js'
import { i18n } from '../content/i18n.js'

export interface ReplayControlBarProps {
  playbackState: PlaybackState
  hasFrames: boolean
  scrubberMin: number
  scrubberMax: number
  scrubberValue: number
  currentLabel: string
  startLabel: string
  endLabel: string
  coverageLabel: string
  freshnessLabel: string
  freshnessColor: string
  freshnessDetail: string
  autoTourPaused: boolean
  previewFrames: Array<{
    id: string
    timestamp: number
    label: string
    running: number
    displayed: number
    zoneLabel: string
    accent: string
    isCurrent: boolean
    previewBars: number[]
  }>
  eventMarkers: Array<{
    id: string
    timestamp: number
    position: number
    label: string
    tone: string
  }>
  onModeChange: (mode: 'live' | 'replay') => void
  onWindowHoursChange: (hours: PlaybackWindowHours) => void
  onScrub: (timestamp: number) => void
  onPlayToggle: () => void
  onJumpToLive: () => void
  onResumeTour: () => void
  onPlaybackRateChange: (rate: PlaybackState['playbackRate']) => void
  compact?: boolean
}

const windowOptions: PlaybackWindowHours[] = [1, 6, 24]
const playbackRates: PlaybackState['playbackRate'][] = [0.5, 1, 2]

function pillButtonStyle(active: boolean, disabled = false): React.CSSProperties {
  return {
    padding: '7px 12px',
    borderRadius: 999,
    border: '1px solid',
    borderColor: active ? 'rgba(137, 180, 250, 0.85)' : 'rgba(69, 71, 90, 0.7)',
    background: active ? 'rgba(137, 180, 250, 0.16)' : 'rgba(17, 24, 39, 0.55)',
    color: disabled ? '#6C7086' : active ? '#CDD6F4' : '#9399B2',
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: 0.4,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
  }
}

export function ReplayControlBar({
  playbackState,
  hasFrames,
  scrubberMin,
  scrubberMax,
  scrubberValue,
  currentLabel,
  startLabel,
  endLabel,
  coverageLabel,
  freshnessLabel,
  freshnessColor,
  freshnessDetail,
  autoTourPaused,
  previewFrames,
  eventMarkers,
  onModeChange,
  onWindowHoursChange,
  onScrub,
  onPlayToggle,
  onJumpToLive,
  onResumeTour,
  onPlaybackRateChange,
  compact = false,
}: ReplayControlBarProps): React.ReactElement {
  const scrubberDisabled = !hasFrames || scrubberMin === scrubberMax
  const visibleMarkers = compact ? eventMarkers.slice(0, 3) : eventMarkers
  const activeMarkerId =
    visibleMarkers.reduce<{ id: string | null; distance: number }>(
      (closest, marker) => {
        const distance = Math.abs(marker.timestamp - scrubberValue)
        if (distance < closest.distance) {
          return { id: marker.id, distance }
        }
        return closest
      },
      { id: null, distance: Number.POSITIVE_INFINITY },
    ).id

  return (
    <div
      className={`gs-replay-bar ${compact ? 'is-compact' : ''}`}
      style={{
        position: 'absolute',
        top: compact ? 104 : 64,
        left: '50%',
        transform: 'translateX(-50%)',
        width: compact ? 'calc(100% - 20px)' : 'min(760px, calc(100vw - 32px))',
        padding: 14,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        zIndex: 130,
        background:
          'linear-gradient(135deg, rgba(24, 24, 37, 0.96), rgba(17, 24, 39, 0.92) 55%, rgba(30, 41, 59, 0.9))',
        border: '1px solid rgba(137, 180, 250, 0.24)',
        boxShadow: '0 18px 36px rgba(0, 0, 0, 0.28)',
        backdropFilter: 'blur(14px)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <div style={{ fontSize: 10, color: '#6C7086', letterSpacing: 1.4, textTransform: 'uppercase' }}>
            Storyline
          </div>
          <button
            type="button"
            onClick={() => onModeChange('live')}
            style={pillButtonStyle(playbackState.mode === 'live')}
          >
            实时
          </button>
          <button
            type="button"
            onClick={() => onModeChange('replay')}
            disabled={!hasFrames}
            style={pillButtonStyle(playbackState.mode === 'replay', !hasFrames)}
          >
            回放
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <div
            style={{
              padding: '6px 10px',
              borderRadius: 999,
              border: `1px solid ${freshnessColor}`,
              background: 'rgba(17, 24, 39, 0.55)',
              color: freshnessColor,
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: 0.4,
            }}
          >
            {freshnessLabel}
          </div>
          <div style={{ fontSize: 11, color: '#9399B2' }}>{freshnessDetail}</div>
          {playbackState.mode === 'live' && autoTourPaused && (
            <button type="button" onClick={onResumeTour} style={pillButtonStyle(false)}>
              继续导览
            </button>
          )}
        </div>
      </div>

      {previewFrames.length > 0 && (
        <div
          className="gs-replay-bar__preview-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: compact ? 'repeat(3, minmax(180px, 1fr))' : `repeat(${previewFrames.length}, minmax(0, 1fr))`,
            gap: 8,
            overflowX: compact ? 'auto' : 'visible',
            paddingBottom: compact ? 4 : 0,
          }}
        >
          {previewFrames.map((preview) => (
            <button
              key={preview.id}
              type="button"
              onClick={() => onScrub(preview.timestamp)}
              className={`gs-replay-bar__thumbnail ${preview.isCurrent ? 'is-current' : ''}`}
              style={{
                padding: 10,
                border: '1px solid',
                borderColor: preview.isCurrent ? preview.accent : 'rgba(69, 71, 90, 0.7)',
                background: preview.isCurrent ? 'rgba(137, 180, 250, 0.12)' : 'rgba(17, 24, 39, 0.48)',
                color: '#CDD6F4',
                textAlign: 'left',
                cursor: 'pointer',
                minWidth: compact ? 180 : undefined,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
                <span style={{ fontSize: 10, color: preview.accent, textTransform: 'uppercase', letterSpacing: 1 }}>
                  Thumbnail
                </span>
                <span style={{ fontSize: 10, color: '#9399B2' }}>{preview.label}</span>
              </div>
              <div
                className="gs-replay-bar__thumbnail-preview"
                style={{
                  height: 38,
                  border: `1px solid ${preview.accent}`,
                  background: `linear-gradient(135deg, ${preview.accent}22, rgba(17, 24, 39, 0.22))`,
                  display: 'grid',
                  gridTemplateColumns: `repeat(${preview.previewBars.length}, 1fr)`,
                  gap: 4,
                  padding: 6,
                  alignItems: 'end',
                }}
              >
                {preview.previewBars.map((value, index) => (
                  <span
                    key={`${preview.id}-${index}`}
                    className="gs-replay-bar__thumbnail-bar"
                    style={{
                      height: `${Math.max(18, value * 100)}%`,
                      background: `${preview.accent}${index === 0 ? 'aa' : index === 1 ? '72' : '42'}`,
                    }}
                  />
                ))}
              </div>
              <div style={{ marginTop: 8, fontSize: 11, color: '#CDD6F4' }}>
                {preview.running}/{preview.displayed} {i18n.replay.active}
              </div>
              <div style={{ marginTop: 2, fontSize: 10, color: '#9399B2' }}>{preview.zoneLabel}</div>
            </button>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {windowOptions.map((hours) => (
            <button
              key={hours}
              type="button"
              onClick={() => onWindowHoursChange(hours)}
              style={pillButtonStyle(playbackState.windowHours === hours)}
            >
              {hours}h
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {playbackState.mode === 'replay' && (
            <button type="button" onClick={onPlayToggle} style={pillButtonStyle(false, !hasFrames)}>
              {playbackState.isPlaying ? i18n.replay.pause : i18n.replay.play}
            </button>
          )}
          {playbackState.mode === 'replay' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {playbackRates.map((rate) => (
                <button
                  key={rate}
                  type="button"
                  onClick={() => onPlaybackRateChange(rate)}
                  style={pillButtonStyle(playbackState.playbackRate === rate)}
                >
                  {rate}x
                </button>
              ))}
            </div>
          )}
          {playbackState.mode === 'replay' && (
            <button type="button" onClick={onJumpToLive} style={pillButtonStyle(false)}>
              {i18n.replay.jumpToLive}
            </button>
          )}
          <div style={{ fontSize: 11, color: '#CDD6F4' }}>{currentLabel}</div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ position: 'relative', paddingTop: 12 }}>
          <div
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: 0,
              height: 12,
              pointerEvents: 'none',
            }}
          >
            {eventMarkers.map((marker) => (
              <button
                key={marker.id}
                type="button"
                title={marker.label}
                onClick={() => onScrub(marker.timestamp)}
                className={`gs-replay-bar__event-dot ${activeMarkerId === marker.id ? 'is-active' : ''}`}
                style={{
                  position: 'absolute',
                  left: `calc(${Math.min(100, Math.max(0, marker.position * 100))}% - 5px)`,
                  top: 0,
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  border: `1px solid ${marker.tone}`,
                  background: marker.tone,
                  boxShadow: `0 0 0 4px ${marker.tone}22`,
                  cursor: 'pointer',
                  pointerEvents: 'auto',
                }}
              />
            ))}
          </div>

          <input
            type="range"
            min={scrubberMin}
            max={scrubberMax}
            step={1000}
            value={scrubberValue}
            disabled={scrubberDisabled}
            onChange={(event) => onScrub(Number(event.target.value))}
            style={{ width: '100%' }}
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 11, color: '#9399B2' }}>
          <span>{startLabel}</span>
          <span style={{ color: '#6C7086' }}>{coverageLabel}</span>
          <span>{endLabel}</span>
        </div>

        {visibleMarkers.length > 0 ? (
          <div
            className="gs-replay-bar__events"
            style={{
              display: 'flex',
              gap: 8,
              overflowX: 'auto',
              paddingBottom: 2,
            }}
          >
            {visibleMarkers.map((marker) => (
              <button
                key={marker.id}
                type="button"
                onClick={() => onScrub(marker.timestamp)}
                className={`gs-replay-bar__event-chip ${activeMarkerId === marker.id ? 'is-active' : ''}`}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '6px 9px',
                  borderRadius: 999,
                  border: `1px solid ${marker.tone}44`,
                  background: activeMarkerId === marker.id ? `${marker.tone}22` : 'rgba(17, 24, 39, 0.42)',
                  color: '#CDD6F4',
                  whiteSpace: 'nowrap',
                  cursor: 'pointer',
                }}
              >
                <span
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: '50%',
                    background: marker.tone,
                    boxShadow: `0 0 0 4px ${marker.tone}18`,
                  }}
                />
                <span style={{ fontSize: 10 }}>{marker.label}</span>
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  )
}
