import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

// Wrap a page in this to require an authenticated session.
// Pass `role="citizen"` or `role="employee"` to also gate on the backend role.
export default function ProtectedRoute({ children, role }) {
  const { session, loading, role: userRole, profileLoading } = useAuth()

  if (loading || (session && profileLoading)) {
    return (
      <div className="flex h-screen items-center justify-center text-graphite">
        Loading...
      </div>
    )
  }

  if (!session) {
    return <Navigate to="/login" replace />
  }

  if (role && userRole && userRole !== role) {
    return <Navigate to="/dashboard" replace />
  }

  return children
}
