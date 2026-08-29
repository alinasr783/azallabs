import React, { useState } from 'react'
import { Check, Loader2, ChevronDown, ChevronUp } from 'lucide-react'
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
    <div className="my-3 rounded-2xl border border-[#262833] bg-[#14151a] overflow-hidden text-right shadow-sm font-serif">
      {/* Progress Top Bar */}
      <div className="w-full bg-[#20222a] h-1">
        <div
          className="bg-gradient-to-r from-[#cc785c] to-[#e58c65] h-1 transition-all duration-500 ease-out"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Header */}
      <div className="px-4 py-2.5 flex items-center justify-between border-b border-[#262833] text-xs">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#cc785c]" />
          <span className="font-semibold text-[#f3f3ee]">
            خطوات التنفيذ المنظمة للمهمة
          </span>
        </div>
        <span className="text-[#cc785c] font-mono text-xs">
          {completedCount} / {totalCount} ({progressPercent}%)
        </span>
      </div>

      {/* Steps List */}
      <div className="divide-y divide-[#20222c]">
        {plan.steps.map((step) => {
          const isExpanded = expandedStepId === step.id
          const isPending = step.status === 'pending'
          const isRunning = step.status === 'running'
          const isCompleted = step.status === 'completed'

          return (
            <div key={step.id} className="transition-colors">
              <div
                onClick={() => isCompleted && step.output && toggleExpand(step.id)}
                className={`px-4 py-2.5 flex items-center justify-between gap-3 ${
                  isCompleted && step.output ? 'cursor-pointer hover:bg-[#181920]' : ''
                }`}
              >
                {/* Step Item Content */}
                <div className="flex items-center gap-3 min-w-0">
                  {/* Minimal Checkbox Circle */}
                  <div className="shrink-0 flex items-center justify-center">
                    {isCompleted && (
                      <div className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center">
                        <Check className="w-2.5 h-2.5 stroke-[3]" />
                      </div>
                    )}
                    {isRunning && (
                      <Loader2 className="w-3.5 h-3.5 text-[#cc785c] animate-spin" />
                    )}
                    {isPending && (
                      <div className="w-3.5 h-3.5 rounded-full border border-[#383a48]" />
                    )}
                  </div>

                   {/* Title & Role */}
                   <div className="flex items-baseline gap-2 min-w-0 flex-wrap">
                     <span
                       className={`text-xs ${
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
                       <span className="text-[10px] text-[#cc785c] font-mono bg-[#cc785c]/10 px-1.5 py-0.2 rounded border border-[#cc785c]/20">
                         {step.taskType}
                       </span>
                     )}
                     {step.agentRole && (
                       <span className="text-[10px] text-[#9da0a8] font-mono bg-[#262833] px-1.5 py-0.2 rounded border border-[#2c2e3a]">
                         {step.agentRole}
                       </span>
                     )}
                   </div>
                </div>

                {/* Details Button if completed */}
                {isCompleted && step.output && (
                  <button
                    type="button"
                    className="shrink-0 text-[11px] text-[#9da0a8] hover:text-[#f3f3ee] flex items-center gap-0.5"
                  >
                    <span>{isExpanded ? 'إخفاء' : 'تفاصيل'}</span>
                    {isExpanded ? (
                      <ChevronUp className="w-3 h-3" />
                    ) : (
                      <ChevronDown className="w-3 h-3" />
                    )}
                  </button>
                )}
              </div>

              {/* Collapsible Details */}
              {isExpanded && step.output && (
                <div className="px-9 pb-3 pt-1 text-xs text-[#9da0a8] bg-[#0d0e11] border-t border-[#20222c] leading-relaxed whitespace-pre-wrap font-mono">
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
