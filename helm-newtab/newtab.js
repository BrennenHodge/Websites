import { DEFAULT_SETTINGS, STATUS, METHOD_LABEL, getSettings, saveSettings, agentById } from './lib/agents.js';
import { quickRoute } from './lib/router.js';
import { linkFor, repoFor } from './lib/dispatch.js';

const $ = (id) => document.getElementById(id);
const store = chrome.storage.local;
const send = (type, payload = {}) => chrome.runtime.sendMessage({ type, ...payload });

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) {
    if (c == null || c === false || c === '') continue;
    node.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return node;
}

function timeAgo(ts) {
  const s = Math.max(0, (Date.now() - new Date(ts).getTime()) / 1000);
  if (s < 45) return 'just now';
  const m = s / 60; if (m < 60) return `${Math.round(m)}m ago`;
  const h = m / 60; if (h < 24) return `${Math.round(h)}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

let toastTimer;
function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, 3500);
}

let settings = { ...DEFAULT_SETTINGS };
let tasks = [];
let agentCache = null;

// ---------- Header ----------
function renderHeader() {
  const now = new Date();
  const hr = now.getHours();
  const part = hr < 5 ? 'Good night' : hr < 12 ? 'Good morning' : hr < 18 ? 'Good afternoon' : 'Good evening';
  $('greeting').textContent = settings.name ? `${part}, ${settings.name}` : part;
  $('date').textContent = now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
  $('clock').textContent = now.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

function renderLinks() {
  $('links').replaceChildren(...(settings.links || []).map((l) => {
    let href;
    try { href = new URL(l.url).href; } catch { return null; }
    const icon = chrome.runtime.getURL(`/_favicon/?pageUrl=${encodeURIComponent(href)}&size=32`);
    return el('a', { href }, el('img', { src: icon, alt: '' }), l.name);
  }).filter(Boolean));
}

// ---------- Tasks ----------
const isCompleted = (t) => t.done || STATUS[t.status]?.group === 'done';

const TASK_GROUPS = [
  { key: 'needs', title: 'Needs you' },
  { key: 'queued', title: 'Ready to send' },
  { key: 'mine', title: 'Your todos' },
  { key: 'progress', title: 'Agents working' },
];

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

function openLinkTask(task, agent) {
  const url = linkFor(agent, task.text);
  navigator.clipboard.writeText(task.text).catch(() => {});
  if (url) window.open(url, '_blank', 'noopener');
  send('task:markSent', { id: task.id, url });
  toast(url && !agent.url.includes('{task}')
    ? `Task copied. Paste it into ${agent.name}.`
    : `Sent to ${agent.name}.`);
}

function agentControl(task, agent) {
  const editable = ['queued', 'todo', 'error'].includes(task.status) && !isCompleted(task);
  if (!editable) return el('span', { class: `agent-tag${agent.method === 'none' ? ' me' : ''}` }, agent.name);
  const select = el('select', {
    class: 'agent-pick', 'aria-label': `Agent for "${task.text}"`, title: task.route?.reason || '',
    onchange: (e) => send('task:assign', { id: task.id, agentId: e.target.value }),
  }, settings.agents.map((a) => el('option', { value: a.id, selected: a.id === agent.id }, a.name)));
  return select;
}

function actionFor(task, agent) {
  if (isCompleted(task) || task.routing) return null;
  if (task.status === 'queued') {
    if (agent.method === 'link') {
      return el('button', { class: 'small-btn go', type: 'button', title: `Open ${agent.name} and copy the task`, onclick: () => openLinkTask(task, agent) }, 'Open');
    }
    return el('button', { class: 'small-btn go', type: 'button', onclick: () => send('task:send', { id: task.id }) }, 'Send');
  }
  if (task.status === 'error') {
    return el('button', { class: 'small-btn', type: 'button', onclick: () => send('task:send', { id: task.id }) }, 'Retry');
  }
  if (STATUS[task.status]?.group === 'needs' && task.pr?.url) {
    return el('a', { class: 'small-btn go', href: task.pr.url }, 'Review');
  }
  return null;
}

function taskItem(task) {
  const agent = agentById(settings, task.agentId);
  const meta = STATUS[task.status] || STATUS.queued;
  const completed = isCompleted(task);
  const label = task.routing ? 'Routing…' : completed && task.done && meta.group !== 'done' ? '' : meta.label;

  const text = el('span', { class: 'task-text', title: 'Double-click to edit' }, task.text);
  if (!completed) text.addEventListener('dblclick', () => startEdit(text, task));

  const sub = [];
  if (agent.method !== 'none' || task.route?.by === 'claude') {
    if (task.route?.reason && ['queued', 'error', 'todo'].includes(task.status)) {
      sub.push(el('span', null, task.route.by === 'claude' ? `✦ ${task.route.reason}` : task.route.reason));
    }
  }
  if (task.dispatch?.method === 'github' && task.dispatch.url) {
    sub.push(el('a', { href: task.dispatch.url }, `${task.dispatch.repo}#${task.dispatch.number}`));
  } else if (task.dispatch?.url) {
    sub.push(el('a', { href: task.dispatch.url }, task.dispatch.method === 'link' ? `Open in ${agent.name}` : 'Open'));
  }
  if (task.pr?.url) {
    sub.push(el('a', { href: task.pr.url }, `PR #${task.pr.number}`,
      task.pr.additions != null ? el('span', null, ' ', el('span', { class: 'add-n' }, `+${task.pr.additions}`), ' ', el('span', { class: 'del-n' }, `−${task.pr.deletions}`)) : null));
  }
  if (task.link && !task.pr) sub.push(el('a', { href: task.link }, 'Details'));
  if (task.detail && !completed) sub.push(el('span', { class: 'quote', title: task.detail }, `“${task.detail}”`));
  if (task.status === 'error' && task.error) sub.push(el('span', { class: 'err' }, task.error));
  if (task.sentAt && !completed) sub.push(el('span', null, `sent ${timeAgo(task.sentAt)}`));

  return el('li', {
    class: `task tone-${meta.tone}${completed ? ' done' : ''}${task.routing ? ' routing' : ''}`,
    'data-id': task.id,
    draggable: completed ? null : 'true',
  },
    el('button', {
      class: 'check-box', type: 'button',
      'aria-label': completed ? `Mark "${task.text}" not done` : `Mark "${task.text}" done`,
      onclick: () => send('task:toggle', { id: task.id }),
    }, checkSvg()),
    el('div', { class: 'task-main' },
      el('div', { class: 'task-line' },
        text,
        el('div', { class: 'task-side' },
          agentControl(task, agent),
          label && el('span', { class: 'status' }, label),
          actionFor(task, agent),
        ),
      ),
      sub.length ? el('div', { class: 'task-sub' }, sub) : null,
    ),
    el('button', { class: 'task-del', type: 'button', 'aria-label': `Delete "${task.text}"`, onclick: () => send('task:delete', { id: task.id }) }, '×'),
  );
}

function renderTasks() {
  const open = tasks.filter((t) => !isCompleted(t));
  const done = tasks.filter(isCompleted).sort((a, b) => (b.doneAt || b.updatedAt || 0) - (a.doneAt || a.updatedAt || 0));

  const groups = TASK_GROUPS.map((g) => {
    const rows = open.filter((t) => (STATUS[t.status]?.group || 'queued') === g.key);
    if (!rows.length) return null;
    return el('section', { class: 'task-group' },
      el('h3', { class: 'group-head' }, g.title, el('span', { class: 'pill' }, rows.length)),
      el('ul', { class: 'tasks' }, rows.map(taskItem)),
    );
  }).filter(Boolean);

  if (!document.querySelector('.task-edit')) $('taskGroups').replaceChildren(...groups);
  $('doneList').replaceChildren(...done.map(taskItem));
  $('taskCount').textContent = open.length ? String(open.length) : '';
  $('taskEmpty').hidden = open.length > 0;
  $('doneWrap').hidden = done.length === 0;
  $('doneLabel').textContent = `Completed (${done.length})`;
  renderRoster();
}

function startEdit(span, task) {
  const input = el('input', { class: 'task-edit', type: 'text', value: task.text, maxlength: '500' });
  let finished = false;
  const finish = (commit) => {
    if (finished) return;
    finished = true;
    const v = input.value.trim();
    input.remove();
    if (commit && v && v !== task.text) send('task:edit', { id: task.id, text: v });
    renderTasks();
  };
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') finish(true);
    if (e.key === 'Escape') finish(false);
  });
  input.addEventListener('blur', () => finish(true));
  span.closest('.task').draggable = false;
  span.replaceWith(input);
  input.focus();
  input.select();
}

// Drag to reorder.
let dragId = null;
const groupsEl = $('taskGroups');
groupsEl.addEventListener('dragstart', (e) => {
  const li = e.target.closest?.('.task');
  if (!li) return;
  dragId = li.dataset.id;
  li.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
});
groupsEl.addEventListener('dragend', () => {
  dragId = null;
  groupsEl.querySelectorAll('.task').forEach((n) => n.classList.remove('dragging', 'drop-before', 'drop-after'));
});
groupsEl.addEventListener('dragover', (e) => {
  if (!dragId) return;
  e.preventDefault();
  groupsEl.querySelectorAll('.drop-before,.drop-after').forEach((n) => n.classList.remove('drop-before', 'drop-after'));
  const li = e.target.closest?.('.task');
  if (!li || li.dataset.id === dragId) return;
  const r = li.getBoundingClientRect();
  li.classList.add(e.clientY < r.top + r.height / 2 ? 'drop-before' : 'drop-after');
});
groupsEl.addEventListener('drop', (e) => {
  e.preventDefault();
  const li = e.target.closest?.('.task');
  if (!dragId || !li || li.dataset.id === dragId) return;
  send('task:move', { id: dragId, targetId: li.dataset.id, before: li.classList.contains('drop-before') });
});

// Input: live routing preview, Enter to add, Ctrl/Cmd+Enter to add and send.
const input = $('taskInput');
const isMac = /Mac|iPhone|iPad/.test(navigator.platform);
$('sendKey').textContent = isMac ? '⌘' : 'Ctrl';

function updatePreview() {
  const text = input.value.trim();
  const chip = $('routePreview');
  if (!text) { chip.hidden = true; return; }
  const r = quickRoute(text, settings);
  const smart = r.by !== 'mention' && settings.smartRouting && settings.anthropicKey;
  chip.textContent = smart ? '→ Auto' : `→ ${agentById(settings, r.agentId).name}`;
  chip.title = smart ? 'Claude will pick the agent' : r.reason;
  chip.hidden = false;
}
input.addEventListener('input', updatePreview);
input.addEventListener('keydown', async (e) => {
  if (e.key !== 'Enter' || e.isComposing) return;
  e.preventDefault();
  const text = input.value.trim();
  if (!text) return;
  input.value = '';
  updatePreview();
  const sendNow = e.metaKey || e.ctrlKey;
  const res = await send('task:add', { text, send: sendNow });
  const task = res?.result;
  // Link agents need a click in this page (clipboard + new tab), so handle them here.
  if (sendNow && task && !task.routing) {
    const agent = agentById(settings, task.agentId);
    if (agent.method === 'link') openLinkTask(task, agent);
  }
});
$('taskForm').addEventListener('submit', (e) => e.preventDefault());

$('clearDone').addEventListener('click', () => send('task:clearDone'));

// ---------- Agents: roster + activity ----------
function agentWhere(a) {
  if (a.method === 'github') {
    const repo = repoFor(a, settings);
    return repo ? `GitHub issue in ${repo}${a.mention ? ` · ${a.mention}` : ''}` : null;
  }
  if (a.method === 'webhook') return a.webhookUrl ? `Webhook · ${safeHost(a.webhookUrl)}` : null;
  if (a.method === 'link') return a.url ? `Opens ${safeHost(a.url)}` : null;
  return 'Your own todos';
}
function safeHost(u) { try { return new URL(u.replace('{task}', '')).host; } catch { return u; } }

function renderRoster() {
  const rows = settings.agents.map((a) => {
    const mine = tasks.filter((t) => t.agentId === a.id && !isCompleted(t));
    const needs = mine.filter((t) => STATUS[t.status]?.group === 'needs').length;
    const working = mine.filter((t) => STATUS[t.status]?.group === 'progress').length;
    const queued = mine.filter((t) => t.status === 'queued' || t.status === 'todo').length;
    const where = agentWhere(a);
    return el('li', null,
      el('span', { class: 'avatar', 'aria-hidden': 'true' }, (a.name || '?').trim()[0].toUpperCase()),
      el('div', { class: 'who' },
        el('b', null, a.name),
        where ? el('span', null, where) : el('span', { class: 'warn-text' }, 'Not set up yet. Open Settings.'),
      ),
      el('div', { class: 'counts' },
        needs ? el('span', { class: 'count-chip needs' }, `${needs} need you`) : null,
        working ? el('span', { class: 'count-chip working' }, `${working} working`) : null,
        !needs && !working ? el('span', { class: 'count-chip idle' }, queued ? `${queued} queued` : 'Idle') : null,
      ),
    );
  });
  $('roster').replaceChildren(...rows);
}

function activityRow(item) {
  const meta = STATUS[item.status] || STATUS.working;
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
        el('span', { class: 'add-n' }, `+${item.additions}`), ' ', el('span', { class: 'del-n' }, `−${item.deletions}`)),
      el('span', null, timeAgo(item.updatedAt)),
    ),
  );
}

let activityExpanded = false;
function renderActivity() {
  const c = agentCache;
  $('agentErrors').hidden = !(c?.errors?.length);
  $('agentErrors').textContent = c?.errors?.join(' · ') || '';
  $('agentMeta').textContent = c?.fetchedAt ? `Updated ${timeAgo(c.fetchedAt)}` : '';

  const items = c?.items || [];
  if (!items.length) {
    $('activity').replaceChildren(settings.githubToken ? '' : el('p', { class: 'empty' },
      'Add a GitHub token in Settings to send tasks to GitHub agents and watch their PRs.'));
    return;
  }
  const shown = activityExpanded ? items : items.slice(0, 6);
  $('activity').replaceChildren(el('section', { class: 'group' },
    el('h3', { class: 'group-head' }, 'Other agent activity', el('span', { class: 'pill' }, items.length)),
    el('ul', { class: 'agent-list' }, shown.map(activityRow)),
    items.length > shown.length && el('button', {
      class: 'text-btn more', type: 'button', onclick: () => { activityExpanded = true; renderActivity(); },
    }, `Show ${items.length - shown.length} more`),
  ));
}

async function refresh() {
  const btn = $('refreshBtn');
  btn.classList.add('spinning');
  try { await send('refresh'); } finally { btn.classList.remove('spinning'); }
}
$('refreshBtn').addEventListener('click', refresh);

// ---------- Settings ----------
const dlg = $('settings');
const form = $('settingsForm');
let draftAgents = [];

function selectTab(name) {
  form.querySelectorAll('[role=tab]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === name)));
  form.querySelectorAll('.tab-panel').forEach((p) => { p.hidden = p.dataset.panel !== name; });
}
form.querySelectorAll('[role=tab]').forEach((b) => b.addEventListener('click', () => selectTab(b.dataset.tab)));

function renderDefaultAgentSelect(selected) {
  const sel = $('defaultAgentSelect');
  const value = selected ?? sel.value;
  sel.replaceChildren(...draftAgents.map((a) => el('option', { value: a.id, selected: a.id === value }, a.name || '(unnamed)')));
}

function agentEditor(agent, open) {
  const node = $('agentEditorTpl').content.firstElementChild.cloneNode(true);
  node.open = open;
  node.dataset.method = agent.method;
  node.dataset.id = agent.id;
  const sync = () => {
    node.querySelector('.ae-name').textContent = agent.name || '(unnamed)';
    node.querySelector('.ae-method').textContent = METHOD_LABEL[agent.method];
    node.dataset.method = agent.method;
  };
  node.querySelectorAll('[data-k]').forEach((field) => {
    const k = field.dataset.k;
    field.value = k === 'keywords' ? (agent.keywords || []).join(', ') : agent[k] ?? '';
    field.addEventListener('input', () => {
      agent[k] = k === 'keywords' ? field.value.split(',').map((s) => s.trim()).filter(Boolean) : field.value;
      sync();
      if (k === 'name') renderDefaultAgentSelect();
    });
  });
  node.querySelector('.ae-remove').addEventListener('click', () => {
    if (draftAgents.length <= 1) return;
    draftAgents = draftAgents.filter((a) => a !== agent);
    node.remove();
    renderDefaultAgentSelect();
  });
  sync();
  return node;
}

function openSettings(tab = 'agents') {
  const f = form.elements;
  draftAgents = structuredClone(settings.agents);
  $('agentEditors').replaceChildren(...draftAgents.map((a) => agentEditor(a, false)));
  renderDefaultAgentSelect(settings.defaultAgentId);
  f.anthropicKey.value = settings.anthropicKey || '';
  f.smartRouting.checked = !!settings.smartRouting;
  f.autoDispatch.checked = !!settings.autoDispatch;
  f.name.value = settings.name || '';
  f.githubToken.value = settings.githubToken || '';
  f.defaultRepo.value = settings.defaultRepo || '';
  f.agentPatterns.value = (settings.agentPatterns || []).join(', ');
  f.agentOnly.checked = !!settings.agentOnly;
  f.lookbackDays.value = settings.lookbackDays;
  f.pollMinutes.value = settings.pollMinutes;
  f.feedUrl.value = settings.feedUrl || '';
  f.notify.checked = !!settings.notify;
  f.links.value = (settings.links || []).map((l) => `${l.name} | ${l.url}`).join('\n');
  $('settingsError').hidden = true;
  selectTab(tab);
  dlg.showModal();
}

$('addAgent').addEventListener('click', () => {
  const agent = { id: `agent-${crypto.randomUUID().slice(0, 8)}`, name: 'New agent', description: '', keywords: [], method: 'webhook' };
  draftAgents.push(agent);
  const node = agentEditor(agent, true);
  $('agentEditors').append(node);
  renderDefaultAgentSelect();
  node.querySelector('[data-k=name]').select();
});

function parseLinks(text) {
  return text.split('\n').map((line) => {
    const [name, ...rest] = line.split('|');
    const url = rest.join('|').trim();
    if (!name?.trim() || !/^https?:\/\//i.test(url)) return null;
    return { name: name.trim(), url };
  }).filter(Boolean);
}

function originOf(url) {
  const u = new URL(url);
  return `${u.protocol}//${u.hostname}/*`;
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = form.elements;
  const showError = (msg, tab) => {
    $('settingsError').textContent = msg;
    $('settingsError').hidden = false;
    if (tab) selectTab(tab);
  };

  const agents = draftAgents.map((a) => ({ ...a, name: (a.name || '').trim() }));
  if (agents.some((a) => !a.name)) return showError('Every agent needs a name.', 'agents');
  const repoRe = /^[\w.-]+\/[\w.-]+$/;
  const defaultRepo = f.defaultRepo.value.trim();
  if (defaultRepo && !repoRe.test(defaultRepo)) return showError('Default repo should look like owner/repo.', 'github');
  const badRepo = agents.find((a) => a.method === 'github' && a.repo && !repoRe.test(a.repo.trim()));
  if (badRepo) return showError(`${badRepo.name}: repo should look like owner/repo.`, 'agents');

  // Host permissions for new or changed webhook/feed URLs: ask once, inside this click.
  const known = new Set([settings.feedUrl, ...settings.agents.map((a) => a.webhookUrl)].filter(Boolean));
  const origins = new Set();
  const feedUrl = f.feedUrl.value.trim();
  try {
    const urls = [feedUrl, ...agents.filter((a) => a.method === 'webhook').map((a) => a.webhookUrl)].filter(Boolean);
    for (const u of urls) {
      const o = originOf(u); // validates every URL
      if (!known.has(u)) origins.add(o);
    }
  } catch {
    return showError('One of the URLs is not valid.');
  }
  if (origins.size) {
    const granted = await chrome.permissions.request({ origins: [...origins] }).catch(() => false);
    if (!granted) return showError('Helm needs permission to reach your webhook and feed hosts.');
  }

  settings = await saveSettings({
    agents,
    defaultAgentId: f.defaultAgentId.value || agents[0].id,
    anthropicKey: f.anthropicKey.value.trim(),
    smartRouting: f.smartRouting.checked,
    autoDispatch: f.autoDispatch.checked,
    name: f.name.value.trim(),
    githubToken: f.githubToken.value.trim(),
    defaultRepo,
    agentPatterns: f.agentPatterns.value.split(',').map((s) => s.trim()).filter(Boolean),
    agentOnly: f.agentOnly.checked,
    lookbackDays: Math.min(60, Math.max(1, parseInt(f.lookbackDays.value, 10) || 7)),
    pollMinutes: Math.min(120, Math.max(1, parseInt(f.pollMinutes.value, 10) || 5)),
    feedUrl,
    notify: f.notify.checked,
    links: parseLinks(f.links.value),
  });
  dlg.close();
  renderAll();
  send('reschedule');
});

$('cancelSettings').addEventListener('click', () => dlg.close());
$('settingsBtn').addEventListener('click', () => openSettings());

// ---------- Live updates ----------
function renderAll() {
  renderHeader();
  renderLinks();
  renderTasks();
  renderActivity();
  updatePreview();
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  if (changes.tasks) { tasks = changes.tasks.newValue || []; renderTasks(); }
  if (changes.agentCache) { agentCache = changes.agentCache.newValue || null; renderActivity(); }
  if (changes.settings) { settings = { ...DEFAULT_SETTINGS, ...(changes.settings.newValue || {}) }; renderAll(); }
});

// ---------- Boot ----------
(async function init() {
  settings = await getSettings();
  const data = await store.get(['tasks', 'agentCache']);
  tasks = data.tasks || [];
  agentCache = data.agentCache || null;
  renderAll();
  setInterval(renderHeader, 10_000);
  setInterval(() => { renderActivity(); renderTasks(); }, 60_000);
  if (!agentCache?.fetchedAt || Date.now() - agentCache.fetchedAt > 60_000) refresh();
  input.focus();
})();
