(function () {
  "use strict";

  // Categories shown as filter chips, in display order.
  var CATEGORIES = [
    { id: "ski", label: "Ski & Alpine" },
    { id: "outerwear", label: "Outerwear" },
    { id: "knitwear", label: "Knitwear" },
    { id: "apparel", label: "Everyday Apparel" },
    { id: "footwear", label: "Footwear" },
    { id: "accessories", label: "Accessories" },
    { id: "bike", label: "Bike, Trail & Fuel" },
    { id: "kids", label: "Kids" }
  ];

  // Brands from the store's own brand page. style = wordmark treatment.
  var BRANDS = [
    { name: "Alp-N-Rock", style: "wide", cats: ["ski", "apparel"], what: "Alpine-inspired luxury sportswear: embroidered knits, ski-chic layers and après pieces." },
    { name: "Alps & Meters", style: "serif", cats: ["ski", "outerwear"], what: "Heritage-inspired alpine outerwear and ski clothing with a vintage mountain look." },
    { name: "Amundsen Sports", style: "caps", origin: "Norway", cats: ["knitwear", "outerwear"], what: "Wool-first outdoor clothing named for polar explorer Roald Amundsen." },
    { name: "Atlas", style: "caps", cats: ["bike"], what: "Snowshoes for Vermont winters on the trails and the back fields." },
    { name: "Belstaff", style: "wide", origin: "England · 1924", cats: ["outerwear"], what: "Waxed-cotton and leather jackets with British motorcycling roots." },
    { name: "Bogner", style: "heavy", origin: "Munich · 1932", cats: ["ski", "outerwear"], what: "Luxury ski and sportswear from a family that has dressed Olympic teams." },
    { name: "Dale of Norway", style: "italic", origin: "Norway · 1879", cats: ["knitwear"], what: "Pure-wool sweaters in classic Norwegian patterns." },
    { name: "Duck Head", style: "serif", origin: "Nashville · 1865", cats: ["apparel"], what: "Southern chinos, shorts and polos with 150 years of history." },
    { name: "Fusalp", style: "wide", origin: "Annecy · 1952", cats: ["ski", "outerwear"], what: "French ski fashion: slim stretch ski pants, jackets and knits." },
    { name: "Goldbergh", style: "italic", origin: "Netherlands", cats: ["ski", "outerwear"], what: "Women's luxury skiwear with fur trims, bold prints and a fitted silhouette." },
    { name: "Gorski", style: "serif", origin: "Montréal", cats: ["outerwear"], what: "Luxury shearling, down and fur-trimmed coats." },
    { name: "Hammer Nutrition", style: "caps", origin: "Montana · 1987", cats: ["bike"], what: "Endurance fuel: gels, drink mixes and recovery for long rides." },
    { name: "Hanwag", style: "caps", origin: "Bavaria · 1921", cats: ["footwear"], what: "Hand-built mountain and hiking boots made in Europe." },
    { name: "Hestra", style: "serif", origin: "Sweden · 1936", cats: ["accessories", "ski"], what: "Leather ski and winter gloves from a Swedish family business." },
    { name: "High Society", style: "heavy", cats: ["accessories"], what: "Freeride-born headwear and accessories." },
    { name: "Maloja", style: "italic", origin: "Bavaria · 2004", cats: ["ski", "bike", "apparel"], what: "Colorful mountain-bike, ski and Nordic clothing with Alpine prints." },
    { name: "Maui Jim", style: "wide", origin: "Hawai‘i · 1980", cats: ["accessories"], what: "Polarized sunglasses known for color-rich lenses." },
    { name: "Melin", style: "caps", origin: "California", cats: ["accessories"], what: "Premium caps and hats built to last." },
    { name: "Mephisto", style: "wide", origin: "France · 1965", cats: ["footwear"], what: "Handmade walking shoes known for all-day comfort." },
    { name: "Mountain Khakis", style: "caps", origin: "Jackson Hole", cats: ["apparel"], what: "Rugged pants, shirts and jackets for the outdoors and around town." },
    { name: "NexGrip", style: "mono", cats: ["footwear"], what: "Winter footwear built for icy sidewalks and trails." },
    { name: "Norlander", style: "serif", cats: ["knitwear"], what: "Nordic-style knitwear for cold mornings." },
    { name: "OluKai", style: "italic", origin: "Hawai‘i", cats: ["footwear"], what: "Sandals, slippers and shoes inspired by island life." },
    { name: "On", style: "heavy", origin: "Zürich · 2010", cats: ["footwear"], what: "Swiss-engineered running and everyday shoes with CloudTec cushioning." },
    { name: "Ortovox", style: "caps", origin: "Germany · 1980", cats: ["ski", "apparel"], what: "Merino mountain clothing and avalanche-safety gear." },
    { name: "Osprey", style: "caps", origin: "Colorado · 1974", cats: ["bike", "accessories"], what: "Backpacks, travel bags and hydration packs with a lifetime guarantee." },
    { name: "Pajar", style: "wide", origin: "Montréal · 1963", cats: ["footwear", "outerwear"], what: "Winter boots and parkas made for real cold." },
    { name: "Parajumpers", style: "caps", origin: "Italy · 2006", cats: ["outerwear"], what: "Technical down parkas with Italian styling." },
    { name: "Peuterey", style: "wide", origin: "Italy · 2002", cats: ["outerwear"], what: "Italian outerwear named after a ridge on Mont Blanc." },
    { name: "Postcard", style: "italic", origin: "Italy", cats: ["ski", "outerwear"], what: "Italian mountain-style ski jackets and après layers." },
    { name: "prAna", style: "mono", origin: "California · 1992", cats: ["apparel"], what: "Climbing- and yoga-inspired clothing made with sustainable materials." },
    { name: "Reima", style: "caps", origin: "Finland · 1944", cats: ["kids", "outerwear"], what: "Kids' snowsuits, rainwear and outdoor clothing tested in Nordic weather." },
    { name: "Repeat Cashmere", style: "serif", origin: "Netherlands", cats: ["knitwear"], what: "Soft cashmere and fine knits in modern cuts." },
    { name: "Rossignol", style: "heavy", origin: "France · 1907", cats: ["ski", "outerwear"], what: "One of skiing's oldest names, now making ski apparel and lifestyle clothing." },
    { name: "SAXX", style: "caps", origin: "Vancouver · 2006", cats: ["apparel"], what: "Men's underwear and base layers with the BallPark Pouch." },
    { name: "Scott", style: "heavy", origin: "Switzerland · 1958", cats: ["bike", "ski"], what: "Bikes, goggles and ski gear. Founded in Sun Valley, now based in Switzerland." },
    { name: "Smartwool", style: "serif", origin: "Colorado · 1994", cats: ["knitwear", "apparel", "accessories"], what: "Merino wool socks and base layers." },
    { name: "Sportalm", style: "italic", origin: "Kitzbühel · 1953", cats: ["ski", "outerwear"], what: "Austrian ski fashion with bold colors and couture details." },
    { name: "Swany", style: "caps", origin: "Japan · 1937", cats: ["accessories", "ski"], what: "Warm, waterproof ski gloves and mittens." },
    { name: "True Grit", style: "italic", origin: "California", cats: ["apparel"], what: "Cozy sherpa, fleece and soft knits for lounging and layering." },
    { name: "Turtle Fur", style: "heavy", origin: "Vermont", local: true, cats: ["accessories", "kids"], what: "Neck warmers and hats from Morrisville, Vermont." },
    { name: "Vital Proteins", style: "wide", origin: "Chicago", cats: ["bike"], what: "Collagen and wellness supplements." },
    { name: "Vuori", style: "wide", origin: "California · 2015", cats: ["apparel"], what: "Performance clothing for training, travel and the weekend." }
  ];

  // Spotlight picks: a cross-section of the shop.
  var SPOTLIGHT = [
    { name: "Bogner", tags: ["Ski suits", "Après", "Knits"], text: "Founded by Willy Bogner Sr. in 1932, the Munich house has outfitted German Olympic ski teams for decades. The label is known for sleek ski suits, fur-trimmed jackets and après knits." },
    { name: "Dale of Norway", tags: ["Wool sweaters", "Hats"], text: "Knitting since 1879 in the town of Dale, Norway. Heavy pure-wool sweaters in snowflake and star patterns, the same kind worn by Norwegian Olympic teams." },
    { name: "Belstaff", tags: ["Waxed jackets", "Leather"], text: "Born in Staffordshire, England, in 1924, Belstaff made its name with waxed-cotton motorcycle jackets. The four-pocket Trialmaster is still a classic." },
    { name: "Rossignol", tags: ["Ski jackets", "Layers"], text: "A French name that's been on skis since 1907. The apparel line brings the same racing heritage to jackets, mid-layers and everyday pieces." },
    { name: "On", tags: ["Running", "Everyday"], text: "Swiss engineering for your feet. The Cloud line is built around CloudTec pods that cushion the landing and firm up for the push-off." },
    { name: "Turtle Fur", tags: ["Made in VT", "Neck warmers"], text: "A Vermont company from Morrisville, up north near Stowe. Turtle Fur's fleece neck warmers and hats are a winter staple across the state." }
  ];

  var byName = {};
  BRANDS.forEach(function (b) { byName[b.name] = b; });

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  // Brand count in hero
  var countEl = document.querySelector("[data-brand-count]");
  if (countEl) countEl.textContent = BRANDS.length;

  // Ticker (content duplicated so the loop is seamless)
  var ticker = document.querySelector("[data-ticker]");
  if (ticker) {
    var names = BRANDS.map(function (b) { return b.name; });
    names.concat(names).forEach(function (n) { ticker.appendChild(el("span", null, n)); });
  }

  // Department brand lists
  var DEPTS = {
    outerwear: ["ski", "outerwear"],
    apparel: ["knitwear", "apparel"],
    footwear: ["footwear"],
    accessories: ["accessories"]
  };
  document.querySelectorAll("[data-dept]").forEach(function (p) {
    var cats = DEPTS[p.getAttribute("data-dept")] || [];
    p.textContent = BRANDS.filter(function (b) {
      return b.cats.some(function (c) { return cats.indexOf(c) !== -1; });
    }).map(function (b) { return b.name; }).join(" · ");
  });

  // Spotlight
  var spot = document.querySelector("[data-spotlight]");
  if (spot) {
    SPOTLIGHT.forEach(function (s) {
      var b = byName[s.name];
      var art = el("article", "spot");
      art.appendChild(el("p", "spot__origin", b.origin || ""));
      art.appendChild(el("h3", "spot__name wm wm--" + b.style, b.name));
      art.appendChild(el("p", null, s.text));
      var tags = el("div", "spot__tags");
      s.tags.forEach(function (t) { tags.appendChild(el("span", "tag", t)); });
      art.appendChild(tags);
      spot.appendChild(art);
    });
  }

  // Directory
  var shelf = document.querySelector("[data-shelf]");
  var filters = document.querySelector("[data-filters]");
  var results = document.querySelector("[data-results]");
  var search = document.getElementById("brand-search");
  var active = "all";

  function makeChip(id, label, count) {
    var b = el("button", "chip", label);
    b.type = "button";
    b.setAttribute("data-cat", id);
    b.setAttribute("aria-pressed", id === active ? "true" : "false");
    b.appendChild(el("span", "chip__count", String(count)));
    b.addEventListener("click", function () {
      active = id;
      filters.querySelectorAll(".chip").forEach(function (c) {
        c.setAttribute("aria-pressed", c.getAttribute("data-cat") === id ? "true" : "false");
      });
      render();
    });
    return b;
  }

  if (filters) {
    filters.appendChild(makeChip("all", "All brands", BRANDS.length));
    CATEGORIES.forEach(function (c) {
      var n = BRANDS.filter(function (b) { return b.cats.indexOf(c.id) !== -1; }).length;
      if (n) filters.appendChild(makeChip(c.id, c.label, n));
    });
  }

  function render() {
    if (!shelf) return;
    var q = (search && search.value || "").trim().toLowerCase();
    var list = BRANDS.filter(function (b) {
      var inCat = active === "all" || b.cats.indexOf(active) !== -1;
      var hay = (b.name + " " + b.what + " " + (b.origin || "")).toLowerCase();
      return inCat && (!q || hay.indexOf(q) !== -1);
    });
    shelf.textContent = "";
    list.forEach(function (b) {
      var li = el("li", "brand");
      li.appendChild(el("p", "wm wm--" + b.style, b.name));
      li.appendChild(el("p", "brand__what", b.what));
      var o = el("p", "brand__origin");
      if (b.local) o.appendChild(el("span", "local", "Made in Vermont"));
      else o.textContent = b.origin || CATEGORIES.filter(function (c) { return c.id === b.cats[0]; })[0].label;
      li.appendChild(o);
      shelf.appendChild(li);
    });
    if (!list.length) {
      var empty = el("li", "shelf__empty", "No brands match “" + q + "”. Try a product like “gloves” or “wool”, or clear the search.");
      shelf.appendChild(empty);
    }
    var label = active === "all" ? "all categories" : CATEGORIES.filter(function (c) { return c.id === active; })[0].label;
    results.textContent = "Showing " + list.length + " of " + BRANDS.length + " brands · " + label;
  }
  if (search) search.addEventListener("input", render);
  render();

  // Photos: show the image when it loads; keep the designed fallback if it doesn't.
  document.querySelectorAll("img[data-photo]").forEach(function (img) {
    var box = img.closest(".photo");
    function ok() { if (img.naturalWidth > 0) box.classList.add("is-loaded"); }
    function fail() { img.remove(); }
    if (img.complete) { img.naturalWidth > 0 ? ok() : fail(); }
    img.addEventListener("load", ok);
    img.addEventListener("error", fail);
  });

  // Open / closed status in Woodstock's time zone (Mon–Sat 8:30–17:00)
  try {
    var parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York", weekday: "short", hour: "numeric", minute: "numeric", hour12: false
    }).formatToParts(new Date());
    var get = function (t) { return (parts.filter(function (p) { return p.type === t; })[0] || {}).value; };
    var dayIdx = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(get("weekday"));
    var mins = (parseInt(get("hour"), 10) % 24) * 60 + parseInt(get("minute"), 10);
    var open = dayIdx >= 1 && dayIdx <= 6 && mins >= 510 && mins < 1020;
    var status = document.querySelector("[data-open-status]");
    if (status) {
      status.textContent = open ? "Open now · until 5 pm today" : (dayIdx === 0 || (dayIdx === 6 && mins >= 1020) ? "Closed · opens Monday 8:30 am" : (mins < 510 ? "Closed · opens today 8:30 am" : "Closed · opens tomorrow 8:30 am"));
      status.classList.toggle("is-open", open);
    }
    var row = document.querySelector('[data-hours] tr[data-day="' + dayIdx + '"]');
    if (row) row.classList.add("is-today");
  } catch (e) { /* leave the static label */ }

  var yr = document.querySelector("[data-year]");
  if (yr) yr.textContent = new Date().getFullYear();
})();
