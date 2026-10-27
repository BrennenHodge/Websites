// POST /api/lead: saves the email of someone who isn't ready to buy yet.
// Leads are stored in KV (binding LEADS), keyed by email, with the details in the key
// metadata so `wrangler kv key list` shows everything. Optional extras, set as Pages
// secrets: LEAD_WEBHOOK_URL (forward each lead as JSON to Zapier/Make/your email tool)
// and META_CAPI_TOKEN + META_PIXEL_ID (send a server-side Lead event to Meta).

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

const clip = (v, n) => (typeof v === "string" ? v.trim().slice(0, n) : "");

const sha256 = async (text) => {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
};

const cookie = (request, name) =>
  (request.headers.get("cookie") || "").match(new RegExp(`(?:^|; )${name}=([^;]*)`))?.[1] || "";

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
    return json({ ok: false, error: "Please enter a valid email." }, 400);
  }

  const utm = {};
  for (const [k, v] of Object.entries(data.utm || {})) {
    if (/^(utm_[a-z]+|fbclid)$/.test(k)) utm[k] = clip(v, 200);
  }

  const lead = {
    email,
    name: clip(data.name, 100),
    source: clip(data.source, 40),
    angle: clip(data.angle, 40),
    ...utm,
    country: request.cf?.country || "",
    at: new Date().toISOString(),
  };

  const key = `lead:${email}`;
  const existing = await env.LEADS.getWithMetadata(key);
  if (existing.metadata?.at) lead.firstAt = existing.metadata.firstAt || existing.metadata.at;
  await env.LEADS.put(key, JSON.stringify(lead), { metadata: lead });

  if (env.LEAD_WEBHOOK_URL) {
    waitUntil(
      fetch(env.LEAD_WEBHOOK_URL, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(lead),
      }).catch(() => {})
    );
  }

  if (env.META_CAPI_TOKEN && env.META_PIXEL_ID) {
    const event = {
      event_name: "Lead",
      event_time: Math.floor(Date.now() / 1000),
      event_id: clip(data.eventId, 80) || undefined, // matches the browser pixel event, so Meta counts it once
      action_source: "website",
      event_source_url: clip(data.page, 500) || undefined,
      user_data: {
        em: [await sha256(email)],
        client_ip_address: request.headers.get("cf-connecting-ip") || undefined,
        client_user_agent: request.headers.get("user-agent") || undefined,
        fbp: cookie(request, "_fbp") || undefined,
        fbc: cookie(request, "_fbc") || undefined,
      },
    };
    waitUntil(
      fetch(`https://graph.facebook.com/v21.0/${env.META_PIXEL_ID}/events?access_token=${env.META_CAPI_TOKEN}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ data: [event] }),
      }).catch(() => {})
    );
  }

  return json({ ok: true });
}
