// Interactive router demo: the same @mention + keyword routing Helm uses when Claude routing is off.
(function () {
  const AGENTS = [
    {
      id: 'claude', name: 'Claude Code', letter: 'C', how: 'GitHub issue in acme/storefront, starting with @claude',
      keywords: ['fix', 'bug', 'build', 'implement', 'refactor', 'test', 'tests', 'feature', 'website', 'page', 'code', 'pr', 'repo', 'css', 'api', 'checkout', 'dark mode', 'component', 'sitemap', 'mobile', 'safari', 'crash', 'endpoint', 'migrate'],
      flow: [['Queued', ''], ['Issue #412 opened', 'GitHub'], ['Working: reproducing the bug', 'Claude Code'], ['PR #418: checks passing', 'CI'], ['Ready for review', 'Needs you']],
      tones: ['var(--text-3)', 'var(--info)', 'var(--info)', 'var(--info)', 'var(--good)'],
    },
    {
      id: 'grok', name: 'Grok', letter: 'G', how: 'Opens grok.com with the task copied',
      keywords: ['research', 'look up', 'find out', 'summarize', 'news', 'trend', 'trends', 'compare', 'brainstorm', 'competitor', 'competitors', 'pricing', 'what are people saying', 'this week'],
      flow: [['Queued', ''], ['Opened in Grok, task copied', 'One click'], ['You read the answer', ''], ['Done', 'Ticked off']],
      tones: ['var(--text-3)', 'var(--info)', 'var(--info)', 'var(--done)'],
    },
    {
      id: 'ops', name: 'Ops bot', letter: 'O', how: 'Webhook to your own bot',
      keywords: ['rotate', 'keys', 'secret', 'secrets', 'server', 'servers', 'staging', 'backup', 'backups', 'uptime', 'logs', 'dns', 'certificate', 'ssl', 'restart'],
      flow: [['Queued', ''], ['POST /tasks', 'Webhook'], ['Working: rotating staging keys', 'Ops bot'], ['Needs input: approve prod?', 'Needs you']],
      tones: ['var(--text-3)', 'var(--info)', 'var(--info)', 'var(--warn)'],
    },
    {
      id: 'me', name: 'You', letter: 'M', how: 'Stays on your own todo list',
      keywords: ['call', 'meet', 'meeting', 'pay', 'buy', 'sign', 'email', 'schedule', 'invoice', 'accountant', 'dentist', 'lunch', 'renew'],
      flow: [['In Your todos', ''], ['Done', 'You ticked it off']],
      tones: ['var(--text-3)', 'var(--done)'],
    },
  ];
  const DEFAULT = AGENTS[3];
  const ALIASES = { claude: 'claude', claudecode: 'claude', grok: 'grok', ops: 'ops', opsbot: 'ops', me: 'me', you: 'me' };

  const input = document.getElementById('demoInput');
  const chip = document.getElementById('demoChip');
  const result = document.getElementById('demoResult');
  const examples = document.querySelectorAll('.examples button');
  if (!input) return;

  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  function route(text) {
    const m = text.match(/(^|\s)@([\w-]+)/);
    if (m) {
      const id = ALIASES[m[2].toLowerCase().replace(/[^a-z]/g, '')];
      const agent = AGENTS.find((a) => a.id === id);
      if (agent) return { agent, why: `you tagged <strong>@${m[2]}</strong>` };
    }
    const lower = text.toLowerCase();
    let best = null; let hits = [];
    for (const a of AGENTS) {
      const h = a.keywords.filter((k) => new RegExp(`(^|[^a-z0-9])${esc(k)}($|[^a-z0-9])`).test(lower));
      if (h.length > hits.length) { best = a; hits = h; }
    }
    if (best) return { agent: best, why: `matched ${hits.slice(0, 3).map((h) => `<strong>“${h}”</strong>`).join(', ')}` };
    return { agent: DEFAULT, why: 'nothing matched, so it goes to your default agent' };
  }

  let timer = null;
  let lastAgent = null;

  function render(text, animate) {
    clearInterval(timer);
    if (!text.trim()) {
      chip.hidden = true;
      result.innerHTML = '<p class="demo-empty">Pick an example or type your own.</p>';
      lastAgent = null;
      return;
    }
    const { agent, why } = route(text);
    chip.hidden = false;
    chip.textContent = `→ ${agent.name}`;
    if (!animate && agent === lastAgent) {
      result.querySelector('.route-why').innerHTML = `Routed because ${why}.`;
      return;
    }
    lastAgent = agent;
    result.innerHTML = `
      <div class="route-card">
        <div class="route-agent">
          <span class="avatar${agent.id === 'me' ? ' me' : ''}">${agent.letter}</span>
          <div><b>${agent.name}</b><span>${agent.how}</span></div>
        </div>
        <p class="route-why">Routed because ${why}.</p>
        <ol class="timeline">
          ${agent.flow.map(([label, by], i) => `<li style="--tone:${agent.tones[i]}">${label}${by ? `<small>${by}</small>` : ''}</li>`).join('')}
        </ol>
      </div>`;
    const steps = [...result.querySelectorAll('.timeline li')];
    let i = 0;
    const tick = () => {
      steps.forEach((s, j) => { s.classList.toggle('on', j <= i); s.classList.toggle('now', j === i); });
      if (i >= steps.length - 1) { clearInterval(timer); steps[i].classList.remove('now'); }
      i += 1;
    };
    tick();
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) { while (i < steps.length) tick(); } else timer = setInterval(tick, 900);
  }

  let debounce;
  input.addEventListener('input', () => {
    examples.forEach((b) => b.setAttribute('aria-pressed', 'false'));
    clearTimeout(debounce);
    debounce = setTimeout(() => render(input.value, false), 250);
  });

  examples.forEach((btn) => {
    btn.setAttribute('aria-pressed', 'false');
    btn.addEventListener('click', () => {
      examples.forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
      input.value = btn.dataset.task;
      render(input.value, true);
    });
  });

  // Start the demo with the first example when it scrolls into view.
  const io = 'IntersectionObserver' in window && new IntersectionObserver((entries) => {
    if (entries.some((e) => e.isIntersecting)) {
      io.disconnect();
      if (!input.value) examples[0]?.click();
    }
  }, { threshold: 0.4 });
  if (io) io.observe(result);
})();
