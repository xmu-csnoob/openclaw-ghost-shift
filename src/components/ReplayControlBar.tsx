import React from 'react'
import type { PlaybackState, PlaybackWindowHours } from '../replay.js'

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
  onModeChange: (mode: 'live' | 'replay') => void
  onWindowHoursChange: (hours: PlaybackWindowHours) => void
  onScrub: (timestamp: number) => void
  onPlayToggle: () => void
  onJumpToLive: () => void
  onResumeTour: () => void
}

const windowOptions: PlaybackWindowHours[] = [1, 6, 24]

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
  onModeChange,
  onWindowHoursChange,
  onScrub,
  onPlayToggle,
  onJumpToLive,
  onResumeTour,
}: ReplayControlBarProps): React.ReactElement {
  const scrubberDisabled = !hasFrames || scrubberMin === scrubberMax

  return (
    <div
      style={{
        position: 'absolute',
        top: 12,
        left: '50%',
        transform: 'translateX(-50%)',
        width: 'min(760px, calc(100vw - 32px))',
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
            Live
          </button>
          <button
            type="button"
            onClick={() => onModeChange('replay')}
            disabled={!hasFrames}
            style={pillButtonStyle(playbackState.mode === 'replay', !hasFrames)}
          >
            Replay
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
              Resume tour
            </button>
          )}
        </div>
      </div>

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
              {playbackState.isPlaying ? 'Pause' : 'Play'}
            </button>
          )}
          {playbackState.mode === 'replay' && (
            <button type="button" onClick={onJumpToLive} style={pillButtonStyle(false)}>
              Jump to live
            </button>
          )}
          <div style={{ fontSize: 11, color: '#CDD6F4' }}>{currentLabel}</div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
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

        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 11, color: '#9399B2' }}>
          <span>{startLabel}</span>
          <span style={{ color: '#6C7086' }}>{coverageLabel}</span>
          <span>{endLabel}</span>
        </div>
      </div>
    </div>
  )
}
