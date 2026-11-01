// POST /api/intake: saves the idea questionnaire a client fills in after booking.
// Stored in the same KV as leads (binding LEADS) under intake:<email>:<time>, with a short
// summary in the key metadata so `wrangler kv key list --prefix intake:` shows who sent what.
// Optional Pages secret INTAKE_WEBHOOK_URL forwards each answer as JSON (email, Slack, CRM).

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

const clip = (v, n) => (typeof v === "string" ? v.trim().slice(0, n) : "");

export async function onRequestPost({ request, env, waitUntil }) {
  let data;
  try {
    data = await request.json();
  } catch {
    return json({ ok: false, error: "Something went wrong. Please try again." }, 400);
  }

  // Honeypot: real people never fill the hidden "company" field.
  if (data.company) return json({ ok: true });

  const email = clip(data.email, 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json({ ok: false, error: "Please enter the email you booked with." }, 400);
  }
  const idea = clip(data.idea, 4000);
  if (!idea) return json({ ok: false, error: "Tell me a little about your idea." }, 400);

  const utm = {};
  for (const [k, v] of Object.entries(data.utm || {})) {
    if (/^(utm_[a-z]+|fbclid)$/.test(k)) utm[k] = clip(v, 200);
  }

  const at = new Date().toISOString();
  const intake = {
    email,
    name: clip(data.name, 100),
    idea,
    audience: clip(data.audience, 500),
    features: clip(data.features, 2000),
    examples: clip(data.examples, 1000),
    experience: clip(data.experience, 20),
    bookingId: clip(data.bookingId, 120),
    ...utm,
    at,
  };

  await env.LEADS.put(`intake:${email}:${at}`, JSON.stringify(intake), {
    metadata: { email, name: intake.name, idea: idea.slice(0, 200), at },
  });

  if (env.INTAKE_WEBHOOK_URL) {
    waitUntil(
      fetch(env.INTAKE_WEBHOOK_URL, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(intake),
      }).catch(() => {})
    );
  }

  return json({ ok: true });
}
