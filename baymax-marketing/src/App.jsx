import { Routes, Route, useNavigate } from 'react-router-dom'
import Landing from '@/pages/Landing'
import DocsPage from '@/pages/Docs'
import AboutPage from '@/pages/About'

function AppRoutes() {
  const navigate = useNavigate()

  return (
    <Routes>
      <Route
        path="/"
        element={<Landing onGetStarted={() => navigate('/docs')} />}
      />
      <Route path="/docs" element={<DocsPage />} />
      <Route path="/about" element={<AboutPage />} />
    </Routes>
  )
}

export default function App() {
  return (
    <div className="bg-background text-foreground min-h-screen">
      <AppRoutes />
    </div>
  )
}
