const STORAGE_KEY = 'azal_agent_permanent_memory'

// Default permanent memory is completely blank by default as requested
export const DEFAULT_MEMORY_TEXT = ''

export function getMemoryText(): string {
  if (typeof window === 'undefined') return DEFAULT_MEMORY_TEXT
  const saved = localStorage.getItem(STORAGE_KEY)
  if (saved !== null) {
    // If the storage contains the legacy mock template, clean it out automatically
    if (saved.includes('Software Engineer & Technical Founder') && saved.includes('EST and SAT exam preparation')) {
      localStorage.setItem(STORAGE_KEY, '')
      return ''
    }
    return saved
  }
  return DEFAULT_MEMORY_TEXT
}

export function saveMemoryText(text: string): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(STORAGE_KEY, text.trim())
}

export function updateMemoryItem(category: string, key: string, value: string): string {
  const current = getMemoryText()
  const newLine = `- ${key}: ${value}`

  if (!current.trim()) {
    const updated = `## ${category}\n${newLine}`
    saveMemoryText(updated)
    return updated
  }

  // If key already exists in text, replace line
  const lines = current.split('\n')
  const existingIdx = lines.findIndex((l) => l.toLowerCase().includes(`- ${key.toLowerCase()}:`))

  if (existingIdx !== -1) {
    lines[existingIdx] = newLine
    const updated = lines.join('\n')
    saveMemoryText(updated)
    return updated
  }

  const updated = current + `\n${newLine}`
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
  if (!mem.trim()) return ''

  return `### الذاكرة الدائمة (Permanent User Memory)
تم استرجاعها تلقائياً من ملف الذاكرة الدائمة في Azal Labs. التزم بهذه التفضيلات والسياق في ردودك:
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
