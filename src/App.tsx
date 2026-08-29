import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { AgentConfigProvider } from './context/AgentConfigContext'
import { McpProvider } from './context/McpContext'
import { ChatPage } from './pages/ChatPage'
import { AuthPage } from './pages/AuthPage'
import { TickTickCallbackPage } from './pages/TickTickCallbackPage'
import { SettingsPage } from './pages/SettingsPage'
import { DashboardLayout } from './components/dashboard/DashboardLayout'
import { DashboardOverview } from './pages/DashboardOverview'

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AgentConfigProvider>
          <McpProvider>
            <Routes>
            {/* 1. Main Chat Page */}
            <Route path="/" element={<ChatPage />} />

            {/* 2. Authentication & Callbacks */}
            <Route path="/auth" element={<AuthPage />} />
            <Route path="/auth/ticktick/callback" element={<TickTickCallbackPage />} />

            {/* 3. Settings Page (MCP Management) */}
            <Route path="/settings" element={<SettingsPage />} />

            {/* 3. Dashboard (Temporarily unprotected as requested) */}
            <Route path="/dashboard" element={<DashboardLayout />}>
              <Route index element={<Navigate to="overview" replace />} />
              <Route path="overview" element={<DashboardOverview />} />
              <Route path="system-prompt" element={<Navigate to="/settings?tab=system-prompt" replace />} />
            </Route>

            {/* Fallback route */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          </McpProvider>
        </AgentConfigProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
