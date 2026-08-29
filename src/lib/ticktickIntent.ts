import type { LlmConfigState } from './llm/types'
import { executeUnifiedLlmCompletion } from './llm/llmService'
import { executeMcpTool } from './mcpClient'
import { fetchTickTickProjects, fetchTasksByProjectName } from './ticktick'

/**
 * Reliable, direct handler for TickTick intents.
 * Executes the requested TickTick tool SERVER-SIDE (real data) and returns a
 * natural Arabic answer built from the verified result. This avoids the fragile
 * multi-agent pipeline for simple TickTick CRUD/query requests and guarantees
 * the user always sees the real outcome.
 */
export async function runTickTickIntent(
  content: string,
  _token: string,
  servers: any[],
  llmConfig: LlmConfigState,
  systemPrompt: string
): Promise<string> {
  const exec = (tool: string, params: Record<string, any> = {}) =>
    executeMcpTool('TickTick MCP', tool, params, servers)

  // ---------- intent detection ----------
  const wantsCreateProject =
    /مشروع/.test(content) &&
    /(جديد|جديدة|انشئ|أنشئ|اعمل|أعمل|اضف|أضف|سميه|اسمه|باسم|بأسم|create|new project|make a project)/i.test(content)

  const wantsComplete =
    /(اكمل|إنه|انه|خلص|أنجز|تمت|complete|finish|mark done)/i.test(content) &&
    /(مهمة|task)/i.test(content)

  const wantsUpdate =
    /(عدل|حدث|غير|وّن|update|edit|change|صحح)/i.test(content) && /(مهمة|task)/i.test(content)

  const wantsCreateTask =
    /(مهمة|task)/i.test(content) &&
    /(انشئ|أنشئ|اعمل|أعمل|اضف|أضف|جديد|جديدة|create|add|new)/i.test(content) &&
    !wantsCreateProject

  const wantsListTasks = /(مهام|المهام|tasks)/i.test(content) && !wantsCreateTask

  // ---------- deletion detection (real, irreversible) ----------
  const hasDeleteKw = /(احذف|حذف|ازل|شيل|مسح|دمر|delete|remove|erase)/i.test(content)
  const wantsDeleteTask = hasDeleteKw && /(مهمة|task)/i.test(content)
  const wantsDeleteProject =
    hasDeleteKw && /(مشروع|قائمة|project|list)/i.test(content) && !wantsDeleteTask

  // ---------- name extraction ----------
  const extractAfter = (keywords: string[]): string => {
    for (const kw of keywords) {
      const m = content.match(new RegExp(`${kw}\\s*["']?([^"'\n،,]+?)["']?\\s*$`, 'i'))
      if (m) return m[1].trim()
      const m2 = content.match(new RegExp(`${kw}\\s+([^"'\n،,]+)`, 'i'))
      if (m2) return m2[1].trim()
    }
    return ''
  }

  let projectName = extractAfter(['سميه', 'اسمه', 'باسم', 'بأسم'])
  if (!projectName && wantsCreateProject) projectName = extractAfter(['مشروع'])

  let taskTitle = extractAfter(['بعنوان', 'عنوان', 'اسمها', 'سميها'])
  if (!taskTitle && wantsCreateTask) {
    taskTitle = content
      .replace(/.*?(انشئ|أنشئ|اعمل|أعمل|اضف|أضف|create|add)\s*/i, '')
      .replace(/مهمة\s*(جديدة|جديد)?/i, '')
      .replace(/في مشروع\s*["']?[^"'\n،,]+?["']?/i, '')
      .replace(/وسميها\s*[^"'\n،,]+/i, '')
      .trim()
    if (taskTitle.length < 2) taskTitle = ''
  }

  const targetProject = /800/.test(content)
    ? '800 Academy'
    : /inspire|انسباير/i.test(content)
      ? 'Inspire'
      : '800 Academy'

  // ---------- pick tool + params ----------
  let tool = ''
  let params: Record<string, any> = {}

  // Deletion (real, irreversible) — handled first so it never falls back to a read.
  if (wantsDeleteProject) {
    const q = projectName || extractAfter(['مشروع', 'قائمة', 'project', 'list'])
    const projects = await fetchTickTickProjects(_token)
    const matches = q
      ? projects.filter((p) => p.name.toLowerCase().includes(q.toLowerCase()))
      : /(كل|جميع|all)/i.test(content)
        ? projects
        : []
    if (!matches.length) {
      return q
        ? `لم أعثر على أي مشروع باسم "${q}" في حسابك على TickTick.`
        : 'لم تحدد اسم المشروع المراد حذفه. اكتب مثلاً: "احذف مشروع Menu" أو "احذف كل المشاريع".'
    }
    const deleted: string[] = []
    let lastError = ''
    for (const proj of matches) {
      const r = await exec('delete_project', { projectId: proj.id })
      if (r.success) deleted.push(proj.name)
      else lastError = r.errorMessage || lastError
    }
    if (!deleted.length) return `تعذر حذف المشاريع: ${lastError}`
    return `✅ تم حذف المشروع/المشاريع التالية نهائياً من TickTick: ${deleted.join('، ')}.`
  }

  if (wantsDeleteTask) {
    const q = taskTitle || extractAfter(['مهمة', 'task'])
    if (!q) return 'لم تحدد عنوان المهمة المراد حذفها. اكتب مثلاً: "احذف مهمة مراجعة التقرير".'
    const data = await fetchTasksByProjectName(targetProject, _token)
    const tasks = (data.tasks || []).filter((t: any) => t.title && t.title.toLowerCase().includes(q.toLowerCase()))
    if (!tasks.length) return `لم أعثر على مهمة بعنوان "${q}" داخل مشروع "${targetProject}".`
    const deleted: string[] = []
    let lastError = ''
    for (const t of tasks) {
      const r = await exec('delete_task', { id: t.id, projectId: t.projectId || data.project?.id || '' })
      if (r.success) deleted.push(t.title)
      else lastError = r.errorMessage || lastError
    }
    if (!deleted.length) return `تعذر حذف المهمة: ${lastError}`
    return `✅ تم حذف المهمة/المهام التالية نهائياً من TickTick: ${deleted.join('، ')} (داخل مشروع "${targetProject}").`
  }

  if (wantsCreateProject) {
    if (!projectName) return 'ما هو اسم المشروع الذي تريد إنشاءه في TickTick؟ (مثال: أنشئ مشروعاً جديداً وسمّه Menu)'
    tool = 'create_project'
    params = { name: projectName }
  } else if (wantsCreateTask) {
    if (!taskTitle) return 'ما هو عنوان المهمة التي تريد إنشاءها؟ (مثال: أنشئ مهمة بعنوان "مراجعة التقرير" في مشروع 800 Academy)'
    tool = 'create_task'
    params = { title: taskTitle, projectName: targetProject }
  } else if (wantsComplete) {
    const q = taskTitle || extractAfter(['مهمة', 'task'])
    if (!q) return 'أي مهمة تريد إنهاء؟ (اذكر عنوانها بدقة)'
    const found = await exec('search_task', { query: q, projectName: targetProject })
    const tasks = (found.result?.tasks as any[]) || []
    if (!tasks.length) return `لم أعثر على مهمة بعنوان "${q}" داخل مشروع "${targetProject}".`
    tool = 'complete_task'
    params = { id: tasks[0].id, projectId: tasks[0].projectId || '' }
  } else if (wantsUpdate) {
    const q = taskTitle || extractAfter(['مهمة', 'task'])
    if (!q) return 'أي مهمة تريد تعديلها وما التعديل المطلوب؟'
    const found = await exec('search_task', { query: q, projectName: targetProject })
    const tasks = (found.result?.tasks as any[]) || []
    if (!tasks.length) return `لم أعثر على مهمة بعنوان "${q}" داخل مشروع "${targetProject}".`
    const dateMatch = content.match(/(\d{1,4}[-/]\d{1,2}[-/]\d{1,4}|\d{1,2}[-/]\d{1,2}|\d{4}-\d{2}-\d{2})/)
    tool = 'update_task'
    params = {
      id: tasks[0].id,
      projectId: tasks[0].projectId || '',
      title: q,
      dueDate: dateMatch ? dateMatch[0] : undefined,
    }
  } else if (wantsListTasks) {
    tool = 'search_task'
    params = { projectName: targetProject }
  } else {
    // default: list projects
    tool = 'list_projects'
    params = {}
  }

  // ---------- execute server-side (real data) ----------
  const execResult = await exec(tool, params)
  if (!execResult.success) {
    return `تعذر تنفيذ العملية في TickTick: ${execResult.errorMessage || 'خطأ غير معروف'}`
  }

  return naturalTickTickAnswer(tool, params, execResult.result, content, systemPrompt, llmConfig)
}

async function naturalTickTickAnswer(
  tool: string,
  params: Record<string, any>,
  result: any,
  userQuestion: string,
  systemPrompt: string,
  llmConfig: LlmConfigState
): Promise<string> {
  const fmt = formatTickTickResult(tool, params, result)

  const sys = `${systemPrompt}

أنت مساعد Azal Labs. استخدم النتيجة الفعلية أدناه (المُرجعة من TickTick) للرد على المستخدم بالعربية بأسلوب طبيعي ومنظم وحيادي، واستخدم جداول Markdown عند الحاجة.
ممنوع منعاً باتاً اختلاق أي بيانات غير موجودة في النتيجة.

=== النتيجة الفعلية من TickTick (${tool}) ===
${fmt}`

  try {
    const ans = await executeUnifiedLlmCompletion(llmConfig, {
      messages: [{ role: 'user', content: userQuestion }],
      systemPrompt: sys,
    })
    if (ans && ans.trim().length > 12) return ans.trim()
  } catch {
    /* fall back to template */
  }
  return fmt
}

function formatTickTickResult(tool: string, params: Record<string, any>, result: any): string {
  if (tool === 'list_projects') {
    const projects = (result?.projects as any[]) || []
    if (!projects.length) return 'لا توجد أي مشاريع/قوائم مسجلة حالياً في حسابك على TickTick.'
    return `### 📂 مشاريعك المسجلة في TickTick (${projects.length})\n` +
      projects.map((p: any, i: number) => `${i + 1}. **${p.name || p.title}**${p.id ? ` — (id: ${p.id})` : ''}`).join('\n')
  }

  if (tool === 'create_project') {
    const name = result?.project?.name || params.name || 'المشروع'
    return `✅ **تم إنشاء المشروع "${name}" بنجاح في حسابك الفعلي على TickTick.**`
  }

  if (tool === 'create_task') {
    const title = result?.title || params.title || 'المهمة'
    const proj = result?.projectName || params.projectName || ''
    return `✅ **تم إنشاء المهمة "${title}"${proj ? ` داخل مشروع "${proj}"` : ''} بنجاح في TickTick.**`
  }

  if (tool === 'complete_task') {
    const title = result?.title || params.id || 'المهمة'
    return `✅ **تم إنهاء المهمة "${title}" وتحديث حالتها إلى "منجزة" في TickTick.**`
  }

  if (tool === 'update_task') {
    const title = result?.title || params.title || 'المهمة'
    return `✅ **تم تحديث المهمة "${title}" في TickTick بنجاح.**${params.dueDate ? ` (الموعد الجديد: ${params.dueDate})` : ''}`
  }

  if (tool === 'search_task') {
    const tasks = (result?.tasks as any[]) || []
    const proj = result?.project?.name || params.projectName || ''
    if (!tasks.length) return `لا توجد أي مهام مسجلة حالياً داخل مشروع "${proj}".`
    const lines = tasks
      .map((t: any, i: number) => {
        const status = t.status === 2 ? '✅ منجزة' : '⏳ قيد التنفيذ'
        const due = t.dueDate ? ` | موعد: ${t.dueDate}` : ''
        return `${i + 1}. **${t.title}** — (${status}${due})`
      })
      .join('\n')
    return `### 📋 مهام مشروع "${proj}" (${tasks.length})\n${lines}`
  }

  return 'تم إتمام العملية في TickTick بنجاح.'
}
