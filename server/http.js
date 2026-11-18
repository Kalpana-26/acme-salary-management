import { createServer } from 'node:http';
import { timingSafeEqual, createHash } from 'node:crypto';
import { createReadStream, mkdirSync } from 'node:fs';
import { stat } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { directory, employeeDetail, InputError, openDatabase, updateSalary } from './pay.js';
import { defaultDatabase, seed } from './seed.js';

function send(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

async function readJSON(req) {
  if (req.headers['content-type']?.split(';')[0] !== 'application/json') {
    throw new InputError('Send an application/json body.', 415);
  }
  const chunks = [];
  let bytes = 0;
  for await (const chunk of req.iterator({ destroyOnReturn: false })) {
    bytes += chunk.length;
    if (bytes > 4096) {
      req.resume();
      throw new InputError('Request body is too large.', 413);
    }
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new InputError('Invalid JSON.');
  }
}

const digest = (value) => createHash('sha256').update(value).digest();
const mediaTypes = { js: 'text/javascript', css: 'text/css', html: 'text/html' };

export function salaryServer(db, { password, dist = resolve('dist') } = {}) {
  const credential = password && digest('Basic ' + Buffer.from('reviewer:' + password).toString('base64'));
  return createServer(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'self'; frame-ancestors 'none'; base-uri 'none'");
    try {
      const url = new URL(req.url, 'http://localhost');
      if (url.pathname === '/health' && req.method === 'GET') return send(res, 200, { status: 'ok' });
      if (credential && !timingSafeEqual(digest(req.headers.authorization ?? ''), credential)) {
        res.setHeader('WWW-Authenticate', 'Basic realm="ACME Salary Review"');
        return send(res, 401, { error: 'Reviewer sign-in required.' });
      }
      if (url.pathname === '/api/employees' && req.method === 'GET') {
        return send(res, 200, directory(db, url.searchParams));
      }
      if (url.pathname === '/api/filters' && req.method === 'GET') {
        const countries = db.prepare('SELECT DISTINCT country FROM employees ORDER BY country').all().map(row => row.country);
        const departments = db.prepare('SELECT DISTINCT department FROM employees ORDER BY department').all().map(row => row.department);
        return send(res, 200, { countries, departments });
      }
      const match = /^\/api\/employees\/(\d+)$/.exec(url.pathname);
      if (match && req.method === 'GET') return send(res, 200, employeeDetail(db, Number(match[1])));
      if (match && req.method === 'PATCH') {
        const body = await readJSON(req);
        return send(res, 200, updateSalary(db, Number(match[1]), body?.amount, body?.version));
      }
      const file = url.pathname === '/' ? '/index.html' : url.pathname;
      if (req.method === 'GET' && /^\/(index\.html|assets\/[\w.-]+\.(js|css))$/.test(file)) {
        const path = resolve(dist, '.' + file);
        const info = await stat(path).catch(error => {
          if (error.code === 'ENOENT') throw new InputError('Frontend missing. Run the build first.', 404);
          throw error;
        });
        res.writeHead(200, { 'Content-Type': mediaTypes[file.split('.').at(-1)], 'Content-Length': info.size });
        createReadStream(path).on('error', () => res.destroy()).pipe(res);
        return;
      }
      send(res, 404, { error: 'Route not found.' });
    } catch (error) {
      if (error instanceof InputError) return send(res, error.status, { error: error.message });
      console.error(error);
      send(res, 500, { error: 'Unable to complete the request.' });
    }
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const password = process.env.REVIEWER_PASSWORD;
  const host = process.env.HOST || '127.0.0.1';
  if (host !== '127.0.0.1' && !password) throw new Error('Set REVIEWER_PASSWORD to listen beyond localhost.');
  mkdirSync(dirname(defaultDatabase), { recursive: true });
  const db = openDatabase(defaultDatabase);
  seed(db);
  const port = Number(process.env.PORT || 3000);
  salaryServer(db, { password }).listen(port, host, () => console.log(`ACME salary management listening on ${host}:${port}`));
}
