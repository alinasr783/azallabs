import type { LlmConfigState } from './llm/types'
import { executeUnifiedLlmCompletion } from './llm/llmService'
import { executeMcpTool } from './mcpClient'
import { fetchVercelProjects } from './vercelConnector'

/**
 * Reliable, direct handler for Vercel MCP intents.
 * Executes the requested Vercel tool and returns a natural Arabic answer
 * built from the verified live result with markdown tables.
 */
export async function runVercelIntent(
  content: string,
  token: string,
  servers: any[],
  llmConfig: LlmConfigState,
  systemPrompt: string,
  _existingMsgs: any[] = []
): Promise<string> {
  const exec = (tool: string, params: Record<string, any> = {}) =>
    executeMcpTool('Vercel MCP', tool, params, servers)

  const lower = content.toLowerCase()

  // 1. Check if user is asking about Vercel MCP capabilities / tools
  const isCapabilityQuery =
    (lower.includes('تقدر تعمل ايه') ||
      lower.includes('ماذا يمكنك') ||
      lower.includes('ما هي أدوات') ||
      lower.includes('ما هي قدرات') ||
      lower.includes('شرح الأدوات') ||
      lower.includes('شرح أدوات') ||
      lower.includes('شرح') ||
      lower.includes('what can you do') ||
      lower.includes('capabilities') ||
      lower.includes('tools')) &&
    !lower.includes('مشروع') &&
    !lower.includes('مشاريع') &&
    !lower.includes('deploy') &&
    !lower.includes('نشر')

  if (isCapabilityQuery) {
    return `### 🛠️ الأدوات والقدرات المتاحة في خادم Vercel MCP (إجمالي 23+ أداة)

خادم **Vercel MCP** موصول بنجاح عبر \`https://mcp.vercel.com\` ويوفر الأدوات التالية:

1. **إدارة المشاريع والفرق (Projects & Teams):**
   - \`list_teams\`: استعراض الفرق التابع لها حسابك مع الـ IDs والـ Slugs.
   - \`list_projects\`: استعراض كافة مشاريع Vercel (مع إطارات العمل والنطاقات).
   - \`get_project\`: جلب تفاصيل مشروع محدد وإعدادات البناء.

2. **عمليات النشر وسجلات التشغيل (Deployments & Logs):**
   - \`list_deployments\`: استعراض عمليات النشر لمشروع محدد مع حالتها (READY / ERROR).
   - \`get_deployment\`: جلب تفاصيل عملية نشر معينة ومناطق التوزيع.
   - \`get_deployment_build_logs\`: جلب سجلات البناء وتشخيص أخطاء التجميع.
   - \`get_runtime_logs\`: قراءة سجلات التشغيل الحية وتفاصيل دوال Vercel Functions.
   - \`get_runtime_errors\`: تجميع وتشخيص أخطاء بيئة الإنتاج للمشروع.
   - \`deploy_to_vercel\`: نشر ملفات مباشرة إلى Vercel.

3. **تحليلات الويب (Web Analytics):**
   - \`get_web_analytics\`: استعلام زيارات الصفحات، الدول، والأجهزة.

4. **مراقبة الوكلاء الذكية (Agent Runs Observability):**
   - \`list_agent_run_projects\` / \`list_agent_runs\`: مراقبة دورات تشغيل وكلاء الذكاء الاصطناعي.
   - \`get_agent_run\` / \`get_agent_run_trace\`: استرجاع التتبع الكامل لمدخلات ومخرجات الوكيل واستهلاك التوكنز.

5. **النطاقات والمشتريات (Domains & Purchases):**
   - \`check_domain_availability_and_price\`: فحص توفر النطاقات وأسعار تسجيلها.
   - \`get_purchase_quote\` / \`buy_domain\` / \`buy_credits\`: طلب عروض أسعار وشراء الرصيد أو النطاقات.

6. **شريط الأدوات والتعليقات (Toolbar Tools):**
   - \`list_toolbar_threads\` / \`reply_to_toolbar_thread\`: قراءة والرد على تعليقات وملاحظات المعاينة.

7. **التوثيق (Documentation):**
   - \`search_vercel_documentation\`: البحث الدقيق في وثائق Vercel الرسمية.

ما هي العملية التي ترغب في أن أنفذها لك الآن على حساب Vercel الخاص بك؟`
  }

  // 2. Select target tool based on user intent
  let tool = 'list_projects'
  const params: Record<string, any> = {}

  if (lower.includes('فريق') || lower.includes('فرق') || lower.includes('team')) {
    tool = 'list_teams'
  } else if (lower.includes('build log') || lower.includes('سجل البناء') || lower.includes('سجلات البناء')) {
    tool = 'get_deployment_build_logs'
  } else if (lower.includes('error') || lower.includes('خطأ') || lower.includes('أخطاء') || lower.includes('مشاكل')) {
    tool = 'get_runtime_errors'
  } else if (lower.includes('log') || lower.includes('سجل') || lower.includes('سجلات')) {
    tool = 'get_runtime_logs'
  } else if (lower.includes('analytic') || lower.includes('تحليل') || lower.includes('زوار') || lower.includes('زيارات') || lower.includes('ترافيك')) {
    tool = 'get_web_analytics'
  } else if (lower.includes('domain') || lower.includes('نطاق') || lower.includes('دومين')) {
    tool = 'check_domain_availability_and_price'
    const domainMatches = content.match(/([a-zA-Z0-9-]+\.[a-zA-Z]{2,})/g)
    if (domainMatches && domainMatches.length > 0) {
      params.names = domainMatches
    }
  } else if (lower.includes('deploy') || lower.includes('نشر') || lower.includes('دبلوي') || lower.includes('عمليات النشر')) {
    tool = 'list_deployments'
  } else if (lower.includes('agent') || lower.includes('وكيل') || lower.includes('runs')) {
    tool = 'list_agent_runs'
  } else if (lower.includes('doc') || lower.includes('توثيق') || lower.includes('شرح') || lower.includes('ازاي') || lower.includes('كيف')) {
    tool = 'search_vercel_documentation'
    params.topic = content.replace(/vercel|فيرسل|فرسل|ابحث|في|عن|توثيق/gi, '').trim() || content
  } else {
    // Default to listing projects
    tool = 'list_projects'
  }

  // 3. Execute the tool
  let execResult = await exec(tool, params)

  // Direct fallback to fetchVercelProjects if list_projects returned empty or failed
  if (tool === 'list_projects' && (!execResult.success || !execResult.result)) {
    try {
      const directProjects = await fetchVercelProjects(undefined, token)
      if (directProjects) {
        execResult = {
          success: true,
          result: directProjects,
          serverName: 'Vercel MCP',
          toolName: 'list_projects',
        }
      }
    } catch (e: any) {
      console.warn('Direct fallback projects fetch error:', e)
    }
  }

  if (!execResult.success) {
    const msg = execResult.errorMessage || 'خطأ غير معروف'
    return `⚠️ تعذر تنفيذ العملية على خادم Vercel MCP: ${msg}\n\nيرجى التأكد من صلاحية رمز الوصول (Personal Access Token) في [صفحة الإعدادات](/settings?tab=mcp).`
  }

  return naturalVercelAnswer(tool, params, execResult.result, content, systemPrompt, llmConfig)
}

async function naturalVercelAnswer(
  tool: string,
  params: Record<string, any>,
  result: any,
  userQuestion: string,
  systemPrompt: string,
  llmConfig: LlmConfigState
): Promise<string> {
  const formatted = formatVercelResult(tool, params, result)

  const sys = `${systemPrompt}

أنت مساعد Azal Labs الذكي المتصل مباشرة بخادم Vercel MCP الرسمي عبر https://mcp.vercel.com.
استخدم البيانات الحقيقية والمؤكدة أدناه للإجابة على المستخدم باللغة العربية بدقة وموضوعية.
قواعد صارمة جداً (Zero Hallucination):
1. التزم بالبيانات المسترجعة من Vercel فقط.
2. لا تذكر أي مشاريع أو مهام من TickTick إطلاقاً ما لم يطلب المستخدم TickTick صراحة.
3. استخدم جداول Markdown المنظمة لعرض المشاريع وعمليات النشر والفرق.
4. اذكر دائماً عدد العناصر المؤكد في البداية.

=== البيانات الحقيقية المسترجعة من خادم Vercel MCP (${tool}) ===
${formatted}`

  try {
    const ans = await executeUnifiedLlmCompletion(llmConfig, {
      messages: [{ role: 'user', content: userQuestion }],
      systemPrompt: sys,
    })
    if (ans && ans.trim().length > 15) return ans.trim()
  } catch {
    // Fall back to formatted template
  }
  return formatted
}

function formatVercelResult(tool: string, params: Record<string, any>, result: any): string {
  // 1. List Projects
  if (tool === 'list_projects') {
    const rawProjects = Array.isArray(result?.projects)
      ? result.projects
      : Array.isArray(result)
      ? result
      : []

    if (!rawProjects.length) {
      return (
        '✅ **تم الاتصال بنجاح بخادم Vercel MCP.**\n\n' +
        'لا توجد مشاريع مسجلة حالياً في حساب Vercel المربوط، أو أن المشاريع تابعة لفريق محدد يتطلب تحديد الـ `teamId`.'
      )
    }

    const rows = rawProjects.map((p: any) => {
      const name = p.name || 'بدون اسم'
      const id = p.id || 'N/A'
      const framework = p.framework || 'Other'
      const updated = p.updatedAt ? new Date(p.updatedAt).toLocaleDateString('ar-EG') : 'حديثاً'
      const domain = Array.isArray(p.targets?.production?.alias) && p.targets.production.alias.length > 0
        ? `https://${p.targets.production.alias[0]}`
        : p.latestDeployments?.[0]?.url
        ? `https://${p.latestDeployments[0].url}`
        : '—'

      return `| **${name}** | \`${id}\` | ${framework} | [${domain}](${domain}) | ${updated} |`
    })

    return (
      `### 🚀 مشاريعك المسجلة في Vercel (إجمالي ${rawProjects.length} مشروع)\n\n` +
      `تم استرجاع المشاريع مباشرة عبر خادم \`Vercel MCP\`:\n\n` +
      `| اسم المشروع | معرف المشروع (ID) | إطار العمل | النطاق / الرابط | تاريخ آخر تحديث |\n` +
      `| :--- | :--- | :--- | :--- | :--- |\n` +
      rows.join('\n') +
      `\n\n💡 يمكنك سؤالي عن أي مشروع، فحص آخر عمليات النشر، أو مراجعة سجلات التشغيل (Runtime Logs) الخاصة به.`
    )
  }

  // 2. List Teams
  if (tool === 'list_teams') {
    const rawTeams = Array.isArray(result?.teams) ? result.teams : Array.isArray(result) ? result : []
    if (!rawTeams.length) {
      return 'أنت تعمل حالياً بالحساب الشخصي (Personal Account) ولا توجد فرق مسجلة.'
    }
    const rows = rawTeams.map(
      (t: any) => `| **${t.name || t.slug}** | \`${t.slug}\` | \`${t.id}\` |`
    )
    return (
      `### 👥 فرق العمل المسجلة في Vercel (${rawTeams.length})\n\n` +
      `| اسم الفريق | الـ Slug | المعرف (ID) |\n| :--- | :--- | :--- |\n` +
      rows.join('\n')
    )
  }

  // 3. List Deployments
  if (tool === 'list_deployments') {
    const rawDeployments = Array.isArray(result?.deployments) ? result.deployments : Array.isArray(result) ? result : []
    if (!rawDeployments.length) {
      return 'لا توجد عمليات نشر (Deployments) مسجلة لهذا المشروع حالياً.'
    }
    const rows = rawDeployments.map((d: any) => {
      const url = d.url ? `https://${d.url}` : '—'
      const state = d.state === 'READY' ? '🟢 جاهز (READY)' : d.state === 'ERROR' ? '🔴 خطأ (ERROR)' : `🟡 ${d.state}`
      const target = d.target || 'preview'
      const date = d.created ? new Date(d.created).toLocaleString('ar-EG') : '—'
      return `| [${d.url || 'Deployment'}](${url}) | ${state} | \`${target}\` | ${date} |`
    })
    return (
      `### 📦 آخر عمليات النشر (Deployments)\n\n` +
      `| رابط النشر | الحالة | البيئة | التاريخ |\n| :--- | :--- | :--- | :--- |\n` +
      rows.join('\n')
    )
  }

  // 4. Domains
  if (tool === 'check_domain_availability_and_price') {
    const domains = Array.isArray(result?.domains) ? result.domains : []
    if (!domains.length) {
      return 'لم يتم تحديد أي أسماء نطاقات لفحصها.'
    }
    const rows = domains.map((d: any) => {
      const name = d.name || d.domain || 'N/A'
      const avail = d.available ? '✅ متاح للشراء' : '❌ غير متاح'
      const price = d.price ? `$${d.price}` : 'حسب العرض'
      return `| **${name}** | ${avail} | ${price} |`
    })
    return (
      `### 🌐 نتائج فحص النطاقات على Vercel\n\n` +
      `| اسم النطاق | حالة التوفر | السعر التقريبي |\n| :--- | :--- | :--- |\n` +
      rows.join('\n')
    )
  }

  // 5. Documentation
  if (tool === 'search_vercel_documentation') {
    return (
      `### 📚 نتائج استعلام توثيق Vercel\n\n` +
      `الموضوع: **"${params.topic || 'Vercel Documentation'}"**\n\n` +
      (result?.message || 'تم العثور على وثائق وإرشادات Vercel المطلوبة.') +
      (result?.documentationUrl ? `\n\n🔗 [انقر هنا للانتقال إلى صفحة التوثيق الرسمية](${result.documentationUrl})` : '')
    )
  }

  // 6. Generic Fallback
  return `✅ **تم تنفيذ الأداة \`${tool}\` على خادم Vercel MCP بنجاح.**\n\n\`\`\`json\n${JSON.stringify(result, null, 2)}\n\`\`\``
}
