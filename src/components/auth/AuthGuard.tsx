import React from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

interface AuthGuardProps {
  children: React.ReactNode
}

export const AuthGuard: React.FC<AuthGuardProps> = ({ children }) => {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0d0e11] flex flex-col items-center justify-center text-[#f3f3ee]">
        <div className="flex items-center gap-3 select-none">
          <span className="braille-spinner text-[#cc785c]" />
          <span className="text-sm font-medium animate-gentle-pulse">جاري التحقق من الحساب...</span>
        </div>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/auth" state={{ from: location }} replace />
  }

  return <>{children}</>
}
