export const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY || ''
export const GROQ_MODEL = 'openai/gpt-oss-120b'

export interface ChatMessagePayload {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface StreamCompletionOptions {
  messages: { role: 'user' | 'assistant'; content: string }[]
  systemPrompt?: string
  onDelta: (chunk: string) => void
  onDone: () => void
  onError: (error: Error) => void
  signal?: AbortSignal
}

export async function streamGroqCompletion({
  messages,
  systemPrompt,
  onDelta,
  onDone,
  onError,
  signal,
}: StreamCompletionOptions) {
  try {
    const apiMessages: ChatMessagePayload[] = []

    if (systemPrompt && systemPrompt.trim()) {
      apiMessages.push({
        role: 'system',
        content: systemPrompt.trim(),
      })
    }

    for (const msg of messages) {
      apiMessages.push({
        role: msg.role,
        content: msg.content,
      })
    }

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: apiMessages,
        temperature: 1,
        max_completion_tokens: 2048,
        top_p: 1,
        reasoning_effort: 'medium',
        stream: true,
      }),
      signal,
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`خطأ في استجابة الموديل (${response.status}): ${errorText}`)
    }

    if (!response.body) {
      throw new Error('لا توجد استجابة نصية من الخادم.')
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder('utf-8')
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed || trimmed.startsWith(':')) continue

        if (trimmed === 'data: [DONE]') {
          onDone()
          return
        }

        if (trimmed.startsWith('data: ')) {
          try {
            const data = JSON.parse(trimmed.slice(6))
            const delta = data.choices?.[0]?.delta?.content
            if (delta) {
              onDelta(delta)
            }
          } catch {
            // ignore partial json chunk
          }
        }
      }
    }

    onDone()
  } catch (err: any) {
    if (err.name === 'AbortError') {
      onDone()
      return
    }
    onError(err)
  }
}
