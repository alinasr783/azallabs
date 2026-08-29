import { generateActionTreePrompt } from './actions'
import { formatMemoryForPrompt } from './memory'

export interface BuildContextOptions {
  baseSystemPrompt?: string
  connectedServers?: any[]
  currentProject?: string
}

export function buildAgentContext({
  baseSystemPrompt,
  connectedServers,
  currentProject,
}: BuildContextOptions): string {
  const currentDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
  const currentTime = new Date().toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  })

  const actionsPrompt = generateActionTreePrompt(
    connectedServers?.map((s) => ({ server: s.name, tools: s.tools || [] }))
  )

  const memoryPrompt = formatMemoryForPrompt()

  const defaultPrompt = baseSystemPrompt || `You are the Azal Labs Agent — a precise and autonomous workspace assistant. You execute complex tasks step-by-step and respond with clarity, directness, and complete accuracy.`

  return `${defaultPrompt}

---

### 🌐 Runtime Environment & Context:
- **System:** Azal Labs Workspace (Task Automation & Project Execution)
- **Current Date:** ${currentDate} (${new Date().toISOString().split('T')[0]})
- **Current Time:** ${currentTime}
- **Active Target Project:** ${currentProject || '800 Academy'}

---

${actionsPrompt}

---

${memoryPrompt}

---

### 🛡️ Operational & Formatting Rules:
1. **Strict Zero-Hallucination Policy:**
   - Never invent or assume tasks, projects, or data not retrieved from connected MCP tools.
   - Never claim a task was created or updated unless the tool returned a confirmed Task ID.
2. **Clean Markdown Formatting (No HTML Tags):**
   - Use organized Markdown tables, lists, and code blocks.
   - Do NOT output raw HTML tags like <div>, <span>, or <p>.
3. **Deep Multi-Step Intent Understanding & Workflow Execution:**
   - Deeply analyze the user's request. If the task requires more than one step (e.g. data fetching, task creation, analysis, structured planning, tool calls, multi-part questions), break it down into sequential sub-tasks.
   - The multi-agent orchestrator executes each task through a dedicated request inheriting cumulative previous outputs, followed by quality evaluation and final synthesis.
   - In your final response, never print raw :::todo-list or internal JSON blocks. Speak directly and professionally to the user using clean Markdown tables and executive bullet points.`
}
