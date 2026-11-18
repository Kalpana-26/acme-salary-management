import { createServer } from 'node:http';
import { timingSafeEqual, createHash, randomBytes } from 'node:crypto';
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
const sessionLifetime = 8 * 60 * 60;

export function salaryServer(db, { password, secureCookie = false, dist = resolve('dist') } = {}) {
  const credential = password && digest(password);
  const sessions = new Map();
  const cookie = (value, age) => `acme_session=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${age}${secureCookie ? '; Secure' : ''}`;
  return createServer(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'self'; frame-ancestors 'none'; base-uri 'none'");
    try {
      const url = new URL(req.url, 'http://localhost');
      if (url.pathname === '/health' && req.method === 'GET') return send(res, 200, { status: 'ok' });
      const token = req.headers.cookie?.match(/(?:^|;\s*)acme_session=([a-f0-9]{64})(?:;|$)/)?.[1];
      const signedIn = !credential || (sessions.get(token) ?? 0) > Date.now();
      if (url.pathname === '/api/session' && req.method === 'GET') {
        return send(res, 200, { signedIn, signInRequired: Boolean(credential) });
      }
      if (url.pathname === '/api/session' && req.method === 'POST') {
        const body = await readJSON(req);
        if (!credential || body?.username !== 'reviewer' || typeof body?.password !== 'string' ||
          !timingSafeEqual(digest(body.password), credential)) {
          throw new InputError('The username or password is incorrect.', 401);
        }
        for (const [key, expiry] of sessions) {
          if (expiry <= Date.now()) sessions.delete(key);
        }
        sessions.delete(token);
        const next = randomBytes(32).toString('hex');
        sessions.set(next, Date.now() + sessionLifetime * 1000);
        res.setHeader('Set-Cookie', cookie(next, sessionLifetime));
        return send(res, 200, { signedIn: true, signInRequired: true });
      }
      if (url.pathname === '/api/session' && req.method === 'DELETE') {
        sessions.delete(token);
        res.setHeader('Set-Cookie', cookie('', 0));
        return send(res, 200, { signedIn: !credential, signInRequired: Boolean(credential) });
      }
      if (!signedIn && url.pathname.startsWith('/api/')) {
        throw new InputError('Sign in to continue.', 401);
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
  salaryServer(db, { password: password || 'acme-local-demo', secureCookie: process.env.COOKIE_SECURE === '1' })
    .listen(port, host, () => console.log(`ACME salary management listening on ${host}:${port}`));
}
