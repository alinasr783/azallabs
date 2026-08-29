export const config = { runtime: 'edge' }

const FALLBACK_CLIENT_ID = 'NyT9Pw0XECzMt9bE9W'
const FALLBACK_CLIENT_SECRET = 'f7Om169Pks8F83Ma1Ofs7tHdAgaOA4V1'

export default async function handler(request) {
  // 1. Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': '*',
      },
    })
  }

  try {
    const url = new URL(request.url)
    const pathname = url.pathname

    // 2. OAuth Token Exchange
    if (pathname.includes('/api/ticktick/token')) {
      const rawText = await request.text()
      const params = new URLSearchParams(rawText)

      if (!params.get('client_id')) {
        const cid = process.env.TICKTICK_CLIENT_ID || process.env.VITE_TICKTICK_CLIENT_ID || FALLBACK_CLIENT_ID
        if (cid) params.set('client_id', cid)
      }
      if (!params.get('client_secret')) {
        const sec = process.env.TICKTICK_CLIENT_SECRET || process.env.VITE_TICKTICK_CLIENT_SECRET || FALLBACK_CLIENT_SECRET
        if (sec) params.set('client_secret', sec)
      }

      const upstream = await fetch('https://ticktick.com/oauth/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json',
        },
        body: params.toString(),
      })

      const text = await upstream.text()
      return new Response(text, {
        status: upstream.status,
        headers: {
          'Content-Type': upstream.headers.get('content-type') || 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      })
    }

    // 3. Open API v1 (Projects, Tasks, Deletions)
    if (pathname.includes('/api/ticktick/open')) {
      const rest = pathname.replace(/^.*?\/api\/ticktick\/open/, '')
      const targetUrl = `https://api.ticktick.com/open/v1${rest}${url.search}`

      const headers = new Headers()
      for (const [k, v] of request.headers.entries()) {
        const lk = k.toLowerCase()
        if (lk === 'host' || lk === 'content-length') continue
        headers.set(k, v)
      }

      const hasBody = request.method !== 'GET' && request.method !== 'HEAD'
      const body = hasBody ? await request.arrayBuffer() : undefined

      const upstream = await fetch(targetUrl, {
        method: request.method,
        headers,
        body,
      })

      const respHeaders = new Headers()
      for (const [k, v] of upstream.headers.entries()) {
        const lk = k.toLowerCase()
        if (lk === 'content-encoding' || lk === 'content-length' || lk === 'transfer-encoding') continue
        respHeaders.set(k, v)
      }
      respHeaders.set('Access-Control-Allow-Origin', '*')

      return new Response(upstream.body, {
        status: upstream.status,
        statusText: upstream.statusText,
        headers: respHeaders,
      })
    }

    // 4. MCP Proxy
    if (pathname.includes('/api/ticktick/mcp')) {
      const rest = pathname.replace(/^.*?\/api\/ticktick\/mcp/, '')
      const targetUrl = `https://mcp.ticktick.com${rest}${url.search}`

      const headers = new Headers()
      for (const [k, v] of request.headers.entries()) {
        const lk = k.toLowerCase()
        if (lk === 'host' || lk === 'content-length') continue
        headers.set(k, v)
      }

      const hasBody = request.method !== 'GET' && request.method !== 'HEAD'
      const body = hasBody ? await request.arrayBuffer() : undefined

      const upstream = await fetch(targetUrl, {
        method: request.method,
        headers,
        body,
      })

      const respHeaders = new Headers()
      for (const [k, v] of upstream.headers.entries()) {
        const lk = k.toLowerCase()
        if (lk === 'content-encoding' || lk === 'content-length' || lk === 'transfer-encoding') continue
        respHeaders.set(k, v)
      }
      respHeaders.set('Access-Control-Allow-Origin', '*')

      return new Response(upstream.body, {
        status: upstream.status,
        statusText: upstream.statusText,
        headers: respHeaders,
      })
    }

    return new Response(JSON.stringify({ error: 'TickTick endpoint not found' }), {
      status: 404,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message || 'TickTick proxy error' }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    })
  }
}
