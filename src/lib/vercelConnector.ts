// =========================================================================
// Vercel Connector & Token Manager
// -------------------------------------------------------------------------
// Manages authentication and direct communication with Vercel services.
// Credentials (Personal Access Token) are stored ONLY in the user's browser
// (localStorage) and never sent to any intermediary server.
// =========================================================================

const STORAGE_VERCEL_TOKEN_KEY = 'azal_vercel_token'

export const getVercelToken = (): string | null => {
  try {
    const token = localStorage.getItem(STORAGE_VERCEL_TOKEN_KEY)
    return token ? token.trim() : null
  } catch {
    return null
  }
}

export const setVercelToken = (token: string) => {
  localStorage.setItem(STORAGE_VERCEL_TOKEN_KEY, token.trim())
}

export const clearVercelToken = () => {
  localStorage.removeItem(STORAGE_VERCEL_TOKEN_KEY)
}

export const isVercelConnected = (): boolean => {
  return Boolean(getVercelToken())
}

export interface VercelTestResult {
  success: boolean
  user?: {
    id: string
    username: string
    email: string
    name?: string
  }
  teams?: Array<{
    id: string
    slug: string
    name: string
  }>
  error?: string
}

/**
 * Verifies the Vercel Access Token by testing against Vercel's user & teams endpoint.
 */
export async function testVercelConnection(tokenToTest?: string): Promise<VercelTestResult> {
  const token = tokenToTest || getVercelToken()
  if (!token) {
    return { success: false, error: 'لم يتم توفير رمز وصول (Vercel Access Token).' }
  }

  try {
    // 1. First test Vercel User info
    const userRes = await fetch('https://api.vercel.com/v2/user', {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    })

    if (!userRes.ok) {
      const errJson = await userRes.json().catch(() => ({}))
      const msg = errJson?.error?.message || `استجاب الخادم برمز خطأ (${userRes.status})`
      return { success: false, error: msg }
    }

    const userData = await userRes.json()

    // 2. Fetch Teams info
    let teams: Array<{ id: string; slug: string; name: string }> = []
    try {
      const teamsRes = await fetch('https://api.vercel.com/v2/teams', {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      })
      if (teamsRes.ok) {
        const teamsData = await teamsRes.json()
        if (Array.isArray(teamsData?.teams)) {
          teams = teamsData.teams.map((t: any) => ({
            id: t.id,
            slug: t.slug,
            name: t.name || t.slug,
          }))
        }
      }
    } catch {
      // Teams fetching failure is non-fatal
    }

    return {
      success: true,
      user: {
        id: userData.user?.id,
        username: userData.user?.username,
        email: userData.user?.email,
        name: userData.user?.name,
      },
      teams,
    }
  } catch (err: any) {
    return {
      success: false,
      error: `تعذر الاتصال بـ Vercel: ${err.message || 'خطأ في الشبكة'}`,
    }
  }
}

/**
 * Fetch Vercel projects directly via Vercel REST API (Resilient Fallback)
 */
export async function fetchVercelProjects(teamId?: string, tokenOverride?: string) {
  const token = tokenOverride || getVercelToken()
  if (!token) throw new Error('Vercel Access Token is required.')

  let url = 'https://api.vercel.com/v9/projects?limit=50'
  if (teamId) {
    url += `&teamId=${encodeURIComponent(teamId)}`
  }

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err?.error?.message || `Failed to fetch projects (${res.status})`)
  }

  return await res.json()
}

/**
 * Fetch Vercel deployments directly via Vercel REST API (Resilient Fallback)
 */
export async function fetchVercelDeployments(projectId?: string, teamId?: string, tokenOverride?: string) {
  const token = tokenOverride || getVercelToken()
  if (!token) throw new Error('Vercel Access Token is required.')

  let url = 'https://api.vercel.com/v6/deployments?limit=20'
  if (projectId) {
    url += `&projectId=${encodeURIComponent(projectId)}`
  }
  if (teamId) {
    url += `&teamId=${encodeURIComponent(teamId)}`
  }

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err?.error?.message || `Failed to fetch deployments (${res.status})`)
  }

  return await res.json()
}
