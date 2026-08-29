export const GEMINI_API_KEY =
  import.meta.env.VITE_GEMINI_API_KEY || ''

export const GEMINI_MODEL = 'gemini-3.5-flash-lite'

export interface GeminiMessagePayload {
  role: 'user' | 'model'
  parts: { text: string }[]
}

export interface StreamGeminiOptions {
  messages: { role: 'user' | 'assistant'; content: string }[]
  systemPrompt?: string
  onDelta: (chunk: string) => void
  onDone: () => void
  onError: (error: Error) => void
  signal?: AbortSignal
}

// Sanitize message history to strictly enforce Gemini's alternating turns
export function sanitizeGeminiContents(
  messages: { role: 'user' | 'assistant'; content: string }[]
): GeminiMessagePayload[] {
  const merged: { role: 'user' | 'model'; text: string }[] = []

  for (const msg of messages) {
    const text = msg.content?.replace(/:::maestro-plan[\s\S]*?:::/g, '').trim()
    if (!text) continue
    const role: 'user' | 'model' = msg.role === 'assistant' ? 'model' : 'user'

    if (merged.length > 0 && merged[merged.length - 1].role === role) {
      merged[merged.length - 1].text += `\n${text}`
    } else {
      merged.push({ role, text })
    }
  }

  // Ensure first message is from user
  while (merged.length > 0 && merged[0].role === 'model') {
    merged.shift()
  }

  // Ensure last message is from user
  while (merged.length > 0 && merged[merged.length - 1].role === 'model') {
    merged.pop()
  }

  if (merged.length === 0) {
    return [{ role: 'user', parts: [{ text: 'مرحباً' }] }]
  }

  return merged.map((m) => ({ role: m.role, parts: [{ text: m.text }] }))
}

export async function streamGeminiCompletion({
  messages,
  systemPrompt,
  onDelta,
  onDone,
  onError,
  signal,
}: StreamGeminiOptions) {
  let hasReceivedAnyDelta = false

  try {
    const contents = sanitizeGeminiContents(messages)

    const body: Record<string, any> = {
      contents,
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 3072,
      },
    }

    if (systemPrompt && systemPrompt.trim()) {
      body.systemInstruction = {
        parts: [{ text: systemPrompt.trim() }],
      }
    }

    // Try fast streaming endpoint
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:streamGenerateContent?alt=sse&key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal,
      }
    )

    if (response.ok && response.body) {
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

          if (trimmed.startsWith('data: ')) {
            try {
              const data = JSON.parse(trimmed.slice(6))
              const parts = data.candidates?.[0]?.content?.parts || []
              for (const p of parts) {
                if (p.text) {
                  hasReceivedAnyDelta = true
                  onDelta(p.text)
                }
              }
            } catch {
              // ignore partial json
            }
          }
        }
      }

      if (hasReceivedAnyDelta) {
        onDone()
        return
      }
    }
  } catch (err: any) {
    if (err.name === 'AbortError') {
      onDone()
      return
    }
    console.warn('Gemini stream error, attempting direct generation fallback:', err)
  }

  // Resilient fallback to direct generateContent
  try {
    const contents = sanitizeGeminiContents(messages)
    const directRes = await generateGeminiContent(contents, systemPrompt, 3072)
    if (directRes && directRes.trim().length > 0) {
      onDelta(directRes)
      onDone()
      return
    }
  } catch (fallbackErr: any) {
    onError(fallbackErr)
    return
  }

  onDone()
}

export async function generateGeminiContent(
  contentsOrPrompt: string | GeminiMessagePayload[],
  systemPrompt?: string,
  maxOutputTokens: number = 3072
): Promise<string> {
  try {
    const contents: GeminiMessagePayload[] =
      typeof contentsOrPrompt === 'string'
        ? [{ role: 'user', parts: [{ text: contentsOrPrompt }] }]
        : contentsOrPrompt

    const body: Record<string, any> = {
      contents,
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens,
      },
    }

    if (systemPrompt && systemPrompt.trim()) {
      body.systemInstruction = {
        parts: [{ text: systemPrompt.trim() }],
      }
    }

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }
    )

    if (res.ok) {
      const data = await res.json()
      const parts = data.candidates?.[0]?.content?.parts || []
      const text = parts.map((p: any) => p.text || '').join('')
      if (text) return text
    }
  } catch (err) {
    console.error('generateGeminiContent error:', err)
  }
  return ''
}
