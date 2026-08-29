import React, { useEffect, useState } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { Check, Loader2, ArrowRight } from 'lucide-react'
import { exchangeTickTickCode, setTickTickToken, fetchTickTickProjects, getRedirectUri } from '../lib/ticktick'
import { useMcp } from '../context/McpContext'

export const TickTickCallbackPage: React.FC = () => {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { connectServer } = useMcp()

  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [projectCount, setProjectCount] = useState<number | null>(null)

  useEffect(() => {
    const code = searchParams.get('code')
    const errorParam = searchParams.get('error')

    if (errorParam) {
      setStatus('error')
      setErrorMessage(`رفض المصادقة من TickTick: ${errorParam}`)
      return
    }

    if (!code) {
      setStatus('error')
      setErrorMessage('لم يتم العثور على رمز التفويض (code) في الرابط.')
      return
    }

    const processAuth = async () => {
      try {
        // 1. Exchange code for real access token
        const tokenData = await exchangeTickTickCode(code)
        setTickTickToken(tokenData.access_token)

        // 2. Connect in MCP Context
        await connectServer({
          name: 'TickTick MCP',
          url: 'https://mcp.ticktick.com',
          service: 'ticktick',
        })

        // 3. Verify by fetching real user projects
        try {
          const projects = await fetchTickTickProjects(tokenData.access_token)
          if (Array.isArray(projects)) {
            setProjectCount(projects.length)
          }
        } catch (e) {
          console.warn('Projects verify check:', e)
        }

        setStatus('success')

        // Redirect back to chat/tasks after 1.5 seconds
        setTimeout(() => {
          navigate('/')
        }, 1500)
      } catch (err: any) {
        setStatus('error')
        setErrorMessage(err.message || 'فشل إتمام الربط مع TickTick.')
      }
    }

    processAuth()
  }, [searchParams, connectServer, navigate])

  return (
    <div className="min-h-screen w-full bg-[#0d0e11] flex flex-col justify-center items-center p-4 text-[#f3f3ee]" dir="rtl">
      <div className="w-full max-w-md bg-[#14151a] border border-[#2c2e3a] rounded-lg p-6 text-center">
        {/* Header */}
        <h1 className="text-lg font-bold text-[#f3f3ee] mb-4">
          Azal Labs
        </h1>

        {status === 'loading' && (
          <div className="py-6 space-y-3">
            <Loader2 className="w-6 h-6 animate-spin text-[#cc785c] mx-auto" />
            <h2 className="text-sm font-medium text-[#f3f3ee]">
              جاري ربط حسابك على (TickTick)...
            </h2>
            <p className="text-xs text-[#6b6e79]">
              يتم الآن تبادل رمز التفويض واستلام رمز الوصول (Access Token).
            </p>
          </div>
        )}

        {status === 'success' && (
          <div className="py-6 space-y-3">
            <div className="w-10 h-10 rounded-full bg-emerald-950/40 text-emerald-400 border border-emerald-800/60 flex items-center justify-center mx-auto text-sm font-bold">
              <Check className="w-5 h-5" />
            </div>
            <h2 className="text-sm font-semibold text-[#f3f3ee]">
              تم الربط بحسابك على (TickTick) بنجاح!
            </h2>
            <p className="text-xs text-[#9da0a8] leading-relaxed">
              تم الاتصال بخادم (MCP) الخاص بـ (TickTick).
              {projectCount !== null && ` (تم العثور على ${projectCount} قوائم/مشاريع في حسابك)`}
              <br />
              جاري توجيهك إلى واجهة المحادثة الرئيسية...
            </p>
          </div>
        )}

        {status === 'error' && (
          <div className="py-6 space-y-3">
            <div className="w-10 h-10 rounded-full bg-red-950/40 text-red-400 border border-red-800/60 flex items-center justify-center mx-auto text-sm font-bold">
              ✖
            </div>
            <h2 className="text-sm font-semibold text-red-400">
              تعذر إتمام عملية الربط
            </h2>
            <div className="text-xs text-[#9da0a8] leading-relaxed p-3 rounded bg-[#0d0e11] border border-[#2c2e3a] text-right space-y-1.5">
              <p className="text-red-300 font-medium">{errorMessage}</p>
              <div className="text-[11px] text-[#6b6e79] pt-1 border-t border-[#2c2e3a]">
                <span>رابط إعادة التوجيه المستخدم (Redirect URI):</span>
                <code className="block mt-0.5 p-1 rounded bg-[#14151a] text-[#cc785c] font-mono select-all text-[10px] break-all">
                  {getRedirectUri()}
                </code>
                <p className="mt-1">
                  تأكد من أن هذا الرابط مطابق تماماً لـ (Redirect URL) المسجل في إعدادات تطبيقك على منصة مطوري TickTick.
                </p>
              </div>
            </div>

            <div className="pt-2">
              <Link
                to="/settings?tab=mcp"
                className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded bg-[#cc785c] hover:bg-[#be684e] text-white text-xs font-semibold transition-colors"
              >
                <span>العودة لإعدادات (MCP)</span>
                <ArrowRight className="w-3 h-3 rotate-180" />
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
