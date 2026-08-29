import type { LlmConfigState, StreamLlmOptions, ChatMessagePayload } from './types'

// Helper to stream OpenAI-compatible SSE endpoints (OpenAI, DeepSeek, Custom/Groq/Ollama)
async function streamOpenAICompatible({
  endpoint,
  apiKey,
  model,
  messages,
  systemPrompt,
  signal,
  onDelta,
  onDone,
  onError,
}: {
  endpoint: string
  apiKey: string
  model: string
} & StreamLlmOptions) {
  try {
    const formattedMessages: { role: string; content: string }[] = []
    if (systemPrompt && systemPrompt.trim()) {
      formattedMessages.push({ role: 'system', content: systemPrompt.trim() })
    }
    for (const m of messages) {
      formattedMessages.push({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content,
      })
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    if (apiKey && apiKey.trim()) {
      headers['Authorization'] = `Bearer ${apiKey.trim()}`
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      signal,
      body: JSON.stringify({
        model,
        messages: formattedMessages,
        stream: true,
        temperature: 0.7,
      }),
    })

    if (!response.ok) {
      const errText = await response.text()
      throw new Error(`خطأ من خادم المزود (${response.status}): ${errText}`)
    }

    if (!response.body) {
      throw new Error('لم يتم استلام استجابة قابلة للقراءة من المزود.')
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder('utf-8')
    let buffer = ''
    let receivedAny = false

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
            const delta = data.choices?.[0]?.delta?.content || ''
            if (delta) {
              receivedAny = true
              onDelta(delta)
            }
          } catch {
            // ignore partial JSON parse errors in chunk stream
          }
        }
      }
    }

    if (receivedAny) {
      onDone()
    } else {
      throw new Error('تم إنهاء الاتصال دون استلام أي نص من النموذج.')
    }
  } catch (err: any) {
    if (err.name === 'AbortError') {
      onDone()
      return
    }
    onError(err)
  }
}

// Stream Gemini using Google Generative Language API
async function streamGemini({
  apiKey,
  model,
  messages,
  systemPrompt,
  signal,
  onDelta,
  onDone,
  onError,
}: {
  apiKey: string
  model: string
} & StreamLlmOptions) {
  try {
    // Sanitize message turns for Gemini
    const contents: { role: 'user' | 'model'; parts: { text: string }[] }[] = []
    for (const msg of messages) {
      const text = msg.content?.replace(/:::maestro-plan[\s\S]*?:::/g, '').trim()
      if (!text) continue
      const role: 'user' | 'model' = msg.role === 'assistant' ? 'model' : 'user'

      if (contents.length > 0 && contents[contents.length - 1].role === role) {
        contents[contents.length - 1].parts[0].text += `\n${text}`
      } else {
        contents.push({ role, parts: [{ text }] })
      }
    }

    // Ensure first message is user
    while (contents.length > 0 && contents[0].role === 'model') {
      contents.shift()
    }
    // Ensure last message is user
    while (contents.length > 0 && contents[contents.length - 1].role === 'model') {
      contents.pop()
    }

    if (contents.length === 0) {
      contents.push({ role: 'user', parts: [{ text: 'مرحباً' }] })
    }

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

    let geminiModel = model || 'gemini-3.5-flash-lite'
    if (
      geminiModel.includes('2.5-flash') ||
      geminiModel.includes('2.0-flash') ||
      geminiModel.includes('1.5-flash') ||
      geminiModel.includes('2.5-pro')
    ) {
      geminiModel = 'gemini-3.5-flash-lite'
    }

    const targetUrl = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:streamGenerateContent?alt=sse&key=${apiKey}`

    let response = await fetch(targetUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    })

    if (!response.ok) {
      // Resilient fallback: try gemini-3.5-flash or gemini-flash-latest direct generateContent
      const fallbackModels = ['gemini-3.5-flash', 'gemini-flash-latest', 'gemini-3.5-flash-lite'].filter((m) => m !== geminiModel)
      for (const altModel of fallbackModels) {
        try {
          const fallbackUrl = `https://generativelanguage.googleapis.com/v1beta/models/${altModel}:generateContent?key=${apiKey}`
          const fallbackRes = await fetch(fallbackUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
            signal,
          })
          if (fallbackRes.ok) {
            const data = await fallbackRes.json()
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text
            if (text) {
              onDelta(text)
              onDone()
              return
            }
          }
        } catch {}
      }
      const errText = await response.text()
      throw new Error(`Gemini Server Error (${response.status}): ${errText}`)
    }

    if (!response.body) {
      throw new Error('لم يتم استلام استجابة قابلة للقراءة من Gemini.')
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder('utf-8')
    let buffer = ''
    let receivedAny = false

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
                receivedAny = true
                onDelta(p.text)
              }
            }
          } catch {
            // ignore partial JSON
          }
        }
      }
    }

    if (receivedAny) {
      onDone()
    } else {
      throw new Error('تم إنهاء الاتصال دون استلام أي نص من Gemini.')
    }
  } catch (err: any) {
    if (err.name === 'AbortError') {
      onDone()
      return
    }
    onError(err)
  }
}

// Master Unified Stream Router
export async function streamUnifiedLlmCompletion(
  config: LlmConfigState,
  options: StreamLlmOptions
) {
  const { activeProvider } = config

  if (activeProvider === 'gemini') {
    const activeKey = config.gemini.apiKey || ''
    return streamGemini({
      apiKey: activeKey,
      model: config.gemini.model || 'gemini-3.5-flash-lite',
      ...options,
    })
  }

  if (activeProvider === 'openai') {
    if (!config.openai.apiKey) {
      options.onError(new Error('يرجى إضافة مفتاح OpenAI API Key في صفحة الإعدادات لتفعيل هذا النموذج.'))
      return
    }
    return streamOpenAICompatible({
      endpoint: 'https://api.openai.com/v1/chat/completions',
      apiKey: config.openai.apiKey,
      model: config.openai.model || 'gpt-4o-mini',
      ...options,
    })
  }

  if (activeProvider === 'deepseek') {
    if (!config.deepseek.apiKey) {
      options.onError(new Error('يرجى إضافة مفتاح DeepSeek API Key في صفحة الإعدادات لتفعيل هذا النموذج.'))
      return
    }
    return streamOpenAICompatible({
      endpoint: config.deepseek.endpoint || 'https://api.deepseek.com/chat/completions',
      apiKey: config.deepseek.apiKey,
      model: config.deepseek.model || 'deepseek-chat',
      ...options,
    })
  }

  if (activeProvider === 'custom') {
    const endpoint = config.custom.endpoint
    if (!endpoint) {
      options.onError(new Error('يرجى تحديد رابط الـ Custom Endpoint في صفحة الإعدادات.'))
      return
    }
    return streamOpenAICompatible({
      endpoint,
      apiKey: config.custom.apiKey || '',
      model: config.custom.model || 'custom-model',
      ...options,
    })
  }

  // Fallback to Gemini
  return streamGemini({
    apiKey: config.gemini.apiKey || '',
    model: config.gemini.model || 'gemini-3.5-flash-lite',
    ...options,
  })
}

// Promise-based execution helper for sequential multi-agent chains
export async function executeUnifiedLlmCompletion(
  config: LlmConfigState,
  params: { messages: ChatMessagePayload[]; systemPrompt?: string }
): Promise<string> {
  return new Promise((resolve, reject) => {
    let text = ''
    streamUnifiedLlmCompletion(config, {
      messages: params.messages,
      systemPrompt: params.systemPrompt,
      onDelta: (chunk) => {
        text += chunk
      },
      onDone: () => {
        resolve(text.trim())
      },
      onError: (err) => {
        reject(err)
      },
    })
  })
}
