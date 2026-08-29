import React, { useState } from 'react'
import { CheckCircle2, Link2, ExternalLink, Loader2, Unlink, ShieldCheck, Plus, Check } from 'lucide-react'
import { useMcp } from '../../context/McpContext'
import { getTickTickAuthUrl, createTickTickTask, clearTickTickToken, getTickTickToken, setTickTickToken } from '../../lib/ticktick'

interface McpConnectCardProps {
  name: string
  url: string
  service?: string
}

export const McpConnectCard: React.FC<McpConnectCardProps> = ({ name, url, service = 'custom' }) => {
  const { getServerByUrl, disconnectServer, connectServer } = useMcp()
  const existingServer = getServerByUrl(url)
  const isConnected = existingServer?.status === 'connected' || Boolean(getTickTickToken() && url.includes('ticktick'))

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isCreatingTask, setIsCreatingTask] = useState(false)
  const [taskCreatedMsg, setTaskCreatedMsg] = useState<string | null>(null)
  const [manualToken, setManualToken] = useState('')
  const [showManualInput, setShowManualInput] = useState(false)
  const [tokenSaved, setTokenSaved] = useState(false)

  const isTickTick = url.includes('ticktick') || service === 'ticktick'

  const handleSaveManualToken = async () => {
    if (!manualToken.trim()) return
    setTickTickToken(manualToken.trim())
    await connectServer({
      name: 'TickTick MCP',
      url: 'https://mcp.ticktick.com',
      service: 'ticktick',
      authToken: manualToken.trim(),
    })
    setTokenSaved(true)
    setTimeout(() => {
      window.location.reload()
    }, 600)
  }

  const handleStartOAuth = () => {
    if (isTickTick) {
      window.location.href = getTickTickAuthUrl()
    } else {
      setIsModalOpen(true)
    }
  }

  const handleCreateTestTask = async () => {
    setIsCreatingTask(true)
    setTaskCreatedMsg(null)
    try {
      const now = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
      const res = await createTickTickTask({
        title: `Azal Labs Test Task (${now})`,
        content: 'This task was created automatically via Azal Labs integration with your TickTick account.',
      })
      setTaskCreatedMsg(`Task created successfully in your TickTick app! (Title: ${res.title})`)
      setTimeout(() => setTaskCreatedMsg(null), 5000)
    } catch (err: any) {
      setTaskCreatedMsg(`Error: ${err.message}`)
    } finally {
      setIsCreatingTask(false)
    }
  }

  const handleDisconnect = async () => {
    if (isTickTick) {
      clearTickTickToken()
    }
    if (existingServer) {
      await disconnectServer(existingServer.id)
    }
  }

  const displayName = name || (isTickTick ? 'TickTick MCP' : 'MCP Server')

  return (
    <>
      <div className="my-3 p-4 rounded-2xl border border-[#262833] bg-[#14151a] shadow-xs text-right max-w-xl" dir="rtl">
        <div className="flex items-start justify-between gap-3 mb-2">
          <div>
            <div className="flex items-center gap-2">
              <Link2 className="w-4 h-4 text-[#cc785c]" />
              <h3 className="text-sm font-semibold text-[#f3f3ee]">
                {displayName}
              </h3>
            </div>
            <span className="text-xs text-[#9da0a8] mt-0.5 block">
              {url}
            </span>
          </div>

          <span
            className={`px-2.5 py-0.5 rounded-full text-[11px] font-medium flex items-center gap-1 ${
              isConnected
                ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-800/60'
                : 'bg-[#1e1f28] text-[#9da0a8] border border-[#2c2e3a]'
            }`}
          >
            {isConnected ? (
              <>
                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                متصل بنجاح
              </>
            ) : (
              'جاهز للربط'
            )}
          </span>
        </div>

        {/* Description */}
        <p className="text-xs text-[#9da0a8] mb-3 leading-relaxed">
          {isConnected
            ? `تم ربط حسابك بنجاح عبر بروتوكول الربط (MCP). يستطيع الوكيل الآن تصفح وإنشاء وإدارة مهامك الفعلية.`
            : `يتيح خادم الربط (MCP) للمساعد الاتصال بحسابك في (TickTick) لإدارة وتنظيم المهام ومزامنتها مباشرة مع تطبيقك.`}
        </p>

        {/* Live Test Task Box if connected */}
        {isConnected && isTickTick && (
          <div className="mb-3 p-3 rounded-xl bg-[#0f1014] border border-[#262833] space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-[#f3f3ee]">
                اختبار الاتصال المباشر:
              </span>
              <button
                type="button"
                onClick={handleCreateTestTask}
                disabled={isCreatingTask}
                className="px-3 py-1 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-medium flex items-center gap-1 transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
              >
                {isCreatingTask ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Plus className="w-3 h-3" />
                )}
                <span>إنشاء مهمة اختبارية في (TickTick)</span>
              </button>
            </div>

            {taskCreatedMsg && (
              <div className="text-[11px] p-2 rounded-lg bg-emerald-950/50 text-emerald-300 border border-emerald-800/60 flex items-center gap-1.5 font-mono">
                <Check className="w-3.5 h-3.5 flex-shrink-0 text-emerald-400" />
                <span>{taskCreatedMsg}</span>
              </div>
            )}
          </div>
        )}

        {/* Action Button */}
        <div className="pt-2 border-t border-[#22242c] flex flex-col items-stretch gap-2">
          {isConnected ? (
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={handleDisconnect}
                className="text-xs text-red-400 hover:bg-red-950/30 px-3 py-1.5 rounded-xl border border-red-900/40 transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Unlink className="w-3.5 h-3.5" />
                <span>قطع الاتصال</span>
              </button>
              <span className="text-[10px] text-emerald-400 font-medium">
                نشط ومتزامن مع (TickTick)
              </span>
            </div>
          ) : (
            <div className="w-full space-y-2.5">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <button
                  type="button"
                  onClick={handleStartOAuth}
                  className="px-4 py-2 rounded-xl bg-[#cc785c] hover:bg-[#be684e] text-white text-xs font-semibold transition-all flex items-center justify-center gap-2 shadow-xs cursor-pointer"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>الاتصال عبر التوثيق السريع (OAuth)</span>
                </button>

                {isTickTick && (
                  <button
                    type="button"
                    onClick={() => setShowManualInput(!showManualInput)}
                    className="px-3 py-2 rounded-xl border border-[#2c2e3a] text-xs text-[#9da0a8] hover:text-[#f3f3ee] hover:bg-[#1a1b22] transition-colors cursor-pointer"
                  >
                    {showManualInput ? 'إخفاء حقل المفتاح' : 'أو إدخال المفتاح (Token) يدوياً'}
                  </button>
                )}
              </div>

              {showManualInput && isTickTick && (
                <div className="p-3 rounded-xl bg-[#0f1014] border border-[#262833] space-y-2">
                  <div className="text-[11px] text-[#9da0a8]">
                    يمكنك نسخ مفتاح (API Token) الخاص بك من إعدادات الويب في (TickTick):
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="password"
                      value={manualToken}
                      onChange={(e) => setManualToken(e.target.value)}
                      placeholder="الصق المفتاح (Token) هنا..."
                      className="flex-1 px-3 py-1.5 rounded-xl border border-[#2c2e3a] bg-[#14151a] text-xs text-[#f3f3ee] outline-hidden focus:border-[#cc785c]"
                    />
                    <button
                      type="button"
                      onClick={handleSaveManualToken}
                      disabled={!manualToken.trim()}
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium transition-colors disabled:opacity-50 flex items-center gap-1 cursor-pointer"
                    >
                      {tokenSaved ? <Check className="w-3.5 h-3.5" /> : null}
                      <span>{tokenSaved ? 'تم الحفظ!' : 'حفظ والاتصال'}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Generic Modal for other non-TickTick servers */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4" dir="rtl">
          <div className="w-full max-w-md bg-[#16171d] border border-[#262833] rounded-3xl p-6 shadow-xl text-right">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-9 h-9 rounded-full bg-[#cc785c]/10 flex items-center justify-center text-[#cc785c]">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-medium text-[#f3f3ee]">
                  ربط خادم (MCP)
                </h3>
                <p className="text-xs text-[#9da0a8]">
                  {url}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#262833]">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-[#2c2e3a] text-xs font-medium text-[#9da0a8] hover:bg-[#1a1b22] hover:text-[#f3f3ee] transition-colors cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
