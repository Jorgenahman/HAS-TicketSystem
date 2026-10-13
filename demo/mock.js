"use strict";
/* DEMOLÄGE: ersätter servern med en låtsasserver i webbläsaren.
   Samma API som server.py, men data ligger bara i den här webbläsaren. */
(function () {
  const KEY = "ts.demo.db.v3", SKEY = "ts.demo.session";
  const PRIORITIES = ["Låg", "Medium", "Hög"];
  const DEFAULT_ST = [["Ny", 0, 0, "blue"], ["Pågår", 0, 0, "amber"], ["Klar", 1, 0, "green"], ["Avslag", 1, 1, "red"]];
  const COLORS = ["blue", "amber", "green", "red", "grey", "violet"];
  let db;
  const stList = () => db.statuses.slice().sort((a, b) => a.sort - b.sort || a.id - b.id);
  const stByName = n => db.statuses.find(x => x.name.toLowerCase() === String(n || "").toLowerCase());
  const isClosed = n => { const x = stByName(n); return !!(x && x.closed); };
  const firstOpen = () => (stList().find(x => !x.closed) || { name: "Ny" }).name;
  const PAGE_SIZE = 25;
  const now = () => Math.floor(Date.now() / 1000);
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  /* ---------- exempeldata ---------- */
  function seed() {
    let r = 7;
    const rnd = () => (r = (r * 16807) % 2147483647) / 2147483647;
    const pick = a => a[Math.floor(rnd() * a.length)];
    const t0 = now();
    const isClosedSeed = n => n === "Klar" || n === "Avslag";
    const db = { seq: { user: 3, cat: 6, cust: 10, ticket: 0, status: 4, comment: 0 }, comments: [],
      statuses: DEFAULT_ST.map((x, i) => ({ id: i + 1, name: x[0], sort: i + 1, closed: x[1], locked: x[2], color: x[3] })), settings: { booking_category_id: 6, smtp: { smtp_enabled: "0", smtp_port: "587", smtp_security: "starttls" } },
      users: [
        { id: 1, name: "Demo Administratör", email: "admin@demo.se", pw: "demo1234", role: "admin", active: true, booking_url: "" },
        { id: 2, name: "Handläggare Ett", email: "ett@demo.se", pw: "demo1234", role: "agent", active: true, booking_url: "https://outlook.office365.com/book/Exempel@demo.se/" },
        { id: 3, name: "Handläggare Två", email: "tva@demo.se", pw: "demo1234", role: "agent", active: true, booking_url: "" }],
      categories: ["Leverans", "Order", "Retur", "Reklamation", "Övrigt", "IT-support boka tid"].map((n, i) => ({ id: i + 1, name: n })),
      customers: [], tickets: [] };
    const cs = [["Anna", "Exempel", "Exempel AB", "Inköpare"], ["Bo", "Demosson", "Demo Möbler", "Butikschef"], ["Cecilia", "Prov", "Provhuset", "Kundtjänst"],
      ["David", "Test", "Testbolaget", "VD"], ["Eva", "Lund", "Exempel AB", "Logistik"], ["Filip", "Berg", "Sängcenter Demo", "Inköpare"],
      ["Greta", "Öberg", "", ""], ["Hassan", "Ek", "Demo Möbler", "Lager"], ["Ida", "Strand", "Provhuset", "Ekonomi"], ["Jonas", "Ås", "", ""]];
    cs.forEach((c, i) => db.customers.push({ id: i + 1, first_name: c[0], last_name: c[1], company: c[2], title: c[3],
      phone: "070-000 00 " + String(i).padStart(2, "0"), email: c[0].toLowerCase() + "@exempel.se", created_at: t0 - 40 * 86400, updated_at: t0 - 40 * 86400 }));
    const titles = ["Leverans försenad", "Fel artikel levererad", "Retur av madrass", "Skadad förpackning", "Fråga om orderstatus",
      "Faktura saknas", "Byte av storlek", "Reklamation på ramdel", "Ändra leveransadress", "Saknar monteringsdetaljer"];
    for (let i = 0; i < 42; i++) {
      const created = t0 - Math.floor(rnd() * 28) * 86400 - Math.floor(rnd() * 30000);
      const st = pick(["Ny", "Pågår", "Klar", "Klar", "Klar", "Avslag"]);
      const closed = isClosedSeed(st) ? Math.min(t0, created + 3600 + Math.floor(rnd() * 3 * 86400)) : null;
      db.tickets.push({ id: ++db.seq.ticket, title: "Exempel: " + pick(titles), details: "Exempelärende för att testa systemet. Order 100" + (2000 + i) + ".",
        priority: pick(PRIORITIES), status: st, category_id: pick([1, 2, 3, 4, 5, 6, null]), customer_id: 1 + Math.floor(rnd() * 10),
        assignee_id: pick([1, 2, 3, null]), created_by: pick([1, 2, 3]), created_at: created, updated_at: closed || created,
        closed_at: closed, archived_at: closed && closed < t0 - 14 * 86400 && rnd() < .5 ? closed + 86400 : null });
    }
    return db;
  }
  try { db = JSON.parse(localStorage.getItem(KEY)); } catch (e) {}
  if (!db) db = seed();
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) {} };
  let sessionUser = null;
  try { sessionUser = Number(localStorage.getItem(SKEY)) || null; } catch (e) {}
  const setSession = id => { sessionUser = id; try { id ? localStorage.setItem(SKEY, id) : localStorage.removeItem(SKEY); } catch (e) {} };

  window.__demoReset = () => { try { localStorage.removeItem(KEY); localStorage.removeItem(SKEY); } catch (e) {} db = seed(); sessionUser = null; save(); location.hash = ""; location.reload(); };

  /* ---------- hjälp ---------- */
  class E extends Error { constructor(status, msg) { super(msg); this.status = status; } }
  const need = (c, msg, st = 400) => { if (!c) throw new E(st, msg); };
  const s = (v, n = 2000) => String(v ?? "").trim().slice(0, n);
  const int = v => (v === null || v === undefined || v === "" || v === "null" || isNaN(Number(v))) ? null : Number(v);
  const pub = u => ({ id: u.id, name: u.name, email: u.email, role: u.role, active: u.active, booking_url: u.booking_url || "" });
  const burl = v => { v = s(v, 500); need(!v || /^https:\/\/\S+$/i.test(v), "Bokningssidan måste vara en adress som börjar med https://"); return v; };
  const notify = t => { const a = db.users.find(u => u.id === t.assignee_id); if (!a) return null;
    return db.settings.smtp.smtp_enabled === "1" ? { sent: true, to: a.email } : { sent: false, to: a.email, reason: "Mail är inte inställt (Inställningar → E-post). I demon skickas aldrig mail." }; };
  const cname = c => (c.first_name + " " + c.last_name).trim();
  const cust = c => Object.assign({}, c, { name: cname(c) });
  const like = (h, q) => String(h || "").toLowerCase().includes(q.toLowerCase());

  function full(t) {
    const c = db.customers.find(x => x.id === t.customer_id), a = db.users.find(x => x.id === t.assignee_id),
      cb = db.users.find(x => x.id === t.created_by), cat = db.categories.find(x => x.id === t.category_id);
    return Object.assign({}, t, { category: cat ? cat.name : null, customer_name: c ? cname(c) : null, customer_company: c ? c.company : null,
      customer_email: c ? c.email : null, customer_phone: c ? c.phone : null, assignee_name: a ? a.name : null, assignee_email: a ? a.email : null, assignee_booking_url: a ? a.booking_url || "" : null,
      created_by_name: cb ? cb.name : null });
  }
  const getT = id => { const t = db.tickets.find(x => x.id === id); need(t, "Ärendet finns inte längre.", 404); return t; };

  function filterTickets(q) {
    let list = db.tickets.slice();
    if (q.archived === "1") list = list.filter(t => t.archived_at);
    else if (q.archived !== "all") list = list.filter(t => !t.archived_at);
    if (q.status === "open") list = list.filter(t => !isClosed(t.status));
    else if (q.status === "closed") list = list.filter(t => isClosed(t.status));
    else if (q.status) list = list.filter(t => t.status === q.status);
    if (PRIORITIES.includes(q.priority)) list = list.filter(t => t.priority === q.priority);
    for (const [k, f] of [["category", "category_id"], ["customer", "customer_id"], ["assignee", "assignee_id"]]) {
      if (q[k] === "none") list = list.filter(t => t[f] == null);
      else if (int(q[k])) list = list.filter(t => t[f] === int(q[k]));
    }
    const range = (f, from, to) => { if (int(from) != null) list = list.filter(t => t[f] != null && t[f] >= int(from)); if (int(to) != null) list = list.filter(t => t[f] != null && t[f] <= int(to)); };
    range("created_at", q.created_from, q.created_to); range("closed_at", q.closed_from, q.closed_to);
    const text = s(q.q, 100);
    if (text) list = list.filter(t => { const c = db.customers.find(x => x.id === t.customer_id) || {};
      return like(t.title, text) || like(t.details, text) || like(c.first_name && cname(c), text) || like(c.company, text) || String(t.id) === text.replace(/^#/, ""); });
    return list;
  }
  const PR = { "Hög": 0, "Medium": 1, "Låg": 2 }, SR = new Proxy({}, { get: (o, n) => (stByName(n) || { sort: 99 }).sort });
  const SORTS = { date_desc: (a, b) => b.created_at - a.created_at, date_asc: (a, b) => a.created_at - b.created_at,
    priority: (a, b) => PR[a.priority] - PR[b.priority] || b.created_at - a.created_at, status: (a, b) => SR[a.status] - SR[b.status] || b.created_at - a.created_at,
    updated: (a, b) => b.updated_at - a.updated_at };

  /* ---------- rutter ---------- */
  const R = [];
  const on = (m, p, fn, o = {}) => R.push({ m, rx: new RegExp("^" + p + "$"), fn, auth: o.auth !== false, admin: !!o.admin });
  const me = () => db.users.find(u => u.id === sessionUser && u.active);

  on("GET", "/api/status", () => ({ setup_needed: false, user: me() ? pub(me()) : null, priorities: PRIORITIES, status_list: stList(),
    booking_category_id: db.settings.booking_category_id || null }), { auth: false });
  on("PUT", "/api/me", (b) => { const u = me(); u.booking_url = burl(b.booking_url); return pub(u); });
  const settingsOut = () => ({ smtp: Object.assign({}, db.settings.smtp, { has_password: !!db.settings.smtp.pw, pw: undefined }), last_mail: null, booking_category_id: db.settings.booking_category_id || null });
  on("GET", "/api/settings", () => settingsOut(), { admin: true });
  on("PUT", "/api/settings", (b) => {
    if (b.smtp) { const m = b.smtp;
      if (m.smtp_enabled) { need(s(m.smtp_host), "Ange SMTP-server."); need(EMAIL_RE.test(s(m.smtp_from)), "Ange en giltig avsändaradress."); }
      Object.assign(db.settings.smtp, { smtp_enabled: m.smtp_enabled ? "1" : "0", smtp_host: s(m.smtp_host), smtp_port: String(int(m.smtp_port) || 587),
        smtp_security: m.smtp_security || "starttls", smtp_user: s(m.smtp_user), smtp_from: s(m.smtp_from), smtp_from_name: s(m.smtp_from_name), base_url: s(m.base_url),
        smtp_tls_verify: ["verify", "pinned", "none"].includes(m.smtp_tls_verify) ? m.smtp_tls_verify : "verify", smtp_ca_pem: String(m.smtp_ca_pem || "") });
      if (m.smtp_password) db.settings.smtp.pw = "x"; }
    if ("booking_category_id" in b) db.settings.booking_category_id = int(b.booking_category_id);
    return settingsOut();
  }, { admin: true });
  on("POST", "/api/settings/fetch-cert", () => { throw new E(400, "I demon finns ingen mailserver att hämta certifikat från."); }, { admin: true });
  on("POST", "/api/settings/test-mail", () => { throw new E(400, "I demon skickas inga mail. Testa i den installerade versionen."); }, { admin: true });
  on("POST", "/api/login", (b) => {
    const u = db.users.find(x => x.email.toLowerCase() === s(b.email).toLowerCase() && x.active);
    if (!u || u.pw !== String(b.password || "")) throw new E(401, "Fel e-postadress eller lösenord.");
    setSession(u.id); return { user: pub(u) };
  }, { auth: false });
  on("POST", "/api/logout", () => { setSession(null); return { ok: true }; }, { auth: false });
  on("POST", "/api/me/password", (b) => {
    const u = me(); need(u.pw === String(b.current || ""), "Nuvarande lösenord stämmer inte.");
    need(String(b.new || "").length >= 8, "Det nya lösenordet måste vara minst 8 tecken."); u.pw = String(b.new); return { ok: true };
  });

  on("GET", "/api/users", () => ({ items: db.users.slice().sort((a, b) => a.name.localeCompare(b.name, "sv")).map(pub) }));
  const adminsLeft = ex => db.users.filter(u => u.role === "admin" && u.active && u.id !== ex).length;
  on("POST", "/api/users", (b) => {
    const name = s(b.name, 100), email = s(b.email, 200), pw = String(b.password || "");
    need(name, "Ange namn."); need(EMAIL_RE.test(email), "Ange en giltig e-postadress."); need(pw.length >= 8, "Lösenordet måste vara minst 8 tecken.");
    need(!db.users.some(u => u.email.toLowerCase() === email.toLowerCase()), "E-postadressen används redan.", 409);
    const u = { id: ++db.seq.user, name, email, pw, role: b.role === "admin" ? "admin" : "agent", active: true, booking_url: burl(b.booking_url) }; db.users.push(u); return pub(u);
  }, { admin: true });
  on("PUT", "/api/users/(\\d+)", (b, id) => {
    const u = db.users.find(x => x.id === +id); need(u, "Användaren finns inte.", 404);
    const name = s(b.name ?? u.name, 100), email = s(b.email ?? u.email, 200), role = (b.role ?? u.role) === "admin" ? "admin" : "agent";
    const active = b.active === undefined ? u.active : !!b.active;
    need(name, "Ange namn."); need(EMAIL_RE.test(email), "Ange en giltig e-postadress.");
    need(!db.users.some(x => x.id !== u.id && x.email.toLowerCase() === email.toLowerCase()), "E-postadressen används redan.", 409);
    if (u.role === "admin" && (role !== "admin" || !active)) need(adminsLeft(u.id) > 0, "Det måste finnas minst en aktiv administratör.");
    const pw = String(b.password || ""); if (pw) { need(pw.length >= 8, "Lösenordet måste vara minst 8 tecken."); u.pw = pw; }
    const bu = b.booking_url === undefined ? u.booking_url : burl(b.booking_url);
    Object.assign(u, { name, email, role, active, booking_url: bu }); return pub(u);
  }, { admin: true });

  on("GET", "/api/categories", () => ({ items: db.categories.slice().sort((a, b) => a.name.localeCompare(b.name, "sv"))
    .map(c => ({ id: c.id, name: c.name, used: db.tickets.filter(t => t.category_id === c.id).length })) }));
  on("POST", "/api/categories", (b) => { const n = s(b.name, 60); need(n, "Ange ett namn.");
    need(!db.categories.some(c => c.name.toLowerCase() === n.toLowerCase()), "Kategorin finns redan.", 409);
    const c = { id: ++db.seq.cat, name: n }; db.categories.push(c); return c; }, { admin: true });
  on("PUT", "/api/categories/(\\d+)", (b, id) => { const n = s(b.name, 60); need(n, "Ange ett namn.");
    need(!db.categories.some(c => c.id !== +id && c.name.toLowerCase() === n.toLowerCase()), "Kategorin finns redan.", 409);
    const c = db.categories.find(x => x.id === +id); if (c) c.name = n; return { ok: true }; }, { admin: true });
  on("DELETE", "/api/categories/(\\d+)", (b, id) => { if (db.settings.booking_category_id === +id) db.settings.booking_category_id = null; db.tickets.forEach(t => { if (t.category_id === +id) t.category_id = null; });
    db.categories = db.categories.filter(c => c.id !== +id); return { ok: true }; }, { admin: true });

  const custFields = b => { const f = {}; ["first_name", "last_name", "company", "title", "phone", "email"].forEach(k => f[k] = s(b[k], 200));
    need(f.first_name, "Ange förnamn."); need(!f.email || EMAIL_RE.test(f.email), "E-postadressen ser inte giltig ut."); return f; };
  on("GET", "/api/customers", (b, q) => {
    const text = s(q.q, 100);
    return { items: db.customers.filter(c => !text || [cname(c), c.company, c.email, c.phone].some(v => like(v, text)))
      .sort((a, b) => a.last_name.localeCompare(b.last_name, "sv") || a.first_name.localeCompare(b.first_name, "sv"))
      .map(c => Object.assign(cust(c), { ticket_count: db.tickets.filter(t => t.customer_id === c.id).length,
        open_count: db.tickets.filter(t => t.customer_id === c.id && !isClosed(t.status) && !t.archived_at).length })) };
  });
  on("GET", "/api/customers/(\\d+)", (b, q, id) => {
    const c = db.customers.find(x => x.id === +id); need(c, "Beställaren finns inte.", 404);
    return Object.assign(cust(c), { tickets: db.tickets.filter(t => t.customer_id === c.id).sort((a, b) => b.created_at - a.created_at).slice(0, 20).map(full) });
  });
  on("POST", "/api/customers", (b) => { const c = Object.assign({ id: ++db.seq.cust, created_at: now(), updated_at: now() }, custFields(b)); db.customers.push(c); return cust(c); });
  on("PUT", "/api/customers/(\\d+)", (b, id) => { const c = db.customers.find(x => x.id === +id); need(c, "Beställaren finns inte.", 404);
    Object.assign(c, custFields(b), { updated_at: now() }); return cust(c); });
  on("POST", "/api/customers/delete", (b) => {
    const ids = (b.ids || []).map(Number).filter(Boolean); need(ids.length, "Inga beställare valda.");
    const blocked = ids.filter(i => db.tickets.some(t => t.customer_id === i)), ok = ids.filter(i => !blocked.includes(i));
    db.customers = db.customers.filter(c => !ok.includes(c.id)); return { deleted: ok.length, blocked: blocked.length };
  });

  on("GET", "/api/tickets", (b, q) => {
    const list = filterTickets(q).sort(SORTS[q.sort] || SORTS.date_desc);
    const page = Math.max(1, int(q.page) || 1);
    return { items: list.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map(full), total: list.length, page, page_size: PAGE_SIZE };
  });
  const commentsOf = tid => db.comments.filter(c => c.ticket_id === tid).sort((a, b) => a.created_at - b.created_at || a.id - b.id)
    .map(c => Object.assign({}, c, { author: (db.users.find(u => u.id === c.user_id) || {}).name || null }));
  on("GET", "/api/tickets/(\\d+)", (b, q, id) => { const t = getT(+id), st = stByName(t.status);
    return Object.assign(full(t), { comments: commentsOf(t.id), status_locked: !!(st && st.locked) }); });
  on("POST", "/api/tickets/(\\d+)/comments", (b, id) => { const t = getT(+id); const body = s(b.body, 10000); need(body, "Skriv en kommentar först.");
    db.comments.push({ id: ++db.seq.comment, ticket_id: t.id, user_id: sessionUser, body, created_at: now() }); t.updated_at = now(); return { comments: commentsOf(t.id) }; });
  on("DELETE", "/api/comments/(\\d+)", (b, id) => { const c = db.comments.find(x => x.id === +id); need(c, "Kommentaren finns inte.", 404);
    need(c.user_id === sessionUser || me().role === "admin", "Du kan bara ta bort dina egna kommentarer.", 403);
    db.comments = db.comments.filter(x => x.id !== +id); return { comments: commentsOf(c.ticket_id) }; });
  const stOut = () => ({ items: stList().map(x => Object.assign({}, x, { used: db.tickets.filter(t => t.status === x.name).length })) });
  const stPayload = (b, cur) => { const name = s(b.name ?? (cur ? cur.name : ""), 40); need(name, "Ange ett namn på statusen.");
    const closed = (b.closed ?? (cur ? cur.closed : 0)) ? 1 : 0, locked = (b.locked ?? (cur ? cur.locked : 0)) ? 1 : 0;
    need(!locked || closed, "Bara en avslutad status kan vara låst.");
    const color = COLORS.includes(b.color) ? b.color : (cur ? cur.color : "blue"); return { name, closed, locked, color }; };
  const openLeft = ex => db.statuses.filter(x => !x.closed && x.id !== ex).length > 0;
  on("GET", "/api/statuses", () => stOut());
  on("POST", "/api/statuses", (b) => { const p = stPayload(b); need(!stByName(p.name), "Statusen finns redan.", 409);
    db.statuses.push(Object.assign({ id: ++db.seq.status, sort: Math.max(0, ...db.statuses.map(x => x.sort)) + 1 }, p)); return stOut(); }, { admin: true });
  on("PUT", "/api/statuses/(\\d+)", (b, id) => { const cur = db.statuses.find(x => x.id === +id); need(cur, "Statusen finns inte.", 404);
    const p = stPayload(b, cur); need(!db.statuses.some(x => x.id !== cur.id && x.name.toLowerCase() === p.name.toLowerCase()), "Det finns redan en status med det namnet.", 409);
    if (p.closed && !cur.closed) need(openLeft(cur.id), "Det måste finnas minst en status som inte är avslutad.");
    const t = now();
    db.tickets.forEach(x => { if (x.status !== cur.name) return; x.status = p.name;
      if (p.closed && !cur.closed && !x.closed_at) x.closed_at = t; if (!p.closed && cur.closed) { x.closed_at = null; x.archived_at = null; } });
    Object.assign(cur, p); return stOut(); }, { admin: true });
  on("DELETE", "/api/statuses/(\\d+)", (b, id) => { const cur = db.statuses.find(x => x.id === +id); need(cur, "Statusen finns inte.", 404);
    const n = db.tickets.filter(t => t.status === cur.name).length; need(!n, `Statusen används av ${n} ärenden och kan inte tas bort. Byt status på dem först.`, 409);
    if (!cur.closed) need(openLeft(cur.id), "Det måste finnas minst en status som inte är avslutad.");
    db.statuses = db.statuses.filter(x => x.id !== cur.id); return stOut(); }, { admin: true });
  on("POST", "/api/statuses/order", (b) => { (b.ids || []).forEach((sid, i) => { const x = db.statuses.find(y => y.id === +sid); if (x) x.sort = i + 1; }); return stOut(); }, { admin: true });
  const checkRefs = b => {
    if (int(b.category_id) != null) need(db.categories.some(c => c.id === int(b.category_id)), "Ogiltig kategori.");
    if (int(b.customer_id) != null) need(db.customers.some(c => c.id === int(b.customer_id)), "Ogiltig kund.");
    if (int(b.assignee_id) != null) need(db.users.some(c => c.id === int(b.assignee_id)), "Ogiltig handläggare.");
  };
  on("POST", "/api/tickets", (b) => {
    const title = s(b.title, 200); need(title, "Ange en titel."); need(int(b.customer_id), "Koppla ärendet till en beställare."); checkRefs(b);
    const t = { id: ++db.seq.ticket, title, details: s(b.details, 20000), priority: PRIORITIES.includes(b.priority) ? b.priority : "Medium", status: firstOpen(),
      category_id: int(b.category_id), customer_id: int(b.customer_id), assignee_id: int(b.assignee_id), created_by: sessionUser,
      created_at: now(), updated_at: now(), closed_at: null, archived_at: null };
    db.tickets.push(t); const out = full(t); if (t.assignee_id) out.notify = notify(t); return out;
  });
  on("PUT", "/api/tickets/(\\d+)", (b, id) => {
    const t = getT(+id), f = {};
    if ("title" in b) { f.title = s(b.title, 200); need(f.title, "Ange en titel."); }
    if ("details" in b) f.details = s(b.details, 20000);
    if ("priority" in b) { need(PRIORITIES.includes(b.priority), "Ogiltig prioritet."); f.priority = b.priority; }
    if ("status" in b) { need(stByName(b.status), "Ogiltig status.");
      const os = stByName(t.status);
      if (b.status !== t.status && os && os.locked) need(me().role === "admin", `Ärendet har status ${t.status} och kan inte öppnas igen. Bara en administratör kan ändra status.`, 403);
      f.status = b.status;
      if (isClosed(b.status) && !isClosed(t.status)) f.closed_at = now();
      else if (!isClosed(b.status)) { f.closed_at = null; f.archived_at = null; } }
    for (const k of ["category_id", "customer_id", "assignee_id"]) if (k in b) f[k] = int(b[k]);
    if ("customer_id" in f) need(f.customer_id, "Koppla ärendet till en beställare.");
    checkRefs(b);
    const prevA = t.assignee_id;
    if (Object.keys(f).length) Object.assign(t, f, { updated_at: now() });
    const out = full(t); if ("assignee_id" in f && f.assignee_id && f.assignee_id !== prevA) out.notify = notify(t); return out;
  });
  on("DELETE", "/api/tickets/(\\d+)", (b, id) => { getT(+id); db.tickets = db.tickets.filter(t => t.id !== +id); db.comments = db.comments.filter(c => c.ticket_id !== +id); return { ok: true }; });
  on("POST", "/api/tickets/bulk", (b) => {
    const ids = (b.ids || []).map(Number).filter(Boolean); need(ids.length, "Inga ärenden valda.");
    let n = 0; const t = now();
    if (b.action === "status") { const st = stByName(b.status); need(st, "Ogiltig status.");
      db.tickets.forEach(x => { if (!ids.includes(x.id) || x.status === st.name) return;
        const os = stByName(x.status); if (os && os.locked && me().role !== "admin") return;
        Object.assign(x, st.closed ? { status: st.name, closed_at: isClosed(x.status) ? x.closed_at : t, updated_at: t } : { status: st.name, closed_at: null, archived_at: null, updated_at: t }); n++; }); }
    else if (b.action === "archive") db.tickets.forEach(x => { if (ids.includes(x.id) && isClosed(x.status) && !x.archived_at) { Object.assign(x, { archived_at: t, updated_at: t }); n++; } });
    else if (b.action === "delete") { const before = db.tickets.length; db.tickets = db.tickets.filter(x => !ids.includes(x.id)); n = before - db.tickets.length; }
    else throw new E(400, "Okänd åtgärd.");
    return { changed: n };
  });
  on("POST", "/api/tickets/archive-closed", () => { let n = 0; const t = now();
    db.tickets.forEach(x => { if (isClosed(x.status) && !x.archived_at) { Object.assign(x, { archived_at: t, updated_at: t }); n++; } }); return { archived: n }; });

  on("GET", "/api/dashboard", (b, q) => {
    const to = int(q.to) || now(), from = int(q.from) || to - 7 * 86400; need(from < to, "Startdatum måste vara före slutdatum.");
    const span = to - from;
    let base = db.tickets;
    if (PRIORITIES.includes(q.priority)) base = base.filter(t => t.priority === q.priority);
    if (int(q.category)) base = base.filter(t => t.category_id === int(q.category));
    const isOpen = t => !isClosed(t.status);
    const conds = { unassigned: t => isOpen(t) && t.assignee_id == null, open: isOpen, high: t => isOpen(t) && t.priority === "Hög" };
    const cards = {};
    for (const [k, c] of Object.entries(conds)) cards[k] = {
      value: base.filter(t => c(t) && !t.archived_at).length,
      period: base.filter(t => c(t) && t.created_at >= from && t.created_at <= to).length,
      previous: base.filter(t => c(t) && t.created_at >= from - span && t.created_at < from).length };
    const inP = base.filter(t => t.created_at >= from && t.created_at <= to);
    const custIds = [...new Set(inP.filter(t => t.customer_id).map(t => t.customer_id))];
    const firstOf = id => Math.min(...base.filter(t => t.customer_id === id).map(t => t.created_at));
    const key = ts => { const d = new Date(ts * 1000); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
    const series = [];
    const d = new Date(from * 1000); d.setHours(12, 0, 0, 0);
    const end = new Date(to * 1000);
    while (d <= end && series.length < 400) {
      const k = key(d.getTime() / 1000);
      series.push({ date: k, created: base.filter(t => t.created_at >= from && t.created_at <= to && key(t.created_at) === k).length,
        closed: base.filter(t => t.closed_at && t.closed_at >= from && t.closed_at <= to && key(t.closed_at) === k).length });
      d.setDate(d.getDate() + 1);
    }
    return { cards, created: inP.length, created_closed: inP.filter(t => isClosed(t.status)).length, closed_breakdown: stList().filter(x => x.closed).map(x => ({ name: x.name, n: inP.filter(t => t.status === x.name).length })),
      customers_total: custIds.length, customers_new: custIds.filter(id => firstOf(id) >= from).length, series };
  });

  /* ---------- fetch-ersättning ---------- */
  const realFetch = window.fetch.bind(window);
  window.fetch = async function (input, opt = {}) {
    const url = new URL(typeof input === "string" ? input : input.url, location.href);
    if (!url.pathname.startsWith("/api/")) return realFetch(input, opt);
    const method = (opt.method || "GET").toUpperCase();
    const q = Object.fromEntries(url.searchParams);
    let body = {}; try { body = opt.body ? JSON.parse(opt.body) : {}; } catch (e) {}
    const reply = (st, obj) => new Response(JSON.stringify(obj), { status: st, headers: { "Content-Type": "application/json" } });
    await new Promise(r => setTimeout(r, 60));
    for (const r of R) {
      if (r.m !== method) continue;
      const m = url.pathname.match(r.rx); if (!m) continue;
      const u = me();
      if (r.auth && !u) return reply(401, { error: "Du är inte inloggad." });
      if (r.admin && u.role !== "admin") return reply(403, { error: "Kräver administratörsbehörighet." });
      try {
        const args = m.slice(1);
        const out = method === "GET" ? r.fn(body, q, ...args) : r.fn(body, ...args, q);
        save(); return reply(200, out);
      } catch (e) {
        if (e instanceof E) return reply(e.status, { error: e.message });
        console.error(e); return reply(500, { error: "Ett oväntat fel uppstod." });
      }
    }
    return reply(404, { error: "Hittades inte." });
  };

  /* Nedladdningar fungerar inte i demon */
  document.addEventListener("click", e => {
    const a = e.target.closest('a[href^="/api/"]');
    if (!a) return;
    e.preventDefault();
    const t = document.getElementById("toast");
    t.textContent = a.href.includes("backup") ? "Säkerhetskopia finns i den installerade versionen." : "Excel-exporten fungerar i den installerade versionen, inte i demon.";
    t.className = "toast"; t.hidden = false; setTimeout(() => t.hidden = true, 3500);
  }, true);
})();
