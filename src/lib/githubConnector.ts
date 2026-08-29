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
 * Fetch authenticated user's repositories
 */
export async function fetchGitHubRepos(tokenOverride?: string, sort: string = 'updated', perPage: number = 30) {
  const token = tokenOverride || getGitHubToken()
  if (!token) throw new Error('GitHub Access Token is required.')

  const res = await fetch(`https://api.github.com/user/repos?sort=${sort}&per_page=${perPage}&affiliation=owner,collaborator`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err?.message || `Failed to fetch GitHub repositories (${res.status})`)
  }

  return await res.json()
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
export async function fetchGitHubRepoCommits(owner: string, repo: string, tokenOverride?: string, perPage: number = 20) {
  const token = tokenOverride || getGitHubToken()
  if (!token) throw new Error('GitHub Access Token is required.')

  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/commits?per_page=${perPage}`, {
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
  try {
    const data = await fetchGitHubRepos(token, 'updated', 30)
    repos = Array.isArray(data) ? data : []
  } catch {
    return {}
  }

  if (!repos.length) return {}

  // If user provided a specific repo name or owner/repo format
  if (requestedRepoText && requestedRepoText.trim()) {
    const clean = requestedRepoText.trim().toLowerCase()
    
    // 1. Check for owner/repo format
    if (clean.includes('/')) {
      const parts = clean.split('/')
      const o = parts[0].trim()
      const r = parts[1].trim()
      const match = repos.find(
        (rp: any) =>
          rp.owner?.login?.toLowerCase() === o &&
          rp.name?.toLowerCase() === r
      )
      if (match) {
        return {
          owner: match.owner?.login,
          repo: match.name,
          fullName: match.full_name,
          defaultBranch: match.default_branch || 'main',
          allRepos: repos,
        }
      }
    }

    // 2. Search substring match
    const found = repos.find(
      (rp: any) =>
        rp.name?.toLowerCase().includes(clean) ||
        clean.includes(rp.name?.toLowerCase())
    )
    if (found) {
      return {
        owner: found.owner?.login,
        repo: found.name,
        fullName: found.full_name,
        defaultBranch: found.default_branch || 'main',
        allRepos: repos,
      }
    }
  }

  // Default to the most recently updated repository
  const target = repos[0]
  return {
    owner: target.owner?.login,
    repo: target.name,
    fullName: target.full_name,
    defaultBranch: target.default_branch || 'main',
    allRepos: repos,
  }
}
