import '@testing-library/jest-dom/vitest'

class TestResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

if (typeof window !== 'undefined' && !('ResizeObserver' in window)) {
  ;(window as Window & { ResizeObserver?: typeof TestResizeObserver }).ResizeObserver = TestResizeObserver
}

if (typeof globalThis !== 'undefined' && !('ResizeObserver' in globalThis)) {
  ;(globalThis as typeof globalThis & { ResizeObserver?: typeof TestResizeObserver }).ResizeObserver = TestResizeObserver
}
