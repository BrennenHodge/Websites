import { DEFAULT_SETTINGS, STATUS, getSettings, saveSettings } from './lib/agents.js';

const $ = (id) => document.getElementById(id);
const store = chrome.storage.local;

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    node.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return node;
}

function timeAgo(ts) {
  const s = Math.max(0, (Date.now() - new Date(ts).getTime()) / 1000);
  if (s < 45) return 'just now';
  const m = s / 60; if (m < 60) return `${Math.round(m)}m ago`;
  const h = m / 60; if (h < 24) return `${Math.round(h)}h ago`;
  const d = h / 24; return `${Math.round(d)}d ago`;
}

let settings = { ...DEFAULT_SETTINGS };

// ---------- Header: greeting + clock ----------
function renderHeader() {
  const now = new Date();
  const hr = now.getHours();
  const part = hr < 5 ? 'Good night' : hr < 12 ? 'Good morning' : hr < 18 ? 'Good afternoon' : 'Good evening';
  $('greeting').textContent = settings.name ? `${part}, ${settings.name}` : part;
  $('date').textContent = now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
  $('clock').textContent = now.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

function renderLinks() {
  const nav = $('links');
  nav.replaceChildren(...(settings.links || []).map((l) => {
    let host = '';
    try { host = new URL(l.url).href; } catch { return null; }
    const icon = chrome.runtime.getURL(`/_favicon/?pageUrl=${encodeURIComponent(host)}&size=32`);
    return el('a', { href: l.url }, el('img', { src: icon, alt: '' }), l.name);
  }).filter(Boolean));
}

// ---------- Todos ----------
let todos = [];

async function loadTodos() {
  const { todos: t } = await store.get('todos');
  todos = Array.isArray(t) ? t : [];
  renderTodos();
}

function saveTodos() {
  return store.set({ todos });
}

const checkSvg = () => {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('width', '12'); svg.setAttribute('height', '12');
  const p = document.createElementNS(ns, 'path');
  p.setAttribute('d', 'M5 12.5l4.5 4.5L19 7.5'); p.setAttribute('fill', 'none');
  p.setAttribute('stroke', 'currentColor'); p.setAttribute('stroke-width', '3');
  p.setAttribute('stroke-linecap', 'round'); p.setAttribute('stroke-linejoin', 'round');
  svg.append(p);
  return svg;
};

function todoItem(t) {
  const text = el('span', { class: 'todo-text', title: 'Double-click to edit' }, t.text);
  const li = el('li', { class: `todo${t.done ? ' done' : ''}`, 'data-id': t.id, draggable: t.done ? null : 'true' },
    el('button', {
      class: 'check-box', type: 'button',
      'aria-label': t.done ? `Mark "${t.text}" not done` : `Complete "${t.text}"`,
      onclick: () => toggleTodo(t.id),
    }, checkSvg()),
    text,
    el('button', { class: 'todo-del', type: 'button', 'aria-label': `Delete "${t.text}"`, onclick: () => deleteTodo(t.id) }, '×'),
  );
  text.addEventListener('dblclick', () => startEdit(li, t));
  return li;
}

function renderTodos() {
  const open = todos.filter((t) => !t.done);
  const done = todos.filter((t) => t.done).sort((a, b) => (b.doneAt || 0) - (a.doneAt || 0));
  $('todoList').replaceChildren(...open.map(todoItem));
  $('doneList').replaceChildren(...done.map(todoItem));
  $('todoCount').textContent = open.length ? String(open.length) : '';
  $('todoEmpty').hidden = open.length > 0;
  $('doneWrap').hidden = done.length === 0;
  $('doneLabel').textContent = `Completed (${done.length})`;
}

function addTodo(text) {
  const clean = text.trim();
  if (!clean) return;
  todos.unshift({ id: crypto.randomUUID(), text: clean, done: false, createdAt: Date.now() });
  renderTodos();
  saveTodos();
}

function toggleTodo(id) {
  const t = todos.find((x) => x.id === id);
  if (!t) return;
  t.done = !t.done;
  t.doneAt = t.done ? Date.now() : null;
  renderTodos();
  saveTodos();
}

function deleteTodo(id) {
  todos = todos.filter((x) => x.id !== id);
  renderTodos();
  saveTodos();
}

function startEdit(li, t) {
  const span = li.querySelector('.todo-text');
  const input = el('input', { class: 'todo-edit', type: 'text', value: t.text, maxlength: '300' });
  let finished = false;
  const finish = (commit) => {
    if (finished) return;
    finished = true;
    const v = input.value.trim();
    if (commit && v && v !== t.text) { t.text = v; saveTodos(); }
    renderTodos();
  };
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') finish(true);
    if (e.key === 'Escape') finish(false);
  });
  input.addEventListener('blur', () => finish(true));
  li.draggable = false;
  span.replaceWith(input);
  input.focus();
  input.select();
}

// Drag to reorder open todos.
let dragId = null;
const list = $('todoList');
list.addEventListener('dragstart', (e) => {
  const li = e.target.closest('.todo');
  if (!li) return;
  dragId = li.dataset.id;
  li.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
});
list.addEventListener('dragend', () => {
  dragId = null;
  list.querySelectorAll('.todo').forEach((n) => n.classList.remove('dragging', 'drop-before', 'drop-after'));
});
list.addEventListener('dragover', (e) => {
  if (!dragId) return;
  e.preventDefault();
  const li = e.target.closest('.todo');
  list.querySelectorAll('.drop-before,.drop-after').forEach((n) => n.classList.remove('drop-before', 'drop-after'));
  if (!li || li.dataset.id === dragId) return;
  const r = li.getBoundingClientRect();
  li.classList.add(e.clientY < r.top + r.height / 2 ? 'drop-before' : 'drop-after');
});
list.addEventListener('drop', (e) => {
  e.preventDefault();
  const li = e.target.closest('.todo');
  if (!dragId || !li || li.dataset.id === dragId) return;
  const before = li.classList.contains('drop-before');
  const moving = todos.find((t) => t.id === dragId);
  todos = todos.filter((t) => t.id !== dragId);
  let idx = todos.findIndex((t) => t.id === li.dataset.id);
  if (!before) idx += 1;
  todos.splice(idx, 0, moving);
  renderTodos();
  saveTodos();
});

$('todoForm').addEventListener('submit', (e) => {
  e.preventDefault();
  addTodo($('todoInput').value);
  $('todoInput').value = '';
});

$('clearDone').addEventListener('click', () => {
  todos = todos.filter((t) => !t.done);
  renderTodos();
  saveTodos();
});

// ---------- Agents ----------
const GROUPS = [
  { key: 'needs', title: 'Needs you' },
  { key: 'progress', title: 'In progress' },
  { key: 'done', title: 'Recently done', limit: 5 },
];

let agentCache = null;
const expanded = new Set();

function agentRow(item) {
  const meta = STATUS[item.status] || STATUS.running;
  const title = item.url
    ? el('a', { class: 'agent-title', href: item.url, title: item.title }, item.title)
    : el('span', { class: 'agent-title', title: item.title }, item.title);
  const where = item.repo ? `${item.repo}${item.number ? ' #' + item.number : ''}` : null;
  return el('li', { class: `agent tone-${meta.tone}` },
    el('span', { class: 'dot', 'aria-hidden': 'true' }),
    title,
    el('span', { class: 'status' }, meta.label),
    el('div', { class: 'agent-sub' },
      el('span', { class: 'chip' }, item.agent),
      where && el('span', null, where),
      item.detail && el('span', { title: item.detail }, item.detail),
      item.additions != null && el('span', null,
        el('span', { class: 'add-n' }, `+${item.additions}`), ' ',
        el('span', { class: 'del-n' }, `−${item.deletions}`)),
      el('span', null, timeAgo(item.updatedAt)),
    ),
  );
}

function renderAgents() {
  const body = $('agentBody');
  const c = agentCache;
  const errs = $('agentErrors');
  errs.hidden = !(c?.errors?.length);
  errs.textContent = c?.errors?.join(' · ') || '';

  const configured = Boolean(settings.githubToken || settings.feedUrl);
  if (!configured) {
    $('agentMeta').textContent = '';
    body.replaceChildren(el('div', { class: 'onboard' },
      el('h3', null, 'Keep tabs on your agents'),
      el('p', null, 'Connect GitHub to see the pull requests your coding agents are working on: what needs your review, what\'s still running, and what just shipped.'),
      el('button', { class: 'primary', type: 'button', onclick: openSettings }, 'Connect GitHub'),
    ));
    return;
  }

  if (!c) {
    $('agentMeta').textContent = 'Loading…';
    body.replaceChildren();
    return;
  }

  $('agentMeta').textContent = c.fetchedAt ? `Updated ${timeAgo(c.fetchedAt)}` : '';
  const items = c.items || [];
  if (!items.length) {
    body.replaceChildren(el('p', { class: 'empty' },
      settings.agentOnly
        ? `No agent PRs in the last ${settings.lookbackDays} days. Adjust agent patterns in Settings if yours aren't showing.`
        : `No PRs in the last ${settings.lookbackDays} days.`));
    return;
  }

  const sections = GROUPS.map((g) => {
    const rows = items.filter((i) => (STATUS[i.status]?.group || 'progress') === g.key);
    if (!rows.length) return null;
    const showAll = !g.limit || expanded.has(g.key);
    const shown = showAll ? rows : rows.slice(0, g.limit);
    return el('section', { class: 'group' },
      el('h3', { class: 'group-head' }, g.title, el('span', { class: 'pill' }, rows.length)),
      el('ul', { class: 'agent-list' }, shown.map(agentRow)),
      rows.length > shown.length && el('button', {
        class: 'text-btn more', type: 'button',
        onclick: () => { expanded.add(g.key); renderAgents(); },
      }, `Show ${rows.length - shown.length} more`),
    );
  }).filter(Boolean);
  body.replaceChildren(...sections);
}

async function refreshAgents() {
  const btn = $('refreshBtn');
  btn.classList.add('spinning');
  try {
    const res = await chrome.runtime.sendMessage({ type: 'refresh' });
    if (res?.cache) { agentCache = res.cache; renderAgents(); }
  } finally {
    btn.classList.remove('spinning');
  }
}

$('refreshBtn').addEventListener('click', refreshAgents);

// ---------- Settings ----------
const dlg = $('settings');
const form = $('settingsForm');

function openSettings() {
  const f = form.elements;
  f.name.value = settings.name || '';
  f.githubToken.value = settings.githubToken || '';
  f.agentPatterns.value = (settings.agentPatterns || []).join(', ');
  f.agentOnly.checked = !!settings.agentOnly;
  f.lookbackDays.value = settings.lookbackDays;
  f.pollMinutes.value = settings.pollMinutes;
  f.feedUrl.value = settings.feedUrl || '';
  f.notify.checked = !!settings.notify;
  f.links.value = (settings.links || []).map((l) => `${l.name} | ${l.url}`).join('\n');
  $('settingsError').hidden = true;
  dlg.showModal();
}

function parseLinks(text) {
  return text.split('\n').map((line) => {
    const [name, ...rest] = line.split('|');
    const url = rest.join('|').trim();
    if (!name?.trim() || !/^https?:\/\//i.test(url)) return null;
    return { name: name.trim(), url };
  }).filter(Boolean);
}

function originPattern(url) {
  const u = new URL(url);
  return `${u.protocol}//${u.hostname}/*`;
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = form.elements;
  const feedUrl = f.feedUrl.value.trim();
  const showError = (msg) => { $('settingsError').textContent = msg; $('settingsError').hidden = false; };

  // Custom feeds need host permission; request it while we still have the user gesture.
  if (feedUrl) {
    let origin;
    try { origin = originPattern(feedUrl); } catch { return showError('Feed URL is not a valid URL.'); }
    const granted = await chrome.permissions.request({ origins: [origin] }).catch(() => false);
    if (!granted) return showError(`Helm needs permission to read ${new URL(feedUrl).host} for the feed.`);
  }

  settings = await saveSettings({
    name: f.name.value.trim(),
    githubToken: f.githubToken.value.trim(),
    agentPatterns: f.agentPatterns.value.split(',').map((s) => s.trim()).filter(Boolean),
    agentOnly: f.agentOnly.checked,
    lookbackDays: Math.min(60, Math.max(1, parseInt(f.lookbackDays.value, 10) || 7)),
    pollMinutes: Math.min(120, Math.max(1, parseInt(f.pollMinutes.value, 10) || 5)),
    feedUrl,
    notify: f.notify.checked,
    links: parseLinks(f.links.value),
  });
  dlg.close();
  renderHeader();
  renderLinks();
  agentCache = null;
  renderAgents();
  await chrome.runtime.sendMessage({ type: 'reschedule' });
  const { agentCache: fresh } = await store.get('agentCache');
  agentCache = fresh || null;
  renderAgents();
});

$('cancelSettings').addEventListener('click', () => dlg.close());
$('settingsBtn').addEventListener('click', openSettings);

// ---------- Live updates across tabs ----------
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  if (changes.todos && !document.querySelector('.todo-edit')) {
    todos = changes.todos.newValue || [];
    renderTodos();
  }
  if (changes.agentCache) {
    agentCache = changes.agentCache.newValue || null;
    renderAgents();
  }
  if (changes.settings) {
    settings = { ...DEFAULT_SETTINGS, ...(changes.settings.newValue || {}) };
    renderHeader();
    renderLinks();
  }
});

// ---------- Boot ----------
(async function init() {
  settings = await getSettings();
  renderHeader();
  renderLinks();
  setInterval(renderHeader, 10_000);
  await loadTodos();

  const { agentCache: cached } = await store.get('agentCache');
  agentCache = cached || null;
  renderAgents();
  setInterval(renderAgents, 60_000); // keep "x ago" labels fresh

  // Refresh in the background if the cache is older than a minute.
  if (settings.githubToken || settings.feedUrl) {
    if (!cached?.fetchedAt || Date.now() - cached.fetchedAt > 60_000) refreshAgents();
  }
  $('todoInput').focus();
})();
