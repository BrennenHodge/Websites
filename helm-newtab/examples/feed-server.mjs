// Minimal local agent feed for Helm.
// Usage: node examples/feed-server.mjs [path/to/agents.json]
// Then set the feed URL in Helm's settings to http://127.0.0.1:4317/agents.json
// Edit the JSON file while it runs; Helm picks up changes on its next refresh.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const file = process.argv[2] || fileURLToPath(new URL('./agents.json', import.meta.url));
const port = Number(process.env.PORT) || 4317;

http.createServer(async (_req, res) => {
  try {
    const body = await readFile(file, 'utf8');
    JSON.parse(body); // fail loudly on bad JSON
    res.writeHead(200, { 'content-type': 'application/json', 'access-control-allow-origin': '*' });
    res.end(body);
  } catch (e) {
    res.writeHead(500, { 'content-type': 'text/plain' });
    res.end(String(e.message || e));
  }
}).listen(port, '127.0.0.1', () => console.log(`Helm feed: http://127.0.0.1:${port}/agents.json  (serving ${file})`));
