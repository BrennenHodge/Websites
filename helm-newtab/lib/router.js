// Decide which agent a task belongs to.
// Order: explicit @mention -> Claude (if an API key is set) -> keyword rules -> default agent.

const slug = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Aliases an agent answers to: its id, full name, and the first word of its name.
function aliases(agent) {
  const first = String(agent.name || '').split(/\s+/)[0];
  return new Set([slug(agent.id), slug(agent.name), slug(first)].filter(Boolean));
}

export function findMention(text, agents) {
  const re = /(^|\s)@([\w.-]+)/g;
  let m;
  while ((m = re.exec(text))) {
    const word = slug(m[2]);
    const agent = agents.find((a) => aliases(a).has(word));
    if (agent) {
      const clean = (text.slice(0, m.index) + m[1] + text.slice(m.index + m[0].length)).replace(/\s{2,}/g, ' ').trim();
      return { agent, clean: clean || text };
    }
  }
  return null;
}

export function keywordRoute(text, agents) {
  const lower = text.toLowerCase();
  let best = null;
  let bestScore = 0;
  let hits = [];
  for (const agent of agents) {
    const matched = (agent.keywords || []).filter((k) => {
      const kw = String(k).trim().toLowerCase();
      return kw && new RegExp(`(^|[^a-z0-9])${escapeRe(kw)}($|[^a-z0-9])`).test(lower);
    });
    if (matched.length > bestScore) {
      best = agent;
      bestScore = matched.length;
      hits = matched;
    }
  }
  return best ? { agent: best, hits } : null;
}

// Instant, offline routing used for the live preview and as a fallback.
export function quickRoute(text, settings) {
  const agents = settings.agents;
  const mention = findMention(text, agents);
  if (mention) return { agentId: mention.agent.id, text: mention.clean, by: 'mention', reason: `You tagged @${mention.agent.name}` };
  const kw = keywordRoute(text, agents);
  if (kw) return { agentId: kw.agent.id, text, by: 'keywords', reason: `Matched “${kw.hits.slice(0, 3).join('”, “')}”` };
  const fallback = agents.find((a) => a.id === settings.defaultAgentId) || agents[0];
  return { agentId: fallback.id, text, by: 'default', reason: 'Default agent' };
}

const ROUTER_SYSTEM = `You route a person's task to the agent best suited to complete it.
You are given the available agents (id, name, what they are good at) and one task.
Choose exactly one agent id. Prefer an agent whose description clearly covers the task.
If the task needs a human (phone calls, payments, physical errands, personal decisions) or no agent fits, choose the human agent if one exists.
Give a short reason (under 12 words) the person will see next to the task.`;

// Calls the Claude API directly from the extension (no SDK: this extension has no build step).
export async function claudeRoute(text, settings) {
  const agents = settings.agents.map((a) => ({ id: a.id, name: a.name, good_at: a.description || '' }));
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': settings.anthropicKey,
      'anthropic-version': '2026-10-21',
      'anthropic-beta': 'server-side-fallback-2026-07-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-opus-5-5',
      max_tokens: 4000,
      fallbacks: 'default',
      system: ROUTER_SYSTEM,
      output_config: {
        effort: 'low',
        format: {
          type: 'json_schema',
          schema: {
            type: 'object',
            properties: {
              agent_id: { type: 'string', enum: agents.map((a) => a.id) },
              reason: { type: 'string' },
            },
            required: ['agent_id', 'reason'],
            additionalProperties: false,
          },
        },
      },
      messages: [{
        role: 'user',
        content: `Agents:\n${JSON.stringify(agents, null, 2)}\n\nTask:\n${text}`,
      }],
    }),
  });
  if (!res.ok) {
    let msg = `Claude API error ${res.status}`;
    try { msg = (await res.json()).error?.message || msg; } catch {}
    throw new Error(msg);
  }
  const data = await res.json();
  if (data.stop_reason === 'refusal') throw new Error('Claude declined to route this task');
  const block = (data.content || []).find((b) => b.type === 'text');
  if (!block) throw new Error('Claude returned no routing decision');
  const out = JSON.parse(block.text);
  if (!settings.agents.some((a) => a.id === out.agent_id)) throw new Error('Claude picked an unknown agent');
  return { agentId: out.agent_id, by: 'claude', reason: out.reason };
}
