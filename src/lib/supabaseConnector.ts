// =========================================================================
// Supabase Connector
// -------------------------------------------------------------------------
// Enables ANY user to connect THEIR OWN Supabase project so the Azal Labs AI
// agent can introspect the schema, read data, and execute queries directly
// against it (mirrors the TickTick token-based integration pattern).
//
// Credentials are stored ONLY in the user's browser (localStorage). They are
// never sent to the Azal Labs backend.
// =========================================================================

export interface SupabaseConnection {
  // e.g. https://abcdefg.supabase.co
  projectUrl: string
  // Publishable / anon key (used for reads via PostgREST, respecting RLS)
  anonKey: string
  // Optional: Service Role key (bypasses RLS — only use from a trusted browser session)
  serviceRoleKey?: string
  // Optional: Supabase Personal Access Token (Management API) to run arbitrary SQL
  managementToken?: string
}

const STORAGE_KEY = 'azal_supabase_connection'

export const getSupabaseConnection = (): SupabaseConnection | null => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as SupabaseConnection
    if (!parsed.projectUrl || !parsed.anonKey) return null
    return parsed
  } catch {
    return null
  }
}

export const setSupabaseConnection = (conn: SupabaseConnection) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(conn))
}

export const clearSupabaseConnection = () => {
  localStorage.removeItem(STORAGE_KEY)
}

export const isSupabaseConnected = (): boolean => {
  const c = getSupabaseConnection()
  return Boolean(c && c.projectUrl && c.anonKey)
}

// Extract the project ref (subdomain) from the project URL.
export const getSupabaseProjectRef = (url: string): string | null => {
  const match = url.match(/https?:\/\/([a-z0-9-]+)\.supabase\.(co|in|net)/i)
  return match ? match[1] : null
}

// The active API key (prefer service role when present for full read/write power).
const activeKey = (conn: SupabaseConnection) => conn.serviceRoleKey || conn.anonKey

// -------------------------------------------------------------------------
// Low-level PostgREST helpers
// -------------------------------------------------------------------------
async function postgrest(
  conn: SupabaseConnection,
  path: string,
  options: { method?: string; body?: any; prefer?: string } = {}
): Promise<{ ok: boolean; status: number; data: any; error?: string }> {
  const apiKey = activeKey(conn)
  const headers: Record<string, string> = {
    apikey: apiKey,
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  }
  if (options.prefer) headers['Prefer'] = options.prefer

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 12000)

  try {
    const res = await fetch(`${conn.projectUrl.replace(/\/$/, '')}/rest/v1/${path}`, {
      method: options.method || 'GET',
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    })
    clearTimeout(timeout)

    const text = await res.text()
    let data: any = null
    try {
      data = text ? JSON.parse(text) : null
    } catch {
      data = text
    }

    if (!res.ok) {
      const message =
        (data && (data.message || data.error_description || data.error)) ||
        `HTTP ${res.status}`
      return { ok: false, status: res.status, data: null, error: String(message) }
    }
    return { ok: true, status: res.status, data }
  } catch (err: any) {
    clearTimeout(timeout)
    return { ok: false, status: 0, data: null, error: err?.message || 'فشل الاتصال بـ Supabase' }
  }
}

// -------------------------------------------------------------------------
// OpenAPI introspection (list tables / describe columns)
// -------------------------------------------------------------------------
async function fetchOpenApi(conn: SupabaseConnection): Promise<any | null> {
  const apiKey = activeKey(conn)
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 12000)
  try {
    const res = await fetch(`${conn.projectUrl.replace(/\/$/, '')}/rest/v1/`, {
      method: 'GET',
      headers: { apikey: apiKey, Authorization: `Bearer ${apiKey}`, Accept: 'application/openapi+json' },
      signal: controller.signal,
    })
    clearTimeout(timeout)
    if (!res.ok) return null
    return await res.json()
  } catch {
    clearTimeout(timeout)
    return null
  }
}

export interface SupabaseTableInfo {
  name: string
  columns: { name: string; type: string; format?: string }[]
}

export const listSupabaseTables = async (conn: SupabaseConnection): Promise<SupabaseTableInfo[]> => {
  const spec = await fetchOpenApi(conn)
  if (!spec) return []

  const schemas = spec.components?.schemas || spec.definitions || {}
  const paths = spec.paths || {}

  // Tables exposed as top-level routes in `paths` (exclude /rpc and nested routes).
  const routeNames = Object.keys(paths).filter(
    (p) => /^\/[a-zA-Z_][a-zA-Z0-9_]*$/.test(p)
  )

  const tables: SupabaseTableInfo[] = []
  const seen = new Set<string>()

  for (const route of routeNames) {
    const name = route.slice(1)
    if (seen.has(name)) continue
    seen.add(name)

    const schema = schemas[name] || schemas[`${name}_read`] || schemas[`${name}_write`]
    const props = schema?.properties || {}
    const columns = Object.entries(props).map(([colName, def]: [string, any]) => ({
      name: colName,
      type: def?.type || def?.format || 'unknown',
      format: def?.format,
    }))

    tables.push({ name, columns })
  }

  return tables.sort((a, b) => a.name.localeCompare(b.name))
}

export const describeSupabaseTable = async (
  conn: SupabaseConnection,
  tableName: string
): Promise<SupabaseTableInfo | null> => {
  const tables = await listSupabaseTables(conn)
  return tables.find((t) => t.name.toLowerCase() === tableName.toLowerCase()) || null
}

// -------------------------------------------------------------------------
// Read query via PostgREST
// -------------------------------------------------------------------------
export const querySupabaseTable = async (
  conn: SupabaseConnection,
  params: Record<string, any>
): Promise<{ ok: boolean; data: any; error?: string; count?: number }> => {
  const { table, select = '*', limit = 50, offset = 0, order, ...rest } = params
  const query = new URLSearchParams()
  query.set('select', select)
  query.set('limit', String(limit))
  query.set('offset', String(offset))
  if (order) query.set('order', order)

  // Remaining keys are treated as PostgREST filters (e.g. status: 'eq.active')
  for (const [k, v] of Object.entries(rest)) {
    if (v === undefined || v === null || v === '') continue
    query.set(k, String(v))
  }

  const res = await postgrest(conn, `${encodeURIComponent(table)}?${query.toString()}`, {
    method: 'GET',
  })
  return { ok: res.ok, data: res.data, error: res.error }
}

// -------------------------------------------------------------------------
// Write operations via PostgREST
// -------------------------------------------------------------------------
export const insertSupabaseRow = async (
  conn: SupabaseConnection,
  table: string,
  row: Record<string, any>
): Promise<{ ok: boolean; data: any; error?: string }> => {
  const res = await postgrest(conn, encodeURIComponent(table), {
    method: 'POST',
    body: row,
    prefer: 'return=representation',
  })
  return { ok: res.ok, data: res.data, error: res.error }
}

export const updateSupabaseRow = async (
  conn: SupabaseConnection,
  table: string,
  match: Record<string, any>,
  patch: Record<string, any>
): Promise<{ ok: boolean; data: any; error?: string }> => {
  const query = new URLSearchParams()
  for (const [k, v] of Object.entries(match)) query.set(k, String(v))
  const res = await postgrest(conn, `${encodeURIComponent(table)}?${query.toString()}`, {
    method: 'PATCH',
    body: patch,
    prefer: 'return=representation',
  })
  return { ok: res.ok, data: res.data, error: res.error }
}

export const deleteSupabaseRow = async (
  conn: SupabaseConnection,
  table: string,
  match: Record<string, any>
): Promise<{ ok: boolean; data: any; error?: string }> => {
  const query = new URLSearchParams()
  for (const [k, v] of Object.entries(match)) query.set(k, String(v))
  const res = await postgrest(conn, `${encodeURIComponent(table)}?${query.toString()}`, {
    method: 'DELETE',
    prefer: 'return=representation',
  })
  return { ok: res.ok, data: res.data, error: res.error }
}

// -------------------------------------------------------------------------
// Arbitrary SQL via Supabase Management API (requires Personal Access Token)
// -------------------------------------------------------------------------
export const runSupabaseSql = async (
  conn: SupabaseConnection,
  sql: string
): Promise<{ ok: boolean; data: any; error?: string }> => {
  if (!conn.managementToken) {
    return {
      ok: false,
      data: null,
      error:
        'تشغيل استعلامات SQL حرة يتطلب إضافة Supabase Personal Access Token (Management API) عند ربط الـ Supabase.',
    }
  }
  const projectRef = getSupabaseProjectRef(conn.projectUrl)
  if (!projectRef) {
    return { ok: false, data: null, error: 'تعذر استخراج معرّف المشروع من رابط Supabase.' }
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15000)
  try {
    const res = await fetch(
      `https://api.supabase.com/v1/projects/${projectRef}/database/query`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${conn.managementToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: sql }),
        signal: controller.signal,
      }
    )
    clearTimeout(timeout)

    const text = await res.text()
    let data: any = null
    try {
      data = text ? JSON.parse(text) : null
    } catch {
      data = text
    }

    if (!res.ok) {
      const message = data?.message || data?.error || `HTTP ${res.status}`
      return { ok: false, data: null, error: String(message) }
    }
    return { ok: true, data }
  } catch (err: any) {
    clearTimeout(timeout)
    return { ok: false, data: null, error: err?.message || 'فشل تنفيذ استعلام SQL.' }
  }
}
