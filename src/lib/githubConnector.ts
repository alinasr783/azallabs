// =========================================================================
// GitHub Connector & Token Manager
// -------------------------------------------------------------------------
// Manages authentication and direct communication with GitHub platform.
// Credentials (Personal Access Token) are stored ONLY in the user's browser
// (localStorage) and never sent to any intermediary server.
// =========================================================================

const STORAGE_GITHUB_TOKEN_KEY = 'azal_github_token'

export const getGitHubToken = (): string | null => {
  try {
    const token = localStorage.getItem(STORAGE_GITHUB_TOKEN_KEY)
    return token ? token.trim() : null
  } catch {
    return null
  }
}

export const setGitHubToken = (token: string) => {
  localStorage.setItem(STORAGE_GITHUB_TOKEN_KEY, token.trim())
}

export const clearGitHubToken = () => {
  localStorage.removeItem(STORAGE_GITHUB_TOKEN_KEY)
}

export const isGitHubConnected = (): boolean => {
  return Boolean(getGitHubToken())
}

export interface GitHubTestResult {
  success: boolean
  user?: {
    id: number
    login: string
    name?: string
    avatar_url?: string
    html_url?: string
    public_repos?: number
    total_private_repos?: number
  }
  error?: string
}

/**
 * Verifies the GitHub Access Token by fetching the authenticated user's profile.
 */
export async function testGitHubConnection(tokenToTest?: string): Promise<GitHubTestResult> {
  const token = tokenToTest || getGitHubToken()
  if (!token) {
    return { success: false, error: 'لم يتم توفير رمز وصول شخصي (GitHub Personal Access Token).' }
  }

  try {
    const res = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      const msg = err?.message || `استجاب الخادم برمز خطأ (${res.status})`
      return { success: false, error: msg }
    }

    const data = await res.json()
    return {
      success: true,
      user: {
        id: data.id,
        login: data.login,
        name: data.name,
        avatar_url: data.avatar_url,
        html_url: data.html_url,
        public_repos: data.public_repos,
        total_private_repos: data.total_private_repos,
      },
    }
  } catch (err: any) {
    return {
      success: false,
      error: `تعذر الاتصال بـ GitHub: ${err.message || 'خطأ في الشبكة'}`,
    }
  }
}

/**
 * Fetch authenticated user's repositories (public and private, up to 100)
 */
export async function fetchGitHubRepos(tokenOverride?: string, sort: string = 'updated', perPage: number = 100) {
  const token = tokenOverride || getGitHubToken()
  if (!token) throw new Error('GitHub Access Token is required.')

  let allRepos: any[] = []

  // 1. Try authenticated /user/repos with affiliation
  try {
    const res = await fetch(`https://api.github.com/user/repos?sort=${sort}&per_page=${perPage}&affiliation=owner,collaborator`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    })
    if (res.ok) {
      const data = await res.json()
      if (Array.isArray(data) && data.length > 0) {
        allRepos = data
      }
    }
  } catch (e) {
    console.warn('Error fetching /user/repos with affiliation:', e)
  }

  // 2. If empty or failed, try without affiliation
  if (!allRepos.length) {
    try {
      const res = await fetch(`https://api.github.com/user/repos?sort=${sort}&per_page=${perPage}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
      })
      if (res.ok) {
        const data = await res.json()
        if (Array.isArray(data) && data.length > 0) {
          allRepos = data
        }
      }
    } catch (e) {
      console.warn('Error fetching /user/repos:', e)
    }
  }

  // 3. Fallback: Fetch user profile to get login username, then fetch public repos /users/{username}/repos
  try {
    const userRes = await testGitHubConnection(token)
    const username = userRes.user?.login
    if (username) {
      const pubRes = await fetch(`https://api.github.com/users/${username}/repos?sort=${sort}&per_page=${perPage}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
      })
      if (pubRes.ok) {
        const pubData = await pubRes.json()
        if (Array.isArray(pubData) && pubData.length > 0) {
          const existingIds = new Set(allRepos.map((r: any) => r.id))
          for (const r of pubData) {
            if (!existingIds.has(r.id)) {
              allRepos.push(r)
              existingIds.add(r.id)
            }
          }
        }
      }
    }
  } catch (e) {
    console.warn('Error fetching /users/{username}/repos:', e)
  }

  return allRepos
}

/**
 * Fetch repository issues
 */
export async function fetchGitHubRepoIssues(owner: string, repo: string, tokenOverride?: string, state: string = 'open') {
  const token = tokenOverride || getGitHubToken()
  if (!token) throw new Error('GitHub Access Token is required.')

  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/issues?state=${state}&per_page=30`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err?.message || `Failed to fetch issues (${res.status})`)
  }

  return await res.json()
}

/**
 * Fetch repository pull requests
 */
export async function fetchGitHubRepoPulls(owner: string, repo: string, tokenOverride?: string, state: string = 'open') {
  const token = tokenOverride || getGitHubToken()
  if (!token) throw new Error('GitHub Access Token is required.')

  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls?state=${state}&per_page=30`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err?.message || `Failed to fetch pull requests (${res.status})`)
  }

  return await res.json()
}

/**
 * Fetch repository commits
 */
export async function fetchGitHubRepoCommits(
  owner: string,
  repo: string,
  tokenOverride?: string,
  perPage: number = 20,
  sha?: string
) {
  const token = tokenOverride || getGitHubToken()
  if (!token) throw new Error('GitHub Access Token is required.')

  const shaParam = sha ? `&sha=${encodeURIComponent(sha)}` : ''
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/commits?per_page=${perPage}${shaParam}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err?.message || `Failed to fetch commits (${res.status})`)
  }

  return await res.json()
}

/**
 * Fetch repository branches
 */
export async function fetchGitHubRepoBranches(owner: string, repo: string, tokenOverride?: string) {
  const token = tokenOverride || getGitHubToken()
  if (!token) throw new Error('GitHub Access Token is required.')

  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/branches?per_page=30`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err?.message || `Failed to fetch branches (${res.status})`)
  }

  return await res.json()
}

/**
 * Fetch file or directory content
 */
export async function fetchGitHubFileContents(owner: string, repo: string, path: string = '', tokenOverride?: string) {
  const token = tokenOverride || getGitHubToken()
  if (!token) throw new Error('GitHub Access Token is required.')

  const cleanPath = path.startsWith('/') ? path.slice(1) : path
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${cleanPath}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err?.message || `Failed to fetch file contents (${res.status})`)
  }

  return await res.json()
}

export interface ResolvedGitHubContext {
  owner?: string
  repo?: string
  fullName?: string
  defaultBranch?: string
  allRepos?: any[]
}

/**
 * Automatically resolves owner and repo from user's repositories or message context
 */
export async function resolveGitHubContext(
  tokenOverride?: string,
  requestedRepoText?: string
): Promise<ResolvedGitHubContext> {
  const token = tokenOverride || getGitHubToken()
  if (!token) return {}

  let repos: any[] = []
  let user: any = null

  try {
    const userRes = await testGitHubConnection(token)
    if (userRes.success && userRes.user) {
      user = userRes.user
    }
  } catch {}

  try {
    const data = await fetchGitHubRepos(token, 'updated', 100)
    repos = Array.isArray(data) ? data : []
  } catch {
    if (user) {
      return { owner: user.login }
    }
    return {}
  }

  const defaultOwner = user?.login || (repos.length > 0 ? repos[0].owner?.login : undefined)

  if (!repos.length) {
    return defaultOwner ? { owner: defaultOwner } : {}
  }

  // If user provided a specific repo name or owner/repo format
  if (requestedRepoText && requestedRepoText.trim()) {
    const clean = requestedRepoText.trim().toLowerCase()
    
    // 1. Check for explicit GitHub URL format
    const ghUrlMatch = clean.match(/github\.com\/([a-zA-Z0-9_-]+)\/([a-zA-Z0-9_.-]+)/)
    if (ghUrlMatch) {
      const o = ghUrlMatch[1]
      const r = ghUrlMatch[2]
      const match = repos.find((rp: any) => rp.owner?.login?.toLowerCase() === o && rp.name?.toLowerCase() === r)
      return {
        owner: o,
        repo: r,
        fullName: `${o}/${r}`,
        defaultBranch: match?.default_branch || 'main',
        allRepos: repos,
      }
    }

    // 2. Check for explicit owner/repo format ONLY IF it's a single word without spaces or https
    if (clean.includes('/') && !clean.includes(' ') && !clean.includes('http')) {
      const matchSlash = clean.match(/^([a-zA-Z0-9_-]+)\/([a-zA-Z0-9_.-]+)$/)
      if (matchSlash) {
        const o = matchSlash[1]
        const r = matchSlash[2]
        const match = repos.find((rp: any) => rp.owner?.login?.toLowerCase() === o && rp.name?.toLowerCase() === r)
        return {
          owner: o,
          repo: r,
          fullName: `${o}/${r}`,
          defaultBranch: match?.default_branch || 'main',
          allRepos: repos,
        }
      }
    }

    // 2. Extract potential English words/tokens from the text (e.g. "azallabs")
    // Filter out common English command words
    const words = clean
      .replace(/[^a-zA-Z0-9_.-]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length >= 2 && !['main', 'master', 'commits', 'commit', 'branch', 'repo', 'repos', 'github', 'git', 'pull', 'pulls', 'pr'].includes(w))

    // First try exact name match with extracted words
    for (const w of words) {
      const exact = repos.find((rp: any) => rp.name.toLowerCase() === w)
      if (exact) {
        return {
          owner: exact.owner?.login || defaultOwner,
          repo: exact.name,
          fullName: exact.full_name,
          defaultBranch: exact.default_branch || 'main',
          allRepos: repos,
        }
      }
    }

    // Next, sort repos by name length descending to avoid short names like "ai" or "mo" matching inside other words!
    const sortedByLength = [...repos].sort((a, b) => (b.name?.length || 0) - (a.name?.length || 0))
    for (const rp of sortedByLength) {
      const rName = rp.name.toLowerCase()
      // Only match if the repo name is at least 3 chars or is an exact word boundary in clean
      if (rName.length >= 3) {
        const regex = new RegExp(`(^|[^a-zA-Z0-9_-])${rName}([^a-zA-Z0-9_-]|$)`, 'i')
        if (regex.test(clean)) {
          return {
            owner: rp.owner?.login || defaultOwner,
            repo: rp.name,
            fullName: rp.full_name,
            defaultBranch: rp.default_branch || 'main',
            allRepos: repos,
          }
        }
      }
    }

    // If an extracted word looks like a repo name even if not found in list (e.g. newly created)
    if (words.length > 0) {
      const candidate = words[words.length - 1]
      return {
        owner: defaultOwner,
        repo: candidate,
        fullName: defaultOwner ? `${defaultOwner}/${candidate}` : candidate,
        defaultBranch: 'main',
        allRepos: repos,
      }
    }
  }

  // Default to the most recently updated repository
  const target = repos[0]
  return {
    owner: target.owner?.login || defaultOwner,
    repo: target.name,
    fullName: target.full_name,
    defaultBranch: target.default_branch || 'main',
    allRepos: repos,
  }
}
