import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Toaster } from 'sonner'
import { AuthProvider, useAuth } from '@/contexts/AuthContext'
import { LoginPage } from '@/pages/LoginPage'
import { LobbyPage } from '@/pages/LobbyPage'
import { ProfilePage } from '@/pages/ProfilePage'
import { GamePage } from '@/pages/GamePage'
import { AdminPage } from '@/pages/AdminPage'
import { BankPage } from '@/pages/BankPage'
import { ParticleBackground } from '@/components/ui/ParticleBackground'
import { LiveFeedSidebar } from '@/components/layout/LiveFeedSidebar'
import { HubPage } from '@/pages/HubPage'


function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { profile, loading } = useAuth()
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h1 className="font-serif text-4xl font-bold bg-gradient-to-b from-gold-light via-gold to-gold-dark bg-clip-text text-transparent animate-pulse">GAMBA</h1>
        <p className="text-muted-foreground mt-2 text-sm">Загрузка...</p>
      </div>
    </div>
  )
  return profile ? <>{children}</> : <Navigate to="/" replace />
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { isAdmin, loading } = useAuth()
  if (loading) return null
  return isAdmin ? <>{children}</> : <Navigate to="/lobby" replace />
}

function AppRoutes() {
  const { profile, loading } = useAuth()
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <h1 className="font-serif text-4xl font-bold bg-gradient-to-b from-gold-light via-gold to-gold-dark bg-clip-text text-transparent animate-pulse">GAMBA</h1>
      </div>
    </div>
  )

  return (
    <Routes>
      <Route path="/" element={profile ? <Navigate to="/lobby" replace /> : <LoginPage />} />
      {/* <Route path="/hub" element={<PrivateRoute><HubPage /></PrivateRoute>} /> */}

      <Route path="/lobby" element={<PrivateRoute><LobbyPage /></PrivateRoute>} />
      <Route path="/profile" element={<PrivateRoute><ProfilePage /></PrivateRoute>} />
      <Route path="/game/:type" element={<PrivateRoute><GamePage /></PrivateRoute>} />
      <Route path="/admin" element={<AdminRoute><AdminPage /></AdminRoute>} />
      <Route path="/bank" element={<PrivateRoute><BankPage /></PrivateRoute>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ParticleBackground />
        <div className="relative z-10 flex min-h-screen overflow-x-hidden">
          <main className="flex-1 relative">
            <AppRoutes />
          </main>
          <SidebarWrapper />
        </div>
        <Toaster position="top-right" theme="dark" richColors toastOptions={{
          style: { background: 'var(--card)', border: '1px solid var(--gold)', color: 'var(--foreground)' },
        }} />
      </AuthProvider>
    </BrowserRouter>
  )
}

function SidebarWrapper() {
  const { profile } = useAuth();
  
  if (!profile) return null;

  return <LiveFeedSidebar />;
}
