import React from 'react'

interface EmptyStateProps {
  onSelectPrompt: (prompt: string) => void
}

export const EmptyState: React.FC<EmptyStateProps> = ({ onSelectPrompt }) => {
  const suggestions = [
    {
      cmd: '/خطة',
      label: 'تخطيط البنية البرمجية وإنشاء قائمة مهام تفاعلية',
    },
    {
      cmd: 'مهام (TickTick)',
      label: 'مزامنة وإدارة المهام المجدولة عبر خادم الربط (MCP)',
    },
    {
      cmd: 'فحص الشيفرة',
      label: 'مراجعة الأكواد البرمجية واكتشاف الأخطاء وإعادة الهيكلة',
    },
    {
      cmd: 'تحديث الذاكرة',
      label: 'تحديث التعليمات والتفضيلات في الذاكرة الدائمة',
    },
  ]

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 max-w-2xl mx-auto">
      {/* ╭─ Welcome Banner ──────────────────────────────────────────╮ */}
      <div className="w-full border border-[#2c2e3a] rounded-lg bg-[#14151a] mb-8">
        <div className="px-4 py-1.5 border-b border-[#2c2e3a]/60">
          <span className="text-[11px] text-[#6b6e79] select-none">مرحباً بك في Azal Labs</span>
        </div>
        <div className="px-5 py-5 space-y-2">
          <div className="text-lg font-bold text-[#f3f3ee]">
            Azal Labs
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-[#6b6e79]">
            <span>النسخة 2.1.0</span>
            <span>•</span>
            <span>بيئة متكاملة للتطوير وإدارة المهام</span>
          </div>
          <div className="pt-2 text-sm text-[#9da0a8] leading-relaxed">
            اكتب سؤالك أو اطلب مهمة للبدء. يمكنك استخدام الأوامر السريعة أدناه أو كتابة <span className="text-[#cc785c]">/</span> للاطلاع على القائمة الكاملة.
          </div>
        </div>
      </div>

      {/* Suggestion Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full">
        {suggestions.map((item, idx) => (
          <button
            key={idx}
            onClick={() => onSelectPrompt(item.label)}
            className="text-right p-3 border border-[#2c2e3a] rounded-lg bg-[#0d0e11] hover:bg-[#14151a] hover:border-[#cc785c]/40 transition-all cursor-pointer group"
          >
            <div className="text-xs font-bold text-[#cc785c] mb-1">
              {item.cmd}
            </div>
            <div className="text-[12px] text-[#6b6e79] group-hover:text-[#9da0a8] transition-colors leading-relaxed">
              {item.label}
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
