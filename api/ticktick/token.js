// Vercel serverless proxy for TickTick OAuth token exchange.
// Browser -> /api/ticktick/token -> https://ticktick.com/oauth/token
// The client_secret is forwarded from the browser bundle (same as the Vite dev
// proxy). For stronger security, inject TICKTICK_CLIENT_SECRET from Vercel env
// here instead and stop sending it from the client.

export default async function handler(req, res) {
  try {
    const chunks = []
    for await (const chunk of req) chunks.push(chunk)
    const body = Buffer.concat(chunks).toString()

    const upstream = await fetch('https://ticktick.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    })

    const text = await upstream.text()
    res.status(upstream.status)
    res.setHeader('Content-Type', 'application/json')
    res.end(text)
  } catch (e) {
    res.status(500).json({ error: String(e) })
  }
}
