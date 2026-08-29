import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { AgentConfigProvider } from './context/AgentConfigContext'
import { McpProvider } from './context/McpContext'
import { ProjectProvider } from './context/ProjectContext'
import { AuthGuard } from './components/auth/AuthGuard'
import { ChatPage } from './pages/ChatPage'
import { AuthPage } from './pages/AuthPage'
import { TickTickCallbackPage } from './pages/TickTickCallbackPage'
import { SettingsPage } from './pages/SettingsPage'
import { ProjectsPage } from './pages/ProjectsPage'
import { ProjectDetailPage } from './pages/ProjectDetailPage'
import { DashboardLayout } from './components/dashboard/DashboardLayout'
import { DashboardOverview } from './pages/DashboardOverview'

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ProjectProvider>
          <AgentConfigProvider>
            <McpProvider>
              <Routes>
                {/* 1. Public Authentication Routes */}
                <Route path="/auth" element={<AuthPage />} />
                <Route path="/auth/ticktick/callback" element={<TickTickCallbackPage />} />

                {/* 2. Protected Routes (Mandatory Login) */}
                <Route
                  path="/"
                  element={
                    <AuthGuard>
                      <ChatPage />
                    </AuthGuard>
                  }
                />

                <Route
                  path="/projects"
                  element={
                    <AuthGuard>
                      <ProjectsPage />
                    </AuthGuard>
                  }
                />

                <Route
                  path="/projects/:id"
                  element={
                    <AuthGuard>
                      <ProjectDetailPage />
                    </AuthGuard>
                  }
                />

                <Route
                  path="/settings"
                  element={
                    <AuthGuard>
                      <SettingsPage />
                    </AuthGuard>
                  }
                />

                {/* 3. Dashboard */}
                <Route
                  path="/dashboard"
                  element={
                    <AuthGuard>
                      <DashboardLayout />
                    </AuthGuard>
                  }
                >
                  <Route index element={<Navigate to="overview" replace />} />
                  <Route path="overview" element={<DashboardOverview />} />
                  <Route path="system-prompt" element={<Navigate to="/settings?tab=system-prompt" replace />} />
                </Route>

                {/* Fallback route */}
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </McpProvider>
          </AgentConfigProvider>
        </ProjectProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
