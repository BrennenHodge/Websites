import { getSettings, agentById, fetchActivity, fetchFeed, STATUS } from './lib/agents.js';
import { quickRoute, claudeRoute } from './lib/router.js';
import { dispatchTask, trackGitHubTasks } from './lib/dispatch.js';

const ALARM = 'helm-poll';

// ---------- Task store (this worker is the only writer) ----------
let lock = Promise.resolve();
function mutate(fn) {
  const run = lock.then(async () => {
    const { tasks = [] } = await chrome.storage.local.get('tasks');
    const out = await fn(tasks);
    await chrome.storage.local.set({ tasks });
    return out;
  });
  lock = run.catch(() => {});
  return run;
}
const patchTask = (id, patch) => mutate((tasks) => {
  const t = tasks.find((x) => x.id === id);
  if (t) Object.assign(t, patch, { updatedAt: Date.now() });
  return t;
});

async function addTask(rawText, sendNow) {
  const settings = await getSettings();
  const route = quickRoute(rawText.trim(), settings);
  const useClaude = route.by !== 'mention' && settings.smartRouting && settings.anthropicKey;
  const agent = agentById(settings, route.agentId);
  const task = {
    id: crypto.randomUUID(),
    text: route.text,
    agentId: agent.id,
    route: { by: route.by, reason: route.reason },
    routing: Boolean(useClaude),
    status: agent.method === 'none' ? 'todo' : 'queued',
    done: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  await mutate((tasks) => { tasks.unshift(task); });

  // Finish routing and (optionally) dispatch in the background.
  (async () => {
    let current = task;
    if (useClaude) {
      try {
        const r = await claudeRoute(task.text, settings);
        const a = agentById(settings, r.agentId);
        current = await patchTask(task.id, {
          agentId: a.id, routing: false,
          route: { by: 'claude', reason: r.reason },
          status: a.method === 'none' ? 'todo' : 'queued',
        });
      } catch (e) {
        current = await patchTask(task.id, {
          routing: false,
          route: { ...task.route, reason: `${task.route.reason} (Claude routing failed: ${e.message})` },
        });
      }
    }
    if (!current) return;
    const a = agentById(settings, current.agentId);
    const auto = sendNow || settings.autoDispatch;
    if (auto && (a.method === 'github' || a.method === 'webhook')) await sendTask(current.id);
  })();
  return task;
}

async function sendTask(id) {
  const settings = await getSettings();
  const task = await patchTask(id, { status: 'sending', error: null });
  if (!task) return;
  const agent = agentById(settings, task.agentId);
  try {
    const result = await dispatchTask(task, agent, settings);
    await patchTask(id, { status: result.status, dispatch: result.dispatch, sentAt: Date.now() });
    run(); // pick up early progress
  } catch (e) {
    await patchTask(id, { status: 'error', error: e.message || String(e) });
  }
}

// ---------- Polling: activity + task tracking ----------
let inFlight = null;
function run() {
  if (!inFlight) inFlight = refresh().finally(() => { inFlight = null; });
  return inFlight;
}

async function refresh() {
  const settings = await getSettings();
  const errors = [];
  let activity = [];
  let feed = [];
  let trackUpdates = {};

  const { tasks: snapshot = [] } = await chrome.storage.local.get('tasks');

  if (settings.githubToken) {
    const [act, track] = await Promise.allSettled([
      fetchActivity(settings),
      trackGitHubTasks(snapshot, settings),
    ]);
    if (act.status === 'fulfilled') activity = act.value.items;
    else errors.push(act.reason?.message || String(act.reason));
    if (track.status === 'fulfilled') trackUpdates = track.value;
    else errors.push(`Tracking: ${track.reason?.message || track.reason}`);
  }
  if (settings.feedUrl) {
    try { feed = await fetchFeed(settings.feedUrl); } catch (e) { errors.push(`Feed: ${e.message || e}`); }
  }
  for (const f of feed) {
    if (f.taskId) trackUpdates[f.taskId] = { status: f.status, detail: f.detail, link: f.url || undefined };
  }

  // Apply tracking results to tasks, remembering what changed for notifications.
  const changed = [];
  const tasks = await mutate((list) => {
    for (const t of list) {
      const u = trackUpdates[t.id];
      if (!u || t.done || ['queued', 'todo', 'sending', 'error'].includes(t.status)) continue;
      if (u.status !== t.status) changed.push({ task: t, from: t.status, to: u.status });
      t.status = u.status;
      t.detail = u.detail ?? t.detail;
      if (u.pr !== undefined) t.pr = u.pr;
      if (u.link) t.link = u.link;
    }
    return list.map((t) => ({ ...t }));
  });

  // Activity = agent work not already represented by a task.
  const linked = new Set(tasks.flatMap((t) => [t.pr?.url, t.dispatch?.url].filter(Boolean)));
  const items = [...activity.filter((i) => !linked.has(i.url)), ...feed.filter((f) => !f.taskId)]
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

  const { agentCache: prev } = await chrome.storage.local.get('agentCache');
  const keepOld = errors.length && !items.length && prev?.items?.length;
  const cache = {
    items: keepOld ? prev.items : items,
    fetchedAt: keepOld ? prev.fetchedAt : Date.now(),
    errors,
  };
  await chrome.storage.local.set({ agentCache: cache });

  await updateBadge(tasks, cache.items);
  if (settings.notify) {
    notifyTasks(changed, settings);
    notifyActivity(prev, cache);
  }
  return cache;
}

async function updateBadge(tasks, items) {
  const needs = tasks.filter((t) => !t.done && STATUS[t.status]?.group === 'needs').length
    + items.filter((i) => STATUS[i.status]?.group === 'needs').length;
  await chrome.action.setBadgeText({ text: needs ? String(needs) : '' });
  await chrome.action.setBadgeBackgroundColor({ color: '#E5484D' });
}

function notifyTasks(changed, settings) {
  for (const { task, to } of changed) {
    const group = STATUS[to]?.group;
    if (group !== 'needs' && group !== 'done') continue;
    const agent = agentById(settings, task.agentId);
    chrome.notifications.create(task.pr?.url || task.dispatch?.url || task.link || `task:${task.id}`, {
      type: 'basic',
      iconUrl: 'icons/icon128.png',
      title: `${agent.name}: ${STATUS[to].label}`,
      message: task.text,
      priority: group === 'needs' ? 1 : 0,
    });
  }
}

function notifyActivity(prev, cache) {
  if (!prev?.items) return; // first run: don't spam
  const before = new Map(prev.items.map((i) => [i.id, i.status]));
  for (const item of cache.items) {
    const was = before.get(item.id);
    if (was === item.status) continue;
    const group = STATUS[item.status]?.group;
    if (group !== 'needs' && item.status !== 'merged' && item.status !== 'done') continue;
    if (!was && group !== 'needs') continue;
    chrome.notifications.create(item.url || item.id, {
      type: 'basic',
      iconUrl: 'icons/icon128.png',
      title: `${item.agent}: ${STATUS[item.status].label}`,
      message: item.title,
      contextMessage: item.repo ? `${item.repo}${item.number ? ' #' + item.number : ''}` : '',
      priority: group === 'needs' ? 1 : 0,
    });
  }
}

chrome.notifications.onClicked.addListener((id) => {
  if (/^https?:\/\//.test(id)) chrome.tabs.create({ url: id });
  else chrome.tabs.create({ url: 'chrome://newtab' });
  chrome.notifications.clear(id);
});

chrome.action.onClicked.addListener(() => chrome.tabs.create({ url: 'chrome://newtab' }));

// ---------- Lifecycle ----------
async function schedule() {
  const s = await getSettings();
  await chrome.alarms.clear(ALARM);
  chrome.alarms.create(ALARM, { periodInMinutes: Math.max(1, Number(s.pollMinutes) || 5) });
}

// v0.1 stored plain todos; carry them over as your own tasks.
async function migrate() {
  const { todos, tasks } = await chrome.storage.local.get(['todos', 'tasks']);
  if (Array.isArray(todos) && !tasks) {
    await chrome.storage.local.set({
      tasks: todos.map((t) => ({
        id: t.id, text: t.text, agentId: 'me', route: { by: 'manual', reason: 'Imported todo' },
        status: 'todo', done: !!t.done, doneAt: t.doneAt || null, createdAt: t.createdAt || Date.now(), updatedAt: Date.now(),
      })),
    });
  }
  if (todos) await chrome.storage.local.remove('todos');
}

chrome.runtime.onInstalled.addListener(async () => { await migrate(); schedule(); run(); });
chrome.runtime.onStartup.addListener(() => { schedule(); run(); });
chrome.alarms.onAlarm.addListener((a) => { if (a.name === ALARM) run(); });

// ---------- Messages from the new tab page ----------
const handlers = {
  refresh: () => run(),
  reschedule: async () => { await schedule(); return run(); },
  'task:add': ({ text, send }) => addTask(text, send),
  'task:send': ({ id }) => sendTask(id),
  'task:markSent': ({ id, url }) => patchTask(id, { status: 'sent', sentAt: Date.now(), dispatch: { method: 'link', at: Date.now(), url } }),
  'task:edit': ({ id, text }) => patchTask(id, { text }),
  'task:assign': async ({ id, agentId }) => {
    const settings = await getSettings();
    const a = agentById(settings, agentId);
    return patchTask(id, {
      agentId: a.id, route: { by: 'manual', reason: 'Assigned by you' },
      status: a.method === 'none' ? 'todo' : 'queued', error: null,
    });
  },
  'task:toggle': ({ id }) => mutate((tasks) => {
    const t = tasks.find((x) => x.id === id);
    if (t) { t.done = !t.done; t.doneAt = t.done ? Date.now() : null; }
  }),
  'task:delete': ({ id }) => mutate((tasks) => {
    const i = tasks.findIndex((x) => x.id === id);
    if (i >= 0) tasks.splice(i, 1);
  }),
  'task:move': ({ id, targetId, before }) => mutate((tasks) => {
    const from = tasks.findIndex((x) => x.id === id);
    if (from < 0) return;
    const [moving] = tasks.splice(from, 1);
    let to = tasks.findIndex((x) => x.id === targetId);
    if (to < 0) { tasks.splice(from, 0, moving); return; }
    if (!before) to += 1;
    tasks.splice(to, 0, moving);
  }),
  'task:clearDone': () => mutate((tasks) => {
    const keep = tasks.filter((t) => !(t.done || STATUS[t.status]?.group === 'done'));
    tasks.splice(0, tasks.length, ...keep);
  }),
};

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  const handler = handlers[msg?.type];
  if (!handler) return;
  Promise.resolve(handler(msg))
    .then((result) => sendResponse({ ok: true, result }))
    .catch((e) => sendResponse({ ok: false, error: e.message || String(e) }));
  return true;
});
