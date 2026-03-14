import http from 'node:http'

const listenHost = process.env.GHOST_SHIFT_PROXY_HOST || process.env.PIXEL_OFFICE_PROXY_HOST || '127.0.0.1'
const listenPort = Number(process.env.GHOST_SHIFT_PROXY_PORT || process.env.PIXEL_OFFICE_PROXY_PORT || '3001')
const targetHost = process.env.GHOST_SHIFT_PROXY_TARGET_HOST || process.env.PIXEL_OFFICE_PROXY_TARGET_HOST || '127.0.0.1'
const targetPort = Number(process.env.GHOST_SHIFT_PROXY_TARGET_PORT || process.env.PIXEL_OFFICE_PROXY_TARGET_PORT || '3002')

const server = http.createServer((req, res) => {
  const upstream = http.request(
    {
      hostname: targetHost,
      port: targetPort,
      method: req.method,
      path: req.url,
      headers: {
        ...req.headers,
        host: `${targetHost}:${targetPort}`,
      },
    },
    (upstreamRes) => {
      res.writeHead(upstreamRes.statusCode || 502, upstreamRes.headers)
      upstreamRes.pipe(res)
    },
  )

  upstream.on('error', (error) => {
    if (res.headersSent) {
      res.destroy(error)
      return
    }

    res.writeHead(502, { 'content-type': 'text/plain; charset=utf-8' })
    res.end(`ghost-shift local proxy error: ${error.message}\n`)
  })

  req.pipe(upstream)
})

server.listen(listenPort, listenHost, () => {
  process.stdout.write(
    `ghost-shift local proxy listening on http://${listenHost}:${listenPort} -> http://${targetHost}:${targetPort}\n`,
  )
})
