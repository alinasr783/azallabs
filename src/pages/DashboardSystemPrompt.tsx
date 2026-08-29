import React, { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { useAgentConfig } from '../context/AgentConfigContext'
import { streamGroqCompletion } from '../lib/groq'

export const DashboardSystemPrompt: React.FC = () => {
  const {
    systemPrompt,
    setSystemPrompt,
    saveConfig,
    isSaving,
    lastSavedAt,
    resetToDefault,
  } = useAgentConfig()

  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [testInput, setTestInput] = useState('')
  const [testOutput, setTestOutput] = useState<string | null>(null)
  const [testLoading, setTestLoading] = useState(false)

  const handleSave = async () => {
    setMessage(null)
    const res = await saveConfig()
    setMessage({
      type: res.success ? 'success' : 'error',
      text: res.message,
    })
    setTimeout(() => setMessage(null), 3000)
  }

  const handleTest = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!testInput.trim() || testLoading) return

    setTestLoading(true)
    setTestOutput('')

    let accumulated = ''
    await streamGroqCompletion({
      messages: [{ role: 'user', content: testInput }],
      systemPrompt: systemPrompt,
      onDelta: (chunk) => {
        accumulated += chunk
        setTestOutput(accumulated)
      },
      onDone: () => {
        setTestLoading(false)
      },
      onError: (err) => {
        setTestLoading(false)
        setTestOutput(`خطأ: ${err.message}`)
      },
    })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-normal text-[#202124] dark:text-[#e8eaed]">
            الـ System Prompt
          </h1>
          <p className="text-xs sm:text-sm text-[#5f6368] dark:text-[#9aa0a6] mt-1">
            تحكم في التوجيه الأساسي للردود وأسلوب التعامل في المشروع.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={resetToDefault}
            className="px-4 py-2 rounded-full border border-[#dadce0] dark:border-[#3c4043] text-xs font-medium text-[#5f6368] dark:text-[#9aa0a6] hover:bg-[#f1f3f4] dark:hover:bg-[#303134] transition-colors"
          >
            استعادة الافتراضي
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="px-5 py-2 rounded-full bg-[#1a73e8] hover:bg-[#1557b0] dark:bg-[#8ab4f8] dark:hover:bg-[#aecbfa] text-white dark:text-[#041e49] text-xs sm:text-sm font-medium transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
          >
            {isSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            <span>حفظ التعديلات في Supabase</span>
          </button>
        </div>
      </div>

      {/* Save Alert */}
      {message && (
        <div
          className={`p-3 rounded-xl text-xs flex items-center justify-between ${
            message.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
              : 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800'
          }`}
        >
          <span>{message.text}</span>
          {lastSavedAt && <span className="font-mono text-[11px]">{lastSavedAt}</span>}
        </div>
      )}

      {/* Editor Box */}
      <div className="bg-white dark:bg-[#28292a] border border-[#dadce0] dark:border-[#3c4043] rounded-2xl p-4 sm:p-6 space-y-3">
        <label className="block text-xs font-medium text-[#5f6368] dark:text-[#9aa0a6]">
          نص الـ System Prompt
        </label>
        <textarea
          value={systemPrompt}
          onChange={(e) => setSystemPrompt(e.target.value)}
          rows={10}
          className="w-full p-3 rounded-xl border border-[#dadce0] dark:border-[#3c4043] bg-transparent text-sm text-[#202124] dark:text-[#e8eaed] leading-relaxed focus:border-[#1a73e8] dark:focus:border-[#8ab4f8] focus:outline-none transition-colors"
          placeholder="اكتب التوجيه هنا..."
        />
        <div className="flex items-center justify-between text-xs text-[#5f6368] dark:text-[#9aa0a6]">
          <span>{systemPrompt.length} حرف</span>
          <span>يتم تطبيق هذا التوجيه على كافة المحادثات</span>
        </div>
      </div>

      {/* Simple Test Box */}
      <div className="bg-white dark:bg-[#28292a] border border-[#dadce0] dark:border-[#3c4043] rounded-2xl p-4 sm:p-6 space-y-3">
        <h2 className="text-sm font-medium text-[#202124] dark:text-[#e8eaed]">
          تجربة سريعة
        </h2>
        <form onSubmit={handleTest} className="flex gap-2">
          <input
            type="text"
            value={testInput}
            onChange={(e) => setTestInput(e.target.value)}
            placeholder="اكتب رسالة لتجربة التوجيه الحالي..."
            className="flex-1 px-3.5 py-2 rounded-xl border border-[#dadce0] dark:border-[#3c4043] bg-transparent text-sm focus:border-[#1a73e8] dark:focus:border-[#8ab4f8] focus:outline-none transition-colors"
          />
          <button
            type="submit"
            disabled={!testInput.trim() || testLoading}
            className="px-4 py-2 rounded-xl border border-[#dadce0] dark:border-[#3c4043] text-xs font-medium hover:bg-[#f1f3f4] dark:hover:bg-[#303134] transition-colors disabled:opacity-40"
          >
            {testLoading ? 'جاري التجربة...' : 'تجربة'}
          </button>
        </form>

        {testOutput && (
          <div className="p-3 rounded-xl bg-[#f8fafd] dark:bg-[#202124] border border-[#dadce0] dark:border-[#3c4043] text-xs text-[#202124] dark:text-[#e8eaed] whitespace-pre-wrap">
            {testOutput}
          </div>
        )}
      </div>
    </div>
  )
}
