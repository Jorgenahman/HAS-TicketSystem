#!/usr/bin/env python3
"""
Ärendehantering – liten webbserver med SQLite-databas.

Kräver endast Python 3.8+ (inga extra paket).
Start:   python3 server.py
Miljövariabler:
  TS_PORT      port att lyssna på (standard 8000)
  TS_DATA_DIR  mapp för databasen (standard ./data)
"""
import hashlib
import hmac
import io
import json
import os
import re
import secrets
import smtplib
import ssl
import sqlite3
import sys
import threading
import time
import zipfile
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse
from email.message import EmailMessage
from email.utils import formataddr
from xml.sax.saxutils import escape as xml_escape

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
STATIC_DIR = os.path.join(BASE_DIR, "static")
DATA_DIR = os.environ.get("TS_DATA_DIR", os.path.join(BASE_DIR, "data"))
DB_PATH = os.path.join(DATA_DIR, "arenden.db")
PORT = int(os.environ.get("TS_PORT", "8000"))

SESSION_COOKIE = "ts_session"
SESSION_DAYS = 14
PBKDF2_ROUNDS = 200_000
PAGE_SIZE = 25

PRIORITIES = ["Låg", "Medium", "Hög"]
# Statusar ligger i tabellen statuses och redigeras under Inställningar.
DEFAULT_STATUSES = [  # namn, avslutad, låst, färg
    ("Ny", 0, 0, "blue"), ("Pågår", 0, 0, "amber"), ("Klar", 1, 0, "green"), ("Avslag", 1, 1, "red")]
STATUS_COLORS = ("blue", "amber", "green", "red", "grey", "violet")
CLOSED_SUB = "(SELECT name FROM statuses WHERE closed=1)"   # för SQL: status IN CLOSED_SUB
BOOKING_CATEGORY = "IT-support boka tid"

SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  pw_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'agent',
  active INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE COLLATE NOCASE
);
CREATE TABLE IF NOT EXISTS customers (
  id INTEGER PRIMARY KEY,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL DEFAULT '',
  company TEXT NOT NULL DEFAULT '',
  title TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS tickets (
  id INTEGER PRIMARY KEY,
  title TEXT NOT NULL,
  details TEXT NOT NULL DEFAULT '',
  priority TEXT NOT NULL DEFAULT 'Medium',
  status TEXT NOT NULL DEFAULT 'Ny',
  category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  customer_id INTEGER REFERENCES customers(id),
  assignee_id INTEGER REFERENCES users(id),
  created_by INTEGER REFERENCES users(id),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  closed_at INTEGER,
  archived_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_tickets_created ON tickets(created_at);
CREATE INDEX IF NOT EXISTS idx_tickets_customer ON tickets(customer_id);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status, archived_at);
CREATE TABLE IF NOT EXISTS statuses (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE COLLATE NOCASE,
  sort INTEGER NOT NULL DEFAULT 0,
  closed INTEGER NOT NULL DEFAULT 0,
  locked INTEGER NOT NULL DEFAULT 0,
  color TEXT NOT NULL DEFAULT 'blue'
);
CREATE TABLE IF NOT EXISTS comments (
  id INTEGER PRIMARY KEY,
  ticket_id INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id),
  body TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_comments_ticket ON comments(ticket_id);
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT ''
);
"""

DEFAULT_CATEGORIES = ["Leverans", "Order", "Retur", "Reklamation", "Övrigt", BOOKING_CATEGORY]


# ---------------------------------------------------------------- databas
def connect():
    con = sqlite3.connect(DB_PATH, timeout=15)
    con.row_factory = sqlite3.Row
    con.execute("PRAGMA foreign_keys = ON")
    return con


def init_db():
    os.makedirs(DATA_DIR, exist_ok=True)
    con = connect()
    con.execute("PRAGMA journal_mode = WAL")
    con.executescript(SCHEMA)
    if con.execute("SELECT COUNT(*) FROM categories").fetchone()[0] == 0:
        con.executemany("INSERT INTO categories(name) VALUES (?)", [(c,) for c in DEFAULT_CATEGORIES])
    # --- uppgraderingar av äldre databaser ---
    cols = [r[1] for r in con.execute("PRAGMA table_info(users)").fetchall()]
    if "booking_url" not in cols:
        con.execute("ALTER TABLE users ADD COLUMN booking_url TEXT NOT NULL DEFAULT ''")
    if "lang" not in cols:
        con.execute("ALTER TABLE users ADD COLUMN lang TEXT NOT NULL DEFAULT 'sv'")
    con.execute("UPDATE tickets SET status='Klar' WHERE status='Avslutad'")
    if con.execute("SELECT COUNT(*) FROM statuses").fetchone()[0] == 0:
        for i, (n, c, l, col) in enumerate(DEFAULT_STATUSES):
            con.execute("INSERT INTO statuses(name,sort,closed,locked,color) VALUES (?,?,?,?,?)", (n, i + 1, c, l, col))
    # statusar som används i ärenden men saknas i tabellen läggs till som öppna
    for (n,) in con.execute("SELECT DISTINCT status FROM tickets WHERE status NOT IN (SELECT name FROM statuses)").fetchall():
        mx = con.execute("SELECT COALESCE(MAX(sort),0) FROM statuses").fetchone()[0]
        con.execute("INSERT INTO statuses(name,sort,closed,locked,color) VALUES (?,?,0,0,'grey')", (n, mx + 1))
    if get_setting(con, "booking_category_id") == "":
        row = con.execute("SELECT id FROM categories WHERE name=?", (BOOKING_CATEGORY,)).fetchone()
        cid = row[0] if row else con.execute("INSERT INTO categories(name) VALUES (?)", (BOOKING_CATEGORY,)).lastrowid
        set_setting(con, "booking_category_id", str(cid))
    con.commit()
    con.close()


def now():
    return int(time.time())


def status_rows(con):
    return [dict(r) for r in con.execute("SELECT * FROM statuses ORDER BY sort, id").fetchall()]


def status_by_name(con, name):
    return con.execute("SELECT * FROM statuses WHERE name=?", (name,)).fetchone()


def first_open_status(con):
    r = con.execute("SELECT name FROM statuses WHERE closed=0 ORDER BY sort, id LIMIT 1").fetchone()
    return r[0] if r else "Ny"


def get_setting(con, key, default=""):
    row = con.execute("SELECT value FROM settings WHERE key=?", (key,)).fetchone()
    return row[0] if row else default


def set_setting(con, key, value):
    con.execute("INSERT INTO settings(key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value", (key, str(value)))


# ---------------------------------------------------------------- lösenord
def hash_password(pw):
    salt = secrets.token_hex(16)
    dk = hashlib.pbkdf2_hmac("sha256", pw.encode(), salt.encode(), PBKDF2_ROUNDS)
    return "pbkdf2${}${}${}".format(PBKDF2_ROUNDS, salt, dk.hex())


def check_password(pw, stored):
    try:
        _, rounds, salt, digest = stored.split("$")
        dk = hashlib.pbkdf2_hmac("sha256", pw.encode(), salt.encode(), int(rounds))
        return hmac.compare_digest(dk.hex(), digest)
    except Exception:
        return False


# ---------------------------------------------------------------- hjälp
class ApiError(Exception):
    def __init__(self, status, message):
        super().__init__(message)
        self.status = status
        self.message = message


def need(cond, message, status=400):
    if not cond:
        raise ApiError(status, message)


def s(v, maxlen=2000):
    return str(v if v is not None else "").strip()[:maxlen]


def int_or_none(v):
    try:
        return int(v) if v not in (None, "", "null") else None
    except (TypeError, ValueError):
        return None


EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")


def user_public(row):
    return {"id": row["id"], "name": row["name"], "email": row["email"], "role": row["role"], "active": bool(row["active"]),
            "booking_url": row["booking_url"] if "booking_url" in row.keys() else "",
            "lang": row["lang"] if "lang" in row.keys() else "sv"}


def lang_value(v):
    return "en" if v == "en" else "sv"


# Texter i mail och Excel-export (svenska är källtext)
SERVER_EN = {
    "Hej {},": "Hi {},",
    "{} har tilldelat dig ett ärende.": "{} has assigned a ticket to you.",
    "Ärende:     #{} {}": "Ticket:     #{} {}",
    "Prioritet:  {}": "Priority:   {}",
    "Status:     {}": "Status:     {}",
    "Kategori:   {}": "Category:   {}",
    "Beställare: {}{}": "Requester:  {}{}",
    "Kontakt:    {}": "Contact:    {}",
    "Detaljer:": "Details:",
    "Öppna ärendet: {}/#/tickets/{}": "Open the ticket: {}/#/tickets/{}",
    "Ärendet gäller tidsbokning för IT-support.": "This ticket is about booking time with IT support.",
    "Din bokningssida: {}": "Your booking page: {}",
    "Du har ingen bokningssida inlagd. Lägg in den under Inställningar → Mitt konto.": "You have no booking page. Add it under Settings → My account.",
    "Ärende #{} har tilldelats dig: {}": "Ticket #{} has been assigned to you: {}",
    "Testmail från Ärendehantering": "Test email from the Ticket system",
    "Det här är ett testmail. Mailinställningarna fungerar.": "This is a test email. The email settings work.",
    "Ärendehantering": "Ticket system",
    # Excel
    "Ärenden": "Tickets", "Arkiv": "Archive", "Beställare": "Requesters", "Kommentarer": "Comments",
    "Titel": "Title", "Beskrivning": "Description", "Prioritet": "Priority", "Kategori": "Category",
    "Företag": "Company", "Beställare e-post": "Requester email", "Beställare telefon": "Requester phone",
    "Handläggare": "Agent", "Skapad av": "Created by", "Skapad": "Created", "Senast ändrad": "Last updated",
    "Avslutad": "Closed", "Arkiverad": "Archived", "Förnamn": "First name", "Efternamn": "Last name",
    "Telefon": "Phone", "E-post": "Email", "Ärende-ID": "Ticket ID", "Ärende": "Ticket", "Skriven": "Written",
    "Av": "By", "Kommentar": "Comment", "Namn": "Name", "Beställare_1": "Requester",
}
SERVER_SV = {"Beställare_1": "Beställare"}   # nycklar som stavas likadant på svenska
# Standardvärden i databasen visas översatta på engelska
DATA_EN = {"Ny": "New", "Pågår": "In progress", "Klar": "Done", "Avslag": "Rejected", "Låg": "Low", "Medium": "Medium", "Hög": "High",
           "Leverans": "Delivery", "Order": "Order", "Retur": "Return", "Reklamation": "Complaint", "Övrigt": "Other",
           "IT-support boka tid": "IT support – book a time"}


def T(lang, text):
    return SERVER_EN.get(text, text) if lang == "en" else SERVER_SV.get(text, text)


def TV(lang, value):
    return DATA_EN.get(value, value) if lang == "en" and value else value


URL_RE = re.compile(r"^https://[^\s]+$", re.I)


def booking_url_value(v):
    v = s(v, 500)
    need(not v or URL_RE.match(v), "Bokningssidan måste vara en adress som börjar med https://")
    return v


def customer_public(row):
    d = dict(row)
    d["name"] = (d["first_name"] + " " + d["last_name"]).strip()
    return d


TICKET_SELECT = """
SELECT t.*, c.name AS category,
       cu.first_name || CASE WHEN cu.last_name <> '' THEN ' ' || cu.last_name ELSE '' END AS customer_name,
       cu.company AS customer_company, cu.email AS customer_email, cu.phone AS customer_phone,
       a.name AS assignee_name, a.email AS assignee_email, a.booking_url AS assignee_booking_url,
       cb.name AS created_by_name
FROM tickets t
LEFT JOIN categories c ON c.id = t.category_id
LEFT JOIN customers cu ON cu.id = t.customer_id
LEFT JOIN users a ON a.id = t.assignee_id
LEFT JOIN users cb ON cb.id = t.created_by
"""


# ---------------------------------------------------------------- Excel-export (xlsx utan externa paket)
def col_letter(i):
    out = ""
    i += 1
    while i:
        i, r = divmod(i - 1, 26)
        out = chr(65 + r) + out
    return out


def build_xlsx(sheets):
    """sheets: lista av (namn, rubriker, rader, datumkolumner-index-set, kolumnbredder)"""
    def sheet_xml(headers, rows, date_cols, widths):
        parts = ['<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
                 '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">',
                 '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>',
                 "<cols>"]
        for i, w in enumerate(widths):
            parts.append('<col min="{0}" max="{0}" width="{1}" customWidth="1"/>'.format(i + 1, w))
        parts.append("</cols><sheetData>")
        for r, row in enumerate([headers] + rows):
            parts.append('<row r="{}">'.format(r + 1))
            for c, v in enumerate(row):
                ref = "{}{}".format(col_letter(c), r + 1)
                if r == 0:
                    parts.append('<c r="{}" t="inlineStr" s="2"><is><t>{}</t></is></c>'.format(ref, xml_escape(str(v))))
                elif v is None or v == "":
                    continue
                elif c in date_cols and isinstance(v, (int, float)):
                    parts.append('<c r="{}" s="1"><v>{}</v></c>'.format(ref, v))
                elif isinstance(v, (int, float)) and not isinstance(v, bool):
                    parts.append('<c r="{}"><v>{}</v></c>'.format(ref, v))
                else:
                    txt = xml_escape(str(v)).replace("\r", "")
                    parts.append('<c r="{}" t="inlineStr"><is><t xml:space="preserve">{}</t></is></c>'.format(ref, txt))
            parts.append("</row>")
        parts.append("</sheetData>")
        if rows:
            parts.append('<autoFilter ref="A1:{}{}"/>'.format(col_letter(len(headers) - 1), len(rows) + 1))
        parts.append("</worksheet>")
        return "".join(parts)

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("[Content_Types].xml",
                   '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
                   '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
                   '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
                   '<Default Extension="xml" ContentType="application/xml"/>'
                   '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
                   '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'
                   + "".join('<Override PartName="/xl/worksheets/sheet{}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'.format(i + 1) for i in range(len(sheets)))
                   + "</Types>")
        z.writestr("_rels/.rels",
                   '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
                   '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
                   '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>'
                   "</Relationships>")
        z.writestr("xl/workbook.xml",
                   '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
                   '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>'
                   + "".join('<sheet name="{}" sheetId="{}" r:id="rId{}"/>'.format(xml_escape(sh[0]), i + 1, i + 1) for i, sh in enumerate(sheets))
                   + "</sheets></workbook>")
        z.writestr("xl/_rels/workbook.xml.rels",
                   '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
                   '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
                   + "".join('<Relationship Id="rId{0}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet{0}.xml"/>'.format(i + 1) for i in range(len(sheets)))
                   + '<Relationship Id="rId{}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>'.format(len(sheets) + 1)
                   + "</Relationships>")
        z.writestr("xl/styles.xml",
                   '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
                   '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
                   '<numFmts count="1"><numFmt numFmtId="164" formatCode="yyyy-mm-dd hh:mm"/></numFmts>'
                   '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>'
                   '<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>'
                   '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>'
                   '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
                   '<cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'
                   '<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>'
                   '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs>'
                   '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>'
                   "</styleSheet>")
        for i, (name, headers, rows, date_cols, widths) in enumerate(sheets):
            z.writestr("xl/worksheets/sheet{}.xml".format(i + 1), sheet_xml(headers, rows, date_cols, widths))
    return buf.getvalue()


# ---------------------------------------------------------------- HTTP
ROUTES = []


def route(method, pattern, auth=True, admin=False):
    rx = re.compile("^" + pattern + "$")

    def deco(fn):
        ROUTES.append((method, rx, fn, auth, admin))
        return fn
    return deco


login_failures = {}
login_lock = threading.Lock()


class Handler(BaseHTTPRequestHandler):
    server_version = "Arendehantering/1.0"
    protocol_version = "HTTP/1.1"

    def log_message(self, fmt, *args):
        sys.stderr.write("%s - %s\n" % (self.address_string(), fmt % args))

    # -------- svar
    def send_json(self, status, obj, headers=None):
        body = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        for k, v in (headers or {}).items():
            self.send_header(k, v)
        self.end_headers()
        self.wfile.write(body)

    def send_bytes(self, status, body, ctype, headers=None):
        self.send_response(status)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        for k, v in (headers or {}).items():
            self.send_header(k, v)
        self.end_headers()
        self.wfile.write(body)

    # -------- statiska filer
    def serve_static(self, path):
        if path in ("", "/"):
            path = "/index.html"
        full = os.path.normpath(os.path.join(STATIC_DIR, path.lstrip("/")))
        if not full.startswith(STATIC_DIR) or not os.path.isfile(full):
            full = os.path.join(STATIC_DIR, "index.html")
        ext = os.path.splitext(full)[1].lower()
        ctype = {".html": "text/html; charset=utf-8", ".js": "application/javascript; charset=utf-8",
                 ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png",
                 ".ico": "image/x-icon", ".woff2": "font/woff2"}.get(ext, "application/octet-stream")
        with open(full, "rb") as f:
            body = f.read()
        self.send_bytes(200, body, ctype, {"Cache-Control": "no-cache", "X-Content-Type-Options": "nosniff"})

    # -------- session
    def session_token(self):
        cookie = self.headers.get("Cookie", "")
        m = re.search(r"(?:^|;\s*)" + SESSION_COOKIE + r"=([A-Za-z0-9_\-]+)", cookie)
        return m.group(1) if m else None

    def current_user(self, con):
        tok = self.session_token()
        if not tok:
            return None
        row = con.execute("""SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id
                             WHERE s.token = ? AND s.expires_at > ? AND u.active = 1""", (tok, now())).fetchone()
        return row

    # -------- dispatch
    def handle_any(self, method):
        url = urlparse(self.path)
        path = url.path
        if not path.startswith("/api/"):
            if method != "GET":
                return self.send_json(405, {"error": "Metoden stöds inte."})
            return self.serve_static(path)

        # Skydd mot förfalskade anrop från andra webbplatser
        if method != "GET" and self.headers.get("X-Requested-With") != "ts":
            return self.send_json(403, {"error": "Ogiltigt anrop."})

        for m, rx, fn, need_auth, need_admin in ROUTES:
            if m != method:
                continue
            match = rx.match(path)
            if not match:
                continue
            con = connect()
            try:
                user = self.current_user(con)
                if need_auth and not user:
                    return self.send_json(401, {"error": "Du är inte inloggad."})
                if need_admin and user["role"] != "admin":
                    return self.send_json(403, {"error": "Kräver administratörsbehörighet."})
                body = {}
                if method in ("POST", "PUT", "DELETE"):
                    n = int(self.headers.get("Content-Length") or 0)
                    if n:
                        try:
                            body = json.loads(self.rfile.read(n).decode("utf-8") or "{}")
                        except ValueError:
                            return self.send_json(400, {"error": "Felaktig data."})
                query = {k: v[0] for k, v in parse_qs(url.query).items()}
                ctx = {"con": con, "user": user, "body": body, "query": query, "handler": self}
                result = fn(ctx, *match.groups())
                con.commit()
                if result is None:
                    return
                status, payload = result if isinstance(result, tuple) else (200, result)
                return self.send_json(status, payload)
            except ApiError as e:
                con.rollback()
                return self.send_json(e.status, {"error": e.message})
            except Exception as e:  # pragma: no cover
                con.rollback()
                self.log_error("Fel: %r", e)
                return self.send_json(500, {"error": "Ett oväntat fel uppstod på servern."})
            finally:
                con.close()
        return self.send_json(404, {"error": "Hittades inte."})

    def do_GET(self):
        self.handle_any("GET")

    def do_POST(self):
        self.handle_any("POST")

    def do_PUT(self):
        self.handle_any("PUT")

    def do_DELETE(self):
        self.handle_any("DELETE")


def session_cookie(token, max_age):
    return "{}={}; Path=/; HttpOnly; SameSite=Lax; Max-Age={}".format(SESSION_COOKIE, token, max_age)


def start_session(ctx, user_id):
    tok = secrets.token_urlsafe(32)
    ctx["con"].execute("INSERT INTO sessions(token, user_id, expires_at) VALUES (?,?,?)",
                       (tok, user_id, now() + SESSION_DAYS * 86400))
    ctx["con"].execute("DELETE FROM sessions WHERE expires_at < ?", (now(),))
    return tok


# ================================================================ API: inloggning
@route("GET", r"/api/status", auth=False)
def api_status(ctx):
    n = ctx["con"].execute("SELECT COUNT(*) FROM users").fetchone()[0]
    bc = int_or_none(get_setting(ctx["con"], "booking_category_id"))
    return {"setup_needed": n == 0, "user": user_public(ctx["user"]) if ctx["user"] else None,
            "priorities": PRIORITIES, "status_list": status_rows(ctx["con"]), "booking_category_id": bc}


@route("POST", r"/api/setup", auth=False)
def api_setup(ctx):
    con, b = ctx["con"], ctx["body"]
    need(con.execute("SELECT COUNT(*) FROM users").fetchone()[0] == 0, "Systemet är redan konfigurerat.", 409)
    name, email, pw = s(b.get("name"), 100), s(b.get("email"), 200), str(b.get("password") or "")
    need(name, "Ange ditt namn.")
    need(EMAIL_RE.match(email), "Ange en giltig e-postadress.")
    need(len(pw) >= 8, "Lösenordet måste vara minst 8 tecken.")
    cur = con.execute("INSERT INTO users(name,email,pw_hash,role,active,created_at,lang) VALUES (?,?,?,?,1,?,?)",
                      (name, email, hash_password(pw), "admin", now(), lang_value(b.get("lang"))))
    tok = start_session(ctx, cur.lastrowid)
    con.commit()
    user = con.execute("SELECT * FROM users WHERE id=?", (cur.lastrowid,)).fetchone()
    ctx["handler"].send_json(200, {"user": user_public(user)},
                             {"Set-Cookie": session_cookie(tok, SESSION_DAYS * 86400)})


@route("POST", r"/api/login", auth=False)
def api_login(ctx):
    con, b, h = ctx["con"], ctx["body"], ctx["handler"]
    ip = h.client_address[0]
    with login_lock:
        fails = [t for t in login_failures.get(ip, []) if t > time.time() - 600]
        login_failures[ip] = fails
    need(len(fails) < 10, "För många misslyckade försök. Vänta tio minuter och försök igen.", 429)
    email, pw = s(b.get("email"), 200), str(b.get("password") or "")
    user = con.execute("SELECT * FROM users WHERE email = ? AND active = 1", (email,)).fetchone()
    if not user or not check_password(pw, user["pw_hash"]):
        with login_lock:
            login_failures.setdefault(ip, []).append(time.time())
        time.sleep(0.5)
        raise ApiError(401, "Fel e-postadress eller lösenord.")
    tok = start_session(ctx, user["id"])
    con.commit()
    h.send_json(200, {"user": user_public(user)}, {"Set-Cookie": session_cookie(tok, SESSION_DAYS * 86400)})


@route("POST", r"/api/logout", auth=False)
def api_logout(ctx):
    tok = ctx["handler"].session_token()
    if tok:
        ctx["con"].execute("DELETE FROM sessions WHERE token=?", (tok,))
        ctx["con"].commit()
    ctx["handler"].send_json(200, {"ok": True}, {"Set-Cookie": session_cookie("x", 0)})


@route("PUT", r"/api/me")
def api_me_update(ctx):
    b, u = ctx["body"], ctx["user"]
    burl = booking_url_value(b.get("booking_url", u["booking_url"]))
    lang = lang_value(b.get("lang", u["lang"]))
    ctx["con"].execute("UPDATE users SET booking_url=?, lang=? WHERE id=?", (burl, lang, u["id"]))
    return user_public(ctx["con"].execute("SELECT * FROM users WHERE id=?", (ctx["user"]["id"],)).fetchone())


@route("POST", r"/api/me/password")
def api_me_password(ctx):
    con, b, u = ctx["con"], ctx["body"], ctx["user"]
    need(check_password(str(b.get("current") or ""), u["pw_hash"]), "Nuvarande lösenord stämmer inte.")
    pw = str(b.get("new") or "")
    need(len(pw) >= 8, "Det nya lösenordet måste vara minst 8 tecken.")
    con.execute("UPDATE users SET pw_hash=? WHERE id=?", (hash_password(pw), u["id"]))
    return {"ok": True}


# ================================================================ API: användare
@route("GET", r"/api/users")
def api_users(ctx):
    rows = ctx["con"].execute("SELECT * FROM users ORDER BY name COLLATE NOCASE").fetchall()
    return {"items": [user_public(r) for r in rows]}


def admins_left(con, except_id):
    return con.execute("SELECT COUNT(*) FROM users WHERE role='admin' AND active=1 AND id<>?", (except_id,)).fetchone()[0]


@route("POST", r"/api/users", admin=True)
def api_user_create(ctx):
    con, b = ctx["con"], ctx["body"]
    name, email, pw = s(b.get("name"), 100), s(b.get("email"), 200), str(b.get("password") or "")
    role = "admin" if b.get("role") == "admin" else "agent"
    need(name, "Ange namn.")
    need(EMAIL_RE.match(email), "Ange en giltig e-postadress.")
    need(len(pw) >= 8, "Lösenordet måste vara minst 8 tecken.")
    need(not con.execute("SELECT 1 FROM users WHERE email=?", (email,)).fetchone(), "E-postadressen används redan.", 409)
    cur = con.execute("INSERT INTO users(name,email,pw_hash,role,active,created_at,booking_url,lang) VALUES (?,?,?,?,1,?,?,?)",
                      (name, email, hash_password(pw), role, now(), booking_url_value(b.get("booking_url")), lang_value(b.get("lang"))))
    return user_public(con.execute("SELECT * FROM users WHERE id=?", (cur.lastrowid,)).fetchone())


@route("PUT", r"/api/users/(\d+)", admin=True)
def api_user_update(ctx, uid):
    con, b = ctx["con"], ctx["body"]
    uid = int(uid)
    u = con.execute("SELECT * FROM users WHERE id=?", (uid,)).fetchone()
    need(u, "Användaren finns inte.", 404)
    name = s(b.get("name", u["name"]), 100)
    email = s(b.get("email", u["email"]), 200)
    role = b.get("role", u["role"])
    role = "admin" if role == "admin" else "agent"
    active = 1 if b.get("active", bool(u["active"])) else 0
    need(name, "Ange namn.")
    need(EMAIL_RE.match(email), "Ange en giltig e-postadress.")
    need(not con.execute("SELECT 1 FROM users WHERE email=? AND id<>?", (email, uid)).fetchone(), "E-postadressen används redan.", 409)
    if u["role"] == "admin" and (role != "admin" or not active):
        need(admins_left(con, uid) > 0, "Det måste finnas minst en aktiv administratör.")
    burl = booking_url_value(b.get("booking_url", u["booking_url"]))
    ulang = lang_value(b.get("lang", u["lang"]))
    con.execute("UPDATE users SET name=?, email=?, role=?, active=?, booking_url=?, lang=? WHERE id=?", (name, email, role, active, burl, ulang, uid))
    pw = str(b.get("password") or "")
    if pw:
        need(len(pw) >= 8, "Lösenordet måste vara minst 8 tecken.")
        con.execute("UPDATE users SET pw_hash=? WHERE id=?", (hash_password(pw), uid))
    if not active or pw:
        con.execute("DELETE FROM sessions WHERE user_id=? AND token<>?", (uid, ctx["handler"].session_token() or ""))
    return user_public(con.execute("SELECT * FROM users WHERE id=?", (uid,)).fetchone())


# ================================================================ API: kategorier
@route("GET", r"/api/categories")
def api_categories(ctx):
    rows = ctx["con"].execute("""SELECT c.id, c.name, COUNT(t.id) AS used FROM categories c
                                 LEFT JOIN tickets t ON t.category_id=c.id GROUP BY c.id ORDER BY c.name COLLATE NOCASE""").fetchall()
    return {"items": [dict(r) for r in rows]}


@route("POST", r"/api/categories", admin=True)
def api_category_create(ctx):
    name = s(ctx["body"].get("name"), 60)
    need(name, "Ange ett namn.")
    need(not ctx["con"].execute("SELECT 1 FROM categories WHERE name=?", (name,)).fetchone(), "Kategorin finns redan.", 409)
    cur = ctx["con"].execute("INSERT INTO categories(name) VALUES (?)", (name,))
    return {"id": cur.lastrowid, "name": name}


@route("PUT", r"/api/categories/(\d+)", admin=True)
def api_category_update(ctx, cid):
    name = s(ctx["body"].get("name"), 60)
    need(name, "Ange ett namn.")
    need(not ctx["con"].execute("SELECT 1 FROM categories WHERE name=? AND id<>?", (name, int(cid))).fetchone(), "Kategorin finns redan.", 409)
    ctx["con"].execute("UPDATE categories SET name=? WHERE id=?", (name, int(cid)))
    return {"ok": True}


@route("DELETE", r"/api/categories/(\d+)", admin=True)
def api_category_delete(ctx, cid):
    if str(int(cid)) == get_setting(ctx["con"], "booking_category_id"):
        set_setting(ctx["con"], "booking_category_id", "")
    ctx["con"].execute("UPDATE tickets SET category_id=NULL WHERE category_id=?", (int(cid),))
    ctx["con"].execute("DELETE FROM categories WHERE id=?", (int(cid),))
    return {"ok": True}


# ================================================================ API: kunder
def require_staff(ctx):
    need(ctx["user"]["role"] in ("admin", "agent"), "Bara administratörer och handläggare kan ändra beställare.", 403)


def customer_fields(b):
    f = {k: s(b.get(k), 200) for k in ("first_name", "last_name", "company", "title", "phone", "email")}
    need(f["first_name"], "Ange förnamn.")
    need(not f["email"] or EMAIL_RE.match(f["email"]), "E-postadressen ser inte giltig ut.")
    return f


@route("GET", r"/api/customers")
def api_customers(ctx):
    q = s(ctx["query"].get("q"), 100)
    sql = """SELECT cu.*, COUNT(t.id) AS ticket_count,
                    SUM(CASE WHEN t.status NOT IN (SELECT name FROM statuses WHERE closed=1) AND t.archived_at IS NULL THEN 1 ELSE 0 END) AS open_count
             FROM customers cu LEFT JOIN tickets t ON t.customer_id=cu.id"""
    args = []
    if q:
        sql += """ WHERE (cu.first_name || ' ' || cu.last_name) LIKE ? OR cu.company LIKE ? OR cu.email LIKE ? OR cu.phone LIKE ?"""
        args = ["%" + q + "%"] * 4
    sql += " GROUP BY cu.id ORDER BY cu.last_name COLLATE NOCASE, cu.first_name COLLATE NOCASE"
    return {"items": [customer_public(r) for r in ctx["con"].execute(sql, args).fetchall()]}


@route("GET", r"/api/customers/(\d+)")
def api_customer(ctx, cid):
    con = ctx["con"]
    row = con.execute("SELECT * FROM customers WHERE id=?", (int(cid),)).fetchone()
    need(row, "Beställaren finns inte.", 404)
    tickets = con.execute(TICKET_SELECT + " WHERE t.customer_id=? ORDER BY t.created_at DESC LIMIT 20", (int(cid),)).fetchall()
    d = customer_public(row)
    d["tickets"] = [dict(t) for t in tickets]
    return d


@route("POST", r"/api/customers")
def api_customer_create(ctx):
    require_staff(ctx)
    f = customer_fields(ctx["body"])
    t = now()
    cur = ctx["con"].execute("""INSERT INTO customers(first_name,last_name,company,title,phone,email,created_at,updated_at)
                                VALUES (:first_name,:last_name,:company,:title,:phone,:email,:t,:t)""", dict(f, t=t))
    return customer_public(ctx["con"].execute("SELECT * FROM customers WHERE id=?", (cur.lastrowid,)).fetchone())


@route("PUT", r"/api/customers/(\d+)")
def api_customer_update(ctx, cid):
    require_staff(ctx)
    f = customer_fields(ctx["body"])
    need(ctx["con"].execute("SELECT 1 FROM customers WHERE id=?", (int(cid),)).fetchone(), "Beställaren finns inte.", 404)
    ctx["con"].execute("""UPDATE customers SET first_name=:first_name,last_name=:last_name,company=:company,title=:title,
                          phone=:phone,email=:email,updated_at=:t WHERE id=:id""", dict(f, t=now(), id=int(cid)))
    return customer_public(ctx["con"].execute("SELECT * FROM customers WHERE id=?", (int(cid),)).fetchone())


@route("POST", r"/api/customers/delete")
def api_customers_delete(ctx):
    require_staff(ctx)
    con = ctx["con"]
    ids = [int(i) for i in ctx["body"].get("ids", []) if int_or_none(i)]
    need(ids, "Inga beställare valda.")
    blocked = con.execute("SELECT DISTINCT customer_id FROM tickets WHERE customer_id IN (%s)" % ",".join("?" * len(ids)), ids).fetchall()
    blocked = {r[0] for r in blocked}
    deletable = [i for i in ids if i not in blocked]
    if deletable:
        con.execute("DELETE FROM customers WHERE id IN (%s)" % ",".join("?" * len(deletable)), deletable)
    return {"deleted": len(deletable), "blocked": len(blocked)}


# ================================================================ API: ärenden
def ticket_filters(q):
    where, args = [], []
    archived = q.get("archived", "0")
    if archived == "1":
        where.append("t.archived_at IS NOT NULL")
    elif archived != "all":
        where.append("t.archived_at IS NULL")
    if q.get("status") == "open":
        where.append("t.status NOT IN " + CLOSED_SUB)
    elif q.get("status") == "closed":
        where.append("t.status IN " + CLOSED_SUB)
    elif q.get("status"):
        where.append("t.status=?"); args.append(q["status"])
    if q.get("priority") in PRIORITIES:
        where.append("t.priority=?"); args.append(q["priority"])
    for key, col in (("category", "t.category_id"), ("customer", "t.customer_id"), ("assignee", "t.assignee_id")):
        v = q.get(key)
        if v == "none":
            where.append(col + " IS NULL")
        elif int_or_none(v):
            where.append(col + "=?"); args.append(int(v))
    for key, col, op in (("created_from", "t.created_at", ">="), ("created_to", "t.created_at", "<="),
                         ("closed_from", "t.closed_at", ">="), ("closed_to", "t.closed_at", "<=")):
        v = int_or_none(q.get(key))
        if v is not None:
            where.append("{} {} ?".format(col, op)); args.append(v)
    text = s(q.get("q"), 100)
    if text:
        where.append("""(t.title LIKE ? OR t.details LIKE ? OR (cu.first_name || ' ' || cu.last_name) LIKE ?
                         OR cu.company LIKE ? OR CAST(t.id AS TEXT) = ?)""")
        args += ["%" + text + "%"] * 4 + [text.lstrip("#")]
    return (" WHERE " + " AND ".join(where)) if where else "", args


SORTS = {
    "date_desc": "t.created_at DESC",
    "date_asc": "t.created_at ASC",
    "priority": "CASE t.priority WHEN 'Hög' THEN 0 WHEN 'Medium' THEN 1 ELSE 2 END, t.created_at DESC",
    "status": "(SELECT sort FROM statuses st WHERE st.name=t.status), t.created_at DESC",
    "updated": "t.updated_at DESC",
}


@route("GET", r"/api/tickets")
def api_tickets(ctx):
    q = ctx["query"]
    where, args = ticket_filters(q)
    con = ctx["con"]
    total = con.execute("SELECT COUNT(*) FROM tickets t LEFT JOIN customers cu ON cu.id=t.customer_id" + where, args).fetchone()[0]
    page = max(1, int_or_none(q.get("page")) or 1)
    order = SORTS.get(q.get("sort"), SORTS["date_desc"])
    rows = con.execute(TICKET_SELECT + where + " ORDER BY " + order + " LIMIT ? OFFSET ?",
                       args + [PAGE_SIZE, (page - 1) * PAGE_SIZE]).fetchall()
    return {"items": [dict(r) for r in rows], "total": total, "page": page, "page_size": PAGE_SIZE}


def get_ticket(con, tid):
    row = con.execute(TICKET_SELECT + " WHERE t.id=?", (tid,)).fetchone()
    need(row, "Ärendet finns inte längre.", 404)
    return dict(row)


def validate_refs(con, b):
    for key, table in (("category_id", "categories"), ("customer_id", "customers"), ("assignee_id", "users")):
        v = int_or_none(b.get(key))
        if v is not None:
            need(con.execute("SELECT 1 FROM {} WHERE id=?".format(table), (v,)).fetchone(), "Ogiltigt val: " + key)


def ticket_comments(con, tid):
    return [dict(r) for r in con.execute("""SELECT c.id, c.body, c.created_at, c.user_id, u.name AS author FROM comments c
                                            LEFT JOIN users u ON u.id=c.user_id WHERE c.ticket_id=? ORDER BY c.created_at, c.id""", (tid,)).fetchall()]


@route("GET", r"/api/tickets/(\d+)")
def api_ticket(ctx, tid):
    t = get_ticket(ctx["con"], int(tid))
    t["comments"] = ticket_comments(ctx["con"], int(tid))
    st = status_by_name(ctx["con"], t["status"])
    t["status_locked"] = bool(st and st["locked"])
    return t


@route("POST", r"/api/tickets/(\d+)/comments")
def api_comment_create(ctx, tid):
    tid = int(tid)
    get_ticket(ctx["con"], tid)
    body = s(ctx["body"].get("body"), 10000)
    need(body, "Skriv en kommentar först.")
    ctx["con"].execute("INSERT INTO comments(ticket_id,user_id,body,created_at) VALUES (?,?,?,?)", (tid, ctx["user"]["id"], body, now()))
    ctx["con"].execute("UPDATE tickets SET updated_at=? WHERE id=?", (now(), tid))
    return {"comments": ticket_comments(ctx["con"], tid)}


@route("DELETE", r"/api/comments/(\d+)")
def api_comment_delete(ctx, cid):
    c = ctx["con"].execute("SELECT * FROM comments WHERE id=?", (int(cid),)).fetchone()
    need(c, "Kommentaren finns inte.", 404)
    need(c["user_id"] == ctx["user"]["id"] or ctx["user"]["role"] == "admin", "Du kan bara ta bort dina egna kommentarer.", 403)
    ctx["con"].execute("DELETE FROM comments WHERE id=?", (int(cid),))
    return {"comments": ticket_comments(ctx["con"], c["ticket_id"])}


# ================================================================ API: statusar
def status_payload(b, cur=None):
    name = s(b.get("name", cur["name"] if cur else ""), 40)
    need(name, "Ange ett namn på statusen.")
    closed = 1 if b.get("closed", cur["closed"] if cur else 0) else 0
    locked = 1 if b.get("locked", cur["locked"] if cur else 0) else 0
    need(not locked or closed, "Bara en avslutad status kan vara låst.")
    color = b.get("color", cur["color"] if cur else "blue")
    color = color if color in STATUS_COLORS else "grey"
    return name, closed, locked, color


def check_open_left(con, except_id=None, becomes_closed=False):
    n = con.execute("SELECT COUNT(*) FROM statuses WHERE closed=0 AND id<>?", (except_id or 0,)).fetchone()[0]
    need(n > 0 or not becomes_closed, "Det måste finnas minst en status som inte är avslutad.")


@route("GET", r"/api/statuses")
def api_statuses(ctx):
    rows = status_rows(ctx["con"])
    for r in rows:
        r["used"] = ctx["con"].execute("SELECT COUNT(*) FROM tickets WHERE status=?", (r["name"],)).fetchone()[0]
    return {"items": rows}


@route("POST", r"/api/statuses", admin=True)
def api_status_create(ctx):
    con = ctx["con"]
    name, closed, locked, color = status_payload(ctx["body"])
    need(not status_by_name(con, name), "Statusen finns redan.", 409)
    mx = con.execute("SELECT COALESCE(MAX(sort),0) FROM statuses").fetchone()[0]
    con.execute("INSERT INTO statuses(name,sort,closed,locked,color) VALUES (?,?,?,?,?)", (name, mx + 1, closed, locked, color))
    return api_statuses(ctx)


@route("PUT", r"/api/statuses/(\d+)", admin=True)
def api_status_update(ctx, sid):
    con, sid = ctx["con"], int(sid)
    cur = con.execute("SELECT * FROM statuses WHERE id=?", (sid,)).fetchone()
    need(cur, "Statusen finns inte.", 404)
    name, closed, locked, color = status_payload(ctx["body"], cur)
    need(not con.execute("SELECT 1 FROM statuses WHERE name=? AND id<>?", (name, sid)).fetchone(), "Det finns redan en status med det namnet.", 409)
    if closed and not cur["closed"]:
        check_open_left(con, sid, True)
    con.execute("UPDATE statuses SET name=?, closed=?, locked=?, color=? WHERE id=?", (name, closed, locked, color, sid))
    if name != cur["name"]:
        con.execute("UPDATE tickets SET status=? WHERE status=?", (name, cur["name"]))
    t = now()
    if closed and not cur["closed"]:
        con.execute("UPDATE tickets SET closed_at=? WHERE status=? AND closed_at IS NULL", (t, name))
    elif not closed and cur["closed"]:
        con.execute("UPDATE tickets SET closed_at=NULL, archived_at=NULL WHERE status=?", (name,))
    return api_statuses(ctx)


@route("DELETE", r"/api/statuses/(\d+)", admin=True)
def api_status_delete(ctx, sid):
    con, sid = ctx["con"], int(sid)
    cur = con.execute("SELECT * FROM statuses WHERE id=?", (sid,)).fetchone()
    need(cur, "Statusen finns inte.", 404)
    n = con.execute("SELECT COUNT(*) FROM tickets WHERE status=?", (cur["name"],)).fetchone()[0]
    need(n == 0, "Statusen används av {} ärenden och kan inte tas bort. Byt status på dem först.".format(n), 409)
    if not cur["closed"]:
        check_open_left(con, sid, True)
    con.execute("DELETE FROM statuses WHERE id=?", (sid,))
    return api_statuses(ctx)


@route("POST", r"/api/statuses/order", admin=True)
def api_status_order(ctx):
    ids = [int_or_none(i) for i in ctx["body"].get("ids", [])]
    for i, sid in enumerate(ids):
        if sid:
            ctx["con"].execute("UPDATE statuses SET sort=? WHERE id=?", (i + 1, sid))
    return api_statuses(ctx)


@route("POST", r"/api/tickets")
def api_ticket_create(ctx):
    con, b = ctx["con"], ctx["body"]
    title = s(b.get("title"), 200)
    need(title, "Ange en titel.")
    prio = b.get("priority") if b.get("priority") in PRIORITIES else "Medium"
    need(int_or_none(b.get("customer_id")), "Koppla ärendet till en beställare.")
    validate_refs(con, b)
    t = now()
    cur = con.execute("""INSERT INTO tickets(title,details,priority,status,category_id,customer_id,assignee_id,created_by,created_at,updated_at)
                         VALUES (?,?,?,?,?,?,?,?,?,?)""",
                      (title, s(b.get("details"), 20000), prio, first_open_status(con), int_or_none(b.get("category_id")),
                       int_or_none(b.get("customer_id")), int_or_none(b.get("assignee_id")), ctx["user"]["id"], t, t))
    out = get_ticket(con, cur.lastrowid)
    if out["assignee_id"]:
        out["notify"] = notify_assignment(con, out, ctx["user"])
    return out


@route("PUT", r"/api/tickets/(\d+)")
def api_ticket_update(ctx, tid):
    con, b = ctx["con"], ctx["body"]
    tid = int(tid)
    old = get_ticket(con, tid)
    fields = {}
    if "title" in b:
        fields["title"] = s(b["title"], 200)
        need(fields["title"], "Ange en titel.")
    if "details" in b:
        fields["details"] = s(b["details"], 20000)
    if "priority" in b:
        need(b["priority"] in PRIORITIES, "Ogiltig prioritet.")
        fields["priority"] = b["priority"]
    if "status" in b:
        new_st = status_by_name(con, b["status"])
        need(new_st, "Ogiltig status.")
        old_st = status_by_name(con, old["status"])
        if b["status"] != old["status"] and old_st and old_st["locked"]:
            need(ctx["user"]["role"] == "admin",
                 "Ärendet har status {} och kan inte öppnas igen. Bara en administratör kan ändra status.".format(old["status"]), 403)
        fields["status"] = b["status"]
        if new_st["closed"] and not (old_st and old_st["closed"]):
            fields["closed_at"] = now()
        elif not new_st["closed"]:
            fields["closed_at"] = None
            fields["archived_at"] = None
    for key in ("category_id", "customer_id", "assignee_id"):
        if key in b:
            fields[key] = int_or_none(b[key])
    if "customer_id" in fields:
        need(fields["customer_id"], "Koppla ärendet till en beställare.")
    validate_refs(con, b)
    if fields:
        fields["updated_at"] = now()
        con.execute("UPDATE tickets SET " + ", ".join(k + "=?" for k in fields) + " WHERE id=?", list(fields.values()) + [tid])
    out = get_ticket(con, tid)
    if "assignee_id" in fields and fields["assignee_id"] and fields["assignee_id"] != old["assignee_id"]:
        out["notify"] = notify_assignment(con, out, ctx["user"])
    return out


@route("DELETE", r"/api/tickets/(\d+)")
def api_ticket_delete(ctx, tid):
    get_ticket(ctx["con"], int(tid))
    ctx["con"].execute("DELETE FROM tickets WHERE id=?", (int(tid),))
    return {"ok": True}


@route("POST", r"/api/tickets/bulk")
def api_tickets_bulk(ctx):
    con, b = ctx["con"], ctx["body"]
    ids = [int(i) for i in b.get("ids", []) if int_or_none(i)]
    need(ids, "Inga ärenden valda.")
    ph = ",".join("?" * len(ids))
    t = now()
    action = b.get("action")
    if action == "status":
        st = status_by_name(con, b.get("status"))
        need(st, "Ogiltig status.")
        locked_guard = "" if ctx["user"]["role"] == "admin" else " AND status NOT IN (SELECT name FROM statuses WHERE locked=1)"
        if st["closed"]:
            cur = con.execute("UPDATE tickets SET status=?, closed_at=COALESCE(CASE WHEN status IN " + CLOSED_SUB + " THEN closed_at END, ?), updated_at=? "
                              "WHERE status<>? AND id IN (%s)" % ph + locked_guard, [st["name"], t, t, st["name"]] + ids)
        else:
            cur = con.execute("UPDATE tickets SET status=?, closed_at=NULL, archived_at=NULL, updated_at=? WHERE status<>? AND id IN (%s)" % ph + locked_guard,
                              [st["name"], t, st["name"]] + ids)
    elif action == "archive":
        cur = con.execute("UPDATE tickets SET archived_at=?, updated_at=? WHERE status IN " + CLOSED_SUB + " AND archived_at IS NULL AND id IN (%s)" % ph, [t, t] + ids)
    elif action == "delete":
        cur = con.execute("DELETE FROM tickets WHERE id IN (%s)" % ph, ids)
    else:
        raise ApiError(400, "Okänd åtgärd.")
    return {"changed": cur.rowcount}


@route("POST", r"/api/tickets/archive-closed")
def api_archive_closed(ctx):
    t = now()
    cur = ctx["con"].execute("UPDATE tickets SET archived_at=?, updated_at=? WHERE status IN " + CLOSED_SUB + " AND archived_at IS NULL", (t, t))
    return {"archived": cur.rowcount}


# ================================================================ API: dashboard
@route("GET", r"/api/dashboard")
def api_dashboard(ctx):
    con, q = ctx["con"], ctx["query"]
    t_to = int_or_none(q.get("to")) or now()
    t_from = int_or_none(q.get("from")) or (t_to - 7 * 86400)
    need(t_from < t_to, "Startdatum måste vara före slutdatum.")
    span = t_to - t_from
    tz = int_or_none(q.get("tz")) or 0   # JS getTimezoneOffset() i minuter

    extra, args = [], []
    if q.get("priority") in PRIORITIES:
        extra.append("priority=?"); args.append(q["priority"])
    if int_or_none(q.get("category")):
        extra.append("category_id=?"); args.append(int(q["category"]))
    f = "".join(" AND " + e for e in extra)

    def one(sql, a=()):
        return con.execute(sql, list(a)).fetchone()[0] or 0

    open_ = "status NOT IN " + CLOSED_SUB + " AND archived_at IS NULL"
    cards = {}
    for key, cond in (("unassigned", open_ + " AND assignee_id IS NULL"), ("open", open_),
                      ("high", open_ + " AND priority='Hög'")):
        base_cond = cond.replace(" AND archived_at IS NULL", "")
        cards[key] = {
            "value": one("SELECT COUNT(*) FROM tickets WHERE " + cond + f, args),
            # skapade i perioden respektive perioden innan, som fortfarande uppfyller villkoret
            "period": one("SELECT COUNT(*) FROM tickets WHERE created_at BETWEEN ? AND ? AND " + base_cond + f, [t_from, t_to] + args),
            "previous": one("SELECT COUNT(*) FROM tickets WHERE created_at >= ? AND created_at < ? AND " + base_cond + f, [t_from - span, t_from] + args),
        }

    created = one("SELECT COUNT(*) FROM tickets WHERE created_at BETWEEN ? AND ?" + f, [t_from, t_to] + args)
    closed_breakdown = [{"name": r[0], "n": r[1]} for r in con.execute(
        "SELECT s.name, COUNT(t.id) FROM statuses s LEFT JOIN tickets t ON t.status=s.name AND t.created_at BETWEEN ? AND ?" + f.replace(" AND ", " AND t.") +
        " WHERE s.closed=1 GROUP BY s.id ORDER BY s.sort", [t_from, t_to] + args).fetchall()]
    created_closed = sum(x["n"] for x in closed_breakdown)

    cust = con.execute("""SELECT t.customer_id, (SELECT MIN(created_at) FROM tickets t2 WHERE t2.customer_id=t.customer_id) AS first
                          FROM tickets t WHERE t.customer_id IS NOT NULL AND t.created_at BETWEEN ? AND ?""" + f.replace(" AND ", " AND t.") +
                       " GROUP BY t.customer_id", [t_from, t_to] + args).fetchall()
    new_c = sum(1 for r in cust if r["first"] >= t_from)

    shift = -tz * 60
    def per_day(col):
        rows = con.execute("SELECT date({c} + ?, 'unixepoch') AS d, COUNT(*) AS n FROM tickets WHERE {c} BETWEEN ? AND ?{f} GROUP BY d"
                           .format(c=col, f=f), [shift, t_from, t_to] + args).fetchall()
        return {r["d"]: r["n"] for r in rows}
    cr, cl = per_day("created_at"), per_day("closed_at")
    days = []
    d = t_from + shift
    end = t_to + shift
    while d <= end and len(days) < 400:
        key = time.strftime("%Y-%m-%d", time.gmtime(d))
        if not days or days[-1]["date"] != key:
            days.append({"date": key, "created": cr.get(key, 0), "closed": cl.get(key, 0)})
        d += 86400
    last = time.strftime("%Y-%m-%d", time.gmtime(end))
    if days and days[-1]["date"] != last:
        days.append({"date": last, "created": cr.get(last, 0), "closed": cl.get(last, 0)})

    return {"cards": cards, "created": created, "created_closed": created_closed, "closed_breakdown": closed_breakdown,
            "customers_total": len(cust), "customers_new": new_c, "series": days}


# ================================================================ API: Excel-export
@route("GET", r"/api/export\.xlsx")
def api_export(ctx):
    con = ctx["con"]
    tz = int_or_none(ctx["query"].get("tz")) or 0
    L = lang_value(ctx["query"].get("lang") or ctx["user"]["lang"])
    _ = lambda x: T(L, x)

    def serial(ts):
        return round((ts - tz * 60) / 86400 + 25569, 6) if ts else ""

    headers = [_(h) for h in ["ID", "Titel", "Beskrivning", "Prioritet", "Status", "Kategori", "Beställare_1", "Företag", "Beställare e-post",
                              "Beställare telefon", "Handläggare", "Skapad av", "Skapad", "Senast ändrad", "Avslutad", "Arkiverad"]]
    widths = [6, 36, 60, 10, 10, 16, 22, 20, 28, 16, 20, 20, 17, 17, 17, 17]

    def rows(cond):
        out = []
        for t in con.execute(TICKET_SELECT + " WHERE " + cond + " ORDER BY t.id").fetchall():
            out.append([t["id"], t["title"], t["details"], TV(L, t["priority"]), TV(L, t["status"]), TV(L, t["category"]) or "",
                        t["customer_name"] or "", t["customer_company"] or "", t["customer_email"] or "",
                        t["customer_phone"] or "", t["assignee_name"] or "", t["created_by_name"] or "",
                        serial(t["created_at"]), serial(t["updated_at"]), serial(t["closed_at"]), serial(t["archived_at"])])
        return out

    cust = [[c["id"], c["first_name"], c["last_name"], c["company"], c["title"], c["phone"], c["email"], serial(c["created_at"])]
            for c in con.execute("SELECT * FROM customers ORDER BY last_name, first_name").fetchall()]
    dates = {12, 13, 14, 15}
    comments = [[c["ticket_id"], c["title"], serial(c["created_at"]), c["author"] or "", c["body"]]
                for c in con.execute("""SELECT c.*, t.title, u.name AS author FROM comments c JOIN tickets t ON t.id=c.ticket_id
                                        LEFT JOIN users u ON u.id=c.user_id ORDER BY c.ticket_id, c.created_at""").fetchall()]
    data = build_xlsx([
        (_("Ärenden"), headers, rows("t.archived_at IS NULL"), dates, widths),
        (_("Arkiv"), headers, rows("t.archived_at IS NOT NULL"), dates, widths),
        (_("Beställare"), [_(h) for h in ["ID", "Förnamn", "Efternamn", "Företag", "Titel", "Telefon", "E-post", "Skapad"]], cust, {7}, [6, 16, 18, 22, 18, 16, 28, 17]),
        (_("Kommentarer"), [_(h) for h in ["Ärende-ID", "Ärende", "Skriven", "Av", "Kommentar"]], comments, {2}, [10, 36, 17, 22, 80]),
    ])
    fname = ("tickets-{}.xlsx" if L == "en" else "arenden-{}.xlsx").format(time.strftime("%Y-%m-%d"))
    ctx["handler"].send_bytes(200, data, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                              {"Content-Disposition": 'attachment; filename="{}"'.format(fname), "Cache-Control": "no-store"})


# ================================================================ e-post
SMTP_KEYS = ["smtp_enabled", "smtp_host", "smtp_port", "smtp_security", "smtp_user", "smtp_from", "smtp_from_name", "base_url",
             "smtp_tls_verify", "smtp_ca_pem"]
TLS_MODES = ("verify", "pinned", "none")


def make_ssl_context(cfg):
    """verify = vanlig kontroll, pinned = lita bara på inklistrat certifikat, none = ingen kontroll."""
    mode = cfg.get("smtp_tls_verify") or "verify"
    if mode == "none":
        c = ssl.create_default_context()
        c.check_hostname = False
        c.verify_mode = ssl.CERT_NONE
        return c
    if mode == "pinned":
        pem = cfg.get("smtp_ca_pem") or ""
        if "BEGIN CERTIFICATE" not in pem:
            raise ApiError(400, "Inget certifikat är inlagt. Hämta eller klistra in serverns certifikat.")
        c = ssl.create_default_context(cadata=pem)
        # Certifikatet är uttryckligen godkänt, så namnet behöver inte matcha och kedjan får vara ofullständig
        c.check_hostname = False
        c.verify_flags |= getattr(ssl, "VERIFY_X509_PARTIAL_CHAIN", 0x80000)
        return c
    return ssl.create_default_context()


def explain_mail_error(e):
    msg = str(e)
    if "CERTIFICATE_VERIFY_FAILED" in msg or isinstance(e, ssl.SSLCertVerificationError):
        return msg + " – Mailserverns certifikat godkänns inte. Välj \"Lita på serverns certifikat\" under Certifikatkontroll och klicka \"Hämta certifikat från servern\"."
    if isinstance(e, smtplib.SMTPAuthenticationError):
        return msg + " – Användarnamn eller lösenord godtas inte av mailservern."
    return msg


def smtp_config(con):
    c = {k: get_setting(con, k) for k in SMTP_KEYS}
    c["smtp_password"] = get_setting(con, "smtp_password")
    return c


def send_mail(cfg, to, subject, body):
    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = formataddr((cfg.get("smtp_from_name") or T(cfg.get("_lang", "sv"), "Ärendehantering"), cfg["smtp_from"]))
    msg["To"] = to
    msg.set_content(body)
    port = int(cfg.get("smtp_port") or 587)
    sec = cfg.get("smtp_security") or "starttls"
    ctxssl = make_ssl_context(cfg)
    if sec == "ssl":
        srv = smtplib.SMTP_SSL(cfg["smtp_host"], port, timeout=20, context=ctxssl)
    else:
        srv = smtplib.SMTP(cfg["smtp_host"], port, timeout=20)
    try:
        srv.ehlo()
        if sec == "starttls":
            srv.starttls(context=ctxssl)
            srv.ehlo()
        if cfg.get("smtp_user"):
            srv.login(cfg["smtp_user"], cfg.get("smtp_password", ""))
        srv.send_message(msg)
    finally:
        try:
            srv.quit()
        except Exception:
            pass


def record_mail_result(error):
    con = connect()
    try:
        set_setting(con, "smtp_last_result", json.dumps({"at": now(), "error": error}))
        con.commit()
    finally:
        con.close()


def send_mail_async(cfg, to, subject, body):
    def run():
        try:
            send_mail(cfg, to, subject, body)
            record_mail_result(None)
        except Exception as e:
            sys.stderr.write("Mail till %s misslyckades: %r\n" % (to, e))
            record_mail_result("Mail till {} misslyckades: {}".format(to, explain_mail_error(e)))
    threading.Thread(target=run, daemon=True).start()


def notify_assignment(con, t, by_user):
    """Mailar handläggaren när ett ärende tilldelas. Returnerar info till gränssnittet."""
    a = con.execute("SELECT * FROM users WHERE id=?", (t["assignee_id"],)).fetchone()
    if not a:
        return None
    cfg = smtp_config(con)
    if cfg["smtp_enabled"] != "1" or not cfg["smtp_host"] or not cfg["smtp_from"]:
        return {"sent": False, "to": a["email"], "reason": "Mail är inte inställt (Inställningar → E-post)."}
    base = (cfg["base_url"] or "").rstrip("/")
    L = a["lang"] if "lang" in a.keys() else "sv"
    _ = lambda x: T(L, x)
    lines = [
        _("Hej {},").format(a["name"]),
        "",
        _("{} har tilldelat dig ett ärende.").format(by_user["name"]),
        "",
        _("Ärende:     #{} {}").format(t["id"], t["title"]),
        _("Prioritet:  {}").format(TV(L, t["priority"])),
        _("Status:     {}").format(TV(L, t["status"])),
        _("Kategori:   {}").format(TV(L, t["category"]) or "–"),
        _("Beställare: {}{}").format(t["customer_name"] or "–", " (" + t["customer_company"] + ")" if t["customer_company"] else ""),
    ]
    if t["customer_phone"] or t["customer_email"]:
        lines.append(_("Kontakt:    {}").format(" · ".join(x for x in (t["customer_phone"], t["customer_email"]) if x)))
    if t["details"]:
        lines += ["", _("Detaljer:"), t["details"]]
    if base:
        lines += ["", _("Öppna ärendet: {}/#/tickets/{}").format(base, t["id"])]
    bc = int_or_none(get_setting(con, "booking_category_id"))
    if bc and t["category_id"] == bc:
        lines += ["", _("Ärendet gäller tidsbokning för IT-support.")]
        lines.append(_("Din bokningssida: {}").format(a["booking_url"]) if a["booking_url"] else
                     _("Du har ingen bokningssida inlagd. Lägg in den under Inställningar → Mitt konto."))
    subject = _("Ärende #{} har tilldelats dig: {}").format(t["id"], t["title"])
    send_mail_async(dict(cfg, _lang=L), a["email"], subject, "\n".join(lines))
    return {"sent": True, "to": a["email"]}


@route("GET", r"/api/settings", admin=True)
def api_settings(ctx):
    con = ctx["con"]
    c = smtp_config(con)
    has_pw = bool(c.pop("smtp_password"))
    try:
        last = json.loads(get_setting(con, "smtp_last_result") or "null")
    except ValueError:
        last = None
    return {"smtp": dict(c, has_password=has_pw), "last_mail": last,
            "booking_category_id": int_or_none(get_setting(con, "booking_category_id"))}


@route("PUT", r"/api/settings", admin=True)
def api_settings_update(ctx):
    con, b = ctx["con"], ctx["body"]
    if "smtp" in b:
        m = b["smtp"]
        enabled = "1" if m.get("smtp_enabled") else "0"
        host, frm = s(m.get("smtp_host"), 200), s(m.get("smtp_from"), 200)
        port = int_or_none(m.get("smtp_port")) or 587
        sec = m.get("smtp_security") if m.get("smtp_security") in ("starttls", "ssl", "none") else "starttls"
        base = s(m.get("base_url"), 300)
        if enabled == "1":
            need(host, "Ange SMTP-server.")
            need(EMAIL_RE.match(frm), "Ange en giltig avsändaradress.")
        need(not base or re.match(r"^https?://", base), "Systemets adress måste börja med http:// eller https://")
        for k, v in (("smtp_enabled", enabled), ("smtp_host", host), ("smtp_port", port), ("smtp_security", sec),
                     ("smtp_user", s(m.get("smtp_user"), 200)), ("smtp_from", frm), ("smtp_from_name", s(m.get("smtp_from_name"), 100)),
                     ("base_url", base)):
            set_setting(con, k, v)
        mode = m.get("smtp_tls_verify") if m.get("smtp_tls_verify") in TLS_MODES else "verify"
        pem = str(m.get("smtp_ca_pem") or "").strip()
        if mode == "pinned":
            need("BEGIN CERTIFICATE" in pem, "Klistra in eller hämta serverns certifikat för att kunna lita på det.")
            try:
                ssl.create_default_context(cadata=pem)
            except Exception:
                raise ApiError(400, "Certifikatet kunde inte läsas. Kontrollera att hela texten från BEGIN till END finns med.")
        if sec == "none" and mode != "verify":
            mode = "verify"
        set_setting(con, "smtp_tls_verify", mode)
        set_setting(con, "smtp_ca_pem", pem)
        if m.get("smtp_password"):
            set_setting(con, "smtp_password", str(m["smtp_password"]))
        if m.get("clear_password"):
            set_setting(con, "smtp_password", "")
    if "booking_category_id" in b:
        v = int_or_none(b["booking_category_id"])
        if v:
            need(con.execute("SELECT 1 FROM categories WHERE id=?", (v,)).fetchone(), "Kategorin finns inte.")
        set_setting(con, "booking_category_id", v or "")
    return api_settings(ctx)


@route("POST", r"/api/settings/test-mail", admin=True)
def api_test_mail(ctx):
    cfg = smtp_config(ctx["con"])
    need(cfg["smtp_host"] and cfg["smtp_from"], "Fyll i och spara mailinställningarna först.")
    to = ctx["user"]["email"]
    try:
        L = ctx["user"]["lang"]
        send_mail(dict(cfg, _lang=L), to, T(L, "Testmail från Ärendehantering"),
                  T(L, "Det här är ett testmail. Mailinställningarna fungerar."))
    except ApiError:
        raise
    except Exception as e:
        raise ApiError(502, "Testmailet kunde inte skickas: {}".format(explain_mail_error(e)))
    return {"ok": True, "to": to}


@route("POST", r"/api/settings/fetch-cert", admin=True)
def api_fetch_cert(ctx):
    """Hämtar certifikatet som mailservern visar upp, utan att kontrollera det, så att administratören kan godkänna det."""
    cfg = smtp_config(ctx["con"])
    host, sec = cfg["smtp_host"], cfg["smtp_security"] or "starttls"
    need(host, "Fyll i och spara SMTP-server först.")
    need(sec in ("starttls", "ssl"), "Certifikat finns bara när kryptering används (STARTTLS eller SSL/TLS).")
    port = int(cfg.get("smtp_port") or 587)
    c = ssl.create_default_context()
    c.check_hostname = False
    c.verify_mode = ssl.CERT_NONE
    try:
        if sec == "ssl":
            srv = smtplib.SMTP_SSL(host, port, timeout=20, context=c)
            srv.ehlo()
        else:
            srv = smtplib.SMTP(host, port, timeout=20)
            srv.ehlo()
            srv.starttls(context=c)
        der = srv.sock.getpeercert(binary_form=True)
        try:
            srv.quit()
        except Exception:
            pass
    except Exception as e:
        raise ApiError(502, "Kunde inte ansluta till mailservern: {}".format(e))
    need(der, "Servern skickade inget certifikat.")
    fp = hashlib.sha256(der).hexdigest().upper()
    return {"pem": ssl.DER_cert_to_PEM_cert(der), "sha256": ":".join(fp[i:i + 2] for i in range(0, len(fp), 2))}


# ================================================================ API: säkerhetskopia
@route("GET", r"/api/backup\.db", admin=True)
def api_backup(ctx):
    import tempfile
    fd, tmp = tempfile.mkstemp(suffix=".db")
    os.close(fd)
    try:
        dst = sqlite3.connect(tmp)
        ctx["con"].backup(dst)
        dst.close()
        with open(tmp, "rb") as f:
            data = f.read()
    finally:
        os.remove(tmp)
    fname = "arenden-backup-{}.db".format(time.strftime("%Y-%m-%d"))
    ctx["handler"].send_bytes(200, data, "application/octet-stream",
                              {"Content-Disposition": 'attachment; filename="{}"'.format(fname), "Cache-Control": "no-store"})


# ================================================================ start
def main():
    init_db()
    srv = ThreadingHTTPServer(("0.0.0.0", PORT), Handler)
    srv.daemon_threads = True
    print("Ärendehantering körs på http://0.0.0.0:{}  (databas: {})".format(PORT, DB_PATH), flush=True)
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
