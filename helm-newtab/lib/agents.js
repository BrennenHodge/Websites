// Settings, status vocabulary, and the "activity" feed (agent PRs not tied to a task).

export const DEFAULT_AGENTS = [
  {
    id: 'claude-code',
    name: 'Claude Code',
    description: 'Software engineering in a GitHub repo: build features, fix bugs, refactor, write tests, update websites and apps.',
    keywords: ['fix', 'bug', 'build', 'implement', 'refactor', 'test', 'tests', 'feature', 'website', 'page', 'deploy', 'code', 'pr', 'repo', 'css', 'api'],
    method: 'github', repo: '', mention: '@claude', labels: '', assignees: '',
  },
  {
    id: 'grok',
    name: 'Grok',
    description: 'Research and real-time questions: look things up, summarize news and trends (especially on X), compare options, brainstorm.',
    keywords: ['research', 'look up', 'find out', 'summarize', 'news', 'trend', 'trends', 'compare', 'brainstorm', 'competitor', 'competitors'],
    method: 'link', url: 'https://grok.com/',
  },
  {
    id: 'me',
    name: 'Me',
    description: 'Things only a human should do: calls, meetings, payments, purchases, signing documents, personal errands, decisions.',
    keywords: ['call', 'meet', 'meeting', 'pay', 'buy', 'sign', 'email', 'schedule', 'dentist', 'invoice'],
    method: 'none',
  },
];

export const DEFAULT_SETTINGS = {
  name: '',
  // Tasks & routing
  agents: DEFAULT_AGENTS,
  defaultAgentId: 'me',
  anthropicKey: '',
  smartRouting: true,
  autoDispatch: false,
  // GitHub
  githubToken: '',
  defaultRepo: '',
  // Activity feed (agent PRs not created from a task)
  agentPatterns: ['claude', 'ccr-', 'copilot', 'codex', 'cursor', 'devin', 'jules', '[bot]'],
  agentOnly: true,
  lookbackDays: 7,
  pollMinutes: 5,
  notify: true,
  feedUrl: '',
  links: [
    { name: 'Claude Code', url: 'https://claude.ai/code' },
    { name: 'GitHub PRs', url: 'https://github.com/pulls' },
  ],
};

// status -> display + grouping.
// Groups: needs (needs you), queued, mine, progress, done.
export const STATUS = {
  error:    { label: 'Send failed',       group: 'needs',    tone: 'bad' },
  failing:  { label: 'Checks failing',    group: 'needs',    tone: 'bad' },
  blocked:  { label: 'Needs input',       group: 'needs',    tone: 'warn' },
  review:   { label: 'Ready for review',  group: 'needs',    tone: 'good' },
  approved: { label: 'Approved',          group: 'needs',    tone: 'good' },
  queued:   { label: 'Queued',            group: 'queued',   tone: 'muted' },
  todo:     { label: '',                  group: 'mine',     tone: 'muted' },
  sending:  { label: 'Sending…',          group: 'progress', tone: 'info' },
  sent:     { label: 'Sent',              group: 'progress', tone: 'info' },
  working:  { label: 'Working',           group: 'progress', tone: 'info' },
  running:  { label: 'Running',           group: 'progress', tone: 'info' },
  draft:    { label: 'Drafting',          group: 'progress', tone: 'muted' },
  changes:  { label: 'Changes requested', group: 'progress', tone: 'warn' },
  merged:   { label: 'Merged',            group: 'done',     tone: 'done' },
  done:     { label: 'Done',              group: 'done',     tone: 'done' },
  closed:   { label: 'Closed',            group: 'done',     tone: 'muted' },
};

export const METHOD_LABEL = {
  github: 'GitHub issue',
  webhook: 'Webhook',
  link: 'Open link',
  none: 'No dispatch (your own todo)',
};

export async function getSettings() {
  const { settings } = await chrome.storage.local.get('settings');
  const s = { ...DEFAULT_SETTINGS, ...(settings || {}) };
  if (!Array.isArray(s.agents) || !s.agents.length) s.agents = DEFAULT_AGENTS;
  return s;
}

export async function saveSettings(patch) {
  const next = { ...(await getSettings()), ...patch };
  await chrome.storage.local.set({ settings: next });
  return next;
}

export function agentById(settings, id) {
  return settings.agents.find((a) => a.id === id)
    || settings.agents.find((a) => a.id === settings.defaultAgentId)
    || settings.agents[0];
}

// ---------- GitHub helpers ----------

export async function githubGraphQL(token, query, variables = {}) {
  const res = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });
  if (res.status === 401) throw new Error('GitHub rejected the token (401). Check it in Settings.');
  if (!res.ok) throw new Error(`GitHub API error ${res.status}`);
  const json = await res.json();
  if (json.errors?.length && !json.data) throw new Error(`GitHub: ${json.errors[0].message}`);
  return json.data;
}

export const PR_FIELDS = `
  id number title url state isDraft merged
  createdAt updatedAt mergedAt closedAt
  headRefName additions deletions reviewDecision
  author { login }
  repository { nameWithOwner }
  commits(last: 1) { nodes { commit { statusCheckRollup { state } } } }`;

export function classifyPR(pr) {
  if (pr.merged) return 'merged';
  if (pr.state === 'CLOSED') return 'closed';
  const checks = pr.commits?.nodes?.[0]?.commit?.statusCheckRollup?.state || null;
  const pending = checks === 'PENDING' || checks === 'EXPECTED';
  if (pr.isDraft) return pending ? 'running' : 'draft';
  if (pr.reviewDecision === 'CHANGES_REQUESTED') return 'changes';
  if (checks === 'FAILURE' || checks === 'ERROR') return 'failing';
  if (pending) return 'running';
  if (pr.reviewDecision === 'APPROVED') return 'approved';
  return 'review';
}

const AGENT_NAMES = {
  claude: 'Claude', 'ccr-': 'Claude', copilot: 'Copilot', codex: 'Codex',
  cursor: 'Cursor', devin: 'Devin', jules: 'Jules',
};

export function matchAgent(pr, patterns) {
  const author = (pr.author?.login || '').toLowerCase();
  const branch = (pr.headRefName || '').toLowerCase();
  for (const raw of patterns) {
    const p = raw.trim().toLowerCase();
    if (!p) continue;
    if (author.includes(p) || branch.includes(p)) {
      if (AGENT_NAMES[p]) return AGENT_NAMES[p];
      if (p === '[bot]') return author.replace('[bot]', '') || 'Bot';
      return raw.trim().replace(/[^\w ]+/g, '') || 'Agent';
    }
  }
  return null;
}

function isoDaysAgo(days) {
  return new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
}

export async function fetchActivity(settings) {
  const q = `is:pr involves:@me archived:false updated:>=${isoDaysAgo(settings.lookbackDays)} sort:updated-desc`;
  const data = await githubGraphQL(settings.githubToken, `
    query($q: String!) {
      viewer { login }
      search(query: $q, type: ISSUE, first: 50) { nodes { ... on PullRequest { ${PR_FIELDS} } } }
    }`, { q });
  const items = [];
  for (const pr of data.search.nodes) {
    if (!pr?.id) continue;
    const agent = matchAgent(pr, settings.agentPatterns);
    if (settings.agentOnly && !agent) continue;
    items.push({
      id: `gh:${pr.id}`,
      title: pr.title,
      url: pr.url,
      repo: pr.repository.nameWithOwner,
      number: pr.number,
      agent: agent || pr.author?.login || 'You',
      status: classifyPR(pr),
      additions: pr.additions,
      deletions: pr.deletions,
      updatedAt: pr.mergedAt || pr.closedAt || pr.updatedAt,
    });
  }
  return { login: data.viewer.login, items };
}

// ---------- Custom JSON feed ----------
// Array (or { items }) of { id, title, status, agent?, url?, repo?, detail?, updatedAt?, taskId? }.
// Items with a taskId update the matching Helm task instead of showing as activity.
const FEED_ALIASES = {
  working: 'working', in_progress: 'working', active: 'working', started: 'working',
  needs_input: 'blocked', waiting: 'blocked', needs_review: 'review',
  failed: 'failing', error: 'failing', complete: 'done', completed: 'done', success: 'done',
};

export function normalizeStatus(raw) {
  const s = String(raw || 'working').toLowerCase();
  if (FEED_ALIASES[s]) return FEED_ALIASES[s];
  return STATUS[s] && !['queued', 'todo', 'sending'].includes(s) ? s : 'working';
}

export async function fetchFeed(url) {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Feed error ${res.status}`);
  const json = await res.json();
  const list = Array.isArray(json) ? json : json.items || [];
  return list.map((it, i) => ({
    id: `feed:${it.id ?? i}`,
    taskId: it.taskId || null,
    title: String(it.title || 'Untitled task'),
    url: it.url || '',
    repo: it.repo || '',
    agent: it.agent || 'Agent',
    detail: it.detail || '',
    status: normalizeStatus(it.status),
    updatedAt: it.updatedAt || new Date().toISOString(),
  }));
}
