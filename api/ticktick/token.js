export const config = { runtime: 'edge' }

const FALLBACK_CLIENT_ID = 'NyT9Pw0XECzMt9bE9W'
const FALLBACK_CLIENT_SECRET = 'f7Om169Pks8F83Ma1Ofs7tHdAgaOA4V1'

export default async function handler(request) {
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    })
  }

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    })
  }

  try {
    const rawText = await request.text()
    const params = new URLSearchParams(rawText)

    // Ensure client_id and client_secret are present
    if (!params.get('client_id')) {
      const cid = process.env.TICKTICK_CLIENT_ID || process.env.VITE_TICKTICK_CLIENT_ID || FALLBACK_CLIENT_ID
      if (cid) params.set('client_id', cid)
    }

    if (!params.get('client_secret')) {
      const secret = process.env.TICKTICK_CLIENT_SECRET || process.env.VITE_TICKTICK_CLIENT_SECRET || FALLBACK_CLIENT_SECRET
      if (secret) params.set('client_secret', secret)
    }

    const upstream = await fetch('https://ticktick.com/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
      },
      body: params.toString(),
    })

    const responseText = await upstream.text()

    return new Response(responseText, {
      status: upstream.status,
      headers: {
        'Content-Type': upstream.headers.get('content-type') || 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message || 'TickTick token exchange proxy error' }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    })
  }
}
