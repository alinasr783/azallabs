import React, { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { DEFAULT_LLM_CONFIG, type LlmConfigState, type LlmProviderType, type ProviderSettings } from '../lib/llm/types'
import { getMemoryText, saveMemoryText } from '../lib/memory'

interface AgentConfigContextType {
  systemPrompt: string
  setSystemPrompt: (prompt: string) => void
  saveConfig: () => Promise<{ success: boolean; message: string }>
  isSaving: boolean
  lastSavedAt: string | null
  resetToDefault: () => void

  // LLM Multi-Provider
  llmConfig: LlmConfigState
  setLlmConfig: React.Dispatch<React.SetStateAction<LlmConfigState>>
  setActiveProvider: (provider: LlmProviderType) => void
  updateProviderSettings: (provider: LlmProviderType, settings: Partial<ProviderSettings>) => void

  // Permanent Memory
  memoryText: string
  setMemoryText: (text: string) => void
  saveMemory: (text: string) => void
}

const DEFAULT_SYSTEM_PROMPT = `You are Azal Labs AI Agent, a powerful, precise, and autonomous assistant. You execute complex tasks step-by-step and respond with clarity, directness, and complete accuracy.

Response Formatting Rules (Clean Markdown - No HTML):
Never output raw HTML tags in your responses. Always use clean, standard Markdown:
- Use **bold** for key concepts, parameters, and emphasis.
- Use ## or ### for headings.
- Use - or 1. for bulleted or numbered lists.
- Use > for callouts, quotes, or notes.
- Use \`code\` for identifiers, paths, and commands, and \`\`\` for code blocks.

Structured Markdown Tables:
You are fully capable of formatting structured data into clear, professional Markdown tables whenever requested or whenever presenting comparisons, task summaries, or tabular data.
Standard format:
| Column 1 | Column 2 | Column 3 |
| :--- | :--- | :--- |
| Item 1 | Value 1 | Status 1 |
| Item 2 | Value 2 | Status 2 |

Strict Anti-Hallucination Policy:
- Never fabricate or guess tasks, projects, or user data.
- When querying tasks or connected MCP services, adhere 100% strictly to the ground-truth data returned.
- If a project contains no tasks, state clearly: "No tasks found in this project."
- Never claim a task was created or modified unless the tool returned a verified Task ID.

MCP Integration Instructions:
1. Connect Request:
When the user wants to connect an MCP server, emit:
\`\`\`mcp-connect
{
  "name": "Service Name (e.g. TickTick MCP)",
  "url": "Target MCP URL",
  "service": "Service identifier (e.g. ticktick)"
}
\`\`\`

2. Tool Execution:
When the user asks to execute an action in a connected service:
:::mcp-tool-call
{
  "server": "ticktick",
  "tool": "create_task",
  "params": {
    "title": "Task title",
    "content": "Additional details or notes"
  }
:::
`

const STORAGE_KEY = 'azal_system_prompt_config'
const LLM_STORAGE_KEY = 'azal_llm_config'

const AgentConfigContext = createContext<AgentConfigContextType | undefined>(undefined)

export const AgentConfigProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [systemPrompt, setSystemPrompt] = useState<string>(DEFAULT_SYSTEM_PROMPT)
  const [isSaving, setIsSaving] = useState<boolean>(false)
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null)

  // Multi-Provider LLM Configuration
  const [llmConfig, setLlmConfig] = useState<LlmConfigState>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(LLM_STORAGE_KEY)
      if (saved) {
        try {
          const parsed = JSON.parse(saved)
          if (
            !parsed.gemini?.model ||
            parsed.gemini.model.includes('2.5-flash') ||
            parsed.gemini.model.includes('2.0-flash') ||
            parsed.gemini.model.includes('1.5-flash') ||
            parsed.gemini.model.includes('2.5-pro')
          ) {
            parsed.gemini = {
              ...(parsed.gemini || {}),
              model: 'gemini-3.5-flash-lite',
            }
            localStorage.setItem(LLM_STORAGE_KEY, JSON.stringify({ ...DEFAULT_LLM_CONFIG, ...parsed }))
          }
          return { ...DEFAULT_LLM_CONFIG, ...parsed }
        } catch {}
      }
    }
    return DEFAULT_LLM_CONFIG
  })

  // Permanent Memory
  const [memoryText, setMemoryTextState] = useState<string>(() => getMemoryText())

  const setMemoryText = (text: string) => {
    setMemoryTextState(text)
    saveMemoryText(text)
  }

  const saveMemory = (text: string) => {
    setMemoryTextState(text)
    saveMemoryText(text)
  }

  const setActiveProvider = (provider: LlmProviderType) => {
    setLlmConfig((prev) => {
      const updated = { ...prev, activeProvider: provider }
      localStorage.setItem(LLM_STORAGE_KEY, JSON.stringify(updated))
      return updated
    })
  }

  const updateProviderSettings = (provider: LlmProviderType, settings: Partial<ProviderSettings>) => {
    setLlmConfig((prev) => {
      const updated = {
        ...prev,
        [provider]: {
          ...prev[provider],
          ...settings,
        },
      }
      localStorage.setItem(LLM_STORAGE_KEY, JSON.stringify(updated))
      return updated
    })
  }

  useEffect(() => {
    const loadConfig = async () => {
      // 1. Try Supabase
      try {
        const { data, error } = await supabase
          .from('agent_settings')
          .select('system_prompt, updated_at')
          .limit(1)
          .single()

        if (!error && data?.system_prompt) {
          setSystemPrompt(data.system_prompt)
          if (data.updated_at) {
            setLastSavedAt(new Date(data.updated_at).toLocaleTimeString('ar-EG'))
          }
          return
        }
      } catch (e) {
        // Fallback to local storage
      }

      // 2. Local storage fallback
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        try {
          const parsed = JSON.parse(saved)
          if (parsed.systemPrompt) setSystemPrompt(parsed.systemPrompt)
          if (parsed.lastSavedAt) setLastSavedAt(parsed.lastSavedAt)
        } catch (e) {
          console.error(e)
        }
      }
    }

    loadConfig()
  }, [])

  const saveConfig = async (): Promise<{ success: boolean; message: string }> => {
    setIsSaving(true)
    const nowStr = new Date().toLocaleTimeString('ar-EG')

    // Local storage
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ systemPrompt, lastSavedAt: nowStr })
    )

    let supabaseSuccess = false
    try {
      const { error } = await supabase
        .from('agent_settings')
        .upsert({
          id: 'default_config',
          system_prompt: systemPrompt,
          updated_at: new Date().toISOString(),
        })
      if (!error) supabaseSuccess = true
    } catch (e) {
      // fallback handled
    }

    setLastSavedAt(nowStr)
    setIsSaving(false)

    if (supabaseSuccess) {
      return { success: true, message: 'تم حفظ الـ System Prompt بنجاح في Supabase.' }
    }
    return { success: true, message: 'تم حفظ الـ System Prompt محلياً بنجاح.' }
  }

  const resetToDefault = () => {
    setSystemPrompt(DEFAULT_SYSTEM_PROMPT)
  }

  return (
    <AgentConfigContext.Provider
      value={{
        systemPrompt,
        setSystemPrompt,
        saveConfig,
        isSaving,
        lastSavedAt,
        resetToDefault,
        llmConfig,
        setLlmConfig,
        setActiveProvider,
        updateProviderSettings,
        memoryText,
        setMemoryText,
        saveMemory,
      }}
    >
      {children}
    </AgentConfigContext.Provider>
  )
}

export const useAgentConfig = () => {
  const context = useContext(AgentConfigContext)
  if (!context) {
    throw new Error('useAgentConfig must be used within an AgentConfigProvider')
  }
  return context
}
