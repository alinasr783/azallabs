// Vercel serverless proxy for the TickTick Open API.
// Browser -> /api/ticktick/open/<path> -> https://api.ticktick.com/open/v1/<path>
// The user's OAuth access token is forwarded via the Authorization header sent
// by the client.

export default async function handler(req, res) {
  try {
    const slug = req.query.slug
    const path = Array.isArray(slug) ? slug.join('/') : slug || ''
    const query = req.url.includes('?') ? '?' + req.url.split('?')[1] : ''
    const target = `https://api.ticktick.com/open/v1/${path}${query}`

    const chunks = []
    for await (const chunk of req) chunks.push(chunk)
    const body = Buffer.concat(chunks).toString()

    const headers = { ...req.headers }
    delete headers.host
    delete headers['content-length']
    delete headers['content-type'] // let fetch set it from the body

    const upstream = await fetch(target, {
      method: req.method,
      headers,
      body: body || undefined,
    })

    const text = await upstream.text()
    res.status(upstream.status)
    res.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/json')
    res.end(text)
  } catch (e) {
    res.status(500).json({ error: String(e) })
  }
}
