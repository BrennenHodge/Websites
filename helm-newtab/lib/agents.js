// Shared logic for fetching and classifying agent work.
// Used by both the background service worker and the new tab page.

export const DEFAULT_SETTINGS = {
  name: '',
  githubToken: '',
  // Matched (case-insensitive) against PR author login and head branch name.
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

// status -> display + grouping. Groups: needs (needs you), progress, done.
export const STATUS = {
  failing:  { label: 'Checks failing',    group: 'needs',    tone: 'bad' },
  blocked:  { label: 'Needs input',       group: 'needs',    tone: 'warn' },
  review:   { label: 'Ready for review',  group: 'needs',    tone: 'good' },
  approved: { label: 'Approved',          group: 'needs',    tone: 'good' },
  running:  { label: 'Running',           group: 'progress', tone: 'info' },
  draft:    { label: 'Drafting',          group: 'progress', tone: 'muted' },
  changes:  { label: 'Changes requested', group: 'progress', tone: 'warn' },
  merged:   { label: 'Merged',            group: 'done',     tone: 'done' },
  done:     { label: 'Done',              group: 'done',     tone: 'done' },
  closed:   { label: 'Closed',            group: 'done',     tone: 'muted' },
};

const AGENT_NAMES = {
  claude: 'Claude', 'ccr-': 'Claude', copilot: 'Copilot', codex: 'Codex',
  cursor: 'Cursor', devin: 'Devin', jules: 'Jules',
};

export async function getSettings() {
  const { settings } = await chrome.storage.local.get('settings');
  return { ...DEFAULT_SETTINGS, ...(settings || {}) };
}

export async function saveSettings(patch) {
  const current = await getSettings();
  const next = { ...current, ...patch };
  await chrome.storage.local.set({ settings: next });
  return next;
}

// ---------- GitHub ----------

const PR_QUERY = `
query($q: String!) {
  viewer { login }
  search(query: $q, type: ISSUE, first: 50) {
    nodes {
      ... on PullRequest {
        id number title url state isDraft merged
        createdAt updatedAt mergedAt closedAt
        headRefName additions deletions
        reviewDecision
        author { login }
        repository { nameWithOwner }
        comments { totalCount }
        commits(last: 1) { nodes { commit { statusCheckRollup { state } } } }
      }
    }
  }
}`;

function isoDaysAgo(days) {
  const d = new Date(Date.now() - days * 86400000);
  return d.toISOString().slice(0, 10);
}

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

export async function fetchGitHub(settings) {
  const q = `is:pr involves:@me archived:false updated:>=${isoDaysAgo(settings.lookbackDays)} sort:updated-desc`;
  const res = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${settings.githubToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: PR_QUERY, variables: { q } }),
  });
  if (res.status === 401) throw new Error('GitHub rejected the token (401). Check it in Settings.');
  if (!res.ok) throw new Error(`GitHub API error ${res.status}`);
  const json = await res.json();
  if (json.errors?.length) throw new Error(`GitHub: ${json.errors[0].message}`);

  const login = json.data.viewer.login;
  const items = [];
  for (const pr of json.data.search.nodes) {
    if (!pr || !pr.id) continue;
    const agent = matchAgent(pr, settings.agentPatterns);
    if (settings.agentOnly && !agent) continue;
    const status = classifyPR(pr);
    items.push({
      id: `gh:${pr.id}`,
      source: 'github',
      title: pr.title,
      url: pr.url,
      repo: pr.repository.nameWithOwner,
      number: pr.number,
      branch: pr.headRefName,
      author: pr.author?.login || 'ghost',
      agent: agent || pr.author?.login || 'You',
      status,
      additions: pr.additions,
      deletions: pr.deletions,
      comments: pr.comments.totalCount,
      updatedAt: pr.mergedAt || pr.closedAt || pr.updatedAt,
    });
  }
  return { login, items };
}

// ---------- Custom JSON feed ----------
// Accepts either an array or { items: [...] } of:
// { id, title, url?, agent?, status, repo?, detail?, updatedAt? }
// status: running | blocked | review | failing | done | ... (any STATUS key)
const FEED_ALIASES = {
  working: 'running', in_progress: 'running', active: 'running',
  needs_input: 'blocked', waiting: 'blocked', needs_review: 'review',
  failed: 'failing', error: 'failing', complete: 'done', completed: 'done', success: 'done',
};

export async function fetchFeed(url) {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Feed error ${res.status}`);
  const json = await res.json();
  const list = Array.isArray(json) ? json : json.items || [];
  return list.map((it, i) => {
    const raw = String(it.status || 'running').toLowerCase();
    const status = STATUS[raw] ? raw : FEED_ALIASES[raw] || 'running';
    return {
      id: `feed:${it.id ?? i}`,
      source: 'feed',
      title: String(it.title || 'Untitled task'),
      url: it.url || '',
      repo: it.repo || '',
      agent: it.agent || 'Agent',
      detail: it.detail || '',
      status,
      updatedAt: it.updatedAt || new Date().toISOString(),
    };
  });
}

// ---------- Refresh orchestration ----------

export async function refreshAgents() {
  const settings = await getSettings();
  const errors = [];
  let items = [];
  let login = null;

  if (settings.githubToken) {
    try {
      const gh = await fetchGitHub(settings);
      login = gh.login;
      items = items.concat(gh.items);
    } catch (e) {
      errors.push(e.message || String(e));
    }
  }
  if (settings.feedUrl) {
    try {
      items = items.concat(await fetchFeed(settings.feedUrl));
    } catch (e) {
      errors.push(`Feed: ${e.message || e}`);
    }
  }

  const { agentCache: prev } = await chrome.storage.local.get('agentCache');
  // If every source failed, keep the last good items so the page isn't blank.
  const keepOld = errors.length && !items.length && prev?.items?.length;
  items.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

  const cache = {
    items: keepOld ? prev.items : items,
    login: login || prev?.login || null,
    fetchedAt: keepOld ? prev.fetchedAt : Date.now(),
    errors,
    configured: Boolean(settings.githubToken || settings.feedUrl),
  };
  await chrome.storage.local.set({ agentCache: cache });
  return { cache, prev };
}
