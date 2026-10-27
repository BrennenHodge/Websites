// Everything that changes between boot camps lives here.
const CONFIG = {
  // TODO: placeholder date until the real one is set.
  event: {
    date: "Saturday, November 21",
    short: "Sat, Nov 21",
    time: "10 am – 1 pm CT",
  },
  checkout: "",    // TODO: checkout URL for the $497 seat. Blank = buttons scroll to the offer.
  video: "",       // TODO: 45-second screen recording (an .mp4 URL). Blank = placeholder frame.
  metaPixelId: "", // TODO: Meta Pixel ID for the ads. Blank = no tracking loads.
};

document.querySelectorAll("[data-event]").forEach((el) => {
  const value = CONFIG.event[el.dataset.event];
  if (value) el.textContent = value;
});

document.querySelectorAll("[data-year]").forEach((el) => {
  el.textContent = new Date().getFullYear();
});

// Meta Pixel: PageView on load, InitiateCheckout on any seat button.
if (CONFIG.metaPixelId) {
  !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
  n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
  n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
  t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
  document,'script','https://connect.facebook.net/en_US/fbevents.js');
  fbq("init", CONFIG.metaPixelId);
  fbq("track", "PageView");
}

// Keep ad parameters (utm_*, fbclid) on the way to checkout.
const passThrough = new URLSearchParams(
  [...new URLSearchParams(location.search)].filter(([k]) => k.startsWith("utm_") || k === "fbclid")
);

document.querySelectorAll('[data-link="checkout"]').forEach((el) => {
  if (CONFIG.checkout) {
    const url = new URL(CONFIG.checkout);
    passThrough.forEach((v, k) => url.searchParams.set(k, v));
    el.href = url.toString();
    el.rel = "noopener";
  }
  el.addEventListener("click", () => {
    if (window.fbq) fbq("track", "InitiateCheckout", { value: 497, currency: "USD" });
  });
});

// Demo video replaces the placeholder once there is one.
if (CONFIG.video) {
  const frame = document.querySelector("[data-video]");
  if (frame) {
    const video = document.createElement("video");
    Object.assign(video, { src: CONFIG.video, controls: true, playsInline: true, preload: "metadata" });
    video.setAttribute("aria-label", "45-second demo of an app being built with AI");
    frame.replaceChildren(video);
  }
}
