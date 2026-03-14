import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'
import { ReplayControlBar } from './ReplayControlBar.js'
import type { ReplayControlBarProps } from './ReplayControlBar.js'

function makeProps(overrides: Partial<ReplayControlBarProps> = {}): ReplayControlBarProps {
  return {
    playbackState: {
      mode: 'live',
      windowHours: 1,
      selectedTimestamp: 2_000,
      currentFrameIndex: 1,
      isPlaying: false,
      playbackRate: 1,
    },
    hasFrames: true,
    scrubberMin: 1_000,
    scrubberMax: 4_000,
    scrubberValue: 2_000,
    currentLabel: 'Frame A',
    startLabel: 'Start',
    endLabel: 'End',
    coverageLabel: 'Buffered 24h',
    freshnessLabel: 'Live now',
    freshnessColor: '#A6E3A1',
    freshnessDetail: 'Updated just now',
    autoTourPaused: false,
    previewFrames: [
      {
        id: 'frame-a',
        timestamp: 1_000,
        label: 'Window A',
        running: 2,
        displayed: 4,
        zoneLabel: 'Code Studio',
        accent: '#89B4FA',
        isCurrent: true,
        previewBars: [0.4, 0.6, 0.8],
      },
      {
        id: 'frame-b',
        timestamp: 4_000,
        label: 'Window B',
        running: 3,
        displayed: 5,
        zoneLabel: 'Chat Lounge',
        accent: '#F9E2AF',
        isCurrent: false,
        previewBars: [0.3, 0.5, 0.7],
      },
    ],
    eventMarkers: [
      { id: 'm1', timestamp: 1_200, position: 0.1, label: '1: +1 live', tone: '#F38BA8' },
      { id: 'm2', timestamp: 2_000, position: 0.4, label: '2: stable', tone: '#89B4FA' },
      { id: 'm3', timestamp: 2_800, position: 0.7, label: '3: lead Code Studio', tone: '#F9E2AF' },
      { id: 'm4', timestamp: 3_600, position: 0.9, label: '4: +2 visible', tone: '#A6E3A1' },
    ],
    onModeChange: vi.fn(),
    onWindowHoursChange: vi.fn(),
    onScrub: vi.fn(),
    onPlayToggle: vi.fn(),
    onJumpToLive: vi.fn(),
    onResumeTour: vi.fn(),
    onPlaybackRateChange: vi.fn(),
    ...overrides,
  }
}

describe('ReplayControlBar', () => {
  test('supports live controls, compact marker trimming, and scrubbing affordances', () => {
    const props = makeProps({ autoTourPaused: true, compact: true })
    const { container } = render(<ReplayControlBar {...props} />)

    fireEvent.click(screen.getByRole('button', { name: 'Replay' }))
    fireEvent.click(screen.getByRole('button', { name: '6h' }))
    fireEvent.click(screen.getByRole('button', { name: 'Resume tour' }))
    fireEvent.click(screen.getByRole('button', { name: /Window B/i }))
    fireEvent.click(screen.getByTitle('2: stable'))
    fireEvent.change(screen.getByRole('slider'), { target: { value: '3000' } })

    expect(props.onModeChange).toHaveBeenCalledWith('replay')
    expect(props.onWindowHoursChange).toHaveBeenCalledWith(6)
    expect(props.onResumeTour).toHaveBeenCalledTimes(1)
    expect(props.onScrub).toHaveBeenCalledWith(4_000)
    expect(props.onScrub).toHaveBeenCalledWith(2_000)
    expect(props.onScrub).toHaveBeenCalledWith(3_000)
    expect(container.querySelectorAll('.gs-replay-bar__event-chip')).toHaveLength(3)
  })

  test('renders replay-only playback controls and forwards playback actions', () => {
    const props = makeProps({
      playbackState: {
        mode: 'replay',
        windowHours: 24,
        selectedTimestamp: 4_000,
        currentFrameIndex: 1,
        isPlaying: false,
        playbackRate: 1,
      },
      autoTourPaused: true,
    })

    render(<ReplayControlBar {...props} />)

    fireEvent.click(screen.getByRole('button', { name: 'Play' }))
    fireEvent.click(screen.getByRole('button', { name: '2x' }))
    fireEvent.click(screen.getByRole('button', { name: 'Jump to live' }))
    fireEvent.click(screen.getByRole('button', { name: 'Live' }))

    expect(props.onPlayToggle).toHaveBeenCalledTimes(1)
    expect(props.onPlaybackRateChange).toHaveBeenCalledWith(2)
    expect(props.onJumpToLive).toHaveBeenCalledTimes(1)
    expect(props.onModeChange).toHaveBeenCalledWith('live')
    expect(screen.queryByRole('button', { name: 'Resume tour' })).not.toBeInTheDocument()
  })

  test('disables replay activation and slider input when no frames are buffered', () => {
    const props = makeProps({
      hasFrames: false,
      scrubberMin: 1_000,
      scrubberMax: 1_000,
      previewFrames: [],
      eventMarkers: [],
    })

    render(<ReplayControlBar {...props} />)

    expect(screen.getByRole('button', { name: 'Replay' })).toBeDisabled()
    expect(screen.getByRole('slider')).toBeDisabled()
  })
})
