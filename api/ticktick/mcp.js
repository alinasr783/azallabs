// Vercel serverless proxy for the TickTick MCP server.
// Browser -> /api/ticktick/mcp -> https://mcp.ticktick.com

export default async function handler(req, res) {
  try {
    const chunks = []
    for await (const chunk of req) chunks.push(chunk)
    const body = Buffer.concat(chunks).toString()

    const headers = { ...req.headers }
    delete headers.host
    delete headers['content-length']

    const upstream = await fetch('https://mcp.ticktick.com', {
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
