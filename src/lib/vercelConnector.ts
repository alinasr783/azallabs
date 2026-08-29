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

/**
 * Fetch Vercel teams for the authenticated user
 */
export async function fetchVercelTeams(tokenOverride?: string) {
  const token = tokenOverride || getVercelToken()
  if (!token) throw new Error('Vercel Access Token is required.')

  const res = await fetch('https://api.vercel.com/v2/teams', {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err?.error?.message || `Failed to fetch teams (${res.status})`)
  }

  return await res.json()
}

/**
 * Fetch Vercel deployment events / build logs
 */
export async function fetchVercelDeploymentEvents(idOrUrl: string, teamId?: string, tokenOverride?: string) {
  const token = tokenOverride || getVercelToken()
  if (!token) throw new Error('Vercel Access Token is required.')

  let url = `https://api.vercel.com/v3/deployments/${encodeURIComponent(idOrUrl)}/events?limit=60`
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
    throw new Error(err?.error?.message || `Failed to fetch deployment events (${res.status})`)
  }

  return await res.json()
}

/**
 * Fetch Vercel runtime logs for a deployment
 */
export async function fetchVercelRuntimeLogs(
  projectId: string,
  deploymentId: string,
  teamId?: string,
  tokenOverride?: string
) {
  const token = tokenOverride || getVercelToken()
  if (!token) throw new Error('Vercel Access Token is required.')

  let url = `https://api.vercel.com/v1/projects/${encodeURIComponent(projectId)}/deployments/${encodeURIComponent(deploymentId)}/runtime-logs`
  if (teamId) {
    url += `?teamId=${encodeURIComponent(teamId)}`
  }

  try {
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    })
    if (res.ok) {
      return await res.json()
    }
  } catch {
    // Fallback to deployment events
  }

  // Fallback: deployment events contains runtime output and status
  return await fetchVercelDeploymentEvents(deploymentId, teamId, token)
}

export interface ResolvedVercelContext {
  projectId?: string
  projectName?: string
  teamId?: string
  deploymentId?: string
  deploymentUrl?: string
  allProjects?: any[]
}

/**
 * Automatically resolves active project, teamId, and latest deployment
 * so that tools requiring these IDs can execute smoothly even when the user
 * doesn't provide them explicitly.
 */
export async function resolveVercelContext(
  tokenOverride?: string,
  requestedProjectName?: string
): Promise<ResolvedVercelContext> {
  const token = tokenOverride || getVercelToken()
  if (!token) return {}

  let teamId: string | undefined

  // 1. Try to get teams to identify teamId if applicable
  try {
    const teamsData = await fetchVercelTeams(token)
    if (Array.isArray(teamsData?.teams) && teamsData.teams.length > 0) {
      teamId = teamsData.teams[0].id
    }
  } catch {
    // Non-fatal
  }

  // 2. Fetch projects
  let projects: any[] = []
  try {
    const projectsData = await fetchVercelProjects(teamId, token)
    projects = Array.isArray(projectsData?.projects)
      ? projectsData.projects
      : Array.isArray(projectsData)
      ? projectsData
      : []
  } catch {
    // If team fetch failed, try personal
    if (teamId) {
      try {
        const personalProjects = await fetchVercelProjects(undefined, token)
        projects = Array.isArray(personalProjects?.projects)
          ? personalProjects.projects
          : Array.isArray(personalProjects)
          ? personalProjects
          : []
        if (projects.length > 0) teamId = undefined
      } catch {}
    }
  }

  if (!projects.length) {
    return { teamId }
  }

  // 3. Find target project
  let target = projects[0]
  if (requestedProjectName && requestedProjectName.trim()) {
    const lowerReq = requestedProjectName.toLowerCase()
    const found = projects.find(
      (p: any) =>
        p.name?.toLowerCase().includes(lowerReq) ||
        p.id?.toLowerCase() === lowerReq ||
        lowerReq.includes(p.name?.toLowerCase())
    )
    if (found) target = found
  }

  const projId = target.id
  const projName = target.name
  const targetTeamId = target.accountId || teamId

  // 4. Resolve deployment
  let depId = target.latestDeployments?.[0]?.id
  let depUrl = target.latestDeployments?.[0]?.url

  if (!depId) {
    try {
      const depData = await fetchVercelDeployments(projId, targetTeamId, token)
      const deps = Array.isArray(depData?.deployments) ? depData.deployments : []
      if (deps.length > 0) {
        depId = deps[0].id
        depUrl = deps[0].url
      }
    } catch {}
  }

  return {
    projectId: projId,
    projectName: projName,
    teamId: targetTeamId,
    deploymentId: depId,
    deploymentUrl: depUrl,
    allProjects: projects,
  }
}
