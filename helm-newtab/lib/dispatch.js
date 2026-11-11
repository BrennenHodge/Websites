// Sending tasks to agents, and tracking what happened to them afterwards.
import { githubGraphQL, PR_FIELDS, classifyPR } from './agents.js';

const splitList = (s) => String(s || '').split(',').map((x) => x.trim()).filter(Boolean);

export function repoFor(agent, settings) {
  return (agent.repo || settings.defaultRepo || '').trim();
}

export function linkFor(agent, text) {
  const url = agent.url || '';
  return url.includes('{task}') ? url.replaceAll('{task}', encodeURIComponent(text)) : url;
}

// Returns { status, dispatch } on success; throws on failure.
export async function dispatchTask(task, agent, settings) {
  if (agent.method === 'github') return dispatchGitHub(task, agent, settings);
  if (agent.method === 'webhook') return dispatchWebhook(task, agent);
  throw new Error(`${agent.name} can't be sent automatically`);
}

async function dispatchGitHub(task, agent, settings) {
  if (!settings.githubToken) throw new Error('Add a GitHub token in Settings first');
  const repo = repoFor(agent, settings);
  if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) throw new Error(`Set a repo (owner/name) for ${agent.name} in Settings`);

  const title = task.text.length > 90 ? `${task.text.slice(0, 87)}…` : task.text;
  const mention = (agent.mention || '').trim();
  const body = [mention ? `${mention} ${task.text}` : task.text, '', '---', '_Sent from Helm_'].join('\n');
  const payload = { title, body };
  const labels = splitList(agent.labels);
  const assignees = splitList(agent.assignees);
  if (labels.length) payload.labels = labels;
  if (assignees.length) payload.assignees = assignees;

  const res = await fetch(`https://api.github.com/repos/${repo}/issues`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${settings.githubToken}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    let msg = `GitHub ${res.status}`;
    try { msg = `GitHub: ${(await res.json()).message}`; } catch {}
    if (res.status === 404) msg = `GitHub: repo ${repo} not found, or the token can't write issues there`;
    throw new Error(msg);
  }
  const issue = await res.json();
  return {
    status: 'sent',
    dispatch: { method: 'github', at: Date.now(), repo, number: issue.number, url: issue.html_url },
  };
}

async function dispatchWebhook(task, agent) {
  if (!agent.webhookUrl) throw new Error(`Set a webhook URL for ${agent.name} in Settings`);
  const headers = { 'Content-Type': 'application/json' };
  if (agent.webhookAuth) headers.Authorization = agent.webhookAuth;
  const res = await fetch(agent.webhookUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      taskId: task.id,
      task: task.text,
      agent: agent.name,
      createdAt: new Date(task.createdAt).toISOString(),
      source: 'helm',
    }),
  });
  if (!res.ok) throw new Error(`Webhook returned ${res.status}`);
  let url = '';
  try { url = (await res.clone().json())?.url || ''; } catch {}
  return { status: 'sent', dispatch: { method: 'webhook', at: Date.now(), url } };
}

// ---------- Tracking GitHub-dispatched tasks ----------
// One GraphQL request for every open task: issue state, latest comment, linked PRs.

const ISSUE_FIELDS = `
  state stateReason url
  comments(last: 1) { totalCount nodes { author { login } bodyText } }
  timelineItems(itemTypes: [CROSS_REFERENCED_EVENT, CONNECTED_EVENT], last: 10) {
    nodes {
      ... on CrossReferencedEvent { source { ... on PullRequest { ${PR_FIELDS} } } }
      ... on ConnectedEvent { subject { ... on PullRequest { ${PR_FIELDS} } } }
    }
  }`;

export async function trackGitHubTasks(tasks, settings) {
  const open = tasks.filter((t) => t.dispatch?.method === 'github' && t.dispatch.number && !t.done);
  if (!open.length || !settings.githubToken) return {};
  const vars = {};
  const defs = [];
  const parts = open.slice(0, 40).map((t, i) => {
    const [owner, name] = t.dispatch.repo.split('/');
    vars[`o${i}`] = owner; vars[`r${i}`] = name; vars[`n${i}`] = t.dispatch.number;
    defs.push(`$o${i}: String!, $r${i}: String!, $n${i}: Int!`);
    return `t${i}: repository(owner: $o${i}, name: $r${i}) { issue(number: $n${i}) { ${ISSUE_FIELDS} } }`;
  });
  const data = await githubGraphQL(settings.githubToken,
    `query(${defs.join(', ')}) { viewer { login } ${parts.join('\n')} }`, vars);
  const me = data.viewer.login;

  const updates = {};
  open.slice(0, 40).forEach((t, i) => {
    const issue = data[`t${i}`]?.issue;
    if (!issue) return;
    const prs = issue.timelineItems.nodes
      .map((n) => n.source || n.subject)
      .filter((p) => p && p.number);
    // Prefer an open PR, then a merged one; latest first.
    prs.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    const pr = prs.find((p) => p.state === 'OPEN') || prs.find((p) => p.merged) || null;
    const last = issue.comments.nodes[0];
    const agentComment = last && last.author?.login !== me ? last.bodyText.replace(/\s+/g, ' ').trim() : '';

    let status;
    if (pr) status = classifyPR(pr);
    else if (issue.state === 'CLOSED') status = issue.stateReason === 'COMPLETED' ? 'done' : 'closed';
    else if (agentComment) status = 'working';
    else status = 'sent';

    updates[t.id] = {
      status,
      detail: agentComment ? agentComment.slice(0, 140) : '',
      pr: pr ? { url: pr.url, number: pr.number, repo: pr.repository.nameWithOwner, additions: pr.additions, deletions: pr.deletions } : null,
    };
  });
  return updates;
}
