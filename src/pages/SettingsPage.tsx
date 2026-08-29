import React, { useState, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  ArrowRight,
  Server,
  Plus,
  Trash2,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Loader2,
  Check,
  Link2,
  Download,
  CheckCircle,
  Play,
  RotateCcw,
  Copy,
  Terminal,
  FileCode,
  Database,
} from 'lucide-react'
import { useMcp, type McpToolDefinition, VERCEL_MCP_TOOLS, GITHUB_MCP_TOOLS } from '../context/McpContext'
import { useAgentConfig } from '../context/AgentConfigContext'
import { streamUnifiedLlmCompletion } from '../lib/llm/llmService'
import {
  getTickTickAuthUrl,
  getTickTickToken,
  clearTickTickToken,
  createTickTickTask,
  getRedirectUri,
  setTickTickToken,
} from '../lib/ticktick'
import {
  getSupabaseConnection,
  setSupabaseConnection,
  clearSupabaseConnection,
  isSupabaseConnected,
  listSupabaseTables,
} from '../lib/supabaseConnector'
import {
  getVercelToken,
  setVercelToken,
  clearVercelToken,
  isVercelConnected,
  testVercelConnection,
} from '../lib/vercelConnector'
import {
  getGitHubToken,
  setGitHubToken,
  clearGitHubToken,
  isGitHubConnected,
  testGitHubConnection,
} from '../lib/githubConnector'

const GEMINI_MODELS = [
  { id: 'gemini-3.5-flash-lite', name: 'Gemini 3.5 Flash Lite', desc: 'Recommended, ultra-fast & responsive' },
  { id: 'gemini-3.5-flash', name: 'Gemini 3.5 Flash', desc: 'High capability & reasoning' },
  { id: 'gemini-flash-latest', name: 'Gemini Flash Latest', desc: 'Latest dynamic model' },
  { id: 'gemini-3.1-pro-preview', name: 'Gemini 3.1 Pro Preview', desc: 'State-of-the-art complex coding' },
]

const OPENAI_MODELS = [
  { id: 'gpt-4o-mini', name: 'GPT-4o Mini', desc: 'Fast, lightweight, affordable' },
  { id: 'gpt-4o', name: 'GPT-4o', desc: 'Flagship multimodal intelligence' },
  { id: 'o3-mini', name: 'o3-mini', desc: 'High-speed reasoning' },
  { id: 'o1', name: 'o1', desc: 'Deep deliberate reasoning' },
  { id: 'o1-mini', name: 'o1-mini', desc: 'Fast reasoning' },
  { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', desc: 'High-intelligence legacy model' },
]

const DEEPSEEK_MODELS = [
  { id: 'deepseek-chat', name: 'DeepSeek-V3 (Chat)', desc: 'General intelligence, chat & coding' },
  { id: 'deepseek-reasoner', name: 'DeepSeek-R1 (Reasoner)', desc: 'Chain of thought & math reasoning' },
]

const CUSTOM_PRESETS = [
  { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B (Groq)', endpoint: 'https://api.groq.com/openai/v1/chat/completions', desc: 'Ultra-fast inference' },
  { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B (Groq)', endpoint: 'https://api.groq.com/openai/v1/chat/completions', desc: 'Instant latency' },
  { id: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B (Groq)', endpoint: 'https://api.groq.com/openai/v1/chat/completions', desc: 'Long context window' },
  { id: 'deepseek-r1-distill-llama-70b', name: 'DeepSeek R1 70B (Groq)', endpoint: 'https://api.groq.com/openai/v1/chat/completions', desc: 'R1 distilled reasoning' },
  { id: 'qwen-2.5-72b-instruct', name: 'Qwen 2.5 72B (Together)', endpoint: 'https://api.together.xyz/v1/chat/completions', desc: 'High coding benchmark' },
]

export type SettingsTab = 'llm' | 'system-prompt' | 'memory' | 'mcp'

const SYSTEM_PROMPT_PRESETS = [
  {
    id: 'azal-developer',
    name: 'Azal Developer (مستحسن)',
    description: 'وكيل المطورين المستقل عالي الكفاءة — دقة تقنية متقدمة، برمجة نظيفة وتفكير منهجي منظم.',
    prompt: `أنت Azal Labs — وكيل ذكاء اصطناعي مستقل ومتقدم للمطورين، مصمم لتنفيذ المهام البرمجية والتخطيط التقني بدقة فائقة.

القواعد السلوكية الأساسية:
1. التخطيط المنهجي المنظم: في أي مهمة غير بسيطة، قم أولاً بتوضيح خطوات التنفيذ في خطة مرقمة ودقيقة قبل الشروع في التنفيذ.
2. الجودة البرمجية الفائقة: اكتب أكواداً نظيفة وخالية تماماً من الأخطاء مع الالتزام الصارم بمعايير TypeScript وأفضل ممارسات هندسة البرمجيات.
3. التنسيق بأسلوب Markdown الأنيق: استخدم الجداول المنظمة والقوائم النقطية لتلخيص البيانات وتنسيق الأوامر.
4. مكافحة الهلوسة الصارمة (Anti-Hallucination): التزم بالحقائق المسترجعة من الأدوات والملفات الحقيقية ولا تفترض أي بيانات غير متوفرة.
5. النبرة وأسلوب التعامل: مهني، عملي، دقيق، يركز على الحلول البرمجية مباشرة وبدون حشو غير مفيد.`,
  },
  {
    id: 'azal-standard',
    name: 'Azal Labs Standard (الافتراضي)',
    description: 'النمط الافتراضي المتكامل مع خوادم MCP وجداول Markdown وإدارة مهام TickTick.',
    prompt: `أنت مساعد رقمي ذكي وبسيط لنظام Azal Labs، تعمل بدقة وتجيب بوضوح ومباشرة على استفسارات ومهام المستخدمين.

قواعد تنسيق الردود (تنسيق Markdown نصي أنيق - بدون وسوم HTML):
لا تستخدم كود HTML في ردودك أبداً، بل اكتب نصاً عادياً واستخدم علامات Markdown البسيطة التالية:
- استخدم **نص** لجعل الكلمات والعبارات الهامة بخط كبير وعريض وواضح.
- استخدم ### عنوان فرعي أو ## عنوان رئيسي للعناوين.
- استخدم - عنصر أو * عنصر للقوائم النقطية، أو 1. عنصر للقوائم المرقمة.
- استخدم > ملاحظة للملاحظات والاقتباسات والتنبيهات.
- استخدم \`مصطلح\` للمصطلحات البرمجية، و \`\`\` لكتل الأكواد.

القدرة على إنشاء الجداول المنظمة (Markdown Tables):
أنت قادر ومؤهل تماماً لإنشاء جداول منسقة واحترافية في أي وقت يُطلب منك ذلك أو عندما يكون الجدول هو أفضل وسيلة لعرض ومقارنة البيانات.

مبدأ الصدق التام ومنع الهلوسة (Strict Anti-Hallucination Policy):
يمنع منعاً باتاً اختراع أو افتراض مهام أو مشاريع أو بيانات وهمية للمستخدم من عندك.`,
  },
  {
    id: 'deep-architect',
    name: 'Deep Technical Architect',
    description: 'مهندس معماري تقني يحلل الأنظمة الكبيرة والتصميم المعماري والأمان وقابلية التوسع.',
    prompt: `You are a Principal Software Architect and Systems Engineer.
Analyze technical systems and codebases with focus on:
- High availability, resilience, scalability, and loose coupling.
- Clean boundaries, modular abstractions, and solid domain models.
- Objective evaluation of trade-offs for technical decisions.
- Rigorous security, error handling, and fault-tolerance architecture.`,
  },
  {
    id: 'concise-terminal',
    name: 'Concise Terminal Mode',
    description: 'وضع التيرمينال فائق السرعة — إجابات برمجية مباشرة ومختصرة بأقل عدد من الكلمات.',
    prompt: `You are a high-speed terminal assistant.
- Respond with minimal words.
- Provide direct terminal commands, code, or answers immediately without pleasantries or unnecessary explanations.
- Use concise bullet points only when explanation is strictly required.`,
  },
]

export const SettingsPage: React.FC = () => {
  const {
    llmConfig,
    setActiveProvider,
    updateProviderSettings,
    memoryText,
    saveMemory,
    systemPrompt,
    setSystemPrompt,
    saveConfig,
    isSaving: isSavingConfig,
    lastSavedAt,
    resetToDefault: resetSystemPromptToDefault,
  } = useAgentConfig()

  const {
    servers,
    connectServer,
    disconnectServer,
    addToolToServer,
    discoverServerTools,
  } = useMcp()

  const [searchParams, setSearchParams] = useSearchParams()
  const initialTab = searchParams.get('tab') as SettingsTab | null
  const [activeTab, setActiveTab] = useState<SettingsTab>(
    initialTab && ['llm', 'system-prompt', 'memory', 'mcp'].includes(initialTab) ? initialTab : 'llm'
  )

  const handleTabChange = (tab: SettingsTab) => {
    setActiveTab(tab)
    setSearchParams({ tab })
  }

  // System Prompt Tab State
  const [editedSystemPrompt, setEditedSystemPrompt] = useState(systemPrompt)
  const [systemPromptMsg, setSystemPromptMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [promptTestInput, setPromptTestInput] = useState('')
  const [promptTestOutput, setPromptTestOutput] = useState<string | null>(null)
  const [isTestingPrompt, setIsTestingPrompt] = useState(false)

  // Keep local editor in sync with context
  useEffect(() => {
    setEditedSystemPrompt(systemPrompt)
  }, [systemPrompt])

  const handleSaveSystemPrompt = async () => {
    setSystemPromptMsg(null)
    setSystemPrompt(editedSystemPrompt)
    const res = await saveConfig()
    setSystemPromptMsg({
      type: res.success ? 'success' : 'error',
      text: res.message,
    })
    setTimeout(() => setSystemPromptMsg(null), 3500)
  }

  const handleResetSystemPrompt = () => {
    if (window.confirm('هل أنت متأكد من رغبتك في استعادة التوجيه الافتراضي للـ System Prompt؟')) {
      resetSystemPromptToDefault()
      setSystemPromptMsg({ type: 'success', text: 'تمت استعادة التوجيه الافتراضي بنجاح.' })
      setTimeout(() => setSystemPromptMsg(null), 3000)
    }
  }

  const handleTestSystemPrompt = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!promptTestInput.trim() || isTestingPrompt) return

    setIsTestingPrompt(true)
    setPromptTestOutput('')
    let accumulated = ''

    await streamUnifiedLlmCompletion(llmConfig, {
      messages: [{ role: 'user', content: promptTestInput.trim() }],
      systemPrompt: editedSystemPrompt,
      onDelta: (chunk: string) => {
        accumulated += chunk
        setPromptTestOutput(accumulated)
      },
      onDone: () => {
        setIsTestingPrompt(false)
      },
      onError: (err: any) => {
        setIsTestingPrompt(false)
        setPromptTestOutput(`Error: ${err?.message || String(err)}`)
      },
    })
  }

  // Memory Editor State
  const [editedMemory, setEditedMemory] = useState(memoryText)
  const [isSavingMemory, setIsSavingMemory] = useState(false)
  const [memorySavedSuccess, setMemorySavedSuccess] = useState(false)

  const handleSaveMemory = () => {
    setIsSavingMemory(true)
    saveMemory(editedMemory)
    setIsSavingMemory(false)
    setMemorySavedSuccess(true)
    setTimeout(() => setMemorySavedSuccess(false), 2500)
  }

  const handleResetMemory = () => {
    if (window.confirm('هل أنت متأكد من رغبتك في إفراغ الذاكرة الدائمة بالكامل؟')) {
      setEditedMemory('')
      saveMemory('')
    }
  }

  const handleDownloadMemory = () => {
    const blob = new Blob([editedMemory], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'memory.txt'
    a.click()
    URL.revokeObjectURL(url)
  }

  // TickTick state
  const isTickTickConnected = Boolean(getTickTickToken())
  const [isCreatingTickTickTask, setIsCreatingTickTickTask] = useState(false)
  const [tickTickSuccessMsg, setTickTickSuccessMsg] = useState<string | null>(null)

  // Custom MCP Server Form
  const [customName, setCustomName] = useState('')
  const [customUrl, setCustomUrl] = useState('')
  const [customToken, setCustomToken] = useState('')
  const [customToolsText, setCustomToolsText] = useState('')
  const [isAddingCustom, setIsAddingCustom] = useState(false)
  const [customSuccess, setCustomSuccess] = useState(false)

  // Expanded server tools accordion
  const [expandedServerId, setExpandedServerId] = useState<string | null>(null)
  const [newToolName, setNewToolName] = useState('')
  const [newToolDesc, setNewToolDesc] = useState('')
  const [addingToolServerId, setAddingToolServerId] = useState<string | null>(null)
  const [discoveringServerId, setDiscoveringServerId] = useState<string | null>(null)
  const [discoverySuccessMsg, setDiscoverySuccessMsg] = useState<{ id: string; msg: string } | null>(null)

  const handleDiscoverTools = async (serverId: string) => {
    setDiscoveringServerId(serverId)
    try {
      const res = await discoverServerTools(serverId)
      if (res.success) {
        setDiscoverySuccessMsg({
          id: serverId,
          msg: `Successfully discovered and updated ${res.count} tools via tools/list protocol!`,
        })
        setTimeout(() => setDiscoverySuccessMsg(null), 4000)
      } else {
        setDiscoverySuccessMsg({
          id: serverId,
          msg: 'Could not discover tools automatically. Please verify the endpoint is running.',
        })
        setTimeout(() => setDiscoverySuccessMsg(null), 4000)
      }
    } finally {
      setDiscoveringServerId(null)
    }
  }

  const [manualTickTickToken, setManualTickTickToken] = useState('')
  const [showManualTickTickInput, setShowManualTickTickInput] = useState(false)
  const [manualTickTickSaved, setManualTickTickSaved] = useState(false)

  const handleConnectTickTick = () => {
    window.location.href = getTickTickAuthUrl()
  }

  const handleSaveManualTickTickToken = async () => {
    if (!manualTickTickToken.trim()) return
    setTickTickToken(manualTickTickToken.trim())
    await connectServer({
      name: 'TickTick MCP',
      url: 'https://mcp.ticktick.com',
      service: 'ticktick',
      authToken: manualTickTickToken.trim(),
    })
    setManualTickTickSaved(true)
    setTimeout(() => {
      window.location.reload()
    }, 600)
  }

  const handleDisconnectTickTick = async () => {
    clearTickTickToken()
    const ttServer = servers.find((s) => s.service === 'ticktick' || s.url.includes('ticktick'))
    if (ttServer) {
      await disconnectServer(ttServer.id)
    }
  }

  const handleTestTickTick = async () => {
    setIsCreatingTickTickTask(true)
    setTickTickSuccessMsg(null)
    try {
      const now = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
      const res = await createTickTickTask({
        title: `Azal Labs Test Task (${now})`,
        content: 'Created from Azal Labs Settings to verify real-time TickTick integration.',
      })
      setTickTickSuccessMsg(`Task created successfully in TickTick: "${res.title}"`)
      setTimeout(() => setTickTickSuccessMsg(null), 5000)
    } catch (err: any) {
      setTickTickSuccessMsg(`Error: ${err.message}`)
    } finally {
      setIsCreatingTickTickTask(false)
    }
  }

  // Supabase connection state
  const initialSupabase = getSupabaseConnection()
  const [supabaseUrl, setSupabaseUrl] = useState(initialSupabase?.projectUrl || '')
  const [supabaseAnonKey, setSupabaseAnonKey] = useState(initialSupabase?.anonKey || '')
  const [supabaseServiceKey, setSupabaseServiceKey] = useState(initialSupabase?.serviceRoleKey || '')
  const [supabaseMgmtToken, setSupabaseMgmtToken] = useState(initialSupabase?.managementToken || '')
  const [supabaseStatusMsg, setSupabaseStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [isTestingSupabase, setIsTestingSupabase] = useState(false)

  const handleConnectSupabase = () => {
    setSupabaseStatusMsg(null)
    if (!supabaseUrl.trim() || !supabaseAnonKey.trim()) {
      setSupabaseStatusMsg({ type: 'error', text: 'رابط المشروع ومفتاح anon مطلوبان على الأقل.' })
      return
    }
    setSupabaseConnection({
      projectUrl: supabaseUrl.trim().replace(/\/$/, ''),
      anonKey: supabaseAnonKey.trim(),
      serviceRoleKey: supabaseServiceKey.trim() || undefined,
      managementToken: supabaseMgmtToken.trim() || undefined,
    })
    setSupabaseStatusMsg({ type: 'success', text: 'تم ربط مشروع Supabase بنجاح. أصبح الوكيل قادراً على قراءة بياناتك وتنفيذ الاستعلامات.' })
    setTimeout(() => setSupabaseStatusMsg(null), 4000)
  }

  const handleDisconnectSupabase = () => {
    clearSupabaseConnection()
    setSupabaseUrl('')
    setSupabaseAnonKey('')
    setSupabaseServiceKey('')
    setSupabaseMgmtToken('')
    setSupabaseStatusMsg({ type: 'success', text: 'تم قطع الاتصال بمشروع Supabase وحذف بيانات الربط من المتصفح.' })
    setTimeout(() => setSupabaseStatusMsg(null), 4000)
  }

  const handleTestSupabase = async () => {
    setIsTestingSupabase(true)
    setSupabaseStatusMsg(null)
    try {
      const conn = getSupabaseConnection()
      if (!conn) {
        setSupabaseStatusMsg({ type: 'error', text: 'لا يوجد مشروع Supabase مربوط.' })
        return
      }
      const tables = await listSupabaseTables(conn)
      setSupabaseStatusMsg({
        type: 'success',
        text: `تم الاتصال بنجاح ✔ تم العثور على ${tables.length} جدول (مثل: ${tables.slice(0, 5).map((t) => t.name).join(', ')}${tables.length > 5 ? ' …' : ''}).`,
      })
    } catch (err: any) {
      setSupabaseStatusMsg({ type: 'error', text: `فشل الاتصال: ${err.message}` })
    } finally {
      setIsTestingSupabase(false)
      setTimeout(() => setSupabaseStatusMsg(null), 6000)
    }
  }

  // Vercel connection state
  const [vercelTokenInput, setVercelTokenInput] = useState(getVercelToken() || '')
  const [vercelStatusMsg, setVercelStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [isTestingVercel, setIsTestingVercel] = useState(false)
  const [isConnectingVercel, setIsConnectingVercel] = useState(false)
  const [showVercelTools, setShowVercelTools] = useState(false)
  const [vercelCategoryFilter, setVercelCategoryFilter] = useState<string>('all')

  const isVercelServerConnected =
    isVercelConnected() ||
    servers.some(
      (s) =>
        s.service === 'vercel' ||
        s.url.includes('vercel') ||
        s.name.toLowerCase().includes('vercel')
    )

  const handleConnectVercel = async () => {
    setVercelStatusMsg(null)
    const token = vercelTokenInput.trim()
    if (!token) {
      setVercelStatusMsg({
        type: 'error',
        text: 'يرجى إدخال رمز الوصول الشخصي (Personal Access Token) من إعدادات حساب Vercel.',
      })
      return
    }

    setIsConnectingVercel(true)
    try {
      setVercelToken(token)
      await connectServer({
        name: 'Vercel MCP',
        url: 'https://mcp.vercel.com',
        service: 'vercel',
        authToken: token,
        tools: VERCEL_MCP_TOOLS,
        isEnabled: true,
      })

      const testRes = await testVercelConnection(token)
      if (testRes.success) {
        const teamsInfo =
          testRes.teams && testRes.teams.length > 0
            ? ` — الفرق المتاحة: ${testRes.teams.map((t) => t.name).join(', ')}`
            : ''
        setVercelStatusMsg({
          type: 'success',
          text: `تم ربط خادم Vercel MCP بنجاح ✔ تم التعرف على حساب: ${testRes.user?.username || testRes.user?.email || 'المستخدم'}${teamsInfo} وتفعيل 23+ أداة.`,
        })
      } else {
        setVercelStatusMsg({
          type: 'success',
          text: 'تم حفظ رمز Vercel وربط خادم Vercel MCP (https://mcp.vercel.com) بنجاح مع 23+ أداة.',
        })
      }
    } catch (err: any) {
      setVercelStatusMsg({ type: 'error', text: `فشل الربط: ${err.message}` })
    } finally {
      setIsConnectingVercel(false)
      setTimeout(() => setVercelStatusMsg(null), 6000)
    }
  }

  const handleDisconnectVercel = async () => {
    clearVercelToken()
    setVercelTokenInput('')
    const vServer = servers.find(
      (s) =>
        s.service === 'vercel' ||
        s.url.includes('vercel') ||
        s.name.toLowerCase().includes('vercel')
    )
    if (vServer) {
      await disconnectServer(vServer.id)
    }
    setVercelStatusMsg({
      type: 'success',
      text: 'تم قطع الاتصال بخادم Vercel MCP وإزالة بيانات الربط من المتصفح.',
    })
    setTimeout(() => setVercelStatusMsg(null), 4000)
  }

  const handleTestVercel = async () => {
    setIsTestingVercel(true)
    setVercelStatusMsg(null)
    try {
      const res = await testVercelConnection(vercelTokenInput.trim() || undefined)
      if (res.success) {
        const teamsStr =
          res.teams && res.teams.length > 0 ? ` (الفرق: ${res.teams.map((t) => t.slug).join(', ')})` : ''
        setVercelStatusMsg({
          type: 'success',
          text: `الاتصال بـ Vercel نشط وموثوق ✔ حساب: ${res.user?.username || res.user?.email || 'Vercel'}${teamsStr}. كافة أدوات Vercel MCP جاهزة للاستخدام!`,
        })
      } else {
        setVercelStatusMsg({ type: 'error', text: res.error || 'فشل التحقق من رمز Vercel.' })
      }
    } catch (err: any) {
      setVercelStatusMsg({ type: 'error', text: `خطأ أثناء الفحص: ${err.message}` })
    } finally {
      setIsTestingVercel(false)
      setTimeout(() => setVercelStatusMsg(null), 6000)
    }
  }

  const handleAddVercelPreset = async () => {
    await connectServer({
      name: 'Vercel MCP',
      url: 'https://mcp.vercel.com',
      service: 'vercel',
      authToken: getVercelToken() || undefined,
      tools: VERCEL_MCP_TOOLS,
      isEnabled: true,
    })
  }

  // GitHub connection state
  const [gitHubTokenInput, setGitHubTokenInput] = useState(getGitHubToken() || '')
  const [gitHubStatusMsg, setGitHubStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [isTestingGitHub, setIsTestingGitHub] = useState(false)
  const [isConnectingGitHub, setIsConnectingGitHub] = useState(false)
  const [showGitHubTools, setShowGitHubTools] = useState(false)
  const [gitHubCategoryFilter, setGitHubCategoryFilter] = useState<string>('all')

  const isGitHubServerConnected =
    isGitHubConnected() ||
    servers.some(
      (s) =>
        s.service === 'github' ||
        s.url.includes('github') ||
        s.name.toLowerCase().includes('github')
    )

  const handleConnectGitHub = async () => {
    setGitHubStatusMsg(null)
    const token = gitHubTokenInput.trim()
    if (!token) {
      setGitHubStatusMsg({
        type: 'error',
        text: 'يرجى إدخال رمز الوصول الشخصي (GitHub Personal Access Token).',
      })
      return
    }

    setIsConnectingGitHub(true)
    try {
      setGitHubToken(token)
      await connectServer({
        name: 'GitHub MCP',
        url: 'https://api.githubcopilot.com/mcp/',
        service: 'github',
        authToken: token,
        tools: GITHUB_MCP_TOOLS,
        isEnabled: true,
      })

      const testRes = await testGitHubConnection(token)
      if (testRes.success && testRes.user) {
        setGitHubStatusMsg({
          type: 'success',
          text: `تم ربط خادم GitHub MCP بنجاح ✔ تم التعرف على حساب: @${testRes.user.login} (${testRes.user.public_repos ?? 0} مستودع عام) وتفعيل 40+ أداة.`,
        })
      } else {
        setGitHubStatusMsg({
          type: 'success',
          text: 'تم حفظ رمز GitHub وربط خادم GitHub MCP بنجاح مع 40+ أداة.',
        })
      }
    } catch (err: any) {
      setGitHubStatusMsg({ type: 'error', text: `فشل الربط: ${err.message}` })
    } finally {
      setIsConnectingGitHub(false)
      setTimeout(() => setGitHubStatusMsg(null), 6000)
    }
  }

  const handleDisconnectGitHub = async () => {
    clearGitHubToken()
    setGitHubTokenInput('')
    const gServer = servers.find(
      (s) =>
        s.service === 'github' ||
        s.url.includes('github') ||
        s.name.toLowerCase().includes('github')
    )
    if (gServer) {
      await disconnectServer(gServer.id)
    }
    setGitHubStatusMsg({
      type: 'success',
      text: 'تم قطع الاتصال بخادم GitHub MCP وإزالة بيانات الربط من المتصفح.',
    })
    setTimeout(() => setGitHubStatusMsg(null), 4000)
  }

  const handleTestGitHub = async () => {
    setIsTestingGitHub(true)
    setGitHubStatusMsg(null)
    try {
      const res = await testGitHubConnection(gitHubTokenInput.trim() || undefined)
      if (res.success && res.user) {
        setGitHubStatusMsg({
          type: 'success',
          text: `الاتصال بـ GitHub نشط وموثوق ✔ حساب: @${res.user.login} (${res.user.public_repos ?? 0} مستودع عام، ${res.user.total_private_repos ?? 0} خاص). كافة أدوات GitHub MCP جاهزة للاستخدام!`,
        })
      } else {
        setGitHubStatusMsg({ type: 'error', text: res.error || 'فشل التحقق من رمز GitHub.' })
      }
    } catch (err: any) {
      setGitHubStatusMsg({ type: 'error', text: `خطأ أثناء الفحص: ${err.message}` })
    } finally {
      setIsTestingGitHub(false)
      setTimeout(() => setGitHubStatusMsg(null), 6000)
    }
  }

  const handleAddGitHubPreset = async () => {
    await connectServer({
      name: 'GitHub MCP',
      url: 'https://api.githubcopilot.com/mcp/',
      service: 'github',
      authToken: getGitHubToken() || undefined,
      tools: GITHUB_MCP_TOOLS,
      isEnabled: true,
    })
  }

  const handleAddCustomServer = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!customUrl.trim()) return

    setIsAddingCustom(true)

    let parsedTools: McpToolDefinition[] = []
    if (customToolsText.trim()) {
      parsedTools = customToolsText
        .split(/[,;\n]+/)
        .map((t) => t.trim())
        .filter(Boolean)
        .map((name) => ({
          name,
          description: `Tool ${name} registered on custom MCP server`,
        }))
    }

    await connectServer({
      name: customName.trim() || 'Custom MCP Server',
      url: customUrl.trim(),
      authToken: customToken.trim() || undefined,
      tools: parsedTools.length > 0 ? parsedTools : undefined,
      isEnabled: true,
    })

    setIsAddingCustom(false)
    setCustomSuccess(true)
    setCustomName('')
    setCustomUrl('')
    setCustomToken('')
    setCustomToolsText('')
    setTimeout(() => setCustomSuccess(false), 3000)
  }

  const handleAddNewTool = async (serverId: string) => {
    if (!newToolName.trim()) return
    await addToolToServer(serverId, {
      name: newToolName.trim(),
      description: newToolDesc.trim() || `Tool ${newToolName.trim()}`,
    })
    setNewToolName('')
    setNewToolDesc('')
    setAddingToolServerId(null)
  }

  const handleAdd800AcademyPreset = async () => {
    await connectServer({
      name: '800 Academy MCP',
      url: 'https://api.800academy.com/mcp',
      service: '800 Academy',
      isEnabled: true,
    })
  }

  return (
    <div className="min-h-screen bg-[#0d0e11] text-[#f3f3ee]" dir="rtl">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-[#131418]/90 backdrop-blur-md border-b border-[#22242c] px-4 py-3 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            to="/"
            className="p-2 rounded-xl text-[#9da0a8] hover:text-[#f3f3ee] hover:bg-[#1f2029] transition-colors cursor-pointer"
            title="العودة إلى المحادثة"
          >
            <ArrowRight className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-sm font-bold text-[#f3f3ee]">
              Azal Labs — الإعدادات والتكوين
            </h1>
            <p className="text-[11px] text-[#9da0a8]">
              إدارة نماذج (LLM)، والتعليمات التوجيهية، والذاكرة الدائمة، وخوادم الربط (MCP)
            </p>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-1 bg-[#181920] border border-[#262833] p-1 rounded-2xl overflow-x-auto [&::-webkit-scrollbar]:hidden [scrollbar-width:none] w-full">
          <button
            onClick={() => handleTabChange('llm')}
            className={`px-3 py-1.5 rounded-lg text-xs transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              activeTab === 'llm'
                ? 'bg-[#1a1b22] text-[#cc785c] font-bold border border-[#cc785c]/40'
                : 'text-[#6b6e79] hover:text-[#f3f3ee] hover:bg-[#1a1b22]'
            }`}
          >
            <span>النماذج (LLM)</span>
          </button>

          <button
            onClick={() => handleTabChange('system-prompt')}
            className={`px-3 py-1.5 rounded-lg text-xs transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              activeTab === 'system-prompt'
                ? 'bg-[#1a1b22] text-[#cc785c] font-bold border border-[#cc785c]/40'
                : 'text-[#6b6e79] hover:text-[#f3f3ee] hover:bg-[#1a1b22]'
            }`}
          >
            <span>التعليمات التوجيهية</span>
          </button>

          <button
            onClick={() => handleTabChange('memory')}
            className={`px-3 py-1.5 rounded-lg text-xs transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              activeTab === 'memory'
                ? 'bg-[#1a1b22] text-[#cc785c] font-bold border border-[#cc785c]/40'
                : 'text-[#6b6e79] hover:text-[#f3f3ee] hover:bg-[#1a1b22]'
            }`}
          >
            <span>الذاكرة الدائمة</span>
          </button>

          <button
            onClick={() => handleTabChange('mcp')}
            className={`px-3 py-1.5 rounded-lg text-xs transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              activeTab === 'mcp'
                ? 'bg-[#1a1b22] text-[#cc785c] font-bold border border-[#cc785c]/40'
                : 'text-[#6b6e79] hover:text-[#f3f3ee] hover:bg-[#1a1b22]'
            }`}
          >
            <span>خوادم الربط (MCP)</span>
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6">
        {/* ========================================================= */}
        {/* TAB 1: LLM PROVIDERS                                      */}
        {/* ========================================================= */}
        {activeTab === 'llm' && (
          <section className="space-y-6">
            <div>
              <h2 className="text-base font-semibold text-[#f3f3ee]">
                تكوين نماذج الذكاء الاصطناعي (LLM)
              </h2>
              <p className="text-xs text-[#9da0a8] mt-1">
                إعداد مفاتيح الاتصال (API Keys) واختيار النموذج المناسب. التبديل بين النماذج فوري ويتم في الوقت الفعلي.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-5">
              {/* 1. Google Gemini */}
              <div
                className={`p-4 rounded-2xl border transition-all ${
                  llmConfig.activeProvider === 'gemini'
                    ? 'border-[#cc785c] bg-[#cc785c]/10 shadow-xs'
                    : 'border-[#262833] bg-[#14151a]'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-[#cc785c]/15 text-[#cc785c] flex items-center justify-center font-bold text-sm">
                      G
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-[#f3f3ee]">
                        (Google Gemini)
                      </h3>
                      <p className="text-xs text-[#9da0a8]">
                        نماذج متعددة الوسائط متطورة وفائقة السرعة في الاستنتاج
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {llmConfig.activeProvider === 'gemini' ? (
                      <span className="px-3 py-1 rounded-full text-xs font-semibold bg-[#cc785c] text-white flex items-center gap-1">
                        <CheckCircle className="w-3.5 h-3.5" />
                        النموذج النشط
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setActiveProvider('gemini')}
                        className="px-3 py-1 rounded-full border border-[#2c2e3a] hover:bg-[#1a1b22] text-xs font-medium text-[#9da0a8] hover:text-[#f3f3ee] transition-colors cursor-pointer"
                      >
                        تفعيل (Gemini)
                      </button>
                    )}
                  </div>
                </div>

                <div className="space-y-4 pt-2">
                  {/* API Key */}
                  <div>
                    <label className="block text-xs font-medium text-[#9da0a8] mb-1">
                      مفتاح (API Key) لـ (Gemini) (اختياري - يستخدم الافتراضي إن تُرك فارغاً)
                    </label>
                    <input
                      type="password"
                      value={llmConfig.gemini.apiKey}
                      onChange={(e) => updateProviderSettings('gemini', { apiKey: e.target.value })}
                      placeholder="AIzaSy... (اتركه فارغاً لاستخدام المفتاح المدمج)"
                      className="w-full px-3.5 py-2 rounded-xl border border-[#2c2e3a] bg-[#0d0e11] text-xs text-[#f3f3ee] focus:border-[#cc785c] focus:outline-none"
                    />
                  </div>

                  {/* Model Selection & Manual Input */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-medium text-[#9da0a8]">
                        اسم النموذج (قابل للتعديل - اكتب أي نموذج مخصص)
                      </label>
                      <span className="text-[11px] text-[#6b6e79]">
                        اكتب اسم النموذج أو اختر من القائمة
                      </span>
                    </div>

                    <input
                      type="text"
                      value={llmConfig.gemini.model}
                      onChange={(e) => updateProviderSettings('gemini', { model: e.target.value })}
                      placeholder="e.g. gemini-2.5-flash"
                      className="w-full px-3.5 py-2 rounded-xl border border-[#2c2e3a] bg-[#0d0e11] text-xs font-medium text-[#f3f3ee] focus:border-[#cc785c] focus:outline-none"
                    />

                    {/* Presets Chips */}
                    <div className="flex flex-wrap gap-1.5 mt-2.5">
                      {GEMINI_MODELS.map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => updateProviderSettings('gemini', { model: m.id })}
                          className={`px-2.5 py-1 rounded-lg text-xs font-mono transition-colors cursor-pointer ${
                            llmConfig.gemini.model === m.id
                              ? 'bg-[#cc785c] text-white font-bold shadow-xs'
                              : 'border border-[#2c2e3a] hover:bg-[#1a1b22] text-[#9da0a8] hover:text-[#f3f3ee]'
                          }`}
                          title={m.desc}
                        >
                          {m.name}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* 2. OpenAI */}
              <div
                className={`p-4 rounded-2xl border transition-all ${
                  llmConfig.activeProvider === 'openai'
                    ? 'border-[#cc785c] bg-[#cc785c]/10 shadow-xs'
                    : 'border-[#262833] bg-[#14151a]'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-[#cc785c]/15 text-[#cc785c] flex items-center justify-center font-bold text-sm">
                      O
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-[#f3f3ee]">
                        (OpenAI / ChatGPT)
                      </h3>
                      <p className="text-xs text-[#9da0a8]">
                        نماذج (GPT-4o) و (o3-mini) ونماذج التفكير المتقدم
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {llmConfig.activeProvider === 'openai' ? (
                      <span className="px-3 py-1 rounded-full text-xs font-semibold bg-[#cc785c] text-white flex items-center gap-1">
                        <CheckCircle className="w-3.5 h-3.5" />
                        النموذج النشط
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setActiveProvider('openai')}
                        className="px-3 py-1 rounded-full border border-[#2c2e3a] hover:bg-[#1a1b22] text-xs font-medium text-[#9da0a8] hover:text-[#f3f3ee] transition-colors cursor-pointer"
                      >
                        تفعيل (OpenAI)
                      </button>
                    )}
                  </div>
                </div>

                <div className="space-y-4 pt-2">
                  <div>
                    <label className="block text-xs font-medium text-[#9da0a8] mb-1">
                      مفتاح (API Key) لـ (OpenAI)
                    </label>
                    <input
                      type="password"
                      value={llmConfig.openai.apiKey}
                      onChange={(e) => updateProviderSettings('openai', { apiKey: e.target.value })}
                      placeholder="sk-proj-..."
                      className="w-full px-3.5 py-2 rounded-xl border border-[#2c2e3a] bg-[#0d0e11] text-xs text-[#f3f3ee] focus:border-[#cc785c] focus:outline-none"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-medium text-[#9da0a8]">
                        اسم النموذج (قابل للتعديل - اكتب أي نموذج مخصص)
                      </label>
                      <span className="text-[11px] text-[#6b6e79]">
                        اكتب اسم النموذج أو اختر من القائمة
                      </span>
                    </div>

                    <input
                      type="text"
                      value={llmConfig.openai.model}
                      onChange={(e) => updateProviderSettings('openai', { model: e.target.value })}
                      placeholder="e.g. gpt-4o-mini"
                      className="w-full px-3.5 py-2 rounded-xl border border-[#2c2e3a] bg-[#0d0e11] text-xs font-medium text-[#f3f3ee] focus:border-[#cc785c] focus:outline-none"
                    />

                    <div className="flex flex-wrap gap-1.5 mt-2.5">
                      {OPENAI_MODELS.map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => updateProviderSettings('openai', { model: m.id })}
                          className={`px-2.5 py-1 rounded-lg text-xs font-mono transition-colors cursor-pointer ${
                            llmConfig.openai.model === m.id
                              ? 'bg-[#cc785c] text-white font-bold shadow-xs'
                              : 'border border-[#2c2e3a] hover:bg-[#1a1b22] text-[#9da0a8] hover:text-[#f3f3ee]'
                          }`}
                          title={m.desc}
                        >
                          {m.name}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* 3. DeepSeek */}
              <div
                className={`p-4 rounded-2xl border transition-all ${
                  llmConfig.activeProvider === 'deepseek'
                    ? 'border-[#cc785c] bg-[#cc785c]/10 shadow-xs'
                    : 'border-[#262833] bg-[#14151a]'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-[#cc785c]/15 text-[#cc785c] flex items-center justify-center font-bold text-sm">
                      D
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-[#f3f3ee]">
                        (DeepSeek)
                      </h3>
                      <p className="text-xs text-[#9da0a8]">
                        نماذج (DeepSeek-V3) و (DeepSeek-R1) للتفكير المعمق والبرمجة
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {llmConfig.activeProvider === 'deepseek' ? (
                      <span className="px-3 py-1 rounded-full text-xs font-semibold bg-[#cc785c] text-white flex items-center gap-1">
                        <CheckCircle className="w-3.5 h-3.5" />
                        النموذج النشط
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setActiveProvider('deepseek')}
                        className="px-3 py-1 rounded-full border border-[#2c2e3a] hover:bg-[#1a1b22] text-xs font-medium text-[#9da0a8] hover:text-[#f3f3ee] transition-colors cursor-pointer"
                      >
                        تفعيل (DeepSeek)
                      </button>
                    )}
                  </div>
                </div>

                <div className="space-y-4 pt-2">
                  <div>
                    <label className="block text-xs font-medium text-[#9da0a8] mb-1">
                      مفتاح (API Key) لـ (DeepSeek)
                    </label>
                    <input
                      type="password"
                      value={llmConfig.deepseek.apiKey}
                      onChange={(e) => updateProviderSettings('deepseek', { apiKey: e.target.value })}
                      placeholder="sk-..."
                      className="w-full px-3.5 py-2 rounded-xl border border-[#2c2e3a] bg-[#0d0e11] text-xs text-[#f3f3ee] focus:border-[#cc785c] focus:outline-none"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-medium text-[#9da0a8]">
                        اسم النموذج (قابل للتعديل - اكتب أي نموذج مخصص)
                      </label>
                      <span className="text-[11px] text-[#6b6e79]">
                        اكتب اسم النموذج أو اختر من القائمة
                      </span>
                    </div>

                    <input
                      type="text"
                      value={llmConfig.deepseek.model}
                      onChange={(e) => updateProviderSettings('deepseek', { model: e.target.value })}
                      placeholder="e.g. deepseek-chat"
                      className="w-full px-3.5 py-2 rounded-xl border border-[#2c2e3a] bg-[#0d0e11] text-xs font-medium text-[#f3f3ee] focus:border-[#cc785c] focus:outline-none"
                    />

                    <div className="flex flex-wrap gap-1.5 mt-2.5">
                      {DEEPSEEK_MODELS.map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => updateProviderSettings('deepseek', { model: m.id })}
                          className={`px-2.5 py-1 rounded-lg text-xs font-mono transition-colors cursor-pointer ${
                            llmConfig.deepseek.model === m.id
                              ? 'bg-[#cc785c] text-white font-bold shadow-xs'
                              : 'border border-[#2c2e3a] hover:bg-[#1a1b22] text-[#9da0a8] hover:text-[#f3f3ee]'
                          }`}
                          title={m.desc}
                        >
                          {m.name}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* 4. Custom (OpenAI-Compatible) */}
              <div
                className={`p-4 rounded-2xl border transition-all ${
                  llmConfig.activeProvider === 'custom'
                    ? 'border-[#cc785c] bg-[#cc785c]/10 shadow-xs'
                    : 'border-[#262833] bg-[#14151a]'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-[#cc785c]/15 text-[#cc785c] flex items-center justify-center font-bold text-sm">
                      C
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-[#f3f3ee]">
                        خادم مخصص متوافق مع (OpenAI) مثل (Groq, Ollama, vLLM)
                      </h3>
                      <p className="text-xs text-[#9da0a8]">
                        الاتصال بأي واجهة برمجية متوافقة مع نمط (OpenAI) محلياً أو سحابياً
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {llmConfig.activeProvider === 'custom' ? (
                      <span className="px-3 py-1 rounded-full text-xs font-semibold bg-[#cc785c] text-white flex items-center gap-1">
                        <CheckCircle className="w-3.5 h-3.5" />
                        النموذج النشط
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setActiveProvider('custom')}
                        className="px-3 py-1 rounded-full border border-[#2c2e3a] hover:bg-[#1a1b22] text-xs font-medium text-[#9da0a8] hover:text-[#f3f3ee] transition-colors cursor-pointer"
                      >
                        تفعيل المخصص
                      </button>
                    )}
                  </div>
                </div>

                <div className="space-y-4 pt-2">
                  <div>
                    <label className="block text-xs font-medium text-[#9da0a8] mb-1">
                      رابط نقطة النهاية (API Endpoint URL)
                    </label>
                    <input
                      type="text"
                      value={llmConfig.custom.endpoint}
                      onChange={(e) => updateProviderSettings('custom', { endpoint: e.target.value })}
                      placeholder="https://api.groq.com/openai/v1/chat/completions"
                      className="w-full px-3.5 py-2 rounded-xl border border-[#2c2e3a] bg-[#0d0e11] text-xs text-[#f3f3ee] focus:border-[#cc785c] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-[#9da0a8] mb-1">
                      مفتاح (API Key) (اختياري لخادم Ollama المحلي)
                    </label>
                    <input
                      type="password"
                      value={llmConfig.custom.apiKey}
                      onChange={(e) => updateProviderSettings('custom', { apiKey: e.target.value })}
                      placeholder="gsk_... or ollama"
                      className="w-full px-3.5 py-2 rounded-xl border border-[#2c2e3a] bg-[#0d0e11] text-xs text-[#f3f3ee] focus:border-[#cc785c] focus:outline-none"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-medium text-[#9da0a8]">
                        اسم النموذج (قابل للتعديل - اكتب أي نموذج مخصص)
                      </label>
                      <span className="text-[11px] text-[#6b6e79]">
                        اكتب اسم النموذج أو اختر من النماذج الشائعة
                      </span>
                    </div>

                    <input
                      type="text"
                      value={llmConfig.custom.model}
                      onChange={(e) => updateProviderSettings('custom', { model: e.target.value })}
                      placeholder="e.g. llama-3.3-70b-versatile"
                      className="w-full px-3.5 py-2 rounded-xl border border-[#2c2e3a] bg-[#0d0e11] text-xs font-medium text-[#f3f3ee] focus:border-[#cc785c] focus:outline-none"
                    />

                    <div className="flex flex-wrap gap-1.5 mt-2.5">
                      {CUSTOM_PRESETS.map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() =>
                            updateProviderSettings('custom', {
                              model: m.id,
                              endpoint: m.endpoint,
                            })
                          }
                          className={`px-2.5 py-1 rounded-lg text-xs font-mono transition-colors cursor-pointer ${
                            llmConfig.custom.model === m.id
                              ? 'bg-[#cc785c] text-white font-bold shadow-xs'
                              : 'border border-[#2c2e3a] hover:bg-[#1a1b22] text-[#9da0a8] hover:text-[#f3f3ee]'
                          }`}
                          title={m.desc}
                        >
                          {m.name}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ========================================================= */}
        {/* TAB 2: SYSTEM PROMPT (NEW TAB)                             */}
        {/* ========================================================= */}
        {activeTab === 'system-prompt' && (
          <section className="space-y-6">
            {/* Header & Actions */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-semibold text-[#f3f3ee] flex items-center gap-2">
                  <span>التعليمات التوجيهية للنظام</span>
                  <span className="text-[10px] px-2 py-0.5 rounded font-mono bg-[#14151a] text-[#cc785c] border border-[#2c2e3a]">
                    وضع متقدم
                  </span>
                </h2>
                <p className="text-xs text-[#9da0a8] mt-0.5">
                  تحديد القواعد السلوكية، وإرشادات الدقة ومكافحة الهلوسة، وتعليمات استدعاء الأدوات البرمجية.
                </p>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-auto">
                <button
                  type="button"
                  onClick={handleResetSystemPrompt}
                  className="px-3.5 py-2 rounded-xl border border-[#2c2e3a] hover:bg-[#1f2029] text-xs font-medium text-[#9da0a8] hover:text-[#f3f3ee] transition-colors flex items-center gap-1.5 cursor-pointer"
                  title="استعادة التوجيه الافتراضي"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>استعادة الافتراضي</span>
                </button>

                <button
                  type="button"
                  onClick={handleSaveSystemPrompt}
                  disabled={isSavingConfig}
                  className="px-4 py-2 rounded-xl bg-[#cc785c] hover:bg-[#be684e] text-white text-xs font-semibold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isSavingConfig ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  <span>حفظ التوجيه</span>
                </button>
              </div>
            </div>

            {/* Notification Banner */}
            {systemPromptMsg && (
              <div
                className={`p-3.5 rounded-2xl text-xs flex items-center justify-between transition-all ${
                  systemPromptMsg.type === 'success'
                    ? 'bg-emerald-950/40 border border-emerald-800/80 text-emerald-300'
                    : 'bg-red-950/40 border border-red-800/80 text-red-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  {systemPromptMsg.type === 'success' ? (
                    <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                  ) : (
                    <Trash2 className="w-4 h-4 text-red-400 shrink-0" />
                  )}
                  <span>{systemPromptMsg.text}</span>
                </div>
                {lastSavedAt && (
                  <span className="font-mono text-[11px] text-[#9da0a8]">Saved: {lastSavedAt}</span>
                )}
              </div>
            )}

            {/* Presets Quick Selector */}
            <div className="p-4 rounded-2xl border border-[#262833] bg-[#14151a] space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-[#9da0a8]">
                  قوالب سلوك الوكيل الجاهزة
                </span>
                <span className="text-[11px] text-[#6b6e79]">انقر لاختيار قالب جاهز</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {SYSTEM_PROMPT_PRESETS.map((preset) => {
                  const isSelected = editedSystemPrompt.trim() === preset.prompt.trim()
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => setEditedSystemPrompt(preset.prompt)}
                      className={`p-3 text-right rounded-xl border transition-all cursor-pointer ${
                        isSelected
                          ? 'border-[#cc785c] bg-[#cc785c]/10 text-[#f3f3ee]'
                          : 'border-[#262833] bg-[#191a22] hover:bg-[#20222c] hover:border-[#383a48] text-[#9da0a8] hover:text-[#f3f3ee]'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-semibold text-[#f3f3ee] flex items-center gap-1.5">
                          {isSelected && <Check className="w-3 h-3 text-[#cc785c]" />}
                          {preset.name}
                        </span>
                      </div>
                      <p className="text-[11px] text-[#8e919b] line-clamp-2 leading-relaxed">
                        {preset.description}
                      </p>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Prompt Code Editor Box */}
            <div className="p-4 rounded-2xl border border-[#262833] bg-[#14151a] space-y-3">
              <div className="flex items-center justify-between text-xs text-[#9da0a8] border-b border-[#262833] pb-3">
                <div className="flex items-center gap-2">
                  <FileCode className="w-3.5 h-3.5 text-[#cc785c]" />
                  <span className="font-mono text-xs text-[#f3f3ee]">system_prompt.md</span>
                </div>
                <div className="flex items-center gap-3 font-mono text-[11px]">
                  <span>{editedSystemPrompt.length.toLocaleString()} حرف</span>
                  <span>~{Math.round(editedSystemPrompt.length / 4).toLocaleString()} وحدة (Token)</span>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(editedSystemPrompt)
                      setSystemPromptMsg({ type: 'success', text: 'تم نسخ التوجيه إلى الحافظة بنجاح!' })
                      setTimeout(() => setSystemPromptMsg(null), 2500)
                    }}
                    className="p-1 text-[#9da0a8] hover:text-[#f3f3ee] hover:bg-[#22242e] rounded transition-colors cursor-pointer"
                    title="نسخ التوجيه"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <textarea
                value={editedSystemPrompt}
                onChange={(e) => setEditedSystemPrompt(e.target.value)}
                rows={16}
                className="w-full bg-transparent font-mono text-xs text-[#f3f3ee] leading-relaxed resize-y outline-none focus:ring-1 focus:ring-[#cc785c]/40 rounded-xl p-2"
                placeholder="اكتب تعليمات وتوجيهات النظام هنا..."
              />

              <div className="text-[11px] text-[#6b6e79] flex items-center justify-between pt-2 border-t border-[#262833]">
                <span>يتم تضمين هذا التوجيه في بداية كل محادثة ويحدد سلوك وقرارات النموذج بدقة.</span>
                <span className="font-mono text-[#cc785c]">UTF-8 • Markdown</span>
              </div>
            </div>

            {/* Interactive Live Playground */}
            <div className="p-4 rounded-2xl border border-[#262833] bg-[#14151a] space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-[#cc785c]" />
                  <h3 className="text-xs font-semibold text-[#f3f3ee]">
                    بيئة الاختبار والتجربة المباشرة للتوجيه
                  </h3>
                </div>
                <span className="text-[11px] font-mono text-[#9da0a8]">
                  المزود: <strong className="text-[#cc785c] uppercase">{llmConfig.activeProvider}</strong>
                </span>
              </div>

              <form onSubmit={handleTestSystemPrompt} className="flex gap-2">
                <div className="flex-1 relative flex items-center">
                  <span className="absolute right-3 text-[#cc785c] font-mono text-xs select-none">❯</span>
                  <input
                    type="text"
                    value={promptTestInput}
                    onChange={(e) => setPromptTestInput(e.target.value)}
                    placeholder="اكتب استفساراً لاختبار استجابة الوكيل وسلوكه مع هذا التوجيه..."
                    className="w-full pr-7 pl-3 py-2 rounded-xl bg-[#0f1014] border border-[#2c2e3a] text-xs text-[#f3f3ee] placeholder-[#6b6e79] focus:outline-none focus:border-[#cc785c] transition-colors"
                  />
                </div>

                <button
                  type="submit"
                  disabled={!promptTestInput.trim() || isTestingPrompt}
                  className="px-4 py-2 rounded-xl bg-[#20222c] hover:bg-[#282a36] border border-[#2c2e3a] text-xs font-medium text-[#f3f3ee] transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
                >
                  {isTestingPrompt ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-[#cc785c]" />
                      <span>جاري الاختبار...</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5 text-[#cc785c]" />
                      <span>بدء الاختبار</span>
                    </>
                  )}
                </button>
              </form>

              {promptTestOutput && (
                <div className="p-3.5 rounded-xl bg-[#0b0c0e] border border-[#262833] font-mono text-xs text-[#f3f3ee] whitespace-pre-wrap leading-relaxed">
                  <div className="text-[10px] text-[#6b6e79] uppercase tracking-wider mb-2 font-mono flex items-center justify-between">
                    <span>مخرجات الرد المباشر:</span>
                    {isTestingPrompt && <span className="text-[#cc785c] animate-pulse font-mono">جاري التدفق...</span>}
                  </div>
                  {promptTestOutput}
                  {isTestingPrompt && <span className="inline-block w-1.5 h-3.5 bg-[#cc785c] mr-1 animate-claude-cursor" />}
                </div>
              )}
            </div>
          </section>
        )}

        {/* ========================================================= */}
        {/* TAB 3: PERMANENT MEMORY                                   */}
        {/* ========================================================= */}
        {activeTab === 'memory' && (
          <section className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-[#f3f3ee]">
                  الذاكرة الدائمة (memory.txt)
                </h2>
                <p className="text-xs text-[#9da0a8] mt-1">
                  يتم تضمين هذا الملف النصي بشكل مستمر في سياق الوكيل الذكي، ويحتفظ تلقائياً ببياناتك وتفضيلاتك وسياق المشاريع الحالية.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleDownloadMemory}
                  className="px-3 py-1.5 rounded-xl border border-[#2c2e3a] hover:bg-[#1a1b22] text-xs font-medium text-[#9da0a8] hover:text-[#f3f3ee] transition-colors flex items-center gap-1.5 cursor-pointer"
                  title="تحميل كملف نصي"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>تحميل كملف</span>
                </button>

                <button
                  type="button"
                  onClick={handleResetMemory}
                  className="px-3 py-1.5 rounded-xl border border-red-900/40 hover:bg-red-950/30 text-xs font-medium text-red-400 transition-colors cursor-pointer"
                  title="إفراغ الذاكرة الدائمة"
                >
                  إفراغ الذاكرة
                </button>

                <button
                  type="button"
                  onClick={handleSaveMemory}
                  disabled={isSavingMemory}
                  className="px-4 py-1.5 rounded-xl bg-[#cc785c] hover:bg-[#be684e] text-white text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isSavingMemory ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  <span>حفظ الذاكرة</span>
                </button>
              </div>
            </div>

            {memorySavedSuccess && (
              <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-800 text-xs text-emerald-300 flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>تم تحديث ومزامنة الذاكرة الدائمة بنجاح عبر جميع الجلسات!</span>
              </div>
            )}

            <div className="p-4 rounded-2xl border border-[#262833] bg-[#14151a]">
              <textarea
                value={editedMemory}
                onChange={(e) => setEditedMemory(e.target.value)}
                rows={18}
                className="w-full bg-transparent font-mono text-xs text-[#f3f3ee] resize-y outline-none leading-relaxed"
                placeholder="اكتب تعليمات وسياق الذاكرة بصيغة Markdown هنا..."
              />
            </div>

            <div className="p-4 rounded-xl bg-[#16171d] border border-[#262833] text-xs text-[#9da0a8] space-y-1">
              <span className="font-semibold text-[#f3f3ee]">💡 التحديث الذاتي التفاعلي:</span>
              <p>
                يستطيع الوكيل الذكي تحديث هذا الملف تلقائياً أثناء المحادثة عند مشاركتك لمعلومات شخصية جديدة، أو تفضيلاتك في كتابة الشيفرات، أو تفاصيل مشاريعك.
              </p>
            </div>
          </section>
        )}

        {/* ========================================================= */}
        {/* TAB 4: MCP SERVERS                                        */}
        {/* ========================================================= */}
        {activeTab === 'mcp' && (
          <>
            {/* TickTick Integration Section */}
            <section className="space-y-4">
              <div>
                <h2 className="text-base font-semibold text-[#f3f3ee]">
                  التكامل مع (TickTick) عبر خادم (MCP)
                </h2>
                <p className="text-xs text-[#9da0a8] mt-1">
                  ربط حسابك الفعلي في (TickTick) لتمكين الوكيل الذكي من إنشاء وتصفح ومزامنة المهام مباشرة مع تطبيقك.
                </p>
              </div>

              <div className="p-5 rounded-2xl border border-[#262833] bg-[#14151a] shadow-xs">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3.5">
                    <div className="w-10 h-10 rounded-xl bg-[#cc785c]/15 text-[#cc785c] flex items-center justify-center font-bold text-base">
                      ✓
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-[#f3f3ee] flex items-center gap-2">
                        <span>خادم (TickTick MCP)</span>
                        <span
                          className={`text-[11px] px-2.5 py-0.5 rounded-full font-medium ${
                            isTickTickConnected
                              ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-800/60'
                              : 'bg-[#1e1f28] text-[#9da0a8] border border-[#2c2e3a]'
                          }`}
                        >
                          {isTickTickConnected ? 'متصل ومتزامن' : 'جاهز للربط'}
                        </span>
                      </h3>
                      <p className="text-xs text-[#9da0a8] mt-0.5">
                        رابط الخادم: <code>https://mcp.ticktick.com</code> (47 أداة متكاملة)
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {isTickTickConnected ? (
                      <>
                        <button
                          type="button"
                          onClick={handleTestTickTick}
                          disabled={isCreatingTickTickTask}
                          className="px-3.5 py-1.5 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium transition-colors flex items-center gap-1.5 disabled:opacity-50 shadow-xs cursor-pointer"
                        >
                          {isCreatingTickTickTask ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Plus className="w-3.5 h-3.5" />
                          )}
                          <span>إنشاء مهمة اختبارية في (TickTick)</span>
                        </button>
                        <button
                          type="button"
                          onClick={handleDisconnectTickTick}
                          className="px-3.5 py-1.5 rounded-full border border-red-900/40 text-red-400 hover:bg-red-950/30 text-xs font-medium transition-colors cursor-pointer"
                        >
                          قطع الاتصال
                        </button>
                      </>
                    ) : (
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={handleConnectTickTick}
                          className="px-4 py-2 rounded-lg bg-[#cc785c] hover:bg-[#be684e] text-white text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span>ربط الحساب عبر التوثيق السريع (OAuth)</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowManualTickTickInput(!showManualTickTickInput)}
                          className="px-3 py-2 rounded-lg border border-[#2c2e3a] text-xs text-[#9da0a8] hover:text-[#f3f3ee] hover:bg-[#1a1b22] transition-colors cursor-pointer"
                        >
                          {showManualTickTickInput ? 'إخفاء حقل المفتاح' : 'أو إدخال المفتاح (Token) يدوياً'}
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Manual Token Input */}
                {showManualTickTickInput && !isTickTickConnected && (
                  <div className="p-3 rounded-lg bg-[#0d0e11] border border-[#2c2e3a] space-y-2">
                    <div className="text-[11px] text-[#9da0a8]">
                      إذا كنت تواجه قيوداً في الـ OAuth، يمكنك نسخ مفتاح (API Token) مباشرة من إعدادات الويب في (TickTick):
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="password"
                        value={manualTickTickToken}
                        onChange={(e) => setManualTickTickToken(e.target.value)}
                        placeholder="الصق المفتاح (Token) هنا..."
                        className="flex-1 px-3 py-1.5 rounded-lg border border-[#2c2e3a] bg-[#14151a] text-xs text-[#f3f3ee] focus:border-[#cc785c] focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={handleSaveManualTickTickToken}
                        disabled={!manualTickTickToken.trim()}
                        className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium transition-colors disabled:opacity-50 flex items-center gap-1 cursor-pointer"
                      >
                        {manualTickTickSaved ? <Check className="w-3.5 h-3.5" /> : null}
                        <span>{manualTickTickSaved ? 'تم الحفظ!' : 'حفظ والاتصال'}</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Redirect URI Info */}
                <div className="mt-2 pt-2 border-t border-[#2c2e3a] text-[11px] text-[#6b6e79] flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                  <span>رابط إعادة التوجيه الفعّال (Redirect URL):</span>
                  <code className="px-2 py-0.5 rounded bg-[#0d0e11] text-[#cc785c] font-mono text-[10px] select-all border border-[#2c2e3a]">
                    {getRedirectUri()}
                  </code>
                </div>

                {tickTickSuccessMsg && (
                  <div className="mt-3 p-2.5 rounded-lg bg-emerald-950/40 border border-emerald-800 text-xs text-emerald-300 flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>{tickTickSuccessMsg}</span>
                  </div>
                )}
              </div>
            </section>

            {/* Supabase Integration Section */}
            <section className="space-y-4">
              <div>
                <h2 className="text-base font-semibold text-[#f3f3ee]">
                  التكامل مع (Supabase) — ربط مشروعك الخاص
                </h2>
                <p className="text-xs text-[#9da0a8] mt-1">
                  اربط مشروع Supabase الخاص بك ليتمكن الوكيل الذكي من استكشاف الجداول، قراءة البيانات، وتنفيذ الاستعلامات مباشرة داخله. البيانات تُحفظ محلياً في متصفحك فقط.
                </p>
              </div>

              <div className="p-4 rounded-lg border border-[#2c2e3a] bg-[#14151a] space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[#cc785c]/10 text-[#cc785c] flex items-center justify-center">
                      <Database className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-[#f3f3ee] flex items-center gap-2">
                        <span>خادم (Supabase MCP)</span>
                        <span
                          className={`text-[11px] px-2.5 py-0.5 rounded-full font-medium ${
                            isSupabaseConnected()
                              ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-800/60'
                              : 'bg-[#1e1f28] text-[#9da0a8] border border-[#2c2e3a]'
                          }`}
                        >
                          {isSupabaseConnected() ? 'متصل ومتزامن' : 'جاهز للربط'}
                        </span>
                      </h3>
                      <p className="text-xs text-[#9da0a8] mt-0.5">
                        رابط الخادم:{' '}
                        <code>{getSupabaseConnection()?.projectUrl || 'https://your-project.supabase.co'}</code>{' '}
                        (7 أدوات متكاملة)
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {isSupabaseConnected() ? (
                      <>
                        <button
                          type="button"
                          onClick={handleTestSupabase}
                          disabled={isTestingSupabase}
                          className="px-3.5 py-1.5 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium transition-colors flex items-center gap-1.5 disabled:opacity-50 shadow-xs cursor-pointer"
                        >
                          {isTestingSupabase ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Server className="w-3.5 h-3.5" />}
                          <span>اختبار الاتصال</span>
                        </button>
                        <button
                          type="button"
                          onClick={handleDisconnectSupabase}
                          className="px-3.5 py-1.5 rounded-full border border-red-900/40 text-red-400 hover:bg-red-950/30 text-xs font-medium transition-colors cursor-pointer"
                        >
                          قطع الاتصال
                        </button>
                      </>
                    ) : (
                      <span className="text-xs text-[#9da0a8]">أكمل البيانات بالأسفل ثم اضغط ربط</span>
                    )}
                  </div>
                </div>

                {supabaseStatusMsg && (
                  <div
                    className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                      supabaseStatusMsg.type === 'success'
                        ? 'bg-emerald-950/40 border border-emerald-800 text-emerald-300'
                        : 'bg-red-950/40 border border-red-800 text-red-300'
                    }`}
                  >
                    {supabaseStatusMsg.type === 'success' ? (
                      <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                    ) : (
                      <Trash2 className="w-4 h-4 text-red-400 shrink-0" />
                    )}
                    <span>{supabaseStatusMsg.text}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-[#9da0a8] mb-1">
                      رابط مشروع Supabase (Project URL) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="url"
                      value={supabaseUrl}
                      onChange={(e) => setSupabaseUrl(e.target.value)}
                      placeholder="https://abcdefg.supabase.co"
                      className="w-full px-3.5 py-2 rounded-xl border border-[#2c2e3a] bg-[#0d0e11] text-xs text-[#f3f3ee] focus:border-[#cc785c] focus:outline-none"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-[#9da0a8] mb-1">
                      مفتاح anon / publishable <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="password"
                      value={supabaseAnonKey}
                      onChange={(e) => setSupabaseAnonKey(e.target.value)}
                      placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                      className="w-full px-3.5 py-2 rounded-xl border border-[#2c2e3a] bg-[#0d0e11] text-xs text-[#f3f3ee] focus:border-[#cc785c] focus:outline-none"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-[#9da0a8] mb-1">
                      مفتاح Service Role{' '}
                      <span className="text-[10px] text-[#6b6e79]">(اختياري — يتيح الكتابة ويخطي RLS)</span>
                    </label>
                    <input
                      type="password"
                      value={supabaseServiceKey}
                      onChange={(e) => setSupabaseServiceKey(e.target.value)}
                      placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                      className="w-full px-3.5 py-2 rounded-xl border border-[#2c2e3a] bg-[#0d0e11] text-xs text-[#f3f3ee] focus:border-[#cc785c] focus:outline-none"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-[#9da0a8] mb-1">
                      Supabase Personal Access Token{' '}
                      <span className="text-[10px] text-[#6b6e79]">(اختياري — لتشغيل SQL حر عبر Management API)</span>
                    </label>
                    <input
                      type="password"
                      value={supabaseMgmtToken}
                      onChange={(e) => setSupabaseMgmtToken(e.target.value)}
                      placeholder="sbp_..."
                      className="w-full px-3.5 py-2 rounded-xl border border-[#2c2e3a] bg-[#0d0e11] text-xs text-[#f3f3ee] focus:border-[#cc785c] focus:outline-none"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleConnectSupabase}
                    disabled={isSupabaseConnected()}
                    className="px-4 py-2 rounded-full bg-[#cc785c] hover:bg-[#be684e] text-white text-xs font-semibold transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer disabled:opacity-40"
                  >
                    <Link2 className="w-3.5 h-3.5" />
                    <span>{isSupabaseConnected() ? 'مربوط بالفعل' : 'ربط مشروع Supabase'}</span>
                  </button>
                </div>

                <div className="p-3 rounded-xl bg-[#16171d] border border-[#262833] text-[10px] text-[#9da0a8] leading-relaxed space-y-1">
                  <p className="font-semibold text-[#f3f3ee]">💡 كيف يستخدمها الوكيل:</p>
                  <p>
                    بعد الربط، يتم تسجيل خادم <code>Supabase MCP</code> تلقائياً مع 7 أدوات: عرض الجداول، وصف الجدول،
                    الاستعلام، الإدراج، التحديث، الحذف، وتنفيذ SQL حر. اسأل الوكيل مثلاً: «اعرض لي جداول قاعدة البيانات
                    الخاصة بي» أو «اجلب آخر 10 مستخدمين من جدول users».
                  </p>
                </div>
              </div>
            </section>

            {/* Vercel MCP Integration Section */}
            <section className="space-y-4">
              <div>
                <h2 className="text-base font-semibold text-[#f3f3ee] flex items-center gap-2">
                  <span>التكامل مع (Vercel) عبر خادم (MCP)</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#1b1c24] text-[#9da0a8] border border-[#2c2e3a]">
                    https://mcp.vercel.com
                  </span>
                </h2>
                <p className="text-xs text-[#9da0a8] mt-1">
                  ربط حسابك ومشاريعك في Vercel مباشرة لإدارة النشر، فحص السجلات وتشخيص الأخطاء، استعلام تحليلات الويب، ومراقبة الوكلاء (Agent Runs).
                </p>
              </div>

              <div className="p-5 rounded-2xl border border-[#262833] bg-[#14151a] shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3.5">
                    <div className="w-10 h-10 rounded-xl bg-white/10 text-white flex items-center justify-center font-bold text-base shadow-xs">
                      ▲
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-[#f3f3ee] flex items-center gap-2">
                        <span>خادم (Vercel MCP)</span>
                        <span
                          className={`text-[11px] px-2.5 py-0.5 rounded-full font-medium ${
                            isVercelServerConnected
                              ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-800/60'
                              : 'bg-[#1e1f28] text-[#9da0a8] border border-[#2c2e3a]'
                          }`}
                        >
                          {isVercelServerConnected ? 'متصل ومتزامن' : 'جاهز للربط'}
                        </span>
                      </h3>
                      <p className="text-xs text-[#9da0a8] mt-0.5">
                        رابط الخادم: <code>https://mcp.vercel.com</code> (23+ أداة متكاملة)
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {isVercelServerConnected ? (
                      <>
                        <button
                          type="button"
                          onClick={handleTestVercel}
                          disabled={isTestingVercel}
                          className="px-3.5 py-1.5 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium transition-colors flex items-center gap-1.5 disabled:opacity-50 shadow-xs cursor-pointer"
                        >
                          {isTestingVercel ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Server className="w-3.5 h-3.5" />
                          )}
                          <span>اختبار الاتصال</span>
                        </button>
                        <button
                          type="button"
                          onClick={handleDisconnectVercel}
                          className="px-3.5 py-1.5 rounded-full border border-red-900/40 text-red-400 hover:bg-red-950/30 text-xs font-medium transition-colors cursor-pointer"
                        >
                          قطع الاتصال
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={handleConnectVercel}
                        disabled={isConnectingVercel || !vercelTokenInput.trim()}
                        className="px-4 py-2 rounded-full bg-[#cc785c] hover:bg-[#be684e] text-white text-xs font-semibold transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer disabled:opacity-40"
                      >
                        {isConnectingVercel ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Link2 className="w-3.5 h-3.5" />
                        )}
                        <span>حفظ والاتصال بـ Vercel MCP</span>
                      </button>
                    )}
                  </div>
                </div>

                {vercelStatusMsg && (
                  <div
                    className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                      vercelStatusMsg.type === 'success'
                        ? 'bg-emerald-950/40 border border-emerald-800 text-emerald-300'
                        : 'bg-red-950/40 border border-red-800 text-red-300'
                    }`}
                  >
                    {vercelStatusMsg.type === 'success' ? (
                      <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                    ) : (
                      <Trash2 className="w-4 h-4 text-red-400 shrink-0" />
                    )}
                    <span>{vercelStatusMsg.text}</span>
                  </div>
                )}

                {/* Token Input Section */}
                <div className="p-3.5 rounded-xl bg-[#0d0e11] border border-[#2c2e3a] space-y-2">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-[11px] text-[#9da0a8]">
                    <span>رمز الوصول الشخصي (Vercel Personal Access Token):</span>
                    <a
                      href="https://vercel.com/account/tokens"
                      target="_blank"
                      rel="noreferrer"
                      className="text-[#cc785c] hover:underline flex items-center gap-1 font-medium"
                    >
                      <span>إنشاء رمز جديد من لوحة تحكم Vercel</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="password"
                      value={vercelTokenInput}
                      onChange={(e) => setVercelTokenInput(e.target.value)}
                      placeholder="vercel_... أو الصق رمز الوصول الخاص بك هنا"
                      className="flex-1 px-3.5 py-2 rounded-xl border border-[#2c2e3a] bg-[#14151a] text-xs text-[#f3f3ee] focus:border-[#cc785c] focus:outline-none font-mono"
                    />
                    {!isVercelServerConnected && (
                      <button
                        type="button"
                        onClick={handleConnectVercel}
                        disabled={isConnectingVercel || !vercelTokenInput.trim()}
                        className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium transition-colors disabled:opacity-50 flex items-center gap-1.5 shrink-0 cursor-pointer shadow-xs"
                      >
                        {isConnectingVercel ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                        <span>ربط</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Interactive Tools Explorer */}
                <div className="border-t border-[#262833] pt-3">
                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => setShowVercelTools(!showVercelTools)}
                      className="text-xs text-[#cc785c] hover:text-[#f3f3ee] transition-colors flex items-center gap-1.5 font-medium cursor-pointer"
                    >
                      <span>{showVercelTools ? 'إخفاء مستعرض الأدوات' : `استعراض أدوات Vercel MCP المتوفرة (${VERCEL_MCP_TOOLS.length} أداة)`}</span>
                      {showVercelTools ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>
                    <span className="text-[11px] text-[#6b6e79]">
                      بروتوكول MCP قياسي عبر HTTPS
                    </span>
                  </div>

                  {showVercelTools && (
                    <div className="mt-3 space-y-3">
                      {/* Filter Chips */}
                      <div className="flex flex-wrap gap-1.5 text-[10px]">
                        {[
                          { id: 'all', label: 'الكل (23+)' },
                          { id: 'projects', label: 'المشاريع والفرق' },
                          { id: 'deployments', label: 'النشر والسجلات' },
                          { id: 'analytics', label: 'تحليلات الويب' },
                          { id: 'agent_runs', label: 'مراقبة الوكلاء' },
                          { id: 'domains', label: 'النطاقات والمشتريات' },
                          { id: 'toolbar', label: 'شريط الأدوات' },
                          { id: 'docs', label: 'التوثيق والـ CLI' },
                        ].map((cat) => (
                          <button
                            key={cat.id}
                            type="button"
                            onClick={() => setVercelCategoryFilter(cat.id)}
                            className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                              vercelCategoryFilter === cat.id
                                ? 'bg-[#cc785c] text-white font-medium'
                                : 'bg-[#1b1c24] text-[#9da0a8] hover:text-[#f3f3ee]'
                            }`}
                          >
                            {cat.label}
                          </button>
                        ))}
                      </div>

                      {/* Filtered Tools Grid */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-80 overflow-y-auto pr-1">
                        {VERCEL_MCP_TOOLS.filter((tool) => {
                          if (vercelCategoryFilter === 'projects')
                            return ['list_teams', 'list_projects', 'get_project'].includes(tool.name)
                          if (vercelCategoryFilter === 'deployments')
                            return [
                              'list_deployments',
                              'get_deployment',
                              'get_deployment_build_logs',
                              'get_runtime_logs',
                              'get_runtime_errors',
                              'deploy_to_vercel',
                            ].includes(tool.name)
                          if (vercelCategoryFilter === 'analytics')
                            return ['get_web_analytics'].includes(tool.name)
                          if (vercelCategoryFilter === 'agent_runs')
                            return [
                              'list_agent_run_projects',
                              'list_agent_runs',
                              'get_agent_run',
                              'get_agent_run_trace',
                            ].includes(tool.name)
                          if (vercelCategoryFilter === 'domains')
                            return [
                              'check_domain_availability_and_price',
                              'get_purchase_quote',
                              'buy_pro',
                              'buy_credits',
                              'buy_addon',
                              'buy_domain',
                              'get_domain_order',
                            ].includes(tool.name)
                          if (vercelCategoryFilter === 'toolbar')
                            return [
                              'list_toolbar_threads',
                              'get_toolbar_thread',
                              'change_toolbar_thread_resolve_status',
                              'reply_to_toolbar_thread',
                              'edit_toolbar_message',
                              'add_toolbar_reaction',
                            ].includes(tool.name)
                          if (vercelCategoryFilter === 'docs')
                            return [
                              'search_vercel_documentation',
                              'use_vercel_cli',
                              'get_access_to_vercel_url',
                              'web_fetch_vercel_url',
                              'import-claude-design-from-url',
                            ].includes(tool.name)
                          return true
                        }).map((tool) => (
                          <div
                            key={tool.name}
                            className="p-2.5 rounded-xl border border-[#22242c] bg-[#111216] space-y-1 text-right"
                          >
                            <div className="flex items-center justify-between">
                              <code className="text-[11px] text-[#cc785c] font-mono font-semibold">
                                {tool.name}
                              </code>
                              <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#1e1f28] text-[#9da0a8]">
                                Tool
                              </span>
                            </div>
                            <p className="text-[11px] text-[#9da0a8] leading-relaxed">
                              {tool.description}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="p-3 rounded-xl bg-[#16171d] border border-[#262833] text-[10px] text-[#9da0a8] leading-relaxed space-y-1">
                  <p className="font-semibold text-[#f3f3ee]">💡 كيف تستخدم Vercel MCP عبر المحادثة:</p>
                  <p>
                    بمجرد الربط، يمكنك توجيه الأسئلة والأوامر للوكيل مباشرة، مثل: «اعرض لي قائمة مشاريعي على Vercel»، «ما هي حالة آخر نشر لمشروعي؟»، «هل هناك أخطاء في الـ Runtime logs لآخر 24 ساعة؟»، «تحقق من سعر وتوفر النطاق example.com»، أو «ابحث في توثيق Vercel عن كيفية إعداد النطاقات المخصصة».
                  </p>
                </div>
              </div>
            </section>

            {/* GitHub MCP Integration Section */}
            <section className="space-y-4">
              <div>
                <h2 className="text-base font-semibold text-[#f3f3ee] flex items-center gap-2">
                  <span>التكامل مع (GitHub) عبر خادم (MCP)</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#1b1c24] text-[#9da0a8] border border-[#2c2e3a]">
                    https://api.githubcopilot.com/mcp/
                  </span>
                </h2>
                <p className="text-xs text-[#9da0a8] mt-1">
                  ربط حسابك ومستودعاتك في GitHub مباشرة لاستعراض الأكواد، قراءة الملفات، إدارة المشاكل (Issues)، متابعة طلبات السحب (PRs)، وفحص الـ CI/CD.
                </p>
              </div>

              <div className="p-5 rounded-2xl border border-[#262833] bg-[#14151a] shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3.5">
                    <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center font-bold text-base shadow-xs">
                      🐙
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-[#f3f3ee] flex items-center gap-2">
                        <span>خادم (GitHub MCP)</span>
                        <span
                          className={`text-[11px] px-2.5 py-0.5 rounded-full font-medium ${
                            isGitHubServerConnected
                              ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-800/60'
                              : 'bg-[#1e1f28] text-[#9da0a8] border border-[#2c2e3a]'
                          }`}
                        >
                          {isGitHubServerConnected ? 'متصل ومتزامن' : 'جاهز للربط'}
                        </span>
                      </h3>
                      <p className="text-xs text-[#9da0a8] mt-0.5">
                        رابط الخادم: <code>https://api.githubcopilot.com/mcp/</code> (40+ أداة متكاملة)
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {isGitHubServerConnected ? (
                      <>
                        <button
                          type="button"
                          onClick={handleTestGitHub}
                          disabled={isTestingGitHub}
                          className="px-3.5 py-1.5 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium transition-colors flex items-center gap-1.5 disabled:opacity-50 shadow-xs cursor-pointer"
                        >
                          {isTestingGitHub ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Server className="w-3.5 h-3.5" />
                          )}
                          <span>اختبار الاتصال</span>
                        </button>
                        <button
                          type="button"
                          onClick={handleDisconnectGitHub}
                          className="px-3.5 py-1.5 rounded-full border border-red-900/40 text-red-400 hover:bg-red-950/30 text-xs font-medium transition-colors cursor-pointer"
                        >
                          قطع الاتصال
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={handleConnectGitHub}
                        disabled={isConnectingGitHub || !gitHubTokenInput.trim()}
                        className="px-4 py-2 rounded-full bg-[#cc785c] hover:bg-[#be684e] text-white text-xs font-semibold transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer disabled:opacity-40"
                      >
                        {isConnectingGitHub ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Link2 className="w-3.5 h-3.5" />
                        )}
                        <span>حفظ والاتصال بـ GitHub MCP</span>
                      </button>
                    )}
                  </div>
                </div>

                {gitHubStatusMsg && (
                  <div
                    className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                      gitHubStatusMsg.type === 'success'
                        ? 'bg-emerald-950/40 border border-emerald-800 text-emerald-300'
                        : 'bg-red-950/40 border border-red-800 text-red-300'
                    }`}
                  >
                    {gitHubStatusMsg.type === 'success' ? (
                      <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                    ) : (
                      <Trash2 className="w-4 h-4 text-red-400 shrink-0" />
                    )}
                    <span>{gitHubStatusMsg.text}</span>
                  </div>
                )}

                {/* Token Input Section */}
                <div className="p-3.5 rounded-xl bg-[#0d0e11] border border-[#2c2e3a] space-y-2">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-[11px] text-[#9da0a8]">
                    <span>رمز الوصول الشخصي (GitHub Personal Access Token - Classic أو Fine-grained):</span>
                    <a
                      href="https://github.com/settings/tokens/new?scopes=repo,read:org,read:user,workflow"
                      target="_blank"
                      rel="noreferrer"
                      className="text-[#cc785c] hover:underline flex items-center gap-1 font-medium"
                    >
                      <span>إنشاء رمز جديد من إعدادات GitHub (مع صلاحيات repo, workflow, read:org)</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="password"
                      value={gitHubTokenInput}
                      onChange={(e) => setGitHubTokenInput(e.target.value)}
                      placeholder="ghp_... أو الصق رمز الوصول الخاص بك هنا"
                      className="flex-1 px-3.5 py-2 rounded-xl border border-[#2c2e3a] bg-[#14151a] text-xs text-[#f3f3ee] focus:border-[#cc785c] focus:outline-none font-mono"
                    />
                    {!isGitHubServerConnected && (
                      <button
                        type="button"
                        onClick={handleConnectGitHub}
                        disabled={isConnectingGitHub || !gitHubTokenInput.trim()}
                        className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium transition-colors disabled:opacity-50 flex items-center gap-1.5 shrink-0 cursor-pointer shadow-xs"
                      >
                        {isConnectingGitHub ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                        <span>ربط</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Interactive Tools Explorer */}
                <div className="border-t border-[#262833] pt-3">
                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => setShowGitHubTools(!showGitHubTools)}
                      className="text-xs text-[#cc785c] hover:text-[#f3f3ee] transition-colors flex items-center gap-1.5 font-medium cursor-pointer"
                    >
                      <span>{showGitHubTools ? 'إخفاء مستعرض الأدوات' : `استعراض أدوات GitHub MCP المتوفرة (${GITHUB_MCP_TOOLS.length} أداة)`}</span>
                      {showGitHubTools ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>
                    <span className="text-[11px] text-[#6b6e79]">
                      بروتوكول MCP قياسي عبر HTTPS
                    </span>
                  </div>

                  {showGitHubTools && (
                    <div className="mt-3 space-y-3">
                      {/* Filter Chips */}
                      <div className="flex flex-wrap gap-1.5 text-[10px]">
                        {[
                          { id: 'all', label: 'الكل (40+)' },
                          { id: 'repos', label: 'المستودعات والملفات' },
                          { id: 'issues', label: 'المشاكل (Issues)' },
                          { id: 'pulls', label: 'طلبات السحب (PRs)' },
                          { id: 'actions', label: 'العمليات (Actions)' },
                          { id: 'security', label: 'الأمان والتنبيهات' },
                          { id: 'community', label: 'المجتمع والنجوم' },
                          { id: 'context', label: 'السياق والتوثيق' },
                        ].map((cat) => (
                          <button
                            key={cat.id}
                            type="button"
                            onClick={() => setGitHubCategoryFilter(cat.id)}
                            className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                              gitHubCategoryFilter === cat.id
                                ? 'bg-[#cc785c] text-white font-medium'
                                : 'bg-[#1b1c24] text-[#9da0a8] hover:text-[#f3f3ee]'
                            }`}
                          >
                            {cat.label}
                          </button>
                        ))}
                      </div>

                      {/* Filtered Tools Grid */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-80 overflow-y-auto pr-1">
                        {GITHUB_MCP_TOOLS.filter((tool) => {
                          if (gitHubCategoryFilter === 'repos')
                            return [
                              'search_repositories',
                              'get_file_contents',
                              'create_or_update_file',
                              'delete_file',
                              'push_files',
                              'list_commits',
                              'get_commit',
                              'list_branches',
                              'create_branch',
                              'create_repository',
                              'fork_repository',
                              'list_releases',
                              'get_latest_release',
                              'list_tags',
                              'search_code',
                              'search_commits',
                              'get_repository_tree',
                              'list_repository_collaborators',
                            ].includes(tool.name)
                          if (gitHubCategoryFilter === 'issues')
                            return [
                              'list_issues',
                              'issue_read',
                              'issue_write',
                              'add_issue_comment',
                              'search_issues',
                              'list_label',
                              'label_write',
                            ].includes(tool.name)
                          if (gitHubCategoryFilter === 'pulls')
                            return [
                              'list_pull_requests',
                              'pull_request_read',
                              'create_pull_request',
                              'update_pull_request',
                              'merge_pull_request',
                              'search_pull_requests',
                              'add_reply_to_pull_request_comment',
                            ].includes(tool.name)
                          if (gitHubCategoryFilter === 'actions')
                            return [
                              'actions_list',
                              'actions_get',
                              'get_job_logs',
                              'actions_run_trigger',
                            ].includes(tool.name)
                          if (gitHubCategoryFilter === 'security')
                            return [
                              'list_code_scanning_alerts',
                              'list_dependabot_alerts',
                              'list_secret_scanning_alerts',
                            ].includes(tool.name)
                          if (gitHubCategoryFilter === 'community')
                            return [
                              'list_discussions',
                              'get_discussion',
                              'list_gists',
                              'get_gist',
                              'create_gist',
                              'list_starred_repositories',
                              'star_repository',
                              'list_notifications',
                            ].includes(tool.name)
                          if (gitHubCategoryFilter === 'context')
                            return [
                              'get_me',
                              'get_teams',
                              'search_users',
                              'search_orgs',
                              'github_support_docs_search',
                            ].includes(tool.name)
                          return true
                        }).map((tool) => (
                          <div
                            key={tool.name}
                            className="p-2.5 rounded-xl border border-[#22242c] bg-[#101115] hover:border-[#cc785c]/40 transition-colors"
                          >
                            <div className="flex items-center justify-between gap-1 mb-1">
                              <span className="font-mono text-xs font-semibold text-[#f3f3ee]">
                                {tool.name}
                              </span>
                              <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#1b1c24] text-[#6b6e79]">
                                أداة
                              </span>
                            </div>
                            <p className="text-[11px] text-[#9da0a8] leading-relaxed">
                              {tool.description}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="p-3 rounded-xl bg-[#16171d] border border-[#262833] text-[10px] text-[#9da0a8] leading-relaxed space-y-1">
                  <p className="font-semibold text-[#f3f3ee]">💡 كيف تستخدم GitHub MCP عبر المحادثة:</p>
                  <p>
                    بمجرد الربط، يمكنك توجيه الأسئلة والأوامر للوكيل مباشرة، مثل: «اعرض لي قائمة مستودعاتي في GitHub»، «هل توجد مشاكل (Issues) مفتوحة؟»، «ما هي آخر طلبات السحب (Pull Requests)؟»، «ابعتلي آخر الكوميتس لفرع main»، «اقرأ لي ملف README.md»، أو «ابحث في توثيق GitHub عن إعداد Actions».
                  </p>
                </div>
              </div>
            </section>

            {/* Connected MCP Servers List */}
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-semibold text-[#f3f3ee]">
                    خوادم الربط النشطة (MCP) ({servers.length})
                  </h2>
                  <p className="text-xs text-[#9da0a8] mt-1">
                    خوادم تمد الوكيل بقدرات استدعاء وتنفيذ الأدوات البرمجية المختلفة.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {!servers.some((s) => s.name.toLowerCase().includes('github') || s.service === 'github') && (
                    <button
                      type="button"
                      onClick={handleAddGitHubPreset}
                      className="px-3 py-1.5 rounded-full border border-purple-500/30 text-purple-300 hover:bg-purple-950/20 text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>إضافة خادم (GitHub MCP)</span>
                    </button>
                  )}

                  {!servers.some((s) => s.name.toLowerCase().includes('vercel') || s.service === 'vercel') && (
                    <button
                      type="button"
                      onClick={handleAddVercelPreset}
                      className="px-3 py-1.5 rounded-full border border-white/20 text-[#f3f3ee] hover:bg-white/10 text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>إضافة خادم (Vercel MCP)</span>
                    </button>
                  )}

                  {!servers.some((s) => s.name.includes('800 Academy')) && (
                    <button
                      type="button"
                      onClick={handleAdd800AcademyPreset}
                      className="px-3 py-1.5 rounded-full border border-[#cc785c]/40 text-[#cc785c] hover:bg-[#cc785c]/10 text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>إضافة خادم (800 Academy MCP)</span>
                    </button>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                {servers.map((server) => {
                  const isExpanded = expandedServerId === server.id
                  const toolsCount = server.tools?.length || 0

                  return (
                    <div
                      key={server.id}
                      className="p-4 rounded-2xl border border-[#262833] bg-[#14151a] shadow-xs"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-[#cc785c]/15 text-[#cc785c] flex items-center justify-center font-bold text-sm">
                            <Server className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="text-sm font-semibold text-[#f3f3ee]">
                                {server.name}
                              </h4>
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#1e1f28] text-[#9da0a8]">
                                {toolsCount} أدوات
                              </span>
                            </div>
                            <span className="text-xs text-[#9da0a8] block mt-0.5">
                              {server.url}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setExpandedServerId(isExpanded ? null : server.id)}
                            className="px-3 py-1.5 rounded-full border border-[#2c2e3a] hover:bg-[#1f2029] text-xs font-medium text-[#9da0a8] hover:text-[#f3f3ee] transition-colors flex items-center gap-1 cursor-pointer"
                          >
                            <span>{isExpanded ? 'إخفاء الأدوات' : 'عرض الأدوات'}</span>
                            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                          </button>

                          {server.url && (
                            <button
                              type="button"
                              onClick={() => handleDiscoverTools(server.id)}
                              disabled={discoveringServerId === server.id}
                              className="px-3 py-1.5 rounded-full border border-[#cc785c]/40 hover:bg-[#cc785c]/10 text-xs font-medium text-[#cc785c] transition-colors flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                              title="اكتشاف الأدوات تلقائياً"
                            >
                              {discoveringServerId === server.id && (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              )}
                              <span>اكتشاف تلقائي</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => disconnectServer(server.id)}
                            className="p-1.5 rounded-full border border-red-900/40 text-red-400 hover:bg-red-950/30 transition-colors cursor-pointer"
                            title="حذف الخادم"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {discoverySuccessMsg?.id === server.id && (
                        <div className="mt-3 p-2.5 rounded-xl bg-purple-950/40 border border-purple-800 text-xs text-purple-300 flex items-center gap-2">
                          <Check className="w-4 h-4 text-purple-400 shrink-0" />
                          <span>{discoverySuccessMsg.msg}</span>
                        </div>
                      )}

                      {/* Tools Accordion */}
                      {isExpanded && (
                        <div className="mt-3 pt-3 border-t border-[#262833] space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-[#f3f3ee]">
                              الأدوات المتاحة:
                            </span>
                            <button
                              type="button"
                              onClick={() => setAddingToolServerId(server.id)}
                              className="text-xs text-[#cc785c] hover:underline flex items-center gap-1 cursor-pointer"
                            >
                              <Plus className="w-3 h-3" />
                              <span>إضافة أداة يدوياً</span>
                            </button>
                          </div>

                          {/* Add Tool Form */}
                          {addingToolServerId === server.id && (
                            <div className="p-3 rounded-xl bg-[#0f1014] border border-[#262833] space-y-2">
                              <input
                                type="text"
                                value={newToolName}
                                onChange={(e) => setNewToolName(e.target.value)}
                                placeholder="اسم الأداة (مثال: read_blogs, create_task)"
                                className="w-full px-3 py-1.5 rounded-lg border border-[#2c2e3a] bg-[#14151a] text-xs text-[#f3f3ee]"
                              />
                              <input
                                type="text"
                                value={newToolDesc}
                                onChange={(e) => setNewToolDesc(e.target.value)}
                                placeholder="وصف الأداة ووظيفتها..."
                                className="w-full px-3 py-1.5 rounded-lg border border-[#2c2e3a] bg-[#14151a] text-xs text-[#f3f3ee]"
                              />
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={() => setAddingToolServerId(null)}
                                  className="px-2.5 py-1 text-xs text-[#9da0a8] hover:bg-[#1a1b22] rounded cursor-pointer"
                                >
                                  إلغاء
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleAddNewTool(server.id)}
                                  className="px-3 py-1 text-xs bg-[#cc785c] hover:bg-[#be684e] text-white rounded font-medium cursor-pointer"
                                >
                                  إضافة
                                </button>
                              </div>
                            </div>
                          )}

                          {/* Tools List */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-60 overflow-y-auto pr-1">
                            {server.tools && server.tools.length > 0 ? (
                              server.tools.map((tool, idx) => (
                                <div
                                  key={idx}
                                  className="p-2.5 rounded-xl border border-[#22242e] bg-[#0f1014] space-y-0.5"
                                >
                                  <div className="flex items-center justify-between">
                                    <code className="text-[11px] font-bold text-[#f3f3ee]">
                                      {tool.name}
                                    </code>
                                  </div>
                                  <p className="text-[10px] text-[#9da0a8] line-clamp-1">
                                    {tool.description}
                                  </p>
                                </div>
                              ))
                            ) : (
                              <div className="col-span-2 text-center py-3 text-xs text-[#6b6e79]">
                                لا توجد أدوات مسجلة لهذا الخادم بعد. انقر على "اكتشاف تلقائي" لتحميل الأدوات فورياً.
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </section>

            {/* Add Custom MCP Server Form */}
            <section className="space-y-4">
              <div>
                <h2 className="text-base font-semibold text-[#f3f3ee]">
                  إضافة خادم (MCP) مخصص
                </h2>
                <p className="text-xs text-[#9da0a8] mt-1">
                  ربط أي خادم (MCP) خارجي عبر رابط بروتوكول (HTTP / SSE).
                </p>
              </div>

              <div className="p-5 rounded-2xl border border-[#262833] bg-[#14151a] shadow-xs">
                <form onSubmit={handleAddCustomServer} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-[#9da0a8] mb-1">
                        اسم الخادم
                      </label>
                      <input
                        type="text"
                        value={customName}
                        onChange={(e) => setCustomName(e.target.value)}
                        placeholder="مثال: Analytics MCP"
                        className="w-full px-3.5 py-2 rounded-xl border border-[#2c2e3a] bg-[#0d0e11] text-xs text-[#f3f3ee] focus:border-[#cc785c] focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-[#9da0a8] mb-1">
                        رابط نقطة النهاية (Endpoint URL) <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="url"
                        required
                        value={customUrl}
                        onChange={(e) => setCustomUrl(e.target.value)}
                        placeholder="http://localhost:3000/mcp"
                        className="w-full px-3.5 py-2 rounded-xl border border-[#2c2e3a] bg-[#0d0e11] text-xs text-[#f3f3ee] focus:border-[#cc785c] focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-[#9da0a8] mb-1">
                      رمز التوثيق (Token) (اختياري)
                    </label>
                    <input
                      type="password"
                      value={customToken}
                      onChange={(e) => setCustomToken(e.target.value)}
                      placeholder="Bearer token or API key..."
                      className="w-full px-3.5 py-2 rounded-xl border border-[#2c2e3a] bg-[#0d0e11] text-xs text-[#f3f3ee] focus:border-[#cc785c] focus:outline-none"
                    />
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[11px] text-[#6b6e79]">
                      سيتم تفعيل الخادم وجلب الأدوات تلقائياً واستخدامها في المحادثة.
                    </span>

                    <button
                      type="submit"
                      disabled={!customUrl.trim() || isAddingCustom}
                      className="py-2 px-5 rounded-xl bg-[#cc785c] hover:bg-[#be684e] text-white text-xs font-semibold transition-colors disabled:opacity-50 shadow-xs flex items-center gap-1.5 cursor-pointer"
                    >
                      {isAddingCustom && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                      <span>{isAddingCustom ? 'جاري الاتصال...' : 'إضافة وتفعيل الخادم'}</span>
                    </button>
                  </div>
                </form>

                {customSuccess && (
                  <div className="text-xs text-emerald-400 flex items-center gap-1.5 pt-3">
                    <Check className="w-3.5 h-3.5" />
                    <span>تم ربط وتفعيل خادم (MCP) بنجاح!</span>
                  </div>
                )}
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  )
}
