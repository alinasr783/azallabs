import React, { useEffect, useState } from 'react'
import { Check, Loader2 } from 'lucide-react'
import type { ClaudeTodoList, TodoItem } from './ClaudeTodoPanel'

interface ActiveTaskCardProps {
  plan: ClaudeTodoList | null
}

export const ActiveTaskCard: React.FC<ActiveTaskCardProps> = ({ plan }) => {
  const steps = plan?.items || []
  const totalCount = steps.length
  const activeStep = steps.find((s) => s.status === 'in_progress' || s.status === 'running') || null
  const isPlanning = totalCount === 0
  const doneCount = steps.filter((s) => s.status === 'completed').length

  const [displayed, setDisplayed] = useState<TodoItem | null>(activeStep)
  const [phase, setPhase] = useState<'in' | 'out'>('in')

  useEffect(() => {
    if (isPlanning) {
      setDisplayed(null)
      setPhase('in')
      return
    }
    if (!activeStep) {
      // Execution finished — animate the last shown task out
      if (displayed) {
        setPhase('out')
        const t = setTimeout(() => {
          setDisplayed(null)
          setPhase('in')
        }, 260)
        return () => clearTimeout(t)
      }
      return
    }
    if (displayed && displayed.id !== activeStep.id) {
      // Smooth swap: animate old out, then new in
      setPhase('out')
      const t = setTimeout(() => {
        setDisplayed(activeStep)
        setPhase('in')
      }, 260)
      return () => clearTimeout(t)
    }
    if (!displayed) {
      setDisplayed(activeStep)
      setPhase('in')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeStep?.id, isPlanning])

  // Planning-First phase — single thinking card
  if (isPlanning && plan) {
    return (
      <div className="task-in mt-2 rounded-xl border border-[#2c2e3a] bg-[#14151a] px-4 py-3 flex items-center gap-3">
        <Loader2 className="w-4 h-4 text-[#cc785c] animate-spin shrink-0" />
        <span className="text-xs text-[#9da0a8]">
          🧠 Planning First — جارٍ قراءة النظام والأدوات لبناء خطة التنفيذ...
        </span>
      </div>
    )
  }

  if (!displayed) return null

  const isActive = displayed.status === 'in_progress' || displayed.status === 'running'
  const isDone = displayed.status === 'completed'
  const dispIndex = steps.findIndex((s) => s.id === displayed.id)
  const progressPercent = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0

  return (
    <div
      className={`${phase === 'out' ? 'task-out' : 'task-in'} mt-2 rounded-xl border border-[#2c2e3a] bg-[#14151a] overflow-hidden`}
    >
      {/* Overall progress */}
      <div className="h-0.5 bg-[#20222c]">
        <div
          className="h-full bg-gradient-to-r from-[#cc785c] to-[#e58c65] transition-all duration-500 ease-out"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      <div className="px-4 py-3 flex items-center gap-3">
        {/* Status glyph */}
        <span className="shrink-0 flex items-center justify-center w-6 h-6">
          {isActive ? (
            <Loader2 className="w-5 h-5 text-[#cc785c] animate-spin" />
          ) : isDone ? (
            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/40">
              <Check className="w-3.5 h-3.5 stroke-[3]" />
            </span>
          ) : (
            <span className="w-6 h-6 rounded-full border border-[#383a48]" />
          )}
        </span>

        {/* Title + type */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={`text-sm ${
                isDone ? 'text-[#6b6e79] line-through' : isActive ? 'text-[#f3f3ee]' : 'text-[#9da0a8]'
              }`}
            >
              {displayed.title}
            </span>
            {displayed.taskType && (
              <span className="text-[10px] text-[#cc785c] font-mono bg-[#cc785c]/10 px-1.5 py-0.5 rounded border border-[#cc785c]/20">
                {displayed.taskType}
              </span>
            )}
          </div>
          <div className="text-[11px] text-[#6b6e79] mt-0.5">
            {isActive ? '● جارٍ التنفيذ الآن...' : isDone ? '✓ تم التنفيذ' : displayed.agentRole || ''}
          </div>
        </div>

        {/* Counter */}
        {totalCount > 0 && (
          <span className="shrink-0 text-[10px] font-mono text-[#6b6e79]">
            {dispIndex + 1}/{totalCount}
          </span>
        )}
      </div>
    </div>
  )
}
