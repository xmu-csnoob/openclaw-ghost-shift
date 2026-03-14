import { useRef, useEffect, useCallback } from 'react'
import type { OfficeState } from '../engine/officeState.js'
import { startGameLoop } from '../engine/gameLoop.js'
import { renderFrame } from '../engine/renderer.js'
import { CharacterState, TILE_SIZE, type Character } from '../types.js'
import {
  CAMERA_FOLLOW_LERP,
  CAMERA_FOLLOW_SNAP_THRESHOLD,
  CHARACTER_HIT_HALF_WIDTH,
  CHARACTER_HIT_HEIGHT,
  CHARACTER_SITTING_OFFSET_PX,
  ZOOM_MIN,
  ZOOM_MAX,
  PAN_MARGIN_FRACTION,
} from '../../constants.js'

interface OfficeCanvasProps {
  officeState: OfficeState
  onClick?: (agentId: number) => void
  zoom: number
  onZoomChange: (zoom: number) => void
  panRef: React.MutableRefObject<{ x: number; y: number }>
  replayCharacters?: Character[] | null
  replayCharacterMap?: Map<number, Character> | null
  tourTargetAgentId?: number | null
  heatmapEnabled?: boolean
  heatmapSources?: Array<{ agentId: number; zone: string; intensity: number }>
  onHoverChange?: (agentId: number | null, position: { x: number; y: number } | null) => void
  onUserInteraction?: () => void
}

function renderHeatmapOverlay(
  ctx: CanvasRenderingContext2D,
  heatmapSources: Array<{ agentId: number; zone: string; intensity: number }>,
  characterMap: Map<number, Character>,
  offsetX: number,
  offsetY: number,
  zoom: number,
) {
  const buckets = new Map<string, { x: number; y: number; count: number; intensity: number }>()

  for (const source of heatmapSources) {
    const character = characterMap.get(source.agentId)
    if (!character) continue
    const bucket = buckets.get(source.zone) || { x: 0, y: 0, count: 0, intensity: 0 }
    bucket.x += character.x
    bucket.y += character.y
    bucket.count += 1
    bucket.intensity += source.intensity
    buckets.set(source.zone, bucket)
  }

  if (buckets.size === 0) return

  ctx.save()
  ctx.globalCompositeOperation = 'screen'

  for (const bucket of buckets.values()) {
    const intensity = Math.max(0.15, Math.min(1, bucket.intensity / Math.max(1, bucket.count)))
    const screenX = offsetX + (bucket.x / bucket.count) * zoom
    const screenY = offsetY + (bucket.y / bucket.count) * zoom
    const radius = Math.max(48, 34 * zoom + intensity * 64)
    const hue = (1 - intensity) * 220
    const centerAlpha = 0.12 + intensity * 0.22
    const edgeAlpha = 0.04 + intensity * 0.1
    const gradient = ctx.createRadialGradient(screenX, screenY, 0, screenX, screenY, radius)
    gradient.addColorStop(0, `hsla(${hue}, 90%, 60%, ${centerAlpha})`)
    gradient.addColorStop(0.45, `hsla(${hue}, 90%, 56%, ${edgeAlpha})`)
    gradient.addColorStop(1, `hsla(${hue}, 90%, 50%, 0)`)
    ctx.fillStyle = gradient
    ctx.beginPath()
    ctx.arc(screenX, screenY, radius, 0, Math.PI * 2)
    ctx.fill()
  }

  ctx.restore()
}

function getCharacterAtPosition(characters: Character[], worldX: number, worldY: number): number | null {
  const sortedCharacters = [...characters].sort((a, b) => b.y - a.y)
  for (const character of sortedCharacters) {
    if (character.matrixEffect === 'despawn') continue
    const sittingOffset = character.state === CharacterState.TYPE ? CHARACTER_SITTING_OFFSET_PX : 0
    const anchorY = character.y + sittingOffset
    const left = character.x - CHARACTER_HIT_HALF_WIDTH
    const right = character.x + CHARACTER_HIT_HALF_WIDTH
    const top = anchorY - CHARACTER_HIT_HEIGHT
    const bottom = anchorY
    if (worldX >= left && worldX <= right && worldY >= top && worldY <= bottom) {
      return character.id
    }
  }
  return null
}

export function OfficeCanvas({
  officeState,
  onClick,
  zoom,
  onZoomChange,
  panRef,
  replayCharacters = null,
  replayCharacterMap = null,
  tourTargetAgentId = null,
  heatmapEnabled = false,
  heatmapSources = [],
  onHoverChange,
  onUserInteraction,
}: OfficeCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const offsetRef = useRef({ x: 0, y: 0 })
  const isPanningRef = useRef(false)
  const panStartRef = useRef({ mouseX: 0, mouseY: 0, panX: 0, panY: 0 })
  const renderCharactersRef = useRef<Character[] | null>(replayCharacters)
  const renderCharacterMapRef = useRef<Map<number, Character> | null>(replayCharacterMap)
  const tourTargetAgentIdRef = useRef<number | null>(tourTargetAgentId)
  const heatmapEnabledRef = useRef(heatmapEnabled)
  const heatmapSourcesRef = useRef<Array<{ agentId: number; zone: string; intensity: number }>>(heatmapSources)

  useEffect(() => {
    renderCharactersRef.current = replayCharacters
  }, [replayCharacters])

  useEffect(() => {
    renderCharacterMapRef.current = replayCharacterMap
  }, [replayCharacterMap])

  useEffect(() => {
    tourTargetAgentIdRef.current = tourTargetAgentId
  }, [tourTargetAgentId])

  useEffect(() => {
    heatmapEnabledRef.current = heatmapEnabled
  }, [heatmapEnabled])

  useEffect(() => {
    heatmapSourcesRef.current = heatmapSources
  }, [heatmapSources])

  // Clamp pan so the map edge can't go past a margin inside the viewport
  const clampPan = useCallback((px: number, py: number): { x: number; y: number } => {
    const canvas = canvasRef.current
    if (!canvas) return { x: px, y: py }
    const layout = officeState.getLayout()
    const mapW = layout.cols * TILE_SIZE * zoom
    const mapH = layout.rows * TILE_SIZE * zoom
    const marginX = canvas.width * PAN_MARGIN_FRACTION
    const marginY = canvas.height * PAN_MARGIN_FRACTION
    const maxPanX = (mapW / 2) + canvas.width / 2 - marginX
    const maxPanY = (mapH / 2) + canvas.height / 2 - marginY
    return {
      x: Math.max(-maxPanX, Math.min(maxPanX, px)),
      y: Math.max(-maxPanY, Math.min(maxPanY, py)),
    }
  }, [officeState, zoom])

  // Resize canvas backing store to device pixels
  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return
    const rect = container.getBoundingClientRect()
    const dpr = window.devicePixelRatio || 1
    canvas.width = Math.round(rect.width * dpr)
    canvas.height = Math.round(rect.height * dpr)
    canvas.style.width = `${rect.width}px`
    canvas.style.height = `${rect.height}px`
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    resizeCanvas()

    const observer = new ResizeObserver(() => resizeCanvas())
    if (containerRef.current) {
      observer.observe(containerRef.current)
    }

    const stop = startGameLoop(canvas, {
      update: (dt) => {
        officeState.update(dt)
      },
      render: (ctx) => {
        const w = canvas.width
        const h = canvas.height
        const renderCharacters = renderCharactersRef.current ?? officeState.getCharacters()
        const renderCharacterMap = renderCharacterMapRef.current ?? officeState.characters

        // Camera follow: selected agents take priority, then auto-tour targets.
        const activeCameraTargetId = officeState.cameraFollowId ?? tourTargetAgentIdRef.current
        if (activeCameraTargetId !== null) {
          const followCh = renderCharacterMap.get(activeCameraTargetId)
          if (followCh) {
            const layout = officeState.getLayout()
            const mapW = layout.cols * TILE_SIZE * zoom
            const mapH = layout.rows * TILE_SIZE * zoom
            const targetX = mapW / 2 - followCh.x * zoom
            const targetY = mapH / 2 - followCh.y * zoom
            const dx = targetX - panRef.current.x
            const dy = targetY - panRef.current.y
            if (Math.abs(dx) < CAMERA_FOLLOW_SNAP_THRESHOLD && Math.abs(dy) < CAMERA_FOLLOW_SNAP_THRESHOLD) {
              panRef.current = { x: targetX, y: targetY }
            } else {
              panRef.current = {
                x: panRef.current.x + dx * CAMERA_FOLLOW_LERP,
                y: panRef.current.y + dy * CAMERA_FOLLOW_LERP,
              }
            }
          }
        }

        const selectionRender = {
          selectedAgentId: officeState.selectedAgentId,
          hoveredAgentId: officeState.hoveredAgentId,
          hoveredTile: officeState.hoveredTile,
          seats: officeState.seats,
          characters: renderCharacterMap,
        }

        const { offsetX, offsetY } = renderFrame(
          ctx,
          w,
          h,
          officeState.tileMap,
          officeState.furniture,
          renderCharacters,
          zoom,
          panRef.current.x,
          panRef.current.y,
          selectionRender,
          undefined,
          officeState.getLayout().tileColors,
          officeState.getLayout().cols,
          officeState.getLayout().rows,
        )

        if (heatmapEnabledRef.current && heatmapSourcesRef.current.length > 0) {
          renderHeatmapOverlay(
            ctx,
            heatmapSourcesRef.current,
            renderCharacterMap,
            offsetX,
            offsetY,
            zoom,
          )
        }

        offsetRef.current = { x: offsetX, y: offsetY }
      },
    })

    return () => {
      stop()
      observer.disconnect()
    }
  }, [officeState, resizeCanvas, zoom, panRef])

  // Convert CSS mouse coords to world coords
  const screenToWorld = useCallback(
    (clientX: number, clientY: number) => {
      const canvas = canvasRef.current
      if (!canvas) return null
      const rect = canvas.getBoundingClientRect()
      const dpr = window.devicePixelRatio || 1
      const cssX = clientX - rect.left
      const cssY = clientY - rect.top
      const deviceX = cssX * dpr
      const deviceY = cssY * dpr
      const worldX = (deviceX - offsetRef.current.x) / zoom
      const worldY = (deviceY - offsetRef.current.y) / zoom
      return { worldX, worldY, screenX: cssX, screenY: cssY, deviceX, deviceY }
    },
    [zoom],
  )

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (isPanningRef.current) {
        const dpr = window.devicePixelRatio || 1
        const dx = (e.clientX - panStartRef.current.mouseX) * dpr
        const dy = (e.clientY - panStartRef.current.mouseY) * dpr
        panRef.current = clampPan(
          panStartRef.current.panX + dx,
          panStartRef.current.panY + dy,
        )
        onHoverChange?.(null, null)
        return
      }

      const pos = screenToWorld(e.clientX, e.clientY)
      if (!pos) return
      const hitId = getCharacterAtPosition(renderCharactersRef.current ?? officeState.getCharacters(), pos.worldX, pos.worldY)
      const canvas = canvasRef.current
      if (canvas) {
        canvas.style.cursor = hitId !== null ? 'pointer' : 'default'
      }
      officeState.hoveredAgentId = hitId
      onHoverChange?.(hitId, hitId !== null ? { x: pos.screenX, y: pos.screenY } : null)
    },
    [officeState, screenToWorld, panRef, clampPan, onHoverChange],
  )

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button === 1) {
        e.preventDefault()
        onUserInteraction?.()
        onHoverChange?.(null, null)
        officeState.cameraFollowId = null
        isPanningRef.current = true
        panStartRef.current = {
          mouseX: e.clientX,
          mouseY: e.clientY,
          panX: panRef.current.x,
          panY: panRef.current.y,
        }
        const canvas = canvasRef.current
        if (canvas) canvas.style.cursor = 'grabbing'
        return
      }
    },
    [officeState, onUserInteraction, panRef, onHoverChange],
  )

  const handleMouseUp = useCallback(
    (e: React.MouseEvent) => {
      if (e.button === 1) {
        isPanningRef.current = false
        const canvas = canvasRef.current
        if (canvas) canvas.style.cursor = 'default'
        return
      }
    },
    [],
  )

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      onUserInteraction?.()
      const pos = screenToWorld(e.clientX, e.clientY)
      if (!pos) return

      const hitId = getCharacterAtPosition(renderCharactersRef.current ?? officeState.getCharacters(), pos.worldX, pos.worldY)
      if (hitId !== null) {
        officeState.dismissBubble(hitId)
        if (officeState.selectedAgentId === hitId) {
          officeState.selectedAgentId = null
          officeState.cameraFollowId = null
        } else {
          officeState.selectedAgentId = hitId
          officeState.cameraFollowId = hitId
        }
        onClick?.(hitId)
      } else {
        officeState.selectedAgentId = null
        officeState.cameraFollowId = null
      }
    },
    [officeState, onClick, onUserInteraction, screenToWorld],
  )

  const handleMouseLeave = useCallback(() => {
    isPanningRef.current = false
    officeState.hoveredAgentId = null
    officeState.hoveredTile = null
    onHoverChange?.(null, null)
  }, [officeState, onHoverChange])

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault()
      onUserInteraction?.()
      if (e.ctrlKey || e.metaKey) {
        const delta = e.deltaY < 0 ? 1 : -1
        const newZoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, zoom + delta))
        if (newZoom !== zoom) {
          onZoomChange(newZoom)
        }
      } else {
        const dpr = window.devicePixelRatio || 1
        officeState.cameraFollowId = null
        panRef.current = clampPan(
          panRef.current.x - e.deltaX * dpr,
          panRef.current.y - e.deltaY * dpr,
        )
      }
    },
    [zoom, onZoomChange, officeState, panRef, clampPan, onUserInteraction],
  )

  const handleAuxClick = useCallback((e: React.MouseEvent) => {
    if (e.button === 1) e.preventDefault()
  }, [])

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        overflow: 'hidden',
        background: '#1E1E2E',
      }}
    >
      <canvas
        ref={canvasRef}
        onMouseMove={handleMouseMove}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onClick={handleClick}
        onAuxClick={handleAuxClick}
        onMouseLeave={handleMouseLeave}
        onWheel={handleWheel}
        onContextMenu={(e) => e.preventDefault()}
        style={{ display: 'block' }}
      />
    </div>
  )
}
