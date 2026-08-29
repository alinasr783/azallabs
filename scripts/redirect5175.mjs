import http from 'http'

const server = http.createServer((req, res) => {
  res.writeHead(302, {
    Location: `http://localhost:5174${req.url}`,
    'Access-Control-Allow-Origin': '*',
  })
  res.end()
})

server.listen(5175, () => {
  console.log('Redirecting 5175 -> 5174')
})
