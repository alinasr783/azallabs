import type { LlmConfigState } from './llm/types'
import { executeUnifiedLlmCompletion } from './llm/llmService'
import { executeMcpTool } from './mcpClient'
import { fetchGitHubRepos, fetchGitHubRepoCommits, resolveGitHubContext } from './githubConnector'

/**
 * Dedicated, reliable runner for GitHub MCP intents.
 * Executes the requested GitHub tool and returns a natural Arabic answer
 * built from the verified live result with markdown tables.
 */
export async function runGitHubIntent(
  content: string,
  token: string,
  servers: any[],
  llmConfig: LlmConfigState,
  systemPrompt: string,
  _existingMsgs: any[] = []
): Promise<string> {
  const exec = (tool: string, params: Record<string, any> = {}) =>
    executeMcpTool('GitHub MCP', tool, params, servers)

  const lower = content.toLowerCase()

  // 1. Check if user is asking about GitHub MCP capabilities / tools
  const isCapabilityQuery =
    lower.includes('أدوات') ||
    lower.includes('الادوات') ||
    lower.includes('tools') ||
    lower.includes('إمكانيات') ||
    lower.includes('ماذا تستطيع') ||
    lower.includes('ماذا يمكنك') ||
    lower.includes('شرح الربط') ||
    lower.includes('قدرات')

  if (isCapabilityQuery) {
    return `### 🐙 إمكانيات وأدوات خادم GitHub MCP الرسمي (40+ أداة)

تم ربط حسابك بنجاح بخادم **GitHub MCP** الرسمي (\`https://api.githubcopilot.com/mcp/\`). يتيح لك المساعد الذكي التحكم الكامل في منصة GitHub عبر المحادثة باللغة الطبيعية:

---

1. **إدارة المستودعات والكود (Repositories & Code):**
   - \`search_repositories\`: البحث الذكي في المستودعات العامة والخاصة وفلترتها.
   - \`get_file_contents\`: قراءة واستعراض محتويات أي ملف أو مجلد برمجي.
   - \`create_or_update_file\`: إنشاء أو تعديل وحفظ الملفات مباشرة مع رسالة Commit.
   - \`delete_file\` / \`push_files\`: حذف أو دفع عدة ملفات مجمعة في Commit واحد.
   - \`list_commits\` / \`get_commit\`: تتبع سجل التغييرات والفروقات (Diff).
   - \`list_branches\` / \`create_branch\`: استعراض وإنشاء الفروع البرمجية.
   - \`create_repository\` / \`fork_repository\`: إنشاء مستودعات جديدة أو عمل Fork.
   - \`get_repository_tree\`: استعراض الهيكل الشجري للمشروع بالكامل.

2. **إدارة المشاكل والمهام (Issues Management):**
   - \`list_issues\`: استعراض المهام والمشاكل المفتوحة أو المغلقة في أي مستودع.
   - \`issue_read\`: قراءة تفاصيل الـ Issue وتعليقاته والتصنيفات (Labels).
   - \`issue_write\`: فتح Issue جديدة أو تحديث حالة وتعيين المسؤولين.
   - \`add_issue_comment\`: إضافة تعليقات وملاحظات على المشاكل.
   - \`search_issues\`: بحث متقدم في كافة المشاكل.

3. **طلبات السحب والمراجعة (Pull Requests & Code Review):**
   - \`list_pull_requests\`: استعراض طلبات السحب المفتوحة وحالتها.
   - \`pull_request_read\`: فحص الـ Diff، الملفات المتغيرة، والـ Commits الخاصة بالـ PR.
   - \`create_pull_request\`: فتح Pull Request جديد للدمج.
   - \`merge_pull_request\`: دمج الـ PR (Merge / Squash / Rebase).
   - \`add_reply_to_pull_request_comment\`: الرد على مراجعات الكود.

4. **سير العمل وعمليات البناء (GitHub Actions & CI/CD):**
   - \`actions_list\` / \`actions_get\`: متابعة حالات الـ Workflows ودورات التشغيل.
   - \`get_job_logs\`: قراءة سجلات فشل البناء وتشخيص أخطاء الـ CI/CD.
   - \`actions_run_trigger\`: تشغيل أي Workflow يدوياً (\`workflow_dispatch\`).

5. **الأمان واكتشاف الثغرات (Security & Alerts):**
   - \`list_code_scanning_alerts\`: استعراض نتائج الفحص الأمني للأكواد.
   - \`list_dependabot_alerts\`: فحص تنبيهات الثغرات في الحزم والمكتبات.
   - \`list_secret_scanning_alerts\`: كشف أي مفاتيح مسربة في الكود.

6. **المجتمع والمقتطفات (Discussions, Gists & Stars):**
   - \`list_discussions\` / \`get_discussion\`: متابعة نقاشات المطورين.
   - \`list_gists\` / \`create_gist\`: إنشاء وقراءة مقتطفات الأكواد.
   - \`list_starred_repositories\` / \`star_repository\`: إدارة المستودعات المميزة بنجمة.

7. **السياق والمستخدم (Context & Me):**
   - \`get_me\`: استعراض بيانات حسابك والمستودعات التابعة لك.
   - \`github_support_docs_search\`: البحث الفوري في توثيق ودليل GitHub الرسمي.

💡 **أمثلة لما يمكنك طلبه الآن:**
- *"اعرضلي قائمة مستودعاتي في GitHub"*
- *"هل توجد مشاكل (Issues) مفتوحة في المستودع؟"*
- *"اعرضلي آخر طلبات السحب (Pull Requests)"*
- *"ابعتلي آخر الكوميتس (Commits)"*
- *"اقرألي ملف package.json"*`
  }

  // 2. Select target tool based on user intent
  let tool = 'search_repositories'
  const params: Record<string, any> = {}

  // Extract branch name if specified (e.g., "لفرع main" or "branch main")
  const branchMatch = content.match(/(?:ل?فرع|branch)\s+([a-zA-Z0-9_.-]+)/i)
  if (branchMatch) {
    params.sha = branchMatch[1]
  }

  // Extract explicit repo name if specified (e.g., "ريبو اسمه azallabs" or "مستودع azallabs")
  const repoNameMatch = content.match(/(?:ريبو\s+اسمه|مستودع\s+اسمه|مستودع|ريبو|repo)\s+([a-zA-Z0-9_.-]+)/i)
  if (repoNameMatch) {
    const candidateRepo = repoNameMatch[1].trim()
    if (!['في', 'عندي', 'بتاعي', 'بتعتي', 'main', 'master'].includes(candidateRepo.toLowerCase())) {
      params.repo = candidateRepo
    }
  }

  if (lower.includes('مستودع') || lower.includes('مستودعات') || lower.includes('repo') || lower.includes('repos') || lower.includes('مشاريعي')) {
    if (lower.includes('فرع') || lower.includes('فروع') || lower.includes('branch')) {
      tool = 'list_branches'
    } else if (lower.includes('شجرة') || lower.includes('tree') || lower.includes('ملفات المستودع')) {
      tool = 'get_repository_tree'
    } else if (lower.includes('commit') || lower.includes('كوميت') || lower.includes('إيداع') || lower.includes('ايداعات')) {
      tool = 'list_commits'
    } else {
      tool = 'search_repositories'
      if (params.repo) {
        params.query = params.repo
      }
    }
  } else if (lower.includes('issue') || lower.includes('مشكلة') || lower.includes('مشاكل') || lower.includes('ايشو') || lower.includes('قضايا')) {
    tool = 'list_issues'
  } else if (lower.includes('pr') || lower.includes('pull') || lower.includes('سحب') || lower.includes('دمج') || lower.includes('بول ريكويست')) {
    tool = 'list_pull_requests'
  } else if (lower.includes('commit') || lower.includes('كوميت') || lower.includes('إيداع') || lower.includes('ايداعات')) {
    tool = 'list_commits'
  } else if (lower.includes('branch') || lower.includes('فرع') || lower.includes('فروع')) {
    tool = 'list_branches'
  } else if (lower.includes('action') || lower.includes('workflow') || lower.includes('أكشن') || lower.includes('سير العمل') || lower.includes('ci')) {
    tool = 'actions_list'
  } else if (lower.includes('alert') || lower.includes('أمان') || lower.includes('ثغرات') || lower.includes('تنبيه') || lower.includes('security')) {
    tool = 'list_code_scanning_alerts'
  } else if (lower.includes('gist') || lower.includes('مقتطف')) {
    tool = 'list_gists'
  } else if (lower.includes('star') || lower.includes('نجمة') || lower.includes('مفضلة')) {
    tool = 'list_starred_repositories'
  } else if (lower.includes('user') || lower.includes('حسابي') || lower.includes('بروفايل') || lower.includes('من أنا')) {
    tool = 'get_me'
  } else if (lower.includes('doc') || lower.includes('توثيق') || lower.includes('شرح') || lower.includes('ازاي')) {
    tool = 'github_support_docs_search'
    params.query = content.replace(/github|جيتهاب|جيت هاب|ابحث|في|عن|توثيق/gi, '').trim() || content
  } else if (lower.includes('ملف') || lower.includes('اقرأ') || lower.includes('file') || lower.includes('محتوى')) {
    tool = 'get_file_contents'
    const fileMatch = content.match(/([a-zA-Z0-9_\-./]+\.[a-zA-Z0-9]+)/)
    if (fileMatch) {
      params.path = fileMatch[1]
    }
  } else {
    // Default to listing user's repositories
    tool = 'search_repositories'
  }

  // Auto-resolve repository context if tool needs owner & repo
  const repoTools = [
    'list_issues',
    'issue_read',
    'list_pull_requests',
    'pull_request_read',
    'list_commits',
    'list_branches',
    'get_repository_tree',
    'get_file_contents',
    'actions_list',
    'list_code_scanning_alerts',
  ]

  if (repoTools.includes(tool)) {
    try {
      const cleanContent = content.replace(/(github|جيتهاب|جيت هاب|مستودع|المستودع|مشاكل|issues|commits|pulls|branches)/gi, '').trim()
      let contextStr = cleanContent
      if (!params.repo && _existingMsgs && _existingMsgs.length > 0) {
        // Look back up to 3 messages to find recently discussed repository names
        const recentHistory = _existingMsgs.slice(-3).map((m: any) => typeof m.content === 'string' ? m.content : '').join(' ')
        contextStr = cleanContent + ' ' + recentHistory
      }
      
      const resolved = await resolveGitHubContext(token, params.repo || contextStr || undefined)
      if (resolved.owner) params.owner = resolved.owner
      if (resolved.repo) params.repo = resolved.repo
      if (resolved.fullName) params.fullName = resolved.fullName
      if (resolved.defaultBranch && !params.sha) params.defaultBranch = resolved.defaultBranch
    } catch {}
  }

  // 3. Execute tool
  let execResult: any = null

  const isAskingForOwnRepos =
    (lower.includes('مستودع') || lower.includes('مستودعات') || lower.includes('repo') || lower.includes('repos') || lower.includes('مشاريعي') || lower.includes('مشاريع')) &&
    !lower.includes('commit') &&
    !lower.includes('كوميت') &&
    !lower.includes('فرع') &&
    !lower.includes('فروع') &&
    !lower.includes('branch') &&
    !lower.includes('issue') &&
    !lower.includes('مشكلة') &&
    !lower.includes('مشاكل') &&
    !lower.includes('pr') &&
    !lower.includes('pull') &&
    !lower.includes('شجرة') &&
    !lower.includes('tree')

  if (isAskingForOwnRepos || tool === 'search_repositories' || tool === 'list_repositories') {
    try {
      const repos = await fetchGitHubRepos(token, 'updated', 100)
      const target = (params.repo || params.query || '').toLowerCase().trim()
      if (target) {
        const filtered = repos.filter((r: any) =>
          r.name?.toLowerCase().includes(target) ||
          (r.description && r.description.toLowerCase().includes(target))
        )
        execResult = {
          success: true,
          result: filtered,
          serverName: 'GitHub MCP',
          toolName: 'search_repositories',
        }
      } else {
        execResult = {
          success: true,
          result: repos,
          serverName: 'GitHub MCP',
          toolName: 'list_repositories',
        }
      }
    } catch (e: any) {
      execResult = await exec(tool, params)
    }
  } else if (tool === 'list_commits') {
    try {
      const resolved = await resolveGitHubContext(token, params.repo || content)
      const owner = params.owner || resolved.owner
      const repo = params.repo || resolved.repo
      if (owner && repo) {
        params.owner = owner
        params.repo = repo
        const commits = await fetchGitHubRepoCommits(owner, repo, token, 20, params.sha)
        execResult = {
          success: true,
          result: { owner, repo, commits },
          serverName: 'GitHub MCP',
          toolName: 'list_commits',
        }
      } else {
        execResult = await exec(tool, params)
      }
    } catch (e: any) {
      execResult = await exec(tool, params)
    }
  } else {
    execResult = await exec(tool, params)
  }

  // Direct resilient fallback if tool failed or returned empty
  const isReposListEmpty =
    (Array.isArray(execResult?.result) && execResult.result.length === 0) ||
    (Array.isArray(execResult?.result?.items) && execResult.result.items.length === 0) ||
    !execResult?.result

  if ((tool === 'search_repositories' || tool === 'list_repositories') && (!execResult?.success || isReposListEmpty)) {
    try {
      const directRepos = await fetchGitHubRepos(token, 'updated', 100)
      if (Array.isArray(directRepos) && directRepos.length > 0) {
        if (params.query || params.repo) {
          const q = (params.query || params.repo).toLowerCase().trim()
          const filtered = directRepos.filter((r: any) =>
            r.name?.toLowerCase().includes(q) ||
            (r.description && r.description.toLowerCase().includes(q))
          )
          execResult = {
            success: true,
            result: filtered.length > 0 ? filtered : directRepos,
            serverName: 'GitHub MCP',
            toolName: 'search_repositories',
          }
        } else {
          execResult = {
            success: true,
            result: directRepos,
            serverName: 'GitHub MCP',
            toolName: 'list_repositories',
          }
        }
      }
    } catch (e: any) {
      console.warn('Direct fallback repos fetch error:', e)
    }
  }

  if (!execResult?.success) {
    const msg = execResult?.errorMessage || 'خطأ غير معروف'
    return `⚠️ تعذر تنفيذ العملية على خادم GitHub MCP: ${msg}\n\nيرجى التأكد من صلاحية رمز الوصول (Personal Access Token) في [صفحة الإعدادات](/settings?tab=mcp).`
  }

  return naturalGitHubAnswer(tool, params, execResult.result, content, systemPrompt, llmConfig)
}

async function naturalGitHubAnswer(
  tool: string,
  params: Record<string, any>,
  result: any,
  userQuestion: string,
  systemPrompt: string,
  llmConfig: LlmConfigState
): Promise<string> {
  const formatted = formatGitHubResult(tool, params, result)

  const sys = `${systemPrompt}

أنت مساعد Azal Labs الذكي المتصل مباشرة بخادم GitHub MCP الرسمي عبر https://api.githubcopilot.com/mcp/.
استخدم البيانات الحقيقية والمؤكدة أدناه للإجابة على المستخدم باللغة العربية بدقة وموضوعية.
قواعد صارمة جداً (Zero Hallucination):
1. التزم بالبيانات المسترجعة من GitHub فقط.
2. لا تذكر أي مشاريع أو مهام من TickTick أو Vercel إطلاقاً ما لم يطلب المستخدم ذلك صراحة.
3. استخدم جداول Markdown المنظمة لعرض المستودعات، المشاكل، وطلبات السحب.
4. اذكر دائماً عدد العناصر المؤكد في البداية.

=== البيانات الحقيقية المسترجعة من خادم GitHub MCP (${tool}) ===
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

function formatGitHubResult(tool: string, params: Record<string, any>, result: any): string {
  // 1. Repositories
  if (tool === 'search_repositories' || tool === 'list_repositories') {
    const rawRepos = Array.isArray(result)
      ? result
      : Array.isArray(result?.items)
      ? result.items
      : Array.isArray(result?.repositories)
      ? result.repositories
      : []

    const targetQuery = params.repo || params.query
    if (!rawRepos.length) {
      if (targetQuery) {
        return (
          `❌ **لم يتم العثور على مستودع باسم "${targetQuery}" في حسابك على GitHub.**\n\n` +
          `يرجى التأكد من كتابة الاسم بدقة، أو اطلب: «اعرضلي قائمة مستودعاتي» للاطلاع على كافة المستودعات المسجلة لديك.`
        )
      }
      return (
        '✅ **تم الاتصال بنجاح بخادم GitHub MCP.**\n\n' +
        'لا توجد مستودعات مطابقة حالياً في حساب GitHub الخاص بك.'
      )
    }

    const rows = rawRepos.slice(0, 30).map((r: any) => {
      const name = r.name || 'بدون اسم'
      const fullName = r.full_name || name
      const url = r.html_url || `https://github.com/${fullName}`
      const lang = r.language || 'Markdown / Other'
      const stars = r.stargazers_count ?? 0
      const isPrivate = r.private ? '🔒 خاص' : '🌍 عام'
      const updated = r.updated_at ? new Date(r.updated_at).toLocaleDateString('ar-EG') : 'حديثاً'

      return `| [**${name}**](${url}) | \`${fullName}\` | ${lang} | ${isPrivate} | ⭐ ${stars} | ${updated} |`
    })

    const headerTitle = targetQuery
      ? `### 🐙 نتائج البحث عن مستودع: **${targetQuery}** (${rawRepos.length} مستودع مطابِق)`
      : `### 🐙 مستودعاتك في GitHub (إجمالي ${rawRepos.length} مستودع)`

    return (
      `${headerTitle}\n\n` +
      `تم استرجاع المستودعات مباشرة وحصرياً من حسابك عبر \`GitHub MCP\`:\n\n` +
      `| اسم المستودع | المسار الكامل | لغة البرمجة | الخصوصية | النجوم | آخر تحديث |\n` +
      `| :--- | :--- | :--- | :--- | :--- | :--- |\n` +
      rows.join('\n') +
      `\n\n💡 يمكنك سؤالي عن محتوى أي مستودع، فحص ملفاته، استعراض المشاكل (Issues)، أو مراجعة طلبات السحب (Pull Requests).`
    )
  }

  // 2. Issues
  if (tool === 'list_issues') {
    const issues = Array.isArray(result?.issues)
      ? result.issues
      : Array.isArray(result)
      ? result
      : []

    const repoName = params.fullName || (params.owner && params.repo ? `${params.owner}/${params.repo}` : 'المستودع')

    if (!issues.length) {
      return (
        `### 📌 المشاكل والمهام (Issues) لمستودع: **${repoName}**\n\n` +
        `🎉 **رائع! لا توجد مشاكل مفتوحة (Open Issues) في هذا المستودع حالياً.**`
      )
    }

    const rows = issues.map((iss: any) => {
      const num = iss.number || '—'
      const title = (iss.title || 'بدون عنوان').slice(0, 60)
      const url = iss.html_url || '#'
      const author = iss.user?.login || 'مجهول'
      const state = iss.state === 'open' ? '🟢 مفتوح' : '🟣 مغلق'
      const labels = Array.isArray(iss.labels) && iss.labels.length > 0
        ? iss.labels.map((l: any) => `\`${l.name || l}\``).join(' ')
        : '—'
      const created = iss.created_at ? new Date(iss.created_at).toLocaleDateString('ar-EG') : '—'

      return `| [#${num}](${url}) | **${title}** | ${state} | \`${author}\` | ${labels} | ${created} |`
    })

    return (
      `### 📌 قائمة المشاكل والمهام (Issues) لمستودع: **${repoName}** (${issues.length})\n\n` +
      `| الرقم | عنوان المشكلة | الحالة | الكاتب | التصنيفات | تاريخ الإنشاء |\n` +
      `| :--- | :--- | :--- | :--- | :--- | :--- |\n` +
      rows.join('\n')
    )
  }

  // 3. Pull Requests
  if (tool === 'list_pull_requests') {
    const pulls = Array.isArray(result?.pull_requests)
      ? result.pull_requests
      : Array.isArray(result)
      ? result
      : []

    const repoName = params.fullName || (params.owner && params.repo ? `${params.owner}/${params.repo}` : 'المستودع')

    if (!pulls.length) {
      return (
        `### 🔀 طلبات السحب (Pull Requests) لمستودع: **${repoName}**\n\n` +
        `لا توجد طلبات سحب مفتوحة حالياً في هذا المستودع.`
      )
    }

    const rows = pulls.map((pr: any) => {
      const num = pr.number || '—'
      const title = (pr.title || 'بدون عنوان').slice(0, 60)
      const url = pr.html_url || '#'
      const state = pr.state === 'open' ? '🟢 مفتوح' : pr.merged_at ? '🟣 مدمج (Merged)' : '🔴 مغلق'
      const head = pr.head?.ref || '—'
      const base = pr.base?.ref || 'main'
      const author = pr.user?.login || 'مجهول'
      const created = pr.created_at ? new Date(pr.created_at).toLocaleDateString('ar-EG') : '—'

      return `| [#${num}](${url}) | **${title}** | ${state} | \`${head}\` ➔ \`${base}\` | \`${author}\` | ${created} |`
    })

    return (
      `### 🔀 طلبات السحب (Pull Requests) لمستودع: **${repoName}** (${pulls.length})\n\n` +
      `| الرقم | العنوان | الحالة | الفروع | الكاتب | التاريخ |\n` +
      `| :--- | :--- | :--- | :--- | :--- | :--- |\n` +
      rows.join('\n')
    )
  }

  // 4. Commits
  if (tool === 'list_commits') {
    const commits = Array.isArray(result?.commits)
      ? result.commits
      : Array.isArray(result)
      ? result
      : []

    const repoName = params.fullName || (params.owner && params.repo ? `${params.owner}/${params.repo}` : 'المستودع')

    if (!commits.length) {
      return `### 📜 سجل الإيداعات (Commits)\n\nالمستودع: **${repoName}**\n\nلا توجد إيداعات مسجلة حديثاً.`
    }

    const rows = commits.slice(0, 20).map((c: any) => {
      const sha = (c.sha || '').slice(0, 7)
      const url = c.html_url || '#'
      const msg = (c.commit?.message || 'بدون رسالة').split('\n')[0].slice(0, 65)
      const author = c.commit?.author?.name || c.author?.login || 'مجهول'
      const date = c.commit?.author?.date ? new Date(c.commit.author.date).toLocaleString('ar-EG') : '—'

      return `| [\`${sha}\`](${url}) | ${msg} | \`${author}\` | ${date} |`
    })

    return (
      `### 📜 أحدث الـ Commits في مستودع: **${repoName}** (${commits.length})\n\n` +
      `| الـ SHA | رسالة الـ Commit | الكاتب | التاريخ والوقت |\n` +
      `| :--- | :--- | :--- | :--- |\n` +
      rows.join('\n')
    )
  }

  // 5. Branches
  if (tool === 'list_branches') {
    const branches = Array.isArray(result?.branches)
      ? result.branches
      : Array.isArray(result)
      ? result
      : []

    const repoName = params.fullName || (params.owner && params.repo ? `${params.owner}/${params.repo}` : 'المستودع')

    if (!branches.length) {
      return `### 🌿 فروع المستودع (Branches)\n\nالمستودع: **${repoName}**\n\nلم يتم العثور على فروع مسجلة.`
    }

    const rows = branches.map((b: any) => {
      const name = b.name || '—'
      const protectedBadge = b.protected ? '🛡️ محمي' : 'عادي'
      const sha = (b.commit?.sha || '').slice(0, 7)
      return `| **${name}** | \`${sha}\` | ${protectedBadge} |`
    })

    return (
      `### 🌿 فروع المستودع (Branches) لمستودع: **${repoName}** (${branches.length})\n\n` +
      `| اسم الفرع | آخر Commit SHA | الحماية |\n` +
      `| :--- | :--- | :--- |\n` +
      rows.join('\n')
    )
  }

  // 6. File Contents
  if (tool === 'get_file_contents') {
    const filePath = params.path || result?.path || 'ملف'
    const content = result?.content
      ? typeof result.content === 'string'
        ? result.content
        : JSON.stringify(result.content, null, 2)
      : typeof result === 'string'
      ? result
      : JSON.stringify(result, null, 2)

    return (
      `### 📄 محتويات الملف: \`${filePath}\`\n\n` +
      `\`\`\`\n` +
      content.slice(0, 3000) +
      (content.length > 3000 ? '\n... (تم اقتطاع باقي المحتوى لطوله)' : '') +
      `\n\`\`\``
    )
  }

  // 7. Get Me (User profile)
  if (tool === 'get_me') {
    const u = result?.user || result || {}
    const login = u.login || 'User'
    const name = u.name ? ` (${u.name})` : ''
    const repos = u.public_repos ?? '—'
    const privRepos = u.total_private_repos ?? '—'
    const url = u.html_url || `https://github.com/${login}`

    return (
      `### 👤 بيانات حسابك على GitHub\n\n` +
      `- **المستخدم:** [**@${login}**](${url})${name}\n` +
      `- **المستودعات العامة:** ${repos}\n` +
      `- **المستودعات الخاصة:** ${privRepos}\n` +
      `- **معرف الحساب (ID):** \`${u.id || 'N/A'}\`\n\n` +
      `✅ الحساب متصل وجاهز لتنفيذ كافة أوامر المستودعات والكود.`
    )
  }

  // 8. Documentation
  if (tool === 'github_support_docs_search') {
    return (
      `### 📚 نتائج استعلام توثيق GitHub\n\n` +
      `الموضوع: **"${params.query || 'GitHub Documentation'}"**\n\n` +
      (result?.message || 'تم العثور على وثائق GitHub الرسمية.') +
      (result?.docsUrl ? `\n\n🔗 [انقر هنا للانتقال إلى صفحة التوثيق الرسمية](${result.docsUrl})` : '')
    )
  }

  // 9. Generic Fallback
  return `✅ **تم تنفيذ الأداة \`${tool}\` على خادم GitHub MCP بنجاح.**\n\n\`\`\`json\n${JSON.stringify(result, null, 2)}\n\`\`\``
}
