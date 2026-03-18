import '@testing-library/jest-dom/vitest'
import { setLocale } from './src/content/locale.js'

// Set locale to English for all tests (default is 'zh')
setLocale('en')

// Mock ResizeObserver for tests
class TestResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

if (typeof window !== 'undefined' && !window.ResizeObserver) {
  window.ResizeObserver = TestResizeObserver as any
}

if (typeof window !== 'undefined' && typeof window.localStorage?.setItem !== 'function') {
  const storage = new Map<string, string>()
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => {
        storage.set(key, String(value))
      },
      removeItem: (key: string) => {
        storage.delete(key)
      },
      clear: () => {
        storage.clear()
      },
    },
  })
}

if (typeof HTMLCanvasElement !== 'undefined') {
  const gradientStub = {
    addColorStop() {},
  }

  const contextStub = {
    canvas: null,
    imageSmoothingEnabled: false,
    fillStyle: '#000',
    strokeStyle: '#000',
    lineWidth: 1,
    font: '12px sans-serif',
    save() {},
    restore() {},
    beginPath() {},
    closePath() {},
    moveTo() {},
    lineTo() {},
    quadraticCurveTo() {},
    arc() {},
    clip() {},
    fill() {},
    stroke() {},
    clearRect() {},
    fillRect() {},
    drawImage() {},
    setLineDash() {},
    fillText() {},
    measureText(text: string) {
      return { width: String(text).length * 8 }
    },
    createLinearGradient() {
      return gradientStub
    },
    createRadialGradient() {
      return gradientStub
    },
  }

  Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
    configurable: true,
    value: function getContext() {
      return { ...contextStub, canvas: this }
    },
  })

  Object.defineProperty(HTMLCanvasElement.prototype, 'toDataURL', {
    configurable: true,
    value: () => 'data:image/png;base64,',
  })
}
