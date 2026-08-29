import React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Plus, Trash2, LogOut, LogIn, X, Settings } from 'lucide-react'
import type { TaskSession } from '../../types/chat'
import { useAuth } from '../../context/AuthContext'

interface ChatSidebarProps {
  tasks: TaskSession[]
  currentTaskId: string | null
  onSelectTask: (id: string) => void
  onNewTask: () => void
  onDeleteTask: (id: string) => void
  isOpen: boolean
  onToggleOpen: () => void
}

export const ChatSidebar: React.FC<ChatSidebarProps> = ({
  tasks,
  currentTaskId,
  onSelectTask,
  onNewTask,
  onDeleteTask,
  isOpen,
  onToggleOpen,
}) => {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          onClick={onToggleOpen}
          className="fixed inset-0 bg-black/50 z-30 md:hidden"
        />
      )}

      {/* Sidebar — slides from right (RTL) */}
      <aside
        className={`fixed md:static inset-y-0 right-0 z-40 w-60 bg-[#14151a] border-l border-[#2c2e3a] flex flex-col transition-transform duration-200 ${
          isOpen ? 'translate-x-0' : 'translate-x-full md:translate-x-0 md:w-0 md:border-none md:overflow-hidden'
        }`}
      >
        {/* Header */}
        <div className="h-12 px-3 flex items-center justify-between border-b border-[#2c2e3a]">
          <span className="text-sm font-bold text-[#f3f3ee]">Azal Labs</span>
          <button
            onClick={onToggleOpen}
            className="p-1 text-[#6b6e79] hover:text-[#f3f3ee] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* New Task */}
        <div className="p-2">
          <button
            onClick={onNewTask}
            className="w-full py-2 px-3 rounded-lg bg-[#cc785c] hover:bg-[#be684e] text-white flex items-center justify-center gap-1.5 text-xs font-bold transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>مهمة جديدة</span>
          </button>
        </div>

        {/* Sessions List */}
        <div className="flex-1 overflow-y-auto px-2 space-y-0.5">
          <div className="px-2 py-1.5 text-[10px] text-[#6b6e79] uppercase tracking-wider select-none">
            الجلسات
          </div>

          {tasks.length === 0 ? (
            <div className="px-2 py-4 text-center text-[11px] text-[#4a4d58]">
              لا توجد جلسات سابقة
            </div>
          ) : (
            tasks.map((task) => {
              const isSelected = currentTaskId === task.id
              return (
                <div
                  key={task.id}
                  onClick={() => onSelectTask(task.id)}
                  className={`group flex items-center justify-between px-2 py-1.5 rounded cursor-pointer text-xs transition-colors ${
                    isSelected
                      ? 'bg-[#1a1b22] text-[#f3f3ee]'
                      : 'text-[#9da0a8] hover:text-[#f3f3ee] hover:bg-[#1a1b22]/50'
                  }`}
                >
                  <span className="truncate">
                    {isSelected && <span className="text-[#cc785c] ml-1">●</span>}
                    {task.title || 'مهمة جديدة'}
                  </span>

                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onDeleteTask(task.id)
                    }}
                    className="opacity-0 group-hover:opacity-100 p-0.5 text-[#6b6e79] hover:text-red-400 transition-opacity cursor-pointer"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              )
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-2 border-t border-[#2c2e3a] space-y-1.5">
          <Link
            to="/settings"
            className="flex items-center gap-2 px-2 py-1.5 rounded text-[11px] text-[#6b6e79] hover:text-[#9da0a8] transition-colors"
          >
            <Settings className="w-3.5 h-3.5" />
            <span>الإعدادات</span>
          </Link>

          {user ? (
            <div className="flex items-center justify-between px-2 py-1.5 text-[11px]">
              <span className="text-[#6b6e79] truncate max-w-[130px]">{user.email}</span>
              <button
                onClick={signOut}
                className="text-[#6b6e79] hover:text-red-400 transition-colors cursor-pointer"
                title="خروج"
              >
                <LogOut className="w-3 h-3" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => navigate('/auth')}
              className="w-full py-1.5 px-2 rounded text-[11px] text-[#6b6e79] hover:text-[#f3f3ee] border border-[#2c2e3a] hover:border-[#cc785c]/40 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <LogIn className="w-3 h-3" />
              <span>دخول</span>
            </button>
          )}
        </div>
      </aside>
    </>
  )
}
