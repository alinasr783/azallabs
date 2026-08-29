import React from 'react'
import { Outlet, NavLink, Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { useAgentConfig } from '../../context/AgentConfigContext'

export const DashboardLayout: React.FC = () => {
  const { lastSavedAt } = useAgentConfig()

  return (
    <div className="min-h-screen w-full bg-[#0d0e11] flex flex-col text-[#f3f3ee]" dir="rtl">
      {/* Header */}
      <header className="h-11 bg-[#14151a] border-b border-[#2c2e3a] px-4 flex items-center justify-between">
        <div className="flex items-center gap-4 min-w-0">
          <Link to="/" className="text-sm font-bold text-[#f3f3ee] shrink-0">
            Azal Labs
          </Link>

          {/* Tabs */}
          <nav className="flex items-center gap-1 overflow-x-auto min-w-0">
            <NavLink
              to="/dashboard/overview"
              end
              className={({ isActive }) =>
                `px-2.5 py-1 rounded text-xs transition-colors whitespace-nowrap shrink-0 ${
                  isActive
                    ? 'bg-[#1a1b22] text-[#cc785c] font-bold'
                    : 'text-[#6b6e79] hover:text-[#9da0a8]'
                }`
              }
            >
              نظرة عامة
            </NavLink>

            <NavLink
              to="/settings?tab=system-prompt"
              className="px-2.5 py-1 rounded text-xs text-[#6b6e79] hover:text-[#9da0a8] transition-colors whitespace-nowrap shrink-0"
            >
              التوجيه الأساسي
            </NavLink>

            <NavLink
              to="/settings?tab=mcp"
              className="px-2.5 py-1 rounded text-xs text-[#6b6e79] hover:text-[#9da0a8] transition-colors whitespace-nowrap shrink-0"
            >
              خوادم الربط (MCP)
            </NavLink>
          </nav>
        </div>

        {/* Back Link */}
        <div className="flex items-center gap-3 text-xs">
          {lastSavedAt && (
            <span className="hidden sm:inline text-[11px] text-[#4a4d58]">
              آخر حفظ: {lastSavedAt}
            </span>
          )}
          <Link
            to="/"
            className="flex items-center gap-1 text-[11px] text-[#6b6e79] hover:text-[#f3f3ee] transition-colors"
          >
            <span>العودة للمحادثة</span>
            <ArrowRight className="w-3 h-3 rotate-180" />
          </Link>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 p-4 sm:p-6 max-w-4xl mx-auto w-full">
        <Outlet />
      </main>
    </div>
  )
}
