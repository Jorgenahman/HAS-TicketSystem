"use strict";
/* Ärendehantering – webbgränssnitt (ingen extern kod) */

const S = { user: null, users: [], categories: [], priorities: [], statusList: [], statuses: [], closed: [], bookingCat: null };
function setStatuses(list) {
  S.statusList = list || [];
  S.statuses = S.statusList.map(x => x.name);
  S.closed = S.statusList.filter(x => x.closed).map(x => x.name);
}
const statusInfo = name => S.statusList.find(x => x.name === name) || { name, color: "grey", closed: 0, locked: 0 };
const statusPill = name => `<span class="spill sc-${statusInfo(name).color}">${esc(tv(name))}</span>`;
const root = document.getElementById("root");
const $ = (sel, el = document) => el.querySelector(sel);
const $$ = (sel, el = document) => Array.from(el.querySelectorAll(sel));
const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const TZ = () => new Date().getTimezoneOffset();
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/* ---------------- ikoner ---------------- */
const ICON = {
  user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="8.5" r="4"/><path d="M4.5 20c1.2-3.6 4-5.5 7.5-5.5s6.3 1.9 7.5 5.5"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="11" style="fill:var(--mint-ink)"/><path d="M12 7v10M7 12h10" style="stroke:var(--mint)" stroke-width="2.4" stroke-linecap="round"/></svg>',
  palette: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a9 9 0 1 0 0 18c1.1 0 1.7-.8 1.7-1.7 0-.5-.2-.9-.5-1.2-.3-.3-.5-.7-.5-1.2 0-.9.8-1.7 1.7-1.7H16a5 5 0 0 0 5-5c0-4-4-7.2-9-7.2Z"/><circle cx="7.5" cy="11" r="1"/><circle cx="10.5" cy="7.5" r="1"/><circle cx="15" cy="8" r="1"/></svg>',
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
/* Initialer i stället för tom avatar: samma namn får alltid samma färg */
const AV_COLORS = ["#6f5fd6", "#14866d", "#b4570f", "#2f6db5", "#a23b72", "#5b6b2f"];
function initials(name) {
  const p = String(name || "?").trim().split(/\s+/).filter(Boolean);
  if (!p.length) return "?";
  return ((p[0][0] || "") + (p.length > 1 ? p[p.length - 1][0] : "")).toUpperCase();
}
function avColor(name) { let h = 0; for (const ch of String(name || "")) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return AV_COLORS[h % AV_COLORS.length]; }
const ini = (name, size = "sm") => `<span class="ini ${size}" style="--c:${avColor(name)}" aria-hidden="true">${esc(initials(name))}</span>`;
ICON.search = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>';
ICON.filter = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 6h16M7 12h10M10 18h4"/></svg>';
ICON.x = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>';
ICON.back = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 6l-6 6 6 6"/></svg>';
ICON.inbox = '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M6 28 12 10h24l6 18v10H6z"/><path d="M6 28h11l2 5h10l2-5h11"/></svg>';
ICON.people = '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="18" cy="17" r="7"/><path d="M5 40c1.5-7 6.5-11 13-11s11.5 4 13 11"/><circle cx="34" cy="19" r="5"/><path d="M33 29c5 0 9 3.4 10 9"/></svg>';
ICON.chat = '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M8 10h32v22H20l-8 7v-7H8z"/></svg>';
function emptyState(icon, text, action = "") {
  return `<div class="empty-state"><span class="es-ic">${icon}</span><p>${text}</p>${action}</div>`;
}

/* ---------------- API ---------------- */
async function api(method, path, body) {
  const opt = { method, headers: { "X-Requested-With": "ts", "X-Lang": LANG }, credentials: "same-origin" };
  if (body !== undefined) { opt.headers["Content-Type"] = "application/json"; opt.body = JSON.stringify(body); }
  let res;
  try { res = await fetch(path, opt); }
  catch (e) { throw new Error(t("Kunde inte nå servern. Kontrollera nätverket.")); }
  let data = {};
  try { data = await res.json(); } catch (e) {}
  if (res.status === 401 && !path.startsWith("/api/login")) { S.user = null; showAuth(); throw new Error(tErr(data.error) || t("Du är inte inloggad.")); }
  if (!res.ok) throw new Error(tErr(data.error) || t("Något gick fel ({n}).", { n: res.status }));
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
const LOCALE = () => LANG === "en" ? "en-GB" : "sv-SE";
const fmtDate = ts => ts ? new Intl.DateTimeFormat(LOCALE(), { day: "numeric", month: "short", year: "numeric" }).format(ts * 1000) : "–";
const fmtDT = ts => ts ? new Intl.DateTimeFormat(LOCALE(), { dateStyle: "medium", timeStyle: "short" }).format(ts * 1000) : "–";
const isoDay = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
function dayStart(iso) { if (!iso) return ""; const [y, m, d] = iso.split("-").map(Number); return Math.floor(new Date(y, m - 1, d).getTime() / 1000); }
function dayEnd(iso) { if (!iso) return ""; const [y, m, d] = iso.split("-").map(Number); return Math.floor(new Date(y, m - 1, d, 23, 59, 59).getTime() / 1000); }
function daysAgo(n) { const d = new Date(); d.setDate(d.getDate() - n); return isoDay(d); }

/* ---------------- lagring av filterval (per webbläsare) ---------------- */
function loadPref(key, def) { try { const v = JSON.parse(localStorage.getItem("ts." + key)); return v ? Object.assign({}, def, v) : Object.assign({}, def); } catch (e) { return Object.assign({}, def); } }
function savePref(key, v) { try { localStorage.setItem("ts." + key, JSON.stringify(v)); } catch (e) {} }
const DEFAULT_THEME = "blagra"; // standardtema för alla som inte valt eget
const THEMES = [
  ["blagra", "Nordisk blågrå", "Standard · lugn och professionell", "mörkblått med klarblått", ["#1f2a37", "#2b3848", "#2563eb", "#93c5fd", "#f5f7fa"]],
  ["lila", "Lila", "Det ursprungliga temat", "mörklila med mintgrönt", ["#241d3d", "#372c5f", "#33e3a2", "#6f5fd6", "#f5f5f9"]],
  ["carpe", "Carpe Diem · Matrix", "Matrix: grön kod på svart", "neongrönt på svart", ["#000000", "#020d06", "#00ff41", "#0b8f2e", "#b6ffc6"]],
  ["cdb", "Visual Guidelines 2025", "Enligt Carpe Diem Beds riktlinjer", "svart, vitt och grått", ["#ffffff", "#000000", "#b9b7b6", "#e3e2e2", "#f7f7f7"]],];
function applyTheme(k) { if (k === "skog") k = "carpe"; if (k === "ljus") k = DEFAULT_THEME; if (k && k !== "lila") document.documentElement.dataset.theme = k; else delete document.documentElement.dataset.theme; }
applyTheme(loadPref("theme", { k: DEFAULT_THEME }).k);
/* Beställartema: visar sidan i beställarens tema medan dennes kort eller ärende är öppet, annars användarens eget. */
function viewTheme(k) { applyTheme(k && THEMES.some(x => x[0] === k) ? k : loadPref("theme", { k: DEFAULT_THEME }).k); }
const themeName = k => { const x = THEMES.find(x => x[0] === k); return x ? t(x[1]) + " – " + t(x[3]) : ""; };

/* ---------------- språk ---------------- */
const langSwitch = (cls = "") => `<div class="lang ${cls}" role="group" aria-label="${t("Språk")}">
  <button type="button" data-lang="sv" aria-pressed="${LANG === "sv"}">Svenska</button><button type="button" data-lang="en" aria-pressed="${LANG === "en"}">English</button></div>`;
function bindLang(scope, rerender) {
  $$("[data-lang]", scope).forEach(b => b.addEventListener("click", async () => {
    if (b.dataset.lang === LANG) return;
    setLang(b.dataset.lang);
    if (S.user) { try { S.user = await api("PUT", "/api/me", { lang: LANG }); } catch (e) {} }
    rerender();
  }));
}

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
    root.innerHTML = `<div class="auth"><div class="auth-card"><h1>${t("Servern svarar inte")}</h1><p>${esc(e.message)}</p><button class="btn btn-dark" onclick="location.reload()">${t("Försök igen")}</button></div></div>`;
  }
}
async function loadRefs() {
  const [u, c, st] = await Promise.all([api("GET", "/api/users"), api("GET", "/api/categories"), api("GET", "/api/status")]);
  S.users = u.items; S.categories = c.items; S.bookingCat = st.booking_category_id || null; setStatuses(st.status_list);
  if (st.user) { S.user = st.user; if (st.user.lang && st.user.lang !== LANG) setLang(st.user.lang); }
}

/* Matrix-regn på inloggningssidan (bara i Carpe Diem · Matrix-temat) */
function matrixRain(host) {
  if (!host || document.documentElement.dataset.theme !== "carpe") return;
  if (window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const cv = document.createElement("canvas"); cv.className = "mx-rain"; cv.setAttribute("aria-hidden", "true");
  host.prepend(cv);
  const ctx = cv.getContext("2d"), chars = "ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜﾝ0123456789:.=*+-<>¦|Z";
  const fs = 16; let cols = [], w = 0, h = 0;
  const size = () => { w = cv.width = window.innerWidth; h = cv.height = window.innerHeight; cols = Array.from({ length: Math.ceil(w / fs) }, () => Math.random() * -h / fs); };
  size(); window.addEventListener("resize", size);
  let last = 0;
  const tick = ts => {
    if (!cv.isConnected || document.documentElement.dataset.theme !== "carpe") { window.removeEventListener("resize", size); cv.remove(); return; }
    if (ts - last > 50) {
      last = ts;
      ctx.fillStyle = "rgba(0,0,0,0.08)"; ctx.fillRect(0, 0, w, h);
      ctx.font = fs + "px monospace";
      cols.forEach((y, i) => {
        const ch = chars[Math.floor(Math.random() * chars.length)];
        ctx.fillStyle = Math.random() > .975 ? "#d6ffe0" : "#00ff41";
        ctx.fillText(ch, i * fs, y * fs);
        cols[i] = y * fs > h && Math.random() > .975 ? 0 : y + 1;
      });
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}
function showAuth() {
  document.title = t("Ärendehantering");
  root.innerHTML = `<div class="auth"><form class="auth-card" id="login" novalidate>
    ${langSwitch("auth-lang")}
    <h1>${t("Ärendehantering")}</h1>
    <p>${t("Logga in med ditt konto.")}</p>
    <div class="field"><label for="l-email">${t("E-post")}</label><input class="input" id="l-email" type="email" autocomplete="username" required></div>
    <div class="field"><label for="l-pw">${t("Lösenord")}</label><input class="input" id="l-pw" type="password" autocomplete="current-password" required></div>
    <p class="err" id="l-err" hidden></p>
    <button class="btn btn-dark" type="submit">${t("Logga in")}</button>
  </form></div>`;
  bindLang(root, showAuth);
  matrixRain($(".auth"));
  $("#l-email").focus();
  $("#login").addEventListener("submit", async e => {
    e.preventDefault();
    const err = $("#l-err"); err.hidden = true;
    try {
      const r = await api("POST", "/api/login", { email: $("#l-email").value.trim(), password: $("#l-pw").value });
      S.user = r.user;
      if (S.user.lang !== LANG) { try { S.user = await api("PUT", "/api/me", { lang: LANG }); } catch (e2) {} }
      await loadRefs(); route();
    } catch (ex) { err.textContent = ex.message; err.hidden = false; }
  });
}

function showSetup() {
  root.innerHTML = `<div class="auth"><form class="auth-card" id="setup" novalidate>
    ${langSwitch("auth-lang")}
    <h1>${t("Välkommen")}</h1>
    <p>${t("Skapa det första kontot. Det blir administratör och kan sedan lägga till fler användare.")}</p>
    <div class="field"><label for="s-name">${t("Namn")}</label><input class="input" id="s-name" autocomplete="name"></div>
    <div class="field"><label for="s-email">${t("E-post")}</label><input class="input" id="s-email" type="email" autocomplete="username"></div>
    <div class="field"><label for="s-pw">${t("Lösenord (minst 8 tecken)")}</label><input class="input" id="s-pw" type="password" autocomplete="new-password"></div>
    <div class="field"><label for="s-pw2">${t("Upprepa lösenord")}</label><input class="input" id="s-pw2" type="password" autocomplete="new-password"></div>
    <p class="err" id="s-err" hidden></p>
    <button class="btn btn-dark" type="submit">${t("Skapa konto")}</button>
  </form></div>`;
  bindLang(root, showSetup);
  matrixRain($(".auth"));
  $("#s-name").focus();
  $("#setup").addEventListener("submit", async e => {
    e.preventDefault();
    const err = $("#s-err"); err.hidden = true;
    if ($("#s-pw").value !== $("#s-pw2").value) { err.textContent = t("Lösenorden matchar inte."); err.hidden = false; return; }
    try {
      const r = await api("POST", "/api/setup", { name: $("#s-name").value, email: $("#s-email").value, password: $("#s-pw").value, lang: LANG });
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
  const nav = [["dashboard", t("Dashboard"), ICON.dash], ["tickets", t("Ärenden"), ICON.tickets], ["settings", t("Inställningar"), ICON.settings]];
  root.innerHTML = `<div class="shell">
    <aside class="side">
      <div class="me">${ini(S.user.name, "md")}<div class="me-txt"><div class="name">${esc(S.user.name)}</div><div class="role">${S.user.role === "admin" ? t("Administratör") : t("Handläggare")}</div></div></div>
      <a class="btn-new" href="#/tickets/new" aria-label="${t("Nytt ärende")}">${ICON.plus}<span>${t("Nytt ärende")}</span></a>
      <nav class="nav" aria-label="${t("Huvudmeny")}">${nav.map(([k, l, i]) => `<a href="#/${k}"${k === active ? ' aria-current="page"' : ""}>${i}<span>${l}</span></a>`).join("")}</nav>
      <div class="bottom">${langSwitch("side-lang")}<button class="linkbtn" id="logout" type="button">${t("Logga ut")}</button></div>
    </aside>
    <div class="main">
      <div class="topband"><div class="tab"><h1>${esc(title)}</h1></div></div>
      <div class="content ${layout}" id="content"></div>
    </div>
  </div>`;
  $("#logout").addEventListener("click", logout);
  bindLang(root, route);
  document.title = title + " · " + t("Ärendehantering");
  return $("#content");
}

/* ---------------- router ---------------- */
function parseHash() {
  const h = location.hash.replace(/^#\/?/, "");
  const [path, query] = h.split("?");
  return { parts: path.split("/").filter(Boolean), query: Object.fromEntries(new URLSearchParams(query || "")) };
}
function route() {
  viewTheme(null);
  if (!S.user) return showAuth();
  const { parts, query } = parseHash();
  const [a, b] = parts;
  if (a === "tickets" && b === "new") return pageTicket(null, query);
  if (a === "tickets" && b) return pageTicket(Number(b), query);
  if (a === "tickets") return pageTickets(query);
  // Beställare ligger nu som en flik under Inställningar; gamla länkar skickas vidare
  if (a === "customers") { location.replace("#/settings/requesters" + (b ? "/" + b : "")); return; }
  if (a === "settings") return pageSettings(b, parts[2] ? Number(parts[2]) : null);
  return pageDashboard();
}
window.addEventListener("hashchange", route);

const catOptions = (sel, allLabel) => (allLabel !== undefined ? `<option value="">${allLabel}</option>` : "") +
  S.categories.map(c => `<option value="${c.id}"${String(sel) === String(c.id) ? " selected" : ""}>${esc(tv(c.name))}</option>`).join("");
const prioOptions = (sel, allLabel) => (allLabel !== undefined ? `<option value="">${allLabel}</option>` : "") +
  S.priorities.map(p => `<option value="${esc(p)}"${p === sel ? " selected" : ""}>${esc(tv(p))}</option>`).join("");
const statusOptions = sel => S.statuses.map(x => `<option value="${esc(x)}"${x === sel ? " selected" : ""}>${esc(tv(x))}</option>`).join("");
const userOptions = (sel, firstLabel, includeInactiveId) => `<option value="">${firstLabel}</option>` +
  S.users.filter(u => u.active || u.id === includeInactiveId).map(u => `<option value="${u.id}"${String(sel) === String(u.id) ? " selected" : ""}>${esc(u.name)}${u.active ? "" : " (" + t("inaktiv") + ")"}</option>`).join("");

/* =========================================================== DASHBOARD */
let DF = loadPref("dash", { category: "", priority: "", from: "", to: "" });
async function pageDashboard() {
  const el = shell("dashboard", t("Dashboard"));
  if (!DF.from) DF.from = daysAgo(6);
  if (!DF.to) DF.to = isoDay(new Date());
  el.innerHTML = `<section class="work"><div id="dash-body"><p class="muted">${t("Hämtar …")}</p></div></section>
  <aside class="aside"><div class="filters">
    <h2>${t("Filtrera")}</h2>
    <div class="field"><label for="df-cat">${t("Kategori")}</label><select class="input" id="df-cat">${catOptions(DF.category, t("Alla kategorier"))}</select></div>
    <div class="field"><label for="df-prio">${t("Prioritet")}</label><select class="input" id="df-prio">${prioOptions(DF.priority, t("Alla prioriteter"))}</select></div>
    <div class="field"><label for="df-from">${t("Datumintervall")}</label>
      <input class="input" type="date" id="df-from" value="${DF.from}" aria-label="${t("Från datum")}">
      <input class="input" type="date" id="df-to" value="${DF.to}" aria-label="${t("Till datum")}"></div>
    <button class="reset" type="button" id="df-reset">${t("Återställ filter")}</button>
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
    const trend = t("nya jämfört med föregående {d} dagar", { d: days });
    return `<a class="kpi" href="${href}"><span class="kpi-label">${label}</span><span class="kpi-value">${c.value}</span>
      <span class="kpi-trend"><span class="kpi-delta ${diff > 0 ? "up" : diff < 0 ? "down" : ""}">${diff > 0 ? "+" + diff : diff < 0 ? "−" + -diff : "±0"}</span>${trend}</span></a>`;
  };
  const closedPct = d.created ? Math.round(100 * d.created_closed / d.created) : null;
  const ret = d.customers_total - d.customers_new;
  const breakdown = (d.closed_breakdown || []).map(x => `${x.n} ${esc(tv(x.name).toLowerCase())}`).join(", ");
  const totC = d.series.reduce((a, x) => a + x.created, 0), totX = d.series.reduce((a, x) => a + x.closed, 0);
  body.innerHTML = `
    <h2 class="sec-title">${t("Just nu")}</h2>
    <div class="kpis">
      ${card("unassigned", t("Ej tilldelade"), "#/tickets?status=open&assignee=none")}
      ${card("open", t("Öppna ärenden"), "#/tickets?status=open")}
      ${card("high", t("Hög prioritet"), "#/tickets?status=open&priority=H%C3%B6g")}
    </div>
    <h2 class="sec-title">${t("Under perioden")}</h2>
    <div class="stats">
      <div class="stat"><span class="kpi-label">${t("Avslutade i perioden")}</span>
        <span class="stat-value">${closedPct === null ? "–" : closedPct + " %"}</span>
        <span class="stat-sub">${d.created ? t("{list} av {n} ärenden som skapades i perioden", { list: breakdown || "0", n: d.created }) : t("Inga ärenden skapades i perioden.")}</span></div>
      <div class="stat"><span class="kpi-label">${t("Nya beställare")}</span>
        <span class="stat-value">${d.customers_total ? t("{a} av {b}", { a: d.customers_new, b: d.customers_total }) : "–"}</span>
        <span class="stat-sub">${d.customers_total ? t("{n} återkommande", { n: ret }) : t("Inga ärenden med beställare i perioden.")}</span></div>
      <div class="stat"><span class="kpi-label">${t("Skapade")}</span><span class="stat-value">${totC}</span>
        <span class="stat-sub">${t("{n} avslutade under samma period", { n: totX })}</span></div>
    </div>
    <div class="chart-card">
      <div class="chart-head"><h2 class="sec-title" style="margin:0">${t("Skapade och avslutade per dag")}</h2>
        <div class="legend"><span><i style="background:var(--chart-a)"></i>${t("Skapade")}</span><span><i style="background:var(--chart-b)"></i>${t("Avslutade")}</span></div></div>
      <div class="chart-wrap"><div class="chart" id="chart"></div><div class="tip" id="tip" hidden></div></div>
    </div>`;
  drawChart(d.series);
}

function drawChart(series) {
  const host = $("#chart"); if (!host) return;
  const W = 900, H = 280, L = 36, R = 8, T = 12, B = 30;
  const n = series.length, maxV = Math.max(1, ...series.map(s => Math.max(s.created, s.closed)));
  const step = maxV <= 5 ? 1 : maxV <= 10 ? 2 : Math.ceil(maxV / 5);
  const top = Math.ceil(maxV / step) * step;
  const slot = (W - L - R) / n;
  const bw = Math.max(3, Math.min(18, slot * 0.34));
  const y = v => T + (H - T - B) * (1 - v / top);
  const base = y(0);
  const wd = new Intl.DateTimeFormat(LOCALE(), { weekday: "short" });
  const label = s => { const [yy, mm, dd] = s.date.split("-").map(Number); const dt = new Date(yy, mm - 1, dd); return n <= 10 ? `${wd.format(dt)} ${dd}` : `${dd}/${mm}`; };
  const every = Math.max(1, Math.ceil(n / 10));
  const bar = (x, v, color) => {
    if (!v) return "";
    const h = base - y(v), r = Math.min(4, bw / 2, h);
    return `<path d="M${x},${base}V${base - h + r}Q${x},${base - h} ${x + r},${base - h}H${x + bw - r}Q${x + bw},${base - h} ${x + bw},${base - h + r}V${base}Z" fill="${color}"/>`;
  };
  let g = "";
  for (let v = 0; v <= top; v += step) g += `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" style="stroke:${v ? "var(--grid)" : "var(--grid-0)"}"/><text x="${L - 8}" y="${y(v)}" text-anchor="end" dominant-baseline="central">${v}</text>`;
  series.forEach((s, i) => {
    const cx = L + slot * i + slot / 2;
    g += `<rect class="day-hl" data-i="${i}" x="${L + slot * i + 1}" y="${T}" width="${slot - 2}" height="${base - T}" rx="6" fill="transparent"/>`;
    g += bar(cx - bw - 1, s.created, "var(--chart-a)") + bar(cx + 1, s.closed, "var(--chart-b)");
    if (i % every === 0 || i === n - 1) g += `<text x="${cx}" y="${H - 8}" text-anchor="middle">${label(s)}</text>`;
  });
  host.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${t("Diagram över skapade och avslutade ärenden per dag")}">${g}</svg>`;
  const svg = $("svg", host), tip = $("#tip");
  const longFmt = new Intl.DateTimeFormat(LOCALE(), { weekday: "long", day: "numeric", month: "long" });
  $$(".day-hl", svg).forEach(r => {
    r.addEventListener("mouseenter", () => {
      $$(".day-hl", svg).forEach(x => x.style.fill = "");
      r.style.fill = "var(--grid-hl)";
      const i = +r.dataset.i, s = series[i];
      const [yy, mm, dd] = s.date.split("-").map(Number);
      tip.innerHTML = `<div>${longFmt.format(new Date(yy, mm - 1, dd))}</div><div class="row"><i style="background:var(--chart-a)"></i>${t("Skapade")}: ${s.created}</div><div class="row"><i style="background:var(--chart-b)"></i>${t("Avslutade")}: ${s.closed}</div>`;
      tip.hidden = false;
      const pt = svg.getBoundingClientRect(), wrap = host.parentElement.getBoundingClientRect();
      const cx = (L + slot * i + slot / 2) * pt.width / W + pt.left - wrap.left;
      tip.style.left = Math.min(Math.max(cx, 80), wrap.width - 80) + "px";
      tip.style.top = (y(Math.max(s.created, s.closed)) * pt.height / H + pt.top - wrap.top - 10) + "px";
    });
  });
  svg.addEventListener("mouseleave", () => { $$(".day-hl", svg).forEach(x => x.style.fill = ""); tip.hidden = true; });
}

/* =========================================================== ÄRENDELISTA */
const TF_DEFAULT = { view: "open", priority: "", category: "", customer: "", assignee: "", created_from: "", created_to: "", closed_from: "", closed_to: "", q: "", sort: "date_desc" };
let TF = loadPref("tickets", TF_DEFAULT), TPAGE = 1;
let FP = loadPref("filterpanel", { open: window.innerWidth > 1280 });
const selected = new Set();
let armedBulk = null, LIST_CUSTOMERS = [];

const viewLabel = v => v === "open" ? t("Öppna (ej avslutade)") : v === "" ? t("Alla utom arkiverade") : v === "closed" ? t("Alla avslutade") : v === "archived" ? t("Arkiverade") : tv(v);
function activeFilters() {
  const f = [];
  const fmtD = iso => iso ? new Intl.DateTimeFormat(LOCALE(), { day: "numeric", month: "short" }).format(new Date(iso + "T12:00")) : "…";
  if (TF.view !== "open") f.push(["view", `${t("Status")}: ${viewLabel(TF.view)}`]);
  if (TF.priority) f.push(["priority", `${t("Prioritet")}: ${tv(TF.priority)}`]);
  if (TF.category) f.push(["category", `${t("Kategori")}: ${TF.category === "none" ? t("Utan kategori") : tv((S.categories.find(c => String(c.id) === String(TF.category)) || {}).name || "?")}`]);
  if (TF.customer) f.push(["customer", `${t("Beställare_1")}: ${(LIST_CUSTOMERS.find(c => String(c.id) === String(TF.customer)) || {}).name || "?"}`]);
  if (TF.assignee) f.push(["assignee", `${t("Handläggare")}: ${TF.assignee === "none" ? t("Ej tilldelad") : (S.users.find(u => String(u.id) === String(TF.assignee)) || {}).name || "?"}`]);
  if (TF.created_from || TF.created_to) f.push(["created", `${t("Skapad")}: ${fmtD(TF.created_from)} – ${fmtD(TF.created_to)}`]);
  if (TF.closed_from || TF.closed_to) f.push(["closed", `${t("Avslutad")}: ${fmtD(TF.closed_from)} – ${fmtD(TF.closed_to)}`]);
  return f;
}

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
  const el = shell("tickets", t("Ärenden"), FP.open ? "" : "no-aside");
  try { LIST_CUSTOMERS = (await api("GET", "/api/customers")).items; } catch (e) {}
  const views = [["open", viewLabel("open")], ["", viewLabel("")], ...S.statuses.map(x => [x, tv(x)]), ["closed", viewLabel("closed")], ["archived", viewLabel("archived")]];
  el.innerHTML = `<section class="work">
    <div class="list-head">
      <label class="searchbar">${ICON.search}<input id="t-q" type="search" placeholder="${t("Sök ärende, beställare eller nummer")}" value="${esc(TF.q)}" aria-label="${t("Sök")}"></label>
      <label class="sortlbl">${t("Sortera:")}
        <select class="sortsel" id="t-sort">${[["date_desc", t("Datum, nyast")], ["date_asc", t("Datum, äldst")], ["priority", t("Prioritet")], ["status", t("Status")], ["updated", t("Senast ändrad")]].map(([v, l]) => `<option value="${v}"${TF.sort === v ? " selected" : ""}>${l}</option>`).join("")}</select></label>
      <button class="btn" id="f-toggle" type="button" aria-expanded="${FP.open}" aria-controls="fpanel">${ICON.filter}${t("Filter")}<span class="fcount" id="fcount" hidden></span></button>
    </div>
    <div class="chips" id="chips"></div>
    <div class="bulkbar2" id="bulk" hidden>
      <b id="bulk-n"></b>
      <select class="sortsel" id="b-status" aria-label="${t("Ändra status på markerade")}"><option value="">${t("Ändra status …")}</option>${statusOptions(null)}</select>
      <button class="btn btn-sm" id="b-archive" type="button">${t("Arkivera")}</button>
      <button class="btn btn-sm btn-danger" id="b-delete" type="button">${t("Ta bort")}</button>
      <span class="grow"></span>
      <button class="textbtn" id="b-clear" type="button">${t("Avmarkera")}</button>
    </div>
    <div class="thead" role="presentation">
      <label class="check"><input type="checkbox" id="sel-all" aria-label="${t("Markera alla")}"></label>
      <span>${t("Ärende")}</span><span class="c-ag">${t("Handläggare")}</span><span class="c-date">${t("Skapad")}</span><span>${t("Prioritet")}</span><span>${t("Status")}</span>
    </div>
    <div class="tlist" id="tlist"><p class="muted" style="padding:16px">${t("Hämtar …")}</p></div>
    <div class="list-foot">
      <div class="pager" id="pager"></div>
      <div class="foot-actions">
        <button class="btn" id="b-archive-all" type="button"></button>
        <a class="btn" href="/api/export.xlsx?tz=${TZ()}&lang=${LANG}">${ICON.excel}${t("Exportera till Excel")}</a>
      </div>
    </div>
  </section>
  <aside class="aside" id="fpanel"${FP.open ? "" : " hidden"}><div class="filters">
    <div class="f-head"><h2>${t("Filtrera ärenden")}</h2><button class="iconbtn" id="f-close" type="button" aria-label="${t("Stäng filter")}">${ICON.x}</button></div>
    <div class="field"><label for="f-view">${t("Status")}</label><select class="input" id="f-view">${views.map(([v, l]) => `<option value="${esc(v)}"${TF.view === v ? " selected" : ""}>${esc(l)}</option>`).join("")}</select></div>
    <div class="field"><label for="f-prio">${t("Prioritet")}</label><select class="input" id="f-prio">${prioOptions(TF.priority, t("Alla"))}</select></div>
    <div class="field"><label for="f-cat">${t("Kategori")}</label><select class="input" id="f-cat"><option value="">${t("Alla")}</option><option value="none"${TF.category === "none" ? " selected" : ""}>${t("Utan kategori")}</option>${catOptions(TF.category)}</select></div>
    <div class="field"><label for="f-ass">${t("Handläggare")}</label><select class="input" id="f-ass"><option value="">${t("Alla")}</option><option value="none"${TF.assignee === "none" ? " selected" : ""}>${t("Ej tilldelad")}</option>${S.users.map(u => `<option value="${u.id}"${String(TF.assignee) === String(u.id) ? " selected" : ""}>${esc(u.name)}</option>`).join("")}</select></div>
    <div class="field"><label for="f-cust">${t("Beställare_1")}</label><select class="input" id="f-cust"><option value="">${t("Alla")}</option>${LIST_CUSTOMERS.map(c => `<option value="${c.id}"${String(TF.customer) === String(c.id) ? " selected" : ""}>${esc(c.name)}${c.company ? " – " + esc(c.company) : ""}</option>`).join("")}</select></div>
    <div class="field"><span class="label">${t("Skapad mellan")}</span><div class="pair">
      <input class="input" type="date" id="f-cf" value="${TF.created_from}" aria-label="${t("Skapad från")}">
      <input class="input" type="date" id="f-ct" value="${TF.created_to}" aria-label="${t("Skapad till")}"></div></div>
    <div class="field"><span class="label">${t("Avslutad mellan")}</span><div class="pair">
      <input class="input" type="date" id="f-xf" value="${TF.closed_from}" aria-label="${t("Avslutad från")}">
      <input class="input" type="date" id="f-xt" value="${TF.closed_to}" aria-label="${t("Avslutad till")}"></div></div>
    <button class="reset" type="button" id="f-reset">${t("Rensa filter")}</button>
  </div></aside>`;

  const setPanel = open => {
    FP.open = open; savePref("filterpanel", FP);
    $("#fpanel").hidden = !open; el.classList.toggle("no-aside", !open);
    $("#f-toggle").setAttribute("aria-expanded", String(open));
  };
  $("#f-toggle").addEventListener("click", () => setPanel(!FP.open));
  $("#f-close").addEventListener("click", () => setPanel(false));

  const readFilters = () => {
    TF = Object.assign(TF, { category: $("#f-cat").value, view: $("#f-view").value, priority: $("#f-prio").value, customer: $("#f-cust").value,
      assignee: $("#f-ass").value, created_from: $("#f-cf").value, created_to: $("#f-ct").value, closed_from: $("#f-xf").value, closed_to: $("#f-xt").value,
      sort: $("#t-sort").value });
    savePref("tickets", TF); TPAGE = 1; loadTickets();
  };
  ["#f-cat", "#f-view", "#f-prio", "#f-cust", "#f-ass", "#f-cf", "#f-ct", "#f-xf", "#f-xt", "#t-sort"].forEach(s => $(s).addEventListener("change", readFilters));
  let qTimer; $("#t-q").addEventListener("input", e => { clearTimeout(qTimer); qTimer = setTimeout(() => { TF.q = e.target.value; savePref("tickets", TF); TPAGE = 1; loadTickets(); }, 250); });
  $("#f-reset").addEventListener("click", () => { TF = Object.assign({}, TF_DEFAULT, { sort: TF.sort }); savePref("tickets", TF); TPAGE = 1; pageTickets({}); });
  $("#sel-all").addEventListener("change", e => { $$(".rowsel").forEach(c => { c.checked = e.target.checked; c.checked ? selected.add(+c.value) : selected.delete(+c.value); }); updateBulk(); });
  $("#b-clear").addEventListener("click", () => { selected.clear(); $$(".rowsel").forEach(c => c.checked = false); updateBulk(); });

  const bulk = async (action, btn, label) => {
    if (action === "delete" && armedBulk !== "delete") { armedBulk = "delete"; btn.classList.add("armed"); btn.textContent = t("Bekräfta: ta bort {n}", { n: selected.size }); return; }
    try {
      const r = await api("POST", "/api/tickets/bulk", { ids: [...selected], action });
      toast(t(label, { n: r.changed }));
      selected.clear(); armedBulk = null; loadTickets();
    } catch (e) { toast(e.message, true); }
  };
  $("#b-status").addEventListener("change", async e => {
    const st = e.target.value; if (!st) return;
    try {
      const r = await api("POST", "/api/tickets/bulk", { ids: [...selected], action: "status", status: st });
      const skipped = selected.size - r.changed;
      toast(t("{n} ärenden fick status {s}.", { n: r.changed, s: tv(st) }) + (skipped ? " " + t("{n} ändrades inte (hade redan statusen eller är låsta).", { n: skipped }) : ""));
      selected.clear(); loadTickets();
    } catch (ex) { toast(ex.message, true); }
    e.target.value = "";
  });
  $("#b-archive").addEventListener("click", e => bulk("archive", e.target, "{n} ärenden arkiverades."));
  $("#b-delete").addEventListener("click", e => bulk("delete", e.target, "{n} ärenden togs bort."));
  $("#b-archive-all").addEventListener("click", async e => {
    const btn = e.currentTarget;
    if (!btn.classList.contains("armed")) { btn.classList.add("armed", "btn-dark"); btn.textContent = t("Bekräfta arkivering"); return; }
    try { const r = await api("POST", "/api/tickets/archive-closed", {}); toast(t("{n} ärenden arkiverades.", { n: r.archived })); loadTickets(); }
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

function renderChips() {
  const box = $("#chips"); if (!box) return;
  const f = activeFilters();
  const fc = $("#fcount"); fc.hidden = !f.length; fc.textContent = f.length;
  const qchip = TF.q ? [["q", `${t("Sök")}: "${TF.q}"`]] : [];
  const all = [...qchip, ...f];
  box.hidden = !all.length;
  box.innerHTML = all.map(([k, l]) => `<span class="chip">${esc(l)}<button type="button" data-k="${k}" aria-label="${t("Ta bort filter {f}", { f: esc(l) })}">${ICON.x}</button></span>`).join("") +
    (all.length > 1 ? `<button type="button" class="textbtn" id="chips-clear">${t("Rensa alla")}</button>` : "");
  $$(".chip button", box).forEach(b => b.addEventListener("click", () => {
    const k = b.dataset.k;
    if (k === "view") TF.view = "open";
    else if (k === "created") { TF.created_from = ""; TF.created_to = ""; }
    else if (k === "closed") { TF.closed_from = ""; TF.closed_to = ""; }
    else TF[k] = "";
    savePref("tickets", TF); TPAGE = 1; pageTickets({});
  }));
  const cc = $("#chips-clear");
  if (cc) cc.addEventListener("click", () => { TF = Object.assign({}, TF_DEFAULT, { sort: TF.sort }); savePref("tickets", TF); TPAGE = 1; pageTickets({}); });
}

function updateBulk() {
  const n = selected.size;
  const bar = $("#bulk"); if (!bar) return;
  bar.hidden = !n;
  $("#bulk-n").textContent = t("{n} markerade", { n });
  const del = $("#b-delete");
  if (armedBulk !== "delete") { del.classList.remove("armed"); del.textContent = t("Ta bort"); }
  $$(".trow2").forEach(r => r.classList.toggle("sel", selected.has(+r.dataset.id)));
  const all = $$(".rowsel"); const sa = $("#sel-all");
  if (sa) { sa.checked = all.length > 0 && all.every(c => c.checked); sa.indeterminate = n > 0 && !sa.checked; }
}

async function loadTickets() {
  const list = $("#tlist"); if (!list) return;
  renderChips();
  let r, closedCount = 0;
  try {
    [r, closedCount] = await Promise.all([
      api("GET", "/api/tickets?" + ticketQuery()),
      api("GET", "/api/tickets?" + qs({ status: "closed", page: 1 })).then(x => x.total)
    ]);
  } catch (e) { list.innerHTML = `<p class="err">${esc(e.message)}</p>`; return; }
  const ab = $("#b-archive-all");
  ab.classList.remove("armed", "btn-dark");
  ab.textContent = t("Arkivera alla avslutade ({n})", { n: closedCount });
  ab.disabled = !closedCount;

  const pages = Math.max(1, Math.ceil(r.total / r.page_size));
  if (TPAGE > pages) { TPAGE = pages; return loadTickets(); }
  const first = r.total ? (r.page - 1) * r.page_size + 1 : 0, last = Math.min(r.total, r.page * r.page_size);
  $("#pager").innerHTML = `<span>${t("{a}–{b} av {n}", { a: first, b: last, n: r.total })}</span>
    <button type="button" data-p="1" ${TPAGE <= 1 ? "disabled" : ""} aria-label="${t("Första sidan")}">«</button>
    <button type="button" data-p="${TPAGE - 1}" ${TPAGE <= 1 ? "disabled" : ""} aria-label="${t("Föregående sida")}">‹</button>
    <button type="button" data-p="${TPAGE + 1}" ${TPAGE >= pages ? "disabled" : ""} aria-label="${t("Nästa sida")}">›</button>
    <button type="button" data-p="${pages}" ${TPAGE >= pages ? "disabled" : ""} aria-label="${t("Sista sidan")}">»</button>`;
  $$("#pager button").forEach(b => b.addEventListener("click", () => { TPAGE = +b.dataset.p; selected.clear(); loadTickets(); }));

  if (!r.items.length) {
    const filtered = activeFilters().length || TF.q;
    list.innerHTML = filtered
      ? emptyState(ICON.inbox, t("Inga ärenden matchar filtret."), `<button class="btn" type="button" id="es-clear">${t("Rensa filter")}</button>`)
      : emptyState(ICON.inbox, t("Inga öppna ärenden just nu."), `<a class="btn btn-mint" href="#/tickets/new">${ICON.plusSm}${t("Skapa ärende")}</a>`);
    const c = $("#es-clear");
    if (c) c.addEventListener("click", () => { TF = Object.assign({}, TF_DEFAULT, { sort: TF.sort }); savePref("tickets", TF); pageTickets({}); });
    updateBulk(); return;
  }
  const lockedFor = s => statusInfo(s).locked && S.user.role !== "admin";
  list.innerHTML = r.items.map(tk => `<div class="trow2" data-id="${tk.id}">
      <input type="checkbox" class="rowsel" value="${tk.id}" aria-label="${t("Markera ärende {id}", { id: tk.id })}"${selected.has(tk.id) ? " checked" : ""}>
      <div class="tm">
        <a class="ttl" href="#/tickets/${tk.id}">${esc(tk.title)}</a>
        <div class="sub"><span class="id">#${tk.id}</span>
          <span class="who">${tk.customer_name ? ini(tk.customer_name, "xs") + esc(tk.customer_name) : t("Ingen beställare")}${tk.customer_company ? ` · ${esc(tk.customer_company)}` : ""}</span>
          ${tk.category ? `<span>${esc(tv(tk.category))}</span>` : ""}${tk.archived_at ? `<span class="arch">${t("Arkiverad")}</span>` : ""}</div>
      </div>
      <div class="c-ag ag">${tk.assignee_name ? ini(tk.assignee_name, "xs") + `<span>${esc(tk.assignee_name)}</span>` : `<span class="unassigned">${t("Ej tilldelad")}</span>`}</div>
      <span class="c-date date">${fmtDate(tk.created_at)}</span>
      <select class="pill-sel p-${esc(tk.priority)}" data-id="${tk.id}" data-f="priority" aria-label="${t("Prioritet för ärende {id}", { id: tk.id })}">${prioOptions(tk.priority)}</select>
      <select class="pill-sel sc-${statusInfo(tk.status).color}" data-id="${tk.id}" data-f="status" aria-label="${t("Status för ärende {id}", { id: tk.id })}"${lockedFor(tk.status) ? ` disabled title="${t("Låst status – kan inte öppnas igen")}"` : ""}>${statusOptions(tk.status)}</select>
    </div>`).join("");
  $$(".rowsel", list).forEach(c => c.addEventListener("change", () => { c.checked ? selected.add(+c.value) : selected.delete(+c.value); armedBulk = null; updateBulk(); }));
  $$(".pill-sel", list).forEach(s => s.addEventListener("change", async () => {
    try { await api("PUT", "/api/tickets/" + s.dataset.id, { [s.dataset.f]: s.value }); toast(t("Ärende #{id} uppdaterat.", { id: s.dataset.id })); loadTickets(); }
    catch (e) { toast(e.message, true); loadTickets(); }
  }));
  updateBulk();
}

/* =========================================================== NYTT / VISA ÄRENDE */
async function pageTicket(id, query) {
  const el = shell("tickets", id ? t("Ärende") : t("Nytt ärende"), "ticket-layout");
  let tk = { title: "", details: "", priority: "Medium", category_id: "", assignee_id: "", status: "", customer_id: query.customer ? Number(query.customer) : null };
  if (id) {
    try { tk = await api("GET", "/api/tickets/" + id); viewTheme(tk.customer_theme); }
    catch (e) { el.innerHTML = `<section class="work">${emptyState(ICON.inbox, esc(e.message), `<a class="btn" href="#/tickets">${t("Tillbaka till ärenden")}</a>`)}</section>`; return; }
  }
  let customers = [];
  try { customers = (await api("GET", "/api/customers")).items; } catch (e) {}
  let custId = tk.customer_id, custQ = "", picking = !custId, addingCustomer = false, armedDel = false;
  const locked = id && tk.status_locked && S.user.role !== "admin";
  const firstOpen = (S.statusList.find(x => !x.closed) || { name: "Ny" }).name;

  el.innerHTML = `<section class="work"><div class="tform2">
      <div class="t-top"><a class="back" href="#/tickets">${ICON.back}${t("Ärenden")}</a>${id ? `<span class="num">#${id}</span>` : ""}</div>
      <label class="sr" for="t-title">${t("Titel")}</label>
      <input class="title-input" id="t-title" maxlength="200" value="${esc(tk.title)}" placeholder="${t("Rubrik för ärendet")}">
      <div class="field"><label for="t-details">${t("Beskrivning")}</label>
        <textarea class="input grow-ta" id="t-details" rows="5" placeholder="${t("Beskriv ärendet: vad har hänt, ordernummer, artikel …")}">${esc(tk.details)}</textarea></div>
      <div id="booking" class="booking" hidden></div>
      ${id ? `<section class="timeline" aria-labelledby="c-h">
        <h3 id="c-h">${t("Kommentarer")}</h3>
        <div id="c-list"></div>
        <div class="c-new">${ini(S.user.name, "sm")}
          <div class="c-new-box"><label for="c-body" class="sr">${t("Ny kommentar")}</label>
            <textarea class="input" id="c-body" rows="3" placeholder="${t("Skriv en kommentar …")}"></textarea>
            <div class="c-new-act"><button type="button" class="btn btn-dark btn-sm" id="c-add">${t("Lägg till kommentar")}</button></div></div>
        </div>
      </section>` : ""}
      <div class="savebar">
        <a class="textbtn" href="#/tickets">${t("Avbryt")}</a>
        <span class="grow"></span>
        <span class="muted" id="t-missing"></span>
        <button type="button" class="btn btn-dark" id="t-save">${ICON.save}${id ? t("Spara ändringar") : t("Skapa ärende")}</button>
      </div>
    </div></section>
    <aside class="aside meta" aria-label="${t("Ärendets uppgifter")}">
      <div class="meta-grid">
        <div class="field"><label for="t-status">${t("Status")}</label>
          ${id ? `<select class="input" id="t-status"${locked ? " disabled" : ""}>${statusOptions(tk.status)}</select>
            ${tk.status_locked ? `<span class="hint">${S.user.role === "admin" ? t("Låst status. Bara administratörer kan öppna ärendet igen.") : t("Låst status. Ärendet kan inte öppnas igen.")}</span>` : ""}`
            : `<div>${statusPill(firstOpen)}</div>`}</div>
        <div class="field"><label for="t-prio">${t("Prioritet")}</label><select class="input" id="t-prio">${prioOptions(tk.priority)}</select></div>
        <div class="field"><label for="t-cat">${t("Kategori")}</label><select class="input" id="t-cat"><option value="">${t("Ingen kategori")}</option>${catOptions(tk.category_id)}</select></div>
        <div class="field"><label for="t-ass">${t("Handläggare")}</label><select class="input" id="t-ass">${userOptions(tk.assignee_id, t("Ej tilldelad"), tk.assignee_id)}</select></div>
      </div>
      <div class="field"><span class="label">${t("Beställare_1")}</span><div id="req-box"></div></div>
      ${id ? `<dl class="dates">
        <div><dt>${t("Skapat")}</dt><dd>${fmtDT(tk.created_at)}${tk.created_by_name ? `<br><span class="muted">${t("av {n}", { n: esc(tk.created_by_name) })}</span>` : ""}</dd></div>
        <div><dt>${t("Senast ändrat")}</dt><dd>${fmtDT(tk.updated_at)}</dd></div>
        ${tk.closed_at ? `<div><dt>${t("Avslutat")}</dt><dd>${fmtDT(tk.closed_at)}</dd></div>` : ""}
        ${tk.archived_at ? `<div><dt>${t("Arkiverat")}</dt><dd>${fmtDT(tk.archived_at)}</dd></div>` : ""}
      </dl>
      <button type="button" class="btn btn-danger btn-sm" id="t-del">${t("Ta bort ärende")}</button>` : ""}
    </aside>`;

  const ta = $("#t-details");
  const grow = () => { ta.style.height = "auto"; ta.style.height = Math.max(120, Math.min(ta.scrollHeight + 2, 520)) + "px"; };
  ta.addEventListener("input", grow); grow();

  const renderReq = () => {
    const box = $("#req-box");
    if (addingCustomer) {
      box.innerHTML = customerForm({}, "nc");
      bindCustomerForm(box, "nc", null, c => { customers.push(c); custId = c.id; picking = false; addingCustomer = false; renderReq(); validate(); toast(t("{n} lades till.", { n: c.name })); },
        () => { addingCustomer = false; renderReq(); });
      return;
    }
    const sel = customers.find(c => c.id === custId);
    if (sel && !picking) {
      box.innerHTML = `<div class="req-card">${ini(sel.name, "md")}<div class="rc-txt"><div class="n">${esc(sel.name)}</div>
        ${sel.company ? `<div class="c">${esc([sel.company, sel.title].filter(Boolean).join(", "))}</div>` : ""}
        ${sel.phone ? `<div class="c">${esc(sel.phone)}</div>` : ""}${sel.email ? `<div class="c">${esc(sel.email)}</div>` : ""}</div>
        <button type="button" class="btn btn-sm" id="req-change">${t("Byt")}</button></div>`;
      $("#req-change").addEventListener("click", () => { picking = true; renderReq(); $("#c-q").focus(); });
      return;
    }
    const q = custQ.trim().toLowerCase();
    const matches = customers.filter(c => !q || [c.name, c.company, c.email, c.phone].join(" ").toLowerCase().includes(q)).slice(0, 30);
    box.innerHTML = `<div class="picker">
      <label class="searchbar sm">${ICON.search}<input id="c-q" type="search" placeholder="${t("Sök beställare")}" value="${esc(custQ)}" aria-label="${t("Sök beställare")}"></label>
      <div class="plist">${matches.length ? matches.map(c => `<button type="button" class="pitem" data-id="${c.id}" aria-pressed="${c.id === custId}">${ini(c.name, "sm")}<span><span class="n">${esc(c.name)}</span><span class="c">${esc(c.company || c.email || "")}</span></span></button>`).join("")
        : `<p class="muted" style="margin:6px 4px">${customers.length ? t("Ingen beställare matchar sökningen.") : t("Inga beställare ännu. Lägg till den första.")}</p>`}</div>
      <div class="picker-foot"><button type="button" class="textbtn" id="c-new">${ICON.plusSm}${t("Lägg till ny beställare")}</button>
        ${custId ? `<button type="button" class="textbtn" id="c-cancel">${t("Avbryt")}</button>` : ""}</div></div>`;
    const qi = $("#c-q");
    qi.addEventListener("input", () => { custQ = qi.value; const pos = qi.selectionStart; renderReq(); const n = $("#c-q"); n.focus(); n.setSelectionRange(pos, pos); });
    $("#c-new").addEventListener("click", () => { addingCustomer = true; renderReq(); });
    if ($("#c-cancel")) $("#c-cancel").addEventListener("click", () => { picking = false; renderReq(); });
    $$(".pitem", box).forEach(b => b.addEventListener("click", () => { custId = +b.dataset.id; picking = false; custQ = ""; renderReq(); validate(); }));
  };

  const validate = () => {
    const miss = [];
    if (!$("#t-title").value.trim()) miss.push(t("titel"));
    if (!custId) miss.push(t("beställare"));
    $("#t-save").disabled = miss.length > 0;
    $("#t-missing").textContent = miss.length ? t("Ange {x} för att spara.", { x: miss.join(" " + t("och") + " ") }) : "";
  };
  $("#t-title").addEventListener("input", validate);
  $("#t-title").addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); save(); } });

  const renderBooking = () => {
    const box = $("#booking");
    if (!S.bookingCat || String($("#t-cat").value) !== String(S.bookingCat)) { box.hidden = true; return; }
    const u = S.users.find(x => String(x.id) === $("#t-ass").value);
    let inner;
    if (!u) inner = `<p>${t("Välj en handläggare för att kunna boka en tid.")}</p>`;
    else if (!u.booking_url) inner = `<p>${t("{n} har ingen bokningssida inlagd. Den läggs in under Inställningar.", { n: esc(u.name) })}</p>`;
    else inner = `<a class="btn btn-mint" href="${esc(u.booking_url)}" target="_blank" rel="noopener">${ICON.plusSm}${t("Boka tid hos {n}", { n: esc(u.name) })}</a>
      <p>${t("Bokningen görs i Microsoft Bookings och öppnas i en ny flik.")}</p>`;
    box.innerHTML = `<h3>${t("IT-support: boka tid")}</h3>${inner}`;
    box.hidden = false;
  };
  $("#t-cat").addEventListener("change", renderBooking);
  $("#t-ass").addEventListener("change", renderBooking);
  renderBooking(); renderReq(); validate();
  if (!id) $("#t-title").focus();

  const renderComments = list => {
    const box = $("#c-list"); if (!box) return;
    box.innerHTML = list.length ? list.map(c => `<article class="tl-item">${ini(c.author || "?", "sm")}
        <div class="tl-body"><div class="c-meta"><b>${esc(c.author || t("Okänd"))}</b><span>${fmtDT(c.created_at)}</span>
          ${c.user_id === S.user.id || S.user.role === "admin" ? `<button type="button" class="textbtn danger c-del" data-id="${c.id}">${t("Ta bort")}</button>` : ""}</div>
        <div class="c-body">${esc(c.body)}</div></div></article>`).join("")
      : `<p class="muted tl-empty">${t("Inga kommentarer ännu. Skriv den första nedan.")}</p>`;
    $$(".c-del", box).forEach(b => b.addEventListener("click", async () => {
      if (!b.classList.contains("armed")) { b.classList.add("armed"); b.textContent = t("Bekräfta"); return; }
      try { renderComments((await api("DELETE", "/api/comments/" + b.dataset.id)).comments); } catch (ex) { toast(ex.message, true); }
    }));
  };
  if (id) {
    renderComments(tk.comments || []);
    $("#c-add").addEventListener("click", async () => {
      const body = $("#c-body").value.trim();
      if (!body) { $("#c-body").focus(); return; }
      try { renderComments((await api("POST", `/api/tickets/${id}/comments`, { body })).comments); $("#c-body").value = ""; toast(t("Kommentaren sparades.")); }
      catch (ex) { toast(ex.message, true); }
    });
    $("#t-del").addEventListener("click", async e => {
      const b = e.currentTarget;
      if (!armedDel) { armedDel = true; b.classList.add("armed"); b.textContent = t("Bekräfta: ta bort"); return; }
      try { await api("DELETE", "/api/tickets/" + id); toast(t("Ärende #{id} togs bort.", { id })); location.hash = "#/tickets"; }
      catch (ex) { toast(ex.message, true); }
    });
  }

  async function save() {
    validate(); if ($("#t-save").disabled) return;
    const data = { title: $("#t-title").value, details: $("#t-details").value, priority: $("#t-prio").value,
      category_id: $("#t-cat").value || null, assignee_id: $("#t-ass").value || null, customer_id: custId };
    if (id && !$("#t-status").disabled) data.status = $("#t-status").value;
    $("#t-save").disabled = true;
    try {
      if (id) { const r = await api("PUT", "/api/tickets/" + id, data); toast(t("Ärendet sparades.") + notifyText(r)); pageTicket(id, {}); }
      else { const r = await api("POST", "/api/tickets", data); toast(t("Ärende #{id} skapades.", { id: r.id }) + notifyText(r)); location.hash = "#/tickets/" + r.id; }
    } catch (ex) { toast(ex.message, true); validate(); }
  }
  $("#t-save").addEventListener("click", save);
}

function notifyText(r) {
  if (!r || !r.notify) return "";
  return " " + (r.notify.sent ? t("Mail skickas till {to}.", { to: r.notify.to }) : t("Inget mail skickades: {r}", { r: tErr(r.notify.reason) }));
}

/* ---------------- beställarformulär (används på flera ställen) ---------------- */
function customerForm(c, p) {
  const f = (k, label, type = "text", ac = "") => `<input class="input" id="${p}-${k}" type="${type}" value="${esc(c[k] || "")}" placeholder="${label}" aria-label="${label}"${ac ? ` autocomplete="${ac}"` : ""}>`;
  return `<form class="pform" id="${p}-form" novalidate>
    <h3>${t("Personligt")}</h3>${f("first_name", t("Förnamn"))}${f("last_name", t("Efternamn"))}
    <h3>${t("Företag")}</h3>${f("company", t("Företag"))}${f("title", t("Titel"))}
    <h3>${t("Kontakt")}</h3>${f("phone", t("Telefon"), "tel")}${f("email", t("E-post"), "email")}
    <h3>${t("Tema")}</h3><select class="input" id="${p}-theme" aria-label="${t("Tema")}">
      <option value="">${t("Standard (handläggarens eget tema)")}</option>
      ${THEMES.map(x => `<option value="${x[0]}"${c.theme === x[0] ? " selected" : ""}>${esc(t(x[1]))} – ${esc(t(x[3]))}</option>`).join("")}</select>
    <p class="err" id="${p}-err" hidden></p>
    <div class="actions"><button type="button" class="textbtn" id="${p}-cancel">${t("Avbryt")}</button><button type="submit" class="btn btn-dark">${ICON.check}${t("Spara")}</button></div>
  </form>`;
}
function bindCustomerForm(scope, p, existingId, onSaved, onCancel) {
  $(`#${p}-cancel`, scope).addEventListener("click", onCancel);
  const first = $(`#${p}-first_name`, scope); first.focus();
  $(`#${p}-form`, scope).addEventListener("submit", async e => {
    e.preventDefault();
    const data = {}; ["first_name", "last_name", "company", "title", "phone", "email"].forEach(k => data[k] = $(`#${p}-${k}`, scope).value.trim());
    data.theme = $(`#${p}-theme`, scope).value;
    const err = $(`#${p}-err`, scope); err.hidden = true;
    if (!data.first_name) { err.textContent = t("Ange förnamn."); err.hidden = false; first.setAttribute("aria-invalid", "true"); return; }
    if (data.email && !EMAIL_RE.test(data.email)) { err.textContent = t("E-postadressen ser inte giltig ut."); err.hidden = false; return; }
    try { const c = await api(existingId ? "PUT" : "POST", "/api/customers" + (existingId ? "/" + existingId : ""), data); onSaved(c); }
    catch (ex) { err.textContent = ex.message; err.hidden = false; }
  });
}

/* =========================================================== KUNDER */
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZÅÄÖ".split("");
async function renderCustomers(el, selId) {
  let customers = [], q = "", sel = selId, editing = false, creating = false;
  const csel = new Set(); let armedDel = false;
  el.innerHTML = `<section class="req-main">
      <div class="toolbar">
        <label class="check"><input type="checkbox" id="cs-all"> ${t("Markera alla")}</label>
        <button class="textbtn danger" id="cs-del" type="button" disabled>${t("Ta bort")}</button>
        <span class="grow"></span>
        <input class="input search" id="cs-q" type="search" placeholder="${t("Sök namn, företag, telefon")}" aria-label="${t("Sök beställare")}">
        <button class="btn btn-mint" id="cs-new" type="button">${ICON.plusSm}${t("Ny beställare")}</button>
      </div>
      <div class="cwrap"><nav class="letters" id="letters" aria-label="${t("Hoppa till bokstav")}"></nav><div class="tscroll" id="ctable"></div></div>
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
    if (!list.length) {
      $("#ctable").innerHTML = customers.length ? emptyState(ICON.people, t("Ingen beställare matchar sökningen."))
        : emptyState(ICON.people, t("Inga beställare ännu."), `<button class="btn btn-mint" type="button" id="es-new">${ICON.plusSm}${t("Ny beställare")}</button>`);
      const b = $("#es-new"); if (b) b.addEventListener("click", () => $("#cs-new").click());
      updateSel(); return;
    }
    const keys = Object.keys(groups).sort((a, b) => a.localeCompare(b, "sv"));
    $("#ctable").innerHTML = `<table class="ctable"><thead><tr><th class="w-check"></th><th class="w-av"></th><th>${t("Namn")}</th><th>${t("Företag")}</th><th>${t("Telefon")}</th><th>${t("Öppna ärenden")}</th></tr></thead><tbody>
      ${keys.map(k => `<tr class="grp" id="grp-${esc(k)}"><td colspan="6"><span class="grp-badge">${esc(k)}</span></td></tr>` +
        groups[k].map(c => `<tr class="crow" data-id="${c.id}" aria-selected="${c.id === sel}">
          <td><input type="checkbox" class="csel" value="${c.id}" aria-label="${t("Markera {n}", { n: esc(c.name) })}"${csel.has(c.id) ? " checked" : ""}></td>
          <td>${ini(c.name, "sm")}</td><td>${esc(c.name)}</td><td>${esc(c.company)}</td><td>${esc(c.phone)}</td><td>${c.open_count || 0}</td></tr>`).join("")).join("")}
      </tbody></table>`;
    $$(".crow").forEach(r => r.addEventListener("click", e => {
      if (e.target.closest("input")) return;
      sel = +r.dataset.id; editing = false; creating = false;
      history.replaceState(null, "", "#/settings/requesters/" + sel);
      $$(".crow").forEach(x => x.setAttribute("aria-selected", String(+x.dataset.id === sel)));
      renderDetail();
    }));
    $$(".csel").forEach(c => c.addEventListener("change", () => { c.checked ? csel.add(+c.value) : csel.delete(+c.value); armedDel = false; updateSel(); }));
    updateSel();
  };
  const updateSel = () => {
    const b = $("#cs-del"); b.disabled = !csel.size;
    if (!armedDel) { b.classList.remove("armed"); b.textContent = csel.size ? `${t("Ta bort")} (${csel.size})` : t("Ta bort"); }
    const all = $$(".csel"); $("#cs-all").checked = all.length > 0 && all.every(c => c.checked);
  };

  const renderDetail = async () => {
    const a = $("#cdetail");
    if (creating) {
      a.innerHTML = `<div class="hd"><h2>${t("Ny beställare")}</h2></div><div style="height:20px"></div>${customerForm({}, "cc")}`;
      bindCustomerForm(a, "cc", null, async c => { creating = false; sel = c.id; await reload(); toast(t("{n} lades till.", { n: c.name })); }, () => { creating = false; renderDetail(); });
      return;
    }
    if (!sel) { viewTheme(null); a.innerHTML = `<div class="hd"><h2>${t("Beställardetaljer")}</h2></div><p class="placeholder" style="margin-top:24px">${t("Välj en beställare i listan för att se kontaktuppgifter och ärenden.")}</p>`; return; }
    let c;
    try { c = await api("GET", "/api/customers/" + sel); } catch (e) { a.innerHTML = `<p class="placeholder">${esc(e.message)}</p>`; return; }
    viewTheme(c.theme);
    if (editing) {
      a.innerHTML = `<div class="hd"><h2>${t("Redigera beställare")}</h2></div><div style="height:20px"></div>${customerForm(c, "ce")}`;
      bindCustomerForm(a, "ce", c.id, async () => { editing = false; await reload(); toast(t("Beställaren sparades.")); }, () => { editing = false; renderDetail(); });
      return;
    }
    a.innerHTML = `<div class="hd"><h2>${t("Beställardetaljer")}</h2></div>
      <div class="links"><button type="button" id="cd-edit">${t("Redigera")}</button><button type="button" id="cd-close">${t("Stäng")}</button></div>
      ${ini(c.name, "lg")}
      <div class="nm">${esc(c.name)}</div>
      <div class="co">${esc([c.company, c.title].filter(Boolean).join(", ")) || "&nbsp;"}</div>
      <div class="ct">${c.phone ? `<span>${esc(c.phone)}</span>` : ""}${c.email ? `<span>${esc(c.email)}</span>` : ""}${!c.phone && !c.email ? `<span>${t("Inga kontaktuppgifter")}</span>` : ""}</div>
      <div class="ctheme">${ICON.palette}<span>${c.theme ? esc(themeName(c.theme)) : t("Standardtema")}</span></div>
      <div class="rt"><h3>${t("Senaste ärenden")}</h3><a class="btn btn-mint" href="#/tickets/new?customer=${c.id}">${ICON.plusSm}${t("Nytt")}</a></div>
      ${c.tickets.length ? c.tickets.map(t => `<a class="rtc" href="#/tickets/${t.id}"><div class="top"><span>#${t.id} · ${esc(tv(t.status))}${t.archived_at ? " · " + tr("arkiverat") : ""}</span><span>${fmtDate(t.created_at)}</span></div>
        <div class="t">${esc(t.title)}</div>${t.details ? `<div class="d">${esc(t.details)}</div>` : ""}</a>`).join("") : `<div class="dark-empty"><p>${t("Inga ärenden ännu.")}</p><a class="btn btn-mint" href="#/tickets/new?customer=${c.id}">${ICON.plusSm}${t("Skapa ärende")}</a></div>`}`;
    $("#cd-edit").addEventListener("click", () => { editing = true; renderDetail(); });
    $("#cd-close").addEventListener("click", () => { sel = null; history.replaceState(null, "", "#/settings/requesters"); $$(".crow").forEach(x => x.setAttribute("aria-selected", "false")); renderDetail(); });
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
    if (!armedDel) { armedDel = true; b.classList.add("armed"); b.textContent = t("Bekräfta: ta bort {n}", { n: csel.size }); return; }
    try {
      const r = await api("POST", "/api/customers/delete", { ids: [...csel] });
      let msg = t("{n} beställare togs bort.", { n: r.deleted });
      if (r.blocked) msg += " " + t("{n} beställare har ärenden och togs inte bort.", { n: r.blocked });
      toast(msg, r.blocked > 0 && !r.deleted);
      if (csel.has(sel)) sel = null;
      csel.clear(); armedDel = false; reload();
    } catch (ex) { toast(ex.message, true); }
  });
  reload();
}

/* =========================================================== INSTÄLLNINGAR */
async function pageSettings(tab, sub) {
  const el = shell("settings", t("Inställningar"), "single");
  const admin = S.user.role === "admin";
  const TABS = [["account", t("Mitt konto")], ["requesters", t("Beställare")], ...(admin ? [["users", t("Användare")], ["statuses", t("Statusar")], ["categories", t("Kategorier")], ["mail", t("E-post")]] : []), ["export", t("Export och säkerhetskopia")]];
  if (!TABS.some(x => x[0] === tab)) tab = "account";
  let editUser = null, addingUser = false, editCat = null, armedCat = null;
  el.innerHTML = `<section class="work">
    <nav class="stabs" role="tablist" aria-label="${t("Inställningar")}">${TABS.map(([k, l]) => `<button type="button" role="tab" data-tab="${k}" aria-selected="${k === tab}">${l}</button>`).join("")}</nav>
    <div class="spanes">
      ${admin ? `<div class="box" id="box-users" data-pane="users"></div>` : ""}
      <div class="box" data-pane="account"><h2>${t("Mitt konto")}</h2><p class="lead">${esc(S.user.name)} · ${esc(S.user.email)}</p>
        <div class="pform"><h3>${t("Språk")}</h3><p class="muted" style="margin:0">${t("Gäller gränssnittet och mail som skickas till dig.")}</p>${langSwitch("box-lang")}</div>
        <div class="pform" style="margin-top:22px"><h3>${t("Färgtema")}</h3><p class="muted" style="margin:0">${t("Sparas i den här webbläsaren.")}</p>
          <div class="theme-pick" role="group" aria-label="${t("Färgtema")}">${THEMES.map(([k, n, d, cd, sw]) => `<button type="button" data-theme-k="${k}" aria-pressed="${(document.documentElement.dataset.theme || "lila") === k}"><span class="sw">${sw.map(c => `<i style="background:${c}"></i>`).join("")}</span><span class="tn">${t(n)}</span><span class="td">${t(d)}</span></button>`).join("")}</div></div>
        <form id="bk-form" class="pform" novalidate style="margin-top:22px">
          <h3>${t("Min bokningssida")}</h3>
          <p class="muted" style="margin:0">${t("Länken till din sida i Microsoft Bookings. Den visas i ärenden med kategorin för tidsbokning.")}</p>
          <input class="input" type="url" id="bk-url" placeholder="https://outlook.office365.com/book/…" aria-label="${t("Bokningssida")}" value="${esc(S.user.booking_url || "")}">
          <p class="err" id="bk-err" hidden></p>
          <div class="actions"><span></span><button class="btn btn-dark" type="submit">${t("Spara bokningssida")}</button></div>
        </form>
        <form id="pw-form" class="pform" novalidate style="margin-top:22px">
          <h3>${t("Byt lösenord")}</h3>
          <input class="input" type="password" id="pw-cur" placeholder="${t("Nuvarande lösenord")}" aria-label="${t("Nuvarande lösenord")}" autocomplete="current-password">
          <input class="input" type="password" id="pw-new" placeholder="${t("Nytt lösenord (minst 8 tecken)")}" aria-label="${t("Nytt lösenord")}" autocomplete="new-password">
          <input class="input" type="password" id="pw-new2" placeholder="${t("Upprepa nytt lösenord")}" aria-label="${t("Upprepa nytt lösenord")}" autocomplete="new-password">
          <p class="err" id="pw-err" hidden></p>
          <div class="actions"><span></span><button class="btn btn-dark" type="submit">${t("Byt lösenord")}</button></div>
        </form></div>
      ${admin ? `<div class="box" id="box-status" data-pane="statuses"></div><div class="box" id="box-mail" data-pane="mail"></div><div class="box" id="box-cats" data-pane="categories"></div>` : ""}
      <div class="box" data-pane="export"><h2>${t("Export")}</h2><p class="lead">${t("Ladda ner alla ärenden, arkivet, beställarregistret och kommentarerna som en Excel-fil.")}</p>
        <a class="btn" href="/api/export.xlsx?tz=${TZ()}&lang=${LANG}">${ICON.excel}${t("Exportera till Excel")}</a></div>
      ${admin ? `<div class="box" data-pane="export"><h2>${t("Säkerhetskopia")}</h2><p class="lead">${t("Ladda ner en kopia av hela databasen. Spara den på ett säkert ställe.")}</p>
        <a class="btn" href="/api/backup.db">${ICON.save}${t("Ladda ner säkerhetskopia")}</a></div>` : ""}
    </div>
    <div class="req-pane" id="req-pane" data-pane="requesters"></div></section>`;
  let reqRendered = false;
  const showTab = k => {
    $$(".stabs [data-tab]", el).forEach(b => b.setAttribute("aria-selected", String(b.dataset.tab === k)));
    $$("[data-pane]", el).forEach(p => p.hidden = p.dataset.pane !== k);
    $(".spanes", el).hidden = k === "requesters";
    if (k === "requesters" && !reqRendered) { reqRendered = true; renderCustomers($("#req-pane"), k === tab ? sub : null); }
  };
  showTab(tab);
  $$(".stabs [data-tab]", el).forEach(b => b.addEventListener("click", () => { history.replaceState(null, "", "#/settings/" + b.dataset.tab); showTab(b.dataset.tab); }));

  bindLang($(".box-lang", el).parentElement, route);
  $$("[data-theme-k]", el).forEach(b => b.addEventListener("click", () => {
    applyTheme(b.dataset.themeK); savePref("theme", { k: b.dataset.themeK });
    $$("[data-theme-k]", el).forEach(x => x.setAttribute("aria-pressed", String(x === b)));
  }));
  $("#bk-form").addEventListener("submit", async e => {
    e.preventDefault();
    const err = $("#bk-err"); err.hidden = true;
    try { S.user = await api("PUT", "/api/me", { booking_url: $("#bk-url").value.trim() }); await loadRefs(); toast(t("Bokningssidan sparades.")); }
    catch (ex) { err.textContent = ex.message; err.hidden = false; }
  });
  $("#pw-form").addEventListener("submit", async e => {
    e.preventDefault();
    const err = $("#pw-err"); err.hidden = true;
    if ($("#pw-new").value !== $("#pw-new2").value) { err.textContent = t("De nya lösenorden matchar inte."); err.hidden = false; return; }
    try { await api("POST", "/api/me/password", { current: $("#pw-cur").value, new: $("#pw-new").value }); e.target.reset(); toast(t("Lösenordet byttes.")); }
    catch (ex) { err.textContent = ex.message; err.hidden = false; }
  });
  if (!admin) return;

  const userForm = (u, p) => `<form class="inline-form" id="${p}" novalidate>
    <input class="input" id="${p}-name" placeholder="${t("Namn")}" aria-label="${t("Namn")}" value="${esc(u.name || "")}">
    <input class="input" id="${p}-email" type="email" placeholder="${t("E-post")}" aria-label="${t("E-post")}" value="${esc(u.email || "")}">
    <select class="input" id="${p}-role" aria-label="${t("Roll")}"><option value="agent"${u.role !== "admin" ? " selected" : ""}>${t("Handläggare")}</option><option value="admin"${u.role === "admin" ? " selected" : ""}>${t("Administratör")}</option></select>
    <input class="input" id="${p}-pw" type="password" autocomplete="new-password" placeholder="${u.id ? t("Nytt lösenord (lämna tomt för att behålla)") : t("Lösenord (minst 8 tecken)")}" aria-label="${t("Lösenord")}">
    <select class="input" id="${p}-lang" aria-label="${t("Språk")}"><option value="sv"${(u.lang || "sv") === "sv" ? " selected" : ""}>Svenska</option><option value="en"${u.lang === "en" ? " selected" : ""}>English</option></select>
    <input class="input" id="${p}-burl" type="url" placeholder="${t("Bokningssida i Microsoft Bookings (https://…), valfritt")}" aria-label="${t("Bokningssida")}" value="${esc(u.booking_url || "")}">
    ${u.id ? `<label class="check full"><input type="checkbox" id="${p}-active"${u.active ? " checked" : ""}> ${t("Aktivt konto (kan logga in)")}</label>` : ""}
    <p class="err full" id="${p}-err" hidden></p>
    <div class="row"><button type="button" class="textbtn" id="${p}-cancel">${t("Avbryt")}</button><button type="submit" class="btn btn-dark">${u.id ? t("Spara") : t("Lägg till")}</button></div>
  </form>`;

  const renderUsers = () => {
    const box = $("#box-users");
    box.innerHTML = `<h2>${t("Användare")}</h2><p class="lead">${t("Handläggare kan tilldelas ärenden. Administratörer kan även hantera användare och kategorier.")}</p>
      <ul class="ulist">${S.users.map(u => editUser === u.id ? `<li style="display:block">${userForm(u, "uf")}</li>` : `<li>${ini(u.name, "sm")}
        <div class="who"><div>${esc(u.name)}${u.id === S.user.id ? " (" + t("du") + ")" : ""}</div><div class="e">${esc(u.email)}</div></div>
        <span class="tag ${u.role === "admin" ? "admin" : ""}">${u.role === "admin" ? t("Administratör") : t("Handläggare")}</span>
        ${u.active ? "" : `<span class="tag off">${t("Inaktiv")}</span>`}
        <button class="btn btn-sm" type="button" data-edit="${u.id}">${t("Ändra")}</button></li>`).join("")}</ul>
      ${addingUser ? userForm({}, "un") : `<button class="btn" type="button" id="u-add">${ICON.plusSm}${t("Lägg till användare")}</button>`}`;
    $$("[data-edit]", box).forEach(b => b.addEventListener("click", () => { editUser = +b.dataset.edit; addingUser = false; renderUsers(); }));
    if ($("#u-add")) $("#u-add").addEventListener("click", () => { addingUser = true; editUser = null; renderUsers(); $("#un-name").focus(); });
    const bind = (p, id) => {
      const f = $("#" + p); if (!f) return;
      $(`#${p}-cancel`).addEventListener("click", () => { editUser = null; addingUser = false; renderUsers(); });
      f.addEventListener("submit", async e => {
        e.preventDefault();
        const data = { name: $(`#${p}-name`).value, email: $(`#${p}-email`).value, role: $(`#${p}-role`).value, password: $(`#${p}-pw`).value };
        data.booking_url = $(`#${p}-burl`).value.trim(); data.lang = $(`#${p}-lang`).value;
        if (id) data.active = $(`#${p}-active`).checked;
        try {
          await api(id ? "PUT" : "POST", "/api/users" + (id ? "/" + id : ""), data);
          await loadRefs(); editUser = null; addingUser = false; renderUsers(); toast(id ? t("Användaren sparades.") : t("Användaren lades till."));
        } catch (ex) { const er = $(`#${p}-err`); er.textContent = ex.message; er.hidden = false; }
      });
    };
    bind("uf", editUser); bind("un", null);
  };

  let renderBookingCatHook = () => {};
  const renderCats = () => {
    const box = $("#box-cats");
    box.innerHTML = `<h2>${t("Kategorier")}</h2><p class="lead">${t("Används för att sortera ärenden. Tar du bort en kategori blir ärendena utan kategori.")}</p>
      <ul class="ulist">${S.categories.map(c => editCat === c.id
        ? `<li><div class="add-row" style="flex:1"><input class="input" id="cat-edit" value="${esc(c.name)}" aria-label="${t("Nytt namn")}"><button class="btn btn-dark btn-sm" type="button" data-save="${c.id}">${t("Spara")}</button><button class="textbtn" type="button" data-cancel>${t("Avbryt")}</button></div></li>`
        : `<li><div class="who">${esc(c.name)}${tv(c.name) !== c.name ? ` <span class="muted">(${esc(tv(c.name))})</span>` : ""}<div class="e">${c.used === 1 ? t("1 ärende") : t("{n} ärenden", { n: c.used })}</div></div>
          <button class="btn btn-sm" type="button" data-cedit="${c.id}">${t("Byt namn")}</button>
          <button class="btn btn-sm btn-danger${armedCat === c.id ? " armed" : ""}" type="button" data-cdel="${c.id}">${armedCat === c.id ? t("Bekräfta") : t("Ta bort")}</button></li>`).join("")}</ul>
      <form class="add-row" id="cat-add" novalidate><input class="input" id="cat-new" placeholder="${t("Ny kategori")}" aria-label="${t("Ny kategori")}" maxlength="60"><button class="btn" type="submit">${t("Lägg till")}</button></form>`;
    const refresh = async () => { S.categories = (await api("GET", "/api/categories")).items; renderCats(); };
    $$("[data-cedit]", box).forEach(b => b.addEventListener("click", () => { editCat = +b.dataset.cedit; armedCat = null; renderCats(); $("#cat-edit").focus(); }));
    $$("[data-cancel]", box).forEach(b => b.addEventListener("click", () => { editCat = null; renderCats(); }));
    $$("[data-save]", box).forEach(b => b.addEventListener("click", async () => {
      try { await api("PUT", "/api/categories/" + b.dataset.save, { name: $("#cat-edit").value }); editCat = null; await refresh(); } catch (e) { toast(e.message, true); }
    }));
    $$("[data-cdel]", box).forEach(b => b.addEventListener("click", async () => {
      const id = +b.dataset.cdel;
      if (armedCat !== id) { armedCat = id; renderCats(); return; }
      try { await api("DELETE", "/api/categories/" + id); armedCat = null; await refresh(); toast(t("Kategorin togs bort.")); } catch (e) { toast(e.message, true); }
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
    box.innerHTML = `<h2>${t("E-post")}</h2>
      <p class="lead">${t("Handläggaren får ett mail när ett ärende tilldelas hen. Uppgifterna får du av IT.")}</p>
      <form class="inline-form" id="mail-form" novalidate>
        <label class="check full"><input type="checkbox" id="m-on"${m.smtp_enabled === "1" ? " checked" : ""}> ${t("Skicka mail vid tilldelning")}</label>
        <div class="field"><label for="m-host">${t("SMTP-server")}</label><input class="input" id="m-host" value="${v("smtp_host")}" placeholder="smtp.office365.com"></div>
        <div class="field"><label for="m-port">Port</label><input class="input" id="m-port" inputmode="numeric" value="${v("smtp_port") || 587}"></div>
        <div class="field"><label for="m-sec">${t("Kryptering")}</label><select class="input" id="m-sec">
          ${[["starttls", t("STARTTLS (vanligast, port 587)")], ["ssl", t("SSL/TLS (port 465)")], ["none", t("Ingen (intern server, port 25)")]].map(([k, l]) => `<option value="${k}"${(m.smtp_security || "starttls") === k ? " selected" : ""}>${l}</option>`).join("")}</select></div>
        <div class="field full" id="m-tls-wrap"><label for="m-tls">${t("Certifikatkontroll")}</label><select class="input" id="m-tls">
          ${[["verify", t("Kontrollera (rekommenderas)")], ["pinned", t("Lita på serverns certifikat")], ["none", t("Kontrollera inte (osäkert)")]].map(([k, l]) => `<option value="${k}"${(m.smtp_tls_verify || "verify") === k ? " selected" : ""}>${l}</option>`).join("")}</select></div>
        <div class="field full" id="m-pin-wrap">
          <label for="m-pem">${t("Serverns certifikat")}</label>
          <textarea class="input mono" id="m-pem" rows="5" placeholder="-----BEGIN CERTIFICATE-----" style="min-height:110px">${v("smtp_ca_pem")}</textarea>
          <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap"><button type="button" class="btn btn-sm" id="m-fetch">${t("Hämta certifikat från servern")}</button><span class="muted" id="m-fp" style="font-size:.85rem;overflow-wrap:anywhere"></span></div>
          <p class="muted" style="margin:0;font-size:.85rem">${t("Jämför gärna fingeravtrycket med IT innan du sparar. Bara exakt det här certifikatet godkänns.")}</p>
        </div>
        <p class="err full" id="m-none-warn" style="margin:0">${t("Utan kontroll krypteras trafiken men det går inte att veta att det är rätt server. Använd bara tillfälligt.")}</p>
        <div class="field"><label for="m-user">${t("Användarnamn")}</label><input class="input" id="m-user" value="${v("smtp_user")}" autocomplete="off" placeholder="${t("Lämna tomt om ingen inloggning")}"></div>
        <div class="field"><label for="m-pw">${t("Lösenord")}</label><input class="input" id="m-pw" type="password" autocomplete="new-password" placeholder="${m.has_password ? t("Sparat (lämna tomt för att behålla)") : t("Inget sparat")}"></div>
        <div class="field"><label for="m-from">${t("Avsändaradress")}</label><input class="input" id="m-from" type="email" value="${v("smtp_from")}" placeholder="it-support@foretag.se"></div>
        <div class="field"><label for="m-name">${t("Avsändarnamn")}</label><input class="input" id="m-name" value="${v("smtp_from_name")}" placeholder="IT-support"></div>
        <div class="field full"><label for="m-base">${t("Systemets adress (för länken i mailet)")}</label><input class="input" id="m-base" value="${v("base_url")}" placeholder="http://nas-namn:8000"></div>
        ${last ? `<p class="full ${last.error ? "err" : "muted"}" style="margin:0">${last.error ? esc(tErr(last.error)) : t("Senaste mailet skickades {d}.", { d: fmtDT(last.at) })}</p>` : ""}
        <p class="err full" id="m-err" hidden></p>
        <div class="row"><button type="button" class="btn" id="m-test">${t("Skicka testmail till mig")}</button><button type="submit" class="btn btn-dark">${t("Spara")}</button></div>
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
        toast(t("Certifikatet hämtades. Klicka Spara för att godkänna det."));
      } catch (ex) { showErr(ex.message); }
    });
    $("#mail-form").addEventListener("submit", async e => {
      e.preventDefault();
      try { await api("PUT", "/api/settings", { smtp: read() }); toast(t("Mailinställningarna sparades.")); renderMail(); } catch (ex) { showErr(ex.message); }
    });
    $("#m-test").addEventListener("click", async () => {
      $("#m-err").hidden = true;
      try { await api("PUT", "/api/settings", { smtp: read() }); const r = await api("POST", "/api/settings/test-mail", {}); toast(t("Testmail skickat till {to}.", { to: r.to })); }
      catch (ex) { showErr(ex.message); }
    });
  };

  const renderBookingCat = async () => {
    let st; try { st = await api("GET", "/api/settings"); } catch (e) { return; }
    const box = $("#box-cats");
    const old = $("#bk-cat-wrap"); if (old) old.remove();
    const div = document.createElement("div");
    div.id = "bk-cat-wrap"; div.className = "field"; div.style.marginTop = "22px";
    div.innerHTML = `<label for="bk-cat">${t("Kategori för tidsbokning")}</label>
      <select class="input" id="bk-cat"><option value="">${t("Ingen (knappen Boka tid visas aldrig)")}</option>${catOptions(st.booking_category_id)}</select>
      <p class="muted" style="margin:0;font-size:.9rem">${t("När ett ärende har den här kategorin visas knappen Boka tid med handläggarens bokningssida.")}</p>`;
    box.appendChild(div);
    $("#bk-cat").addEventListener("change", async e => {
      try { await api("PUT", "/api/settings", { booking_category_id: e.target.value || null }); S.bookingCat = e.target.value ? +e.target.value : null; toast(t("Kategorin för tidsbokning sparades.")); }
      catch (ex) { toast(ex.message, true); }
    });
  };
  const COLORS = [["blue", t("Blå")], ["amber", t("Gul")], ["green", t("Grön")], ["red", t("Röd")], ["violet", t("Lila")], ["grey", t("Grå")]];
  let armedStatus = null;
  const renderStatuses = async () => {
    const box = $("#box-status");
    let items;
    try { items = (await api("GET", "/api/statuses")).items; } catch (e) { box.innerHTML = `<p class="err">${esc(e.message)}</p>`; return; }
    setStatuses(items);
    box.innerHTML = `<h2>${t("Statusar")}</h2>
      <p class="lead">${t("Ordningen styr listorna, och nya ärenden får den första statusen som inte är avslutad. <b>Avslutad</b> ger ärendet ett avslutsdatum och gör att det kan arkiveras. <b>Låst</b> betyder att ärendet inte kan öppnas igen. Bara administratörer kan då ändra statusen.")}</p>
      <ul class="slist">${items.map((x, i) => `<li data-id="${x.id}">
        <div class="s-order"><button type="button" class="textbtn s-up" ${i === 0 ? "disabled" : ""} aria-label="${t("Flytta upp {n}", { n: esc(x.name) })}">▲</button><button type="button" class="textbtn s-down" ${i === items.length - 1 ? "disabled" : ""} aria-label="${t("Flytta ned {n}", { n: esc(x.name) })}">▼</button></div>
        <input class="input s-name" value="${esc(x.name)}" aria-label="${t("Namn på status")}" maxlength="40"${tv(x.name) !== x.name ? ` title="${t("Visas som \"{n}\" på engelska", { n: esc(tv(x.name)) })}"` : ""}>
        <select class="input s-color" aria-label="${t("Färg")}">${COLORS.map(([k, l]) => `<option value="${k}"${x.color === k ? " selected" : ""}>${l}</option>`).join("")}</select>
        <label class="check"><input type="checkbox" class="s-closed"${x.closed ? " checked" : ""}> ${t("Avslutad")}</label>
        <label class="check"><input type="checkbox" class="s-locked"${x.locked ? " checked" : ""}${x.closed ? "" : " disabled"}> ${t("Låst")}</label>
        <span class="muted s-used">${x.used === 1 ? t("1 ärende") : t("{n} ärenden", { n: x.used })}</span>
        <button type="button" class="btn btn-sm s-save">${t("Spara")}</button>
        <button type="button" class="btn btn-sm btn-danger s-del${armedStatus === x.id ? " armed" : ""}" ${x.used ? `disabled title="${t("Används av ärenden")}"` : ""}>${armedStatus === x.id ? t("Bekräfta") : t("Ta bort")}</button>
      </li>`).join("")}</ul>
      <form class="add-row" id="s-add" novalidate><input class="input" id="s-new" placeholder="${t("Ny status")}" aria-label="${t("Ny status")}" maxlength="40"><button class="btn" type="submit">${t("Lägg till")}</button></form>`;
    const ids = items.map(x => x.id);
    $$(".slist li", box).forEach((li, i) => {
      const sid = +li.dataset.id;
      $(".s-closed", li).addEventListener("change", e => { const l = $(".s-locked", li); l.disabled = !e.target.checked; if (!e.target.checked) l.checked = false; });
      $(".s-save", li).addEventListener("click", async () => {
        try {
          await api("PUT", "/api/statuses/" + sid, { name: $(".s-name", li).value, color: $(".s-color", li).value, closed: $(".s-closed", li).checked, locked: $(".s-locked", li).checked });
          toast(t("Statusen sparades.")); renderStatuses();
        } catch (ex) { toast(ex.message, true); }
      });
      $(".s-del", li).addEventListener("click", async () => {
        if (armedStatus !== sid) { armedStatus = sid; renderStatuses(); return; }
        try { await api("DELETE", "/api/statuses/" + sid); armedStatus = null; toast(t("Statusen togs bort.")); renderStatuses(); } catch (ex) { toast(ex.message, true); }
      });
      const move = async d => { const o = ids.slice(); [o[i], o[i + d]] = [o[i + d], o[i]]; try { await api("POST", "/api/statuses/order", { ids: o }); renderStatuses(); } catch (ex) { toast(ex.message, true); } };
      $(".s-up", li).addEventListener("click", () => move(-1));
      $(".s-down", li).addEventListener("click", () => move(1));
    });
    $("#s-add").addEventListener("submit", async e => {
      e.preventDefault();
      try { await api("POST", "/api/statuses", { name: $("#s-new").value, color: "blue" }); toast(t("Statusen lades till.")); renderStatuses(); } catch (ex) { toast(ex.message, true); }
    });
  };

  renderBookingCatHook = renderBookingCat;
  renderUsers(); renderStatuses(); renderMail(); renderCats();
}

boot();
