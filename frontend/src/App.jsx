import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import Navbar from './components/Navbar'
import Landing from './pages/Landing'
import Login from './pages/Login'
import Signup from './pages/Signup'
import Dashboard from './pages/Dashboard'
import NewRequest from './pages/NewRequest'
import RequestDetail from './pages/RequestDetail'

function Layout({ children }) {
  return (
    <div className="min-h-screen bg-paper">
      <Navbar />
      {children}
    </div>
  )
}

// Wraps a page so it fades in on enter and out on exit. Combined with
// AnimatePresence mode="wait" below, navigating (e.g. Open Dashboard,
// New Request) fades the current page out, then the next page in.
function PageFade({ children }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25, ease: 'easeInOut' }}
    >
      {children}
    </motion.div>
  )
}

function AnimatedRoutes() {
  const location = useLocation()
  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<PageFade><Landing /></PageFade>} />
        <Route path="/login" element={<PageFade><Login /></PageFade>} />
        <Route path="/signup" element={<PageFade><Signup /></PageFade>} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <PageFade>
                <Layout>
                  <Dashboard />
                </Layout>
              </PageFade>
            </ProtectedRoute>
          }
        />
        <Route
          path="/requests/new"
          element={
            <ProtectedRoute role="citizen">
              <PageFade>
                <Layout>
                  <NewRequest />
                </Layout>
              </PageFade>
            </ProtectedRoute>
          }
        />
        <Route
          path="/requests/:id"
          element={
            <ProtectedRoute>
              <PageFade>
                <Layout>
                  <RequestDetail />
                </Layout>
              </PageFade>
            </ProtectedRoute>
          }
        />
      </Routes>
    </AnimatePresence>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AnimatedRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}
