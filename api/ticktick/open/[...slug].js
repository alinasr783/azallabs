export const config = { runtime: 'edge' }

export default async function handler(request) {
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    })
  }

  try {
    const url = new URL(request.url)
    const rest = url.pathname.replace(/^\/api\/ticktick\/open/, '')
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
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message || 'TickTick Open API proxy error' }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    })
  }
}
