// Dev server không cần Vercel CLI/login: phục vụ public/ + chạy api/*.js (Web-standard handler) giống Vercel.
//   node scripts/dev.mjs            → http://localhost:3000   (PORT=xxxx để đổi)
// Đọc .env ở thư mục hiện tại hoặc thư mục cha gần nhất (không in giá trị). Biến đã export được ưu tiên.
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { Readable } from 'node:stream';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = process.cwd();
for (let d = ROOT; ; d = path.dirname(d)) {
  const f = path.join(d, '.env');
  if (existsSync(f)) {
    for (const line of readFileSync(f, 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
    }
    console.log('[dev] đã nạp', f);
    break;
  }
  if (d === path.dirname(d)) break;
}

const PUBLIC = path.join(ROOT, 'public');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2', '.ico': 'image/x-icon' };

async function handleApi(req, res, url) {
  const name = url.pathname.replace(/^\/api\//, '').replace(/\/$/, '');
  const file = path.join(ROOT, 'api', `${name}.js`);
  if (!/^[\w-]+$/.test(name) || name.startsWith('_') || !existsSync(file)) {
    res.writeHead(404).end('no function');
    return;
  }
  const mod = await import(pathToFileURL(file).href);
  const handler = mod.default?.fetch || mod[req.method];
  if (!handler) {
    res.writeHead(405).end();
    return;
  }
  const hasBody = !['GET', 'HEAD'].includes(req.method);
  const request = new Request(url, {
    method: req.method,
    headers: Object.entries(req.headers).filter(([, v]) => typeof v === 'string'),
    body: hasBody ? Readable.toWeb(req) : undefined,
    duplex: 'half',
  });
  const response = await handler(request);
  res.writeHead(response.status, Object.fromEntries(response.headers));
  if (response.body) Readable.fromWeb(response.body).pipe(res);
  else res.end();
}

http
  .createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    try {
      if (url.pathname.startsWith('/api/')) return await handleApi(req, res, url);
      let p = path.join(PUBLIC, decodeURIComponent(url.pathname));
      if (!p.startsWith(PUBLIC)) return res.writeHead(403).end();
      if (existsSync(p) && (await stat(p)).isDirectory()) p = path.join(p, 'index.html');
      if (!existsSync(p) && existsSync(p + '.html')) p += '.html'; // cleanUrls giống vercel.json
      if (!existsSync(p)) { res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }); return res.end('404'); }
      const buf = await readFile(p);
      res.writeHead(200, { 'content-type': TYPES[path.extname(p)] || 'application/octet-stream' });
      res.end(buf);
    } catch (e) {
      console.error(e);
      if (!res.headersSent) res.writeHead(500);
      res.end('dev error');
    }
  })
  .listen(Number(process.env.PORT || 3000), () => console.log(`[dev] http://localhost:${process.env.PORT || 3000}`));
