const STORAGE_KEY = 'azal_agent_permanent_memory'

export const DEFAULT_MEMORY_TEXT = `# 🧠 Permanent User Memory (User Profile & Context)

## 1. Personal Profile
- Role: Software Engineer & Technical Founder
- Preferred Language: English

## 2. Working Style & Preferences
- Prefers direct, actionable, and concise responses without filler.
- Prefers organizing tasks into interactive ToDo lists with step-by-step progress tracking.
- Strict Anti-Hallucination Policy: Rely strictly on real, verified ground-truth data from connected tools and MCP servers.

## 3. Active Projects
- **800 Academy**: Comprehensive digital education platform for EST and SAT exam preparation, curricula, exams, and blogs.
- **TickTick Integration**: Managing and scheduling real tasks, lists, and focus sessions synced across devices.
- **Azal Labs**: Core autonomous AI agent framework supporting multi-provider LLMs, Actions, Memory, and MCPs.

## 4. Persistent Notes & Decisions
- Auto-updated by the AI agent whenever new instructions, preferences, or project decisions are mentioned.`

export function getMemoryText(): string {
  if (typeof window === 'undefined') return DEFAULT_MEMORY_TEXT
  const saved = localStorage.getItem(STORAGE_KEY)
  if (saved && saved.trim()) {
    return saved
  }
  localStorage.setItem(STORAGE_KEY, DEFAULT_MEMORY_TEXT)
  return DEFAULT_MEMORY_TEXT
}

export function saveMemoryText(text: string): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(STORAGE_KEY, text.trim())
}

export function updateMemoryItem(category: string, key: string, value: string): string {
  const current = getMemoryText()
  const newLine = `- ${key}: ${value}`
  
  // If key already exists in text, replace line
  const lines = current.split('\n')
  const existingIdx = lines.findIndex((l) => l.toLowerCase().includes(`- ${key.toLowerCase()}:`))
  
  if (existingIdx !== -1) {
    lines[existingIdx] = newLine
    const updated = lines.join('\n')
    saveMemoryText(updated)
    return updated
  }

  // Else append under corresponding category or at the end
  const catKeywords: Record<string, string> = {
    personal: '1. Personal Profile',
    preferences: '2. Working Style & Preferences',
    projects: '3. Active Projects',
    notes: '4. Persistent Notes',
  }

  const targetHeader = catKeywords[category.toLowerCase()] || ''
  if (targetHeader) {
    const headerIdx = lines.findIndex((l) => l.includes(targetHeader))
    if (headerIdx !== -1) {
      lines.splice(headerIdx + 1, 0, newLine)
      const updated = lines.join('\n')
      saveMemoryText(updated)
      return updated
    }
  }

  const updated = current + `\n\n- [${category}] ${key}: ${value}`
  saveMemoryText(updated)
  return updated
}

export function parseMemoryBlockFromText(text: string): { category: string; key: string; value: string } | null {
  const match = text.match(/:::(?:update-memory|save-memory)\s*([\s\S]*?):::/)
  if (match && match[1]) {
    try {
      const data = JSON.parse(match[1].trim())
      if (data.key && data.value) {
        return {
          category: data.category || 'notes',
          key: data.key,
          value: data.value,
        }
      }
    } catch {
      // not valid json
    }
  }
  return null
}

export function formatMemoryForPrompt(): string {
  const mem = getMemoryText()
  return `### 🧠 Permanent User Memory
Retrieved automatically from the user's permanent memory file in Azal Labs. Keep this in mind across all your responses:
${mem}

Self-Update Rule: Whenever the user shares a new personal detail, workflow preference, or project decision that should be permanently remembered, append an update block:
:::update-memory
{
  "category": "personal | preferences | projects | notes",
  "key": "Detail Name",
  "value": "Detail Description"
}
:::`
}
