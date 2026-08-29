import React, { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { discoverMcpToolsFromUrl } from '../lib/mcpClient'
import { clearTickTickToken } from '../lib/ticktick'
import { clearSupabaseConnection } from '../lib/supabaseConnector'

export interface McpToolDefinition {
  name: string
  description: string
  parameters?: Record<string, any>
  inputSchema?: Record<string, any>
}

export interface McpServer {
  id: string
  name: string
  url: string
  service: string
  status: 'disconnected' | 'connecting' | 'connected'
  isEnabled: boolean
  connectedAt?: string
  authToken?: string
  tools: McpToolDefinition[]
}

interface McpContextType {
  servers: McpServer[]
  connectServer: (serverData: {
    name: string
    url: string
    service?: string
    authToken?: string
    tools?: (string | McpToolDefinition)[]
    isEnabled?: boolean
  }) => Promise<void>
  disconnectServer: (id: string) => Promise<void>
  toggleServerEnabled: (id: string, enabled?: boolean) => Promise<void>
  addToolToServer: (serverId: string, tool: McpToolDefinition) => Promise<void>
  removeToolFromServer: (serverId: string, toolName: string) => Promise<void>
  discoverServerTools: (serverId: string) => Promise<{ success: boolean; count: number; tools: McpToolDefinition[] }>
  getServerByUrl: (url: string) => McpServer | undefined
  getServerByName: (name: string) => McpServer | undefined
}

const McpContext = createContext<McpContextType | undefined>(undefined)

const STORAGE_MCP_KEY = 'azal_connected_mcps'

export const TICKTICK_MCP_TOOLS: McpToolDefinition[] = [
  // 1. Task Queries (استعلامات المهام)
  { name: 'search_task', description: 'البحث عن المهام بالكلمات المفتاحية واسترجاع المعرفات والعناوين والروابط' },
  { name: 'get_task_by_id', description: 'استرجاع المحتوى والتفاصيل الكاملة لمهمة محددة عبر معرّفها (Task ID)' },
  { name: 'list_undone_tasks_by_time_query', description: 'عرض المهام غير المنجزة ضمن نطاق زمني محدد (today, last24hour, last7day, tomorrow, next24hour, next7day)' },
  { name: 'list_undone_tasks_by_date', description: 'عرض المهام غير المنجزة ضمن نطاق تاريخ محدد (حتى 14 يوماً)' },
  { name: 'list_completed_tasks_by_date', description: 'عرض المهام المنجزة داخل قائمة محددة ضمن نطاق تاريخ' },
  { name: 'filter_tasks', description: 'تصفية المهام وفق شروط متعددة مثل التاريخ، القائمة، الأولوية، الوسم، والحالة' },

  // 2. List Management (إدارة القوائم والمشاريع والمجلدات)
  { name: 'list_projects', description: 'استرجاع جميع القوائم والمشاريع المسجلة في الحساب الحالي' },
  { name: 'create_project', description: 'إنشاء قائمة أو مشروع جديد' },
  { name: 'update_project', description: 'تعديل إعدادات وخصائص قائمة أو مشروع موجود' },
  { name: 'delete_project', description: 'حذف قائمة أو مشروع نهائياً من TickTick (لا يمكن التراجع). المدخل المطلوب: projectId' },
  { name: 'get_project_by_id', description: 'استرجاع بيانات وتفاصيل قائمة محددة عبر المعرّف (List ID)' },
  { name: 'get_project_with_undone_tasks', description: 'استرجاع تفاصيل القائمة مع كافة المهام غير المنجزة داخلها' },
  { name: 'get_task_in_project', description: 'استرجاع مهمة محددة داخل قائمة معينة' },
  { name: 'list_columns', description: 'استرجاع جميع الأقسام (Sections/Columns) داخل قائمة محددة' },
  { name: 'create_column', description: 'إنشاء قسم جديد داخل قائمة محددة' },
  { name: 'update_column', description: 'إعادة تسمية أو تعديل قسم داخل قائمة محددة' },
  { name: 'list_project_groups', description: 'استرجاع كافة المجلدات ومجموعات المشاريع (Folders)' },
  { name: 'create_project_group', description: 'إنشاء مجلد جديد لتنظيم القوائم والمشاريع' },
  { name: 'update_project_group', description: 'إعادة تسمية مجلد مجموعات المشاريع' },
  { name: 'delete_project_group', description: 'حل أو حذف المجلد وإلغاء تجميع القوائم بداخله' },

  // 3. Task Management (إدارة وتعديل المهام والتعليقات والوسوم)
  { name: 'create_task', description: 'إنشاء مهمة جديدة بكافة الخصائص (العنوان، الوصف، التاريخ، الأولوية، القائمة، الوسوم)' },
  { name: 'batch_add_tasks', description: 'إضافة مجموعة مهام دفعة واحدة (Batch Create) مع تعيين حقول كل مهمة' },
  { name: 'complete_task', description: 'تحديد مهمة معينة كمنجزة' },
  { name: 'complete_tasks_in_project', description: 'تحديد عدة مهام في قائمة محددة كمنجزة دفعة واحدة (حتى 20 مهمة)' },
  { name: 'update_task', description: 'تعديل خصائص مهمة محددة (العنوان، الوصف، الموعد، الأولوية)' },
  { name: 'move_task', description: 'نقل مهمة من قائمة إلى قائمة أخرى' },
  { name: 'batch_update_tasks', description: 'تحديث خصائص عدة مهام دفعة واحدة' },
  { name: 'delete_task', description: 'حذف مهمة ونقلها إلى سلة المهملات' },
  { name: 'get_comment', description: 'استرجاع كافة التعليقات المسجلة على مهمة محددة' },
  { name: 'add_comment', description: 'إضافة تعليق جديد إلى مهمة محددة' },
  { name: 'delete_comment', description: 'حذف تعليق محدد من مهمة' },
  { name: 'assign_task', description: 'تعيين المهمة إلى عضو آخر في الفريق' },
  { name: 'unassign_task', description: 'إلغاء تعيين المهمة' },
  { name: 'project_member', description: 'عرض أعضاء القائمة أو المشروع المشترك' },
  { name: 'list_tags', description: 'استرجاع كافة الوسوم (Tags) المسجلة في الحساب' },
  { name: 'create_tag', description: 'إنشاء وسم جديد' },

  // 4. Habit Management (إدارة وتتبع العادات)
  { name: 'list_habits', description: 'استرجاع كافة العادات المسجلة في الحساب' },
  { name: 'list_habit_sections', description: 'استرجاع أقسام العادات في الحساب' },
  { name: 'create_habit', description: 'إنشاء عادة جديدة وتحديد إعداداتها' },
  { name: 'update_habit', description: 'تعديل إعدادات عادة موجودة' },
  { name: 'get_habit', description: 'استرجاع تفاصيل عادة محددة' },
  { name: 'get_habit_checkins', description: 'استرجاع سجلات تسجيل إنجاز عادة محددة' },
  { name: 'upsert_habit_checkins', description: 'تسجيل أو تحديث إنجاز عادة (Check-in) خلال الـ 90 يوماً الماضية' },

  // 5. Focus Record Management (سجلات وإدارة جلسات التركيز والبومودورو)
  { name: 'get_focuses_by_time', description: 'الاستعلام عن سجلات جلسات التركيز (Focus/Pomo) ضمن نطاق زمني حتى شهر' },
  { name: 'get_focus', description: 'استرجاع سجل تركيز محدد' },
  { name: 'create_focus', description: 'تسجيل جلسة تركيز جديدة' },
  { name: 'delete_focus', description: 'حذف سجل جلسة تركيز محدد' },

  // 6. Countdown (العدادات التنازلية)
  { name: 'list_countdowns', description: 'استرجاع كافة العدادات التنازلية (Countdowns) والمناسبات' },
]

// Default rich tool definitions for known services
export const SUPABASE_MCP_TOOLS: McpToolDefinition[] = [
  {
    name: 'supabase_list_tables',
    description:
      'استكشاف وعرض كافة جداول قاعدة بيانات Supabase الخاصة بالمستخدم (الاسم وأعمدة كل جدول). استخدمها أولاً لكي يعرف الوكيل هيكل قاعدة البيانات وأسماء الجداول المتاحة.',
  },
  {
    name: 'supabase_describe_table',
    description:
      'وصف تفصيلي لأعمدة جدول معين في Supabase (الأسماء والأنواع). المدخل المطلوب: table (اسم الجدول).',
  },
  {
    name: 'supabase_query_table',
    description:
      'قراءة واستعلام صفوف من جدول في Supabase عبر PostgREST. المدخلات: table (إلزامي)، select (الأعمدة، افتراضي *)، limit، order، وأي فلاتر PostgREST مثل status=eq.active أو created_at=gte.2024-01-01.',
  },
  {
    name: 'supabase_insert_row',
    description:
      'إدراج صف جديد في جدول Supabase. المدخلات: table (إلزامي)، row (كائن يحتوي بيانات الصف). يتطلب صلاحيات الكتابة.',
  },
  {
    name: 'supabase_update_row',
    description:
      'تحديث صفوف في جدول Supabase. المدخلات: table (إلزامي)، match (شرط التطابق مثل {id: 5})، patch (القيم الجديدة).',
  },
  {
    name: 'supabase_delete_row',
    description:
      'حذف صفوف من جدول Supabase. المدخلات: table (إلزامي)، match (شرط التطابق مثل {id: 5}).',
  },
  {
    name: 'supabase_run_sql',
    description:
      'تنفيذ أي استعلام SQL حر (SELECT/INSERT/UPDATE/DDL) داخل مشروع Supabase الخاص بالمستخدم عبر Management API. يتطلب إضافة Supabase Personal Access Token عند الربط. المدخل: sql (نص الاستعلام).',
  },
]

// Default rich tool definitions for known services
export const DEFAULT_TOOLS_BY_SERVICE: Record<string, McpToolDefinition[]> = {
  ticktick: TICKTICK_MCP_TOOLS,
  supabase: SUPABASE_MCP_TOOLS,
  '800 Academy': [
    { name: 'update_package', description: 'تعديل بيانات وسعر وحالة وصلاحية باقات واشتراكات المواد في نظام 800 Academy وإرسال التغييرات مباشرة للخادم' },
    { name: 'create_package', description: 'إنشاء وإضافة باقة أو اشتراك جديد لمادة في نظام 800 Academy وإرسالها مباشرة للخادم' },
    { name: 'get_packages', description: 'استرجاع كافة باقات واشتراكات الطلاب وعروض المواد مع المعرّفات (IDs)، الأسعار بالجنيه المصري (EGP)، وتواريخ الانتهاء' },
    { name: 'get_subjects', description: 'استعراض كافة المواد والمسارات الدراسية (EST 1 Literacy/Math, EST 2 Math, Digital SAT)' },
    { name: 'list_exams', description: 'استعراض كافة الامتحانات المتاحة في المنصة (أكثر من 40 امتحان مع أرقام الاختبارات والنقاط)' },
    { name: 'filter_questions', description: 'البحث والتصفية في بنك الأسئلة المركزي الموحد (النوع، الصعوبة، نص السؤال)' },
    { name: 'list_units', description: 'استعراض الوحدات الدراسية والمناهج (Heart of Algebra, Passport to Advanced Math)' },
    { name: 'get_system_status', description: 'فحص وتشخيص شامل لحالة المنصة وقاعدة البيانات وسرعة الاستجابة' },
  ],
  github: [
    { name: 'github_create_issue', description: 'إنشاء Issue جديد في مستودع محدد' },
    { name: 'github_list_repos', description: 'استعراض المستودعات الخاصة بك' },
    { name: 'github_create_pull_request', description: 'إنشاء طلب سحب (Pull Request) جديد' },
  ],
  notion: [
    { name: 'notion_create_page', description: 'إنشاء صفحة جديدة في مساحة عمل Notion' },
    { name: 'notion_search', description: 'البحث في قواعد البيانات والصفحات' },
    { name: 'notion_update_database', description: 'تحديث سجلات قاعدة بيانات Notion' },
  ],
  default: [
    { name: 'mcp_execute_tool', description: 'تنفيذ أمر أو إجراء مخصص على الخادم' },
    { name: 'mcp_query_resource', description: 'الاستعلام عن مورد أو قراءة بيانات من الخادم' },
  ],
}

// Initial pre-configured servers
const INITIAL_SERVERS: McpServer[] = [
  {
    id: 'mcp_800academy',
    name: '800 Academy MCP',
    url: 'http://localhost:3000/mcp',
    service: '800 Academy',
    status: 'connected',
    isEnabled: true,
    connectedAt: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
    tools: DEFAULT_TOOLS_BY_SERVICE['800 Academy'],
  },
]

// TickTick is surfaced as a connected MCP server (using its token API) so agents
// can discover AND call its tools. It is only injected when a token is present.
export const TICKTICK_SERVER: McpServer = {
  id: 'mcp_ticktick',
  name: 'TickTick MCP',
  url: '',
  service: 'ticktick',
  status: 'connected',
  isEnabled: true,
  connectedAt: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
  tools: TICKTICK_MCP_TOOLS,
}

// Supabase is surfaced as a connected MCP server so the agent can introspect and
// query the user's OWN Supabase project. Credentials are read live from the
// separate browser-only Supabase connection store (never persisted to our DB).
export const SUPABASE_SERVER: McpServer = {
  id: 'mcp_supabase',
  name: 'Supabase MCP',
  url: '',
  service: 'supabase',
  status: 'connected',
  isEnabled: true,
  connectedAt: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
  tools: SUPABASE_MCP_TOOLS,
}

function normalizeTools(rawTools: (string | McpToolDefinition)[] = []): McpToolDefinition[] {
  return rawTools.map((t) => {
    if (typeof t === 'string') {
      return {
        name: t,
        description: `أداة ${t} التابعة لخادم الـ MCP`,
      }
    }
    return t
  })
}

export const McpProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [servers, setServers] = useState<McpServer[]>([])

  useEffect(() => {
    // Load from local storage
    const saved = localStorage.getItem(STORAGE_MCP_KEY)
    let currentServers: McpServer[] = []

    if (saved !== null) {
      try {
        const parsed: any[] = JSON.parse(saved)
        currentServers = parsed.map((s) => ({
          ...s,
          isEnabled: s.isEnabled !== undefined ? s.isEnabled : true,
          tools: normalizeTools(s.tools || []),
        }))
      } catch (e) {
        console.error('Error parsing stored MCP servers:', e)
        currentServers = []
      }
    } else {
      // First-time visit only: initialize with default servers and persist
      currentServers = INITIAL_SERVERS
      localStorage.setItem(STORAGE_MCP_KEY, JSON.stringify(currentServers))
    }

    setServers(currentServers)

    // Background auto-discovery for servers with active URLs
    const autoDiscover = async () => {
      let hasChanges = false
      const updated = await Promise.all(
        currentServers.map(async (srv) => {
          if (srv.url && (srv.url.startsWith('http://') || srv.url.startsWith('https://'))) {
            try {
              const res = await discoverMcpToolsFromUrl(srv.url, srv.authToken)
              if (res.success && res.tools.length > 0 && res.tools.length !== srv.tools.length) {
                hasChanges = true
                return { ...srv, tools: res.tools }
              }
            } catch {
              // Ignore background discovery fail
            }
          }
          return srv
        })
      )

      if (hasChanges) {
        setServers(updated)
        localStorage.setItem(STORAGE_MCP_KEY, JSON.stringify(updated))
      }
    }

    autoDiscover()
  }, [])

  const saveServers = (updated: McpServer[]) => {
    setServers(updated)
    localStorage.setItem(STORAGE_MCP_KEY, JSON.stringify(updated))
  }

  const connectServer = async ({
    name,
    url,
    service = 'custom',
    authToken,
    tools,
    isEnabled = true,
  }: {
    name: string
    url: string
    service?: string
    authToken?: string
    tools?: (string | McpToolDefinition)[]
    isEnabled?: boolean
  }) => {
    const existingIndex = servers.findIndex(
      (s) => s.url.toLowerCase() === url.toLowerCase() || s.name.toLowerCase() === name.toLowerCase()
    )

    let matchedTools: McpToolDefinition[] = []

    // 1. If tools were explicitly passed, use them
    if (tools && tools.length > 0) {
      matchedTools = normalizeTools(tools)
    } else if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
      // 2. DYNAMIC MCP TOOL DISCOVERY: Query tools/list directly from the endpoint!
      try {
        const discovery = await discoverMcpToolsFromUrl(url, authToken)
        if (discovery.success && discovery.tools.length > 0) {
          matchedTools = discovery.tools
        }
      } catch (err) {
        console.warn('Auto discovery during connect failed:', err)
      }
    }

    // 3. Fallbacks if discovery returned empty
    if (matchedTools.length === 0) {
      if (name.includes('800') || service.includes('800')) {
        matchedTools = DEFAULT_TOOLS_BY_SERVICE['800 Academy']
      } else if (name.toLowerCase().includes('github') || service.toLowerCase().includes('github')) {
        matchedTools = DEFAULT_TOOLS_BY_SERVICE.github
      } else if (name.toLowerCase().includes('notion') || service.toLowerCase().includes('notion')) {
        matchedTools = DEFAULT_TOOLS_BY_SERVICE.notion
      } else if (name.toLowerCase().includes('tick') || service.toLowerCase().includes('tick')) {
        matchedTools = DEFAULT_TOOLS_BY_SERVICE.ticktick
      } else {
        matchedTools = DEFAULT_TOOLS_BY_SERVICE.default
      }
    }

    const newServer: McpServer = {
      id: existingIndex >= 0 ? servers[existingIndex].id : 'mcp_' + Date.now(),
      name: name.trim() || 'Custom MCP Server',
      url: url.trim(),
      service: service.trim(),
      status: 'connected',
      isEnabled,
      connectedAt: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
      authToken: authToken?.trim() || undefined,
      tools: matchedTools,
    }

    let updated: McpServer[]
    if (existingIndex >= 0) {
      updated = servers.map((s, idx) => (idx === existingIndex ? newServer : s))
    } else {
      updated = [...servers, newServer]
    }

    saveServers(updated)

    // Sync with Supabase if table exists
    try {
      await supabase.from('mcp_servers').upsert({
        id: newServer.id,
        name: newServer.name,
        url: newServer.url,
        service: newServer.service,
        status: newServer.status,
        is_enabled: newServer.isEnabled,
        connected_at: newServer.connectedAt,
        auth_token: newServer.authToken,
        tools: newServer.tools,
      })
    } catch {
      // Ignore Supabase error if table doesn't exist
    }
  }

  const discoverServerTools = async (
    serverId: string
  ): Promise<{ success: boolean; count: number; tools: McpToolDefinition[] }> => {
    const srv = servers.find((s) => s.id === serverId)
    if (!srv || !srv.url) {
      return { success: false, count: 0, tools: [] }
    }

    const res = await discoverMcpToolsFromUrl(srv.url, srv.authToken)
    if (res.success && res.tools.length > 0) {
      const updated = servers.map((s) => (s.id === serverId ? { ...s, tools: res.tools } : s))
      saveServers(updated)
      return { success: true, count: res.tools.length, tools: res.tools }
    }

    return { success: false, count: 0, tools: [] }
  }

  const disconnectServer = async (id: string) => {
    const target = servers.find((s) => s.id === id)

    // If removing TickTick server, also clear token so it does not resurrect
    if (id === 'mcp_ticktick' || target?.service === 'ticktick' || target?.name.toLowerCase().includes('tick')) {
      clearTickTickToken()
    }

    // If removing Supabase server, also clear credentials
    if (id === 'mcp_supabase' || target?.service === 'supabase' || target?.name.toLowerCase().includes('supabase')) {
      clearSupabaseConnection()
    }

    const updated = servers.filter((s) => s.id !== id)
    saveServers(updated)

    try {
      await supabase.from('mcp_servers').delete().eq('id', id)
    } catch {
      // Ignore
    }
  }

  const toggleServerEnabled = async (id: string, enabled?: boolean) => {
    const updated = servers.map((s) => {
      if (s.id === id) {
        const nextState = enabled !== undefined ? enabled : !s.isEnabled
        return { ...s, isEnabled: nextState }
      }
      return s
    })
    saveServers(updated)

    try {
      const target = updated.find((s) => s.id === id)
      if (target) {
        await supabase.from('mcp_servers').update({ is_enabled: target.isEnabled }).eq('id', id)
      }
    } catch {
      // Ignore
    }
  }

  const addToolToServer = async (serverId: string, tool: McpToolDefinition) => {
    const updated = servers.map((s) => {
      if (s.id === serverId) {
        const exists = s.tools.some((t) => t.name === tool.name)
        if (exists) return s
        return { ...s, tools: [...s.tools, tool] }
      }
      return s
    })
    saveServers(updated)
  }

  const removeToolFromServer = async (serverId: string, toolName: string) => {
    const updated = servers.map((s) => {
      if (s.id === serverId) {
        return { ...s, tools: s.tools.filter((t) => t.name !== toolName) }
      }
      return s
    })
    saveServers(updated)
  }

  const getServerByUrl = (url: string) => servers.find((s) => s.url.toLowerCase() === url.toLowerCase())
  const getServerByName = (name: string) => servers.find((s) => s.name.toLowerCase() === name.toLowerCase())

  return (
    <McpContext.Provider
      value={{
        servers,
        connectServer,
        disconnectServer,
        toggleServerEnabled,
        addToolToServer,
        removeToolFromServer,
        discoverServerTools,
        getServerByUrl,
        getServerByName,
      }}
    >
      {children}
    </McpContext.Provider>
  )
}

export const useMcp = () => {
  const context = useContext(McpContext)
  if (!context) {
    throw new Error('useMcp must be used within an McpProvider')
  }
  return context
}
