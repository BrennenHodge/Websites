// Everything that changes for the offer lives here.
const CONFIG = {
  price: 697,
  // Cal.com booking page. Turn on Stripe payment ($697) for this event, and set its
  // after-booking redirect to https://aibuildclub.co/thanks?booked=1
  // Blank = buttons scroll to the offer.
  booking: "https://cal.com/brennenhodge/ai-consult?overlayCalendar=true",
  video: "/video/intro.mp4", // Personal intro video (.mp4 URL). Blank = placeholder frame.
  videoPoster: "/video/intro-poster.jpg",
  demo: "",        // TODO: 45-second build demo (.mp4 URL). Blank = placeholder frame.
  metaPixelId: "", // TODO: Meta Pixel ID. Blank = no tracking loads.
  // The pixel only loads on these hosts, so local and preview traffic doesn't pollute ad data.
  pixelHosts: ["aibuildclub.co"],
  leadEndpoint: "/api/lead",
  intakeEndpoint: "/api/intake",
  // Headline per ad: /?angle=business. Each is [before, highlighted, after]. Every angle sells the same session.
  angles: {
    experience: ["16 years building software and companies. ", "Two hours focused on you.", ""],
    business: ["Put AI to work ", "in your business.", ""],
    build: ["Have an idea? ", "Let's build it with AI.", ""],
    automate: ["Hand your busywork ", "to AI.", ""],
    beginner: ["New to AI? ", "Learn it one-on-one.", ""],
  },
};

const store = {
  get(k) { try { return sessionStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { sessionStorage.setItem(k, v); } catch {} },
};
const page = document.body.dataset.page;
const params = new URLSearchParams(location.search);
const newId = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);
const validEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

document.querySelectorAll("[data-year]").forEach((el) => {
  el.textContent = new Date().getFullYear();
});

// Ad parameters (utm_*, fbclid) are kept for the session, so they reach booking and the forms.
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
  if (page === "sales") fbq("track", "ViewContent", { content_name: "Private AI coaching", value: CONFIG.price, currency: "USD" });
}
const track = (name, data = {}, eventID) => {
  if (pixelOn && window.fbq) fbq("track", name, data, eventID ? { eventID } : undefined);
};

// Booking: carry ad parameters, and prefill the email if they gave us one.
document.querySelectorAll('[data-link="book"]').forEach((el) => {
  el.addEventListener("click", () => {
    store.set("abc-book", "1");
    track("InitiateCheckout", { value: CONFIG.price, currency: "USD" });
  });
  if (!CONFIG.booking) return;
  const url = new URL(CONFIG.booking);
  Object.entries(ad).forEach(([k, v]) => url.searchParams.set(k, v));
  const email = store.get("abc-email");
  if (email) url.searchParams.set("email", email);
  el.href = url.toString();
  el.rel = "noopener";
});

// Videos replace their placeholders once there is a file.
document.querySelectorAll("[data-video]").forEach((frame) => {
  const src = CONFIG[frame.dataset.video];
  if (!src) return;
  const video = document.createElement("video");
  const poster = CONFIG[`${frame.dataset.video}Poster`] || "";
  Object.assign(video, { src, poster, controls: true, playsInline: true, preload: "metadata" });
  video.setAttribute("aria-label", frame.querySelector(".demo__title")?.textContent || "Video");
  frame.replaceChildren(video);
});

// Lead forms: inline under the offer, and the exit-intent dialog.
const exitDialog = document.querySelector("[data-exit]");
document.querySelectorAll("[data-lead-form]").forEach((form) => {
  const msg = form.querySelector(".lead__msg");
  const button = form.querySelector("button");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = form.email.value.trim();
    if (!validEmail(email)) {
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
      track("Lead", { content_name: "Private AI coaching" }, eventId);
      store.set("abc-email", email);
      store.set("abc-lead", "1");
      form.replaceChildren(Object.assign(document.createElement("p"), {
        className: "lead__done",
        textContent: "Got it. I'll email you the details. Reply with any questions.",
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
    if (store.get("abc-exit") || store.get("abc-lead") || store.get("abc-book")) return;
    store.set("abc-exit", "1");
    exitDialog.showModal();
    document.removeEventListener("mouseout", onLeave);
  };
  document.addEventListener("mouseout", onLeave);
  exitDialog.querySelector("[data-exit-close]").addEventListener("click", () => exitDialog.close());
  exitDialog.addEventListener("click", (e) => { if (e.target === exitDialog) exitDialog.close(); });
}

// Thank-you page: count the booking once, then collect the goals questionnaire.
if (page === "thanks") {
  // Booking tools add their own ids to the redirect (Stripe, Calendly, Cal.com); ?booked=1 works for any of them.
  const bookingId = ["session_id", "invitee_uuid", "uid", "bookingId"].map((k) => params.get(k)).find(Boolean);
  if (bookingId || params.has("booked")) {
    const key = `abc-purchase-${bookingId || "booked"}`;
    let seen = false;
    try { seen = localStorage.getItem(key) === "1"; localStorage.setItem(key, "1"); } catch {}
    if (!seen) track("Purchase", { value: CONFIG.price, currency: "USD", content_name: "Private AI coaching" }, bookingId);
  }

  const form = document.querySelector("[data-intake-form]");
  if (form) {
    const prefill = {
      name: params.get("name") || params.get("invitee_full_name") || "",
      email: params.get("email") || params.get("invitee_email") || store.get("abc-email") || "",
    };
    Object.entries(prefill).forEach(([k, v]) => { if (v && form[k]) form[k].value = v; });

    const msg = form.querySelector(".lead__msg");
    const button = form.querySelector('button[type="submit"]');
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const data = { ...Object.fromEntries(fd), topics: fd.getAll("topics") };
      if (!validEmail(String(data.email || "").trim())) {
        msg.textContent = "Please enter the email you booked with.";
        form.email.focus();
        return;
      }
      if (!String(data.goals || "").trim()) {
        msg.textContent = "Tell me a little about what you want help with.";
        form.goals.focus();
        return;
      }
      button.disabled = true;
      msg.textContent = "Sending…";
      try {
        const res = await fetch(CONFIG.intakeEndpoint, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ ...data, bookingId: bookingId || "", utm: ad }),
        });
        const out = await res.json().catch(() => ({}));
        if (!res.ok || !out.ok) throw new Error(out.error || "Something went wrong. Please try again.");
        form.replaceChildren(Object.assign(document.createElement("p"), {
          className: "lead__done",
          textContent: "Thanks. I'll read this before we meet and tailor the session to you.",
        }));
      } catch (err) {
        msg.textContent = err.message;
        button.disabled = false;
      }
    });
  }
}
