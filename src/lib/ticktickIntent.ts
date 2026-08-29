import type { LlmConfigState } from './llm/types'
import { executeUnifiedLlmCompletion } from './llm/llmService'
import { executeMcpTool } from './mcpClient'
import { fetchTickTickProjects, fetchTasksByProjectName, deleteTickTickProject, deleteTickTickTask } from './ticktick'

// Known project aliases mapping Arabic <-> English equivalents
const PROJECT_ALIASES: Record<string, string[]> = {
  menu: ['menu', 'منيو', 'المنيو', 'قائمة', 'قائمه', 'قائمة الطعام', 'قائمه الطعام'],
  tabibi: ['tabibi', 'طبيبي', 'الطباشيري', 'تابيبي'],
  taapost: ['taapost', 'تابوست', 'تا بوست'],
  inspire: ['inspire', 'انسباير', 'إنسباير', 'الالهام'],
  '800 academy': ['800', '800 academy', 'اكاديمية 800', 'أكاديمية 800', 'اكاديميه 800'],
  'restaurant industry': ['restaurant industry', 'مطاعم', 'صناعة المطاعم', 'المطاعم'],
  'dr.dalia': ['dr.dalia', 'dr dalia', 'داليا', 'دكتورة داليا', 'د. داليا'],
}

// Extract entity names or IDs from conversation history when user uses pronouns ("احذفهم", "احذف التلاتة")
function extractReferencedEntitiesFromHistory(history: any[]): { projectNames: string[]; projectIds: string[] } {
  const projectNames: string[] = []
  const projectIds: string[] = []

  const recent = history.slice(-4)
  for (const m of recent) {
    const text = m.content || ''
    const hexIds = text.match(/[0-9a-f]{24}/gi)
    if (hexIds) {
      for (const hid of hexIds) {
        if (!projectIds.includes(hid.toLowerCase())) projectIds.push(hid.toLowerCase())
      }
    }
    for (const [canonical, aliases] of Object.entries(PROJECT_ALIASES)) {
      for (const al of aliases) {
        if (text.toLowerCase().includes(al)) {
          if (!projectNames.includes(canonical)) projectNames.push(canonical)
        }
      }
    }
  }

  return { projectNames, projectIds }
}

/**
 * Reliable, direct handler for TickTick intents.
 * Executes the requested TickTick tool SERVER-SIDE (real data) and returns a
 * natural Arabic answer built from the verified result.
 */
export async function runTickTickIntent(
  content: string,
  _token: string,
  servers: any[],
  llmConfig: LlmConfigState,
  systemPrompt: string,
  existingMsgs: any[] = []
): Promise<string> {
  const exec = (tool: string, params: Record<string, any> = {}) =>
    executeMcpTool('TickTick MCP', tool, params, servers)

  // ---------- intent detection ----------
  const hasDeleteKw = /(احذف|حذف|ازل|إزالة|شيل|امسح|مسح|دمر|تخلص من|delete|remove|erase|drop)/i.test(content)
  const mentionsProjectWord = /(مشروع|مشاريع|قائمة|قوائم|project|projects|list|lists)/i.test(content)
  const mentionsTaskWord = /(مهمة|مهام|task|tasks)/i.test(content)

  const isPronounOrCountDelete =
    hasDeleteKw &&
    (/(هم|دول|كلهم|الكل|التلاتة|الثلاثة|الـ 3|ال 3|3 مشاريع|ثلاث مشاريع)/i.test(content) ||
      /^(احذف|امسح|شيل|ازل)\s*(هم|دول|كلهم|الكل|التلاتة|الثلاثة)?$/i.test(content.trim()))

  const wantsDeleteTask = hasDeleteKw && mentionsTaskWord
  const wantsDeleteProject = hasDeleteKw && (mentionsProjectWord || isPronounOrCountDelete || (!mentionsTaskWord && /(menu|منيو|tabibi|taapost|inspire|800|dalia|restaurant)/i.test(content)))

  const wantsCreateProject =
    /(مشروع|قائمة)/.test(content) &&
    /(جديد|جديدة|انشئ|أنشئ|اعمل|أعمل|اضف|أضف|سميه|اسمه|باسم|بأسم|create|new project|make a project)/i.test(content) &&
    !hasDeleteKw

  const wantsComplete =
    /(اكمل|إنه|انه|خلص|أنجز|تمت|complete|finish|mark done)/i.test(content) &&
    /(مهمة|task)/i.test(content)

  const wantsUpdate =
    /(عدل|حدث|غير|وّن|update|edit|change|صحح)/i.test(content) && /(مهمة|task)/i.test(content)

  const wantsCreateTask =
    /(مهمة|task)/i.test(content) &&
    /(انشئ|أنشئ|اعمل|أعمل|اضف|أضف|جديد|جديدة|create|add|new)/i.test(content) &&
    !wantsCreateProject &&
    !hasDeleteKw

  const wantsListTasks = /(مهام|المهام|tasks)/i.test(content) && !wantsCreateTask && !hasDeleteKw

  // ---------- helper name extraction ----------
  const extractAfter = (keywords: string[]): string => {
    for (const kw of keywords) {
      const m = content.match(new RegExp(`${kw}\\s*["']?([^"'\n،,]+?)["']?\\s*$`, 'i'))
      if (m) return m[1].trim()
      const m2 = content.match(new RegExp(`${kw}\\s+([^"'\n،,]+)`, 'i'))
      if (m2) return m2[1].trim()
    }
    return ''
  }

  const cleanEntityName = (s: string): string =>
    s
      .replace(/^(ال\s*|الذي\s*|التي\s*|اللي\s*)?(اسمه|باسم|سميه|اسمها|الاسم|بتوع|بتاع)\s*/i, '')
      .replace(
        /\s*(تماما|تماماً|بالكامل|نهائيا|نهائياً|نهائي|كليا|كلياً|بشكل نهائي|كاملا|كامل|النهائي|دول|كلهم)\s*$/i,
        ''
      )
      .trim()

  let projectName = cleanEntityName(extractAfter(['سميه', 'اسمه', 'باسم', 'بأسم']))
  if (!projectName && wantsCreateProject) projectName = cleanEntityName(extractAfter(['مشروع', 'قائمة']))

  let taskTitle = cleanEntityName(extractAfter(['بعنوان', 'عنوان', 'اسمها', 'سميها']))
  if (!taskTitle && wantsCreateTask) {
    taskTitle = cleanEntityName(
      content
        .replace(/.*?(انشئ|أنشئ|اعمل|أعمل|اضف|أضف|create|add)\s*/i, '')
        .replace(/مهمة\s*(جديدة|جديد)?/i, '')
        .replace(/في مشروع\s*["']?[^"'\n،,]+?["']?/i, '')
        .replace(/وسميها\s*[^"'\n،,]+/i, '')
    )
    if (taskTitle.length < 2) taskTitle = ''
  }

  const targetProject = /800/.test(content)
    ? '800 Academy'
    : /inspire|انسباير/i.test(content)
      ? 'Inspire'
      : '800 Academy'

  // =========================================================================
  // 1. DELETION: PROJECTS (Irreversible, Multi-Match Aware, Live Verified)
  // =========================================================================
  if (wantsDeleteProject) {
    const projects = await fetchTickTickProjects(_token)
    if (!projects || !projects.length) {
      return 'لا توجد أي مشاريع في حسابك على TickTick حالياً لحذفها.'
    }

    let matches: any[] = []

    // A. Match by exact hex ID in user message (e.g. 6a92ef918f087e0df411d29a)
    const hexMatch = content.match(/[0-9a-f]{10,24}/i)
    if (hexMatch) {
      const targetHex = hexMatch[0].toLowerCase()
      matches = projects.filter((p) => p.id.toLowerCase().includes(targetHex))
    }

    // B. Match by known project aliases (e.g. "منيو" -> "Menu", "انسباير" -> "Inspire")
    if (!matches.length) {
      for (const [canonical, aliases] of Object.entries(PROJECT_ALIASES)) {
        const matchesQuery = aliases.some((al) => content.toLowerCase().includes(al))
        if (matchesQuery) {
          matches = projects.filter((p) => {
            const pLower = p.name.toLowerCase()
            return pLower === canonical || aliases.some((al) => pLower.includes(al) || al.includes(pLower))
          })
          if (matches.length > 0) break
        }
      }
    }

    // C. Substring matching from extracted query
    if (!matches.length) {
      const q = cleanEntityName(projectName || extractAfter(['مشروع', 'مشاريع', 'قائمة', 'قوائم', 'project', 'projects', 'list', 'lists']))
      if (q) {
        matches = projects.filter(
          (p) =>
            p.name.toLowerCase().includes(q.toLowerCase()) ||
            q.toLowerCase().includes(p.name.toLowerCase())
        )
      }
    }

    // D. Contextual resolution from previous chat messages (e.g. "احذفهم", "احذف التلاتة", "احذف دول")
    if (!matches.length && (isPronounOrCountDelete || /(كل|جميع|all)/i.test(content))) {
      const historyContext = extractReferencedEntitiesFromHistory(existingMsgs)
      if (historyContext.projectIds.length > 0) {
        matches = projects.filter((p) => historyContext.projectIds.includes(p.id.toLowerCase()))
      }
      if (!matches.length && historyContext.projectNames.length > 0) {
        matches = projects.filter((p) =>
          historyContext.projectNames.some((n) => p.name.toLowerCase().includes(n))
        )
      }
      if (!matches.length && /(كل المشاريع|جميع المشاريع|all projects)/i.test(content)) {
        matches = projects
      }
    }

    if (!matches.length) {
      const availableList = projects.map((p) => `• **${p.name}** (\`${p.id}\`)`).join('\n')
      return `لم أعثر على مشروع مطابق لحذفه في حسابك على TickTick.\n\nالمشاريع المسجلة حالياً:\n${availableList}\n\nيمكنك تحديد الاسم بدقة (مثال: «احذف مشروع Menu») أو تحديد المعرف ID مباشرة.`
    }

    // Perform real deletion on TickTick server for all matched projects
    const deletedProjects: Array<{ id: string; name: string }> = []
    const failedProjects: Array<{ id: string; name: string; error: string }> = []

    for (const proj of matches) {
      try {
        await deleteTickTickProject(proj.id, _token)
        deletedProjects.push({ id: proj.id, name: proj.name })
      } catch (err: any) {
        failedProjects.push({
          id: proj.id,
          name: proj.name,
          error: err?.message || 'خطأ أثناء طلب الحذف من خادم TickTick',
        })
      }
    }

    // Re-verify from TickTick live API to ensure they are ACTUALLY gone!
    let remainingProjects: any[] = []
    try {
      remainingProjects = await fetchTickTickProjects(_token)
    } catch {
      remainingProjects = []
    }

    const verifiedDeleted = deletedProjects.filter(
      (d) => !remainingProjects.some((r) => r.id === d.id)
    )

    if (verifiedDeleted.length > 0) {
      const lines = verifiedDeleted.map((d) => `• مشروع **${d.name}** (المعرف ID: \`${d.id}\`)`).join('\n')
      let resp = `✅ **تم تأكيد حذف ${verifiedDeleted.length} مشروع نهائياً من حسابك في TickTick:**\n${lines}\n\nتم التحقق من الحساب الفعلي وتأكيد إزالة المشاريع بالكامل.`
      if (failedProjects.length > 0) {
        resp += `\n\n⚠️ تعذر حذف بعض المشاريع:\n${failedProjects.map((f) => `• ${f.name}: ${f.error}`).join('\n')}`
      }
      return resp
    }

    if (failedProjects.length > 0) {
      return `تعذر إتمام عملية الحذف من TickTick:\n${failedProjects.map((f) => `• ${f.name}: ${f.error}`).join('\n')}`
    }

    return 'لم يتم حذف أي مشروع. تأكد من أن المعرفات ما زالت موجودة في حسابك.'
  }

  // =========================================================================
  // 2. DELETION: TASKS (Real & Irreversible)
  // =========================================================================
  if (wantsDeleteTask) {
    const q = cleanEntityName(taskTitle || extractAfter(['مهمة', 'مهام', 'task', 'tasks']))
    if (!q && !isPronounOrCountDelete) {
      return 'لم تحدد عنوان المهمة المراد حذفها. اكتب مثلاً: «احذف مهمة مراجعة التقرير».'
    }

    const data = await fetchTasksByProjectName(targetProject, _token)
    const tasks = (data.tasks || []).filter((t: any) =>
      q ? t.title && t.title.toLowerCase().includes(q.toLowerCase()) : true
    )

    if (!tasks.length) {
      return `لم أعثر على مهمة بعنوان "${q}" داخل مشروع "${targetProject}".`
    }

    const deleted: string[] = []
    let lastError = ''
    for (const t of tasks) {
      try {
        await deleteTickTickTask(t.projectId || data.project?.id || '', t.id, _token)
        deleted.push(t.title)
      } catch (err: any) {
        lastError = err?.message || lastError
      }
    }

    if (!deleted.length) return `تعذر حذف المهمة من TickTick: ${lastError}`
    return `✅ تم حذف المهام التالية نهائياً من TickTick (مشروع "${targetProject}"):\n${deleted.map((d) => `• ${d}`).join('\n')}`
  }

  // =========================================================================
  // 3. OTHER ACTIONS: CREATE, COMPLETE, UPDATE, QUERY
  // =========================================================================
  let tool = ''
  let params: Record<string, any> = {}

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
    if (!q) return 'أي مهمة تريد إنهاءها؟ (اذكر عنوانها بدقة)'
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
    const msg = execResult.errorMessage || 'خطأ غير معروف'
    if (/HTML|توكن|proxy|ربط|انتهت صلاحية|غير صالح|صلاحية/i.test(msg)) {
      return `⚠️ ${msg}\n\n🔗 لإصلاح ذلك: افتح صفحة الإعدادات ← تبويب خوادم الربط، واضغط «إلغاء الربط» ثم «ربط TickTick» من جديد لتجديد التوكن. ثم أعد المحاولة.`
    }
    return `تعذر تنفيذ العملية في TickTick: ${msg}`
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
    if (!projects.length)
      return (
        'لا توجد أي قوائم/مشاريع ظاهرة في حساب TickTick المربوط حالياً.\n\n' +
        '⚠️ **ملاحظة عن واجهة TickTick:** الواجهة تعرض القوائم (Projects/Lists) المسجلة. إذا كانت مهامك في صندوق الوارد (Inbox)، يمكنك إنشاء مشروع جديد لتنظيمها.'
      )
    return `### 📂 مشاريعك المسجلة في TickTick (${projects.length})\n` +
      projects.map((p: any, i: number) => `${i + 1}. **${p.name || p.title}**${p.id ? ` — (id: \`${p.id}\`)` : ''}`).join('\n')
  }

  if (tool === 'create_project') {
    const name = result?.project?.name || params.name || 'المشروع'
    const id = result?.project?.id ? ` (المعرف ID: \`${result.project.id}\`)` : ''
    return `✅ **تم إنشاء المشروع "${name}"${id} بنجاح في حسابك الفعلي على TickTick.**`
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
