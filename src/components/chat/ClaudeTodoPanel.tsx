import React, { useState } from 'react'
import { X, Plus, ChevronRight, ChevronDown } from 'lucide-react'

export interface TodoItem {
  id: string
  title: string
  status: 'pending' | 'in_progress' | 'running' | 'completed' | 'failed'
  required?: string
  howToExecute?: string
  expectedOutput?: string
  output?: string
  agentRole?: string
  description?: string
  taskType?: string
}

export interface ClaudeTodoList {
  title: string
  items: TodoItem[]
}

interface ClaudeTodoPanelProps {
  todoList: ClaudeTodoList | null
  isGenerating?: boolean
  isOpen: boolean
  onClose: () => void
  onToggleItemStatus: (id: string) => void
  onClearList: () => void
  onAddItem: (title: string) => void
}

export const ClaudeTodoPanel: React.FC<ClaudeTodoPanelProps> = ({
  todoList,
  isGenerating = false,
  isOpen,
  onClose,
  onToggleItemStatus,
  onClearList,
  onAddItem,
}) => {
  const [newTitle, setNewTitle] = useState('')
  const [isAdding, setIsAdding] = useState(false)
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null)

  if (!isOpen) return null

  const items = todoList?.items || []
  const completedCount = items.filter((i) => i.status === 'completed').length
  const totalCount = items.length
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0

  const statusGlyph = (status: string) => {
    switch (status) {
      case 'completed': return <span className="text-emerald-400">✔</span>
      case 'in_progress':
      case 'running': return <span className="text-[#cc785c] animate-gentle-pulse">●</span>
      case 'failed': return <span className="text-red-400">✖</span>
      default: return <span className="text-[#4a4d58]">○</span>
    }
  }

  const handleAddItem = () => {
    if (!newTitle.trim()) return
    onAddItem(newTitle.trim())
    setNewTitle('')
    setIsAdding(false)
  }

  return (
    <aside className="w-72 bg-[#14151a] border-r border-[#2c2e3a] flex flex-col h-full shrink-0 animate-slide-left">
      {/* Header */}
      <div className="h-11 px-3 flex items-center justify-between border-b border-[#2c2e3a] shrink-0">
        <span className="text-[11px] text-[#6b6e79] select-none">خطة التنفيذ</span>
        <div className="flex items-center gap-2">
          <button
            onClick={onClearList}
            className="text-[10px] text-[#4a4d58] hover:text-red-400 transition-colors cursor-pointer"
          >
            مسح
          </button>
          <button
            onClick={onClose}
            className="p-0.5 text-[#6b6e79] hover:text-[#f3f3ee] transition-colors cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Progress */}
      {totalCount > 0 && (
        <div className="px-3 py-2 border-b border-[#2c2e3a]/60">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] text-[#9da0a8]">
              {completedCount} من {totalCount} ({progressPercent}%)
            </span>
          </div>
          <div className="progress-bar">
            <div
              className="progress-bar-fill"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      )}

      {/* Items List */}
      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-0.5">
        {isGenerating && totalCount === 0 && (
          <div className="px-2 py-4 text-center">
            <div className="flex items-center justify-center gap-2 text-[11px] text-[#6b6e79]">
              <span className="braille-spinner" />
              <span>🧠 Planning First: جارٍ قراءة System Prompt والأدوات لبناء خطة التنفيذ...</span>
            </div>
          </div>
        )}

        {items.map((item, idx) => {
          const isExpanded = expandedItemId === item.id
          const hasDetails = item.required || item.howToExecute || item.expectedOutput || item.output || item.description

          return (
            <div key={item.id} className="rounded px-2 py-1.5">
              {/* Item Row */}
              <div className="flex items-start gap-2">
                <button
                  onClick={() => onToggleItemStatus(item.id)}
                  className="mt-0.5 shrink-0 cursor-pointer"
                >
                  {statusGlyph(item.status)}
                </button>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1">
                    <span className={`text-[11px] leading-relaxed ${
                      item.status === 'completed'
                        ? 'text-[#6b6e79] line-through'
                        : item.status === 'in_progress' || item.status === 'running'
                          ? 'text-[#f3f3ee]'
                          : 'text-[#9da0a8]'
                    }`}>
                      {idx + 1}. {item.title}
                    </span>

                    {item.taskType && (
                      <span className="shrink-0 text-[9px] text-[#cc785c] font-mono bg-[#cc785c]/10 px-1 py-0.5 rounded border border-[#cc785c]/20">
                        {item.taskType}
                      </span>
                    )}

                    {hasDetails && (
                      <button
                        onClick={() => setExpandedItemId(isExpanded ? null : item.id)}
                        className="shrink-0 text-[#4a4d58] hover:text-[#6b6e79] cursor-pointer"
                      >
                        {isExpanded
                          ? <ChevronDown className="w-3 h-3" />
                          : <ChevronRight className="w-3 h-3" />
                        }
                      </button>
                    )}
                  </div>

                  {item.agentRole && (
                    <span className="text-[10px] text-[#4a4d58]">{item.agentRole}</span>
                  )}
                </div>
              </div>

              {/* Expanded Details */}
              {isExpanded && hasDetails && (
                <div className="mt-1.5 mr-5 pr-2 border-r border-[#2c2e3a] space-y-1.5">
                  {item.taskType && (
                    <div>
                      <span className="text-[10px] text-[#6b6e79]">نوع المهمة: </span>
                      <span className="text-[10px] text-[#cc785c]">{item.taskType}</span>
                    </div>
                  )}
                  {item.description && (
                    <div>
                      <span className="text-[10px] text-[#6b6e79]">الوصف: </span>
                      <span className="text-[10px] text-[#9da0a8] whitespace-pre-wrap">{item.description}</span>
                    </div>
                  )}
                  {item.required && (
                    <div>
                      <span className="text-[10px] text-[#6b6e79]">المطلوب: </span>
                      <span className="text-[10px] text-[#9da0a8]">{item.required}</span>
                    </div>
                  )}
                  {item.howToExecute && (
                    <div>
                      <span className="text-[10px] text-[#6b6e79]">التنفيذ: </span>
                      <span className="text-[10px] text-[#9da0a8]">{item.howToExecute}</span>
                    </div>
                  )}
                  {item.expectedOutput && (
                    <div>
                      <span className="text-[10px] text-[#6b6e79]">المخرجات: </span>
                      <span className="text-[10px] text-[#9da0a8]">{item.expectedOutput}</span>
                    </div>
                  )}
                  {item.output && (
                    <div className="mt-1 p-2 rounded bg-[#0d0e11] border border-[#2c2e3a]">
                      <span className="text-[10px] text-[#6b6e79]">النتيجة: </span>
                      <span className="text-[10px] text-emerald-400 whitespace-pre-wrap">{item.output}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Add Item */}
      <div className="px-2 py-2 border-t border-[#2c2e3a] shrink-0">
        {isAdding ? (
          <div className="flex items-center gap-1.5">
            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddItem()}
              placeholder="عنوان الخطوة..."
              className="flex-1 px-2 py-1 rounded bg-[#0d0e11] border border-[#2c2e3a] text-[11px] text-[#f3f3ee] focus:border-[#cc785c] focus:outline-none"
              autoFocus
            />
            <button
              onClick={handleAddItem}
              className="text-[11px] text-[#cc785c] hover:text-[#be684e] cursor-pointer"
            >
              إضافة
            </button>
            <button
              onClick={() => { setIsAdding(false); setNewTitle('') }}
              className="text-[11px] text-[#6b6e79] hover:text-[#9da0a8] cursor-pointer"
            >
              إلغاء
            </button>
          </div>
        ) : (
          <button
            onClick={() => setIsAdding(true)}
            className="flex items-center gap-1 text-[11px] text-[#6b6e79] hover:text-[#9da0a8] transition-colors cursor-pointer"
          >
            <Plus className="w-3 h-3" />
            <span>إضافة خطوة</span>
          </button>
        )}
      </div>
    </aside>
  )
}
