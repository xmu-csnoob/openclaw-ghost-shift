import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './vitest.setup.ts',
    css: false,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      reportsDirectory: './coverage',
      include: [
        'src/App.tsx',
        'src/replay.ts',
        'src/services/ApiClient.ts',
        'src/components/LiveOfficeStage.tsx',
        'src/components/ReplayControlBar.tsx',
        'src/components/AgentHoverCard.tsx',
        'src/components/ProductDashboard.tsx',
        'src/components/MiniSparkline.tsx',
      ],
      thresholds: {
        statements: 85,
        branches: 85,
        functions: 85,
        lines: 85,
      },
    },
  },
})
