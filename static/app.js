"use strict";
/* Ärendehantering – webbgränssnitt (ingen extern kod) */

const S = { user: null, users: [], categories: [], priorities: [], statusList: [], statuses: [], closed: [], bookingCat: null };
function setStatuses(list) {
  S.statusList = list || [];
  S.statuses = S.statusList.map(x => x.name);
  S.closed = S.statusList.filter(x => x.closed).map(x => x.name);
}
const statusInfo = name => S.statusList.find(x => x.name === name) || { name, color: "grey", closed: 0, locked: 0 };
const statusPill = name => `<span class="spill sc-${statusInfo(name).color}">${esc(name)}</span>`;
const root = document.getElementById("root");
const $ = (sel, el = document) => el.querySelector(sel);
const $$ = (sel, el = document) => Array.from(el.querySelectorAll(sel));
const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const TZ = () => new Date().getTimezoneOffset();
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/* ---------------- ikoner ---------------- */
const ICON = {
  user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="8.5" r="4"/><path d="M4.5 20c1.2-3.6 4-5.5 7.5-5.5s6.3 1.9 7.5 5.5"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="11" fill="#0e3b2b"/><path d="M12 7v10M7 12h10" stroke="#33e3a2" stroke-width="2.4" stroke-linecap="round"/></svg>',
  plusSm: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 6v12M6 12h12"/></svg>',
  dash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M12 3 2.5 8 12 13l9.5-5L12 3Z"/><path d="m2.5 12 9.5 5 9.5-5"/><path d="m2.5 16 9.5 5 9.5-5"/></svg>',
  tickets: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M12 2.5 3 7v10l9 4.5 9-4.5V7l-9-4.5Z"/><path d="M3 7l9 4.5L21 7M12 11.5v10"/></svg>',
  customers: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-dasharray="2.2 2.2"><circle cx="12" cy="12" r="9"/></svg>',
  settings: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"/></svg>',
  up: '<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M12 3 4 12h5v9h6v-9h5z"/></svg>',
  down: '<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M12 21l8-9h-5V3H9v9H4z"/></svg>',
  ghostUp: '<svg viewBox="0 0 100 100" fill="currentColor"><path d="M50 8 8 52h26v40h32V52h26z"/></svg>',
  ghostDown: '<svg viewBox="0 0 100 100" fill="currentColor"><path d="M50 92 92 48H66V8H34v40H8z"/></svg>',
  save: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M5 3h11l3 3v15H5z"/><path d="M8 3v5h7V3M8 21v-7h8v7"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="10" fill="currentColor" stroke="none" opacity=".0"/><path d="m7 12.5 3.2 3.2L17 9"/></svg>',
  excel: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8z"/><path d="M14 3v5h5M9 12l6 6M15 12l-6 6"/></svg>',
};
const avatar = (size = "sm") => `<span class="avatar ${size}" aria-hidden="true">${ICON.user}</span>`;

/* ---------------- API ---------------- */
async function api(method, path, body) {
  const opt = { method, headers: { "X-Requested-With": "ts" }, credentials: "same-origin" };
  if (body !== undefined) { opt.headers["Content-Type"] = "application/json"; opt.body = JSON.stringify(body); }
  let res;
  try { res = await fetch(path, opt); }
  catch (e) { throw new Error("Kunde inte nå servern. Kontrollera nätverket."); }
  let data = {};
  try { data = await res.json(); } catch (e) {}
  if (res.status === 401 && !path.startsWith("/api/login")) { S.user = null; showAuth(); throw new Error(data.error || "Du är inte inloggad."); }
  if (!res.ok) throw new Error(data.error || "Något gick fel (" + res.status + ").");
  return data;
}
function qs(obj) {
  const p = new URLSearchParams();
  Object.entries(obj).forEach(([k, v]) => { if (v !== "" && v != null) p.set(k, v); });
  return p.toString();
}

let toastTimer;
function toast(msg, isError) {
  const t = $("#toast");
  t.textContent = msg; t.className = "toast" + (isError ? " error" : ""); t.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.hidden = true, isError ? 6000 : 3000);
}

/* ---------------- datum ---------------- */
const fmtDate = ts => ts ? new Intl.DateTimeFormat("sv-SE", { day: "numeric", month: "short", year: "numeric" }).format(ts * 1000) : "–";
const fmtDT = ts => ts ? new Intl.DateTimeFormat("sv-SE", { dateStyle: "medium", timeStyle: "short" }).format(ts * 1000) : "–";
const isoDay = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
function dayStart(iso) { if (!iso) return ""; const [y, m, d] = iso.split("-").map(Number); return Math.floor(new Date(y, m - 1, d).getTime() / 1000); }
function dayEnd(iso) { if (!iso) return ""; const [y, m, d] = iso.split("-").map(Number); return Math.floor(new Date(y, m - 1, d, 23, 59, 59).getTime() / 1000); }
function daysAgo(n) { const d = new Date(); d.setDate(d.getDate() - n); return isoDay(d); }

/* ---------------- lagring av filterval (per webbläsare) ---------------- */
function loadPref(key, def) { try { const v = JSON.parse(localStorage.getItem("ts." + key)); return v ? Object.assign({}, def, v) : Object.assign({}, def); } catch (e) { return Object.assign({}, def); } }
function savePref(key, v) { try { localStorage.setItem("ts." + key, JSON.stringify(v)); } catch (e) {} }

/* ---------------- inloggning ---------------- */
async function boot() {
  try {
    const st = await api("GET", "/api/status");
    S.priorities = st.priorities; setStatuses(st.status_list); S.bookingCat = st.booking_category_id || null;
    if (st.setup_needed) return showSetup();
    if (!st.user) return showAuth();
    S.user = st.user;
    await loadRefs();
    route();
  } catch (e) {
    root.innerHTML = `<div class="auth"><div class="auth-card"><h1>Servern svarar inte</h1><p>${esc(e.message)}</p><button class="btn btn-dark" onclick="location.reload()">Försök igen</button></div></div>`;
  }
}
async function loadRefs() {
  const [u, c, st] = await Promise.all([api("GET", "/api/users"), api("GET", "/api/categories"), api("GET", "/api/status")]);
  S.users = u.items; S.categories = c.items; S.bookingCat = st.booking_category_id || null; setStatuses(st.status_list);
  if (st.user) S.user = st.user;
}

function showAuth() {
  root.innerHTML = `<div class="auth"><form class="auth-card" id="login" novalidate>
    <h1>Ärendehantering</h1>
    <p>Logga in med ditt konto.</p>
    <div class="field"><label for="l-email">E-post</label><input class="input" id="l-email" type="email" autocomplete="username" required></div>
    <div class="field"><label for="l-pw">Lösenord</label><input class="input" id="l-pw" type="password" autocomplete="current-password" required></div>
    <p class="err" id="l-err" hidden></p>
    <button class="btn btn-dark" type="submit">Logga in</button>
  </form></div>`;
  $("#l-email").focus();
  $("#login").addEventListener("submit", async e => {
    e.preventDefault();
    const err = $("#l-err"); err.hidden = true;
    try {
      const r = await api("POST", "/api/login", { email: $("#l-email").value.trim(), password: $("#l-pw").value });
      S.user = r.user; await loadRefs(); route();
    } catch (ex) { err.textContent = ex.message; err.hidden = false; }
  });
}

function showSetup() {
  root.innerHTML = `<div class="auth"><form class="auth-card" id="setup" novalidate>
    <h1>Välkommen</h1>
    <p>Skapa det första kontot. Det blir administratör och kan sedan lägga till fler användare.</p>
    <div class="field"><label for="s-name">Namn</label><input class="input" id="s-name" autocomplete="name"></div>
    <div class="field"><label for="s-email">E-post</label><input class="input" id="s-email" type="email" autocomplete="username"></div>
    <div class="field"><label for="s-pw">Lösenord (minst 8 tecken)</label><input class="input" id="s-pw" type="password" autocomplete="new-password"></div>
    <div class="field"><label for="s-pw2">Upprepa lösenord</label><input class="input" id="s-pw2" type="password" autocomplete="new-password"></div>
    <p class="err" id="s-err" hidden></p>
    <button class="btn btn-dark" type="submit">Skapa konto</button>
  </form></div>`;
  $("#s-name").focus();
  $("#setup").addEventListener("submit", async e => {
    e.preventDefault();
    const err = $("#s-err"); err.hidden = true;
    if ($("#s-pw").value !== $("#s-pw2").value) { err.textContent = "Lösenorden matchar inte."; err.hidden = false; return; }
    try {
      const r = await api("POST", "/api/setup", { name: $("#s-name").value, email: $("#s-email").value, password: $("#s-pw").value });
      S.user = r.user; await loadRefs(); location.hash = "#/dashboard"; route();
    } catch (ex) { err.textContent = ex.message; err.hidden = false; }
  });
}

async function logout() {
  try { await api("POST", "/api/logout", {}); } catch (e) {}
  S.user = null; showAuth();
}

/* ---------------- skal ---------------- */
function shell(active, title, layout = "") {
  const nav = [["dashboard", "Dashboard", ICON.dash], ["tickets", "Ärenden", ICON.tickets], ["customers", "Beställare", ICON.customers], ["settings", "Inställningar", ICON.settings]];
  root.innerHTML = `<div class="shell">
    <aside class="side">
      <div class="me">${avatar("lg")}<div class="name">${esc(S.user.name)}</div><div class="role">${S.user.role === "admin" ? "Administratör" : "Handläggare"}</div></div>
      <a class="btn-new" href="#/tickets/new">${ICON.plus}Ny</a>
      <nav class="nav" aria-label="Huvudmeny">${nav.map(([k, l, i]) => `<a href="#/${k}"${k === active ? ' aria-current="page"' : ""}>${i}${l}</a>`).join("")}</nav>
      <div class="bottom"><button class="linkbtn" id="logout" type="button">Logga ut</button></div>
    </aside>
    <div class="main">
      <div class="topband"><div class="tab"><h1>${esc(title)}</h1></div></div>
      <div class="content ${layout}" id="content"></div>
    </div>
  </div>`;
  $("#logout").addEventListener("click", logout);
  document.title = title + " · Ärendehantering";
  return $("#content");
}

/* ---------------- router ---------------- */
function parseHash() {
  const h = location.hash.replace(/^#\/?/, "");
  const [path, query] = h.split("?");
  return { parts: path.split("/").filter(Boolean), query: Object.fromEntries(new URLSearchParams(query || "")) };
}
function route() {
  if (!S.user) return showAuth();
  const { parts, query } = parseHash();
  const [a, b] = parts;
  if (a === "tickets" && b === "new") return pageTicket(null, query);
  if (a === "tickets" && b) return pageTicket(Number(b), query);
  if (a === "tickets") return pageTickets(query);
  if (a === "customers") return pageCustomers(b ? Number(b) : null);
  if (a === "settings") return pageSettings();
  return pageDashboard();
}
window.addEventListener("hashchange", route);

const catOptions = (sel, allLabel) => (allLabel !== undefined ? `<option value="">${allLabel}</option>` : "") +
  S.categories.map(c => `<option value="${c.id}"${String(sel) === String(c.id) ? " selected" : ""}>${esc(c.name)}</option>`).join("");
const prioOptions = (sel, allLabel) => (allLabel !== undefined ? `<option value="">${allLabel}</option>` : "") +
  S.priorities.map(p => `<option${p === sel ? " selected" : ""}>${p}</option>`).join("");
const userOptions = (sel, firstLabel, includeInactiveId) => `<option value="">${firstLabel}</option>` +
  S.users.filter(u => u.active || u.id === includeInactiveId).map(u => `<option value="${u.id}"${String(sel) === String(u.id) ? " selected" : ""}>${esc(u.name)}${u.active ? "" : " (inaktiv)"}</option>`).join("");

/* =========================================================== DASHBOARD */
let DF = loadPref("dash", { category: "", priority: "", from: "", to: "" });
async function pageDashboard() {
  const el = shell("dashboard", "Dashboard");
  if (!DF.from) DF.from = daysAgo(6);
  if (!DF.to) DF.to = isoDay(new Date());
  el.innerHTML = `<section class="work"><h2 class="sec-title">Översikt</h2><div id="dash-body"><p class="muted">Hämtar …</p></div></section>
  <aside class="aside"><div class="filters">
    <h2>Filtrera</h2>
    <div class="field"><label for="df-cat">Kategori</label><select class="input" id="df-cat">${catOptions(DF.category, "Alla kategorier")}</select></div>
    <div class="field"><label for="df-prio">Prioritet</label><select class="input" id="df-prio">${prioOptions(DF.priority, "Alla prioriteter")}</select></div>
    <div class="field"><label for="df-from">Datumintervall</label>
      <input class="input" type="date" id="df-from" value="${DF.from}" aria-label="Från datum">
      <input class="input" type="date" id="df-to" value="${DF.to}" aria-label="Till datum"></div>
    <button class="reset" type="button" id="df-reset">Återställ filter</button>
  </div></aside>`;
  const update = () => {
    DF = { category: $("#df-cat").value, priority: $("#df-prio").value, from: $("#df-from").value, to: $("#df-to").value };
    savePref("dash", DF); loadDashboard();
  };
  ["#df-cat", "#df-prio", "#df-from", "#df-to"].forEach(s => $(s).addEventListener("change", update));
  $("#df-reset").addEventListener("click", () => { DF = { category: "", priority: "", from: "", to: "" }; savePref("dash", DF); pageDashboard(); });
  loadDashboard();
}

async function loadDashboard() {
  const body = $("#dash-body");
  if (!body) return;
  let d;
  try { d = await api("GET", "/api/dashboard?" + qs({ from: dayStart(DF.from), to: dayEnd(DF.to), tz: TZ(), category: DF.category, priority: DF.priority })); }
  catch (e) { body.innerHTML = `<p class="err">${esc(e.message)}</p>`; return; }
  const days = d.series.length;
  const card = (key, label, href) => {
    const c = d.cards[key], diff = c.period - c.previous;
    const trend = diff === 0
      ? `<span>± 0</span> vs föregående ${days} dagar`
      : `<span class="${diff > 0 ? "up" : "down"}">${diff > 0 ? ICON.up : ICON.down}<b>${Math.abs(diff)}</b></span> vs föregående ${days} dagar`;
    return `<a class="card" href="${href}"><span class="ghost">${diff > 0 ? ICON.ghostUp : ICON.ghostDown}</span>
      <div class="big">${c.value}</div><div><div class="lbl">${label}</div><div class="trend" title="Nya ärenden i perioden (${c.period}) jämfört med perioden innan (${c.previous})">${trend}</div></div></a>`;
  };
  const ring = (pct, title, desc) => {
    const r = 58, C = 2 * Math.PI * r, p = Math.max(0, Math.min(1, pct));
    return `<div class="ring"><svg viewBox="0 0 140 140" role="img" aria-label="${title}: ${Math.round(p * 100)} procent">
      <circle cx="70" cy="70" r="${r}" fill="none" stroke="#d9d8e2" stroke-width="7"/>
      <circle cx="70" cy="70" r="${r}" fill="none" stroke="var(--chart-a)" stroke-width="7" stroke-linecap="round"
        stroke-dasharray="${(C * p).toFixed(1)} ${C.toFixed(1)}" transform="rotate(-90 70 70)"${p === 0 ? ' opacity="0"' : ""}/>
      <text x="70" y="70" text-anchor="middle" dominant-baseline="central" font-size="34" fill="var(--band-2)" font-family="Barlow, Segoe UI, sans-serif">${Math.round(p * 100)}%</text></svg>
      <div><div class="t">${title}</div><div class="d">${desc}</div></div></div>`;
  };
  const ret = d.customers_total - d.customers_new;
  body.innerHTML = `
    <div class="cards">
      ${card("unassigned", "Ej tilldelade", "#/tickets?status=open&assignee=none")}
      ${card("open", "Öppna ärenden", "#/tickets?status=open")}
      ${card("high", "Hög prioritet", "#/tickets?status=open&priority=H%C3%B6g")}
    </div>
    <div class="rings">
      ${ring(d.created ? d.created_closed / d.created : 0, "Avslutade i perioden", `${(d.closed_breakdown || []).map(x => `${x.n} ${esc(x.name.toLowerCase())}`).join(", ") || "0"} av ${d.created} ärenden som skapades i perioden`)}
      ${ring(d.customers_total ? d.customers_new / d.customers_total : 0, "Nya beställare", `${d.customers_new} ${d.customers_new === 1 ? "ny beställare" : "nya beställare"}<br>${ret} återkommande`)}
    </div>
    <h2 class="sec-title">Skapade och avslutade per dag</h2>
    <div class="chart-wrap">
      <div class="legend"><span><i style="background:var(--chart-a)"></i>Skapade (${d.series.reduce((a, x) => a + x.created, 0)})</span><span><i style="background:var(--chart-b)"></i>Avslutade (${d.series.reduce((a, x) => a + x.closed, 0)})</span></div>
      <div class="chart" id="chart"></div>
      <div class="tip" id="tip" hidden></div>
    </div>`;
  drawChart(d.series);
}

function drawChart(series) {
  const host = $("#chart"); if (!host) return;
  const W = 900, H = 300, L = 40, R = 16, T = 12, B = 34;
  const n = series.length, maxV = Math.max(1, ...series.map(s => Math.max(s.created, s.closed)));
  const step = maxV <= 5 ? 1 : maxV <= 10 ? 2 : Math.ceil(maxV / 5);
  const top = Math.ceil(maxV / step) * step;
  const x = i => L + (n === 1 ? (W - L - R) / 2 : i * (W - L - R) / (n - 1));
  const y = v => T + (H - T - B) * (1 - v / top);
  const wd = new Intl.DateTimeFormat("sv-SE", { weekday: "short" });
  const label = s => { const [yy, mm, dd] = s.date.split("-").map(Number); const dt = new Date(yy, mm - 1, dd); return n <= 10 ? `${wd.format(dt)} ${dd}` : `${dd}/${mm}`; };
  const every = Math.max(1, Math.ceil(n / 10));
  let g = "";
  for (let v = 0; v <= top; v += step) g += `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="#ecebf2"/><text x="${L - 8}" y="${y(v)}" text-anchor="end" dominant-baseline="central">${v}</text>`;
  series.forEach((s, i) => { if (i % every === 0 || i === n - 1) g += `<text x="${x(i)}" y="${H - 10}" text-anchor="middle">${label(s)}</text>`; });
  const path = key => series.map((s, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(s[key]).toFixed(1)}`).join("");
  const area = key => `${path(key)}L${x(n - 1).toFixed(1)},${y(0)}L${x(0).toFixed(1)},${y(0)}Z`;
  host.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Diagram över skapade och avslutade ärenden per dag">
    ${g}
    <path d="${area("created")}" fill="var(--chart-a)" fill-opacity=".14"/>
    <path d="${area("closed")}" fill="var(--chart-b)" fill-opacity=".14"/>
    <path d="${path("created")}" fill="none" stroke="var(--chart-a)" stroke-width="2" stroke-linejoin="round"/>
    <path d="${path("closed")}" fill="none" stroke="var(--chart-b)" stroke-width="2" stroke-linejoin="round"/>
    <line id="xh" y1="${T}" y2="${y(0)}" stroke="#b9b6c9" stroke-dasharray="3 3" visibility="hidden"/>
    <circle id="da" r="4.5" fill="var(--chart-a)" stroke="#fff" stroke-width="2" visibility="hidden"/>
    <circle id="db" r="4.5" fill="var(--chart-b)" stroke="#fff" stroke-width="2" visibility="hidden"/>
    <rect id="hit" x="${L}" y="${T}" width="${W - L - R}" height="${H - T - B}" fill="transparent"/>
  </svg>`;
  const svg = $("svg", host), tip = $("#tip"), xh = $("#xh", svg), da = $("#da", svg), db = $("#db", svg);
  const longFmt = new Intl.DateTimeFormat("sv-SE", { weekday: "long", day: "numeric", month: "long" });
  const show = evt => {
    const pt = svg.getBoundingClientRect(); const sx = (evt.clientX - pt.left) * W / pt.width;
    const i = Math.max(0, Math.min(n - 1, Math.round(n === 1 ? 0 : (sx - L) / ((W - L - R) / (n - 1)))));
    const s = series[i];
    [xh, da, db].forEach(e => e.setAttribute("visibility", "visible"));
    xh.setAttribute("x1", x(i)); xh.setAttribute("x2", x(i));
    da.setAttribute("cx", x(i)); da.setAttribute("cy", y(s.created));
    db.setAttribute("cx", x(i)); db.setAttribute("cy", y(s.closed));
    const [yy, mm, dd] = s.date.split("-").map(Number);
    tip.innerHTML = `<div>${longFmt.format(new Date(yy, mm - 1, dd))}</div><div class="row"><i style="background:var(--chart-a)"></i>Skapade: ${s.created}</div><div class="row"><i style="background:var(--chart-b)"></i>Avslutade: ${s.closed}</div>`;
    tip.hidden = false;
    const wrapBox = host.parentElement.getBoundingClientRect();
    tip.style.left = Math.min(Math.max(x(i) * pt.width / W + pt.left - wrapBox.left, 70), wrapBox.width - 70) + "px";
    tip.style.top = (Math.min(y(s.created), y(s.closed)) * pt.height / H + pt.top - wrapBox.top - 10) + "px";
  };
  const hide = () => { [xh, da, db].forEach(e => e.setAttribute("visibility", "hidden")); tip.hidden = true; };
  $("#hit", svg).addEventListener("mousemove", show);
  $("#hit", svg).addEventListener("mouseleave", hide);
}

/* =========================================================== ÄRENDELISTA */
const TF_DEFAULT = { view: "open", priority: "", category: "", customer: "", assignee: "", created_from: "", created_to: "", closed_from: "", closed_to: "", q: "", sort: "date_desc" };
let TF = loadPref("tickets", TF_DEFAULT), TPAGE = 1;
const selected = new Set();
let armedBulk = null;

async function pageTickets(query) {
  if (Object.keys(query).length) {
    TF = Object.assign({}, TF_DEFAULT);
    if (query.status) TF.view = query.status;
    if (query.assignee) TF.assignee = query.assignee;
    if (query.priority) TF.priority = query.priority;
    if (query.customer) TF.customer = query.customer;
    savePref("tickets", TF); TPAGE = 1;
    history.replaceState(null, "", "#/tickets");
  }
  selected.clear(); armedBulk = null;
  const el = shell("tickets", "Ärenden");
  let customers = [];
  try { customers = (await api("GET", "/api/customers")).items; } catch (e) {}
  const views = [["open", "Öppna (ej avslutade)"], ["", "Alla utom arkiverade"], ...S.statuses.map(x => [x, x]), ["closed", "Alla avslutade"], ["archived", "Arkiverade"]];
  el.innerHTML = `<section class="work">
    <div class="toolbar">
      <label class="check"><input type="checkbox" id="sel-all"> Markera alla</label>
      <select class="sortsel" id="b-status" disabled aria-label="Ändra status på markerade"><option value="">Ändra status …</option>${S.statuses.map(x => `<option>${esc(x)}</option>`).join("")}</select>
      <button class="textbtn" id="b-archive" type="button" disabled>Arkivera</button>
      <button class="textbtn danger" id="b-delete" type="button" disabled>Ta bort</button>
      <label class="check">Sortera:
        <select class="sortsel" id="t-sort">
          ${[["date_desc", "Datum, nyast"], ["date_asc", "Datum, äldst"], ["priority", "Prioritet"], ["status", "Status"], ["updated", "Senast ändrad"]].map(([v, l]) => `<option value="${v}"${TF.sort === v ? " selected" : ""}>${l}</option>`).join("")}
        </select></label>
      <span class="grow"></span>
      <input class="input search" id="t-q" type="search" placeholder="Sök ärende, beställare eller nummer" value="${esc(TF.q)}" aria-label="Sök">
      <div class="pager" id="pager"></div>
    </div>
    <div class="tlist" id="tlist"><p class="muted">Hämtar …</p></div>
    <div class="bulkbar">
      <button class="btn" id="b-archive-all" type="button"></button>
      <a class="btn" href="/api/export.xlsx?tz=${TZ()}">${ICON.excel}Exportera till Excel</a>
    </div>
  </section>
  <aside class="aside"><div class="filters">
    <h2>Filtrera ärenden</h2>
    <div class="field"><label for="f-cat">Kategori</label><select class="input" id="f-cat"><option value="">Alla</option><option value="none"${TF.category === "none" ? " selected" : ""}>Utan kategori</option>${catOptions(TF.category)}</select></div>
    <div class="field"><label for="f-view">Status</label><select class="input" id="f-view">${views.map(([v, l]) => `<option value="${v}"${TF.view === v ? " selected" : ""}>${l}</option>`).join("")}</select></div>
    <div class="field"><label for="f-prio">Prioritet</label><select class="input" id="f-prio">${prioOptions(TF.priority, "Alla")}</select></div>
    <div class="field"><label for="f-cust">Beställare</label><select class="input" id="f-cust"><option value="">Alla</option>${customers.map(c => `<option value="${c.id}"${String(TF.customer) === String(c.id) ? " selected" : ""}>${esc(c.name)}${c.company ? " – " + esc(c.company) : ""}</option>`).join("")}</select></div>
    <div class="field"><label for="f-ass">Handläggare</label><select class="input" id="f-ass"><option value="">Alla</option><option value="none"${TF.assignee === "none" ? " selected" : ""}>Ej tilldelad</option>${S.users.map(u => `<option value="${u.id}"${String(TF.assignee) === String(u.id) ? " selected" : ""}>${esc(u.name)}</option>`).join("")}</select></div>
    <div class="field"><span class="label">Skapad mellan</span><div class="pair">
      <input class="input" type="date" id="f-cf" value="${TF.created_from}" aria-label="Skapad från">
      <input class="input" type="date" id="f-ct" value="${TF.created_to}" aria-label="Skapad till"></div></div>
    <div class="field"><span class="label">Avslutad mellan</span><div class="pair">
      <input class="input" type="date" id="f-xf" value="${TF.closed_from}" aria-label="Avslutad från">
      <input class="input" type="date" id="f-xt" value="${TF.closed_to}" aria-label="Avslutad till"></div></div>
    <button class="reset" type="button" id="f-reset">Rensa filter</button>
  </div></aside>`;

  const readFilters = () => {
    TF = Object.assign(TF, { category: $("#f-cat").value, view: $("#f-view").value, priority: $("#f-prio").value, customer: $("#f-cust").value,
      assignee: $("#f-ass").value, created_from: $("#f-cf").value, created_to: $("#f-ct").value, closed_from: $("#f-xf").value, closed_to: $("#f-xt").value,
      sort: $("#t-sort").value });
    savePref("tickets", TF); TPAGE = 1; loadTickets();
  };
  ["#f-cat", "#f-view", "#f-prio", "#f-cust", "#f-ass", "#f-cf", "#f-ct", "#f-xf", "#f-xt", "#t-sort"].forEach(s => $(s).addEventListener("change", readFilters));
  let qTimer; $("#t-q").addEventListener("input", e => { clearTimeout(qTimer); qTimer = setTimeout(() => { TF.q = e.target.value; savePref("tickets", TF); TPAGE = 1; loadTickets(); }, 250); });
  $("#f-reset").addEventListener("click", () => { TF = Object.assign({}, TF_DEFAULT); savePref("tickets", TF); TPAGE = 1; pageTickets({}); });
  $("#sel-all").addEventListener("change", e => { $$(".rowsel").forEach(c => { c.checked = e.target.checked; c.checked ? selected.add(+c.value) : selected.delete(+c.value); }); updateBulk(); });

  const bulk = async (action, btn, label) => {
    if (action === "delete" && armedBulk !== "delete") { armedBulk = "delete"; btn.classList.add("armed"); btn.textContent = `Bekräfta: ta bort ${selected.size}`; return; }
    try {
      const r = await api("POST", "/api/tickets/bulk", { ids: [...selected], action });
      toast(`${r.changed} ${r.changed === 1 ? "ärende" : "ärenden"} ${label}.`);
      selected.clear(); armedBulk = null; loadTickets();
    } catch (e) { toast(e.message, true); }
  };
  $("#b-status").addEventListener("change", async e => {
    const st = e.target.value; if (!st) return;
    try {
      const r = await api("POST", "/api/tickets/bulk", { ids: [...selected], action: "status", status: st });
      const skipped = selected.size - r.changed;
      toast(`${r.changed} ${r.changed === 1 ? "ärende" : "ärenden"} fick status ${st}.` + (skipped ? ` ${skipped} ändrades inte (hade redan statusen eller är låsta).` : ""));
      selected.clear(); loadTickets();
    } catch (ex) { toast(ex.message, true); }
    e.target.value = "";
  });
  $("#b-archive").addEventListener("click", e => bulk("archive", e.target, "arkiverades"));
  $("#b-delete").addEventListener("click", e => bulk("delete", e.target, "togs bort"));
  $("#b-archive-all").addEventListener("click", async e => {
    const btn = e.currentTarget;
    if (!btn.classList.contains("armed")) { btn.classList.add("armed", "btn-dark"); btn.textContent = "Bekräfta arkivering"; return; }
    try { const r = await api("POST", "/api/tickets/archive-closed", {}); toast(`${r.archived} ${r.archived === 1 ? "ärende" : "ärenden"} arkiverades.`); loadTickets(); }
    catch (ex) { toast(ex.message, true); }
  });
  loadTickets();
}

function ticketQuery(extra = {}) {
  const q = { priority: TF.priority, category: TF.category, customer: TF.customer, assignee: TF.assignee,
    created_from: dayStart(TF.created_from), created_to: dayEnd(TF.created_to), closed_from: dayStart(TF.closed_from), closed_to: dayEnd(TF.closed_to),
    q: TF.q, sort: TF.sort, page: TPAGE };
  if (TF.view === "archived") q.archived = "1";
  else if (TF.view === "open") q.status = "open";
  else if (TF.view) q.status = TF.view;
  return qs(Object.assign(q, extra));
}

function updateBulk() {
  const n = selected.size;
  ["#b-status", "#b-archive", "#b-delete"].forEach(s => { const b = $(s); if (b) b.disabled = !n; });
  const del = $("#b-delete");
  if (del && armedBulk !== "delete") { del.classList.remove("armed"); del.textContent = n ? `Ta bort (${n})` : "Ta bort"; }
  const all = $$(".rowsel"); const sa = $("#sel-all");
  if (sa) { sa.checked = all.length > 0 && all.every(c => c.checked); sa.indeterminate = n > 0 && !sa.checked; }
}

async function loadTickets() {
  const list = $("#tlist"); if (!list) return;
  let r, closedCount = 0;
  try {
    [r, closedCount] = await Promise.all([
      api("GET", "/api/tickets?" + ticketQuery()),
      api("GET", "/api/tickets?" + qs({ status: "closed", page: 1 })).then(x => x.total)
    ]);
  } catch (e) { list.innerHTML = `<p class="err">${esc(e.message)}</p>`; return; }
  const ab = $("#b-archive-all");
  ab.classList.remove("armed", "btn-dark");
  ab.textContent = `Arkivera alla avslutade (${closedCount})`;
  ab.disabled = !closedCount;

  const pages = Math.max(1, Math.ceil(r.total / r.page_size));
  if (TPAGE > pages) { TPAGE = pages; return loadTickets(); }
  const first = r.total ? (r.page - 1) * r.page_size + 1 : 0, last = Math.min(r.total, r.page * r.page_size);
  $("#pager").innerHTML = `<span>${first}–${last} av ${r.total}</span>
    <button type="button" data-p="1" ${TPAGE <= 1 ? "disabled" : ""} aria-label="Första sidan">«</button>
    <button type="button" data-p="${TPAGE - 1}" ${TPAGE <= 1 ? "disabled" : ""} aria-label="Föregående sida">‹</button>
    <button type="button" data-p="${TPAGE + 1}" ${TPAGE >= pages ? "disabled" : ""} aria-label="Nästa sida">›</button>
    <button type="button" data-p="${pages}" ${TPAGE >= pages ? "disabled" : ""} aria-label="Sista sidan">»</button>`;
  $$("#pager button").forEach(b => b.addEventListener("click", () => { TPAGE = +b.dataset.p; selected.clear(); loadTickets(); }));

  if (!r.items.length) {
    list.innerHTML = `<div class="empty">${TF.q || TF.view !== "open" || TF.priority || TF.category || TF.customer || TF.assignee || TF.created_from || TF.created_to || TF.closed_from || TF.closed_to
      ? "Inga ärenden matchar filtret." : 'Inga öppna ärenden. Skapa ett nytt med knappen <b>Ny</b>.'}</div>`;
    updateBulk(); return;
  }
  list.innerHTML = r.items.map(t => `<div class="trow">
      <input type="checkbox" class="rowsel" value="${t.id}" aria-label="Markera ärende ${t.id}"${selected.has(t.id) ? " checked" : ""}>
      <span class="av">${avatar("md")}</span>
      <div class="tmain" style="min-width:0">
        <div class="who">${esc(t.customer_name || "Ingen beställare")}${t.customer_company ? ` <span class="muted">· ${esc(t.customer_company)}</span>` : ""}</div>
        <a class="ttl" href="#/tickets/${t.id}">${esc(t.title)}</a>
        <div class="sub"><span class="id">#${t.id}</span><span>${esc(t.category || "Ingen kategori")}</span><span class="ag">${t.assignee_name ? esc(t.assignee_name) : "Ej tilldelad"}</span>${t.archived_at ? "<span>Arkiverad</span>" : ""}</div>
      </div>
      <span class="date">${fmtDate(t.created_at)}</span>
      <select class="inline-sel" data-id="${t.id}" data-f="priority" aria-label="Prioritet för ärende ${t.id}">${S.priorities.map(p => `<option${p === t.priority ? " selected" : ""}>${p}</option>`).join("")}</select>
      <select class="inline-sel st sc-${statusInfo(t.status).color}" data-id="${t.id}" data-f="status" aria-label="Status för ärende ${t.id}"${statusInfo(t.status).locked && S.user.role !== "admin" ? ' disabled title="Låst status – kan inte öppnas igen"' : ""}>${S.statuses.map(s => `<option${s === t.status ? " selected" : ""}>${esc(s)}</option>`).join("")}</select>
    </div>`).join("");
  $$(".rowsel", list).forEach(c => c.addEventListener("change", () => { c.checked ? selected.add(+c.value) : selected.delete(+c.value); armedBulk = null; updateBulk(); }));
  $$(".inline-sel", list).forEach(s => s.addEventListener("change", async () => {
    try { await api("PUT", "/api/tickets/" + s.dataset.id, { [s.dataset.f]: s.value }); toast(`Ärende #${s.dataset.id} uppdaterat.`); loadTickets(); }
    catch (e) { toast(e.message, true); loadTickets(); }
  }));
  updateBulk();
}

/* =========================================================== NYTT / VISA ÄRENDE */
async function pageTicket(id, query) {
  const el = shell("tickets", id ? "Ärende" : "Nytt ärende");
  let t = { title: "", details: "", priority: "Medium", category_id: "", assignee_id: "", status: "Ny", customer_id: query.customer ? Number(query.customer) : null };
  if (id) {
    try { t = await api("GET", "/api/tickets/" + id); }
    catch (e) { el.innerHTML = `<section class="work"><p class="err">${esc(e.message)}</p><p><a href="#/tickets">Tillbaka till ärenden</a></p></section>`; return; }
  }
  let customers = [];
  try { customers = (await api("GET", "/api/customers")).items; } catch (e) {}
  let custId = t.customer_id, custQ = "", addingCustomer = false, armedDel = false;

  el.innerHTML = `<section class="work"><form class="tform" id="tform" novalidate>
      <div class="head"><h2>${id ? "Ärendedetaljer" : "Nytt ärende"}</h2><span class="num">${id ? "# " + id : ""}</span></div>
      <div class="grid">
        <div class="field"><label for="t-title">Titel</label><input class="input" id="t-title" maxlength="200" value="${esc(t.title)}" placeholder="Kort sammanfattning"></div>
        <div class="field"><label for="t-prio">Prioritet</label><select class="input" id="t-prio">${prioOptions(t.priority)}</select></div>
        <div class="field"><label for="t-cat">Kategori</label><select class="input" id="t-cat"><option value="">Ingen kategori</option>${catOptions(t.category_id)}</select></div>
        <div class="field"><label for="t-ass">Handläggare</label><select class="input" id="t-ass">${userOptions(t.assignee_id, "Ej tilldelad", t.assignee_id)}</select></div>
        ${id ? `<div class="field"><label for="t-status">Status</label><select class="input" id="t-status"${t.status_locked && S.user.role !== "admin" ? " disabled" : ""}>${S.statuses.map(s => `<option${s === t.status ? " selected" : ""}>${esc(s)}</option>`).join("")}</select>
            ${t.status_locked ? `<span class="muted" style="font-size:.85rem">${S.user.role === "admin" ? "Låst status. Bara administratörer kan öppna ärendet igen." : "Låst status. Ärendet kan inte öppnas igen."}</span>` : ""}</div>`
             : `<div class="field"><span class="label">Datum</span><div class="input" style="display:flex;align-items:center">${fmtDate(Date.now() / 1000)}</div></div>`}
      </div>
      <div id="booking" class="booking" hidden></div>
      <div class="field"><label for="t-details">Detaljer</label><textarea class="input" id="t-details" placeholder="Beskriv ärendet: vad har hänt, ordernummer, artikel …">${esc(t.details)}</textarea></div>
      ${id ? `<div class="meta"><span>Skapat ${fmtDT(t.created_at)}${t.created_by_name ? " av " + esc(t.created_by_name) : ""}</span><span>Senast ändrat ${fmtDT(t.updated_at)}</span>${t.closed_at ? `<span>Avslutat ${fmtDT(t.closed_at)}</span>` : ""}${t.archived_at ? `<span>Arkiverat ${fmtDT(t.archived_at)}</span>` : ""}</div>` : ""}
      ${id ? `<section class="comments" aria-labelledby="c-h">
        <h3 id="c-h">Kommentarer</h3>
        <div id="c-list"></div>
        <div class="c-new">
          <label for="c-body" class="label">Ny kommentar</label>
          <textarea class="input" id="c-body" rows="3" placeholder="Skriv en kommentar …"></textarea>
          <div><button type="button" class="btn btn-dark" id="c-add">Lägg till kommentar</button></div>
        </div>
      </section>` : ""}
      <div class="foot">
        <div class="right"><a class="textbtn" href="#/tickets">Avbryt</a>${id ? `<button type="button" class="btn btn-danger" id="t-del">Ta bort ärende</button>` : ""}</div>
        <div class="right"><span class="muted" id="t-missing"></span><button type="submit" class="btn btn-dark" id="t-save">${ICON.save}Spara</button></div>
      </div>
    </form></section>
    <aside class="aside" id="cust-aside"></aside>`;

  const renderAside = () => {
    const a = $("#cust-aside");
    if (addingCustomer) {
      a.innerHTML = `<h2>Ny beställare</h2>${customerForm({}, "nc")}`;
      bindCustomerForm(a, "nc", null, async c => { customers.push(c); custId = c.id; addingCustomer = false; renderAside(); validate(); toast(`${c.name} lades till.`); },
        () => { addingCustomer = false; renderAside(); });
      return;
    }
    const sel = customers.find(c => c.id === custId);
    const q = custQ.trim().toLowerCase();
    const matches = customers.filter(c => !q || [c.name, c.company, c.email, c.phone].join(" ").toLowerCase().includes(q)).slice(0, 50);
    a.innerHTML = `<h2>Koppla beställare</h2>
      ${sel ? `<div class="sel-cust">${avatar("sm")}<div style="min-width:0"><div class="n">${esc(sel.name)}</div><div class="c">${esc([sel.company, sel.phone, sel.email].filter(Boolean).join(" · "))}</div></div></div>` : `<p class="muted" style="margin:0 0 14px">Ingen beställare vald ännu.</p>`}
      <input class="searchpill" id="c-q" type="search" placeholder="Sök beställare" value="${esc(custQ)}" aria-label="Sök beställare">
      <div class="or-add">eller <button type="button" id="c-add">Lägg till ny</button></div>
      <div class="clist">${matches.length ? matches.map(c => `<button type="button" class="citem" data-id="${c.id}" aria-pressed="${c.id === custId}">${avatar("sm")}<span style="min-width:0"><span class="n">${esc(c.name)}</span><br><span class="c">${esc(c.company || c.email || "")}</span></span></button>`).join("")
        : `<p class="muted">${customers.length ? "Ingen beställare matchar sökningen." : "Inga beställare ännu. Lägg till den första."}</p>`}</div>`;
    const qi = $("#c-q");
    qi.addEventListener("input", () => { custQ = qi.value; const pos = qi.selectionStart; renderAside(); const n = $("#c-q"); n.focus(); n.setSelectionRange(pos, pos); });
    $("#c-add").addEventListener("click", () => { addingCustomer = true; renderAside(); });
    $$(".citem", a).forEach(b => b.addEventListener("click", () => { custId = +b.dataset.id; renderAside(); validate(); }));
  };

  const validate = () => {
    const miss = [];
    if (!$("#t-title").value.trim()) miss.push("titel");
    if (!custId) miss.push("beställare");
    $("#t-save").disabled = miss.length > 0;
    $("#t-missing").textContent = miss.length ? "Ange " + miss.join(" och ") + " för att spara." : "";
  };
  $("#t-title").addEventListener("input", validate);
  const renderBooking = () => {
    const box = $("#booking");
    if (!S.bookingCat || String($("#t-cat").value) !== String(S.bookingCat)) { box.hidden = true; return; }
    const u = S.users.find(x => String(x.id) === $("#t-ass").value);
    let inner;
    if (!u) inner = `<p>Välj en handläggare för att kunna boka en tid.</p>`;
    else if (!u.booking_url) inner = `<p>${esc(u.name)} har ingen bokningssida inlagd. Den läggs in under Inställningar.</p>`;
    else inner = `<a class="btn btn-mint" href="${esc(u.booking_url)}" target="_blank" rel="noopener">${ICON.plusSm}Boka tid hos ${esc(u.name)}</a>
      <p>Bokningen görs i Microsoft Bookings och öppnas i en ny flik.</p>`;
    box.innerHTML = `<h3>IT-support: boka tid</h3>${inner}`;
    box.hidden = false;
  };
  $("#t-cat").addEventListener("change", renderBooking);
  $("#t-ass").addEventListener("change", renderBooking);
  renderBooking();
  renderAside(); validate();
  if (!id) $("#t-title").focus();

  const renderComments = list => {
    const box = $("#c-list"); if (!box) return;
    box.innerHTML = list.length ? list.map(c => `<article class="comment">
        <div class="c-meta"><b>${esc(c.author || "Okänd")}</b><span>${fmtDT(c.created_at)}</span>
          ${c.user_id === S.user.id || S.user.role === "admin" ? `<button type="button" class="textbtn danger c-del" data-id="${c.id}">Ta bort</button>` : ""}</div>
        <div class="c-body">${esc(c.body)}</div></article>`).join("") : `<p class="muted" style="margin:0">Inga kommentarer ännu.</p>`;
    $$(".c-del", box).forEach(b => b.addEventListener("click", async () => {
      if (!b.classList.contains("armed")) { b.classList.add("armed"); b.textContent = "Bekräfta"; return; }
      try { renderComments((await api("DELETE", "/api/comments/" + b.dataset.id)).comments); } catch (ex) { toast(ex.message, true); }
    }));
  };
  if (id) {
    renderComments(t.comments || []);
    $("#c-add").addEventListener("click", async () => {
      const body = $("#c-body").value.trim();
      if (!body) { $("#c-body").focus(); return; }
      try { renderComments((await api("POST", `/api/tickets/${id}/comments`, { body })).comments); $("#c-body").value = ""; toast("Kommentaren sparades."); }
      catch (ex) { toast(ex.message, true); }
    });
  }

  if (id) $("#t-del").addEventListener("click", async e => {
    const b = e.currentTarget;
    if (!armedDel) { armedDel = true; b.classList.add("armed"); b.textContent = "Bekräfta: ta bort"; return; }
    try { await api("DELETE", "/api/tickets/" + id); toast(`Ärende #${id} togs bort.`); location.hash = "#/tickets"; }
    catch (ex) { toast(ex.message, true); }
  });

  $("#tform").addEventListener("submit", async e => {
    e.preventDefault();
    validate(); if ($("#t-save").disabled) return;
    const data = { title: $("#t-title").value, details: $("#t-details").value, priority: $("#t-prio").value,
      category_id: $("#t-cat").value || null, assignee_id: $("#t-ass").value || null, customer_id: custId };
    if (id && !$("#t-status").disabled) data.status = $("#t-status").value;
    $("#t-save").disabled = true;
    try {
      if (id) { const r = await api("PUT", "/api/tickets/" + id, data); toast("Ärendet sparades." + notifyText(r)); pageTicket(id, {}); }
      else { const r = await api("POST", "/api/tickets", data); toast(`Ärende #${r.id} skapades.` + notifyText(r)); location.hash = "#/tickets"; }
    } catch (ex) { toast(ex.message, true); validate(); }
  });
}

function notifyText(r) {
  if (!r || !r.notify) return "";
  return r.notify.sent ? ` Mail skickas till ${r.notify.to}.` : ` Inget mail skickades: ${r.notify.reason}`;
}

/* ---------------- beställarformulär (används på flera ställen) ---------------- */
function customerForm(c, p) {
  const f = (k, label, type = "text", ac = "") => `<input class="input" id="${p}-${k}" type="${type}" value="${esc(c[k] || "")}" placeholder="${label}" aria-label="${label}"${ac ? ` autocomplete="${ac}"` : ""}>`;
  return `<form class="pform" id="${p}-form" novalidate>
    <h3>Personligt</h3>${f("first_name", "Förnamn")}${f("last_name", "Efternamn")}
    <h3>Företag</h3>${f("company", "Företag")}${f("title", "Titel")}
    <h3>Kontakt</h3>${f("phone", "Telefon", "tel")}${f("email", "E-post", "email")}
    <p class="err" id="${p}-err" hidden></p>
    <div class="actions"><button type="button" class="textbtn" id="${p}-cancel">Avbryt</button><button type="submit" class="btn btn-dark">${ICON.check}Spara</button></div>
  </form>`;
}
function bindCustomerForm(scope, p, existingId, onSaved, onCancel) {
  $(`#${p}-cancel`, scope).addEventListener("click", onCancel);
  const first = $(`#${p}-first_name`, scope); first.focus();
  $(`#${p}-form`, scope).addEventListener("submit", async e => {
    e.preventDefault();
    const data = {}; ["first_name", "last_name", "company", "title", "phone", "email"].forEach(k => data[k] = $(`#${p}-${k}`, scope).value.trim());
    const err = $(`#${p}-err`, scope); err.hidden = true;
    if (!data.first_name) { err.textContent = "Ange förnamn."; err.hidden = false; first.setAttribute("aria-invalid", "true"); return; }
    if (data.email && !EMAIL_RE.test(data.email)) { err.textContent = "E-postadressen ser inte giltig ut."; err.hidden = false; return; }
    try { const c = await api(existingId ? "PUT" : "POST", "/api/customers" + (existingId ? "/" + existingId : ""), data); onSaved(c); }
    catch (ex) { err.textContent = ex.message; err.hidden = false; }
  });
}

/* =========================================================== KUNDER */
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZÅÄÖ".split("");
async function pageCustomers(selId) {
  const el = shell("customers", "Beställare", "dark-aside");
  let customers = [], q = "", sel = selId, editing = false, creating = false;
  const csel = new Set(); let armedDel = false;
  el.innerHTML = `<section class="work">
      <div class="toolbar">
        <label class="check"><input type="checkbox" id="cs-all"> Markera alla</label>
        <button class="textbtn danger" id="cs-del" type="button" disabled>Ta bort</button>
        <span class="grow"></span>
        <input class="input search" id="cs-q" type="search" placeholder="Sök namn, företag, telefon" aria-label="Sök beställare">
        <button class="btn btn-mint" id="cs-new" type="button">${ICON.plusSm}Ny beställare</button>
      </div>
      <div class="cwrap"><nav class="letters" id="letters" aria-label="Hoppa till bokstav"></nav><div class="tscroll" id="ctable"></div></div>
    </section>
    <aside class="aside dark cdetail" id="cdetail"></aside>`;

  const letterOf = c => ((c.last_name || c.first_name || "?").trim()[0] || "?").toUpperCase();
  const sorted = () => customers.slice().sort((a, b) => (a.last_name || a.first_name).localeCompare(b.last_name || b.first_name, "sv") || a.first_name.localeCompare(b.first_name, "sv"));

  const renderTable = () => {
    const ql = q.trim().toLowerCase();
    const list = sorted().filter(c => !ql || [c.name, c.company, c.phone, c.email].join(" ").toLowerCase().includes(ql));
    const groups = {};
    list.forEach(c => (groups[letterOf(c)] = groups[letterOf(c)] || []).push(c));
    $("#letters").innerHTML = ALPHABET.map(l => `<button type="button" class="${groups[l] ? "has" : ""}" ${groups[l] ? `data-l="${l}"` : "disabled"}>${l}</button>`).join("");
    $$("#letters button[data-l]").forEach(b => b.addEventListener("click", () => { const g = $("#grp-" + b.dataset.l); if (g) g.scrollIntoView({ behavior: "smooth", block: "start" }); }));
    if (!list.length) { $("#ctable").innerHTML = `<div class="empty">${customers.length ? "Ingen beställare matchar sökningen." : "Inga beställare ännu. Klicka <b>Ny beställare</b> för att lägga till den första."}</div>`; updateSel(); return; }
    const keys = Object.keys(groups).sort((a, b) => a.localeCompare(b, "sv"));
    $("#ctable").innerHTML = `<table class="ctable"><thead><tr><th class="w-check"></th><th class="w-av"></th><th>Namn</th><th>Företag</th><th>Telefon</th><th>Öppna ärenden</th></tr></thead><tbody>
      ${keys.map(k => `<tr class="grp" id="grp-${esc(k)}"><td colspan="6"><span class="grp-badge">${esc(k)}</span></td></tr>` +
        groups[k].map(c => `<tr class="crow" data-id="${c.id}" aria-selected="${c.id === sel}">
          <td><input type="checkbox" class="csel" value="${c.id}" aria-label="Markera ${esc(c.name)}"${csel.has(c.id) ? " checked" : ""}></td>
          <td>${avatar("sm")}</td><td>${esc(c.name)}</td><td>${esc(c.company)}</td><td>${esc(c.phone)}</td><td>${c.open_count || 0}</td></tr>`).join("")).join("")}
      </tbody></table>`;
    $$(".crow").forEach(r => r.addEventListener("click", e => {
      if (e.target.closest("input")) return;
      sel = +r.dataset.id; editing = false; creating = false;
      history.replaceState(null, "", "#/customers/" + sel);
      $$(".crow").forEach(x => x.setAttribute("aria-selected", String(+x.dataset.id === sel)));
      renderDetail();
    }));
    $$(".csel").forEach(c => c.addEventListener("change", () => { c.checked ? csel.add(+c.value) : csel.delete(+c.value); armedDel = false; updateSel(); }));
    updateSel();
  };
  const updateSel = () => {
    const b = $("#cs-del"); b.disabled = !csel.size;
    if (!armedDel) { b.classList.remove("armed"); b.textContent = csel.size ? `Ta bort (${csel.size})` : "Ta bort"; }
    const all = $$(".csel"); $("#cs-all").checked = all.length > 0 && all.every(c => c.checked);
  };

  const renderDetail = async () => {
    const a = $("#cdetail");
    if (creating) {
      a.innerHTML = `<div class="hd"><h2>Ny beställare</h2></div><div style="height:20px"></div>${customerForm({}, "cc")}`;
      bindCustomerForm(a, "cc", null, async c => { creating = false; sel = c.id; await reload(); toast(`${c.name} lades till.`); }, () => { creating = false; renderDetail(); });
      return;
    }
    if (!sel) { a.innerHTML = `<div class="hd"><h2>Beställardetaljer</h2></div><p class="placeholder" style="margin-top:24px">Välj en beställare i listan för att se kontaktuppgifter och ärenden.</p>`; return; }
    let c;
    try { c = await api("GET", "/api/customers/" + sel); } catch (e) { a.innerHTML = `<p class="placeholder">${esc(e.message)}</p>`; return; }
    if (editing) {
      a.innerHTML = `<div class="hd"><h2>Redigera beställare</h2></div><div style="height:20px"></div>${customerForm(c, "ce")}`;
      bindCustomerForm(a, "ce", c.id, async () => { editing = false; await reload(); toast("Beställaren sparades."); }, () => { editing = false; renderDetail(); });
      return;
    }
    a.innerHTML = `<div class="hd"><h2>Beställardetaljer</h2></div>
      <div class="links"><button type="button" id="cd-edit">Redigera</button><button type="button" id="cd-close">Stäng</button></div>
      ${avatar("lg")}
      <div class="nm">${esc(c.name)}</div>
      <div class="co">${esc([c.company, c.title].filter(Boolean).join(", ")) || "&nbsp;"}</div>
      <div class="ct">${c.phone ? `<span>${esc(c.phone)}</span>` : ""}${c.email ? `<span>${esc(c.email)}</span>` : ""}${!c.phone && !c.email ? "<span>Inga kontaktuppgifter</span>" : ""}</div>
      <div class="rt"><h3>Senaste ärenden</h3><a class="btn btn-mint" href="#/tickets/new?customer=${c.id}">${ICON.plusSm}Nytt</a></div>
      ${c.tickets.length ? c.tickets.map(t => `<a class="rtc" href="#/tickets/${t.id}"><div class="top"><span>#${t.id} · ${esc(t.status)}${t.archived_at ? " · arkiverat" : ""}</span><span>${fmtDate(t.created_at)}</span></div>
        <div class="t">${esc(t.title)}</div>${t.details ? `<div class="d">${esc(t.details)}</div>` : ""}</a>`).join("") : `<p class="placeholder">Inga ärenden ännu.</p>`}`;
    $("#cd-edit").addEventListener("click", () => { editing = true; renderDetail(); });
    $("#cd-close").addEventListener("click", () => { sel = null; history.replaceState(null, "", "#/customers"); $$(".crow").forEach(x => x.setAttribute("aria-selected", "false")); renderDetail(); });
  };

  const reload = async () => {
    try { customers = (await api("GET", "/api/customers")).items; } catch (e) { $("#ctable").innerHTML = `<p class="err">${esc(e.message)}</p>`; return; }
    renderTable(); renderDetail();
  };
  $("#cs-q").addEventListener("input", e => { q = e.target.value; renderTable(); });
  $("#cs-new").addEventListener("click", () => { creating = true; editing = false; renderDetail(); });
  $("#cs-all").addEventListener("change", e => { $$(".csel").forEach(c => { c.checked = e.target.checked; c.checked ? csel.add(+c.value) : csel.delete(+c.value); }); armedDel = false; updateSel(); });
  $("#cs-del").addEventListener("click", async e => {
    const b = e.currentTarget;
    if (!armedDel) { armedDel = true; b.classList.add("armed"); b.textContent = `Bekräfta: ta bort ${csel.size}`; return; }
    try {
      const r = await api("POST", "/api/customers/delete", { ids: [...csel] });
      let msg = `${r.deleted} ${r.deleted === 1 ? "beställare togs" : "beställare togs"} bort.`;
      if (r.blocked) msg += ` ${r.blocked} ${r.blocked === 1 ? "beställare har" : "beställare har"} ärenden och togs inte bort.`;
      toast(msg, r.blocked > 0 && !r.deleted);
      if (csel.has(sel)) sel = null;
      csel.clear(); armedDel = false; reload();
    } catch (ex) { toast(ex.message, true); }
  });
  reload();
}

/* =========================================================== INSTÄLLNINGAR */
async function pageSettings() {
  const el = shell("settings", "Inställningar", "single");
  const admin = S.user.role === "admin";
  let editUser = null, addingUser = false, editCat = null, armedCat = null;
  el.innerHTML = `<section class="work"><div class="settings">
    <div style="display:flex;flex-direction:column;gap:28px">
      ${admin ? `<div class="box" id="box-users"></div>` : ""}
      <div class="box"><h2>Mitt konto</h2><p class="lead">${esc(S.user.name)} · ${esc(S.user.email)}</p>
        <form id="bk-form" class="pform" novalidate>
          <h3>Min bokningssida</h3>
          <p class="muted" style="margin:0">Länken till din sida i Microsoft Bookings. Den visas i ärenden med kategorin för tidsbokning.</p>
          <input class="input" type="url" id="bk-url" placeholder="https://outlook.office365.com/book/…" aria-label="Bokningssida" value="${esc(S.user.booking_url || "")}">
          <p class="err" id="bk-err" hidden></p>
          <div class="actions"><span></span><button class="btn btn-dark" type="submit">Spara bokningssida</button></div>
        </form>
        <form id="pw-form" class="pform" novalidate style="margin-top:22px">
          <h3>Byt lösenord</h3>
          <input class="input" type="password" id="pw-cur" placeholder="Nuvarande lösenord" aria-label="Nuvarande lösenord" autocomplete="current-password">
          <input class="input" type="password" id="pw-new" placeholder="Nytt lösenord (minst 8 tecken)" aria-label="Nytt lösenord" autocomplete="new-password">
          <input class="input" type="password" id="pw-new2" placeholder="Upprepa nytt lösenord" aria-label="Upprepa nytt lösenord" autocomplete="new-password">
          <p class="err" id="pw-err" hidden></p>
          <div class="actions"><span></span><button class="btn btn-dark" type="submit">Byt lösenord</button></div>
        </form></div>
    </div>
    <div style="display:flex;flex-direction:column;gap:28px">
      ${admin ? `<div class="box" id="box-status"></div><div class="box" id="box-mail"></div><div class="box" id="box-cats"></div>` : ""}
      <div class="box"><h2>Export</h2><p class="lead">Ladda ner alla ärenden, arkivet, beställarregistret och kommentarerna som en Excel-fil.</p>
        <a class="btn" href="/api/export.xlsx?tz=${TZ()}">${ICON.excel}Exportera till Excel</a></div>
      ${admin ? `<div class="box"><h2>Säkerhetskopia</h2><p class="lead">Ladda ner en kopia av hela databasen. Spara den på ett säkert ställe.</p>
        <a class="btn" href="/api/backup.db">${ICON.save}Ladda ner säkerhetskopia</a></div>` : ""}
    </div>
  </div></section>`;

  $("#bk-form").addEventListener("submit", async e => {
    e.preventDefault();
    const err = $("#bk-err"); err.hidden = true;
    try { S.user = await api("PUT", "/api/me", { booking_url: $("#bk-url").value.trim() }); await loadRefs(); toast("Bokningssidan sparades."); }
    catch (ex) { err.textContent = ex.message; err.hidden = false; }
  });
  $("#pw-form").addEventListener("submit", async e => {
    e.preventDefault();
    const err = $("#pw-err"); err.hidden = true;
    if ($("#pw-new").value !== $("#pw-new2").value) { err.textContent = "De nya lösenorden matchar inte."; err.hidden = false; return; }
    try { await api("POST", "/api/me/password", { current: $("#pw-cur").value, new: $("#pw-new").value }); e.target.reset(); toast("Lösenordet byttes."); }
    catch (ex) { err.textContent = ex.message; err.hidden = false; }
  });
  if (!admin) return;

  const userForm = (u, p) => `<form class="inline-form" id="${p}" novalidate>
    <input class="input" id="${p}-name" placeholder="Namn" aria-label="Namn" value="${esc(u.name || "")}">
    <input class="input" id="${p}-email" type="email" placeholder="E-post" aria-label="E-post" value="${esc(u.email || "")}">
    <select class="input" id="${p}-role" aria-label="Roll"><option value="agent"${u.role !== "admin" ? " selected" : ""}>Handläggare</option><option value="admin"${u.role === "admin" ? " selected" : ""}>Administratör</option></select>
    <input class="input" id="${p}-pw" type="password" autocomplete="new-password" placeholder="${u.id ? "Nytt lösenord (lämna tomt för att behålla)" : "Lösenord (minst 8 tecken)"}" aria-label="Lösenord">
    <input class="input full" id="${p}-burl" type="url" placeholder="Bokningssida i Microsoft Bookings (https://…), valfritt" aria-label="Bokningssida" value="${esc(u.booking_url || "")}">
    ${u.id ? `<label class="check full"><input type="checkbox" id="${p}-active"${u.active ? " checked" : ""}> Aktivt konto (kan logga in)</label>` : ""}
    <p class="err full" id="${p}-err" hidden></p>
    <div class="row"><button type="button" class="textbtn" id="${p}-cancel">Avbryt</button><button type="submit" class="btn btn-dark">${u.id ? "Spara" : "Lägg till"}</button></div>
  </form>`;

  const renderUsers = () => {
    const box = $("#box-users");
    box.innerHTML = `<h2>Användare</h2><p class="lead">Handläggare kan tilldelas ärenden. Administratörer kan även hantera användare och kategorier.</p>
      <ul class="ulist">${S.users.map(u => editUser === u.id ? `<li style="display:block">${userForm(u, "uf")}</li>` : `<li>${avatar("sm")}
        <div class="who"><div>${esc(u.name)}${u.id === S.user.id ? " (du)" : ""}</div><div class="e">${esc(u.email)}</div></div>
        <span class="tag ${u.role === "admin" ? "admin" : ""}">${u.role === "admin" ? "Administratör" : "Handläggare"}</span>
        ${u.active ? "" : '<span class="tag off">Inaktiv</span>'}
        <button class="btn btn-sm" type="button" data-edit="${u.id}">Ändra</button></li>`).join("")}</ul>
      ${addingUser ? userForm({}, "un") : `<button class="btn" type="button" id="u-add">${ICON.plusSm}Lägg till användare</button>`}`;
    $$("[data-edit]", box).forEach(b => b.addEventListener("click", () => { editUser = +b.dataset.edit; addingUser = false; renderUsers(); }));
    if ($("#u-add")) $("#u-add").addEventListener("click", () => { addingUser = true; editUser = null; renderUsers(); $("#un-name").focus(); });
    const bind = (p, id) => {
      const f = $("#" + p); if (!f) return;
      $(`#${p}-cancel`).addEventListener("click", () => { editUser = null; addingUser = false; renderUsers(); });
      f.addEventListener("submit", async e => {
        e.preventDefault();
        const data = { name: $(`#${p}-name`).value, email: $(`#${p}-email`).value, role: $(`#${p}-role`).value, password: $(`#${p}-pw`).value };
        data.booking_url = $(`#${p}-burl`).value.trim();
        if (id) data.active = $(`#${p}-active`).checked;
        try {
          await api(id ? "PUT" : "POST", "/api/users" + (id ? "/" + id : ""), data);
          await loadRefs(); editUser = null; addingUser = false; renderUsers(); toast(id ? "Användaren sparades." : "Användaren lades till.");
        } catch (ex) { const er = $(`#${p}-err`); er.textContent = ex.message; er.hidden = false; }
      });
    };
    bind("uf", editUser); bind("un", null);
  };

  let renderBookingCatHook = () => {};
  const renderCats = () => {
    const box = $("#box-cats");
    box.innerHTML = `<h2>Kategorier</h2><p class="lead">Används för att sortera ärenden. Tar du bort en kategori blir ärendena utan kategori.</p>
      <ul class="ulist">${S.categories.map(c => editCat === c.id
        ? `<li><div class="add-row" style="flex:1"><input class="input" id="cat-edit" value="${esc(c.name)}" aria-label="Nytt namn"><button class="btn btn-dark btn-sm" type="button" data-save="${c.id}">Spara</button><button class="textbtn" type="button" data-cancel>Avbryt</button></div></li>`
        : `<li><div class="who">${esc(c.name)}<div class="e">${c.used} ${c.used === 1 ? "ärende" : "ärenden"}</div></div>
          <button class="btn btn-sm" type="button" data-cedit="${c.id}">Byt namn</button>
          <button class="btn btn-sm btn-danger${armedCat === c.id ? " armed" : ""}" type="button" data-cdel="${c.id}">${armedCat === c.id ? "Bekräfta" : "Ta bort"}</button></li>`).join("")}</ul>
      <form class="add-row" id="cat-add" novalidate><input class="input" id="cat-new" placeholder="Ny kategori" aria-label="Ny kategori" maxlength="60"><button class="btn" type="submit">Lägg till</button></form>`;
    const refresh = async () => { S.categories = (await api("GET", "/api/categories")).items; renderCats(); };
    $$("[data-cedit]", box).forEach(b => b.addEventListener("click", () => { editCat = +b.dataset.cedit; armedCat = null; renderCats(); $("#cat-edit").focus(); }));
    $$("[data-cancel]", box).forEach(b => b.addEventListener("click", () => { editCat = null; renderCats(); }));
    $$("[data-save]", box).forEach(b => b.addEventListener("click", async () => {
      try { await api("PUT", "/api/categories/" + b.dataset.save, { name: $("#cat-edit").value }); editCat = null; await refresh(); } catch (e) { toast(e.message, true); }
    }));
    $$("[data-cdel]", box).forEach(b => b.addEventListener("click", async () => {
      const id = +b.dataset.cdel;
      if (armedCat !== id) { armedCat = id; renderCats(); return; }
      try { await api("DELETE", "/api/categories/" + id); armedCat = null; await refresh(); toast("Kategorin togs bort."); } catch (e) { toast(e.message, true); }
    }));
    $("#cat-add").addEventListener("submit", async e => {
      e.preventDefault();
      try { await api("POST", "/api/categories", { name: $("#cat-new").value }); await refresh(); $("#cat-new").focus(); } catch (ex) { toast(ex.message, true); }
    });
    renderBookingCatHook();
  };
  const renderMail = async () => {
    const box = $("#box-mail");
    let st;
    try { st = await api("GET", "/api/settings"); } catch (e) { box.innerHTML = `<p class="err">${esc(e.message)}</p>`; return; }
    const m = st.smtp, last = st.last_mail;
    const v = k => esc(m[k] || "");
    box.innerHTML = `<h2>E-post</h2>
      <p class="lead">Handläggaren får ett mail när ett ärende tilldelas hen. Uppgifterna får du av IT.</p>
      <form class="inline-form" id="mail-form" novalidate>
        <label class="check full"><input type="checkbox" id="m-on"${m.smtp_enabled === "1" ? " checked" : ""}> Skicka mail vid tilldelning</label>
        <div class="field"><label for="m-host">SMTP-server</label><input class="input" id="m-host" value="${v("smtp_host")}" placeholder="smtp.office365.com"></div>
        <div class="field"><label for="m-port">Port</label><input class="input" id="m-port" inputmode="numeric" value="${v("smtp_port") || 587}"></div>
        <div class="field"><label for="m-sec">Kryptering</label><select class="input" id="m-sec">
          ${[["starttls", "STARTTLS (vanligast, port 587)"], ["ssl", "SSL/TLS (port 465)"], ["none", "Ingen (intern server, port 25)"]].map(([k, l]) => `<option value="${k}"${(m.smtp_security || "starttls") === k ? " selected" : ""}>${l}</option>`).join("")}</select></div>
        <div class="field full" id="m-tls-wrap"><label for="m-tls">Certifikatkontroll</label><select class="input" id="m-tls">
          ${[["verify", "Kontrollera (rekommenderas)"], ["pinned", "Lita på serverns certifikat"], ["none", "Kontrollera inte (osäkert)"]].map(([k, l]) => `<option value="${k}"${(m.smtp_tls_verify || "verify") === k ? " selected" : ""}>${l}</option>`).join("")}</select></div>
        <div class="field full" id="m-pin-wrap">
          <label for="m-pem">Serverns certifikat</label>
          <textarea class="input mono" id="m-pem" rows="5" placeholder="-----BEGIN CERTIFICATE-----" style="min-height:110px">${v("smtp_ca_pem")}</textarea>
          <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap"><button type="button" class="btn btn-sm" id="m-fetch">Hämta certifikat från servern</button><span class="muted" id="m-fp" style="font-size:.85rem;overflow-wrap:anywhere"></span></div>
          <p class="muted" style="margin:0;font-size:.85rem">Jämför gärna fingeravtrycket med IT innan du sparar. Bara exakt det här certifikatet godkänns.</p>
        </div>
        <p class="err full" id="m-none-warn" style="margin:0">Utan kontroll krypteras trafiken men det går inte att veta att det är rätt server. Använd bara tillfälligt.</p>
        <div class="field"><label for="m-user">Användarnamn</label><input class="input" id="m-user" value="${v("smtp_user")}" autocomplete="off" placeholder="Lämna tomt om ingen inloggning"></div>
        <div class="field"><label for="m-pw">Lösenord</label><input class="input" id="m-pw" type="password" autocomplete="new-password" placeholder="${m.has_password ? "Sparat (lämna tomt för att behålla)" : "Inget sparat"}"></div>
        <div class="field"><label for="m-from">Avsändaradress</label><input class="input" id="m-from" type="email" value="${v("smtp_from")}" placeholder="it-support@foretag.se"></div>
        <div class="field"><label for="m-name">Avsändarnamn</label><input class="input" id="m-name" value="${v("smtp_from_name")}" placeholder="IT-support"></div>
        <div class="field full"><label for="m-base">Systemets adress (för länken i mailet)</label><input class="input" id="m-base" value="${v("base_url")}" placeholder="http://nas-namn:8000"></div>
        ${last ? `<p class="full ${last.error ? "err" : "muted"}" style="margin:0">${last.error ? esc(last.error) : "Senaste mailet skickades " + fmtDT(last.at) + "."}</p>` : ""}
        <p class="err full" id="m-err" hidden></p>
        <div class="row"><button type="button" class="btn" id="m-test">Skicka testmail till mig</button><button type="submit" class="btn btn-dark">Spara</button></div>
      </form>`;
    const read = () => ({ smtp_enabled: $("#m-on").checked, smtp_host: $("#m-host").value, smtp_port: $("#m-port").value, smtp_security: $("#m-sec").value,
      smtp_user: $("#m-user").value, smtp_password: $("#m-pw").value, smtp_tls_verify: $("#m-tls").value, smtp_ca_pem: $("#m-pem").value, smtp_from: $("#m-from").value, smtp_from_name: $("#m-name").value, base_url: $("#m-base").value });
    const showErr = msg => { const e = $("#m-err"); e.textContent = msg; e.hidden = false; };
    const syncTls = () => {
      const enc = $("#m-sec").value !== "none", mode = $("#m-tls").value;
      $("#m-tls-wrap").hidden = !enc;
      $("#m-pin-wrap").hidden = !enc || mode !== "pinned";
      $("#m-none-warn").hidden = !enc || mode !== "none";
    };
    $("#m-sec").addEventListener("change", syncTls);
    $("#m-tls").addEventListener("change", syncTls);
    syncTls();
    $("#m-fetch").addEventListener("click", async () => {
      $("#m-err").hidden = true;
      try {
        const cur = read(); if (cur.smtp_tls_verify === "pinned" && !cur.smtp_ca_pem.includes("BEGIN CERTIFICATE")) cur.smtp_tls_verify = "verify";
        await api("PUT", "/api/settings", { smtp: cur });
        const r = await api("POST", "/api/settings/fetch-cert", {});
        $("#m-pem").value = r.pem; $("#m-tls").value = "pinned"; syncTls();
        $("#m-fp").textContent = "SHA-256: " + r.sha256;
        toast("Certifikatet hämtades. Klicka Spara för att godkänna det.");
      } catch (ex) { showErr(ex.message); }
    });
    $("#mail-form").addEventListener("submit", async e => {
      e.preventDefault();
      try { await api("PUT", "/api/settings", { smtp: read() }); toast("Mailinställningarna sparades."); renderMail(); } catch (ex) { showErr(ex.message); }
    });
    $("#m-test").addEventListener("click", async () => {
      $("#m-err").hidden = true;
      try { await api("PUT", "/api/settings", { smtp: read() }); const r = await api("POST", "/api/settings/test-mail", {}); toast(`Testmail skickat till ${r.to}.`); }
      catch (ex) { showErr(ex.message); }
    });
  };

  const renderBookingCat = async () => {
    let st; try { st = await api("GET", "/api/settings"); } catch (e) { return; }
    const box = $("#box-cats");
    const old = $("#bk-cat-wrap"); if (old) old.remove();
    const div = document.createElement("div");
    div.id = "bk-cat-wrap"; div.className = "field"; div.style.marginTop = "22px";
    div.innerHTML = `<label for="bk-cat">Kategori för tidsbokning</label>
      <select class="input" id="bk-cat"><option value="">Ingen (knappen Boka tid visas aldrig)</option>${catOptions(st.booking_category_id)}</select>
      <p class="muted" style="margin:0;font-size:.9rem">När ett ärende har den här kategorin visas knappen Boka tid med handläggarens bokningssida.</p>`;
    box.appendChild(div);
    $("#bk-cat").addEventListener("change", async e => {
      try { await api("PUT", "/api/settings", { booking_category_id: e.target.value || null }); S.bookingCat = e.target.value ? +e.target.value : null; toast("Kategorin för tidsbokning sparades."); }
      catch (ex) { toast(ex.message, true); }
    });
  };
  const COLORS = [["blue", "Blå"], ["amber", "Gul"], ["green", "Grön"], ["red", "Röd"], ["violet", "Lila"], ["grey", "Grå"]];
  let armedStatus = null;
  const renderStatuses = async () => {
    const box = $("#box-status");
    let items;
    try { items = (await api("GET", "/api/statuses")).items; } catch (e) { box.innerHTML = `<p class="err">${esc(e.message)}</p>`; return; }
    setStatuses(items);
    box.innerHTML = `<h2>Statusar</h2>
      <p class="lead">Ordningen styr listorna, och nya ärenden får den första statusen som inte är avslutad. <b>Avslutad</b> ger ärendet ett avslutsdatum och gör att det kan arkiveras. <b>Låst</b> betyder att ärendet inte kan öppnas igen. Bara administratörer kan då ändra statusen.</p>
      <ul class="slist">${items.map((x, i) => `<li data-id="${x.id}">
        <div class="s-order"><button type="button" class="textbtn s-up" ${i === 0 ? "disabled" : ""} aria-label="Flytta upp ${esc(x.name)}">▲</button><button type="button" class="textbtn s-down" ${i === items.length - 1 ? "disabled" : ""} aria-label="Flytta ned ${esc(x.name)}">▼</button></div>
        <input class="input s-name" value="${esc(x.name)}" aria-label="Namn på status" maxlength="40">
        <select class="input s-color" aria-label="Färg">${COLORS.map(([k, l]) => `<option value="${k}"${x.color === k ? " selected" : ""}>${l}</option>`).join("")}</select>
        <label class="check"><input type="checkbox" class="s-closed"${x.closed ? " checked" : ""}> Avslutad</label>
        <label class="check"><input type="checkbox" class="s-locked"${x.locked ? " checked" : ""}${x.closed ? "" : " disabled"}> Låst</label>
        <span class="muted s-used">${x.used} ${x.used === 1 ? "ärende" : "ärenden"}</span>
        <button type="button" class="btn btn-sm s-save">Spara</button>
        <button type="button" class="btn btn-sm btn-danger s-del${armedStatus === x.id ? " armed" : ""}" ${x.used ? 'disabled title="Används av ärenden"' : ""}>${armedStatus === x.id ? "Bekräfta" : "Ta bort"}</button>
      </li>`).join("")}</ul>
      <form class="add-row" id="s-add" novalidate><input class="input" id="s-new" placeholder="Ny status" aria-label="Ny status" maxlength="40"><button class="btn" type="submit">Lägg till</button></form>`;
    const ids = items.map(x => x.id);
    $$(".slist li", box).forEach((li, i) => {
      const sid = +li.dataset.id;
      $(".s-closed", li).addEventListener("change", e => { const l = $(".s-locked", li); l.disabled = !e.target.checked; if (!e.target.checked) l.checked = false; });
      $(".s-save", li).addEventListener("click", async () => {
        try {
          await api("PUT", "/api/statuses/" + sid, { name: $(".s-name", li).value, color: $(".s-color", li).value, closed: $(".s-closed", li).checked, locked: $(".s-locked", li).checked });
          toast("Statusen sparades."); renderStatuses();
        } catch (ex) { toast(ex.message, true); }
      });
      $(".s-del", li).addEventListener("click", async () => {
        if (armedStatus !== sid) { armedStatus = sid; renderStatuses(); return; }
        try { await api("DELETE", "/api/statuses/" + sid); armedStatus = null; toast("Statusen togs bort."); renderStatuses(); } catch (ex) { toast(ex.message, true); }
      });
      const move = async d => { const o = ids.slice(); [o[i], o[i + d]] = [o[i + d], o[i]]; try { await api("POST", "/api/statuses/order", { ids: o }); renderStatuses(); } catch (ex) { toast(ex.message, true); } };
      $(".s-up", li).addEventListener("click", () => move(-1));
      $(".s-down", li).addEventListener("click", () => move(1));
    });
    $("#s-add").addEventListener("submit", async e => {
      e.preventDefault();
      try { await api("POST", "/api/statuses", { name: $("#s-new").value, color: "blue" }); toast("Statusen lades till."); renderStatuses(); } catch (ex) { toast(ex.message, true); }
    });
  };

  renderBookingCatHook = renderBookingCat;
  renderUsers(); renderStatuses(); renderMail(); renderCats();
}

boot();
