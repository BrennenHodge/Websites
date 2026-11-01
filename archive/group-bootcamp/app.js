// Everything that changes between boot camps lives here.
const CONFIG = {
  // TODO: placeholder date until the real one is set. start/end drive the countdown and calendar links.
  event: {
    date: "Saturday, November 21",
    short: "Sat, Nov 21",
    time: "10 am – 1 pm CT",
    start: "2026-11-21T10:00:00-06:00",
    end: "2026-11-21T13:00:00-06:00",
  },
  seats: 50,    // TODO: confirm the seat cap. 0 hides the line.
  // TODO: confirm the fast-action bonus (only offer what you'll deliver). null hides it.
  bonus: {
    tag: "Bonus for the first 10 seats",
    title: "A 15-minute idea call with me",
    detail: "Before the boot camp, we shape your idea so you walk in ready to build.",
  },
  checkout: "",    // TODO: Stripe Payment Link for the $497 seat. Blank = buttons scroll to the offer.
  video: "",       // TODO: 2–4 minute sales video (.mp4 URL). Blank = placeholder frame.
  demo: "",        // TODO: 45-second build demo (.mp4 URL). Blank = placeholder frame.
  metaPixelId: "", // TODO: Meta Pixel ID. Blank = no tracking loads.
  // The pixel only loads on these hosts, so local and preview traffic doesn't pollute ad data.
  pixelHosts: ["ai-build-club.pages.dev"],
  leadEndpoint: "/api/lead",
  // Headline per ad: /?angle=idea. Each is [before, highlighted, after].
  angles: {
    idea: ["That app idea you keep putting off? ", "Build it", " in 3 hours."],
    developer: ["Skip the developer. ", "Build your app yourself", " in 3 hours."],
    shortcuts: ["Every AI shortcut I use to build apps, ", "in 3 hours", "."],
  },
  price: 497,
};

const store = {
  get(k) { try { return sessionStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { sessionStorage.setItem(k, v); } catch {} },
};
const page = document.body.dataset.page;
const params = new URLSearchParams(location.search);
const newId = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);

document.querySelectorAll("[data-event]").forEach((el) => {
  const value = CONFIG.event[el.dataset.event];
  if (value) el.textContent = value;
});

document.querySelectorAll("[data-year]").forEach((el) => {
  el.textContent = new Date().getFullYear();
});

// Ad parameters (utm_*, fbclid) are kept for the session, so they reach checkout and lead forms.
const adParams = {};
[...params].forEach(([k, v]) => { if (k.startsWith("utm_") || k === "fbclid") adParams[k] = v; });
if (Object.keys(adParams).length) store.set("abc-ad", JSON.stringify(adParams));
const ad = JSON.parse(store.get("abc-ad") || "{}");

const angleKey = params.get("angle") || store.get("abc-angle") || "";
const angle = CONFIG.angles[angleKey];
if (angle) {
  store.set("abc-angle", angleKey);
  const h1 = document.querySelector("[data-headline]");
  if (h1) {
    const mark = document.createElement("mark");
    mark.textContent = angle[1];
    h1.replaceChildren(angle[0], mark, angle[2]);
  }
}

// Meta Pixel: PageView everywhere, ViewContent on the sales page, Lead, InitiateCheckout, Purchase.
const pixelOn = Boolean(CONFIG.metaPixelId) && CONFIG.pixelHosts.includes(location.hostname);
if (pixelOn) {
  !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
  n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
  n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
  t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
  document,'script','https://connect.facebook.net/en_US/fbevents.js');
  fbq("init", CONFIG.metaPixelId);
  fbq("track", "PageView");
  if (page === "sales") fbq("track", "ViewContent", { content_name: "AI App Boot Camp", value: CONFIG.price, currency: "USD" });
}
const track = (name, data = {}, eventID) => {
  if (pixelOn && window.fbq) fbq("track", name, data, eventID ? { eventID } : undefined);
};

// Checkout: carry ad parameters, and prefill the email if they gave us one.
document.querySelectorAll('[data-link="checkout"]').forEach((el) => {
  el.addEventListener("click", () => {
    store.set("abc-checkout", "1");
    track("InitiateCheckout", { value: CONFIG.price, currency: "USD" });
  });
  if (!CONFIG.checkout) return;
  const url = new URL(CONFIG.checkout);
  Object.entries(ad).forEach(([k, v]) => url.searchParams.set(k, v));
  const email = store.get("abc-email");
  if (email) url.searchParams.set("prefilled_email", email);
  el.href = url.toString();
  el.rel = "noopener";
});

// Videos replace their placeholders once there is a file.
document.querySelectorAll("[data-video]").forEach((frame) => {
  const src = CONFIG[frame.dataset.video];
  if (!src) return;
  const video = document.createElement("video");
  Object.assign(video, { src, controls: true, playsInline: true, preload: "metadata" });
  video.setAttribute("aria-label", frame.querySelector(".demo__title")?.textContent || "Video");
  frame.replaceChildren(video);
});

// Countdown to the start.
const countdown = document.querySelector("[data-countdown]");
if (countdown && CONFIG.event.start) {
  const value = countdown.querySelector("[data-countdown-value]");
  const start = new Date(CONFIG.event.start).getTime();
  const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;
  const tick = () => {
    const ms = start - Date.now();
    if (ms <= 0) { countdown.hidden = true; return; }
    const d = Math.floor(ms / 864e5), h = Math.floor(ms / 36e5) % 24, m = Math.floor(ms / 6e4) % 60;
    value.textContent = d > 0 ? `${plural(d, "day")}, ${plural(h, "hour")}` : `${plural(h, "hour")}, ${plural(m, "minute")}`;
    countdown.hidden = false;
  };
  tick();
  setInterval(tick, 30000);
}

const seats = document.querySelector("[data-seats]");
if (seats && CONFIG.seats) {
  seats.textContent = `Capped at ${CONFIG.seats} seats so everyone gets help.`;
  seats.hidden = false;
}

const bonus = document.querySelector("[data-bonus]");
if (bonus && CONFIG.bonus) {
  bonus.querySelector("[data-bonus-tag]").textContent = CONFIG.bonus.tag;
  bonus.querySelector("[data-bonus-title]").textContent = CONFIG.bonus.title;
  bonus.querySelector("[data-bonus-detail]").textContent = CONFIG.bonus.detail;
  bonus.hidden = false;
}

// Lead forms: inline under the offer, and the exit-intent dialog.
const exitDialog = document.querySelector("[data-exit]");
document.querySelectorAll("[data-lead-form]").forEach((form) => {
  const msg = form.querySelector(".lead__msg");
  const button = form.querySelector("button");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = form.email.value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      msg.textContent = "Please enter a valid email.";
      form.email.focus();
      return;
    }
    button.disabled = true;
    msg.textContent = "Sending…";
    const eventId = newId();
    try {
      const res = await fetch(CONFIG.leadEndpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email,
          company: form.company.value,
          source: form.dataset.leadForm,
          angle: angleKey,
          utm: ad,
          page: location.href,
          eventId,
        }),
      });
      const out = await res.json().catch(() => ({}));
      if (!res.ok || !out.ok) throw new Error(out.error || "Something went wrong. Please try again.");
      track("Lead", { content_name: "AI App Boot Camp" }, eventId);
      store.set("abc-email", email);
      store.set("abc-lead", "1");
      form.replaceChildren(Object.assign(document.createElement("p"), {
        className: "lead__done",
        textContent: "You're on the list. I'll send the details and a reminder before the boot camp.",
      }));
    } catch (err) {
      msg.textContent = err.message;
      button.disabled = false;
    }
  });
});

// Exit intent, desktop only: once per visit, not for people who already acted.
if (exitDialog && typeof exitDialog.showModal === "function" && matchMedia("(pointer: fine) and (min-width: 860px)").matches) {
  const armedAt = Date.now() + 6000;
  const onLeave = (e) => {
    if (e.relatedTarget || e.clientY > 0 || Date.now() < armedAt) return;
    if (store.get("abc-exit") || store.get("abc-lead") || store.get("abc-checkout")) return;
    store.set("abc-exit", "1");
    exitDialog.showModal();
    document.removeEventListener("mouseout", onLeave);
  };
  document.addEventListener("mouseout", onLeave);
  exitDialog.querySelector("[data-exit-close]").addEventListener("click", () => exitDialog.close());
  exitDialog.addEventListener("click", (e) => { if (e.target === exitDialog) exitDialog.close(); });
}

// Thank-you page: count the purchase once per Stripe session, and offer calendar links.
if (page === "thanks") {
  const session = params.get("session_id");
  if (session) {
    let seen = false;
    try { seen = localStorage.getItem(`abc-purchase-${session}`) === "1"; localStorage.setItem(`abc-purchase-${session}`, "1"); } catch {}
    if (!seen) track("Purchase", { value: CONFIG.price, currency: "USD", content_name: "AI App Boot Camp" }, session);
  }

  const utc = (iso) => new Date(iso).toISOString().replace(/[-:]|\.\d{3}/g, "");
  const title = "AI App Boot Camp";
  const details = "Live online. Your join link and setup steps come by email before the session.";
  const google = document.querySelector('[data-cal="google"]');
  if (google) {
    const url = new URL("https://calendar.google.com/calendar/render");
    url.search = new URLSearchParams({
      action: "TEMPLATE",
      text: title,
      dates: `${utc(CONFIG.event.start)}/${utc(CONFIG.event.end)}`,
      details,
    });
    google.href = url.toString();
  }
  const ics = document.querySelector('[data-cal="ics"]');
  if (ics) {
    const body = [
      "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//AI Build Club//Boot Camp//EN", "BEGIN:VEVENT",
      `UID:${utc(CONFIG.event.start)}@ai-build-club`, `DTSTAMP:${utc(new Date().toISOString())}`,
      `DTSTART:${utc(CONFIG.event.start)}`, `DTEND:${utc(CONFIG.event.end)}`,
      `SUMMARY:${title}`, `DESCRIPTION:${details}`, "END:VEVENT", "END:VCALENDAR",
    ].join("\r\n");
    ics.href = URL.createObjectURL(new Blob([body], { type: "text/calendar" }));
    ics.download = "ai-app-boot-camp.ics";
  }
}
