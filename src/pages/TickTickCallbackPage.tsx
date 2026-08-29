import React, { useEffect, useState } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { CheckCircle2, AlertCircle, Loader2, ArrowRight } from 'lucide-react'
import { exchangeTickTickCode, setTickTickToken, fetchTickTickProjects } from '../lib/ticktick'
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
      setErrorMessage(`رفض المصادقة: ${errorParam}`)
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
    <div className="min-h-screen w-full bg-[#0d0e11] flex flex-col justify-center items-center p-4 text-[#f3f3ee] font-serif" dir="rtl">
      <div className="w-full max-w-md bg-[#14151a] border border-[#262833] rounded-3xl p-8 shadow-xl text-center">
        {/* Pure text header */}
        <h1 className="text-xl font-semibold tracking-tight text-[#cc785c] mb-4">
          المساعد الذكي
        </h1>

        {status === 'loading' && (
          <div className="py-8 space-y-4">
            <Loader2 className="w-8 h-8 animate-spin text-[#cc785c] mx-auto" />
            <h2 className="text-base font-medium text-[#f3f3ee]">
              جاري ربط حسابك على (TickTick)...
            </h2>
            <p className="text-xs text-[#9da0a8]">
              يتم الآن التحقق من رمز التفويض واستلام رمز الوصول (Access Token).
            </p>
          </div>
        )}

        {status === 'success' && (
          <div className="py-6 space-y-4">
            <div className="w-12 h-12 rounded-full bg-emerald-950/40 text-emerald-300 border border-emerald-800 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h2 className="text-base font-medium text-[#f3f3ee]">
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
          <div className="py-6 space-y-4">
            <div className="w-12 h-12 rounded-full bg-red-950/40 text-red-400 border border-red-800 flex items-center justify-center mx-auto">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h2 className="text-base font-medium text-red-600 dark:text-red-400">
              تعذر إتمام عملية الربط
            </h2>
            <p className="text-xs text-[#5f6368] dark:text-[#9aa0a6] leading-relaxed">
              {errorMessage}
            </p>

            <div className="pt-2">
              <Link
                to="/"
                className="inline-flex items-center gap-1.5 px-5 py-2 rounded-full bg-[#1a73e8] hover:bg-[#1557b0] text-white text-xs font-medium transition-colors"
              >
                <span>العودة للمهام</span>
                <ArrowRight className="w-3.5 h-3.5 rotate-180" />
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
