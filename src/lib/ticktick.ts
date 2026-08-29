export const TICKTICK_CLIENT_ID = import.meta.env.VITE_TICKTICK_CLIENT_ID || ''

export const TICKTICK_CLIENT_SECRET = import.meta.env.VITE_TICKTICK_CLIENT_SECRET || ''
export const getRedirectUri = () => {
  // Allow forcing the canonical production URL via VITE_APP_URL (useful behind
  // proxies / when window.location.origin is not the public domain).
  const base =
    import.meta.env.VITE_APP_URL ||
    (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5174')
  return `${base}/auth/ticktick/callback`
}

export const TICKTICK_TOKEN_KEY = 'azal_ticktick_access_token'

export const getTickTickToken = (): string | null => {
  return localStorage.getItem(TICKTICK_TOKEN_KEY)
}

export const setTickTickToken = (token: string) => {
  localStorage.setItem(TICKTICK_TOKEN_KEY, token)
}

export const clearTickTickToken = () => {
  localStorage.removeItem(TICKTICK_TOKEN_KEY)
}

/**
 * Parse a TickTick API response as JSON, with resilient handling for the two
 * real-world failure modes that otherwise surface as the opaque
 * "Unexpected token '<', '<!doctype' is not valid JSON" error:
 *   1. The access token is invalid/expired → TickTick (or the SPA fallback when
 *      running without the dev proxy) returns an HTML page instead of JSON.
 *   2. Any non-JSON (HTML) body — e.g. when the /api/ticktick proxy is missing
 *      because the app is served from a build/preview server instead of `vite dev`.
 * On an auth failure we clear the stored token so the user is prompted to reconnect.
 */
async function parseTickTickJson(response: Response, label: string): Promise<any> {
  const raw = await response.text()
  const trimmed = raw.trimStart()

  if (trimmed.startsWith('<!') || trimmed.toLowerCase().startsWith('<!doctype')) {
    // If the HTML is our own SPA (index.html), it means the /api/ticktick proxy
    // is absent — the request never left the app. TickTick's API has no browser
    // CORS support, so it MUST be reached through the dev/preview proxy.
    const isOurSpaFallback =
      /<div id="root"/.test(trimmed) ||
      /<script[^>]+src="\/assets\//.test(trimmed) ||
      trimmed.includes('crossorigin')
    if (isOurSpaFallback) {
      throw new Error(
        `خادم الـ API proxy غير مُفعّل: وصل طلب TickTick لصفحة التطبيق نفسه (index.html) بدل خادم TickTick. السبب: أنت تشغّل نسخة مبنية (dist) بدون خادم proxy. الحل: شغّل التطبيق عبر "npm run dev" (أو "npm run preview") — ولا تفتح ملف index.html مباشرة ولا تستخدم خادم static عادي.`
      )
    }
    if (response.status === 401 || response.status === 403) {
      clearTickTickToken()
      throw new Error(
        `انتهت صلاحية أو رُفض توكن TickTick (${response.status}). أعد ربط حسابك من صفحة الإعدادات ثم أعد المحاولة.`
      )
    }
    throw new Error(
      `رجّع خادم TickTick صفحة HTML بدل JSON عند "${label}". السبب: توكن TickTick غير صالح/منتهٍ — أعد ربطه من صفحة الإعدادات (تبويب خوادم الربط).`
    )
  }

  if (response.status === 401 || response.status === 403) {
    clearTickTickToken()
    let detail = raw
    try {
      const j = JSON.parse(raw)
      detail = j?.error_description || j?.error || j?.message || raw
    } catch {
      /* keep raw */
    }
    throw new Error(`توكن TickTick غير صالح أو منتهٍ (${response.status}): ${detail}. أعد ربط حسابك من الإعدادات.`)
  }

  if (!response.ok) {
    let detail = raw
    try {
      const j = JSON.parse(raw)
      detail = j?.error_description || j?.error || j?.message || raw
    } catch {
      /* keep raw */
    }
    throw new Error(`فشل ${label} في TickTick (${response.status}): ${detail}`)
  }

  if (trimmed.length === 0) return null
  try {
    return JSON.parse(raw)
  } catch {
    throw new Error(`تعذّر تحليل رد TickTick كـ JSON عند "${label}".`)
  }
}

// 1. توليد رابط تفويض OAuth الحقيقي
export const getTickTickAuthUrl = () => {
  const redirectUri = getRedirectUri()
  const params = new URLSearchParams({
    client_id: TICKTICK_CLIENT_ID,
    scope: 'tasks:write tasks:read',
    response_type: 'code',
    redirect_uri: redirectUri,
    state: 'azal_ticktick_' + Math.random().toString(36).substring(2, 8),
  })

  return `https://ticktick.com/oauth/authorize?${params.toString()}`
}

// 2. تبادل الـ Code بالـ Access Token الفعلي
export const exchangeTickTickCode = async (code: string): Promise<{ access_token: string; token_type: string; expires_in?: number }> => {
  const redirectUri = getRedirectUri()

  const bodyParams = new URLSearchParams({
    client_id: TICKTICK_CLIENT_ID,
    client_secret: TICKTICK_CLIENT_SECRET,
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
  })

  const response = await fetch('/api/ticktick/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: bodyParams.toString(),
  })

  const data = await parseTickTickJson(response, 'تبادل التوكن')
  if (!data.access_token) {
    throw new Error(data.error_description || data.error || 'لم يتم استلام access_token من TickTick')
  }

  return data
}

export interface TickTickProject {
  id: string
  name: string
  color?: string
  closed?: boolean
}

// 3. جلب المشاريع وقوائم المهام الحقيقية من حساب المستخدم في TickTick
export const fetchTickTickProjects = async (token?: string): Promise<TickTickProject[]> => {
  const activeToken = token || getTickTickToken()
  if (!activeToken) throw new Error('No TickTick access token found')

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 3000)

  try {
    const response = await fetch('/api/ticktick/open/project', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${activeToken}`,
      },
      signal: controller.signal,
    })

    clearTimeout(timer)
    return await parseTickTickJson(response, 'جلب المشاريع')
  } catch (err) {
    clearTimeout(timer)
    throw err
  }
}

// 4. إنشاء مشروع جديد في TickTick إذا لزم الأمر
export const createTickTickProject = async (name: string, token?: string): Promise<TickTickProject> => {
  const activeToken = token || getTickTickToken()
  if (!activeToken) throw new Error('لا يوجد رمز وصول (Token) لـ TickTick')

  const response = await fetch('/api/ticktick/open/project', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${activeToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name }),
  })

  return await parseTickTickJson(response, 'إنشاء المشروع')
}

// 5. البحث عن مشروع بالاسم أو إنشاؤه
export const findOrCreateProject = async (projectName: string, token?: string): Promise<TickTickProject> => {
  const projects = await fetchTickTickProjects(token)
  const normalizedTarget = projectName.trim().toLowerCase()

  const found = projects.find(
    (p) => p.name.trim().toLowerCase() === normalizedTarget || p.name.toLowerCase().includes(normalizedTarget)
  )

  if (found) {
    return found
  }

  // إنشاء المشروع إذا لم يكن موجوداً
  try {
    const created = await createTickTickProject(projectName.trim(), token)
    return created
  } catch {
    // إذا تعذر الإنشاء، إرجاع المشروع الأول أو الافتراضي
    return projects[0] || { id: '', name: projectName }
  }
}

export function formatTickTickDueDate(dateOrStr?: string | Date): string {
  let d: Date
  if (!dateOrStr) {
    d = new Date(Date.now() + 86400000)
  } else if (typeof dateOrStr === 'string') {
    if (dateOrStr.includes('T') && dateOrStr.includes('+')) {
      return dateOrStr
    }
    d = new Date(dateOrStr)
    if (isNaN(d.getTime())) {
      d = new Date(Date.now() + 86400000)
    }
  } else {
    d = dateOrStr
  }

  const pad = (n: number) => n.toString().padStart(2, '0')
  const yyyy = d.getFullYear()
  const MM = pad(d.getMonth() + 1)
  const dd = pad(d.getDate())
  return `${yyyy}-${MM}-${dd}T09:00:00+0000`
}

// 6. إنشاء مهمة حقيقية في حساب المستخدم على TickTick (مع دعم تحديد اسم المشروع أو معرّفه)
export const createTickTickTask = async (
  task: { title: string; content?: string; dueDate?: string; projectId?: string; projectName?: string },
  token?: string
) => {
  const activeToken = token || getTickTickToken()
  if (!activeToken) throw new Error('لا يوجد رمز وصول (Token) لـ TickTick')

  let resolvedProjectId = task.projectId

  // إذا تم تمرير اسم المشروع، نبحث عن المعرف المناسب
  if (!resolvedProjectId && task.projectName) {
    try {
      const project = await findOrCreateProject(task.projectName, activeToken)
      resolvedProjectId = project.id
    } catch (e) {
      console.warn('Could not resolve project by name:', e)
    }
  }

  const payload: Record<string, any> = {
    title: task.title,
    content: task.content || '',
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Africa/Cairo',
  }

  if (task.dueDate) {
    payload.dueDate = formatTickTickDueDate(task.dueDate)
  }

  if (resolvedProjectId) {
    payload.projectId = resolvedProjectId
  }

  const response = await fetch('/api/ticktick/open/task', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${activeToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  const createdTask = await parseTickTickJson(response, 'إنشاء المهمة')
  return {
    ...createdTask,
    targetProjectName: task.projectName,
  }
}

export interface TickTickTask {
  id: string
  projectId: string
  title: string
  content?: string
  status?: number // 0 = active/uncompleted, 2 = completed
  dueDate?: string
}

// 7. جلب تفاصيل وبيانات مشروع معين بما في ذلك مهامه الفعلية
export const fetchProjectData = async (
  projectId: string,
  token?: string
): Promise<{ project: TickTickProject; tasks: TickTickTask[] }> => {
  const activeToken = token || getTickTickToken()
  if (!activeToken) throw new Error('لا يوجد رمز وصول (Token) لـ TickTick')

  const response = await fetch(`/api/ticktick/open/project/${projectId}/data`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${activeToken}`,
    },
  })

  const data = await parseTickTickJson(response, 'جلب بيانات المشروع')
  return {
    project: data.project,
    tasks: Array.isArray(data.tasks) ? data.tasks : [],
  }
}

// 8. جلب المهام الحقيقية لمشروع معين عبر اسمه (مثل 800 Academy أو Inspire)
export const fetchTasksByProjectName = async (
  projectName: string,
  token?: string
): Promise<{ project: TickTickProject | null; tasks: TickTickTask[] }> => {
  const activeToken = token || getTickTickToken()
  if (!activeToken) throw new Error('لا يوجد رمز وصول (Token) لـ TickTick')

  const projects = await fetchTickTickProjects(activeToken)
  const normalizedTarget = projectName.trim().toLowerCase()

  const project = projects.find(
    (p) =>
      p.name.trim().toLowerCase() === normalizedTarget ||
      p.name.toLowerCase().includes(normalizedTarget) ||
      normalizedTarget.includes(p.name.toLowerCase())
  )

  if (!project) {
    return { project: null, tasks: [] }
  }

  const data = await fetchProjectData(project.id, activeToken)
  return {
    project,
    tasks: data.tasks || [],
  }
}

// 9. تعديل مهمة موجودة في TickTick (مثل تعديل الموعد أو العنوان أو إكمالها)
export const updateTickTickTask = async (
  task: { id: string; projectId: string; title?: string; content?: string; dueDate?: string; status?: number },
  token?: string
): Promise<TickTickTask> => {
  const activeToken = token || getTickTickToken()
  if (!activeToken) throw new Error('لا يوجد رمز وصول (Token) لـ TickTick')

  const payload: Record<string, any> = {
    id: task.id,
    projectId: task.projectId,
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Africa/Cairo',
  }
  if (task.title) payload.title = task.title
  if (task.content !== undefined) payload.content = task.content
  if (task.dueDate) payload.dueDate = formatTickTickDueDate(task.dueDate)
  if (typeof task.status === 'number') payload.status = task.status

  const response = await fetch(`/api/ticktick/open/task/${task.id}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${activeToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  return await parseTickTickJson(response, 'تحديث المهمة')
}

// 10. حذف مشروع من TickTick نهائياً (لا يمكن التراجع عنه)
export const deleteTickTickProject = async (projectId: string, token?: string): Promise<void> => {
  const activeToken = token || getTickTickToken()
  if (!activeToken) throw new Error('لا يوجد رمز وصول (Token) لـ TickTick')
  if (!projectId) throw new Error('معرّف المشروع (projectId) مطلوب للحذف')

  const response = await fetch(`/api/ticktick/open/project/${encodeURIComponent(projectId)}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${activeToken}`,
    },
  })

  await parseTickTickJson(response, 'حذف المشروع')
}

// 11. حذف مهمة من TickTick نهائياً (لا يمكن التراجع عنه)
export const deleteTickTickTask = async (
  projectId: string,
  taskId: string,
  token?: string
): Promise<void> => {
  const activeToken = token || getTickTickToken()
  if (!activeToken) throw new Error('لا يوجد رمز وصول (Token) لـ TickTick')
  if (!projectId || !taskId) {
    throw new Error('معرّف المشروع (projectId) ومعرّف المهمة (taskId) مطلوبان للحذف')
  }

  const response = await fetch(
    `/api/ticktick/open/project/${encodeURIComponent(projectId)}/task/${encodeURIComponent(taskId)}`,
    {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${activeToken}`,
      },
    }
  )

  await parseTickTickJson(response, 'حذف المهمة')
}
