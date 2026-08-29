import http from 'node:http'
import https from 'node:https'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DIST = path.resolve(__dirname, 'dist')
const PORT = Number(process.env.PORT) || 5174

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8',
}

// Map incoming /api/ticktick/* prefixes to the real TickTick endpoints.
function resolveProxy(urlPath) {
  if (urlPath.startsWith('/api/ticktick/token')) {
    return { target: 'https://ticktick.com', path: urlPath.replace('/api/ticktick/token', '/oauth/token') }
  }
  if (urlPath.startsWith('/api/ticktick/open')) {
    return {
      target: 'https://api.ticktick.com',
      path: urlPath.replace('/api/ticktick/open', '/open/v1'),
    }
  }
  if (urlPath.startsWith('/api/ticktick/mcp')) {
    return { target: 'https://mcp.ticktick.com', path: urlPath.replace('/api/ticktick/mcp', '') }
  }
  return null
}

function proxyRequest(req, res, proxy) {
  const target = new URL(proxy.path, proxy.target)
  const bodyChunks = []

  req.on('data', (chunk) => bodyChunks.push(chunk))
  req.on('end', () => {
    const options = {
      method: req.method,
      hostname: target.hostname,
      path: target.pathname + target.search,
      // Strip hop-by-hop + host headers; set Host to the real upstream so
      // TickTick/Chrome accept the request (changeOrigin behaviour).
      headers: { ...req.headers, host: target.hostname },
    }
    delete options.headers['connection']

    const proxyReq = https.request(options, (proxyRes) => {
      res.writeHead(proxyRes.statusCode || 502, proxyRes.headers)
      proxyRes.pipe(res)
    })

    proxyReq.on('error', (err) => {
      console.error('[ticktick-proxy] error:', err.message)
      if (!res.headersSent) {
        res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' })
      }
      res.end(
        JSON.stringify({
          error: 'proxy_failed',
          message: `تعذّر الوصول لخادم TickTick: ${err.message}`,
        })
      )
    })

    if (bodyChunks.length) proxyReq.write(Buffer.concat(bodyChunks))
    proxyReq.end()
  })
}

function serveStatic(req, res) {
  const urlPath = decodeURIComponent((req.url || '/').split('?')[0])
  const safePath = urlPath === '/' ? '/index.html' : urlPath
  const filePath = path.join(DIST, safePath)

  // Block path traversal outside dist
  if (!filePath.startsWith(DIST)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' })
    res.end('Forbidden')
    return
  }

  fs.stat(filePath, (err, stat) => {
    if (!err && stat.isFile()) {
      const ext = path.extname(filePath).toLowerCase()
      res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' })
      fs.createReadStream(filePath).pipe(res)
      return
    }
    // SPA fallback: serve index.html for any non-asset route
    fs.readFile(path.join(DIST, 'index.html'), (e, data) => {
      if (e) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
        res.end('dist/index.html not found. Run "npm run build" first.')
        return
      }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      res.end(data)
    })
  })
}

const server = http.createServer((req, res) => {
  const urlPath = (req.url || '/').split('?')[0]
  const proxy = resolveProxy(urlPath)
  if (proxy) {
    proxyRequest(req, res, proxy)
    return
  }
  serveStatic(req, res)
})

server.listen(PORT, () => {
  console.log(`Azal Labs production server listening on http://localhost:${PORT}`)
  console.log('Serving:', DIST)
  console.log('Proxying /api/ticktick/* -> TickTick (api.ticktick.com, ticktick.com, mcp.ticktick.com)')
})
