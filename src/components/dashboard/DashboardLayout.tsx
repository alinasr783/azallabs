import React from 'react'
import { Outlet, NavLink, Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { useAgentConfig } from '../../context/AgentConfigContext'

export const DashboardLayout: React.FC = () => {
  const { lastSavedAt } = useAgentConfig()

  return (
    <div className="min-h-screen w-full bg-[#0d0e11] flex flex-col text-[#f3f3ee]" dir="rtl">
      {/* Top Header */}
      <header className="h-16 bg-[#14151a] border-b border-[#262833] px-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-4 min-w-0">
          <Link to="/" className="text-base font-semibold tracking-tight text-[#cc785c] shrink-0">
            المساعد الذكي
          </Link>

          {/* Clean Navigation Tabs */}
          <nav className="flex items-center gap-1 overflow-x-auto [&::-webkit-scrollbar]:hidden [scrollbar-width:none] min-w-0">
            <NavLink
              to="/dashboard/overview"
              end
              className={({ isActive }) =>
                `px-3 py-1.5 rounded-xl text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  isActive
                    ? 'bg-[#cc785c] text-white font-semibold shadow-xs'
                    : 'text-[#9da0a8] hover:text-[#f3f3ee] hover:bg-[#1a1b22]'
                }`
              }
            >
              نظرة عامة
            </NavLink>

            <NavLink
              to="/dashboard/system-prompt"
              className={({ isActive }) =>
                `px-3 py-1.5 rounded-xl text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  isActive
                    ? 'bg-[#cc785c] text-white font-semibold shadow-xs'
                    : 'text-[#9da0a8] hover:text-[#f3f3ee] hover:bg-[#1a1b22]'
                }`
              }
            >
              التوجيه الأساسي
            </NavLink>

            <NavLink
              to="/settings"
              className="px-3 py-1.5 rounded-xl text-xs font-medium text-[#9da0a8] hover:text-[#f3f3ee] hover:bg-[#1a1b22] transition-colors whitespace-nowrap shrink-0"
            >
              خوادم الربط (MCP)
            </NavLink>
          </nav>
        </div>

        {/* Back Link */}
        <div className="flex items-center gap-4 text-xs">
          {lastSavedAt && (
            <span className="hidden sm:inline text-[#6b6e79]">
              آخر حفظ: {lastSavedAt}
            </span>
          )}
          <Link
            to="/"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[#dadce0] dark:border-[#3c4043] hover:bg-[#f1f3f4] dark:hover:bg-[#303134] transition-colors"
          >
            <span>العودة للمهام</span>
            <ArrowRight className="w-3.5 h-3.5 rotate-180" />
          </Link>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 p-4 sm:p-6 lg:p-10 max-w-5xl mx-auto w-full">
        <Outlet />
      </main>
    </div>
  )
}
