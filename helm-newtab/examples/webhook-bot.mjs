// A minimal webhook agent for Helm, to show the full loop:
//   1. Helm POSTs { taskId, task, agent, createdAt } to /tasks
//   2. The bot "works" on it (here: a timer; in real life, call your model or script)
//   3. It reports progress at /feed, which Helm polls (set as the Status feed URL)
//
// Usage: node examples/webhook-bot.mjs
//   Agent webhook URL:  http://127.0.0.1:4318/tasks
//   Status feed URL:    http://127.0.0.1:4318/feed
import http from 'node:http';

const port = Number(process.env.PORT) || 4318;
const jobs = new Map(); // taskId -> { title, status, detail, updatedAt }

function set(taskId, patch) {
  jobs.set(taskId, { ...jobs.get(taskId), ...patch, updatedAt: new Date().toISOString() });
}

http.createServer((req, res) => {
  res.setHeader('access-control-allow-origin', '*');
  res.setHeader('access-control-allow-headers', 'content-type, authorization');
  if (req.method === 'OPTIONS') return res.end();

  if (req.method === 'POST' && req.url === '/tasks') {
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
      const { taskId, task } = JSON.parse(body || '{}');
      if (!taskId || !task) { res.statusCode = 400; return res.end('taskId and task required'); }
      console.log(`→ new task ${taskId}: ${task}`);
      set(taskId, { title: task, status: 'working', detail: 'Picked up' });
      // Replace these timers with real work.
      setTimeout(() => set(taskId, { status: 'working', detail: 'Halfway there' }), 20_000);
      setTimeout(() => set(taskId, { status: 'done', detail: 'Finished' }), 60_000);
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ ok: true }));
    });
    return;
  }

  if (req.method === 'GET' && req.url === '/feed') {
    const items = [...jobs].map(([taskId, j]) => ({ taskId, id: taskId, agent: 'Webhook bot', ...j }));
    res.setHeader('content-type', 'application/json');
    return res.end(JSON.stringify(items));
  }

  res.statusCode = 404;
  res.end();
}).listen(port, '127.0.0.1', () => console.log(`Webhook bot on http://127.0.0.1:${port}  (POST /tasks, GET /feed)`));
