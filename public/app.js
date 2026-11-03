// The Sorting Register — front end. Loads data/characters.json and renders search, filters and the detail card.

const HOUSES = {
  Gryffindor: { c: "var(--gry)", virtue: "courage and nerve" },
  Slytherin:  { c: "var(--sly)", virtue: "ambition and cunning" },
  Ravenclaw:  { c: "var(--rav)", virtue: "intellect and curiosity" },
  Hufflepuff: { c: "var(--huf)", virtue: "loyalty and hard work" }
};
const ORDER = ["Gryffindor", "Slytherin", "Ravenclaw", "Hufflepuff"];

let DATA = [];
const state = { q: "", medium: "all", house: "all", sort: "name", sel: null };
const $ = id => document.getElementById(id);

const confOf = d => Math.max(...ORDER.map(h => d.scores[h]));
const runnerUp = d => ORDER.map(h => [h, d.scores[h]]).sort((a, b) => b[1] - a[1])[1];
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

function matches(d) {
  const q = state.q.trim().toLowerCase();
  if (q && !(d.name + " " + d.source + " " + d.creator).toLowerCase().includes(q)) return false;
  if (state.medium !== "all" && !d.medium.includes(state.medium)) return false;
  if (state.house !== "all" && d.house !== state.house) return false;
  return true;
}

function sorted(arr) {
  const a = arr.slice();
  if (state.sort === "conf") a.sort((x, y) => confOf(y) - confOf(x));
  else if (state.sort === "year") a.sort((x, y) => x.year - y.year);
  else a.sort((x, y) => x.name.localeCompare(y.name));
  return a;
}

function renderTally() {
  $("tally").innerHTML = ORDER.map(h => {
    const n = DATA.filter(d => d.house === h).length;
    return `<div><b style="color:${HOUSES[h].c}">${h}</b><span>${n} sorted</span></div>`;
  }).join("");
  $("count").textContent = DATA.length + " characters on file";
}

function renderList() {
  const items = sorted(DATA.filter(matches));
  if (!items.length) {
    $("list").innerHTML = `<li class="empty">No characters match that search yet. Try a different name or clear the filters.</li>`;
    return items;
  }
  $("list").innerHTML = items.map(d => `
    <li><button data-id="${d.id}" aria-current="${state.sel === d.id}">
      <span class="stripe" style="background:${HOUSES[d.house].c}"></span>
      <span style="min-width:0"><span class="nm">${esc(d.name)}</span><span class="src">${esc(d.source)} · ${esc(d.medium)}</span></span>
      <span class="pct">${d.house.slice(0, 3).toUpperCase()} ${confOf(d)}%</span>
    </button></li>`).join("");
  return items;
}

function renderCard() {
  const d = DATA.find(x => x.id === state.sel);
  if (!d) { $("card").innerHTML = `<p class="meta">Select a character</p>`; return; }
  const H = HOUSES[d.house];
  const [ruH, ruV] = runnerUp(d);
  const gap = confOf(d) - ruV;
  const fit = gap >= 30 ? "Clear fit" : gap >= 12 ? "Solid fit" : "Close call";
  $("card").innerHTML = `
    <div class="meta">${esc(d.source)} · ${esc(d.creator)} · ${d.year} · ${esc(d.medium)}</div>
    <h2>${esc(d.name)}</h2>
    <div class="verdict">
      <span class="house" style="color:${H.c}">${d.house}</span>
      <span class="conf">${fit} · ${confOf(d)}% match on ${H.virtue}</span>
    </div>
    <div class="bars">
      ${ORDER.map(h => `<div class="bar"><span>${h}</span><span class="track"><span class="fill" style="display:block;width:${d.scores[h]}%;background:${HOUSES[h].c};opacity:${h === d.house ? 1 : .45}"></span></span><span class="v">${d.scores[h]}%</span></div>`).join("")}
    </div>
    <ul class="traits">${d.traits.map(t => `<li>${esc(t)}</li>`).join("")}</ul>
    <h3>Why ${d.house}</h3>
    <p>${esc(d.reasoning)}</p>
    <p class="runner">Second choice: ${ruH} at ${ruV}%.</p>
    <h3>Background</h3>
    <p>${esc(d.background)}</p>`;
}

function select(id, scroll) {
  state.sel = id;
  history.replaceState(null, "", "#" + id);
  renderList(); renderCard();
  if (scroll && matchMedia("(max-width: 760px)").matches) $("card").scrollIntoView({ behavior: "smooth", block: "start" });
}

function update() {
  const items = renderList();
  if (!items.find(d => d.id === state.sel) && items.length) { state.sel = items[0].id; renderList(); }
  renderCard();
}

function chipGroup(rowId, key) {
  $(rowId).addEventListener("click", e => {
    const b = e.target.closest(`button[data-${key}]`); if (!b) return;
    state[key] = b.dataset[key];
    $(rowId).querySelectorAll(`button[data-${key}]`).forEach(x => x.setAttribute("aria-pressed", x === b));
    update();
  });
}

async function init() {
  try {
    const res = await fetch("data/characters.json", { cache: "no-store" });
    if (!res.ok) throw new Error(res.status);
    DATA = await res.json();
  } catch (e) {
    $("list").innerHTML = `<li class="empty">Couldn't load data/characters.json. Start the site with <code>python3 serve.py</code> rather than opening the file directly.</li>`;
    return;
  }
  $("q").addEventListener("input", e => { state.q = e.target.value; update(); });
  $("sort").addEventListener("change", e => { state.sort = e.target.value; update(); });
  chipGroup("mediumRow", "medium");
  chipGroup("houseRow", "house");
  $("list").addEventListener("click", e => { const b = e.target.closest("button[data-id]"); if (b) select(b.dataset.id, true); });
  addEventListener("hashchange", () => { const id = location.hash.slice(1); if (DATA.find(d => d.id === id)) select(id, false); });

  renderTally();
  const start = location.hash.slice(1);
  state.sel = DATA.find(d => d.id === start) ? start : (sorted(DATA)[0] || {}).id;
  update();
}

init();
