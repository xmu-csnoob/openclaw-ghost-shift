import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import GhostShiftSurface from './pages/GhostShiftSurface.js'

function resolveBasename(pathname: string): string {
  if (pathname === '/office' || pathname.startsWith('/office/')) {
    return '/office'
  }

  return '/'
}

function App() {
  const basename = resolveBasename(window.location.pathname)

  return (
    <BrowserRouter basename={basename}>
      <Routes>
        <Route index element={<GhostShiftSurface page="landing" />} />
        <Route path="live" element={<GhostShiftSurface page="live" />} />
        <Route path="replay" element={<GhostShiftSurface page="replay" />} />
        <Route path="embed" element={<GhostShiftSurface page="embed" />} />
        <Route path="embed/card" element={<GhostShiftSurface page="embed-card" />} />
        <Route path="docs" element={<GhostShiftSurface page="docs" />} />
        <Route path="about" element={<GhostShiftSurface page="about" />} />
        <Route path="*" element={<Navigate replace to="/" />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
