import { refreshAgents, getSettings, STATUS } from './lib/agents.js';

const ALARM = 'helm-poll';
let inFlight = null;

async function schedule() {
  const s = await getSettings();
  await chrome.alarms.clear(ALARM);
  chrome.alarms.create(ALARM, { periodInMinutes: Math.max(1, Number(s.pollMinutes) || 5) });
}

function run() {
  if (!inFlight) {
    inFlight = (async () => {
      const { cache, prev } = await refreshAgents();
      await updateBadge(cache);
      await notifyChanges(prev, cache);
      return cache;
    })().finally(() => { inFlight = null; });
  }
  return inFlight;
}

async function updateBadge(cache) {
  const needs = (cache.items || []).filter((i) => STATUS[i.status]?.group === 'needs').length;
  await chrome.action.setBadgeText({ text: needs ? String(needs) : '' });
  await chrome.action.setBadgeBackgroundColor({ color: '#E5484D' });
}

async function notifyChanges(prev, cache) {
  const s = await getSettings();
  if (!s.notify || !prev?.items) return; // first run: don't spam
  const before = new Map(prev.items.map((i) => [i.id, i.status]));
  for (const item of cache.items) {
    const was = before.get(item.id);
    if (was === item.status) continue;
    const group = STATUS[item.status]?.group;
    // Only ping when something lands on your plate or finishes.
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
  chrome.notifications.clear(id);
});

chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({ url: 'chrome://newtab' });
});

chrome.runtime.onInstalled.addListener(() => { schedule(); run(); });
chrome.runtime.onStartup.addListener(() => { schedule(); run(); });
chrome.alarms.onAlarm.addListener((a) => { if (a.name === ALARM) run(); });

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === 'refresh') {
    run().then((cache) => sendResponse({ ok: true, cache }))
      .catch((e) => sendResponse({ ok: false, error: String(e) }));
    return true;
  }
  if (msg?.type === 'reschedule') {
    schedule().then(() => run()).then(() => sendResponse({ ok: true }));
    return true;
  }
});
