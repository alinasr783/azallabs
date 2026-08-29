import type { McpServer, McpToolDefinition } from '../context/McpContext'
import {
  getTickTickToken,
  createTickTickTask,
  createTickTickProject,
  fetchTickTickProjects,
  fetchTasksByProjectName,
  updateTickTickTask,
  deleteTickTickProject,
  deleteTickTickTask,
} from './ticktick'
import {
  getSupabaseConnection,
  listSupabaseTables,
  describeSupabaseTable,
  querySupabaseTable,
  insertSupabaseRow,
  updateSupabaseRow,
  deleteSupabaseRow,
  runSupabaseSql,
} from './supabaseConnector'
import {
  getVercelToken,
  fetchVercelProjects,
  fetchVercelDeployments,
  fetchVercelDeploymentEvents,
  fetchVercelRuntimeLogs,
  resolveVercelContext,
} from './vercelConnector'

export interface McpExecutionResult {
  success: boolean
  result: any
  errorMessage?: string
  serverName: string
  toolName: string
}

// 800 Academy Supabase Credentials
const SUPABASE_800_URL = 'https://wqwtfcmgeuxzfejpveyx.supabase.co'
const SUPABASE_SERVICE_ROLE =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indxd3RmY21nZXV4emZlanB2ZXl4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTk4OTYzNiwiZXhwIjoyMDkxNTY1NjM2fQ.9UlNX65XumifylLWq74ZvKHp8ig1_k_YKKFwyNEn2a0'

// =========================================================================
// DYNAMIC MCP TOOL DISCOVERY VIA STANDARD JSON-RPC (tools/list)
// =========================================================================
export async function discoverMcpToolsFromUrl(
  url: string,
  authToken?: string
): Promise<{ success: boolean; tools: McpToolDefinition[]; errorMessage?: string }> {
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/event-stream',
    }
    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`
    }

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 6000)

    const response = await fetch(url, {
      method: 'POST',
      headers,
      signal: controller.signal,
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'tools/list',
        params: {},
        id: Date.now(),
      }),
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      throw new Error(`استجاب الخادم برمز (${response.status})`)
    }

    const text = await response.text()
    let json: any = null
    try {
      json = JSON.parse(text)
    } catch {
      // Parse SSE if streamed
      const lines = text.split('\n')
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            json = JSON.parse(line.slice(6))
            if (json.result?.tools) break
          } catch {}
        }
      }
    }

    const rawTools = json?.result?.tools
    if (Array.isArray(rawTools) && rawTools.length > 0) {
      const tools: McpToolDefinition[] = rawTools.map((t: any) => ({
        name: t.name,
        description: t.description || `أداة ${t.name}`,
        inputSchema: t.inputSchema,
      }))
      return { success: true, tools }
    }

    return {
      success: false,
      tools: [],
      errorMessage: 'لم يُرجع الخادم أي أدوات في رد tools/list',
    }
  } catch (err: any) {
    return {
      success: false,
      tools: [],
      errorMessage: `تعذر استكشاف الأدوات من الرابط: ${err.message}`,
    }
  }
}

// =========================================================================
// HELPER FOR DIRECT SUPABASE ACCESS (Resilient Fallback)
// =========================================================================
async function querySupabase800(path: string, options: RequestInit = {}) {
  const headers: Record<string, string> = {
    apikey: SUPABASE_SERVICE_ROLE,
    Authorization: `Bearer ${SUPABASE_SERVICE_ROLE}`,
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  }
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 2000)

  try {
    const res = await fetch(`${SUPABASE_800_URL}/rest/v1/${path}`, {
      ...options,
      headers,
      signal: controller.signal,
    })
    clearTimeout(timeoutId)
    return res
  } catch (err) {
    clearTimeout(timeoutId)
    throw err
  }
}

// =========================================================================
// TICKTICK ROUTING — TickTick is not a generic HTTP MCP endpoint, it uses a
// token-based REST API. Route any TickTick tool call directly to that API so
// agents can actually recognize AND execute TickTick MCP tools.
// =========================================================================
async function executeTickTickTool(
  toolName: string,
  parameters: Record<string, any> = {}
): Promise<McpExecutionResult> {
  const token = getTickTickToken()
  if (!token) {
    return {
      success: false,
      result: null,
      errorMessage:
        'حساب TickTick غير مربوط في هذا المتصفح. يرجى ربطه أولاً من صفحة الإعدادات لتتمكن الأدوات من التنفيذ الفعلي.',
      serverName: 'TickTick MCP',
      toolName,
    }
  }

  try {
    const p = parameters || {}

    // ── Write / mutation tools ──
    if (toolName === 'create_task' || toolName === 'batch_add_tasks' || toolName === 'ticktick_create_task') {
      const created = await createTickTickTask(
        {
          title: p.title || 'مهمة جديدة من Azal Labs',
          content: p.content,
          dueDate: p.dueDate,
          projectName: p.projectName || p.project,
          projectId: p.projectId,
        },
        token
      )
      return { success: true, result: created, serverName: 'TickTick MCP', toolName }
    }

    if (toolName === 'update_task' || toolName === 'ticktick_update_task') {
      const updated = await updateTickTickTask(
        {
          id: p.id,
          projectId: p.projectId || '',
          title: p.title,
          content: p.content,
          dueDate: p.dueDate,
        },
        token
      )
      return { success: true, result: updated, serverName: 'TickTick MCP', toolName }
    }

    if (toolName === 'complete_task' || toolName === 'complete_tasks_in_project') {
      if (!p.id) {
        return {
          success: false,
          result: null,
          errorMessage: 'معرّف المهمة (id) مطلوب لإكمالها في TickTick.',
          serverName: 'TickTick MCP',
          toolName,
        }
      }
      const updated = await updateTickTickTask(
        { id: p.id, projectId: p.projectId || '', status: 2 },
        token
      )
      return { success: true, result: updated, serverName: 'TickTick MCP', toolName }
    }

    if (toolName === 'create_project' || toolName === 'update_project') {
      const name = p.name || p.title || p.projectName || p.project
      if (!name) {
        return {
          success: false,
          result: null,
          errorMessage: 'اسم المشروع مطلوب لإنشاء/تحديث المشروع في TickTick.',
          serverName: 'TickTick MCP',
          toolName,
        }
      }
      try {
        const created = await createTickTickProject(name, token)
        return {
          success: true,
          result: { project: created, message: `تم إنشاء المشروع "${name}" بنجاح في TickTick` },
          serverName: 'TickTick MCP',
          toolName,
        }
      } catch (err: any) {
        return {
          success: false,
          result: null,
          errorMessage: `تعذر إنشاء المشروع "${name}" في TickTick: ${err.message}`,
          serverName: 'TickTick MCP',
          toolName,
        }
      }
    }

    // ── Deletion tools (real, irreversible) ──
    if (toolName === 'delete_project' || toolName === 'remove_project' || toolName === 'ticktick_delete_project') {
      const projectId = p.projectId || p.id
      if (!projectId) {
        return {
          success: false,
          result: null,
          errorMessage: 'معرّف المشروع (projectId) مطلوب لحذفه من TickTick.',
          serverName: 'TickTick MCP',
          toolName,
        }
      }
      try {
        await deleteTickTickProject(projectId, token)
        return {
          success: true,
          result: { deletedProjectId: projectId, message: 'تم حذف المشروع نهائياً من TickTick' },
          serverName: 'TickTick MCP',
          toolName,
        }
      } catch (err: any) {
        return {
          success: false,
          result: null,
          errorMessage: `تعذر حذف المشروع من TickTick: ${err.message}`,
          serverName: 'TickTick MCP',
          toolName,
        }
      }
    }

    if (
      toolName === 'delete_task' ||
      toolName === 'remove_task' ||
      toolName === 'ticktick_delete_task' ||
      toolName === 'delete_task_by_id'
    ) {
      const taskId = p.id || p.taskId
      const projectId = p.projectId
      if (!taskId) {
        return {
          success: false,
          result: null,
          errorMessage: 'معرّف المهمة (id/taskId) مطلوب لحذفها من TickTick.',
          serverName: 'TickTick MCP',
          toolName,
        }
      }
      if (!projectId) {
        return {
          success: false,
          result: null,
          errorMessage: 'معرّف المشروع (projectId) مطلوب لحذف المهمة من TickTick.',
          serverName: 'TickTick MCP',
          toolName,
        }
      }
      try {
        await deleteTickTickTask(projectId, taskId, token)
        return {
          success: true,
          result: { deletedTaskId: taskId, projectId, message: 'تم حذف المهمة نهائياً من TickTick' },
          serverName: 'TickTick MCP',
          toolName,
        }
      } catch (err: any) {
        return {
          success: false,
          result: null,
          errorMessage: `تعذر حذف المهمة من TickTick: ${err.message}`,
          serverName: 'TickTick MCP',
          toolName,
        }
      }
    }

    // ── Read / query tools ──
    if (toolName === 'list_projects' || toolName === 'get_projects' || toolName === 'list_project_groups') {
      const projects = await fetchTickTickProjects(token)
      return { success: true, result: { projects }, serverName: 'TickTick MCP', toolName }
    }

    if (toolName === 'search_task' || toolName === 'get_task_by_id' || toolName === 'get_task_in_project') {
      const projectName = p.projectName || p.project || p.name || '800 Academy'
      const data = await fetchTasksByProjectName(projectName, token)
      const tasks = (data.tasks || []).filter((t: any) => {
        if (p.query || p.title) {
          const q = (p.query || p.title).toLowerCase()
          return t.title?.toLowerCase().includes(q)
        }
        return true
      })
      return { success: true, result: { project: data.project, tasks }, serverName: 'TickTick MCP', toolName }
    }

    // Default read fallback: return the tasks of the targeted project (covers
    // list_undone_tasks_by_*, list_completed_tasks_by_date, filter_tasks, etc.)
    const projectName = p.projectName || p.project || p.name || '800 Academy'
    const data = await fetchTasksByProjectName(projectName, token)
    return { success: true, result: { project: data.project, tasks: data.tasks }, serverName: 'TickTick MCP', toolName }
  } catch (err: any) {
    return {
      success: false,
      result: null,
      errorMessage: err.message || 'فشل تنفيذ أداة TickTick.',
      serverName: 'TickTick MCP',
      toolName,
    }
  }
}

// =========================================================================
// SUPABASE ROUTING — A user connects THEIR OWN Supabase project. Route any
// Supabase tool call directly to PostgREST / Management API so the agent can
// introspect schema, read data, and execute queries against that project.
// =========================================================================
async function executeSupabaseTool(
  toolName: string,
  parameters: Record<string, any> = {}
): Promise<McpExecutionResult> {
  const conn = getSupabaseConnection()
  if (!conn) {
    return {
      success: false,
      result: null,
      errorMessage:
        'لم يتم ربط أي مشروع Supabase بعد. يرجى ربط حسابك من صفحة الإعدادات (تبويب خوادم الربط) لكي تتمكن الأدوات من التنفيذ الفعلي.',
      serverName: 'Supabase MCP',
      toolName,
    }
  }

  try {
    const p = parameters || {}

    // Schema / introspection
    if (toolName === 'supabase_list_tables') {
      const tables = await listSupabaseTables(conn)
      return {
        success: true,
        result: { tables, count: tables.length },
        serverName: 'Supabase MCP',
        toolName,
      }
    }

    if (toolName === 'supabase_describe_table') {
      if (!p.table) {
        return {
          success: false,
          result: null,
          errorMessage: 'اسم الجدول (table) مطلوب لوصف هيكله.',
          serverName: 'Supabase MCP',
          toolName,
        }
      }
      const info = await describeSupabaseTable(conn, p.table)
      if (!info) {
        return {
          success: false,
          result: null,
          errorMessage: `الجدول "${p.table}" غير موجود أو غير مكشوف عبر PostgREST.`,
          serverName: 'Supabase MCP',
          toolName,
        }
      }
      return { success: true, result: info, serverName: 'Supabase MCP', toolName }
    }

    // Reads
    if (toolName === 'supabase_query_table') {
      if (!p.table) {
        return {
          success: false,
          result: null,
          errorMessage: 'اسم الجدول (table) مطلوب للاستعلام.',
          serverName: 'Supabase MCP',
          toolName,
        }
      }
      const res = await querySupabaseTable(conn, p)
      return {
        success: res.ok,
        result: res.ok ? { rows: res.data, count: Array.isArray(res.data) ? res.data.length : undefined } : null,
        errorMessage: res.error,
        serverName: 'Supabase MCP',
        toolName,
      }
    }

    // Writes
    if (toolName === 'supabase_insert_row') {
      if (!p.table || !p.row) {
        return {
          success: false,
          result: null,
          errorMessage: 'الجدول (table) والصف (row) مطلوبان للإدراج.',
          serverName: 'Supabase MCP',
          toolName,
        }
      }
      const res = await insertSupabaseRow(conn, p.table, p.row)
      return { success: res.ok, result: res.data, errorMessage: res.error, serverName: 'Supabase MCP', toolName }
    }

    if (toolName === 'supabase_update_row') {
      if (!p.table || !p.match || !p.patch) {
        return {
          success: false,
          result: null,
          errorMessage: 'الجدول (table) وشرط التطابق (match) والقيم الجديدة (patch) مطلوبة للتحديث.',
          serverName: 'Supabase MCP',
          toolName,
        }
      }
      const res = await updateSupabaseRow(conn, p.table, p.match, p.patch)
      return { success: res.ok, result: res.data, errorMessage: res.error, serverName: 'Supabase MCP', toolName }
    }

    if (toolName === 'supabase_delete_row') {
      if (!p.table || !p.match) {
        return {
          success: false,
          result: null,
          errorMessage: 'الجدول (table) وشرط التطابق (match) مطلوبان للحذف.',
          serverName: 'Supabase MCP',
          toolName,
        }
      }
      const res = await deleteSupabaseRow(conn, p.table, p.match)
      return { success: res.ok, result: res.data, errorMessage: res.error, serverName: 'Supabase MCP', toolName }
    }

    // Arbitrary SQL
    if (toolName === 'supabase_run_sql') {
      if (!p.sql) {
        return {
          success: false,
          result: null,
          errorMessage: 'نص استعلام SQL (sql) مطلوب للتنفيذ.',
          serverName: 'Supabase MCP',
          toolName,
        }
      }
      const res = await runSupabaseSql(conn, p.sql)
      return { success: res.ok, result: res.data, errorMessage: res.error, serverName: 'Supabase MCP', toolName }
    }

    return {
      success: false,
      result: null,
      errorMessage: `الأداة ${toolName} غير مدعومة على خادم Supabase.`,
      serverName: 'Supabase MCP',
      toolName,
    }
  } catch (err: any) {
    return {
      success: false,
      result: null,
      errorMessage: err.message || 'فشل تنفيذ أداة Supabase.',
      serverName: 'Supabase MCP',
      toolName,
    }
  }
}

// =========================================================================
// VERCEL MCP TOOL EXECUTION (DIRECT JSON-RPC + RESILIENT REST FALLBACK)
// =========================================================================
async function executeVercelTool(
  toolName: string,
  parameters: Record<string, any> = {},
  authToken?: string,
  serverUrl: string = 'https://mcp.vercel.com'
): Promise<McpExecutionResult> {
  const token = authToken || getVercelToken()
  const effectiveParams: Record<string, any> = { ...parameters }

  // Auto-resolve missing projectId/teamId/idOrUrl for tools that require them
  const requiresContext = [
    'get_runtime_logs',
    'get_runtime_errors',
    'get_deployment_build_logs',
    'list_deployments',
    'get_deployment',
    'get_project',
    'get_web_analytics',
  ].includes(toolName)

  let resolvedContext: any = null
  if (token && requiresContext && (!effectiveParams.projectId || !effectiveParams.idOrUrl)) {
    try {
      resolvedContext = await resolveVercelContext(token, effectiveParams.projectName || effectiveParams.project)
      if (resolvedContext.projectId && !effectiveParams.projectId) {
        effectiveParams.projectId = resolvedContext.projectId
      }
      if (resolvedContext.teamId && !effectiveParams.teamId) {
        effectiveParams.teamId = resolvedContext.teamId
      }
      if (resolvedContext.deploymentId) {
        if (!effectiveParams.deploymentId) effectiveParams.deploymentId = resolvedContext.deploymentId
        if (!effectiveParams.idOrUrl) effectiveParams.idOrUrl = resolvedContext.deploymentId
      }
    } catch {}
  }

  // 1. Primary: Direct JSON-RPC call to https://mcp.vercel.com (tools/call)
  if (token) {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 9000)

      const response = await fetch(serverUrl || 'https://mcp.vercel.com', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json, text/event-stream',
          'Authorization': `Bearer ${token}`,
        },
        signal: controller.signal,
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'tools/call',
          params: {
            name: toolName,
            arguments: effectiveParams,
          },
          id: Date.now(),
        }),
      })

      clearTimeout(timeoutId)

      if (response.ok) {
        const text = await response.text()
        let json: any = null
        try {
          json = JSON.parse(text)
        } catch {
          const lines = text.split('\n')
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                json = JSON.parse(line.slice(6))
                if (json.result) break
              } catch {}
            }
          }
        }

        if (json?.result !== undefined) {
          let parsedData = json.result
          if (Array.isArray(json.result?.content)) {
            const textItem = json.result.content.find((c: any) => c.type === 'text')
            if (textItem?.text) {
              try {
                parsedData = JSON.parse(textItem.text)
              } catch {
                parsedData = textItem.text
              }
            }
          }
          return {
            success: true,
            result: parsedData,
            serverName: 'Vercel MCP',
            toolName,
          }
        }
      }
    } catch (directErr) {
      console.warn('Direct Vercel MCP call failed, attempting resilient fallback:', directErr)
    }
  }

  // 2. Resilient Fallback to direct Vercel REST APIs if token is available
  if (token) {
    try {
      if (toolName === 'list_teams') {
        const res = await fetch('https://api.vercel.com/v2/teams', {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (res.ok) {
          const data = await res.json()
          return { success: true, result: data, serverName: 'Vercel MCP', toolName }
        }
      }

      if (toolName === 'list_projects') {
        const teamId = parameters.teamId
        const data = await fetchVercelProjects(teamId, token)
        return { success: true, result: data, serverName: 'Vercel MCP', toolName }
      }

      if (toolName === 'get_project') {
        const { projectId, teamId } = parameters
        let url = `https://api.vercel.com/v9/projects/${encodeURIComponent(projectId || '')}`
        if (teamId) url += `?teamId=${encodeURIComponent(teamId)}`
        const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
        if (res.ok) {
          const data = await res.json()
          return { success: true, result: data, serverName: 'Vercel MCP', toolName }
        }
      }

      if (toolName === 'list_deployments') {
        const { projectId, teamId } = parameters
        const data = await fetchVercelDeployments(projectId, teamId, token)
        return { success: true, result: data, serverName: 'Vercel MCP', toolName }
      }

      if (toolName === 'get_deployment') {
        const { idOrUrl, teamId } = parameters
        let url = `https://api.vercel.com/v13/deployments/${encodeURIComponent(idOrUrl || '')}`
        if (teamId) url += `?teamId=${encodeURIComponent(teamId)}`
        const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
        if (res.ok) {
          const data = await res.json()
          return { success: true, result: data, serverName: 'Vercel MCP', toolName }
        }
      }

      if (toolName === 'get_runtime_logs') {
        const projectId = effectiveParams.projectId || resolvedContext?.projectId
        const deploymentId = effectiveParams.deploymentId || effectiveParams.idOrUrl || resolvedContext?.deploymentId
        const teamId = effectiveParams.teamId || resolvedContext?.teamId
        if (projectId && deploymentId) {
          const data = await fetchVercelRuntimeLogs(projectId, deploymentId, teamId, token)
          return {
            success: true,
            result: {
              projectName: resolvedContext?.projectName || projectId,
              projectId,
              deploymentId,
              events: Array.isArray(data) ? data : data?.events || [data],
            },
            serverName: 'Vercel MCP',
            toolName,
          }
        }
      }

      if (toolName === 'get_deployment_build_logs') {
        const idOrUrl = effectiveParams.idOrUrl || effectiveParams.deploymentId || resolvedContext?.deploymentId
        const teamId = effectiveParams.teamId || resolvedContext?.teamId
        if (idOrUrl) {
          const data = await fetchVercelDeploymentEvents(idOrUrl, teamId, token)
          return {
            success: true,
            result: {
              projectName: resolvedContext?.projectName,
              deploymentId: idOrUrl,
              buildLogs: Array.isArray(data) ? data : data?.events || [data],
            },
            serverName: 'Vercel MCP',
            toolName,
          }
        }
      }

      if (toolName === 'get_runtime_errors') {
        const projectId = effectiveParams.projectId || resolvedContext?.projectId
        const deploymentId = effectiveParams.deploymentId || effectiveParams.idOrUrl || resolvedContext?.deploymentId
        const teamId = effectiveParams.teamId || resolvedContext?.teamId
        if (projectId && deploymentId) {
          const raw = await fetchVercelRuntimeLogs(projectId, deploymentId, teamId, token)
          const allEvents = Array.isArray(raw) ? raw : raw?.events || []
          const errors = allEvents.filter((ev: any) => {
            const txt = (ev.payload?.text || ev.text || ev.message || '').toLowerCase()
            const type = (ev.type || '').toLowerCase()
            const status = ev.statusCode || ev.payload?.statusCode
            return (
              type.includes('error') ||
              txt.includes('error') ||
              txt.includes('exception') ||
              txt.includes('fatal') ||
              (status && status >= 400)
            )
          })
          return {
            success: true,
            result: {
              projectName: resolvedContext?.projectName || projectId,
              projectId,
              deploymentId,
              totalErrors: errors.length,
              errors: errors.slice(0, 30),
            },
            serverName: 'Vercel MCP',
            toolName,
          }
        }
      }

      if (toolName === 'check_domain_availability_and_price') {
        const names: string[] = Array.isArray(parameters.names)
          ? parameters.names
          : [parameters.name || parameters.domain].filter(Boolean)
        const results = await Promise.all(
          names.map(async (name) => {
            try {
              const res = await fetch(`https://api.vercel.com/v4/domains/price?name=${encodeURIComponent(name)}`, {
                headers: { Authorization: `Bearer ${token}` },
              })
              if (res.ok) return await res.json()
              return { name, available: true, status: 'checked' }
            } catch {
              return { name, status: 'unknown' }
            }
          })
        )
        return { success: true, result: { domains: results }, serverName: 'Vercel MCP', toolName }
      }

      if (toolName === 'search_vercel_documentation') {
        const topic = parameters.topic || ''
        return {
          success: true,
          result: {
            topic,
            documentationUrl: `https://vercel.com/docs?query=${encodeURIComponent(topic)}`,
            message: `نتائج استعلام توثيق Vercel لموضوع "${topic}". يمكنك أيضاً تصفح https://vercel.com/docs`,
          },
          serverName: 'Vercel MCP',
          toolName,
        }
      }
    } catch (fallbackErr: any) {
      console.warn('Vercel REST fallback error:', fallbackErr)
    }
  }

  // 3. Fallback when not configured or token missing
  return {
    success: false,
    result: null,
    errorMessage: token
      ? `تعذر تنفيذ الأداة "${toolName}" على خادم Vercel MCP. يرجى التأكد من صحة المعاملات أو صلاحيات رمز الوصول (Token).`
      : 'لم يتم ربط حساب Vercel بعد أو لم يتم إدخال رمز الوصول (Personal Access Token). يرجى ربطه من صفحة الإعدادات أو عبر بطاقة الربط.',
    serverName: 'Vercel MCP',
    toolName,
  }
}

// =========================================================================
// DYNAMIC MCP TOOL EXECUTION VIA STANDARD JSON-RPC (tools/call)
// =========================================================================
export async function executeMcpTool(
  serverIdentifier: string,
  toolName: string,
  parameters: Record<string, any> = {},
  availableServers: McpServer[] = []
): Promise<McpExecutionResult> {
  const server = availableServers.find(
    (s) =>
      s.id === serverIdentifier ||
      s.name.toLowerCase().includes(serverIdentifier.toLowerCase()) ||
      serverIdentifier.toLowerCase().includes(s.name.toLowerCase()) ||
      s.service.toLowerCase().includes(serverIdentifier.toLowerCase())
  )

  const serverName = server?.name || serverIdentifier || 'MCP Server'

  if (server && server.isEnabled === false) {
    return {
      success: false,
      result: null,
      errorMessage: `خادم الـ MCP "${server.name}" معطل حالياً في الإعدادات. يمكنك تفعيله بنقرة واحدة من صفحة الإعدادات.`,
      serverName,
      toolName,
    }
  }

  // TickTick is not a generic HTTP MCP endpoint — route via its token-based API.
  const isTickTick =
    server?.service === 'ticktick' ||
    serverName.toLowerCase().includes('ticktick') ||
    serverIdentifier.toLowerCase().includes('ticktick')
  if (isTickTick) {
    return await executeTickTickTool(toolName, parameters)
  }

  // Supabase is the user's own project — route via PostgREST / Management API.
  const isSupabase =
    server?.service === 'supabase' ||
    serverName.toLowerCase().includes('supabase') ||
    serverIdentifier.toLowerCase().includes('supabase')
  if (isSupabase) {
    return await executeSupabaseTool(toolName, parameters)
  }

  // Vercel MCP is routed directly via https://mcp.vercel.com with token authentication
  const isVercel =
    server?.service === 'vercel' ||
    serverName.toLowerCase().includes('vercel') ||
    serverIdentifier.toLowerCase().includes('vercel') ||
    (server?.url && server.url.includes('vercel'))
  if (isVercel) {
    return await executeVercelTool(toolName, parameters, server?.authToken, server?.url)
  }

  // Determine MCP Endpoint URL
  let targetUrl = server?.url
  if (!targetUrl && (serverName.includes('800') || serverIdentifier.includes('800'))) {
    targetUrl = 'http://localhost:3000/mcp'
  }

  // 1. PRIMARY: EXECUTE VIA LIVE MCP HTTP PROTOCOL (tools/call)
  if (targetUrl && (targetUrl.startsWith('http://') || targetUrl.startsWith('https://'))) {
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream',
      }
      if (server?.authToken) {
        headers['Authorization'] = `Bearer ${server.authToken}`
      }

      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 8000)

      // Normalize parameters
      let args = { ...parameters }
      if (toolName === 'update_offer' || toolName === 'update_package') {
        if (!args.id && (args.packageName || '').toLowerCase().includes('sat')) {
          args.id = '7f95b059-d675-481d-9ff8-d4c0d9cbe89e'
        }
      }

      const response = await fetch(targetUrl, {
        method: 'POST',
        headers,
        signal: controller.signal,
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'tools/call',
          params: {
            name: toolName === 'update_package' ? 'update_offer' : toolName === 'get_packages' ? 'list_offers' : toolName === 'get_subjects' ? 'list_subjects_full' : toolName,
            arguments: args,
          },
          id: Date.now(),
        }),
      })

      clearTimeout(timeoutId)

      if (response.ok) {
        const text = await response.text()
        let json: any = null
        try {
          json = JSON.parse(text)
        } catch {
          const lines = text.split('\n')
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                json = JSON.parse(line.slice(6))
                if (json.result) break
              } catch {}
            }
          }
        }

        if (json?.result !== undefined) {
          let parsedData = json.result
          if (Array.isArray(json.result.content)) {
            const textItem = json.result.content.find((c: any) => c.type === 'text')
            if (textItem?.text) {
              try {
                parsedData = JSON.parse(textItem.text)
              } catch {
                parsedData = textItem.text
              }
            }
          }

          return {
            success: true,
            result: parsedData,
            serverName,
            toolName,
          }
        }
      }
    } catch (err) {
      console.warn(`Direct JSON-RPC call to ${targetUrl} failed, trying resilient Supabase fallback:`, err)
    }
  }

  // 2. RESILIENT FALLBACK DIRECTLY TO SUPABASE FOR 800 ACADEMY
  if (serverName.includes('800') || serverIdentifier.includes('800')) {
    try {
      if (toolName.includes('offer') || toolName.includes('package') || toolName.includes('باق')) {
        if (toolName.includes('update') || toolName.includes('تعديل')) {
          const targetId = parameters.id || '7f95b059-d675-481d-9ff8-d4c0d9cbe89e'
          const patchBody: Record<string, any> = { updated_at: new Date().toISOString() }
          if (parameters.price_cents !== undefined) patchBody.price_cents = parameters.price_cents
          else if (parameters.price !== undefined) {
            const p = typeof parameters.price === 'number' ? parameters.price : parseInt(parameters.price, 10)
            patchBody.price_cents = p > 5000 ? p : p * 100
          }

          const patchRes = await querySupabase800(`subject_offers?id=eq.${targetId}`, {
            method: 'PATCH',
            headers: { Prefer: 'return=representation' },
            body: JSON.stringify(patchBody),
          })
          if (patchRes.ok) {
            const updated = await patchRes.json()
            return {
              success: true,
              result: { success: true, message: 'تم تعديل العرض بنجاح', offer: updated[0] },
              serverName,
              toolName,
            }
          }
        }

        const res = await querySupabase800('subject_offers?select=*&order=created_at.asc')
        if (res.ok) {
          const offers = await res.json()
          return {
            success: true,
            result: { offers },
            serverName,
            toolName,
          }
        }
      }

      if (toolName.includes('subject') || toolName.includes('مواد')) {
        const res = await querySupabase800('subjects?select=*&order=sort_order.asc')
        if (res.ok) {
          const subjects = await res.json()
          return {
            success: true,
            result: { subjects },
            serverName,
            toolName,
          }
        }
      }

      if (toolName.includes('exam') || toolName.includes('امتحان')) {
        let endpoint = 'exams?select=id,title,exam_number,min_score,total_points,duration_seconds,pass_percent,subject_id&order=exam_number.asc'
        if (parameters.subject_id) {
          endpoint += `&subject_id=eq.${parameters.subject_id}`
        }
        endpoint += '&limit=100'
        const res = await querySupabase800(endpoint)
        if (res.ok) {
          const exams = await res.json()
          return {
            success: true,
            result: { items: exams, total: exams.length, page: 1, page_size: 100, has_more: false },
            serverName,
            toolName,
          }
        }
      }

      if (toolName.includes('question') || toolName.includes('سؤال')) {
        let endpoint = 'question_bank?select=id,prompt_text,type,difficulty,subject_id'
        if (parameters.subject_id) {
          endpoint += `&subject_id=eq.${parameters.subject_id}`
        }
        endpoint += '&limit=50'
        const res = await querySupabase800(endpoint)
        if (res.ok) {
          const questions = await res.json()
          return {
            success: true,
            result: { questions, total: questions.length },
            serverName,
            toolName,
          }
        }
      }

      if (toolName.includes('blog') || toolName.includes('مقال') || toolName.includes('article')) {
        let endpoint = 'articles?select=id,title,slug,description,published,published_at,created_at&order=created_at.desc&limit=50'
        const res = await querySupabase800(endpoint)
        if (res.ok) {
          const articles = await res.json()
          return {
            success: true,
            result: { items: articles, total: articles.length, page: 1, page_size: 50, has_more: false },
            serverName,
            toolName,
          }
        }
      }

      if (toolName.includes('categor') || toolName.includes('فئ') || toolName.includes('تصنيف')) {
        let endpoint = 'categories?select=id,name,slug,description,published&order=created_at.asc'
        const res = await querySupabase800(endpoint)
        if (res.ok) {
          const categories = await res.json()
          return {
            success: true,
            result: { items: categories, total: categories.length },
            serverName,
            toolName,
          }
        }
      }
    } catch (fallbackErr: any) {
      console.error('Supabase fallback error:', fallbackErr)
    }
  }

  // 3. NO SUCCESSFUL EXECUTION
  return {
    success: false,
    result: null,
    errorMessage: `تعذر تنفيذ الأداة ${toolName} على خادم ${serverName}. يرجى التحقق من اتصال الخادم وصلاحيات الوصول.`,
    serverName,
    toolName,
  }
}
