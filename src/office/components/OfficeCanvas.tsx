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

interface TouchPoint {
  identifier: number
  clientX: number
  clientY: number
}

type TouchGestureState =
  | { kind: 'idle' }
  | {
      kind: 'pan'
      touchId: number
      startClientX: number
      startClientY: number
      startPanX: number
      startPanY: number
      moved: boolean
    }
  | {
      kind: 'pinch'
      firstTouchId: number
      secondTouchId: number
      startDistance: number
      startZoom: number
      worldX: number
      worldY: number
    }

const MOBILE_RENDER_SCALE_MAX = 1.5
const TOUCH_DRAG_THRESHOLD_PX = 10

function getCanvasScale(): number {
  if (typeof window === 'undefined') return 1
  const dpr = window.devicePixelRatio || 1
  const coarsePointer =
    window.matchMedia?.('(pointer: coarse)')?.matches || navigator.maxTouchPoints > 0
  return coarsePointer ? Math.min(dpr, MOBILE_RENDER_SCALE_MAX) : dpr
}

function normalizeZoom(nextZoom: number): number {
  return Math.round(nextZoom * 10) / 10
}

function getTouchDistance(first: TouchPoint, second: TouchPoint): number {
  return Math.hypot(second.clientX - first.clientX, second.clientY - first.clientY)
}

function getTouchCenter(first: TouchPoint, second: TouchPoint): { clientX: number; clientY: number } {
  return {
    clientX: (first.clientX + second.clientX) / 2,
    clientY: (first.clientY + second.clientY) / 2,
  }
}

function getTouchPoint(touchList: TouchPoint[], touchId: number): TouchPoint | null {
  return touchList.find((touch) => touch.identifier === touchId) || null
}

function listTouches(touches: React.TouchList): TouchPoint[] {
  return Array.from(touches).map((touch) => ({
    identifier: touch.identifier,
    clientX: touch.clientX,
    clientY: touch.clientY,
  }))
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
  const phase = performance.now() / 1_000

  for (const bucket of buckets.values()) {
    const intensity = Math.max(0.15, Math.min(1, bucket.intensity / Math.max(1, bucket.count)))
    const screenX = offsetX + (bucket.x / bucket.count) * zoom
    const screenY = offsetY + (bucket.y / bucket.count) * zoom
    const pulse = 0.92 + Math.sin(phase * 2.1 + bucket.count) * 0.08
    const radius = Math.max(48, (34 * zoom + intensity * 64) * pulse)
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
  const zoomRef = useRef(zoom)
  const touchGestureRef = useRef<TouchGestureState>({ kind: 'idle' })

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

  useEffect(() => {
    zoomRef.current = zoom
  }, [zoom])

  // Clamp pan so the map edge can't go past a margin inside the viewport
  const clampPan = useCallback((px: number, py: number, zoomLevel: number = zoom): { x: number; y: number } => {
    const canvas = canvasRef.current
    if (!canvas) return { x: px, y: py }
    const layout = officeState.getLayout()
    const mapW = layout.cols * TILE_SIZE * zoomLevel
    const mapH = layout.rows * TILE_SIZE * zoomLevel
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
    const dpr = getCanvasScale()
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
      const dpr = getCanvasScale()
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

  const computePanFromFocus = useCallback(
    (worldX: number, worldY: number, screenX: number, screenY: number, zoomLevel: number) => {
      const canvas = canvasRef.current
      if (!canvas) return panRef.current
      const layout = officeState.getLayout()
      const mapW = layout.cols * TILE_SIZE * zoomLevel
      const mapH = layout.rows * TILE_SIZE * zoomLevel
      return clampPan(
        screenX - worldX * zoomLevel - Math.floor((canvas.width - mapW) / 2),
        screenY - worldY * zoomLevel - Math.floor((canvas.height - mapH) / 2),
        zoomLevel,
      )
    },
    [clampPan, officeState, panRef],
  )

  const toggleSelectionAtPoint = useCallback(
    (clientX: number, clientY: number) => {
      const pos = screenToWorld(clientX, clientY)
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
    [officeState, onClick, screenToWorld],
  )

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (isPanningRef.current) {
        const dpr = getCanvasScale()
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
      toggleSelectionAtPoint(e.clientX, e.clientY)
    },
    [onUserInteraction, toggleSelectionAtPoint],
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
        const dpr = getCanvasScale()
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

  const handleTouchStart = useCallback(
    (event: React.TouchEvent) => {
      onUserInteraction?.()
      onHoverChange?.(null, null)
      officeState.hoveredAgentId = null
      officeState.cameraFollowId = null

      const touches = listTouches(event.touches)
      if (touches.length >= 2) {
        const [firstTouch, secondTouch] = touches
        const center = getTouchCenter(firstTouch, secondTouch)
        const focusPoint = screenToWorld(center.clientX, center.clientY)
        if (!focusPoint) return
        touchGestureRef.current = {
          kind: 'pinch',
          firstTouchId: firstTouch.identifier,
          secondTouchId: secondTouch.identifier,
          startDistance: Math.max(32, getTouchDistance(firstTouch, secondTouch)),
          startZoom: zoomRef.current,
          worldX: focusPoint.worldX,
          worldY: focusPoint.worldY,
        }
        return
      }

      const [touch] = touches
      if (!touch) return
      touchGestureRef.current = {
        kind: 'pan',
        touchId: touch.identifier,
        startClientX: touch.clientX,
        startClientY: touch.clientY,
        startPanX: panRef.current.x,
        startPanY: panRef.current.y,
        moved: false,
      }
    },
    [officeState, onHoverChange, onUserInteraction, panRef, screenToWorld],
  )

  const handleTouchMove = useCallback(
    (event: React.TouchEvent) => {
      const gesture = touchGestureRef.current
      const touches = listTouches(event.touches)
      if (touches.length === 0) return

      if (touches.length >= 2) {
        const currentFirst =
          gesture.kind === 'pinch' ? getTouchPoint(touches, gesture.firstTouchId) : touches[0]
        const currentSecond =
          gesture.kind === 'pinch' ? getTouchPoint(touches, gesture.secondTouchId) : touches[1]
        if (!currentFirst || !currentSecond) return

        if (gesture.kind !== 'pinch') {
          const center = getTouchCenter(currentFirst, currentSecond)
          const focusPoint = screenToWorld(center.clientX, center.clientY)
          if (!focusPoint) return
          touchGestureRef.current = {
            kind: 'pinch',
            firstTouchId: currentFirst.identifier,
            secondTouchId: currentSecond.identifier,
            startDistance: Math.max(32, getTouchDistance(currentFirst, currentSecond)),
            startZoom: zoomRef.current,
            worldX: focusPoint.worldX,
            worldY: focusPoint.worldY,
          }
        }

        const resolvedGesture = touchGestureRef.current
        if (resolvedGesture.kind !== 'pinch') return

        event.preventDefault()
        const center = getTouchCenter(currentFirst, currentSecond)
        const currentDistance = Math.max(32, getTouchDistance(currentFirst, currentSecond))
        const nextZoom = normalizeZoom(
          Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, resolvedGesture.startZoom * (currentDistance / resolvedGesture.startDistance))),
        )
        const canvas = canvasRef.current
        if (!canvas) return
        const rect = canvas.getBoundingClientRect()
        const dpr = getCanvasScale()
        const screenX = (center.clientX - rect.left) * dpr
        const screenY = (center.clientY - rect.top) * dpr
        panRef.current = computePanFromFocus(resolvedGesture.worldX, resolvedGesture.worldY, screenX, screenY, nextZoom)
        onZoomChange(nextZoom)
        return
      }

      if (gesture.kind !== 'pan') return
      const touch = getTouchPoint(touches, gesture.touchId)
      if (!touch) return

      event.preventDefault()
      const dpr = getCanvasScale()
      const dx = (touch.clientX - gesture.startClientX) * dpr
      const dy = (touch.clientY - gesture.startClientY) * dpr
      const moved = Math.hypot(dx, dy) > TOUCH_DRAG_THRESHOLD_PX * dpr
      touchGestureRef.current = {
        ...gesture,
        moved: gesture.moved || moved,
      }
      panRef.current = clampPan(gesture.startPanX + dx, gesture.startPanY + dy)
    },
    [clampPan, computePanFromFocus, onZoomChange, panRef, screenToWorld],
  )

  const handleTouchEnd = useCallback(
    (event: React.TouchEvent) => {
      const remainingTouches = listTouches(event.touches)
      const changedTouches = listTouches(event.changedTouches)
      const gesture = touchGestureRef.current

      if (gesture.kind === 'pan') {
        const endedTouch = getTouchPoint(changedTouches, gesture.touchId)
        if (endedTouch && !gesture.moved) {
          onUserInteraction?.()
          toggleSelectionAtPoint(endedTouch.clientX, endedTouch.clientY)
        }
      }

      if (remainingTouches.length >= 2) {
        const [firstTouch, secondTouch] = remainingTouches
        const center = getTouchCenter(firstTouch, secondTouch)
        const focusPoint = screenToWorld(center.clientX, center.clientY)
        touchGestureRef.current = focusPoint
          ? {
              kind: 'pinch',
              firstTouchId: firstTouch.identifier,
              secondTouchId: secondTouch.identifier,
              startDistance: Math.max(32, getTouchDistance(firstTouch, secondTouch)),
              startZoom: zoomRef.current,
              worldX: focusPoint.worldX,
              worldY: focusPoint.worldY,
            }
          : { kind: 'idle' }
        return
      }

      if (remainingTouches.length === 1) {
        const [touch] = remainingTouches
        touchGestureRef.current = {
          kind: 'pan',
          touchId: touch.identifier,
          startClientX: touch.clientX,
          startClientY: touch.clientY,
          startPanX: panRef.current.x,
          startPanY: panRef.current.y,
          moved: false,
        }
        return
      }

      touchGestureRef.current = { kind: 'idle' }
    },
    [onUserInteraction, panRef, screenToWorld, toggleSelectionAtPoint],
  )

  const handleTouchCancel = useCallback(() => {
    touchGestureRef.current = { kind: 'idle' }
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
        touchAction: 'none',
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
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchCancel}
        onContextMenu={(e) => e.preventDefault()}
        style={{ display: 'block', touchAction: 'none' }}
      />
    </div>
  )
}
