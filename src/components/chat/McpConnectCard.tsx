import React, { useState } from 'react'
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
      setTaskCreatedMsg(`تم إنشاء المهمة بنجاح: "${res.title}"`)
      setTimeout(() => setTaskCreatedMsg(null), 5000)
    } catch (err: any) {
      setTaskCreatedMsg(`خطأ: ${err.message}`)
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
      <div className="my-2.5 p-3.5 rounded-lg border border-[#2c2e3a] bg-[#14151a] text-right max-w-xl">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[#cc785c] text-xs">●</span>
              <h3 className="text-xs font-semibold text-[#f3f3ee]">
                {displayName}
              </h3>
            </div>
            <span className="text-[11px] text-[#6b6e79] mt-0.5 block font-mono">
              {url}
            </span>
          </div>

          <span
            className={`px-2 py-0.5 rounded text-[11px] font-medium ${
              isConnected
                ? 'bg-emerald-950/40 text-emerald-300 border border-emerald-800/60'
                : 'bg-[#0d0e11] text-[#6b6e79] border border-[#2c2e3a]'
            }`}
          >
            {isConnected ? '✔ متصل' : '○ جاهز للربط'}
          </span>
        </div>

        {/* Description */}
        <p className="text-xs text-[#9da0a8] mb-2.5 leading-relaxed">
          {isConnected
            ? `تم ربط حسابك بنجاح عبر بروتوكول الربط (MCP). يستطيع الوكيل الآن إدارة ومزامنة مهامك الفعلية.`
            : `يتيح خادم الربط (MCP) للمساعد الاتصال بحسابك لإدارة وتنظيم المهام مباشرة.`}
        </p>

        {/* Live Test Task Box if connected */}
        {isConnected && isTickTick && (
          <div className="mb-2.5 p-2.5 rounded bg-[#0d0e11] border border-[#2c2e3a] space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-[#9da0a8]">
                اختبار الاتصال:
              </span>
              <button
                type="button"
                onClick={handleCreateTestTask}
                disabled={isCreatingTask}
                className="px-2.5 py-1 rounded bg-[#cc785c] hover:bg-[#be684e] text-white text-[11px] font-medium transition-colors disabled:opacity-50 cursor-pointer"
              >
                {isCreatingTask ? 'جاري الإنشاء...' : '+ مهمة اختبارية'}
              </button>
            </div>

            {taskCreatedMsg && (
              <div className="text-[11px] p-1.5 rounded bg-emerald-950/40 text-emerald-300 border border-emerald-800/50">
                ✔ {taskCreatedMsg}
              </div>
            )}
          </div>
        )}

        {/* Action Button */}
        <div className="pt-2 border-t border-[#2c2e3a] flex items-center justify-between">
          {isConnected ? (
            <>
              <button
                type="button"
                onClick={handleDisconnect}
                className="text-[11px] text-red-400 hover:text-red-300 transition-colors cursor-pointer"
              >
                قطع الاتصال
              </button>
              <span className="text-[10px] text-[#6b6e79]">
                متزامن
              </span>
            </>
          ) : (
            <div className="w-full space-y-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleStartOAuth}
                  className="px-3 py-1.5 rounded bg-[#cc785c] hover:bg-[#be684e] text-white text-xs font-semibold transition-colors cursor-pointer"
                >
                  الاتصال عبر التوثيق السريع (OAuth)
                </button>

                {isTickTick && (
                  <button
                    type="button"
                    onClick={() => setShowManualInput(!showManualInput)}
                    className="px-2.5 py-1.5 rounded border border-[#2c2e3a] text-[11px] text-[#6b6e79] hover:text-[#f3f3ee] transition-colors cursor-pointer"
                  >
                    {showManualInput ? 'إخفاء' : 'إدخال (Token) يدوياً'}
                  </button>
                )}
              </div>

              {showManualInput && isTickTick && (
                <div className="p-2 rounded bg-[#0d0e11] border border-[#2c2e3a] space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <input
                      type="password"
                      value={manualToken}
                      onChange={(e) => setManualToken(e.target.value)}
                      placeholder="الصق المفتاح (Token) هنا..."
                      className="flex-1 px-2.5 py-1 rounded border border-[#2c2e3a] bg-[#14151a] text-xs text-[#f3f3ee] focus:border-[#cc785c] focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleSaveManualToken}
                      disabled={!manualToken.trim()}
                      className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-xs transition-colors disabled:opacity-50 cursor-pointer"
                    >
                      {tokenSaved ? 'تم الحفظ!' : 'حفظ'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Generic Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-[#14151a] border border-[#2c2e3a] rounded-lg p-4 text-right">
            <h3 className="text-sm font-semibold text-[#f3f3ee] mb-1">
              ربط خادم (MCP)
            </h3>
            <p className="text-xs text-[#6b6e79] mb-3 font-mono">
              {url}
            </p>
            <div className="flex justify-end pt-2 border-t border-[#2c2e3a]">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-3 py-1 text-xs text-[#6b6e79] hover:text-[#f3f3ee] cursor-pointer"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
