// Where the buttons go. Paste the boot camp checkout URL and the Skool group
// invite URL here; until then the buttons scroll to the pricing and FAQ sections.
const LINKS = {
  bootcamp: "", // e.g. your Stripe, Eventbrite or Calendly checkout for the $497 boot camp
  club: "",     // e.g. https://www.skool.com/your-group
};

document.querySelectorAll("[data-link]").forEach((el) => {
  const url = LINKS[el.dataset.link];
  if (!url) return;
  el.href = url;
  if (/^https?:/.test(url)) el.rel = "noopener";
});

document.querySelectorAll("[data-year]").forEach((el) => {
  el.textContent = new Date().getFullYear();
});

// Build log: every entry is visible at rest. A highlight steps through the
// versions, boot camp first, then the club weeks, so the hero reads as one
// app moving from v0.1 to launch.
(function buildLog() {
  const list = document.querySelector("[data-log]");
  if (!list) return;
  const rows = [...list.querySelectorAll(".log__row")];
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");

  const show = (i) => {
    rows.forEach((row, n) => {
      row.classList.toggle("is-done", n < i);
      row.classList.toggle("is-current", n === i);
    });
  };

  if (reduce.matches) {
    show(rows.length - 1);
    return;
  }

  let i = 0;
  let timer = null;
  const tick = () => {
    show(i);
    const atEnd = i === rows.length - 1;
    i = atEnd ? 0 : i + 1;
    timer = setTimeout(tick, atEnd ? 3600 : 1400);
  };

  // Only run while the log is on screen.
  const io = new IntersectionObserver(([entry]) => {
    if (entry.isIntersecting && !timer) tick();
    if (!entry.isIntersecting && timer) { clearTimeout(timer); timer = null; }
  });
  show(rows.length - 1);
  io.observe(list);
})();
