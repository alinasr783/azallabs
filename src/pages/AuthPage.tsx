import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import type { OAuthProvider } from '../context/AuthContext'

const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4" aria-hidden>
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
  </svg>
)

const MicrosoftIcon = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4" aria-hidden>
    <path fill="#F25022" d="M1 1h10v10H1z" />
    <path fill="#7FBA00" d="M11 1h10v10H11z" />
    <path fill="#00A4EF" d="M1 11h10v10H1z" />
    <path fill="#FFB900" d="M11 11h10v10H11z" />
  </svg>
)

const GithubIcon = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor" aria-hidden>
    <path d="M12 .5C5.73.5.5 5.73.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.56v-2c-3.2.7-3.88-1.54-3.88-1.54-.53-1.34-1.29-1.7-1.29-1.7-1.05-.72.08-.71.08-.71 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.71 1.26 3.37.96.1-.75.4-1.26.73-1.55-2.56-.29-5.25-1.28-5.25-5.69 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11.1 11.1 0 0 1 5.8 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.84 1.19 3.1 0 4.42-2.7 5.39-5.27 5.68.41.36.78 1.07.78 2.16v3.2c0 .31.21.68.8.56A11.51 11.51 0 0 0 23.5 12C23.5 5.73 18.27.5 12 .5z" />
  </svg>
)

const AppleIcon = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor" aria-hidden>
    <path d="M16.365 1.43c0 1.14-.42 2.2-1.12 3-.76.86-2 1.52-3.04 1.43-.13-1.1.43-2.27 1.1-3.02.77-.83 2.1-1.46 3.06-1.41zM20.5 17.2c-.55 1.27-.82 1.84-1.53 2.96-.99 1.57-2.39 3.53-4.12 3.54-1.54.02-1.95-1-4.04-.99-2.09.01-2.52 1.01-4.06.99-1.73-.02-3.06-1.79-4.04-3.35C-.02 16.94-.36 11.6 1.85 9.04c1.1-1.36 2.83-2.22 4.49-2.22 1.66 0 2.7 1 4.07 1 1.35 0 2.17-1 4.1-1 1.46 0 3.01.8 4.11 2.17-3.61 1.98-3.03 7.14.88 8.21z" />
  </svg>
)

const OAUTH_PROVIDERS: { id: OAuthProvider; label: string; icon: React.ReactNode }[] = [
  { id: 'google', label: 'Google', icon: <GoogleIcon /> },
  { id: 'github', label: 'GitHub', icon: <GithubIcon /> },
  { id: 'azure', label: 'Microsoft', icon: <MicrosoftIcon /> },
  { id: 'apple', label: 'Apple', icon: <AppleIcon /> },
]

export const AuthPage: React.FC = () => {
  const [isSignUp, setIsSignUp] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [oauthLoading, setOauthLoading] = useState<OAuthProvider | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  const { user, signIn, signUp, signInWithOAuth } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (user) {
      navigate('/', { replace: true })
    }
  }, [user, navigate])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg(null)
    setSuccessMsg(null)

    if (!email || !password) {
      setErrorMsg('يرجى إدخال البريد الإلكتروني وكلمة المرور.')
      return
    }

    if (password.length < 6) {
      setErrorMsg('يجب أن تكون كلمة المرور 6 أحرف على الأقل.')
      return
    }

    setLoading(true)

    try {
      if (isSignUp) {
        const { error } = await signUp(email, password)
        if (error) {
          setErrorMsg(error.message || 'حدث خطأ أثناء إنشاء الحساب.')
        } else {
          setSuccessMsg('تم إنشاء الحساب وتسجيل الدخول بنجاح.')
          setTimeout(() => navigate('/'), 400)
        }
      } else {
        const { error } = await signIn(email, password)
        if (error) {
          setErrorMsg(error.message || 'بيانات الدخول غير صحيحة.')
        } else {
          setSuccessMsg('تم تسجيل الدخول بنجاح.')
          setTimeout(() => navigate('/'), 400)
        }
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'حدث خطأ.')
    } finally {
      setLoading(false)
    }
  }

  const handleOAuth = async (provider: OAuthProvider) => {
    setErrorMsg(null)
    setOauthLoading(provider)
    const { error } = await signInWithOAuth(provider)
    setOauthLoading(null)
    if (error) {
      setErrorMsg(error.message || 'تعذر الدخول عبر هذا المزود.')
    }
  }

  return (
    <div className="min-h-screen w-full bg-[#0d0e11] flex flex-col justify-center items-center p-4 text-[#f3f3ee]">
      {/* Terminal Auth Frame */}
      <div className="w-full max-w-sm">
        <div className="border border-[#2c2e3a] rounded-lg bg-[#14151a]">
          {/* Frame Header */}
          <div className="px-4 py-2 border-b border-[#2c2e3a]/60">
            <span className="text-[11px] text-[#6b6e79] select-none">
              {isSignUp ? 'إنشاء حساب — Azal Labs' : 'تسجيل الدخول — Azal Labs'}
            </span>
          </div>

          {/* Form Body */}
          <div className="p-5 space-y-4">
            <div className="text-center mb-4">
              <h1 className="text-lg font-bold text-[#f3f3ee]">Azal Labs</h1>
              <p className="text-[12px] text-[#6b6e79] mt-1">
                {isSignUp ? 'إنشاء حساب جديد' : 'تسجيل الدخول إلى حسابك'}
              </p>
            </div>

            {/* Alerts */}
            {errorMsg && (
              <div className="p-2.5 rounded border border-red-800/60 bg-red-950/30 text-red-300 text-[11px]">
                ✖ {errorMsg}
              </div>
            )}
            {successMsg && (
              <div className="p-2.5 rounded border border-emerald-800/60 bg-emerald-950/30 text-emerald-300 text-[11px]">
                ✔ {successMsg}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-[11px] text-[#6b6e79] mb-1">البريد الإلكتروني</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full px-3 py-2 rounded-lg border border-[#2c2e3a] bg-[#0d0e11] text-xs text-[#f3f3ee] focus:border-[#cc785c] focus:outline-none transition-colors"
                />
              </div>

              <div>
                <label className="block text-[11px] text-[#6b6e79] mb-1">كلمة المرور</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-3 py-2 rounded-lg border border-[#2c2e3a] bg-[#0d0e11] text-xs text-[#f3f3ee] focus:border-[#cc785c] focus:outline-none transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute left-2.5 top-2 text-[#6b6e79] hover:text-[#9da0a8] cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setIsSignUp(!isSignUp)
                    setErrorMsg(null)
                    setSuccessMsg(null)
                  }}
                  className="text-[11px] text-[#cc785c] hover:underline cursor-pointer"
                >
                  {isSignUp ? 'لديك حساب؟ دخول' : 'إنشاء حساب جديد'}
                </button>

                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-1.5 rounded-lg bg-[#cc785c] hover:bg-[#be684e] text-white text-xs font-bold transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                >
                  {loading && <Loader2 className="w-3 h-3 animate-spin" />}
                  <span>{isSignUp ? 'إنشاء' : 'دخول'}</span>
                </button>
              </div>
            </form>

            {/* Social OAuth */}
            <div className="grid grid-cols-2 gap-2">
              {OAUTH_PROVIDERS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handleOAuth(p.id)}
                  disabled={oauthLoading !== null}
                  className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-[#2c2e3a] bg-[#0d0e11] hover:border-[#cc785c] text-[#f3f3ee] text-xs transition-colors cursor-pointer disabled:opacity-50"
                >
                  {oauthLoading === p.id ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    p.icon
                  )}
                  <span>{p.label}</span>
                </button>
              ))}
            </div>

            {/* Divider */}
            <div className="border-t border-[#2c2e3a] my-3" />

            {/* Mandatory login notice */}
            <div className="text-center pt-1">
              <span className="text-[11px] text-[#6b6e79]">
                جميع بياناتك ومشاريعك مشفرة ومحفوظة بحسابك بشكل آمن.
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
