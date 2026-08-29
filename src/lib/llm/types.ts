export type LlmProviderType = 'gemini' | 'openai' | 'deepseek' | 'custom'

export interface ProviderSettings {
  apiKey: string
  model: string
  endpoint?: string
}

export interface LlmConfigState {
  activeProvider: LlmProviderType
  gemini: ProviderSettings
  openai: ProviderSettings
  deepseek: ProviderSettings
  custom: ProviderSettings
}

export interface ChatMessagePayload {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export interface StreamLlmOptions {
  messages: ChatMessagePayload[]
  systemPrompt?: string
  signal?: AbortSignal
  onDelta: (chunk: string) => void
  onDone: () => void
  onError: (error: Error) => void
}

export const DEFAULT_LLM_CONFIG: LlmConfigState = {
  activeProvider: 'custom',
  gemini: {
    apiKey: '',
    model: 'gemini-3.5-flash-lite',
  },
  openai: {
    apiKey: '',
    model: 'gpt-4o-mini',
  },
  deepseek: {
    apiKey: '',
    model: 'deepseek-chat',
    endpoint: 'https://api.deepseek.com/chat/completions',
  },
  custom: {
    apiKey: import.meta.env.VITE_GROQ_API_KEY || '',
    model: 'llama-3.3-70b-versatile',
    endpoint: 'https://api.groq.com/openai/v1/chat/completions',
  },
}
