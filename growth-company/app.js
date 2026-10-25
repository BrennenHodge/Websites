/* Headway one-page site: throughput model, capability matrix, contact form. */

// ---- Site settings -------------------------------------------------------
// BRAND is the working name; every element marked data-brand is set from it.
// CONTACT_EMAIL receives enquiries. FORM_ENDPOINT, if set, receives the form as
// a JSON POST (Formspree, Basin, a CRM webhook). Without one, the form opens the
// visitor's email app with the message filled in.
const BRAND = "Headway";
const CONTACT_EMAIL = "growth@example.com";
const FORM_ENDPOINT = "";

// ---- Throughput model ----------------------------------------------------
// Capacity per stage, in orders per month. The system can only ship as many
// orders as its narrowest stage allows; each step removes the current
// constraint and reveals the next one.
const MODEL_SCALE = 150;
const MODEL_START = [
  { name: "Demand generation", cap: 140 },
  { name: "Sales conversion", cap: 118 },
  { name: "Quoting & estimating", cap: 64 },
  { name: "Production", cap: 96 },
  { name: "Fulfillment", cap: 124 },
];
const MODEL_STEPS = [
  { stage: "Quoting & estimating", cap: 132, note: "Automated quoting: estimates go out in hours, not weeks. Output jumps until production becomes the limit." },
  { stage: "Production", cap: 130, note: "Scheduling software gets more from the same floor and crew. Now the sales process sets the pace." },
  { stage: "Sales conversion", cap: 136, note: "A rebuilt sales process lifts the win rate. Fulfillment is next. There is always a next constraint." },
];
const MODEL_INTRO = "A business moves only as fast as its narrowest point. Here it's quoting, not demand.";

function initModel() {
  const rowsEl = document.querySelector("[data-model-rows]");
  if (!rowsEl) return;
  const outEl = document.querySelector("[data-model-output]");
  const deltaEl = document.querySelector("[data-model-delta]");
  const noteEl = document.querySelector("[data-model-note]");
  const btn = document.querySelector("[data-model-step]");

  let stages, step;
  const baseline = Math.min(...MODEL_START.map(s => s.cap));

  rowsEl.innerHTML = MODEL_START.map(s => `
    <div class="mrow" data-stage="${s.name}">
      <div class="mrow__name">${s.name.replace("&", "&amp;")}<span class="mrow__tag">Constraint</span></div>
      <div class="mrow__track" aria-hidden="true"><span class="mrow__fill"></span></div>
      <div class="mrow__val"></div>
    </div>`).join("");

  function render() {
    const output = Math.min(...stages.map(s => s.cap));
    rowsEl.style.setProperty("--t", `${(output / MODEL_SCALE) * 100}%`);
    stages.forEach(s => {
      const row = rowsEl.querySelector(`[data-stage="${s.name}"]`);
      row.querySelector(".mrow__fill").style.setProperty("--w", `${(s.cap / MODEL_SCALE) * 100}%`);
      row.querySelector(".mrow__val").textContent = s.cap;
      row.classList.toggle("is-constraint", s.cap === output);
    });
    outEl.textContent = output;
    const gain = Math.round(((output - baseline) / baseline) * 100);
    deltaEl.hidden = gain === 0;
    deltaEl.textContent = `+${gain}% vs. start`;
    noteEl.textContent = step === 0 ? MODEL_INTRO : MODEL_STEPS[step - 1].note;
    btn.textContent = step < MODEL_STEPS.length ? "Remove the constraint" : "Reset the model";
  }

  function reset() {
    stages = MODEL_START.map(s => ({ ...s }));
    step = 0;
    render();
  }

  btn.addEventListener("click", () => {
    if (step >= MODEL_STEPS.length) return reset();
    const change = MODEL_STEPS[step];
    stages.find(s => s.name === change.stage).cap = change.cap;
    step += 1;
    render();
  });

  reset();
}

// ---- Capability matrix ---------------------------------------------------
// Columns: marketing agency, software firm, management consultancy,
// AI automation agency, us. 2 = core focus, 1 = partial, 0 = outside scope.
const MATRIX = [
  { row: "Diagnoses constraints across the business", v: [1, 0, 2, 0, 2] },
  { row: "Develops growth strategy", v: [1, 0, 2, 0, 2] },
  { row: "Runs marketing and sales programs", v: [2, 0, 0, 0, 2] },
  { row: "Builds custom software and automation", v: [1, 2, 0, 1, 2] },
  { row: "Improves operations and processes", v: [0, 1, 1, 1, 2] },
  { row: "Accountable for business results", v: [1, 0, 1, 0, 2] },
];
const DOT = [
  ["none", "Typically outside scope"],
  ["part", "Partial or within a narrow scope"],
  ["full", "Core focus"],
];

function initMatrix() {
  const body = document.querySelector("[data-matrix]");
  if (!body) return;
  body.innerHTML = MATRIX.map(({ row, v }) => `
    <tr>
      <th scope="row">${row}</th>
      ${v.map((n, i) => `<td${i === v.length - 1 ? ' class="matrix__us"' : ""}><span class="dot dot--${DOT[n][0]}"></span><span class="visually-hidden">${DOT[n][1]}</span></td>`).join("")}
    </tr>`).join("");
}

// ---- Contact form --------------------------------------------------------
function initForm() {
  const form = document.querySelector("[data-contact-form]");
  if (!form) return;
  const status = form.querySelector("[data-form-status]");

  const say = (msg, isError = false) => {
    status.textContent = msg;
    status.classList.toggle("is-error", isError);
  };

  form.addEventListener("submit", async e => {
    e.preventDefault();
    const name = form.elements.name;
    const email = form.elements.email;
    name.removeAttribute("aria-invalid");
    email.removeAttribute("aria-invalid");

    if (!name.value.trim()) {
      name.setAttribute("aria-invalid", "true");
      name.focus();
      return say("Add your name so we know who to reply to.", true);
    }
    if (!email.validity.valid || !email.value.trim()) {
      email.setAttribute("aria-invalid", "true");
      email.focus();
      return say("Enter a work email address, like name@company.com.", true);
    }

    const data = {
      name: name.value.trim(),
      email: email.value.trim(),
      company: form.elements.company.value.trim(),
      role: form.elements.role.value,
      areas: [...form.querySelectorAll('input[name="area"]:checked')].map(i => i.value),
      message: form.elements.message.value.trim(),
    };

    if (FORM_ENDPOINT) {
      say("Sending…");
      try {
        const res = await fetch(FORM_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify(data),
        });
        if (!res.ok) throw new Error(res.status);
        form.reset();
        return say(`Thanks, ${data.name.split(" ")[0]}. We'll reply within one business day.`);
      } catch {
        return say(`That didn't go through. Try again, or email us at ${CONTACT_EMAIL}.`, true);
      }
    }

    const fields = [
      ["Name", data.name],
      ["Email", data.email],
      ["Company", data.company],
      ["Role", data.role],
      ["Where we feel the constraint", data.areas.join(", ")],
    ].filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`);
    const subject = `Growth conversation${data.company ? `: ${data.company}` : ""}`;
    window.location.href = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent([...fields, "", data.message].join("\n"))}`;
    say(`Your email app should open with this message ready to send. If it doesn't, write to ${CONTACT_EMAIL}.`);
  });
}

// ---- Boot ----------------------------------------------------------------
document.querySelectorAll("[data-brand]").forEach(el => { el.textContent = BRAND; });
document.querySelectorAll("[data-contact-email]").forEach(el => { el.textContent = CONTACT_EMAIL; });
document.querySelectorAll("[data-year]").forEach(el => { el.textContent = new Date().getFullYear(); });
initModel();
initMatrix();
initForm();
