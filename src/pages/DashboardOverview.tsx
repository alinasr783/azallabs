import React from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { useAgentConfig } from '../context/AgentConfigContext'
import { useMcp } from '../context/McpContext'

export const DashboardOverview: React.FC = () => {
  const { systemPrompt, lastSavedAt } = useAgentConfig()
  const { servers } = useMcp()

  return (
    <div className="space-y-6">
      {/* Title */}
      <div>
        <h1 className="text-2xl font-normal text-[#202124] dark:text-[#e8eaed]">
          نظرة عامة
        </h1>
        <p className="text-xs sm:text-sm text-[#5f6368] dark:text-[#9aa0a6] mt-1">
          لوحة تحكم وتوجيه إعدادات النظام في Azal Labs.
        </p>
      </div>

      {/* Simple Google-style cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="p-6 bg-white dark:bg-[#28292a] border border-[#dadce0] dark:border-[#3c4043] rounded-2xl">
          <div className="text-xs text-[#5f6368] dark:text-[#9aa0a6] mb-1">
            حالة الـ System Prompt
          </div>
          <div className="text-lg font-medium text-[#202124] dark:text-[#e8eaed]">
            نشط ومضبوط
          </div>
          <div className="text-xs text-[#5f6368] dark:text-[#9aa0a6] mt-2 line-clamp-2">
            {systemPrompt}
          </div>
        </div>

        <div className="p-6 bg-white dark:bg-[#28292a] border border-[#dadce0] dark:border-[#3c4043] rounded-2xl">
          <div className="text-xs text-[#5f6368] dark:text-[#9aa0a6] mb-1">
            قاعدة البيانات
          </div>
          <div className="text-lg font-medium text-[#202124] dark:text-[#e8eaed]">
            متصل بـ Supabase
          </div>
          <div className="text-xs text-[#5f6368] dark:text-[#9aa0a6] mt-2">
            {lastSavedAt ? `آخر مزامنة: ${lastSavedAt}` : 'جاهز للمزامنة والحفظ'}
          </div>
        </div>

        <div className="p-6 bg-white dark:bg-[#28292a] border border-[#dadce0] dark:border-[#3c4043] rounded-2xl sm:col-span-2">
          <div className="text-xs text-[#5f6368] dark:text-[#9aa0a6] mb-1">
            محرك الذكاء والنموذج الفعّال
          </div>
          <div className="text-base font-medium text-[#1a73e8] dark:text-[#8ab4f8]">
            qwen/qwen3.8-27b (Groq API)
          </div>
          <div className="text-xs text-[#5f6368] dark:text-[#9aa0a6] mt-1">
            يعمل بالبث المباشر (Streaming) لمعالجة وتنفيذ المهام بأعلى سرعة واستجابة.
          </div>
        </div>

        {/* Connected MCP Servers Section */}
        <div className="p-6 bg-white dark:bg-[#28292a] border border-[#dadce0] dark:border-[#3c4043] rounded-2xl sm:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-medium text-[#202124] dark:text-[#e8eaed]">
              خوادم MCP المتصلة (Model Context Protocol)
            </div>
            <span className="text-xs text-[#1a73e8] dark:text-[#8ab4f8]">
              {servers.length} خوادم متصلة
            </span>
          </div>

          {servers.length === 0 ? (
            <div className="text-xs text-[#5f6368] dark:text-[#9aa0a6] py-2">
              لم يتم ربط أي خادم MCP حتى الآن. يمكنك طلب الربط مباشرة في المحادثة (مثال: "اربطني بـ https://mcp.ticktick.com").
            </div>
          ) : (
            <div className="space-y-2">
              {servers.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between p-3 rounded-xl bg-[#f8fafd] dark:bg-[#202124] border border-[#dadce0] dark:border-[#3c4043]"
                >
                  <div>
                    <div className="text-xs font-medium text-[#202124] dark:text-[#e8eaed]">
                      {s.name}
                    </div>
                    <div className="text-[11px] text-[#5f6368] dark:text-[#9aa0a6]">
                      {s.url}
                    </div>
                  </div>
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-300 font-medium">
                    متصل ({s.tools.length} أدوات)
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Action Card */}
      <div className="p-6 bg-white dark:bg-[#28292a] border border-[#dadce0] dark:border-[#3c4043] rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-medium text-[#202124] dark:text-[#e8eaed]">
            تخصيص الـ System Prompt
          </h2>
          <p className="text-xs text-[#5f6368] dark:text-[#9aa0a6] mt-0.5">
            يمكنك كتابة وتعديل التوجيه العام وحفظه مباشرة في Supabase.
          </p>
        </div>

        <Link
          to="/dashboard/system-prompt"
          className="px-5 py-2.5 rounded-full bg-[#1a73e8] hover:bg-[#1557b0] dark:bg-[#8ab4f8] dark:hover:bg-[#aecbfa] text-white dark:text-[#041e49] text-xs sm:text-sm font-medium flex items-center justify-center gap-1.5 transition-colors"
        >
          <span>فتح صفحة System Prompt</span>
          <ArrowRight className="w-4 h-4 rotate-180" />
        </Link>
      </div>
    </div>
  )
}
