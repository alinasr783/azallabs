import React from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { useAgentConfig } from '../context/AgentConfigContext'
import { useMcp } from '../context/McpContext'

export const DashboardOverview: React.FC = () => {
  const { systemPrompt, lastSavedAt, llmConfig } = useAgentConfig()
  const { servers } = useMcp()

  return (
    <div className="space-y-4">
      {/* Title */}
      <div>
        <h1 className="text-lg font-bold text-[#f3f3ee]">
          نظرة عامة
        </h1>
        <p className="text-xs text-[#6b6e79] mt-0.5">
          لوحة تحكم وتوجيه إعدادات النظام في Azal Labs.
        </p>
      </div>

      {/* Terminal Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="p-4 bg-[#14151a] border border-[#2c2e3a] rounded-lg">
          <div className="text-[11px] text-[#6b6e79] mb-1">
            حالة الـ System Prompt
          </div>
          <div className="text-sm font-semibold text-[#f3f3ee]">
            نشط ومضبوط
          </div>
          <div className="text-xs text-[#9da0a8] mt-1.5 line-clamp-2 leading-relaxed">
            {systemPrompt}
          </div>
        </div>

        <div className="p-4 bg-[#14151a] border border-[#2c2e3a] rounded-lg">
          <div className="text-[11px] text-[#6b6e79] mb-1">
            قاعدة البيانات
          </div>
          <div className="text-sm font-semibold text-[#f3f3ee]">
            متصل بـ Supabase
          </div>
          <div className="text-xs text-[#9da0a8] mt-1.5">
            {lastSavedAt ? `آخر مزامنة: ${lastSavedAt}` : 'جاهز للمزامنة والحفظ'}
          </div>
        </div>

        <div className="p-4 bg-[#14151a] border border-[#2c2e3a] rounded-lg sm:col-span-2">
          <div className="text-[11px] text-[#6b6e79] mb-1">
            محرك الذكاء والنموذج الفعّال
          </div>
          <div className="text-sm font-semibold text-[#cc785c] font-mono">
            {llmConfig[llmConfig.activeProvider]?.model || llmConfig.activeProvider} ({llmConfig.activeProvider})
          </div>
          <div className="text-xs text-[#9da0a8] mt-1 leading-relaxed">
            يعمل بالبث المباشر (Streaming) لمعالجة وتنفيذ المهام بأعلى سرعة واستجابة.
          </div>
        </div>

        {/* Connected MCP Servers Section */}
        <div className="p-4 bg-[#14151a] border border-[#2c2e3a] rounded-lg sm:col-span-2">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs font-semibold text-[#f3f3ee]">
              خوادم (MCP) المتصلة
            </div>
            <span className="text-[11px] text-[#6b6e79]">
              {servers.length} خوادم
            </span>
          </div>

          {servers.length === 0 ? (
            <div className="text-xs text-[#6b6e79] py-2">
              لم يتم ربط أي خادم (MCP) حتى الآن. يمكنك طلب الربط مباشرة في المحادثة أو عبر صفحة الإعدادات.
            </div>
          ) : (
            <div className="space-y-1.5">
              {servers.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between p-2.5 rounded bg-[#0d0e11] border border-[#2c2e3a]"
                >
                  <div>
                    <div className="text-xs font-medium text-[#f3f3ee]">
                      {s.name}
                    </div>
                    <div className="text-[11px] text-[#6b6e79] font-mono">
                      {s.url}
                    </div>
                  </div>
                  <span className="text-[11px] px-2 py-0.5 rounded bg-emerald-950/40 text-emerald-400 font-medium">
                    ✔ {s.tools.length} أدوات
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Action Card */}
      <div className="p-4 bg-[#14151a] border border-[#2c2e3a] rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-[#f3f3ee]">
            تخصيص الـ System Prompt
          </h2>
          <p className="text-xs text-[#6b6e79] mt-0.5">
            يمكنك تعديل التوجيه الأساسي وإدارة الذاكرة الدائمة في صفحة الإعدادات.
          </p>
        </div>

        <Link
          to="/settings?tab=system-prompt"
          className="px-3.5 py-1.5 rounded bg-[#cc785c] hover:bg-[#be684e] text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shrink-0"
        >
          <span>فتح الإعدادات</span>
          <ArrowRight className="w-3.5 h-3.5 rotate-180" />
        </Link>
      </div>
    </div>
  )
}
