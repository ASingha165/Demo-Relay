import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';
import { mkdirSync, readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

const fields = { project: 100, presenter: 100, owner: 100, demo: 1000, repo: 1000, fallback: 1000, order: 2000 };
const html = readFileSync(new URL('./public/index.html', import.meta.url));
const directory = process.env.DATA_DIR || 'data';
mkdirSync(directory, { recursive: true });
const db = new DatabaseSync(directory + '/handoffs.sqlite');
db.exec('CREATE TABLE IF NOT EXISTS handoffs (id TEXT PRIMARY KEY, body TEXT NOT NULL)');
const find = db.prepare('SELECT body FROM handoffs WHERE id = ?');
const insert = db.prepare('INSERT INTO handoffs (id, body) VALUES (?, ?)');

function json(response, status, body) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  response.end(JSON.stringify(body));
}

function valid(state) {
  return state && typeof state === 'object' &&
    Object.entries(fields).every(([key, limit]) => typeof state[key] === 'string' && state[key].length <= limit) &&
    state.project.trim() && Array.isArray(state.checked) && state.checked.length === 4 &&
    state.checked.every(value => typeof value === 'boolean');
}

async function handle(request, response) {
  const path = new URL(request.url, 'http://localhost').pathname;
  if (request.method === 'GET' && path === '/') {
    response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Referrer-Policy': 'no-referrer' });
    return response.end(html);
  }
  const id = /^[/]api[/]handoffs[/]([a-f0-9]{32})$/.exec(path)?.[1];
  if (request.method === 'GET' && id) {
    const row = find.get(id);
    return row ? json(response, 200, JSON.parse(row.body)) : json(response, 404, { error: 'Handoff not found.' });
  }
  if (request.method !== 'POST' || path !== '/api/handoffs') {
    return json(response, 404, { error: 'Page not found.' });
  }
  if (request.headers['content-type']?.split(';')[0].trim() !== 'application/json') {
    return json(response, 415, { error: 'Send JSON.' });
  }

  const chunks = [];
  let bytes = 0;
  for await (const chunk of request.iterator({ destroyOnReturn: false })) {
    bytes += chunk.length;
    if (bytes > 48 * 1024) {
      response.setHeader('Connection', 'close');
      return json(response, 413, { error: 'Handoff is too large.' });
    }
    chunks.push(chunk);
  }
  let state;
  try { state = JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { return json(response, 400, { error: 'Invalid JSON.' }); }
  if (!valid(state)) return json(response, 400, { error: 'Enter a project name and valid handoff details.' });

  const snapshot = Object.fromEntries(Object.keys(fields).map(key => [key, state[key]]));
  snapshot.checked = state.checked;
  const shareId = randomBytes(16).toString('hex');
  insert.run(shareId, JSON.stringify(snapshot));
  return json(response, 201, { id: shareId });
}

createServer((request, response) => {
  handle(request, response).catch(error => {
    console.error(error);
    if (response.headersSent || response.destroyed) return response.destroy();
    json(response, 500, { error: 'Unable to process the handoff.' });
  });
}).listen(Number(process.env.PORT || 3000), process.env.HOST || '127.0.0.1', function () {
  console.log('Demo Relay listening on port ' + this.address().port);
});
