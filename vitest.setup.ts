import '@testing-library/jest-dom/vitest'

// Mock ResizeObserver for tests
class TestResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

if (typeof window !== 'undefined' && !window.ResizeObserver) {
  window.ResizeObserver = TestResizeObserver as any
}
