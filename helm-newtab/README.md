# Helm: a new tab that hands your tasks to agents

Helm replaces Chrome's new tab with a task list for your AI agents. Type a task, and Helm:

1. **Routes it** to the right agent: Claude Code for code, Grok for research, a custom bot for ops, or you for things only a human can do.
2. **Sends it** there: opens a GitHub issue, POSTs to a webhook, or opens the agent's site with the task copied.
3. **Tracks it** until it's done: *Ready to send → Agents working → Needs you → Completed*, with desktop notifications and a badge count.

![Helm new tab](screenshot.png)

## Install (unpacked)

1. Open `chrome://extensions` and turn on **Developer mode**.
2. Click **Load unpacked** and select this `helm-newtab` folder.
3. Open a new tab. If Chrome asks about the new tab change, choose **Keep it**.
4. Open ⚙ **Settings**:
   - **GitHub:** paste a token ([classic, `repo` scope](https://github.com/settings/tokens/new?scopes=repo&description=Helm%20new%20tab)) and set a default repo (`owner/repo`).
   - **Agents:** optionally paste an Anthropic API key so Claude does the routing, then review your agents.

No build step. It's plain HTML, CSS and JS (Manifest V3).

## Adding tasks

| You type | What happens |
|---|---|
| `Fix the broken nav on the homepage` ⏎ | Routed (Claude or keywords), lands in **Ready to send** with a **Send** button |
| … ⌘/Ctrl ⏎ | Routed **and sent** immediately |
| `@grok what are people saying about our launch` ⏎ | Goes straight to Grok; the `@grok` is stripped from the text |
| `Call the printer about banners` ⏎ | Routed to **Me** and listed as a plain todo |

Change a queued task's agent from the dropdown on its row. Double-click a task to edit it, drag to reorder, and tick the circle when it's done. To skip the **Send** click entirely, turn on **Send tasks to agents as soon as they're added**.

## How routing works

In order:

1. **`@mention`:** `@claude`, `@grok`, `@me`, or any agent's id, full name or first word.
2. **Claude** (if an API key is set and *Let Claude route tasks* is on): Claude Opus 5.5 reads each agent's **Good at** description and picks one, returning a short reason that's shown on the task. It's one small request per task at low effort, called directly from the extension.
3. **Keywords:** whichever agent's keywords match the most words in the task.
4. **Default agent** (Me, unless you change it).

The better your **Good at** descriptions, the better Claude routes.

## Agents and how tasks reach them

Each agent has a **How to send tasks** method:

### GitHub issue (Claude Code, Copilot, Codex…)

Helm opens an issue in the agent's repo (or your default repo). The body starts with the agent's **mention**, then the task:

```
@claude Fix the broken nav on the homepage
```

`@claude` triggers the [Claude Code GitHub Action](https://github.com/anthropics/claude-code-action). Install it in the repo first by running `/install-github-app` in Claude Code. You can also set **labels** and **assignees** for agents triggered that way.

Helm then follows the issue:

- A comment from someone else → **Working**, with the latest comment shown.
- A linked PR → that PR's status: *Running* while checks run, *Ready for review* or *Checks failing* when they finish, then *Merged*.
- Issue closed as completed → **Done**.

### Webhook (your own bots, e.g. a Grok bot)

Helm POSTs:

```json
{ "taskId": "…", "task": "Rotate the staging API keys", "agent": "Ops bot", "createdAt": "…", "source": "helm" }
```

You can set an optional `Authorization` header value. To report progress, publish a JSON **status feed** (Settings → GitHub → Status feed URL). Items carrying the `taskId` update that task:

```json
[{ "taskId": "…", "status": "needs_input", "detail": "Need approval to rotate prod keys", "url": "https://…" }]
```

`status` can be `working`, `needs_input`, `review`, `failing`, or `done`. Feed items without a `taskId` show under *Other agent activity*.

`examples/webhook-bot.mjs` is a working example of both ends:

```bash
node examples/webhook-bot.mjs
# Agent webhook URL: http://127.0.0.1:4318/tasks
# Status feed URL:   http://127.0.0.1:4318/feed
```

### Open a link (Grok web, ChatGPT, anything with a URL)

Clicking **Open** opens the URL in a new tab and copies the task to your clipboard. If the URL contains `{task}`, Helm puts the task text there, e.g. `https://example.com/new?prompt={task}`. Helm can't see what happens after that, so tick the task off yourself when it's done.

### Don't send (Me)

A plain todo for you.

## Other agent activity

PRs you're involved in that Helm didn't send also show up when their author or branch matches an agent pattern (`claude`, `ccr-`, `copilot`, `codex`, `cursor`, `devin`, `jules`, `[bot]`). That way, agent work you started from Claude Code, Copilot and others stays visible too.

## Privacy

Tokens and keys live in `chrome.storage.local` on this machine. They're sent only to:

- `api.github.com` (GitHub token)
- `api.anthropic.com` (routing key)
- your own webhook and feed hosts, which Chrome asks you to approve when you save them

## Files

```
manifest.json      MV3 manifest
background.js      Owns the task list: routing, dispatch, polling, badge, notifications
lib/agents.js      Settings, default agents, status vocabulary, GitHub activity + feed
lib/router.js      @mention / Claude / keyword routing
lib/dispatch.js    GitHub issue + webhook dispatch, and issue → PR tracking
newtab.*           The new tab UI and settings
examples/          Webhook bot + sample feed
```
