import React, { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import type { MaestroPlan } from '../../types/orchestrator'

interface MaestroTodoListCardProps {
  plan: MaestroPlan
}

export const MaestroTodoListCard: React.FC<MaestroTodoListCardProps> = ({ plan }) => {
  const [expandedStepId, setExpandedStepId] = useState<string | null>(null)

  const completedCount = plan.steps.filter((s) => s.status === 'completed').length
  const totalCount = plan.steps.length
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0

  const toggleExpand = (stepId: string) => {
    setExpandedStepId((prev) => (prev === stepId ? null : stepId))
  }

  return (
    <div className="my-2.5 rounded-lg border border-[#2c2e3a] bg-[#14151a] overflow-hidden text-right">
      {/* Progress Bar */}
      <div className="w-full bg-[#1a1b22] h-1">
        <div
          className="bg-[#cc785c] h-1 transition-all duration-300"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Header */}
      <div className="px-3 py-2 flex items-center justify-between border-b border-[#2c2e3a] text-xs">
        <span className="font-semibold text-[#f3f3ee]">
          خطوات التنفيذ
        </span>
        <span className="text-[#6b6e79] font-mono text-[11px]">
          {completedCount}/{totalCount} ({progressPercent}%)
        </span>
      </div>

      {/* Steps List */}
      <div className="divide-y divide-[#20222b]">
        {plan.steps.map((step) => {
          const isExpanded = expandedStepId === step.id
          const isPending = step.status === 'pending'
          const isRunning = step.status === 'running'
          const isCompleted = step.status === 'completed'

          return (
            <div key={step.id}>
              <div
                onClick={() => isCompleted && step.output && toggleExpand(step.id)}
                className={`px-3 py-2 flex items-center justify-between gap-2 text-xs ${
                  isCompleted && step.output ? 'cursor-pointer hover:bg-[#1a1b22]/50' : ''
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="shrink-0">
                    {isCompleted && <span className="text-emerald-400">✔</span>}
                    {isRunning && <span className="text-[#cc785c] animate-gentle-pulse">●</span>}
                    {isPending && <span className="text-[#4a4d58]">○</span>}
                  </span>

                  <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                    <span
                      className={`${
                        isCompleted
                          ? 'text-[#6b6e79] line-through'
                          : isRunning
                          ? 'font-medium text-[#f3f3ee]'
                          : 'text-[#9da0a8]'
                      }`}
                    >
                      {step.title}
                    </span>
                    {step.taskType && (
                      <span className="text-[10px] text-[#cc785c] font-mono bg-[#0d0e11] px-1 py-0.2 rounded border border-[#2c2e3a]">
                        {step.taskType}
                      </span>
                    )}
                    {step.agentRole && (
                      <span className="text-[10px] text-[#6b6e79] font-mono bg-[#0d0e11] px-1 py-0.2 rounded border border-[#2c2e3a]">
                        {step.agentRole}
                      </span>
                    )}
                  </div>
                </div>

                {isCompleted && step.output && (
                  <button className="text-[#6b6e79] hover:text-[#9da0a8] cursor-pointer">
                    {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </button>
                )}
              </div>

              {/* Expandable step output */}
              {isExpanded && step.output && (
                <div className="px-3 py-2 bg-[#0d0e11] border-t border-[#20222b] text-[11px] text-[#9da0a8] whitespace-pre-wrap leading-relaxed">
                  {step.output}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
