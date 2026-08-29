import React, { useState } from 'react'
import { useMcp } from '../../context/McpContext'
import {
  getTickTickAuthUrl,
  createTickTickTask,
  clearTickTickToken,
  getTickTickToken,
  setTickTickToken,
  getRedirectUri,
} from '../../lib/ticktick'
import {
  getVercelToken,
  setVercelToken,
  clearVercelToken,
  testVercelConnection,
} from '../../lib/vercelConnector'
import {
  getGitHubToken,
  setGitHubToken,
  clearGitHubToken,
  testGitHubConnection,
} from '../../lib/githubConnector'

interface McpConnectCardProps {
  name: string
  url: string
  service?: string
}

export const McpConnectCard: React.FC<McpConnectCardProps> = ({ name, url, service = 'custom' }) => {
  const { getServerByUrl, disconnectServer, connectServer } = useMcp()
  const existingServer = getServerByUrl(url)

  const isTickTick = url.includes('ticktick') || service === 'ticktick'
  const isVercel = url.includes('vercel') || service === 'vercel'
  const isGitHub = url.includes('github') || service === 'github'

  const isConnected =
    existingServer?.status === 'connected' ||
    Boolean(isTickTick && getTickTickToken()) ||
    Boolean(isVercel && getVercelToken()) ||
    Boolean(isGitHub && getGitHubToken())

  const [manualToken, setManualToken] = useState('')
  const [showManualInput, setShowManualInput] = useState(!isConnected && (isVercel || isGitHub))
  const [tokenSaved, setTokenSaved] = useState(false)
  const [testResultMsg, setTestResultMsg] = useState<string | null>(null)
  const [isTesting, setIsTesting] = useState(false)

  const handleSaveToken = async () => {
    if (!manualToken.trim()) return

    if (isTickTick) {
      setTickTickToken(manualToken.trim())
      await connectServer({
        name: 'TickTick MCP',
        url: 'https://mcp.ticktick.com',
        service: 'ticktick',
        authToken: manualToken.trim(),
      })
    } else if (isVercel) {
      setVercelToken(manualToken.trim())
      await connectServer({
        name: 'Vercel MCP',
        url: 'https://mcp.vercel.com',
        service: 'vercel',
        authToken: manualToken.trim(),
      })
    } else if (isGitHub) {
      setGitHubToken(manualToken.trim())
      await connectServer({
        name: 'GitHub MCP',
        url: 'https://api.githubcopilot.com/mcp/',
        service: 'github',
        authToken: manualToken.trim(),
      })
    }

    setTokenSaved(true)
    setTimeout(() => {
      window.location.reload()
    }, 600)
  }

  const handleStartOAuth = () => {
    if (isTickTick) {
      window.location.href = getTickTickAuthUrl()
    } else {
      setShowManualInput(true)
    }
  }

  const handleTestConnection = async () => {
    setIsTesting(true)
    setTestResultMsg(null)
    try {
      if (isTickTick) {
        const now = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
        const res = await createTickTickTask({
          title: `Azal Labs Test Task (${now})`,
          content: 'This task was created automatically via Azal Labs integration with your TickTick account.',
        })
        setTestResultMsg(`تم إنشاء المهمة بنجاح: "${res.title}"`)
      } else if (isVercel) {
        const res = await testVercelConnection()
        if (res.success && res.user) {
          setTestResultMsg(`متصل كـ: ${res.user.username} (${res.user.email})`)
        } else {
          setTestResultMsg(res.error || 'فشل الاختبار')
        }
      } else if (isGitHub) {
        const res = await testGitHubConnection()
        if (res.success && res.user) {
          setTestResultMsg(`متصل كـ: @${res.user.login} (${res.user.public_repos ?? 0} مستودع عام)`)
        } else {
          setTestResultMsg(res.error || 'فشل الاختبار')
        }
      }
      setTimeout(() => setTestResultMsg(null), 6000)
    } catch (err: any) {
      setTestResultMsg(`خطأ: ${err.message}`)
    } finally {
      setIsTesting(false)
    }
  }

  const handleDisconnect = async () => {
    if (isTickTick) clearTickTickToken()
    if (isVercel) clearVercelToken()
    if (isGitHub) clearGitHubToken()
    if (existingServer) {
      await disconnectServer(existingServer.id)
    }
  }

  const displayName =
    name ||
    (isTickTick
      ? 'TickTick MCP'
      : isVercel
      ? 'Vercel MCP'
      : isGitHub
      ? 'GitHub MCP'
      : 'MCP Server')

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
            ? `تم ربط حسابك بنجاح عبر بروتوكول الربط (MCP). يستطيع الوكيل الآن استدعاء الأدوات المعتمدة وتنفيذ أوامرك فورياً.`
            : isGitHub
            ? `يتيح خادم GitHub MCP للمساعد استعراض المستودعات، إدارة الـ Issues و PRs، وفحص الأكواد والملفات مباشرة.`
            : isVercel
            ? `يتيح خادم Vercel MCP للمساعد استعراض المشاريع، متابعة عمليات النشر، وفحص سجلات التشغيل وأخطاء بيئة الإنتاج.`
            : `يتيح خادم الربط (MCP) للمساعد الاتصال بحسابك لإدارة وتنظيم المهام مباشرة.`}
        </p>

        {/* Live Test Box if connected */}
        {isConnected && (isTickTick || isVercel || isGitHub) && (
          <div className="mb-2.5 p-2.5 rounded bg-[#0d0e11] border border-[#2c2e3a] space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-[#9da0a8]">
                اختبار الاتصال:
              </span>
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={isTesting}
                className="px-2.5 py-1 rounded bg-[#cc785c] hover:bg-[#be684e] text-white text-[11px] font-medium transition-colors disabled:opacity-50 cursor-pointer"
              >
                {isTesting ? 'جاري الفحص...' : isTickTick ? '+ مهمة اختبارية' : '⚡ فحص الحساب الآن'}
              </button>
            </div>

            {testResultMsg && (
              <div className="text-[11px] p-1.5 rounded bg-emerald-950/40 text-emerald-300 border border-emerald-800/50">
                ✔ {testResultMsg}
              </div>
            )}
          </div>
        )}

        {/* Action Button & Input */}
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
                {isTickTick && (
                  <button
                    type="button"
                    onClick={handleStartOAuth}
                    className="px-3 py-1.5 rounded bg-[#cc785c] hover:bg-[#be684e] text-white text-xs font-semibold transition-colors cursor-pointer"
                  >
                    الاتصال عبر التوثيق السريع (OAuth)
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setShowManualInput(!showManualInput)}
                  className="px-2.5 py-1.5 rounded border border-[#2c2e3a] text-[11px] text-[#6b6e79] hover:text-[#f3f3ee] transition-colors cursor-pointer"
                >
                  {showManualInput ? 'إخفاء' : 'إدخال رمز الوصول (Token)'}
                </button>
              </div>

              {showManualInput && (
                <div className="p-2 rounded bg-[#0d0e11] border border-[#2c2e3a] space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <input
                      type="password"
                      value={manualToken}
                      onChange={(e) => setManualToken(e.target.value)}
                      placeholder={
                        isGitHub
                          ? 'الصق رمز الوصول (ghp_...)'
                          : isVercel
                          ? 'الصق رمز الوصول (Personal Access Token)...'
                          : 'الصق المفتاح (Token) هنا...'
                      }
                      className="flex-1 px-2.5 py-1 rounded border border-[#2c2e3a] bg-[#14151a] text-xs text-[#f3f3ee] focus:border-[#cc785c] focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleSaveToken}
                      disabled={!manualToken.trim()}
                      className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-xs transition-colors disabled:opacity-50 cursor-pointer"
                    >
                      {tokenSaved ? 'تم الحفظ!' : 'حفظ'}
                    </button>
                  </div>

                  {isGitHub && (
                    <div className="text-[10px] text-[#6b6e79] pt-1">
                      💡 يمكنك إنشاء رمز وصول بصلاحيات (repo, workflow, read:org) من{' '}
                      <a
                        href="https://github.com/settings/tokens/new?scopes=repo,read:org,read:user,workflow"
                        target="_blank"
                        rel="noreferrer"
                        className="text-[#cc785c] underline"
                      >
                        صفحة إعدادات GitHub Tokens
                      </a>
                    </div>
                  )}

                  {isVercel && (
                    <div className="text-[10px] text-[#6b6e79] pt-1">
                      💡 يمكنك إنشاء رمز وصول من{' '}
                      <a
                        href="https://vercel.com/account/tokens"
                        target="_blank"
                        rel="noreferrer"
                        className="text-[#cc785c] underline"
                      >
                        صفحة إعدادات Vercel Tokens
                      </a>
                    </div>
                  )}
                </div>
              )}

              {isTickTick && (
                <div className="pt-1 text-[10px] text-[#6b6e79] flex flex-wrap items-center gap-1">
                  <span>رابط إعادة التوجيه:</span>
                  <code className="px-1.5 py-0.2 rounded bg-[#0d0e11] text-[#cc785c] font-mono select-all text-[9px] border border-[#2c2e3a]">
                    {getRedirectUri()}
                  </code>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
