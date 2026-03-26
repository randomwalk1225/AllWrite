const { createServer } = require('http')
const { readFileSync, existsSync } = require('fs')
const { join, extname } = require('path')

const PORT = process.env.PORT || 3000
const DIR = join(__dirname, 'dist-web')

const MIME = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
}

createServer((req, res) => {
  let filePath = join(DIR, req.url === '/' ? 'index.html' : req.url)

  if (!existsSync(filePath)) {
    filePath = join(DIR, 'index.html') // SPA fallback
  }

  try {
    const data = readFileSync(filePath)
    const ext = extname(filePath)
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=31536000',
    })
    res.end(data)
  } catch {
    res.writeHead(404)
    res.end('Not Found')
  }
}).listen(PORT, () => console.log(`Serving on port ${PORT}`))
