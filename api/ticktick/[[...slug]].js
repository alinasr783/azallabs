export const config = { runtime: 'edge' }

const TARGETS = {
  token: 'https://ticktick.com/oauth/token',
  open: 'https://api.ticktick.com/open/v1',
  mcp: 'https://mcp.ticktick.com',
}

export default async function handler(request) {
  const url = new URL(request.url)
  const rest = url.pathname.replace(/^\/api\/ticktick/, '')
  const query = url.search

  let targetBase
  let targetPath = ''

  if (rest === '/token') {
    targetBase = TARGETS.token
  } else if (rest.startsWith('/open')) {
    targetBase = TARGETS.open
    targetPath = rest.slice('/open'.length)
  } else if (rest.startsWith('/mcp')) {
    targetBase = TARGETS.mcp
    targetPath = rest.slice('/mcp'.length)
  } else {
    return new Response('Unknown ticktick proxy route: ' + rest, { status: 404 })
  }

  const targetUrl = targetBase + targetPath + query

  const headers = new Headers()
  for (const [k, v] of request.headers.entries()) {
    if (k.toLowerCase() === 'host' || k.toLowerCase() === 'content-length') continue
    headers.set(k, v)
  }

  const hasBody = request.method !== 'GET' && request.method !== 'HEAD'
  const init = {
    method: request.method,
    headers,
    body: hasBody ? request.body : undefined,
  }

  try {
    const upstream = await fetch(targetUrl, init)
    const respHeaders = new Headers()
    for (const [k, v] of upstream.headers.entries()) {
      const lk = k.toLowerCase()
      if (lk === 'content-encoding' || lk === 'content-length' || lk === 'transfer-encoding') continue
      respHeaders.set(k, v)
    }
    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: respHeaders,
    })
  } catch (e) {
    return new Response('TickTick proxy error: ' + e.message, { status: 502 })
  }
}
